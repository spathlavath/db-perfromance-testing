# Oracle Test App - Quick Reference

## Setup (30 seconds)

```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle
cp .env.example .env
# Edit .env with your Oracle credentials
docker-compose up --build
```

## Common Commands

| Action | Command |
|--------|---------|
| Start | `docker-compose up` |
| Start (background) | `docker-compose up -d` |
| Start with build | `docker-compose up --build` |
| Stop | `docker-compose down` |
| View logs | `docker-compose logs -f` |
| Check status | `docker-compose ps` |
| Cleanup | `./cleanup.sh` |

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/pool-stats` | GET | Connection pool statistics |
| `/workload/start` | POST | Start a workload |
| `/workload/stop` | POST | Stop all workloads |

## Workload Types

- `query` - Query performance testing
- `transaction` - Transaction monitoring
- `connection` - Connection pool testing
- `lock` - Lock scenario testing
- `memory` - Memory usage testing

## Intensity Levels

- `low` - Baseline testing
- `medium` - Realistic simulation (default)
- `high` - Stress testing

## Example API Calls

```bash
# Health check
curl http://localhost:3000/health

# Start query workload
curl -X POST http://localhost:3000/workload/start \
  -H "Content-Type: application/json" \
  -d '{"type": "query", "duration": 300, "intensity": "medium"}'

# Stop all workloads
curl -X POST http://localhost:3000/workload/stop
```

## Environment Variables

```env
# Required
ORACLE_USER=system
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=host:1521/service

# Optional
AUTO_RUN=true                    # Auto-start tests
TEST_INTENSITY=medium            # low|medium|high
TEST_DURATION=600                # seconds
NEW_RELIC_LICENSE_KEY=your_key   # For APM
```

## Docker Compose Services

- `oracle-test-app` - Main application (port 3000)
- `k6` - Load testing (runs automatically)

## Monitoring

### New Relic APM
Set `NEW_RELIC_LICENSE_KEY` in `.env` to enable APM monitoring.

### K6 Load Testing
Runs automatically when you start with `docker-compose up`.

### Logs
```bash
# All logs
docker-compose logs -f

# App logs only
docker-compose logs -f oracle-test-app

# K6 logs only
docker-compose logs -f k6
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection refused | Check `ORACLE_CONNECT_STRING` in `.env` |
| Permission denied | Grant required privileges to Oracle user |
| Container won't start | Check logs: `docker-compose logs oracle-test-app` |
| Port already in use | Change `PORT` in `.env` or stop other services |

## Metrics Generated

The application generates activity to test these Oracle DB receiver metrics:

- Query performance (parse calls, execution count)
- Transactions (commits, rollbacks)
- Connections (active, idle, wait times)
- Locks (waits, timeouts, deadlocks)
- Memory (PGA, SGA, buffer cache)

## Project Structure

```
oracle/
├── services/          # Application code
│   ├── app.js        # Main app
│   ├── newrelic.js   # APM config
│   └── workloads/    # Workload generators
├── k6/scripts/       # Load tests
├── docker-compose.yml
├── cleanup.sh
└── start.sh
```

## Need Help?

1. Check `README.md` for detailed documentation
2. Review `MIGRATION_SUMMARY.md` for architecture details
3. Check logs: `docker-compose logs -f`
4. Verify `.env` configuration
5. Ensure Oracle DB is accessible
