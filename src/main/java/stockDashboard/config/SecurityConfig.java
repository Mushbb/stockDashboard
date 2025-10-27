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

@Configuration
@EnableWebSecurity
public class SecurityConfig {

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

    @Bean
    public UserDetailsManager userDetailsManager(@Qualifier("authDataSource") DataSource dataSource) {
        JdbcUserDetailsManager users = new JdbcUserDetailsManager(dataSource);
        users.setUsersByUsernameQuery("SELECT username, password_hash, 1 as enabled FROM users WHERE username = ?");
        users.setAuthoritiesByUsernameQuery("SELECT username, 'ROLE_USER' as authority FROM users WHERE username = ?");
        // 사용자 생성 시 nickname을 username과 동일하게 설정
        users.setCreateUserSql("INSERT INTO users (username, password_hash, nickname) VALUES (?,?,?)");
        // authorities 테이블은 사용하지 않으므로 관련 쿼리 제거
        // users.setCreateAuthoritySql("INSERT INTO authorities (username, authority) VALUES (?,?)");
        return users;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}