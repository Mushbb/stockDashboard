package stockDashboard.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;

import lombok.RequiredArgsConstructor;
import stockDashboard.repository.WidgetRepository.WidgetDto;
import stockDashboard.service.WidgetService;

@RestController
@RequiredArgsConstructor
public class WidgetController {

    private final WidgetService widgetService;

    // 임시 사용자 ID 조회용 클래스 (실제로는 UserDetails에서 직접 ID를 가져와야 함)
    // TODO: UserDetails 구현을 커스터마이징하여 DB의 user_id를 직접 포함하도록 수정해야 합니다.
    private long getUserIdFromUserDetails(UserDetails userDetails) {
        // 현재는 username이 'admin'이면 1L을 반환하는 임시 로직
        if ("admin".equals(userDetails.getUsername())) {
            return 1L;
        }
        // 실제로는 DB 조회 등을 통해 user_id를 찾아야 합니다.
        throw new UnsupportedOperationException("Cannot get user ID for: " + userDetails.getUsername());
    }

    /**
     * 특정 위젯의 레이아웃 정보를 업데이트하는 API 엔드포인트입니다.
     *
     * @param widgetId    업데이트할 위젯의 ID
     * @param layoutInfo  요청 본문에 포함된 새로운 레이아웃 정보 (JSON 문자열)
     * @param userDetails Spring Security가 제공하는 인증된 사용자 정보
     * @return 성공 또는 실패 응답
     */
    @PutMapping("/api/widgets/{widgetId}/layout")
    public ResponseEntity<Void> updateLayout(
            @PathVariable("widgetId") long widgetId, // 이름을 명시적으로 지정
            @RequestBody String layoutInfo,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        // TODO: 임시 로직을 실제 사용자 ID 조회 로직으로 교체해야 함
        long userId = getUserIdFromUserDetails(userDetails);

        try {
            widgetService.updateWidgetLayout(userId, widgetId, layoutInfo);
            return ResponseEntity.ok().build(); // 성공 (200 OK)
        } catch (Exception e) {
            // TODO: 좀 더 구체적인 예외 처리 필요
            return ResponseEntity.internalServerError().build(); // 실패 (500 Internal Server Error)
        }
    }

    /**
     * 현재 인증된 사용자의 모든 위젯 정보를 조회하는 API 엔드포인트입니다.
     */
    @GetMapping("/api/widgets")
    public ResponseEntity<List<WidgetDto>> getUserWidgets(@AuthenticationPrincipal UserDetails userDetails) {
        long userId = getUserIdFromUserDetails(userDetails);
        try {
            List<WidgetDto> widgets = widgetService.getUserWidgets(userId);
            return ResponseEntity.ok(widgets);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 특정 위젯의 설정을 업데이트하는 API 엔드포인트입니다.
     */
    @PutMapping("/api/widgets/{widgetId}/settings")
    public ResponseEntity<Void> updateSettings(
            @PathVariable("widgetId") long widgetId,
            @RequestBody String widgetSettings,
            @AuthenticationPrincipal UserDetails userDetails) {
        
        long userId = getUserIdFromUserDetails(userDetails);
        try {
            widgetService.updateWidgetSettings(userId, widgetId, widgetSettings);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
