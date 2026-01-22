package com.oracle.test.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

@Configuration
public class DatabaseConfig {

    @Value("${oracle.user}")
    private String username;

    @Value("${oracle.password}")
    private String password;

    @Value("${oracle.connect-string}")
    private String connectString;

    @Value("${pool.min:2}")
    private int poolMin;

    @Value("${pool.max:10}")
    private int poolMax;

    @Value("${pool.timeout:60}")
    private int poolTimeout;

    @Bean
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();

        // Oracle JDBC URL format
        config.setJdbcUrl("jdbc:oracle:thin:@" + connectString);
        config.setUsername(username);
        config.setPassword(password);
        config.setDriverClassName("oracle.jdbc.OracleDriver");

        // Connection pool settings
        config.setMinimumIdle(poolMin);
        config.setMaximumPoolSize(poolMax);
        config.setConnectionTimeout(poolTimeout * 1000L); // Convert to milliseconds
        config.setIdleTimeout(600000); // 10 minutes
        config.setMaxLifetime(1800000); // 30 minutes

        // Pool name for monitoring
        config.setPoolName("OracleHRPoolV2");

        // Performance optimizations
        config.addDataSourceProperty("cachePrepStmts", "true");
        config.addDataSourceProperty("prepStmtCacheSize", "250");
        config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");

        // Oracle-specific optimizations
        config.addDataSourceProperty("oracle.jdbc.implicitStatementCacheSize", "25");
        config.addDataSourceProperty("oracle.net.CONNECT_TIMEOUT", "10000");
        config.addDataSourceProperty("oracle.jdbc.ReadTimeout", "60000");

        return new HikariDataSource(config);
    }

    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }
}
