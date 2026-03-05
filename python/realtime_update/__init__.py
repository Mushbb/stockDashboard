import pandas as pd
import pyodbc
import requests
import aiohttp
import asyncio
import ast
import re
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import azure.functions as func
import logging
import time
import math
import os
from dotenv import load_dotenv


# --- 1. 설정 ---
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}
NAVER_MARKET_SUM_URL = "https://finance.naver.com/sise/sise_market_sum.naver"
NAVER_OHLCV_URL = "https://api.finance.naver.com/siseJson.naver"
OHLCV_CONCURRENCY = 50  # 동시 요청 수


# --- 2. 데이터 정제 함수 ---
def clean_and_convert(value, target_type):
    if pd.isna(value) or value == '-' or value == '':
        return None
    try:
        cleaned_value = str(value).replace(',', '').strip()
        return target_type(float(cleaned_value)) if target_type == int else target_type(cleaned_value)
    except (ValueError, TypeError):
        return None


def s(v):
    """nan/None/numpy 타입을 Python 네이티브로 안전 변환"""
    if v is None:
        return None
    try:
        if isinstance(v, float) and math.isnan(v):
            return None
    except Exception:
        pass
    # numpy/pandas 타입을 Python 네이티브로 변환
    type_name = type(v).__module__
    if type_name == 'numpy' or type_name.startswith('numpy'):
        import numpy as np
        if isinstance(v, (np.integer,)):
            return int(v)
        if isinstance(v, (np.floating,)):
            return None if np.isnan(v) else float(v)
        if isinstance(v, (np.bool_,)):
            return bool(v)
    # pandas NA
    try:
        import pandas as pd
        if pd.isna(v):
            return None
    except Exception:
        pass
    return v


# --- 3. 네이버 시가총액 페이지 크롤링 ---
def fetch_naver_market_sum(sosok: int) -> pd.DataFrame:
    market_name = "KOSPI" if sosok == 0 else "KOSDAQ"
    all_rows = []

    res = requests.get(NAVER_MARKET_SUM_URL, params={'sosok': sosok, 'page': 1}, headers=HEADERS, timeout=10)
    res.encoding = 'euc-kr'
    soup = BeautifulSoup(res.text, 'html.parser')

    pager = soup.select_one('td.pgRR > a')
    last_page = int(pager['href'].split('page=')[-1]) if pager else 1
    logging.info(f"{market_name}: 총 {last_page}페이지 수집 시작...")

    for page in range(1, last_page + 1):
        try:
            res = requests.get(NAVER_MARKET_SUM_URL, params={'sosok': sosok, 'page': page}, headers=HEADERS, timeout=10)
            res.encoding = 'euc-kr'
            soup = BeautifulSoup(res.text, 'html.parser')

            rows = soup.select('table.type_2 > tbody > tr')
            for row in rows:
                cols = row.select('td')
                if len(cols) < 10:
                    continue
                link = row.select_one('a[href*="code="]')
                if not link:
                    continue
                code = link['href'].split('code=')[-1].strip()
                name = link.text.strip()

                fluc_raw = cols[3].text.strip()
                fluc_lines = [l.strip() for l in fluc_raw.splitlines() if l.strip()]
                fluc_tp = fluc_lines[0] if len(fluc_lines) > 0 else ''
                fluc_prc = fluc_lines[1] if len(fluc_lines) > 1 else ''

                fluc_rt_raw = cols[4].text.strip().replace('%', '').replace('+', '').strip()

                mktcap_raw = cols[7].text.strip() if len(cols) > 7 else ''
                mktcap = None
                if mktcap_raw and mktcap_raw != '-':
                    try:
                        mktcap = int(mktcap_raw.replace(',', '').strip()) * 100000000
                    except ValueError:
                        pass

                list_shrs_raw = cols[9].text.strip() if len(cols) > 9 else ''

                all_rows.append({
                    'ISU_SRT_CD': code,
                    'ISU_ABBRV': name,
                    'TDD_CLSPRC': cols[2].text.strip(),
                    'FLUC_TP_CD': fluc_tp,
                    'CMPPREVDD_PRC': fluc_prc,
                    'FLUC_RT': fluc_rt_raw,
                    'ACC_TRDVOL': cols[6].text.strip(),
                    'MKTCAP': mktcap,
                    'LIST_SHRS': list_shrs_raw,
                })

            time.sleep(0.1)

        except Exception as e:
            logging.warning(f"{market_name} {page}페이지 수집 실패: {e}")
            continue

    logging.info(f"{market_name}: {len(all_rows)}개 종목 수집 완료")
    return pd.DataFrame(all_rows)


