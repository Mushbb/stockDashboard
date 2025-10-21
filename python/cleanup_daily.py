import os
import pyodbc
from datetime import datetime, timedelta
from dotenv import load_dotenv


def cleanup_previous_day_metrics():
	"""
	어제 날짜의 daily_metrics 데이터 중, 각 종목별 마지막 데이터를 제외하고 모두 삭제합니다.
	"""
	conn = None
	try:
		load_dotenv()
		connection_string = os.getenv("SQL_CONNECTION_STRING")
		if not connection_string:
			raise ValueError("SQL_CONNECTION_STRING not found.")

		conn = pyodbc.connect(connection_string)
		cursor = conn.cursor()

		# 어제 날짜를 'YYYY-MM-DD' 형식으로 계산
		yesterday = datetime.now() - timedelta(days=1)
		target_date_str = yesterday.strftime('%Y-%m-%d')

		print(f"[{datetime.now()}] Starting cleanup for date: {target_date_str}")

		# CTE(Common Table Expression)를 사용하여 각 종목별 마지막 레코드를 식별
		# 1. target_date에 해당하는 각 ISU_SRT_CD 별로 가장 늦은 collected_at 시간을 찾습니다.
		# 2. 이 정보를 바탕으로 해당 시간과 일치하지 않는 모든 레코드를 삭제합니다.
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

		# SQL 실행
		cursor.execute(cleanup_sql, target_date_str, target_date_str)
		deleted_rows = cursor.rowcount
		conn.commit()

		print(f" - Successfully cleaned up {deleted_rows} intraday rows.")
		print(f"[{datetime.now()}] Cleanup process finished.")

	except Exception as e:
		print(f"An error occurred during cleanup: {e}")
		if conn:
			conn.rollback()
	finally:
		if conn:
			conn.close()


if __name__ == '__main__':
	cleanup_previous_day_metrics()