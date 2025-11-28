import os
import requests
import pandas as pd
import pyodbc
from datetime import datetime, timedelta
from dotenv import load_dotenv
import azure.functions as func  # [추가 1] Azure 함수 기능
import logging  # [추가 2] 로그 기록용

# --- 1. 설정 (Configuration) ---
KRX_URL = 'http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd'
KRX_HEADERS = {
	'Accept': 'application/json, text/javascript, */*; q=0.01',
	'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
	'Cookie': '__smVisitorID=me7Gx9QJQYB; JSESSIONID=IpmZQV2r1FhmZ698OoaVak77SGgeWJCs1VVTVdWgRRb39o2ulPZjDD5SHmlxKFow.bWRjX2vbWFpbi9tZGNvd2FwMi1tZGNhcHAwMQ==',
	'Host': 'data.krx.co.kr',
	'Origin': 'http://data.krx.co.kr',
	'Referer': 'http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020101',
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
	'X-Requested-With': 'XMLHttpRequest'
}


# --- 2. API 및 DB 처리 함수 (기존 로직 그대로 유지) ---
def fetch_krx_category_data(target_date_str, market_id):
	form_data = {
		'bld': 'dbms/MDC/STAT/standard/MDCSTAT03901',
		'locale': 'ko_KR', 'mktId': market_id, 'trdDd': target_date_str,
		'money': '1', 'csvxls_isNo': 'false'
	}
	if market_id == 'KSQ': form_data['segTpCd'] = 'ALL'
	try:
		response = requests.post(KRX_URL, headers=KRX_HEADERS, data=form_data, timeout=10)
		response.raise_for_status()
		data = response.json()
		if "block1" in data and data["block1"]:
			return pd.DataFrame(data["block1"])
		logging.info(f"    - {market_id} market data is empty for {target_date_str}.")  # print -> logging
		return None
	except requests.RequestException as e:
		logging.error(f"    - API request failed for {target_date_str} ({market_id}): {e}")  # print -> logging
		return None


def fetch_current_krx_data():
	# [주의] Azure 서버 시간은 UTC이므로 한국 시간(KST)으로 보정 필요할 수 있음. 일단은 유지.
	form_data = {
		'bld': 'dbms/MDC/STAT/standard/MDCSTAT01501',
		'locale': 'ko_KR', 'mktId': 'ALL', 'trdDd': datetime.now().strftime('%Y%m%d'),
		'share': '1', 'money': '1', 'csvxls_isNo': 'false'
	}
	try:
		response = requests.post(KRX_URL, headers=KRX_HEADERS, data=form_data, timeout=30)
		response.raise_for_status()
		data = response.json()
		if "OutBlock_1" in data and data["OutBlock_1"]:
			logging.info(f"Successfully fetched {len(data['OutBlock_1'])} items.")  # print -> logging
			return pd.DataFrame(data["OutBlock_1"])
		logging.info("API response is empty.")
		return None
	except requests.RequestException as e:
		logging.error(f"API request failed: {e}")
		return None


def load_history_state(cursor):
	logging.info("Loading history state from the unified 'stock_history' table...")
	state = {}
	query = "SELECT stock_id, history_type, value FROM stock_history WHERE end_date IS NULL"
	cursor.execute(query)
	for stock_id, history_type, value in cursor.fetchall():
		if stock_id not in state:
			state[stock_id] = {}
		state[stock_id][history_type] = value
	logging.info(f"Loaded history state for {len(state)} stocks.")
	return state


def update_histories(conn, df, target_date, history_state):
	cursor = conn.cursor()
	yesterday = target_date
	history_mapping = {
		'ISU_ABBRV': 'NAME', 'SECT_TP_NM': 'DEPARTMENT',
		'LIST_SHRS': 'SHARES', 'MKT_TP_NM': 'MARKET', 'IDX_IND_NM': 'SECTOR',
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
				# logging.info로 변경 (너무 많으면 주석 처리)
				# logging.info(f"    - Change detected for {stock_id} ({history_type}): {db_value or 'N/A'} -> {csv_value}")

				if db_value is not None:
					cursor.execute(
						"UPDATE stock_history SET end_date = ? WHERE stock_id = ? AND history_type = ? AND end_date IS NULL",
						yesterday, stock_id, history_type)

				cursor.execute(
					"INSERT INTO stock_history (stock_id, history_type, start_date, end_date, value) VALUES (?, ?, ?, ?, ?)",
					stock_id, history_type, target_date, None, csv_value)

				if stock_id not in history_state:
					history_state[stock_id] = {}
				history_state[stock_id][history_type] = csv_value


# --- 3. [변경] 실제 로직을 담은 함수 (이름 변경 main -> run_logic) ---
def run_logic():
	conn = None
	try:
		load_dotenv()  # 로컬 테스트용 (Azure에서는 환경변수 설정 메뉴 사용)
		connection_string = os.getenv("SQL_CONNECTION_STRING")
		if not connection_string: raise ValueError("SQL_CONNECTION_STRING not found.")

		# [팁] Azure는 UTC 기준이므로 한국 시간 필요시 아래처럼 보정
		# target_date = datetime.utcnow() + timedelta(hours=9)
		target_date = datetime.now()
		target_date_str = target_date.strftime('%Y%m%d')

		logging.info(f"Starting history update for {target_date_str}")

		df_kospi = fetch_krx_category_data(target_date_str, 'STK')
		df_kosdaq = fetch_krx_category_data(target_date_str, 'KSQ')

		data_frames = [df for df in [df_kospi, df_kosdaq] if df is not None]
		if not data_frames:
			logging.warning(f"No category data found for {target_date_str}. Exiting.")
			return

		combined_df = pd.concat(data_frames, ignore_index=True)
		combined_df.drop_duplicates(subset=['ISU_SRT_CD'], keep='last', inplace=True)

		realtime_df = fetch_current_krx_data()
		if realtime_df is None:
			logging.error("Realtime data is empty. Exiting.")
			return

		merged_df = pd.merge(combined_df[['ISU_SRT_CD', 'IDX_IND_NM', 'MKT_TP_NM']],
							 realtime_df[['ISU_SRT_CD', 'ISU_ABBRV', 'SECT_TP_NM', 'LIST_SHRS']], on='ISU_SRT_CD',
							 how='inner')

		conn = pyodbc.connect(connection_string)
		history_state_cache = load_history_state(conn.cursor())
		update_histories(conn, merged_df, target_date, history_state_cache)
		conn.commit()
		logging.info(f"Successfully committed history updates for {target_date_str}.")

	except Exception as e:
		logging.error(f"An error occurred: {e}")
		if conn: conn.rollback()
	finally:
		if conn: conn.close()
		logging.info("Process finished.")


# --- 4. [변경] Azure Functions 진입점 ---
# if __name__ == '__main__': 이 부분은 삭제하고 아래로 대체합니다.

def main(mytimer: func.TimerRequest) -> None:
	# 타이머가 트리거되면 실행되는 곳
	if mytimer.past_due:
		logging.info('The timer is past due!')

	logging.info('Python timer trigger function started.')

	# 여기서 위의 로직 함수를 호출
	run_logic()

	logging.info('Python timer trigger function finished.')