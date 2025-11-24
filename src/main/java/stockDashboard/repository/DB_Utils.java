package stockDashboard.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

public class DB_Utils {
	/**
	 * JDBC_SQL의 결과(List<String>)를 범용적인 List<Map<String, Object>> 형태로 파싱합니다.
	 * 
	 * @param rawResult JDBC_SQL.excuteQuery()로부터 반환된 결과
	 * @return 파싱된 데이터. 각 Map은 하나의 행(row)을 나타냅니다.
	 */
	public static List<Map<String, Object>> parseResultSet(List<String> rawResult) {
		List<Map<String, Object>> parsedData = new ArrayList<>();

		// 결과가 없거나 헤더만 있는 경우 빈 리스트 반환
		if (rawResult == null || rawResult.size() <= 1) {
			return parsedData;
		}

		// 첫 번째 줄은 헤더(컬럼 이름)
		String[] headers = rawResult.get(0).split("\t");

		// 두 번째 줄부터 실제 데이터 행
		for (int i = 1; i < rawResult.size(); i++) {
			String[] values = rawResult.get(i).split("\t");
			Map<String, Object> row = new HashMap<>();

			for (int j = 0; j < headers.length; j++) {
				// 값이 컬럼 수보다 적게 들어온 경우를 대비한 방어 코드
				if (j < values.length) {
					row.put(headers[j].toLowerCase(), values[j]); // 키는 소문자로 통일하여 일관성 유지
				} else {
					row.put(headers[j].toLowerCase(), null);
				}
			}
			parsedData.add(row);
		}

		return parsedData;
	}
	
	/**
	 * INSERT INTO SQL 쿼리 문자열에서 테이블 이름을 추출합니다.
	 * @param sqlQuery 테이블 이름을 추출할 INSERT 쿼리
	 * @return 추출된 테이블 이름, 실패 시 null
	 */
	public static String TableNameFromInsert(String sqlQuery) {
        if (sqlQuery == null || sqlQuery.trim().isEmpty()) {
            return null;
        }

        String normalizedSql = sqlQuery.trim().toUpperCase(); // Normalize for easier parsing

        // Check if it's an INSERT INTO statement
        if (!normalizedSql.startsWith("INSERT INTO")) {
            // Not an INSERT INTO statement
            return null;
        }

        // Find the start of the table name (after "INSERT INTO ")
        int startIndex = "INSERT INTO ".length();

        // Find the end of the table name (before the next space, or the opening parenthesis)
        int endIndex = normalizedSql.indexOf(" ", startIndex);
        if (endIndex == -1) { // If no space found, look for '(' (e.g., INSERT INTO MyTable(col1, col2))
            endIndex = normalizedSql.indexOf("(", startIndex);
        }

        if (endIndex == -1) {
            // If neither space nor parenthesis is found, assume the rest is the table name (e.g., INSERT INTO MyTable)
            return sqlQuery.substring(startIndex).trim();
        } else {
            // Extract the substring between startIndex and endIndex
            return sqlQuery.substring(startIndex, endIndex).trim();
        }
	}
}
