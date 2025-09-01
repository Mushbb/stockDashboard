package stockDashboard.model;

import java.time.LocalDate;

public record SectorHistory(
		String id, 
		LocalDate start_date, 
		LocalDate end_date,
		String name
	) { }
