package stockDashboard.repository;

import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.PreparedStatement;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;

/**
 * 순수 JDBC를 사용하여 데이터베이스 작업을 직접 수행하는 유틸리티 클래스입니다.
 * DataSource에서 직접 Connection을 얻어 SQL 쿼리를 실행합니다.
 */
@Component
@RequiredArgsConstructor
public class JDBC_SQL {
    private final DataSource dataSource;

    /**
     * DataSource로부터 새로운 데이터베이스 Connection을 가져옵니다.
     * @return 데이터베이스 Connection 객체
     * @throws SQLException Connection 실패 시
     */
    private Connection getConnection() throws SQLException {
        return dataSource.getConnection();
    }
    
    /**
     * SELECT 쿼리를 실행하고 결과를 List<Map<String, Object>> 형태로 반환합니다.
     * 각 Map은 데이터베이스의 한 행(row)을 나타내며, 키는 컬럼명입니다.
     * @param sqlQuery 실행할 SELECT SQL 쿼리 문자열
     * @param Params 쿼리의 '?'에 바인딩될 파라미터 배열
     * @return 쿼리 결과를 담은 List 객체
     */
    public List<Map<String, Object>> executeSelect(String sqlQuery, Object[] Params) {
    	List<Map<String, Object>> result = new ArrayList<Map<String, Object>>();
        Connection connection = null;
        PreparedStatement statement = null;
        ResultSet resultSet = null;
        
        try {
            connection = getConnection();
            statement = connection.prepareStatement(sqlQuery);
            if( Params != null )
	            for(int i=0;i<Params.length;i++)
	            	statement.setObject(i+1, Params[i]);

            resultSet = statement.executeQuery();

            ResultSetMetaData rsmd = resultSet.getMetaData();
            int columnCount = rsmd.getColumnCount();
            
            while (resultSet.next()) {
            	Map<String, Object> row = new HashMap<>();
                for (int i = 1; i <= columnCount; i++) {
                	row.put(rsmd.getColumnName(i), resultSet.getObject(i));
                }
                result.add(row);
            }
        } catch (SQLException e) {
        	System.err.println("Database error occurred during DML/DDL operation: " + e.getMessage());
            e.printStackTrace();
            try {
                if (connection != null) {
                    connection.rollback();
                    System.err.println("Transaction rolled back due to error.");
                }
            } catch (SQLException rollbackEx) {
                System.err.println("Error during rollback: " + rollbackEx.getMessage());
            }
        } finally {
            try {
                if (resultSet != null) resultSet.close();
                if (statement != null) statement.close();
                if (connection != null) connection.close();
            } catch (SQLException e) {
                System.err.println("Error closing resources: " + e.getMessage());
            }
        }
        
        
        return result;
    }
    
