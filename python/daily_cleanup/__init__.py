import os
import pyodbc
from datetime import datetime, timedelta
from dotenv import load_dotenv
import azure.functions as func
import logging

def cleanup_logic():
    conn = None
    try:
        load_dotenv()
        connection_string = os.getenv("SQL_CONNECTION_STRING")
        if not connection_string: raise ValueError("SQL_CONNECTION_STRING not found.")
 
        conn = pyodbc.connect(connection_string)
        cursor = conn.cursor()

        # 장 종료 후 실행한다고 하셨으므로, 실행 시점에 맞춰 날짜를 타겟팅합니다.
        # 기존 로직대로 '어제' 날짜를 정리하려면 아래 코드를 유지합니다.
        kst_now = datetime.utcnow() + timedelta(hours=9)
        yesterday = kst_now - timedelta(days=1)
        target_date_str = yesterday.strftime('%Y-%m-%d')

        logging.info(f"[{kst_now}] 🧹 Starting Daily Cleanup for date: {target_date_str}")

        cleanup_sql = """
        WITH FinalRecords AS (
            SELECT ISU_SRT_CD, MAX(collected_at) as final_collected_at
            FROM daily_metrics
            WHERE metric_date = ?
            GROUP BY ISU_SRT_CD
        )
        DELETE dm
        FROM daily_metrics dm
        INNER JOIN FinalRecords fr ON dm.ISU_SRT_CD = fr.ISU_SRT_CD
        WHERE dm.metric_date = ? AND dm.collected_at < fr.final_collected_at;
        """
        
        cursor.execute(cleanup_sql, target_date_str, target_date_str)
        deleted_rows = cursor.rowcount
        conn.commit()

        logging.info(f"✅ Successfully cleaned up {deleted_rows} intraday rows.")

    except Exception as e:
        logging.error(f"❌ An error occurred during cleanup: {e}")
        if conn: conn.rollback()
    finally:
        if conn: conn.close()

def main(mytimer: func.TimerRequest) -> None:
    if mytimer.past_due: logging.info('The timer is past due!')
    cleanup_logic()