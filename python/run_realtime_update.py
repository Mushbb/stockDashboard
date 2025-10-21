import os
import requests
import json
import pandas as pd
import pyodbc
from datetime import datetime, timedelta
from dotenv import load_dotenv

# --- 1. 설정 (Configuration) ---
KRX_URL = 'http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd'
KRX_HEADERS = {
	'Accept': 'application/json, text/javascript, */*; q=0.01',
	'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
	'Cookie': '__smVisitorID=me7Gx9QJQYB; JSESSIONID=IpmZQV2r1FhmZ698OoaVak77SGgeWJCs1VVTVdWgRRb39o2ulPZjDD5SHmlxKFow.bWRjX2vbWFpbi9tZGNvd2FwMi1tZGNhcHAwMQ==',
	'Host': 'data.krx.co.kr',
	'Origin': 'http://data.krx.co.kr',
	'Referer': 'https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020201',
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
	'X-Requested-With': 'XMLHttpRequest'
}
collected_at = ""

# --- 2. 데이터 정제 함수 ---
def clean_and_convert(value, target_type):
	"""콤마, 공백 제거 후 숫자 타입으로 변환"""
	if pd.isna(value) or value == '-': return None
	try:
		cleaned_value = str(value).replace(',', '').strip()
		return target_type(cleaned_value) if cleaned_value else None
	except (ValueError, TypeError):
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


def upsert_daily_metrics(conn, df):
	"""DataFrame 데이터를 daily_metrics 테이블에 INSERT"""
	cursor = conn.cursor()
	today_str = datetime.now().strftime('%Y%m%d')

	# 데이터 타입 변환
	converters = {
		'TDD_CLSPRC': int, 'CMPPREVDD_PRC': int, 'MKTCAP': int, 'FLUC_TP_CD': int,
		'TDD_OPNPRC': int, 'TDD_HGPRC': int, 'TDD_LWPRC': int, 'ACC_TRDVOL': int,
		'ACC_TRDVAL': int, 'LIST_SHRS': int, 'FLUC_RT': float, 'FLUC_TP_NM': str
	}
	for col, target_type in converters.items():
		if col in df.columns:
			df[col] = df[col].apply(lambda x: clean_and_convert(x, target_type))

	# 💡 INSERT 구문에 data_time 컬럼 추가
	insert_sql = """
	    INSERT INTO daily_metrics (
	        ISU_SRT_CD, metric_date, collected_at, data_time, TDD_CLSPRC, FLUC_TP_CD, CMPPREVDD_PRC, FLUC_RT,
	        TDD_OPNPRC, TDD_HGPRC, TDD_LWPRC, ACC_TRDVOL, ACC_TRDVAL, MKTCAP, LIST_SHRS, SECT_TP_NM
	    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
	    """
	# API 응답에서 받은 데이터 수집 시각을 datetime 객체로 변환
	collected_at_dt = datetime.strptime(collected_at, "%Y.%m.%d %p %I:%M:%S")

	# 💡 20분 지연을 감안하여 실제 데이터 시각 추정
	estimated_data_time = collected_at_dt - timedelta(minutes=20)

	for _, row in df.iterrows():
		# 1. 신규 종목 추가 (nodes)
		cursor.execute(
			"IF NOT EXISTS (SELECT 1 FROM nodes WHERE ISU_SRT_CD = ?) INSERT INTO nodes(ISU_SRT_CD, node_name, node_type, ISU_CD) VALUES (?, ?, ?, ?)",
			row['ISU_SRT_CD'], row['ISU_SRT_CD'], row['ISU_ABBRV'], 'Stock', row['ISU_CD'])

		# 💡 시세 INSERT (daily_metrics)
		# 💡 파라미터에 estimated_data_time 추가
		params = (
			row.get('ISU_SRT_CD'),
			today_str,
			collected_at_dt,  # 수집 시각
			estimated_data_time,  # 데이터 추정 시각
			row.get('TDD_CLSPRC'), row.get('FLUC_TP_CD'), row.get('CMPPREVDD_PRC'), row.get('FLUC_RT'),
			row.get('TDD_OPNPRC'), row.get('TDD_HGPRC'), row.get('TDD_LWPRC'), row.get('ACC_TRDVOL'),
			row.get('ACC_TRDVAL'), row.get('MKTCAP'), row.get('LIST_SHRS'), row.get('SECT_TP_NM')
		)
		cursor.execute(insert_sql, params)

	conn.commit()
	print(f"Successfully inserted {len(df)} rows with estimated data time.")


# --- 4. 메인 실행 로직 ---
def main():
	conn = None
	try:
		load_dotenv()
		connection_string = os.getenv("SQL_CONNECTION_STRING")
		if not connection_string: raise ValueError("SQL_CONNECTION_STRING not found.")

		print(f"Starting update at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
		latest_data_df = fetch_current_krx_data()

		if latest_data_df is not None and not latest_data_df.empty:
			conn = pyodbc.connect(connection_string)
			upsert_daily_metrics(conn, latest_data_df)
		else:
			print("No data to process.")
	except Exception as e:
		print(f"An error occurred: {e}")
		if conn: conn.rollback()
	finally:
		if conn: conn.close()
		print("Process finished.")


if __name__ == '__main__':
	main()