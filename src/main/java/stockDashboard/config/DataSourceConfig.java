package stockDashboard.config;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 여러 데이터 소스를 관리하기 위한 구성 클래스입니다.
 */
@Configuration
public class DataSourceConfig {

    // --- App (Primary) DataSource ---

    /**
     * application.properties에서 "spring.datasource.app" 경로의 속성을 읽어
     * 기본 데이터 소스 속성을 설정합니다.
     * @return 기본 데이터 소스 속성 객체
     */
    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource.app")
    public DataSourceProperties appDataSourceProperties() {
        return new DataSourceProperties();
    }

    /**
     * 기본 데이터 소스(DataSource) Bean을 생성합니다.
     * @return 기본 DataSource 객체
     */
    @Bean
    @Primary
    @Qualifier("appDataSource")
    public DataSource appDataSource() {
        return appDataSourceProperties().initializeDataSourceBuilder().build();
    }

    /**
     * 기본 데이터 소스를 사용하는 JdbcTemplate Bean을 생성합니다.
     * @param dataSource 기본 DataSource 객체
     * @return 기본 JdbcTemplate 객체
     */
    @Bean
    @Primary
    @Qualifier("appJdbcTemplate")
    public JdbcTemplate appJdbcTemplate(@Qualifier("appDataSource") DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    // --- Auth (Secondary) DataSource ---

    /**
     * application.properties에서 "spring.datasource.auth" 경로의 속성을 읽어
     * 인증용 데이터 소스 속성을 설정합니다.
     * @return 인증용 데이터 소스 속성 객체
     */
    @Bean
    @ConfigurationProperties("spring.datasource.auth")
    public DataSourceProperties authDataSourceProperties() {
        return new DataSourceProperties();
    }

    /**
     * 인증용 데이터 소스(DataSource) Bean을 생성합니다.
     * @return 인증용 DataSource 객체
     */
    @Bean
    @Qualifier("authDataSource")
    public DataSource authDataSource() {
        return authDataSourceProperties().initializeDataSourceBuilder().build();
    }

    /**
     * 인증용 데이터 소스를 사용하는 JdbcTemplate Bean을 생성합니다.
     * @param dataSource 인증용 DataSource 객체
     * @return 인증용 JdbcTemplate 객체
     */
    @Bean
    @Qualifier("authJdbcTemplate")
    public JdbcTemplate authJdbcTemplate(@Qualifier("authDataSource") DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }
}
