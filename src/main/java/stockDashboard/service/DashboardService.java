package stockDashboard.service;

import java.time.LocalDate;
import java.util.List;
import stockDashboard.dto.MarketDataDto;
import stockDashboard.repository.KrxRepository;

import org.springframework.stereotype.Service; 
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@Service
public class DashboardService {
	private final KrxRepository krxRepository;

    /**
     * 날짜 파라미터의 존재 여부에 따라 다른 시장 데이터를 조회합니다.
     *
     * @param date 조회할 특정 날짜 (nullable). null일 경우 실시간 데이터를 조회합니다.
     * @return MarketDataDto 리스트
     */
    public List<MarketDataDto> getMarketData(LocalDate date) {
        if (date != null) {
            // 날짜가 지정된 경우, 해당 날짜의 장 마감 데이터 조회
            return krxRepository.getClosedMarketDataByDate(date);
        } else {
            // 날짜가 지정되지 않은 경우, 현재 시점의 실시간 데이터 조회
            return krxRepository.getLiveMarketData();
        }
    }
}