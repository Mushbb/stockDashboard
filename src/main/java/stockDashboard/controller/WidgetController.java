package stockDashboard.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import lombok.RequiredArgsConstructor;
import stockDashboard.repository.WidgetRepository.WidgetDto;
import stockDashboard.service.WidgetService;

@RestController
@RequestMapping("/api/widgets") // 기본 경로 설정
@RequiredArgsConstructor
public class WidgetController {

    private final WidgetService widgetService;

    // 임시 사용자 ID 조회용 (변경 없음)
    private long getUserIdFromUserDetails(UserDetails userDetails) {
        if ("admin".equals(userDetails.getUsername())) return 1L;
        throw new UnsupportedOperationException("Cannot get user ID for: " + userDetails.getUsername());
    }

    // 위젯 생성 요청을 위한 DTO
    private record WidgetCreationRequest(String widgetName, String widgetType, String layoutInfo, String widgetSettings) {}

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