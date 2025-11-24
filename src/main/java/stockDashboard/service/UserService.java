package stockDashboard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.UserDetailsManager;
import org.springframework.stereotype.Service;
import java.util.Map;

import stockDashboard.repository.WidgetRepository;

/**
 * 사용자 관련 비즈니스 로직을 처리하는 서비스입니다.
 * 신규 사용자 등록 및 초기 데이터 설정을 담당합니다.
 */
@Service
public class UserService {

    private final UserDetailsManager userDetailsManager;
    private final PasswordEncoder passwordEncoder;
    private final WidgetRepository widgetRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper; // Jackson ObjectMapper 주입

    /**
     * UserService 생성자입니다.
     * 사용자 관리, 비밀번호 인코딩, 위젯 저장소, DB 접근 및 JSON 처리를 위한 의존성을 주입받습니다.
     * @param userDetailsManager Spring Security의 사용자 관리 매니저
     * @param passwordEncoder 비밀번호 암호화 인코더
     * @param widgetRepository 위젯 데이터 저장을 위한 저장소
     * @param jdbcTemplate 인증 DB에 접근하기 위한 JdbcTemplate
     * @param objectMapper Java 객체와 JSON 간의 변환을 위한 ObjectMapper
     */
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
    
    /**
     * 새로운 사용자를 시스템에 등록합니다.
     * 사용자 생성 후, 해당 사용자를 위한 기본 대시보드 위젯을 함께 생성합니다.
     * @param username 신규 사용자 이름
     * @param password 신규 사용자 비밀번호
     * @throws IllegalArgumentException 이미 존재하는 사용자 이름일 경우 발생
     * @throws IllegalStateException 사용자 생성 후 DB에서 ID를 찾지 못했을 경우 발생
     */
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

    /**
     * 신규 사용자를 위해 기본 대시보드 위젯들을 생성합니다.
     * '통합 시장 현황' 트리맵과 '등락률 Top & Bottom' 순위 테이블을 기본 위젯으로 추가합니다.
     * @param userId 위젯을 할당할 사용자의 ID
     * @throws RuntimeException 위젯 설정 객체를 JSON 문자열로 변환하는 데 실패할 경우 발생
     */
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
