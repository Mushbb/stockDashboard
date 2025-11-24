package stockDashboard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 주식 대시보드 Spring Boot 애플리케이션의 메인 클래스입니다.
 * 애플리케이션의 시작점(entry point) 역할을 합니다.
 * @EnableScheduling 어노테이션을 통해 스케줄링 기능을 활성화합니다.
 */
@EnableScheduling
@SpringBootApplication
public class StockDashboardApplication {

	/**
	 * 애플리케이션을 실행하는 main 메서드입니다.
	 * @param args 커맨드 라인 인자
	 */
	public static void main(String[] args) {
		SpringApplication.run(StockDashboardApplication.class, args);
	}
}