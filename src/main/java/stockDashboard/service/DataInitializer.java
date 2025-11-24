package stockDashboard.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * 애플리케이션 시작 시 초기 데이터를 설정하는 클래스입니다.
 */
@Slf4j
@Component
public class DataInitializer implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;

    @Autowired
    public DataInitializer(@Qualifier("authJdbcTemplate") JdbcTemplate jdbcTemplate, PasswordEncoder passwordEncoder) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 애플리케이션이 시작될 때 실행됩니다.
     * 기본 관리자 계정('admin')이 없는 경우, 초기 비밀번호로 생성합니다.
     * @param args 애플리케이션 실행 시 전달되는 인자
     * @throws Exception 실행 중 발생할 수 있는 예외
     */
    @Override
    public void run(String... args) throws Exception {
        String username = "admin";
        String checkUserSql = "SELECT COUNT(*) FROM users WHERE username = ?";
        
        Integer userCount = jdbcTemplate.queryForObject(checkUserSql, new Object[]{username}, Integer.class);

        if (userCount == null || userCount == 0) {
            log.info("기본 관리자 계정 '{}'가 존재하지 않습니다. 새로 생성합니다.", username);
            
            String password = "1234";
            String encodedPassword = passwordEncoder.encode(password);
            String nickname = "Administrator";

            String insertUserSql = "INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)";
            
            jdbcTemplate.update(insertUserSql, username, encodedPassword, nickname);
            
            log.info("기본 관리자 계정 '{}' 생성이 완료되었습니다.", username);
        } else {
            log.info("기본 관리자 계정 '{}'가 이미 존재합니다. 생성을 건너뜁니다.", username);
        }
    }
}
