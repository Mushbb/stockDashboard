import os
import pandas as pd
import pyodbc
from datetime import datetime, timedelta
from dotenv import load_dotenv

# --- 2. CSV 및 DB 처리 함수 ---
def read_stock_data_from_csv(file_path):
	"""지정된 경로의 CSV 파일을 읽어 DataFrame으로 반환"""
	print(f"Reading stock data from CSV file: {file_path}")
	try:
		# CSV 파일의 숫자 앞에 붙는 0이 사라지지 않도록 ISU_SRT_CD를 문자열로 읽습니다.
		df = pd.read_csv(file_path, dtype={'ISU_SRT_CD': str})
		if df.empty:
			print("  - Warning: CSV file is empty.")
			return None
		print(f"  - Successfully read {len(df)} rows from CSV.")
		return df
	except FileNotFoundError:
		print(f"  - Error: CSV file not found at the specified path: {file_path}")
		return None
	except Exception as e:
		print(f"  - An error occurred while reading the CSV file: {e}")
		return None


def load_history_state(cursor):
	"""DB의 통합 'stock_history' 테이블에서 종목별 최종 이력 정보를 메모리에 로드"""
	print("Loading history state from the unified 'stock_history' table...")
	state = {}
	query = "SELECT stock_id, history_type, value FROM stock_history WHERE end_date IS NULL"
	cursor.execute(query)
	for stock_id, history_type, value in cursor.fetchall():
		if stock_id not in state:
			state[stock_id] = {}
		state[stock_id][history_type] = value
	print(f"Loaded history state for {len(state)} stocks.")
	return state


def update_histories(conn, df, target_date, history_state):
	"""DataFrame과 메모리 상태를 비교하여 통합 이력 테이블을 업데이트"""
	cursor = conn.cursor()

	# CSV 컬럼명과 DB의 history_type을 매핑합니다.
	history_mapping = {
		'ISU_ABBRV': 'NAME',  # 이름
		'SECT_TP_NM': 'DEPARTMENT',  # 소속부
		'LIST_SHRS': 'SHARES',  # 상장주식수
		# 'MKT_TP_NM': 'MARKET',  # 시장 구분
		# 'IDX_IND_NM'는 새 CSV 구조에 없으므로 제외
	}

	for _, row in df.iterrows():
		stock_id = row['ISU_SRT_CD']
		stock_state = history_state.get(stock_id, {})

		for csv_column, history_type in history_mapping.items():
			raw_csv_value = row[csv_column]
			if pd.isna(raw_csv_value) or str(raw_csv_value).strip() == '':
				csv_value = None
			else:
				csv_value = str(raw_csv_value).strip()
			db_value = stock_state.get(history_type)

			if db_value != csv_value:
				print(f"  - Change detected for {stock_id} ({history_type}): {db_value or 'N/A'} -> {csv_value}")

				if db_value is not None:
					cursor.execute(
						"UPDATE stock_history SET end_date = ? WHERE stock_id = ? AND history_type = ? AND end_date IS NULL",
						target_date, stock_id, history_type)

				cursor.execute(
					"INSERT INTO stock_history (stock_id, history_type, start_date, end_date, value) VALUES (?, ?, ?, ?, ?)",
					stock_id, history_type, target_date, None, csv_value)

				if stock_id not in history_state:
					history_state[stock_id] = {}
				history_state[stock_id][history_type] = csv_value


# --- 3. 메인 실행 로직 ---
def main():
	conn = None
	try:
		load_dotenv()
		connection_string = os.getenv("SQL_CONNECTION_STRING")
		if not connection_string: raise ValueError("SQL_CONNECTION_STRING not found.")
		conn = pyodbc.connect(connection_string)

		filelist = os.listdir("NowData")
		for filename in filelist:
			# 이력 날짜는 스크립트 실행일의 전날로 설정
			target_date = filename.split('.')[0]

			print(
				f"Starting history update from CSV for date {target_date} at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

			# 1. 로컬 CSV 파일에서 데이터를 읽어옵니다.
			stock_df = read_stock_data_from_csv("NowData/"+filename)
			if stock_df is None:
				print("No data to process. Exiting.")
				return

			# 2. DB에 연결하고 히스토리를 업데이트합니다.
			history_state_cache = load_history_state(conn.cursor())
			update_histories(conn, stock_df, target_date, history_state_cache)

		conn.commit()
		print(f"Successfully committed history updates from CSV.")

	except Exception as e:
		print(f"An error occurred: {e}")
		if conn: conn.rollback()
	finally:
		if conn: conn.close()
		print("Process finished.")


if __name__ == '__main__':
	main()
