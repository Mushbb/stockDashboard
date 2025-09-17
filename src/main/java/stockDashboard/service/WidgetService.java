package stockDashboard.service;

import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;
import stockDashboard.repository.WidgetRepository;
import stockDashboard.repository.WidgetRepository.WidgetDto;

import java.util.List;

@Service
@RequiredArgsConstructor
public class WidgetService {

    private final WidgetRepository widgetRepository;

    /**
     * 위젯의 레이아웃 정보를 업데이트합니다.
     */
    public void updateWidgetLayout(long userId, long widgetId, String layoutInfo) {
        widgetRepository.updateLayoutInfo(userId, widgetId, layoutInfo);
    }

    /**
     * 위젯의 설정을 업데이트합니다.
     */
    public void updateWidgetSettings(long userId, long widgetId, String widgetSettings) {
        widgetRepository.updateWidgetSettings(userId, widgetId, widgetSettings);
    }

    /**
     * 새로운 위젯을 추가합니다.
     */
    public int addWidget(long userId, String widgetName, String widgetType, String layoutInfo, String widgetSettings) {
        return widgetRepository.insertWidget(userId, widgetName, widgetType, layoutInfo, widgetSettings);
    }

    /**
     * 특정 사용자의 모든 위젯 정보를 조회합니다.
     */
    public List<WidgetDto> getUserWidgets(long userId) {
        return widgetRepository.findAllByUserId(userId);
    }
}