def fetch_current_naver_data():
    try:
        df_kospi = fetch_naver_market_sum(sosok=0)
        df_kosdaq = fetch_naver_market_sum(sosok=1)
        df = pd.concat([df_kospi, df_kosdaq], ignore_index=True)

        kst_now = datetime.utcnow() + timedelta(hours=9)
        collected_at_str = kst_now.strftime("%Y.%m.%d %p %I:%M:%S")

        if not df.empty:
            logging.info(f"전체 {len(df)}개 종목 수집 완료")
            return df, collected_at_str

        logging.warning("수집된 데이터가 없습니다.")
        return None
    except Exception as e:
        logging.error(f"네이버 크롤링 실패: {e}")
        return None


# --- 4. 네이버 개별 OHLCV 비동기 수집 ---
async def fetch_ohlcv_one(session, code: str, date_str: str, semaphore: asyncio.Semaphore):
    """종목 하나의 당일 시가/고가/저가 비동기 수집"""
    url = NAVER_OHLCV_URL
    params = {
        'symbol': code,
        'requestType': '1',
        'startTime': date_str,
        'endTime': date_str,
        'timeframe': 'day'
    }
    async with semaphore:
        try:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                raw = await resp.text()
                # 줄별로 파싱 - 데이터 행만 추출 (날짜로 시작하는 행)
                for line in raw.splitlines():
                    line = line.strip().strip(',')
                    if line.startswith('["') or line.startswith("['"): 
                        # ["20260305", 195000, 199700, 190100, 192700, ...]
                        row = ast.literal_eval(line)
                        opn  = int(row[1]) if row[1] is not None else None
                        high = int(row[2]) if row[2] is not None else None
                        low  = int(row[3]) if row[3] is not None else None
                        return code, opn, high, low
                return code, None, None, None
        except Exception:
            return code, None, None, None


async def fetch_ohlcv_all(codes: list, date_str: str) -> dict:
    """전종목 비동기 OHLCV 수집 → {code: (open, high, low)}"""
    semaphore = asyncio.Semaphore(OHLCV_CONCURRENCY)
    results = {}

    async with aiohttp.ClientSession(headers=HEADERS) as session:
        tasks = [fetch_ohlcv_one(session, code, date_str, semaphore) for code in codes]
        total = len(tasks)
        done = 0
        for coro in asyncio.as_completed(tasks):
            code, opn, high, low = await coro
            results[code] = (opn, high, low)
            done += 1
            if done % 500 == 0:
                logging.info(f"OHLCV 수집 중... {done}/{total}")

    logging.info(f"OHLCV 수집 완료: {total}개")
    return results


