package stockDashboard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class StockDashboardApplication {

	public static void main(String[] args) {
		SpringApplication.run(StockDashboardApplication.class, args);
	}
	
	
}