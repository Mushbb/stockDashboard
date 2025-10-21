import pyodbc
import os
from dotenv import load_dotenv
import pandas as pd
import datetime

def clean_and_convert_to_int(value):
	"""
	콤마와 '-'를 제거하고 정수로 변환하는 함수.
	NaN, 빈 문자열, '-'를 모두 None으로 처리
	"""
	try:
		if pd.isna(value) or value == '-':
			return None

		cleaned_value = str(value).replace(',', '').strip()

		return int(cleaned_value) if cleaned_value else None
	except (ValueError, TypeError):
		return None

def clean_and_convert_to_float(value):
	"""문자열에서 콤마를 제거하고 float으로 변환하는 함수"""
	try:
		if pd.isna(value) or value == '-':
			return None

		# 문자열로 변환하고 콤마 제거
		cleaned_value = str(value).replace(',', '').strip()

		return float(cleaned_value) if cleaned_value else None
	except (ValueError, TypeError):
		return None

converter = {
	'ISU_SRT_CD': str,
	'TDD_CLSPRC': clean_and_convert_to_int,
	'CMPPREVDD_PRC': clean_and_convert_to_int,
	'MKTCAP': clean_and_convert_to_int,
	'FLUC_RT': clean_and_convert_to_float,
	'FLUC_TP_CD': clean_and_convert_to_int,
	'TDD_OPNPRC': clean_and_convert_to_int,
	'TDD_HGPRC': clean_and_convert_to_int,
	'TDD_LWPRC': clean_and_convert_to_int,
	'ACC_TRDVOL': clean_and_convert_to_int,
	'ACC_TRDVAL': clean_and_convert_to_int,
	'LIST_SHRS': clean_and_convert_to_int,
	'SECT_TP_NM': str,
}

def CatData(pathdir):
	if not os.path.exists(pathdir):
		return
	filelist = os.listdir(pathdir)
	for filename in filelist:
		df = pd.read_csv(f"{pathdir}/{filename}", thousands=',', converters=converter)
		df = df.replace('-', pd.NA)

		try:
			for idx, row in df.iterrows():
				# find code in nodes table
				if not row['ISU_SRT_CD'] in stock:
					# if not add one
					addStock(row)
					stock.add(row['ISU_SRT_CD'])

				# add daily_metrics
				addDailyMectics(row, filename.split('.')[0])
		except pyodbc.Error as ex:
			print(f"Database error occurred while processing {filename}: {ex}")
			conn.rollback() 
			continue       

		conn.commit()	# commit for every file
		print(f"Done: {pathdir}/{filename}")

def getAllStock():
	cursor = conn.cursor()
	cursor.execute("SELECT ISU_SRT_CD FROM nodes WHERE node_type = 'Stock'")
	return [row[0] for row in cursor.fetchall()]

def findStockbyId(Code):
	cursor = conn.cursor()
	cursor.execute("SELECT * FROM nodes WHERE ISU_SRT_CD = ?", Code)
	return cursor.fetchone()

def addStock(row):
	conn.execute(
		"INSERT INTO nodes(ISU_SRT_CD, node_name, node_type, ISU_CD) VALUES (?, ?, ?, ?)",
		row['ISU_SRT_CD'], row['ISU_ABBRV'], 'Stock', row['ISU_CD'] )
	return

def addDailyMectics(row, date):
	conn.execute(
		"INSERT INTO dbo.daily_metrics (ISU_SRT_CD, metric_date, TDD_CLSPRC, FLUC_TP_CD, CMPPREVDD_PRC, FLUC_RT, " +
		"TDD_OPNPRC, TDD_HGPRC, TDD_LWPRC, ACC_TRDVOL, ACC_TRDVAL, MKTCAP, LIST_SHRS, SECT_TP_NM, collected_at) " +
		"VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		row['ISU_SRT_CD'], date, row['TDD_CLSPRC'], row['FLUC_TP_CD'], row['CMPPREVDD_PRC'], row['FLUC_RT'], row['TDD_OPNPRC'],
		row['TDD_HGPRC'], row['TDD_LWPRC'], row['ACC_TRDVOL'], row['ACC_TRDVAL'], row['MKTCAP'], row['LIST_SHRS'], row['SECT_TP_NM'],
		date+" 15:30:00" )

	return

def getDailyByDateId(Date, Id):
	cursor = conn.cursor()
	cursor.execute("SELECT * FROM daily_metrics WHERE metric_date = ? AND ISU_SRT_CD = ? ",
				Date, Id)
	return [row[0] for row in cursor.fetchall()]

load_dotenv()
conn = pyodbc.connect(os.getenv("SQL_CONNECTION_STRING"))

stock = getAllStock()		# cache
stock = set(stock) if stock else set()

CatData("NowData")
conn.close()