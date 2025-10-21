package stockDashboard.repository;

import stockDashboard.dto.MarketDataDto;
import stockDashboard.dto.PriceHistoryDto;
import stockDashboard.dto.StockSearchDto;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class KrxRepository {
	private final JdbcTemplate jdbcTemplate;

    public KrxRepository(@Qualifier("appJdbcTemplate") JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

	/**
	 * 특정 종목의 지정된 날짜 이후 시세 이력을 조회합니다.
	 * @param symbol 종목코드
	 * @param startDate 조회 시작 날짜
	 * @return 시세 이력 DTO 리스트
	 */
	public List<PriceHistoryDto> getPriceHistoryBySymbol(String symbol, LocalDate startDate) {
		String sql = """
				WITH RankedMetrics AS (
				    SELECT
				        *,
				        ROW_NUMBER() OVER(PARTITION BY metric_date ORDER BY collected_at DESC) as rn
				    FROM daily_metrics
				    WHERE ISU_SRT_CD = ? AND metric_date >= ? AND TDD_CLSPRC IS NOT NULL
				)
				SELECT 
				    metric_date, TDD_OPNPRC, TDD_HGPRC, TDD_LWPRC, TDD_CLSPRC, ACC_TRDVOL
				FROM RankedMetrics
				WHERE rn = 1
				ORDER BY metric_date ASC
				""";
		
		Object[] params = { symbol, startDate };
		List<Map<String, Object>> results = jdbcTemplate.queryForList(sql, params);

		return mapResultsToPriceHistoryDto(results);
	}
	
	/**
	 * 가장 최근 날짜의 장중 시장 데이터를 시가총액 순으로 조회합니다.
	 * @return 실시간 시장 데이터 DTO 리스트
	 */
	public List<MarketDataDto> getLiveMarketData() {
		String sql = """
				WITH RankedMetrics AS (
				    SELECT 
				        m.*,
				        ROW_NUMBER() OVER(PARTITION BY m.ISU_SRT_CD ORDER BY m.collected_at DESC) as rn
				    FROM 
				        daily_metrics m
				    WHERE 
				        m.metric_date = (SELECT MAX(metric_date) FROM daily_metrics)
				)
				SELECT 
				    rm.ISU_SRT_CD, n_hist.value AS node_name, s_hist.value AS sector_name, m_hist.value AS market_type,
				    rm.metric_date, rm.collected_at, rm.MKTCAP, rm.FLUC_RT, 
				    rm.TDD_CLSPRC, rm.TDD_OPNPRC, rm.TDD_HGPRC, rm.TDD_LWPRC, rm.ACC_TRDVOL, rm.ACC_TRDVAL
				FROM 
				    RankedMetrics rm
				LEFT JOIN 
				    stock_history n_hist ON rm.ISU_SRT_CD = n_hist.stock_id AND n_hist.history_type = 'NAME' AND n_hist.end_date IS NULL
				LEFT JOIN 
				    stock_history s_hist ON rm.ISU_SRT_CD = s_hist.stock_id AND s_hist.history_type = 'SECTOR' AND s_hist.end_date IS NULL
				LEFT JOIN 
				    stock_history m_hist ON rm.ISU_SRT_CD = m_hist.stock_id AND m_hist.history_type = 'MARKET' AND m_hist.end_date IS NULL
				WHERE 
				    rm.rn = 1
				ORDER BY 
				    rm.MKTCAP DESC
				""";

		List<Map<String, Object>> results = jdbcTemplate.queryForList(sql);
		return mapResultsToMarketDataDto(results);
	}

	/**
	 * 특정 날짜의 장 마감 후 시장 데이터를 시가총액 순으로 조회합니다.
	 */
	public List<MarketDataDto> getClosedMarketDataByDate(LocalDate date) {
		String sql = """
				WITH RankedMetrics AS (
					SELECT m.*, ROW_NUMBER() OVER(PARTITION BY m.ISU_SRT_CD ORDER BY m.collected_at DESC) as rn
					FROM daily_metrics m
					WHERE m.metric_date = ?
				)
				SELECT 
				    rm.ISU_SRT_CD, n_hist.value AS node_name, s_hist.value AS sector_name, m_hist.value AS market_type,
				    rm.metric_date, rm.collected_at, rm.MKTCAP, rm.FLUC_RT, 
				    rm.TDD_CLSPRC, rm.TDD_OPNPRC, rm.TDD_HGPRC, rm.TDD_LWPRC, rm.ACC_TRDVOL, rm.ACC_TRDVAL
				FROM RankedMetrics rm
					INNER JOIN stock_history n_hist ON rm.ISU_SRT_CD = n_hist.stock_id AND n_hist.history_type = 'NAME'
					INNER JOIN stock_history s_hist ON rm.ISU_SRT_CD = s_hist.stock_id AND s_hist.history_type = 'SECTOR'
					INNER JOIN stock_history m_hist ON rm.ISU_SRT_CD = m_hist.stock_id AND m_hist.history_type = 'MARKET'
				WHERE rm.rn = 1
					AND rm.metric_date BETWEEN n_hist.start_date AND ISNULL(n_hist.end_date, '9999-12-31')
					AND rm.metric_date BETWEEN s_hist.start_date AND ISNULL(s_hist.end_date, '9999-12-31')
					AND rm.metric_date BETWEEN m_hist.start_date AND ISNULL(m_hist.end_date, '9999-12-31')
				ORDER BY rm.MKTCAP DESC
				""";
		
		Object[] params = { date };
		List<Map<String, Object>> results = jdbcTemplate.queryForList(sql, params);

		return mapResultsToMarketDataDto(results);
	}

	private List<PriceHistoryDto> mapResultsToPriceHistoryDto(List<Map<String, Object>> results) {
		List<PriceHistoryDto> priceHistoryList = new ArrayList<>();
		for (Map<String, Object> row : results) {
			Long open = getLongValue(row, "TDD_OPNPRC");
			Long high = getLongValue(row, "TDD_HGPRC");
			Long low = getLongValue(row, "TDD_LWPRC");
			Long close = getLongValue(row, "TDD_CLSPRC");
			Long volume = getLongValue(row, "ACC_TRDVOL");

			priceHistoryList.add(new PriceHistoryDto(
				getLocalDateValue(row, "metric_date").toString(),
				open != null ? open : 0L,
				high != null ? high : 0L,
				low != null ? low : 0L,
				close != null ? close : 0L,
				volume != null ? volume : 0L
			));
		}
		return priceHistoryList;
	}

	private List<MarketDataDto> mapResultsToMarketDataDto(List<Map<String, Object>> results) {
		List<MarketDataDto> marketDataList = new ArrayList<>();

		for (Map<String, Object> row : results) {
			            marketDataList.add(new MarketDataDto(
			                    (String) row.get("ISU_SRT_CD"),
			                    (String) row.get("node_name"),
			                    getLongValue(row, "MKTCAP"),
			                    getDoubleValue(row, "FLUC_RT"),
			                    getLongValue(row, "TDD_CLSPRC"),
			                    getLongValue(row, "TDD_OPNPRC"),
			                    getLongValue(row, "TDD_HGPRC"),
			                    getLongValue(row, "TDD_LWPRC"),
			                    getLongValue(row, "ACC_TRDVOL"),
			                    getLongValue(row, "ACC_TRDVAL"),
			                    (String) row.get("sector_name"),
			                    (String) row.get("market_type"),
			                    getLocalDateValue(row, "metric_date"),
			                    getLocalDateTimeValue(row, "collected_at")
			            ));		}

		return marketDataList;
	}

    // --- Helper methods for safe type casting ---
    private Long getLongValue(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        return null;
    }

    private Double getDoubleValue(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        return null;
    }

    private LocalDate getLocalDateValue(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value instanceof Date) {
            return ((Date) value).toLocalDate();
        }
        return null;
    }

    private LocalDateTime getLocalDateTimeValue(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value instanceof Timestamp) {
            return ((Timestamp) value).toLocalDateTime();
        }
        return null;
    }

	/**
	 * 종목 코드로 현재 종목명을 조회합니다.
	 * @param symbol 종목코드
	 * @return 종목명
	 */
	public String getStockNameBySymbol(String symbol) {
		String sql = "SELECT value FROM stock_history WHERE stock_id = ? AND history_type = 'NAME' AND end_date IS NULL";
		try {
			return jdbcTemplate.queryForObject(sql, String.class, symbol);
		} catch (Exception e) {
			return null; // 종목명이 없는 경우
		}
	}

	/**
	 * 이름으로 주식 및 ETF를 검색합니다.
	 * @param query 검색어
	 * @return 검색된 종목 정보 DTO 리스트
	 */
    public List<StockSearchDto> searchStocksByName(String query) {
        String sql = """
                SELECT DISTINCT TOP 10
                    h.stock_id AS symbol,
                    h.value AS name
                FROM stock_history h
                INNER JOIN daily_metrics lm ON h.stock_id = lm.ISU_SRT_CD
                WHERE h.history_type = 'NAME' 
                	AND h.end_date IS NULL 
                	AND lm.metric_date = ( SELECT MAX(metric_date) FROM daily_metrics ) 
                	AND h.value LIKE ?
                """;
        
        Object[] params = { "%" + query + "%" };		return jdbcTemplate.query(sql, (rs, rowNum) -> new StockSearchDto(
			rs.getString("symbol"),
			rs.getString("name")
		), params);
	}
}