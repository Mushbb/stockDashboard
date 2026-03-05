import os
import pyodbc
import pandas as pd
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from dotenv import load_dotenv
import azure.functions as func
import logging
import time
import re


# --- 1. 설정 ---
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}
NAVER_MARKET_SUM_URL = "https://finance.naver.com/sise/sise_market_sum.naver"


# --- 2. 네이버 전종목 마스터 수집 ---
def fetch_naver_stock_master(sosok: int) -> pd.DataFrame:
    """sosok=0: KOSPI, sosok=1: KOSDAQ — 종목코드/종목명/시장구분 수집"""
    market_name = "KOSPI" if sosok == 0 else "KOSDAQ"
    all_rows = []

    res = requests.get(NAVER_MARKET_SUM_URL, params={'sosok': sosok, 'page': 1}, headers=HEADERS, timeout=10)
    res.encoding = 'euc-kr'
    soup = BeautifulSoup(res.text, 'html.parser')

    pager = soup.select_one('td.pgRR > a')
    last_page = int(pager['href'].split('page=')[-1]) if pager else 1
    logging.info(f"{market_name}: 총 {last_page}페이지 수집 시작...")

    for page in range(1, last_page + 1):
        try:
            res = requests.get(NAVER_MARKET_SUM_URL, params={'sosok': sosok, 'page': page}, headers=HEADERS, timeout=10)
            res.encoding = 'euc-kr'
            soup = BeautifulSoup(res.text, 'html.parser')

            for row in soup.select('table.type_2 > tbody > tr'):
                cols = row.select('td')
                if len(cols) < 10:
                    continue
                link = row.select_one('a[href*="code="]')
                if not link:
                    continue
                code = link['href'].split('code=')[-1].strip()
                name = link.text.strip()
                list_shrs_raw = cols[9].text.strip() if len(cols) > 9 else ''
                try:
                    list_shrs = int(list_shrs_raw.replace(',', '').strip()) if list_shrs_raw and list_shrs_raw != '-' else None
                except ValueError:
                    list_shrs = None

                all_rows.append({
                    'ISU_SRT_CD': code,
                    'ISU_ABBRV': name,
                    'MKT_TP_NM': market_name,
                    'LIST_SHRS': list_shrs,
                })
            time.sleep(0.1)
        except Exception as e:
            logging.warning(f"{market_name} {page}페이지 실패: {e}")
            continue

    logging.info(f"{market_name}: {len(all_rows)}개 종목 수집 완료")
    return pd.DataFrame(all_rows)


# --- 3. 섹터 수집 (현재 미사용 - KRX 유료화로 소스 없음) ---
def fetch_krx_sector() -> pd.DataFrame:
    return pd.DataFrame()


# --- 4. 마스터 데이터 통합 ---
def fetch_master_data() -> pd.DataFrame:
    """KOSPI + KOSDAQ 마스터 + 섹터 병합 — FDR 대체"""
    try:
        df_kospi = fetch_naver_stock_master(sosok=0)
        df_kosdaq = fetch_naver_stock_master(sosok=1)
        df = pd.concat([df_kospi, df_kosdaq], ignore_index=True)

        df_sector = fetch_krx_sector()
        if not df_sector.empty:
            df = pd.merge(df, df_sector, on='ISU_SRT_CD', how='left')
        else:
            df['SECT_TP_NM'] = None

        # 기존 코드 호환 컬럼
        df['IDX_IND_NM'] = df.get('SECT_TP_NM', None)

        logging.info(f"마스터 데이터 {len(df)}개 종목 수집 완료")
        return df
    except Exception as e:
        logging.error(f"마스터 데이터 수집 실패: {e}")
        return None


# --- 5. 노드 동기화 (신규상장 / 상장폐지) --- 기존과 동일
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


# --- 6. 히스토리 업데이트 (SCD) --- 기존과 동일
def update_histories(cursor, df, target_date):
    logging.info("Updating stock history (SCD)...")
    state = {}
    cursor.execute("SELECT stock_id, history_type, value FROM stock_history WHERE end_date IS NULL")
    for stock_id, history_type, value in cursor.fetchall():
        if stock_id not in state:
            state[stock_id] = {}
        state[stock_id][history_type] = value

    history_mapping = {
        'ISU_ABBRV': 'NAME',
        'LIST_SHRS': 'SHARES',
        'MKT_TP_NM': 'MARKET',
        # 'SECT_TP_NM': 'DEPARTMENT',  # KRX 유료화로 섹터 소스 없음
        # 'IDX_IND_NM': 'SECTOR',      # KRX 유료화로 섹터 소스 없음
    }

    for _, row in df.iterrows():
        stock_id = row['ISU_SRT_CD']
        stock_state = state.get(stock_id, {})

        for csv_column, history_type in history_mapping.items():
            if csv_column not in row:
                continue
            raw_csv_value = row[csv_column]
            csv_value = None if pd.isna(raw_csv_value) or str(raw_csv_value).strip() == '' else str(raw_csv_value).strip()
            db_value = stock_state.get(history_type)

            if db_value != csv_value:
                if db_value is not None:
                    cursor.execute(
                        "UPDATE stock_history SET end_date = ? WHERE stock_id = ? AND history_type = ? AND end_date IS NULL",
                        target_date, stock_id, history_type
                    )
                cursor.execute(
                    "INSERT INTO stock_history (stock_id, history_type, start_date, end_date, value) VALUES (?, ?, ?, ?, ?)",
                    stock_id, history_type, target_date, None, csv_value
                )
                if stock_id not in state:
                    state[stock_id] = {}
                state[stock_id][history_type] = csv_value


# --- 7. 메인 로직 ---
def history_logic():
    conn = None
    try:
        load_dotenv()
        connection_string = os.getenv("SQL_CONNECTION_STRING")
        if not connection_string:
            raise ValueError("SQL_CONNECTION_STRING not found.")

        conn = pyodbc.connect(connection_string)
        cursor = conn.cursor()
        kst_now = datetime.utcnow() + timedelta(hours=9)
        logging.info(f"[{kst_now.strftime('%Y-%m-%d %H:%M:%S')}] 장 시작 배치 시작...")

        merged_df = fetch_master_data()
        if merged_df is not None and not merged_df.empty:
            sync_nodes_status(cursor, merged_df)
            update_histories(cursor, merged_df, kst_now)
            conn.commit()
            logging.info("마스터 동기화 완료")
        else:
            logging.warning("마스터 데이터 없음. 건너뜁니다.")

    except Exception as e:
        logging.error(f"오류 발생: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()


# --- 8. Azure Functions 진입점 ---
def main(mytimer: func.TimerRequest) -> None:
    if mytimer.past_due:
        logging.info('The timer is past due!')
    history_logic()


# --- 9. 로컬 실행용 진입점 ---
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    logging.info("=== 로컬 실행 모드 ===")
    history_logic()
