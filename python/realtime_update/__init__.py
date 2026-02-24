import pandas as pd
import pyodbc
from datetime import datetime, timedelta
import azure.functions as func
import logging
import FinanceDataReader as fdr  # [추가] requests 대신 FDR 사용
from dotenv import load_dotenv
import os

# --- 1. 설정 (Configuration) ---
# (기존 KRX_URL, KRX_HEADERS 등 복잡한 설정은 삭제)


# --- 2. 데이터 정제 함수 ---
def clean_and_convert(value, target_type):
    if pd.isna(value) or value == '-' or value == '': return None
    try:
        # FDR은 이미 숫자형으로 주는 경우가 많으므로 문자열 변환 후 처리
        cleaned_value = str(value).replace(',', '').strip()
        # float로 먼저 바꾼 뒤 int로 변환해야 에러가 안 남
        return target_type(float(cleaned_value)) if target_type == int else target_type(cleaned_value)
    except (ValueError, TypeError):
        return None


# --- 3. API 및 DB 처리 함수 ---
def fetch_current_fdr_data():
    """
    [수정] FDR을 사용하여 현재 시세 DataFrame과 수집시간을 반환
    """
    try:
        logging.info("Fetching current real-time data via FDR...")
        # FDR로 KRX 전종목 현재가(스냅샷) 수집
        df = fdr.StockListing('KRX')
        
        # FDR은 API처럼 수집 시간을 문자열로 주지 않으므로 직접 KST 생성
        kst_now = datetime.utcnow() + timedelta(hours=9)
        collected_at_str = kst_now.strftime("%Y.%m.%d %p %I:%M:%S")

        if not df.empty:
            logging.info(f"Successfully fetched {len(df)} items.")
            return df, collected_at_str

        logging.warning("FDR returned an empty dataframe.")
        return None
    except Exception as e:
        logging.error(f"FDR request failed: {e}")
        return None


def upsert_daily_metrics(conn, df, collected_at_str):
    cursor = conn.cursor()

    kst_now = datetime.utcnow() + timedelta(hours=9)
    today_str = kst_now.strftime('%Y%m%d')

    # [수정] FDR 컬럼명을 기존 로직에 맞게 매핑
    col_map = {
        'Code': 'ISU_SRT_CD',
        'Name': 'ISU_ABBRV',
        'Close': 'TDD_CLSPRC',
        'ChangeCode': 'FLUC_TP_CD',
        'Changes': 'CMPPREVDD_PRC',
        'ChagesRatio': 'FLUC_RT',
        'Open': 'TDD_OPNPRC',
        'High': 'TDD_HGPRC',
        'Low': 'TDD_LWPRC',
        'Volume': 'ACC_TRDVOL',
        'Amount': 'ACC_TRDVAL',
        'Marcap': 'MKTCAP',
        'Stocks': 'LIST_SHRS'
    }
    df = df.rename(columns=col_map)

    # 데이터 타입 변환 (기존과 동일)
    converters = {
        'TDD_CLSPRC': int, 'CMPPREVDD_PRC': int, 'MKTCAP': int, 'FLUC_TP_CD': int,
        'TDD_OPNPRC': int, 'TDD_HGPRC': int, 'TDD_LWPRC': int, 'ACC_TRDVOL': int,
        'ACC_TRDVAL': int, 'LIST_SHRS': int, 'FLUC_RT': float
    }
    for col, target_type in converters.items():
        if col in df.columns:
            df[col] = df[col].apply(lambda x: clean_and_convert(x, target_type))

    insert_sql = """
        INSERT INTO daily_metrics (
            ISU_SRT_CD, metric_date, collected_at, data_time, TDD_CLSPRC, FLUC_TP_CD, CMPPREVDD_PRC, FLUC_RT,
            TDD_OPNPRC, TDD_HGPRC, TDD_LWPRC, ACC_TRDVOL, ACC_TRDVAL, MKTCAP, LIST_SHRS, SECT_TP_NM
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """

    collected_at_dt = datetime.strptime(collected_at_str, "%Y.%m.%d %p %I:%M:%S")
    # 네이버 금융 등에서 긁어오므로 대략 20분 지연(Delay) 데이터로 취급
    estimated_data_time = collected_at_dt - timedelta(minutes=20)

    for _, row in df.iterrows():
        # FDR 버전에 따라 ISU_CD가 없을 수도 있으므로 안전하게 처리
        isu_cd = row.get('ISU_CD', row.get('ISU_SRT_CD'))
        
        # 신규 종목 체크 (기존과 동일)
        cursor.execute(
            "IF NOT EXISTS (SELECT 1 FROM nodes WHERE ISU_SRT_CD = ?) INSERT INTO nodes(ISU_SRT_CD, node_name, node_type, ISU_CD) VALUES (?, ?, ?, ?)",
            row['ISU_SRT_CD'], row['ISU_SRT_CD'], row['ISU_ABBRV'], 'Stock', isu_cd)

        # 시세 INSERT (기존과 동일, SECT_TP_NM은 실시간 수집에서 무거우므로 None 처리)
        params = (
            row.get('ISU_SRT_CD'), today_str, collected_at_dt, estimated_data_time,
            row.get('TDD_CLSPRC'), row.get('FLUC_TP_CD'), row.get('CMPPREVDD_PRC'), row.get('FLUC_RT'),
            row.get('TDD_OPNPRC'), row.get('TDD_HGPRC'), row.get('TDD_LWPRC'), row.get('ACC_TRDVOL'),
            row.get('ACC_TRDVAL'), row.get('MKTCAP'), row.get('LIST_SHRS'), None
        )
        cursor.execute(insert_sql, params)

    conn.commit()
    logging.info(f"Successfully inserted {len(df)} rows.")


# --- 4. 메인 로직 함수 ---
def run_metrics_job():
    conn = None
    try:
        load_dotenv()
        connection_string = os.getenv("SQL_CONNECTION_STRING")
        if not connection_string:
            raise ValueError("SQL_CONNECTION_STRING not found.")
        kst_now = datetime.utcnow() + timedelta(hours=9)
        logging.info(f"Starting update at {kst_now.strftime('%Y-%m-%d %H:%M:%S')} (KST)")

        # [수정] 함수명 변경
        result = fetch_current_fdr_data()

        if result is not None:
            df, collected_at_str = result

            if not df.empty:
                conn = pyodbc.connect(connection_string)
                upsert_daily_metrics(conn, df, collected_at_str)
            else:
                logging.warning("Dataframe is empty.")
        else:
            logging.warning("No data returned from API.")

    except Exception as e:
        logging.error(f"An error occurred: {e}")
        if conn: conn.rollback()
    finally:
        if conn: conn.close()
        logging.info("Process finished.")


# --- 5. Azure Functions 진입점 ---
def main(mytimer: func.TimerRequest) -> None:
    if mytimer.past_due:
        logging.info('The timer is past due!')

    logging.info('Metrics collection timer started.')
    run_metrics_job()
    logging.info('Metrics collection timer finished.')