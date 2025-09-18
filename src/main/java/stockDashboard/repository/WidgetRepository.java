package stockDashboard.repository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

@Repository
public class WidgetRepository {

    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public WidgetRepository(@Qualifier("authJdbcTemplate") JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public int updateLayoutInfo(long userId, long widgetId, String layoutInfo) {
        String sql = "UPDATE user_widgets SET layout_info = ? WHERE user_id = ? AND widget_id = ?";
        return jdbcTemplate.update(sql, layoutInfo, userId, widgetId);
    }

    /**
     * 특정 사용자의 위젯 설정을 업데이트합니다.
     */
    public int updateWidgetSettings(long userId, long widgetId, String widgetSettings) {
        String sql = "UPDATE user_widgets SET widget_settings = ? WHERE user_id = ? AND widget_id = ?";
        return jdbcTemplate.update(sql, widgetSettings, userId, widgetId);
    }

    public int updateWidgetName(long userId, long widgetId, String widgetName) {
        String sql = "UPDATE user_widgets SET widget_name = ? WHERE user_id = ? AND widget_id = ?";
        return jdbcTemplate.update(sql, widgetName, userId, widgetId);
    }

    public int deleteWidget(long userId, long widgetId) {
        String sql = "DELETE FROM user_widgets WHERE user_id = ? AND widget_id = ?";
        return jdbcTemplate.update(sql, userId, widgetId);
    }

    // widget_name을 포함하도록 수정
    public int insertWidget(long userId, String widgetName, String widgetType, String layoutInfo, String widgetSettings) {
        String sql = "INSERT INTO user_widgets (user_id, widget_name, widget_type, layout_info, widget_settings) VALUES (?, ?, ?, ?, ?)";
        return jdbcTemplate.update(sql, userId, widgetName, widgetType, layoutInfo, widgetSettings);
    }

    // widget_name을 포함하도록 수정
    public List<WidgetDto> findAllByUserId(long userId) {
        String sql = "SELECT widget_id, user_id, widget_name, widget_type, layout_info, widget_settings FROM user_widgets WHERE user_id = ?";
        return jdbcTemplate.query(sql, new Object[]{userId}, new WidgetDtoRowMapper());
    }

    // DTO에 widgetName 추가
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

    // RowMapper가 widget_name을 매핑하도록 수정
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
