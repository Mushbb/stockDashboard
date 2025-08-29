---- 인덱싱
---- 1. daily_metrics 테이블: 날짜와 종목코드를 묶어서 인덱스 생성
--CREATE INDEX idx_daily_metrics_date_stock ON daily_metrics (metric_date, ISU_SRT_CD);

---- 2. history 테이블들: 종목코드와 날짜 범위를 묶어서 생성
--CREATE INDEX idx_sector_history_stock_dates ON sector_history (stock_id, start_date, end_date);
--CREATE INDEX idx_market_history_stock_dates ON market_history (stock_id, start_date, end_date);

---- (선택) 시가총액 정렬이 잦은 경우
--CREATE INDEX idx_daily_metrics_mktcap ON daily_metrics (MKTCAP DESC);

--- 장 중 지금
SELECT m.ISU_SRT_CD, n.node_name, m.MKTCAP, s.sector_name, h.market_type, m.metric_date
FROM daily_metrics m INNER JOIN nodes n ON m.ISU_SRT_CD = n.ISU_SRT_CD
	INNER JOIN sector_history s ON n.ISU_SRT_CD = s.stock_id
	INNER JOIN market_history h ON n.ISU_SRT_CD = h.stock_id
WHERE metric_date = ( SELECT MAX(metric_date) FROM daily_metrics )
	AND s.end_date IS NULL
	AND h.end_date IS NULL
ORDER BY m.MKTCAP DESC


--- 해당 날짜의 장 종료 후
-- 1. WITH 구문을 사용해 각 종목별로 최신 데이터에 순위를 매깁니다.
WITH RankedMetrics AS ( 
	SELECT m.*, ROW_NUMBER() OVER(PARTITION BY m.ISU_SRT_CD ORDER BY m.collected_at DESC) as rn
    FROM daily_metrics m
    WHERE m.metric_date = '2025-08-26' -- 인덱스를 활용해 빠르게 데이터 범위를 좁힘
)
-- 2. 위에서 1위(rn = 1)를 차지한 데이터만 골라서 나머지 테이블과 JOIN합니다.
SELECT rm.ISU_SRT_CD, n.node_name, rm.MKTCAP, s.sector_name, h.market_type, rm.metric_date, rm.collected_at
FROM RankedMetrics rm
	INNER JOIN nodes n ON rm.ISU_SRT_CD = n.ISU_SRT_CD
	INNER JOIN sector_history s ON rm.ISU_SRT_CD = s.stock_id
	INNER JOIN market_history h ON rm.ISU_SRT_CD = h.stock_id
WHERE rm.rn = 1 -- 🥇 각 종목별로 가장 최신 데이터만 선택
    AND rm.metric_date BETWEEN s.start_date AND ISNULL(s.end_date, '9999-12-31')
    AND rm.metric_date BETWEEN h.start_date AND ISNULL(h.end_date, '9999-12-31')
ORDER BY rm.MKTCAP DESC;