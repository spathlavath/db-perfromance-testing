/**
 * New Relic agent configuration.
 *
 * See lib/config/default.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
  /**
   * Array of application names.
   */
  app_name: [process.env.NEW_RELIC_APP_NAME || 'Oracle-Test-App'],
  /**
   * Your New Relic license key.
   */
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  /**
   * Collector host - using staging environment
   * Set NEW_RELIC_HOST in .env for staging: staging-collector.newrelic.com
   * Or leave empty for production: collector.newrelic.com
   */
  host: process.env.NEW_RELIC_HOST || 'collector.newrelic.com',
  /**
   * This setting controls distributed tracing.
   * Distributed tracing lets you see the path that a request takes through your
   * distributed system. Enabling distributed tracing changes the behavior of some
   * New Relic features, so carefully consult the transition guide before you enable
   * this feature: https://docs.newrelic.com/docs/transition-guide-distributed-tracing
   * Default is true.
   */
  distributed_tracing: {
    /**
     * Enables/disables distributed tracing.
     *
     * @env NEW_RELIC_DISTRIBUTED_TRACING_ENABLED
     */
    enabled: true
  },
  /**
   * Logging level. 'trace' is most useful to New Relic when diagnosing
   * issues with the agent, 'info' and higher will impose the least overhead on
   * production applications.
   */
  logging: {
    /**
     * Level at which to log. 'trace' is most useful to New Relic when diagnosing
     * issues with the agent, 'info' and higher will impose the least overhead on
     * production applications.
     */
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
    /**
     * Where to put the log file -- by default just uses process.cwd +
     * 'newrelic_agent.log'. A special case is a filepath of 'stdout' which will
     * cause the agent to log to stdout instead of to a file. Defaults to 'stdout' for Docker.
     */
    filepath: process.env.NEW_RELIC_LOG || 'stdout'
  },
  /**
   * When true, all request headers except for those listed in attributes.exclude
   * will be captured for all traces, unless otherwise specified in a destination's
   * attributes include/exclude lists.
   */
  allow_all_headers: true,
  attributes: {
    /**
     * Prefix of attributes to exclude from all destinations. Allows * as wildcard
     * at end.
     *
     * NOTE: If excluding headers, they must be in camelCase form to be filtered.
     *
     * @env NEW_RELIC_ATTRIBUTES_EXCLUDE
     */
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*'
    ]
  },
  /**
   * Database instrumentation configuration
   */
  datastore_tracer: {
    /**
     * Whether to enable datastore instance details in transaction traces and slow query traces.
     */
    instance_reporting: {
      enabled: true
    },
    /**
     * Whether to enable database name in traces.
     */
    database_name_reporting: {
      enabled: true
    }
  },
  /**
   * Transaction tracer configuration
   */
  transaction_tracer: {
    /**
     * Whether to enable transaction tracing.
     */
    enabled: true,
    /**
     * Whether to record full SQL queries.
     */
    record_sql: 'obfuscated',
    /**
     * Threshold (in milliseconds) at which to capture slow queries.
     */
    explain_threshold: 500
  },
  /**
   * Custom instrumentation for Oracle DB
   */
  instrumentation: {
    'oracledb': {
      enabled: true
    }
  }
}
