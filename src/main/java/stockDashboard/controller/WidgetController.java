package stockDashboard.controller;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import stockDashboard.repository.WidgetRepository.WidgetDto;
import stockDashboard.service.WidgetService;

/**
 * 대시보드 위젯 관련 API 요청을 처리하는 컨트롤러입니다.
 * 사용자의 위젯 추가, 조회, 수정, 삭제(CRUD) 기능을 담당합니다.
 */
@RestController
@RequestMapping("/api/widgets")
public class WidgetController {

    private final WidgetService widgetService;
    private final JdbcTemplate jdbcTemplate; // authJdbcTemplate 주입

    /**
     * WidgetController 생성자입니다.
     * WidgetService와 인증용 JdbcTemplate을 주입받습니다.
     * @param widgetService 위젯 관련 비즈니스 로직을 처리하는 서비스
     * @param jdbcTemplate 'authDataSource'에 연결된 인증용 JdbcTemplate
     */
    public WidgetController(WidgetService widgetService, @Qualifier("authJdbcTemplate") JdbcTemplate jdbcTemplate) {
        this.widgetService = widgetService;
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Spring Security의 UserDetails 객체에서 사용자 ID를 조회합니다.
     * @param userDetails 현재 인증된 사용자의 상세 정보
     * @return 데이터베이스의 사용자 ID (long)
     * @throws IllegalStateException 사용자를 찾을 수 없을 때 발생하는 예외
     */
    private long getUserIdFromUserDetails(UserDetails userDetails) {
        String username = userDetails.getUsername();
        Long userId = jdbcTemplate.queryForObject("SELECT user_id FROM users WHERE username = ?", Long.class, username);
        if (userId == null) {
            throw new IllegalStateException("Cannot find user ID for: " + username);
        }
        return userId;
    }

    /**
     * 위젯 생성 요청 시 사용될 데이터를 담는 레코드 클래스입니다.
     * @param widgetName 위젯의 이름
     * @param widgetType 위젯의 종류
     * @param layoutInfo 위젯의 레이아웃 정보 (JSON 문자열)
     * @param widgetSettings 위젯의 설정 정보 (JSON 문자열)
     */
    private record WidgetCreationRequest(String widgetName, String widgetType, String layoutInfo, String widgetSettings) {}

    /**
     * 새로운 위젯을 추가합니다.
     * @param request 위젯 생성에 필요한 정보를 담은 요청 바디
     * @param userDetails 현재 인증된 사용자 정보
     * @return 성공 시 200 OK
     */
    @PostMapping
    public ResponseEntity<Void> addWidget(@RequestBody WidgetCreationRequest request, @AuthenticationPrincipal UserDetails userDetails) {
        long userId = getUserIdFromUserDetails(userDetails);
        try {
            widgetService.addWidget(userId, request.widgetName(), request.widgetType(), request.layoutInfo(), request.widgetSettings());
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 현재 사용자의 모든 위젯 목록을 조회합니다.
     * @param userDetails 현재 인증된 사용자 정보
     * @return 위젯 정보(WidgetDto) 리스트를 포함하는 ResponseEntity
     */
    @GetMapping
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
     * 특정 위젯의 레이아웃 정보를 수정합니다.
     * @param widgetId 수정할 위젯의 ID
     * @param layoutInfo 새로운 레이아웃 정보 (JSON 문자열)
     * @param userDetails 현재 인증된 사용자 정보
     * @return 성공 시 200 OK
     */
    @PutMapping("/{widgetId}/layout")
    public ResponseEntity<Void> updateLayout(@PathVariable("widgetId") long widgetId, @RequestBody String layoutInfo, @AuthenticationPrincipal UserDetails userDetails) {
        long userId = getUserIdFromUserDetails(userDetails);
        try {
            widgetService.updateWidgetLayout(userId, widgetId, layoutInfo);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 특정 위젯의 설정을 수정합니다.
     * @param widgetId 수정할 위젯의 ID
     * @param widgetSettings 새로운 설정 정보 (JSON 문자열)
     * @param userDetails 현재 인증된 사용자 정보
     * @return 성공 시 200 OK
     */
    @PutMapping("/{widgetId}/settings")
    public ResponseEntity<Void> updateSettings(@PathVariable("widgetId") long widgetId, @RequestBody String widgetSettings, @AuthenticationPrincipal UserDetails userDetails) {
        long userId = getUserIdFromUserDetails(userDetails);
        try {
            widgetService.updateWidgetSettings(userId, widgetId, widgetSettings);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 특정 위젯의 이름을 수정합니다.
     * @param widgetId 수정할 위젯의 ID
     * @param widgetName 새로운 위젯 이름
     * @param userDetails 현재 인증된 사용자 정보
     * @return 성공 시 200 OK
     */
    @PutMapping("/{widgetId}/name")
    public ResponseEntity<Void> updateName(@PathVariable("widgetId") long widgetId, @RequestBody String widgetName, @AuthenticationPrincipal UserDetails userDetails) {
        long userId = getUserIdFromUserDetails(userDetails);
        try {
            widgetService.updateWidgetName(userId, widgetId, widgetName);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 특정 위젯을 삭제합니다.
     * @param widgetId 삭제할 위젯의 ID
     * @param userDetails 현재 인증된 사용자 정보
     * @return 성공 시 200 OK
     */
    @DeleteMapping("/{widgetId}")
    public ResponseEntity<Void> deleteWidget(@PathVariable("widgetId") long widgetId, @AuthenticationPrincipal UserDetails userDetails) {
        long userId = getUserIdFromUserDetails(userDetails);
        try {
            widgetService.deleteWidget(userId, widgetId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
