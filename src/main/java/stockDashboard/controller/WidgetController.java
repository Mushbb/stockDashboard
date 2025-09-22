package stockDashboard.controller;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import lombok.RequiredArgsConstructor;
import stockDashboard.repository.WidgetRepository.WidgetDto;
import stockDashboard.service.WidgetService;

@RestController
@RequestMapping("/api/widgets")
public class WidgetController {

    private final WidgetService widgetService;
    private final JdbcTemplate jdbcTemplate; // authJdbcTemplate 주입

    public WidgetController(WidgetService widgetService, @Qualifier("authJdbcTemplate") JdbcTemplate jdbcTemplate) {
        this.widgetService = widgetService;
        this.jdbcTemplate = jdbcTemplate;
    }

    private long getUserIdFromUserDetails(UserDetails userDetails) {
        String username = userDetails.getUsername();
        Long userId = jdbcTemplate.queryForObject("SELECT user_id FROM users WHERE username = ?", Long.class, username);
        if (userId == null) {
            throw new IllegalStateException("Cannot find user ID for: " + username);
        }
        return userId;
    }

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
