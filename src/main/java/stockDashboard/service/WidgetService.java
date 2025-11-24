package stockDashboard.service;

import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;
import stockDashboard.repository.WidgetRepository;
import stockDashboard.repository.WidgetRepository.WidgetDto;

import java.util.List;

/**
 * 대시보드 위젯 관련 비즈니스 로직을 처리하는 서비스입니다.
 * 위젯의 생성, 조회, 수정, 삭제(CRUD) 요청을 WidgetRepository에 위임합니다.
 */
@Service
@RequiredArgsConstructor
public class WidgetService {

    private final WidgetRepository widgetRepository;

    /**
     * 특정 위젯의 레이아웃 정보를 업데이트합니다.
     * @param userId 사용자 ID
     * @param widgetId 위젯 ID
     * @param layoutInfo 새로운 레이아웃 정보 (JSON 문자열)
     */
    public void updateWidgetLayout(long userId, long widgetId, String layoutInfo) {
        widgetRepository.updateLayoutInfo(userId, widgetId, layoutInfo);
    }

    /**
     * 특정 위젯의 설정을 업데이트합니다.
     * @param userId 사용자 ID
     * @param widgetId 위젯 ID
     * @param widgetSettings 새로운 설정 정보 (JSON 문자열)
     */
    public void updateWidgetSettings(long userId, long widgetId, String widgetSettings) {
        widgetRepository.updateWidgetSettings(userId, widgetId, widgetSettings);
    }

    /**
     * 특정 위젯의 이름을 업데이트합니다.
     * @param userId 사용자 ID
     * @param widgetId 위젯 ID
     * @param widgetName 새로운 위젯 이름
     */
    public void updateWidgetName(long userId, long widgetId, String widgetName) {
        widgetRepository.updateWidgetName(userId, widgetId, widgetName);
    }

    /**
     * 특정 위젯을 삭제합니다.
     * @param userId 사용자 ID
     * @param widgetId 삭제할 위젯 ID
     */
    public void deleteWidget(long userId, long widgetId) {
        widgetRepository.deleteWidget(userId, widgetId);
    }

    /**
     * 새로운 위젯을 추가합니다.
     * @param userId 사용자 ID
     * @param widgetName 위젯 이름
     * @param widgetType 위젯 종류
     * @param layoutInfo 레이아웃 정보 (JSON 문자열)
     * @param widgetSettings 설정 정보 (JSON 문자열)
     * @return DB에 삽입된 행의 수
     */
    public int addWidget(long userId, String widgetName, String widgetType, String layoutInfo, String widgetSettings) {
        return widgetRepository.insertWidget(userId, widgetName, widgetType, layoutInfo, widgetSettings);
    }

    /**
     * 특정 사용자의 모든 위젯 정보를 조회합니다.
     * @param userId 조회할 사용자 ID
     * @return 해당 사용자의 모든 위젯 DTO 리스트
     */
    public List<WidgetDto> getUserWidgets(long userId) {
        return widgetRepository.findAllByUserId(userId);
    }
}