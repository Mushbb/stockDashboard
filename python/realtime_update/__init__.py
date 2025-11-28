import os
import requests
import pandas as pd
import pyodbc
from datetime import datetime, timedelta
from dotenv import load_dotenv
import azure.functions as func
import logging

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


# --- 2. 데이터 정제 함수 ---
def clean_and_convert(value, target_type):
	if pd.isna(value) or value == '-': return None
	try:
		cleaned_value = str(value).replace(',', '').strip()
		return target_type(cleaned_value) if cleaned_value else None
	except (ValueError, TypeError):
		return None


# --- 3. API 및 DB 처리 함수 ---
def fetch_current_krx_data():
	"""
	[수정] DataFrame과 수집시간(collected_at)을 튜플로 반환
	Return: (DataFrame, collected_at_string) or None
	"""
	# 시간 보정 (UTC -> KST)
	kst_now = datetime.utcnow() + timedelta(hours=9)
	trd_dd = kst_now.strftime('%Y%m%d')

	form_data = {
		'bld': 'dbms/MDC/STAT/standard/MDCSTAT01501',
		'locale': 'ko_KR', 'mktId': 'ALL', 'trdDd': trd_dd,
		'share': '1', 'money': '1', 'csvxls_isNo': 'false'
	}
	try:
		response = requests.post(KRX_URL, headers=KRX_HEADERS, data=form_data, timeout=30)
		response.raise_for_status()
		data = response.json()

		if "OutBlock_1" in data and data["OutBlock_1"]:
			logging.info(f"Successfully fetched {len(data['OutBlock_1'])} items.")
			# global 제거 -> 리턴값으로 전달
			collected_at_str = data["CURRENT_DATETIME"]
			return pd.DataFrame(data["OutBlock_1"]), collected_at_str

		logging.warning("API response is empty.")
		return None
	except requests.RequestException as e:
		logging.error(f"API request failed: {e}")
		return None


def upsert_daily_metrics(conn, df, collected_at_str):
	"""
	[수정] collected_at_str을 인자로 받아서 처리
	"""
	cursor = conn.cursor()

	# 시간 보정 (UTC -> KST)
	kst_now = datetime.utcnow() + timedelta(hours=9)
	today_str = kst_now.strftime('%Y%m%d')

	# 데이터 타입 변환
	converters = {
		'TDD_CLSPRC': int, 'CMPPREVDD_PRC': int, 'MKTCAP': int, 'FLUC_TP_CD': int,
		'TDD_OPNPRC': int, 'TDD_HGPRC': int, 'TDD_LWPRC': int, 'ACC_TRDVOL': int,
		'ACC_TRDVAL': int, 'LIST_SHRS': int, 'FLUC_RT': float, 'FLUC_TP_NM': str
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

	# 전달받은 시간 문자열 변환
	collected_at_dt = datetime.strptime(collected_at_str, "%Y.%m.%d %p %I:%M:%S")
	estimated_data_time = collected_at_dt - timedelta(minutes=20)

	for _, row in df.iterrows():
		# 신규 종목 체크
		cursor.execute(
			"IF NOT EXISTS (SELECT 1 FROM nodes WHERE ISU_SRT_CD = ?) INSERT INTO nodes(ISU_SRT_CD, node_name, node_type, ISU_CD) VALUES (?, ?, ?, ?)",
			row['ISU_SRT_CD'], row['ISU_SRT_CD'], row['ISU_ABBRV'], 'Stock', row['ISU_CD'])

		# 시세 INSERT
		params = (
			row.get('ISU_SRT_CD'),
			today_str,
			collected_at_dt,
			estimated_data_time,
			row.get('TDD_CLSPRC'), row.get('FLUC_TP_CD'), row.get('CMPPREVDD_PRC'), row.get('FLUC_RT'),
			row.get('TDD_OPNPRC'), row.get('TDD_HGPRC'), row.get('TDD_LWPRC'), row.get('ACC_TRDVOL'),
			row.get('ACC_TRDVAL'), row.get('MKTCAP'), row.get('LIST_SHRS'), row.get('SECT_TP_NM')
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

		# [수정] 결과값을 튜플로 받음 (df, time_str)
		result = fetch_current_krx_data()

		if result is not None:
			df, collected_at_str = result  # 튜플 언패킹

			if not df.empty:
				conn = pyodbc.connect(connection_string)
				# [수정] 인자로 시간값 전달
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