package stockDashboard.repository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

/**
 * 사용자 위젯(user_widgets) 테이블에 대한 데이터베이스 작업을 처리하는 리포지토리입니다.
 * 'auth' 데이터 소스에 연결된 JdbcTemplate을 사용합니다.
 */
@Repository
public class WidgetRepository {

    private final JdbcTemplate jdbcTemplate;

    /**
     * WidgetRepository 생성자입니다.
     * @param jdbcTemplate 'authDataSource'에 연결된 인증용 JdbcTemplate
     */
    @Autowired
    public WidgetRepository(@Qualifier("authJdbcTemplate") JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * 특정 위젯의 레이아웃 정보를 업데이트합니다.
     * @param userId 사용자 ID
     * @param widgetId 위젯 ID
     * @param layoutInfo 새로운 레이아웃 정보 (JSON 문자열)
     * @return 업데이트된 행의 수
     */
    public int updateLayoutInfo(long userId, long widgetId, String layoutInfo) {
        String sql = "UPDATE user_widgets SET layout_info = ? WHERE user_id = ? AND widget_id = ?";
        return jdbcTemplate.update(sql, layoutInfo, userId, widgetId);
    }

    /**
     * 특정 사용자의 위젯 설정을 업데이트합니다.
     * @param userId 사용자 ID
     * @param widgetId 위젯 ID
     * @param widgetSettings 새로운 설정 정보 (JSON 문자열)
     * @return 업데이트된 행의 수
     */
    public int updateWidgetSettings(long userId, long widgetId, String widgetSettings) {
        String sql = "UPDATE user_widgets SET widget_settings = ? WHERE user_id = ? AND widget_id = ?";
        return jdbcTemplate.update(sql, widgetSettings, userId, widgetId);
    }

    /**
     * 특정 위젯의 이름을 업데이트합니다.
     * @param userId 사용자 ID
     * @param widgetId 위젯 ID
     * @param widgetName 새로운 위젯 이름
     * @return 업데이트된 행의 수
     */
    public int updateWidgetName(long userId, long widgetId, String widgetName) {
        String sql = "UPDATE user_widgets SET widget_name = ? WHERE user_id = ? AND widget_id = ?";
        return jdbcTemplate.update(sql, widgetName, userId, widgetId);
    }

    /**
     * 특정 위젯을 삭제합니다.
     * @param userId 사용자 ID
     * @param widgetId 삭제할 위젯 ID
     * @return 삭제된 행의 수
     */
    public int deleteWidget(long userId, long widgetId) {
        String sql = "DELETE FROM user_widgets WHERE user_id = ? AND widget_id = ?";
        return jdbcTemplate.update(sql, userId, widgetId);
    }

    /**
     * 새로운 위젯을 데이터베이스에 추가합니다.
     * @param userId 사용자 ID
     * @param widgetName 위젯 이름
     * @param widgetType 위젯 종류
     * @param layoutInfo 레이아웃 정보 (JSON 문자열)
     * @param widgetSettings 설정 정보 (JSON 문자열)
     * @return 추가된 행의 수
     */
    public int insertWidget(long userId, String widgetName, String widgetType, String layoutInfo, String widgetSettings) {
        String sql = "INSERT INTO user_widgets (user_id, widget_name, widget_type, layout_info, widget_settings) VALUES (?, ?, ?, ?, ?)";
        return jdbcTemplate.update(sql, userId, widgetName, widgetType, layoutInfo, widgetSettings);
    }

    /**
     * 특정 사용자의 모든 위젯 목록을 조회합니다.
     * @param userId 조회할 사용자 ID
     * @return 해당 사용자의 모든 위젯 DTO 리스트
     */
    public List<WidgetDto> findAllByUserId(long userId) {
        String sql = "SELECT widget_id, user_id, widget_name, widget_type, layout_info, widget_settings FROM user_widgets WHERE user_id = ?";
        return jdbcTemplate.query(sql, new Object[]{userId}, new WidgetDtoRowMapper());
    }

    /**
     * 위젯 데이터 전송 객체(DTO)입니다.
     * user_widgets 테이블의 한 행에 대한 정보를 담습니다.
     */
    public static class WidgetDto {
        public final long widgetId;
        public final long userId;
        public final String widgetName;
        public final String widgetType;
        public final String layoutInfo;
        public final String widgetSettings;

        public WidgetDto(long widgetId, long userId, String widgetName, String widgetType, String layoutInfo, String widgetSettings) {
            this.widgetId = widgetId;
            this.userId = userId;
            this.widgetName = widgetName;
            this.widgetType = widgetType;
            this.layoutInfo = layoutInfo;
            this.widgetSettings = widgetSettings;
        }
    }

    /**
     * ResultSet의 행을 WidgetDto 객체로 매핑하는 RowMapper 구현체입니다.
     */
    private static class WidgetDtoRowMapper implements RowMapper<WidgetDto> {
        @Override
        public WidgetDto mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new WidgetDto(
                rs.getLong("widget_id"),
                rs.getLong("user_id"),
                rs.getString("widget_name"),
                rs.getString("widget_type"),
                rs.getString("layout_info"),
                rs.getString("widget_settings")
            );
        }
    }
}

