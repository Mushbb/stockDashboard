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

@Component
@RequiredArgsConstructor
public class JDBC_SQL {
    private final DataSource dataSource;

    private Connection getConnection() throws SQLException {
        return dataSource.getConnection();
    }
    
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
    
    public Integer login(String id, String password) {
		Connection connection = null;
		Statement statement = null;
		ResultSet resultSet = null;
		Integer count = 0;
		
		try {
	        connection = getConnection();
	        
	        statement = connection.createStatement();
	        
	        resultSet = statement.executeQuery("SELECT COUNT(*) AS CNT FROM SM_Mem_Info WHERE MI_ID='"+id+"' AND MI_PW='"+password+"'");
	        resultSet.next();
	        count = resultSet.getInt("CNT");
	        
		} catch (SQLException e) {
            System.err.println("Database error occurred: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try {
                if (resultSet != null) resultSet.close();
                if (statement != null) statement.close();
                if (connection != null) connection.close();
            } catch (SQLException e) {
                System.err.println("Error closing resources: " + e.getMessage());
            }
        }
		
		return count;
	}
}

