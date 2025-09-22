package stockDashboard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.UserDetailsManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;

import lombok.RequiredArgsConstructor;
import stockDashboard.repository.WidgetRepository;

@Service
public class UserService {

    private final UserDetailsManager userDetailsManager;
    private final PasswordEncoder passwordEncoder;
    private final WidgetRepository widgetRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper; // Jackson ObjectMapper 주입

    public UserService(UserDetailsManager userDetailsManager, 
                     PasswordEncoder passwordEncoder, 
                     WidgetRepository widgetRepository, 
                     @Qualifier("authJdbcTemplate") JdbcTemplate jdbcTemplate, 
                     ObjectMapper objectMapper) { // 생성자에 objectMapper 추가
        this.userDetailsManager = userDetailsManager;
        this.passwordEncoder = passwordEncoder;
        this.widgetRepository = widgetRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper; // 주입받은 objectMapper 할당
    }
    
    public void registerNewUser(String username, String password) {
        if (userDetailsManager.userExists(username)) {
            throw new IllegalArgumentException("이미 존재하는 사용자 이름입니다: " + username);
        }

        // 1. 사용자 생성 (JdbcTemplate 사용)
        String encodedPassword = passwordEncoder.encode(password);
        jdbcTemplate.update("INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)", 
                          username, encodedPassword, username); // nickname을 username과 동일하게 설정

        // 2. 생성된 사용자의 ID 조회
        Long newUserId = jdbcTemplate.queryForObject("SELECT user_id FROM users WHERE username = ?", Long.class, username);
        if (newUserId == null) {
            throw new IllegalStateException("사용자 생성 후 ID를 찾을 수 없습니다.");
        }

        // 3. 기본 위젯 할당
        addDefaultWidgetsForUser(newUserId);
    }

    private void addDefaultWidgetsForUser(long userId) {
        try {
            // 통합 시장 트리맵
            Map<String, Object> treemapLayout = Map.of(
                "lg", Map.of("x", 0, "y", 0, "w", 2, "h", 8),
                "md", Map.of("x", 0, "y", 0, "w", 2, "h", 8),
                "sm", Map.of("x", 0, "y", 0, "w", 2, "h", 6)
            );
            Map<String, String> treemapSettings = Map.of("marketType", "ALL");
            widgetRepository.insertWidget(userId, "통합 시장 현황", "TreemapChart", 
                objectMapper.writeValueAsString(treemapLayout), 
                objectMapper.writeValueAsString(treemapSettings));

            // Top & Bottom 순위 테이블
            Map<String, Object> rankTableLayout = Map.of(
                "lg", Map.of("x", 2, "y", 0, "w", 2, "h", 8),
                "md", Map.of("x", 0, "y", 8, "w", 2, "h", 8),
                "sm", Map.of("x", 0, "y", 6, "w", 2, "h", 8)
            );
            Map<String, Object> rankTableSettings = Map.of(
                "mode", "top-and-bottom",
                "visibleColumns", new String[]{"currentPrice", "changeRate"}
            );
            widgetRepository.insertWidget(userId, "등락률 Top & Bottom", "RankTable", 
                objectMapper.writeValueAsString(rankTableLayout), 
                objectMapper.writeValueAsString(rankTableSettings));

        } catch (Exception e) {
            // JSON 변환 실패 시 런타임 예외 발생
            throw new RuntimeException("기본 위젯 생성 중 JSON 직렬화에 실패했습니다.", e);
        }
    }
}
