import os
import requests
import pandas as pd
import pyodbc
from datetime import datetime, timedelta
from dotenv import load_dotenv
import azure.functions as func
import logging

# --- 1. 설정 (Configuration) ---
KRX_URL = 'https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd'

# [중요] 쿠키 값은 주기적으로 갱신이 필요할 수 있습니다.
KRX_HEADERS = {
	'Accept': 'application/json, text/javascript, */*; q=0.01',
	'Accept-Encoding': 'gzip, deflate, br, zstd',
	'Accept-Language': 'ko,en;q=0.9,en-US;q=0.8',
	'Connection': 'keep-alive',
	'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
	'Cookie': '__smVisitorID=gJNV0xI1RRT; JSESSIONID=cyCLRovgeTyA6lzYQFFMtddUEsp9aBQeBf8aRRbw1Gv96mYLl0378g1tsAj7nGr0.bWRjX2RvbWFpbi9tZGNvd2FwMi1tZGNhcHAwMQ==',
	'Host': 'data.krx.co.kr',
	'Origin': 'https://data.krx.co.kr',
	'Referer': 'https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201030101',
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
	'X-Requested-With': 'XMLHttpRequest'
}


# --- 2. 데이터 정제 함수 ---
def clean_and_convert(value, target_type):
	"""콤마, 공백 제거 후 숫자 타입으로 변환"""
	if pd.isna(value) or str(value).strip() in ['', '-']:
		return None
	try:
		cleaned_value = str(value).replace(',', '').strip()
		if target_type == int:
			return int(float(cleaned_value)) if cleaned_value else None
		else:
			return target_type(cleaned_value) if cleaned_value else None
	except (ValueError, TypeError):
		return None


# --- 3. API 및 DB 처리 함수 ---
def fetch_current_etf_data():
	"""
    [수정] KRX에서 ETF 데이터를 가져와 (DataFrame, collected_at_str) 튜플로 반환
    """
	# [시간 보정] UTC -> KST
	kst_now = datetime.utcnow() + timedelta(hours=9)
	today_date_str = kst_now.strftime('%Y%m%d')

	form_data = {
		'bld': 'dbms/MDC/STAT/standard/MDCSTAT04301',
		'locale': 'ko_KR',
		'trdDd': today_date_str,
		'share': '1',
		'money': '1',
		'csvxls_isNo': 'false'
	}
	try:
		response = requests.post(KRX_URL, headers=KRX_HEADERS, data=form_data, timeout=30)
		response.raise_for_status()
		response.encoding = 'utf-8'
		data = response.json()

		if "output" in data and data["output"]:
			logging.info(f"Successfully fetched {len(data['output'])} ETF items for {today_date_str}.")

			# [Global 제거] 수집 시각을 변수에 담아 리턴
			collected_at_str = data.get("CURRENT_DATETIME", kst_now.strftime('%Y.%m.%d %p %I:%M:%S'))
			return pd.DataFrame(data["output"]), collected_at_str

		logging.warning(f"API response for ETF on {today_date_str} is empty.")
		return None
	except requests.RequestException as e:
		logging.error(f"ETF API request failed: {e}")
		return None


