import os
import pandas as pd
import pyodbc
from datetime import datetime, timedelta
from dotenv import load_dotenv

converter = {
	'ISU_SRT_CD': str,
}


def load_initial_state(conn):
	"""[수정] 통합 'stock_history' 테이블에서 모든 종목의 최종 상태를 로드"""
	print("DB의 통합 테이블에서 모든 종목의 최종 상태를 로드합니다...")
	state = {}
	cursor = conn.cursor()

	# 단일 쿼리로 현재 유효한 모든 이력을 가져옵니다.
	query = "SELECT stock_id, history_type, value FROM stock_history WHERE end_date IS NULL"
	cursor.execute(query)

	for stock_id, history_type, value in cursor.fetchall():
		if stock_id not in state:
			state[stock_id] = {}
		# 예: state['005930']['SECTOR'] = '전자'
		state[stock_id][history_type] = value

	print(f"총 {len(state)}개 종목의 초기 상태 로드 완료.")
	return state


def run_batch_processing(conn, start_date_str, end_date_str):
	"""[수정] 지정된 기간 동안의 모든 파일을 순차적으로 처리하여 통합 테이블에 반영"""

	current_state = load_initial_state(conn)
	start_date = datetime.strptime(start_date_str, '%Y%m%d').date()
	end_date = datetime.strptime(end_date_str, '%Y%m%d').date()
	cursor = conn.cursor()

	# [수정] CSV 컬럼명과 DB의 history_type을 매핑하여 확장성 있게 관리합니다.
	history_mapping = {
		'IDX_IND_NM': 'SECTOR',  # CSV의 섹터 컬럼 -> DB의 'SECTOR' 타입
		'MKT_TP_NM': 'MARKET'  # CSV의 시장 컬럼 -> DB의 'MARKET' 타입
	}

	current_date = start_date
	while current_date <= end_date:
		date_str = current_date.strftime('%Y%m%d')
		# 파일 경로는 그대로 유지
		file_path1 = f"CatData/{date_str}.csv"
		file_path2 = f"CatData2/{date_str}.csv"

		if not os.path.exists(file_path1) or not os.path.exists(file_path2):
			print(f"'{date_str}' 날짜의 파일 쌍이 없어 건너뜁니다.")
			current_date += timedelta(days=1)
			continue

		df1 = pd.read_csv(file_path1, converters=converter)
		df2 = pd.read_csv(file_path2, converters=converter)
		df = pd.concat([df1, df2], ignore_index=True)
		df.drop_duplicates(subset=['ISU_SRT_CD'], keep='last', inplace=True)

		print(f"'{date_str}' 파일 처리 중... (총 {len(df)}개 종목)")
		yesterday = current_date - timedelta(days=1)

		for _, row in df.iterrows():
			stock_id = row['ISU_SRT_CD']
			stock_state = current_state.get(stock_id, {})

			# [수정] 매핑된 모든 이력 타입(SECTOR, MARKET)에 대해 변경 여부를 확인합니다.
			for csv_column, history_type in history_mapping.items():
				csv_value = row[csv_column]
				db_value = stock_state.get(history_type)

				if db_value != csv_value:
					print(f"  [{history_type} 변경] {stock_id}: {db_value or 'N/A'} -> {csv_value}")

					# 1. 기존 이력이 있으면 통합 테이블에서 end_date를 업데이트합니다.
					if db_value is not None:
						cursor.execute(
							"UPDATE stock_history SET end_date = ? WHERE stock_id = ? AND history_type = ? AND end_date IS NULL",
							yesterday, stock_id, history_type)

					# 2. 새로운 이력을 통합 테이블에 삽입합니다.
					cursor.execute(
						"INSERT INTO stock_history (stock_id, history_type, start_date, end_date, value) VALUES (?, ?, ?, ?, ?)",
						stock_id, history_type, current_date, None, csv_value)

					# 3. 메모리의 캐시 상태도 최신 정보로 업데이트합니다.
					if stock_id not in current_state: current_state[stock_id] = {}
					current_state[stock_id][history_type] = csv_value

		conn.commit()
		current_date += timedelta(days=1)

	print("\n모든 배치 작업이 완료되었습니다.")


if __name__ == '__main__':
	conn = None
	try:
		load_dotenv()
		connection_string = os.getenv("SQL_CONNECTION_STRING")
		if not connection_string:
			raise ValueError("SQL_CONNECTION_STRING 환경 변수를 찾을 수 없습니다.")

		print("데이터베이스에 연결합니다...")
		conn = pyodbc.connect(connection_string)
		print("연결에 성공했습니다.")

		# 처리할 날짜 범위 설정
		START_DATE = '20100104'
		END_DATE = '20250903'

		run_batch_processing(conn, START_DATE, END_DATE)

	except Exception as e:
		print(f"오류가 발생했습니다: {e}")
		if conn:
			conn.rollback()
	finally:
		if conn:
			conn.close()
			print("\n데이터베이스 연결을 닫았습니다.")