def run_fetch_ohlcv(codes: list, date_str: str) -> dict:
    """동기 컨텍스트에서 비동기 OHLCV 수집 실행"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, fetch_ohlcv_all(codes, date_str))
                return future.result()
        else:
            return loop.run_until_complete(fetch_ohlcv_all(codes, date_str))
    except Exception:
        return asyncio.run(fetch_ohlcv_all(codes, date_str))


# --- 5. DB 저장 ---
def upsert_daily_metrics(conn, df, collected_at_str, ohlcv_map: dict):
    cursor = conn.cursor()

    kst_now = datetime.utcnow() + timedelta(hours=9)
    today_str = kst_now.strftime('%Y%m%d')

    fluc_map = {'상승': 1, '하락': 2, '보합': 3, '▲': 1, '▼': 2, '-': 3}

    converters = {
        'TDD_CLSPRC': int, 'CMPPREVDD_PRC': int,
        'ACC_TRDVOL': int, 'FLUC_RT': float, 'LIST_SHRS': int
    }
    for col, target_type in converters.items():
        if col in df.columns:
            df[col] = df[col].apply(lambda x: clean_and_convert(x, target_type))

    df = df.where(pd.notna(df), None)
    df['FLUC_TP_CD'] = df['FLUC_TP_CD'].apply(lambda x: fluc_map.get(str(x).strip(), None))

    insert_sql = """
        INSERT INTO daily_metrics (
            ISU_SRT_CD, metric_date, collected_at, data_time, TDD_CLSPRC, FLUC_TP_CD, CMPPREVDD_PRC, FLUC_RT,
            TDD_OPNPRC, TDD_HGPRC, TDD_LWPRC, ACC_TRDVOL, ACC_TRDVAL, MKTCAP, LIST_SHRS, SECT_TP_NM
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """

    collected_at_dt = datetime.strptime(collected_at_str, "%Y.%m.%d %p %I:%M:%S")
    estimated_data_time = collected_at_dt - timedelta(minutes=20)

    insert_data = []
    for _, row in df.iterrows():
        if not row.get('ISU_SRT_CD'):
            continue

        cursor.execute(
            "IF NOT EXISTS (SELECT 1 FROM nodes WHERE ISU_SRT_CD = ?) INSERT INTO nodes(ISU_SRT_CD, node_name, node_type, ISU_CD) VALUES (?, ?, ?, ?)",
            row['ISU_SRT_CD'], row['ISU_SRT_CD'], row.get('ISU_ABBRV', ''), 'Stock', row['ISU_SRT_CD']
        )

        # OHLCV 맵에서 시가/고가/저가 가져오기
        ohlcv = ohlcv_map.get(row['ISU_SRT_CD'], (None, None, None))
        opn, high, low = ohlcv

        insert_data.append((
            row.get('ISU_SRT_CD'), today_str, collected_at_dt, estimated_data_time,
            s(row.get('TDD_CLSPRC')), s(row.get('FLUC_TP_CD')), s(row.get('CMPPREVDD_PRC')), s(row.get('FLUC_RT')),
            opn, high, low,
            s(row.get('ACC_TRDVOL')),
            None,
            s(row.get('MKTCAP')), s(row.get('LIST_SHRS')),
            None
        ))

    success = 0
    for params in insert_data:
        try:
            cursor.execute(insert_sql, params)
            success += 1
        except Exception as e:
            logging.warning(f"INSERT 실패 [{params[0]}]: {e}")
    conn.commit()
    logging.info(f"{success}/{len(insert_data)}개 종목 DB 저장 완료")


# --- 6. 메인 로직 ---
def run_metrics_job():
    conn = None
    try:
        load_dotenv()
        connection_string = os.getenv("SQL_CONNECTION_STRING")
        if not connection_string:
            raise ValueError("SQL_CONNECTION_STRING not found.")

        kst_now = datetime.utcnow() + timedelta(hours=9)
        logging.info(f"수집 시작: {kst_now.strftime('%Y-%m-%d %H:%M:%S')} KST")

        # 1단계: 전종목 현재가/시가총액 수집
        result = fetch_current_naver_data()
        if result is None:
            logging.warning("데이터 수집 실패")
            return

        df, collected_at_str = result
        if df.empty:
            logging.warning("데이터프레임이 비어있습니다.")
            return

        # 2단계: 전종목 OHLCV 비동기 수집
        date_str = kst_now.strftime('%Y%m%d')
        codes = df['ISU_SRT_CD'].tolist()
        logging.info(f"OHLCV 비동기 수집 시작: {len(codes)}개 종목...")
        ohlcv_map = run_fetch_ohlcv(codes, date_str)

        # 3단계: DB 저장
        conn = pyodbc.connect(connection_string)
        upsert_daily_metrics(conn, df, collected_at_str, ohlcv_map)

    except Exception as e:
        logging.error(f"오류 발생: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()
        logging.info("작업 완료")


# --- 7. Azure Functions 진입점 ---
def main(mytimer: func.TimerRequest) -> None:
    if mytimer.past_due:
        logging.info('타이머 지연 실행')
    logging.info('실시간 수집 시작')
    run_metrics_job()
    logging.info('실시간 수집 완료')


# --- 8. 로컬 실행용 진입점 ---
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    logging.info("=== 로컬 실행 모드 ===")
    run_metrics_job()
