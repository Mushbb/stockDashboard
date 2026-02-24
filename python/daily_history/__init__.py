import os
import pyodbc
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
import azure.functions as func
import logging
import FinanceDataReader as fdr

def fetch_master_data():
    try:
        logging.info("Fetching KRX and KRX-DESC data using FDR...")
        df_krx = fdr.StockListing('KRX')
        df_desc = fdr.StockListing('KRX-DESC')

        df_merged = pd.merge(df_krx, df_desc[['Code', 'Sector', 'Industry']], on='Code', how='left')
        df_merged.rename(columns={
            'Code': 'ISU_SRT_CD', 'Name': 'ISU_ABBRV', 'Sector': 'SECT_TP_NM',
            'Stocks': 'LIST_SHRS', 'Market': 'MKT_TP_NM', 'Industry': 'IDX_IND_NM'
        }, inplace=True)
        return df_merged
    except Exception as e:
        logging.error(f"Failed to fetch master data: {e}")
        return None

def sync_nodes_status(cursor, df):
    logging.info("Syncing nodes (New Listings & Delistings)...")
    current_codes = set(df['ISU_SRT_CD'].tolist())

    cursor.execute("SELECT ISU_SRT_CD, node_type FROM nodes")
    db_nodes = {row[0]: row[1] for row in cursor.fetchall()}
    db_codes = set(db_nodes.keys())

    new_codes = current_codes - db_codes
    delisted_codes = db_codes - current_codes

    if new_codes:
        logging.info(f"Found {len(new_codes)} new listed stocks. Inserting...")
        insert_data = []
        for code in new_codes:
            name_series = df[df['ISU_SRT_CD'] == code]['ISU_ABBRV']
            name = name_series.iloc[0] if not name_series.empty else 'Unknown'
            insert_data.append((code, name, 'Stock', code))
        cursor.fast_executemany = True
        cursor.executemany("INSERT INTO nodes (ISU_SRT_CD, node_name, node_type, ISU_CD) VALUES (?, ?, ?, ?)", insert_data)

    if delisted_codes:
        to_delist = [code for code in delisted_codes if db_nodes[code] != 'Delisted']
        if to_delist:
            logging.info(f"Found {len(to_delist)} delisted stocks. Updating status to 'Delisted'...")
            format_strings = ','.join(['?'] * len(to_delist))
            cursor.execute(f"UPDATE nodes SET node_type = 'Delisted' WHERE ISU_SRT_CD IN ({format_strings})", tuple(to_delist))

def update_histories(cursor, df, target_date):
    logging.info("Updating stock history (SCD)...")
    state = {}
    cursor.execute("SELECT stock_id, history_type, value FROM stock_history WHERE end_date IS NULL")
    for stock_id, history_type, value in cursor.fetchall():
        if stock_id not in state: state[stock_id] = {}
        state[stock_id][history_type] = value

    history_mapping = {'ISU_ABBRV': 'NAME', 'SECT_TP_NM': 'DEPARTMENT', 'LIST_SHRS': 'SHARES', 'MKT_TP_NM': 'MARKET', 'IDX_IND_NM': 'SECTOR'}

    for _, row in df.iterrows():
        stock_id = row['ISU_SRT_CD']
        stock_state = state.get(stock_id, {})

        for csv_column, history_type in history_mapping.items():
            if csv_column not in row: continue
            raw_csv_value = row[csv_column]
            csv_value = None if pd.isna(raw_csv_value) or str(raw_csv_value).strip() == '' else str(raw_csv_value).strip()
            db_value = stock_state.get(history_type)

            if db_value != csv_value:
                if db_value is not None:
                    cursor.execute("UPDATE stock_history SET end_date = ? WHERE stock_id = ? AND history_type = ? AND end_date IS NULL", target_date, stock_id, history_type)
                cursor.execute("INSERT INTO stock_history (stock_id, history_type, start_date, end_date, value) VALUES (?, ?, ?, ?, ?)", stock_id, history_type, target_date, None, csv_value)
                if stock_id not in state: state[stock_id] = {}
                state[stock_id][history_type] = csv_value

def history_logic():
    conn = None
    try:
        load_dotenv()
        connection_string = os.getenv("SQL_CONNECTION_STRING")
        if not connection_string: raise ValueError("SQL_CONNECTION_STRING not found.")

        conn = pyodbc.connect(connection_string)
        cursor = conn.cursor()
        kst_now = datetime.utcnow() + timedelta(hours=9)

        logging.info(f"[{kst_now}] 🚀 Starting Morning History & Master Sync Job...")

        merged_df = fetch_master_data()
        if merged_df is not None and not merged_df.empty:
            sync_nodes_status(cursor, merged_df)
            update_histories(cursor, merged_df, kst_now)
            conn.commit()
            logging.info("✅ Master sync and history updates successfully finished.")
        else:
            logging.warning("Master data is empty. Skipping updates.")

    except Exception as e:
        logging.error(f"❌ An error occurred during history update: {e}")
        if conn: conn.rollback()
    finally:
        if conn: conn.close()

def main(mytimer: func.TimerRequest) -> None:
    if mytimer.past_due: logging.info('The timer is past due!')
    history_logic()