def upsert_daily_etf_metrics(conn, df, collected_at_str):
	"""
    [수정] collected_at_str을 인자로 받아서 처리
    """
	cursor = conn.cursor()

	# [시간 보정] UTC -> KST
	kst_now = datetime.utcnow() + timedelta(hours=9)
	today_str = kst_now.strftime('%Y%m%d')

	# 데이터 타입 변환
	converters = {
		'TDD_CLSPRC': int, 'CMPPREVDD_PRC': int, 'MKTCAP': int, 'FLUC_TP_CD': int,
		'TDD_OPNPRC': int, 'TDD_HGPRC': int, 'TDD_LWPRC': int, 'ACC_TRDVOL': int,
		'ACC_TRDVAL': int, 'LIST_SHRS': int, 'INVSTASST_NETASST_TOTAMT': int,
		'FLUC_RT': float, 'NAV': float
	}
	for col, target_type in converters.items():
		if col in df.columns:
			df[col] = df[col].apply(lambda x: clean_and_convert(x, target_type))

	# 수집 시각 파싱 (KRX 포맷: "2024.08.19 PM 03:30:00")
	formatted_collected_at = ""
	try:
		collected_at_dt_obj = datetime.strptime(collected_at_str, "%Y.%m.%d %p %I:%M:%S")
		formatted_collected_at = collected_at_dt_obj.strftime('%Y-%m-%d %H:%M:%S')
	except ValueError:
		logging.warning(f"Could not parse collected_at string '{collected_at_str}'. Using current timestamp.")
		formatted_collected_at = kst_now.strftime('%Y-%m-%d %H:%M:%S')

	insert_sql = """
        INSERT INTO daily_metrics (
            ISU_SRT_CD, metric_date, collected_at, TDD_CLSPRC, FLUC_TP_CD, CMPPREVDD_PRC, FLUC_RT,
            TDD_OPNPRC, TDD_HGPRC, TDD_LWPRC, ACC_TRDVOL, ACC_TRDVAL, MKTCAP, LIST_SHRS, NAV
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """

	inserted_count = 0
	node_inserted_count = 0

	for _, row in df.iterrows():
		if row.get('TDD_CLSPRC') is None:
			continue

		# 1. 신규 ETF 추가 (nodes)
		try:
			node_insert_sql = """
                IF NOT EXISTS (SELECT 1 FROM nodes WHERE ISU_SRT_CD = ?)
                BEGIN
                    INSERT INTO nodes(ISU_SRT_CD, node_name, node_type, ISU_CD)
                    VALUES (?, ?, ?, ?);
                END
            """
			cursor.execute(node_insert_sql,
						   row['ISU_SRT_CD'], row['ISU_SRT_CD'], row['ISU_ABBRV'], 'ETF', row['ISU_CD'])
			if cursor.rowcount > 0:
				node_inserted_count += 1
		except pyodbc.Error as e:
			logging.error(f"Error inserting/checking node {row['ISU_SRT_CD']}: {e}")
			continue

		# 2. 시세 INSERT (daily_metrics)
		params = (
			row.get('ISU_SRT_CD'),
			today_str,
			formatted_collected_at,
			row.get('TDD_CLSPRC'), row.get('FLUC_TP_CD'), row.get('CMPPREVDD_PRC'), row.get('FLUC_RT'),
			row.get('TDD_OPNPRC'), row.get('TDD_HGPRC'), row.get('TDD_LWPRC'), row.get('ACC_TRDVOL'),
			row.get('ACC_TRDVAL'), row.get('MKTCAP'), row.get('LIST_SHRS'), row.get('NAV')
		)
		try:
			cursor.execute(insert_sql, params)
			inserted_count += 1
		except pyodbc.IntegrityError:
			# 중복 시 무시
			pass
		except pyodbc.Error as e:
			logging.error(f"Error inserting metric for {row.get('ISU_SRT_CD')} on {today_str}: {e}")
			conn.rollback()
			raise

	conn.commit()
	logging.info(f"Successfully inserted {inserted_count} ETF metrics into daily_metrics.")
	if node_inserted_count > 0:
		logging.info(f"Successfully added {node_inserted_count} new ETF nodes.")


# --- 4. 메인 로직 함수 (이름: run_etf_job) ---
def run_etf_job():
	conn = None
	try:
		load_dotenv()
		connection_string = os.getenv("SQL_CONNECTION_STRING")
		if not connection_string:
			raise ValueError("SQL_CONNECTION_STRING not found.")

		# 시작 시간 로깅 (KST)
		kst_now = datetime.utcnow() + timedelta(hours=9)
		logging.info(f"Starting ETF update at {kst_now.strftime('%Y-%m-%d %H:%M:%S')} (KST)")

		# [수정] 튜플로 리턴 받음
		result = fetch_current_etf_data()

		if result is not None:
			df, collected_at_str = result  # 언패킹

			if not df.empty:
				conn = pyodbc.connect(connection_string)
				# [수정] 시간 인자 전달
				upsert_daily_etf_metrics(conn, df, collected_at_str)
			else:
				logging.warning("No ETF data to process.")
		else:
			logging.warning("API fetch failed or returned None.")

	except Exception as e:
		logging.error(f"An unexpected error occurred: {e}")
		if conn:
			conn.rollback()
	finally:
		if conn:
			conn.close()
		logging.info("Process finished.")


# --- 5. Azure Functions 진입점 ---
def main(mytimer: func.TimerRequest) -> None:
	if mytimer.past_due:
		logging.info('The timer is past due!')

	logging.info('ETF collection timer started.')
	run_etf_job()
	logging.info('ETF collection timer finished.')