package stockDashboard.config;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.JdbcUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import static org.springframework.security.config.Customizer.withDefaults;

/**
 * Spring Security 설정을 위한 구성 클래스입니다.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * HTTP 보안 설정을 구성합니다.
     * @param http HttpSecurity 객체
     * @return SecurityFilterChain 객체
     * @throws Exception 설정 중 발생할 수 있는 예외
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // REST API이므로 CSRF 보호를 비활성화합니다.
            .csrf(csrf -> csrf.disable())
            // 모든 요청은 인증되어야 함을 명시합니다.
            .authorizeHttpRequests(authorize -> authorize
                .anyRequest().authenticated()
            )
            // HTTP Basic 인증을 사용합니다.
            .httpBasic(withDefaults());
        return http.build();
    }

    /**
     * 인증용 데이터 소스를 사용하여 사용자 정보를 관리하는 UserDetailsService를 설정합니다.
     * @param dataSource 인증용 데이터 소스 (authDataSource)
     * @return JdbcUserDetailsManager 객체
     */
    @Bean
    public UserDetailsService userDetailsService(@Qualifier("authDataSource") DataSource dataSource) {
        JdbcUserDetailsManager users = new JdbcUserDetailsManager(dataSource);
        // 커스텀 테이블 스키마에 맞게 사용자 조회 쿼리를 설정합니다.
        users.setUsersByUsernameQuery(
            "SELECT username, password_hash, 1 as enabled FROM users WHERE username = ?"
        );
        // 커스텀 테이블 스키마에 맞게 권한 조회 쿼리를 설정합니다. (모든 유저에게 'ROLE_USER' 부여)
        users.setAuthoritiesByUsernameQuery(
            "SELECT username, 'ROLE_USER' as authority FROM users WHERE username = ?"
        );
        return users;
    }

    /**
     * 비밀번호 암호화를 위한 PasswordEncoder를 설정합니다.
     * @return BCryptPasswordEncoder 객체
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
