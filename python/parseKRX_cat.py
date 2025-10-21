import requests
import json
import pandas as pd
from datetime import datetime, timedelta
import os

# --- KRX API 요청 Python (requests) 코드 ---

# 요청 URL
url = 'http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd'

# 요청 헤더 (제공해주신 최신 값으로 업데이트)
headers = {
	'Accept': 'application/json, text/javascript, */*; q=0.01',
	'Accept-Encoding': 'gzip, deflate',
	'Accept-Language': 'ko,en;q=0.9,en-US;q=0.8,ja;q=0.7',
	'Connection': 'keep-alive',
	'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
	# !!! 중요: 아래 Cookie 값은 실제 유효한 값으로 교체해야 합니다.
	# 이 코드를 실행하기 직전에 브라우저 개발자 도구에서 가장 최신 Cookie 값을 복사하세요.
	'Cookie': '__smVisitorID=me7Gx9QJQYB; JSESSIONID=IpmZQV2r1FhmZ698OoaVak77SGgeWJCs1VVTVdWgRRb39o2ulPZjDD5SHmlxKFow.bWRjX2RvbWFpbi9tZGNvd2FwMi1tZGNhcHAwMQ==',
	'Host': 'data.krx.co.kr',
	'Origin': 'http://data.krx.co.kr',
	# !!! 중요: Referer 값도 실제 요청이 발생하는 페이지의 URL로 교체해야 합니다.
	'Referer': 'http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020101',
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
	'X-Requested-With': 'XMLHttpRequest'
}

# 폼 데이터 (제공해주신 파라미터 그대로)
# trdDd는 동적으로 변경 가능
# target_date = "20250730" # 예시 날짜. 실제로는 20240101부터 현재까지 반복해야 합니다.

def parseKRX(target_date):
	if os.path.exists(f"CatData/{target_date}.csv"):
		return

	form_data = {
		'bld': 'dbms/MDC/STAT/standard/MDCSTAT03901',
		'locale': 'ko_KR',
		'mktId': 'STK',
		'trdDd': target_date,
		'money': '1',
		'csvxls_isNo': 'false'
	}

	try:
		response = requests.post(url, headers=headers, data=form_data)
		response.raise_for_status() # HTTP 오류가 발생하면 예외 발생

		# 응답 본문을 텍스트로 가져와서 JSON으로 파싱 시도
		response_text = response.text

		try:
			data = json.loads(response_text)
			if "block1" in data and data["block1"]:
				pd.DataFrame(data["block1"]).to_csv(f"CatData/{target_date}.csv", index=False, encoding="utf-8-sig")
				print(f"Done: {target_date}")
			else:
				print(f"{target_date}: block1이 비어있거나 응답 데이터에 없습니다.")

		except json.JSONDecodeError as json_err:
			print(f"\nJSON 파싱 오류 발생: {json_err}")
			print("응답 내용이 유효한 JSON 형식이 아닐 수 있습니다.")
			print(f"수신된 Content-Type: {response.headers.get('Content-Type')}")


	except requests.exceptions.HTTPError as http_err:
		print(f"HTTP 오류 발생: {http_err}")
		print(f"응답 내용: {response.text}")
	except requests.exceptions.ConnectionError as conn_err:
		print(f"연결 오류 발생: {conn_err}")
	except requests.exceptions.Timeout as timeout_err:
		print(f"요청 시간 초과: {timeout_err}")
	except requests.exceptions.RequestException as req_err:
		print(f"기타 요청 오류 발생: {req_err}")
	except Exception as e:
		print(f"예상치 못한 오류 발생: {e}")


def parseKRX2(target_date):
	if os.path.exists(f"CatData2/{target_date}.csv"):
		return

	form_data = {
		'bld': 'dbms/MDC/STAT/standard/MDCSTAT03901',
		'locale': 'ko_KR',
		'mktId': 'KSQ',
		'segTpCd': 'ALL',
		'trdDd': target_date,
		'money': '1',
		'csvxls_isNo': 'false'
	}

	try:
		response = requests.post(url, headers=headers, data=form_data)
		response.raise_for_status() # HTTP 오류가 발생하면 예외 발생

		# 응답 본문을 텍스트로 가져와서 JSON으로 파싱 시도
		response_text = response.text

		try:
			data = json.loads(response_text)
			if "block1" in data and data["block1"]:
				pd.DataFrame(data["block1"]).to_csv(f"CatData2/{target_date}.csv", index=False, encoding="utf-8-sig")
				print(f"Done: {target_date}")
			else:
				print(f"{target_date}: block1이 비어있거나 응답 데이터에 없습니다.")

		except json.JSONDecodeError as json_err:
			print(f"\nJSON 파싱 오류 발생: {json_err}")
			print("응답 내용이 유효한 JSON 형식이 아닐 수 있습니다.")
			print(f"수신된 Content-Type: {response.headers.get('Content-Type')}")


	except requests.exceptions.HTTPError as http_err:
		print(f"HTTP 오류 발생: {http_err}")
		print(f"응답 내용: {response.text}")
	except requests.exceptions.ConnectionError as conn_err:
		print(f"연결 오류 발생: {conn_err}")
	except requests.exceptions.Timeout as timeout_err:
		print(f"요청 시간 초과: {timeout_err}")
	except requests.exceptions.RequestException as req_err:
		print(f"기타 요청 오류 발생: {req_err}")
	except Exception as e:
		print(f"예상치 못한 오류 발생: {e}")

if not os.path.exists("CatData"):
	os.mkdir("CatData")

begin = datetime(2010, 1, 4)
today = datetime.now()

while begin <= today:
	parseKRX(begin.strftime("%Y%m%d"))
	begin += timedelta(days=1)

if not os.path.exists("CatData2"):
	os.mkdir("CatData2")

begin = datetime(2010, 1, 4)
today = datetime.now()

while begin <= today:
	parseKRX2(begin.strftime("%Y%m%d"))
	begin += timedelta(days=1)