package stockDashboard.config;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.JdbcUserDetailsManager;
import org.springframework.security.provisioning.UserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

import jakarta.servlet.http.HttpServletResponse;

/**
 * 애플리케이션의 웹 보안 설정을 담당하는 구성 클래스입니다.
 * Spring Security를 사용하여 인증 및 인가 규칙을 정의합니다.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * HTTP 보안 필터 체인을 구성합니다.
     * CSRF 보호 비활성화, API 경로별 접근 제어, 폼 로그인 및 로그아웃 동작을 정의합니다.
     *
     * @param http HttpSecurity 객체
     * @return 구성된 SecurityFilterChain 객체
     * @throws Exception 설정 과정에서 발생할 수 있는 예외
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable()) // CSRF 보호 비활성화
            // 인증되지 않은 요청에 대한 처리 (리다이렉트 대신 401 응답)
            .exceptionHandling(exception -> exception
                .authenticationEntryPoint((req, res, ex) -> res.sendError(HttpServletResponse.SC_UNAUTHORIZED))
            )
            .authorizeHttpRequests(authorize -> authorize
                // 웹사이트 접속 및 정적 리소스(HTML, JS, CSS 등)는 누구나 접근 가능
                .requestMatchers("/", "/index.html", "/assets/**", "/*.js", "/*.css", "/*.ico", "/vite.svg").permitAll()
                // 회원가입 및 로그인 API는 누구나 접근 가능
                .requestMatchers("/api/users/register", "/api/login").permitAll()
                // 동적 데이터 조회 API는 누구나 접근 가능
                .requestMatchers(HttpMethod.POST, "/api/dashboard/dynamic-data").permitAll()
                // 차트 및 종목 검색 API는 누구나 접근 가능
                .requestMatchers(HttpMethod.GET, "/api/charts/krx/history", "/api/stocks/search").permitAll()
                // 그 외 모든 /api/** 요청은 인증 필요
                .requestMatchers("/api/**").authenticated()
                // 나머지 요청은 일단 허용 (필요에 따라 authenticated()로 변경 가능)
                .anyRequest().permitAll()
            )
            // 폼 기반 로그인 설정
            .formLogin(form -> form
                .loginProcessingUrl("/api/login") // 로그인 처리 URL
                .successHandler((req, res, auth) -> res.setStatus(HttpServletResponse.SC_OK)) // 성공 시 200 OK
                .failureHandler((req, res, ex) -> res.sendError(HttpServletResponse.SC_UNAUTHORIZED)) // 실패 시 401 Unauthorized
                .permitAll()
            )
            // 로그아웃 설정
            .logout(logout -> logout
                .logoutUrl("/api/logout") // 로그아웃 처리 URL
                .logoutSuccessHandler((req, res, auth) -> res.setStatus(HttpServletResponse.SC_OK))
            );
        return http.build();
    }

    /**
     * 사용자 인증 정보를 관리하는 UserDetailsManager를 JDBC 기반으로 구성합니다.
     * 'authDataSource'를 사용하여 사용자 데이터베이스에 접근하고,
     * 사용자 조회 및 생성에 필요한 SQL 쿼리를 커스터마이징합니다.
     *
     * @param dataSource 'authDataSource'로 지정된 인증용 데이터 소스
     * @return 커스텀 쿼리가 적용된 JdbcUserDetailsManager 객체
     */
    @Bean
    public UserDetailsManager userDetailsManager(@Qualifier("authDataSource") DataSource dataSource) {
        JdbcUserDetailsManager users = new JdbcUserDetailsManager(dataSource);
        users.setUsersByUsernameQuery("SELECT username, password_hash, 1 as enabled FROM users WHERE username = ?");
        users.setAuthoritiesByUsernameQuery("SELECT username, 'ROLE_USER' as authority FROM users WHERE username = ?");
        // 사용자 생성 시 nickname을 username과 동일하게 설정
        users.setCreateUserSql("INSERT INTO users (username, password_hash, nickname) VALUES (?,?,?)");
        return users;
    }

    /**
     * 비밀번호 암호화를 위한 PasswordEncoder를 Bean으로 등록합니다.
     * BCrypt 해시 알고리즘을 사용합니다.
     *
     * @return BCryptPasswordEncoder 객체
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}