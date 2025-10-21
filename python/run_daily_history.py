import os
import requests
import json
import pandas as pd
import pyodbc
from datetime import datetime, timedelta
from dotenv import load_dotenv

# --- 1. 설정 (Configuration) ---
# 이 섹션은 변경사항이 없습니다.
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
KRX_HEADERS2 = {
	'Accept': 'application/json, text/javascript, */*; q=0.01',
	'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
	'Cookie': '__smVisitorID=me7Gx9QJQYB; JSESSIONID=IpmZQV2r1FhmZ698OoaVak77SGgeWJCs1VVTVdWgRRb39o2ulPZjDD5SHmlxKFow.bWRjX2vbWFpbi9tZGNvd2FwMi1tZGNhcHAwMQ==',
	'Host': 'data.krx.co.kr',
	'Origin': 'http://data.krx.co.kr',
	'Referer': 'https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020201',
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
	'X-Requested-With': 'XMLHttpRequest'
}

# --- 2. API 및 DB 처리 함수 ---
def fetch_krx_category_data(target_date_str, market_id):
	"""지정된 날짜와 시장의 카테고리/섹터 데이터를 DataFrame으로 반환"""
	# 이 함수는 변경사항이 없습니다.
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
		print(f"    - {market_id} market data is empty for {target_date_str}.")
		return None
	except requests.RequestException as e:
		print(f"    - API request failed for {target_date_str} ({market_id}): {e}")
		return None

# --- 3. API 및 DB 처리 함수 ---
def fetch_current_krx_data():
	"""KRX에서 현재 시점의 전 종목 시세 DataFrame을 반환"""
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
			print(f"Successfully fetched {len(data['OutBlock_1'])} items.")
			global collected_at
			collected_at = data["CURRENT_DATETIME"]
			return pd.DataFrame(data["OutBlock_1"])
		print("API response is empty.")
		return None
	except requests.RequestException as e:
		print(f"API request failed: {e}")
		return None

def load_history_state(cursor):
	"""[수정] DB의 통합 'stock_history' 테이블에서 종목별 최종 이력 정보를 메모리에 로드"""
	print("Loading history state from the unified 'stock_history' table...")
	state = {}
	# 단일 쿼리로 현재 유효한 모든 이력(MARKET, SECTOR)을 가져옵니다.
	query = "SELECT stock_id, history_type, value FROM stock_history WHERE end_date IS NULL"
	cursor.execute(query)
	for stock_id, history_type, value in cursor.fetchall():
		if stock_id not in state:
			state[stock_id] = {}
		# 예: state['005930']['SECTOR'] = '전자'
		state[stock_id][history_type] = value
	print(f"Loaded history state for {len(state)} stocks.")
	return state


def update_histories(conn, df, target_date, history_state):
	"""[수정] DataFrame과 메모리 상태를 비교하여 통합 이력 테이블('stock_history')을 업데이트"""
	cursor = conn.cursor()
	yesterday = target_date

	# API 데이터의 컬럼명과 DB의 history_type을 매핑하여 확장성 있게 관리합니다.
	history_mapping = {
		'ISU_ABBRV': 'NAME',    # 이름
		'SECT_TP_NM': 'DEPARTMENT',    # 소속부
		'LIST_SHRS': 'SHARES',    # 상장주식수
		'MKT_TP_NM': 'MARKET',    # 시장 구분
		'IDX_IND_NM': 'SECTOR',    # 섹터(업종)
	}

	for _, row in df.iterrows():
		stock_id = row['ISU_SRT_CD']
		stock_state = history_state.get(stock_id, {}) # 메모리에서 현재 종목의 상태 조회

		# 매핑된 모든 이력 타입(SECTOR, MARKET)에 대해 변경 여부를 확인합니다.
		for csv_column, history_type in history_mapping.items():
			raw_csv_value = row[csv_column]
			if pd.isna(raw_csv_value) or str(raw_csv_value).strip() == '':
				csv_value = None
			else:
				csv_value = str(raw_csv_value).strip()

			db_value = stock_state.get(history_type)

			# DB 값과 API(CSV) 값을 비교하여 변경 사항이 있을 때만 업데이트합니다.
			if db_value != csv_value:
				print(f"    - Change detected for {stock_id} ({history_type}): {db_value or 'N/A'} -> {csv_value}")

				# 1. 기존 이력이 있으면 end_date를 어제 날짜로 업데이트합니다.
				if db_value is not None:
					cursor.execute(
						"UPDATE stock_history SET end_date = ? WHERE stock_id = ? AND history_type = ? AND end_date IS NULL",
						yesterday, stock_id, history_type)

				# 2. 새로운 이력을 start_date와 함께 삽입합니다.
				cursor.execute(
					"INSERT INTO stock_history (stock_id, history_type, start_date, end_date, value) VALUES (?, ?, ?, ?, ?)",
					stock_id, history_type, target_date, None, csv_value)

				# 3. 메모리의 캐시 상태도 최신 정보로 업데이트합니다.
				if stock_id not in history_state:
					history_state[stock_id] = {}
				history_state[stock_id][history_type] = csv_value


# --- 3. 메인 실행 로직 ---
def main():
	# 이 섹션은 변경사항이 없습니다.
	conn = None
	try:
		load_dotenv()
		connection_string = os.getenv("SQL_CONNECTION_STRING")
		if not connection_string: raise ValueError("SQL_CONNECTION_STRING not found.")

		target_date = datetime.now()
		target_date_str = target_date.strftime('%Y%m%d')

		print(f"Starting history update for {target_date_str} at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

		df_kospi = fetch_krx_category_data(target_date_str, 'STK')
		df_kosdaq = fetch_krx_category_data(target_date_str, 'KSQ')

		data_frames = [df for df in [df_kospi, df_kosdaq] if df is not None]
		if not data_frames:
			print(f"No category data found for {target_date_str}. Exiting.")
			return

		combined_df = pd.concat(data_frames, ignore_index=True)
		combined_df.drop_duplicates(subset=['ISU_SRT_CD'], keep='last', inplace=True)

		realtime_df = fetch_current_krx_data()
		merged_df = pd.merge(combined_df[['ISU_SRT_CD','IDX_IND_NM','MKT_TP_NM']],
							 realtime_df[['ISU_SRT_CD','ISU_ABBRV','SECT_TP_NM','LIST_SHRS']], on='ISU_SRT_CD', how='inner')

		conn = pyodbc.connect(connection_string)
		history_state_cache = load_history_state(conn.cursor()) # 수정된 함수 호출
		update_histories(conn, merged_df, target_date, history_state_cache) # 수정된 함수 호출
		conn.commit()
		print(f"Successfully committed history updates for {target_date_str}.")

	except Exception as e:
		print(f"An error occurred: {e}")
		if conn: conn.rollback()
	finally:
		if conn: conn.close()
		print("Process finished.")


if __name__ == '__main__':
	main()
