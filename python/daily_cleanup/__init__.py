import os
import pyodbc
from datetime import datetime, timedelta
from dotenv import load_dotenv
import azure.functions as func  # [필수] Azure 함수 패키지
import logging  # [필수] 로그 패키지


# --- 핵심 로직 함수 (이름: cleanup_logic) ---
def cleanup_logic():
	"""
	어제 날짜의 daily_metrics 데이터 중, 각 종목별 마지막 데이터를 제외하고 모두 삭제합니다.
	"""
	conn = None
	try:
		# 로컬 테스트를 위한 dotenv (Azure에서는 무시됨)
		load_dotenv()
		connection_string = os.getenv("SQL_CONNECTION_STRING")

		if not connection_string:
			# logging.error로 변경하여 Azure 로그에 빨간색으로 표시되게 함
			raise ValueError("SQL_CONNECTION_STRING not found.")

		conn = pyodbc.connect(connection_string)
		cursor = conn.cursor()

		# [중요] Azure 서버 시간(UTC)을 한국 시간(KST)으로 변환
		# 그냥 datetime.now()를 쓰면 한국 새벽 1시에 돌릴 때 '그저께' 날짜가 잡힐 수 있음
		kst_now = datetime.utcnow() + timedelta(hours=9)
		yesterday = kst_now - timedelta(days=1)
		target_date_str = yesterday.strftime('%Y-%m-%d')

		logging.info(f"[{kst_now}] Starting cleanup for date: {target_date_str}")

		# CTE를 사용한 삭제 쿼리 (변경 없음)
		cleanup_sql = """
         WITH FinalRecords AS (
             SELECT
                 ISU_SRT_CD,
                 MAX(collected_at) as final_collected_at
             FROM
                 daily_metrics
             WHERE
                 metric_date = ?
             GROUP BY
                 ISU_SRT_CD
         )
         DELETE dm
         FROM
             daily_metrics dm
         INNER JOIN
             FinalRecords fr ON dm.ISU_SRT_CD = fr.ISU_SRT_CD
         WHERE
             dm.metric_date = ? AND dm.collected_at < fr.final_collected_at;
         """

		cursor.execute(cleanup_sql, target_date_str, target_date_str)
		deleted_rows = cursor.rowcount
		conn.commit()

		logging.info(f" - Successfully cleaned up {deleted_rows} intraday rows.")
		logging.info("Cleanup process finished.")

	except Exception as e:
		logging.error(f"An error occurred during cleanup: {e}")
		if conn:
			conn.rollback()
	finally:
		if conn:
			conn.close()


# --- Azure Functions 진입점 ---
def main(mytimer: func.TimerRequest) -> None:
	# 1. 타이머 트리거 시작 로그
	if mytimer.past_due:
		logging.info('The timer is past due!')

	logging.info('Cleanup timer trigger function started.')

	# 2. 위에서 정의한 청소 로직 실행
	cleanup_logic()

	logging.info('Cleanup timer trigger function finished.')