    /**
     * INSERT, UPDATE, DELETE 등 데이터 변경 쿼리를 실행합니다.
     * 트랜잭션 내에서 실행되며, 자동 생성된 키를 반환하고 추가 데이터를 조회하는 복합 기능을 지원합니다.
     * @param sqlQuery 실행할 DML SQL 쿼리 문자열
     * @param Params 쿼리의 '?'에 바인딩될 파라미터 배열
     * @param returnCols INSERT 실행 후 반환받을 자동 생성 키의 컬럼명 배열
     * @param addCols INSERT 실행 후, 반환된 키를 이용해 추가로 조회할 데이터의 컬럼명 배열
     * @return 영향을 받은 행의 수('affected_rows')와 요청된 키 및 추가 데이터를 포함하는 Map 객체
     */
    public Map<String, Object> executeUpdate(String sqlQuery, Object[] Params, String[] returnCols, String[] addCols) {
    	Map<String, Object> result = new HashMap<>();
        Connection connection = null;
        PreparedStatement statement = null;
        
        try {
            connection = getConnection();
            connection.setAutoCommit(false); 
            
            statement = connection.prepareStatement(sqlQuery, Statement.RETURN_GENERATED_KEYS);
            
            if( Params != null )
	            for(int i=0;i<Params.length;i++)
	            	statement.setObject(i+1, Params[i]);

        	int rowsAffected = statement.executeUpdate();
        	
            ResultSet generatedKeys = statement.getGeneratedKeys();
            if ( generatedKeys.next() && returnCols != null)
            	for(int i=0;i<returnCols.length;i++)
            		result.put(returnCols[i], generatedKeys.getObject(i+1));
            
            if( addCols != null ) {
            	statement.close();
	            String SelectSql = "SELECT ";
	            for( String Cols : addCols )
	            	SelectSql += Cols+", ";
	            SelectSql = SelectSql.substring(0, SelectSql.length()-2);
	            SelectSql += " FROM "+DB_Utils.TableNameFromInsert(sqlQuery)+" ";
	            SelectSql += "WHERE "+returnCols[0]+" = ?";
	            
	            statement = connection.prepareStatement(SelectSql);
	            statement.setObject(1, result.get(returnCols[0]));
	            
	            ResultSet resultSet = statement.executeQuery();
	            ResultSetMetaData rsmd = resultSet.getMetaData();
	            int columnCount = rsmd.getColumnCount();
	            
	            while (resultSet.next()) {
	                for (int i = 1; i <= columnCount; i++) {
	                	result.put(rsmd.getColumnName(i).toLowerCase(), resultSet.getObject(i));
	                }
	            }
            }
            
            result.put("affected_rows", (long) rowsAffected);
            generatedKeys.close();
            
            connection.commit();
            
        } catch (SQLException e) {
        	System.err.println("Database error occurred during DML/DDL operation: " + e.getMessage());
            e.printStackTrace();
            try {
                if (connection != null) {
                    connection.rollback();
                    System.err.println("Transaction rolled back due to error.");
                }
            } catch (SQLException rollbackEx) {
                System.err.println("Error during rollback: " + rollbackEx.getMessage());
            }
        } finally {
            try {
                if (statement != null) statement.close();
                if (connection != null) connection.close();
            } catch (SQLException e) {
                System.err.println("Error closing resources: " + e.getMessage());
            }
        }
        
        return result;
    }
    
    /**
     * 'SET IDENTITY_INSERT ON'을 사용하여 ID 값을 직접 지정하는 INSERT 쿼리를 실행합니다.
     * 이 기능은 MS-SQL Server와 같은 특정 데이터베이스에서만 동작할 수 있습니다.
     * @param sqlQuery 실행할 INSERT SQL 쿼리
     * @param Params 쿼리에 바인딩될 파라미터 배열
     * @return 빈 Map 객체 (현재는 특별한 반환값이 없음)
     */
    public Map<String, Object> executeInsert_IdentitiyOn(String sqlQuery, String[] Params) {
    	Map<String, Object> result = new HashMap<>();
        Connection connection = null;
        PreparedStatement statement = null;
        Statement identity = null;
        
        try {
            connection = getConnection();
            connection.setAutoCommit(false); 
            
            identity = connection.createStatement();
            identity.execute("SET IDENTITY_INSERT users ON" );
            
            statement = connection.prepareStatement(sqlQuery);
            if( Params != null )
	            for(int i=0;i<Params.length;i++)
	            	statement.setObject(i+1, Params[i]);
            statement.executeUpdate();
            
            identity.execute("SET IDENTITY_INSERT users OFF" );
            
            connection.commit();
            
        } catch (SQLException e) {
        	System.err.println("Database error occurred during DML/DDL operation: " + e.getMessage());
            e.printStackTrace();
            try {
                if (connection != null) {
                    connection.rollback();
                    System.err.println("Transaction rolled back due to error.");
                }
            } catch (SQLException rollbackEx) {
                System.err.println("Error during rollback: " + rollbackEx.getMessage());
            }
        } finally {
            try {
            	if (identity != null) identity.close();
                if (statement != null) statement.close();
                if (connection != null) connection.close();
            } catch (SQLException e) {
                System.err.println("Error closing resources: " + e.getMessage());
            }
        }
        
        return result;
    }
}

