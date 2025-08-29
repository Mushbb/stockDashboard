package stockDashboard.controller;

import stockDashboard.service.DashboardService;

import org.springframework.stereotype.Controller;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor 
@Controller
public class DashboardController {
	private final DashboardService serv;
	
	
}