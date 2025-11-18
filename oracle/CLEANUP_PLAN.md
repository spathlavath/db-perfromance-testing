# Oracle Performance Testing Directory Cleanup Plan

## Current State Analysis
- **18 Markdown documentation files** (many redundant/outdated)
- **18 Shell scripts** (many for one-time fixes)
- Multiple temporary/fix documentation files

## Files to Keep (Essential)

### Core Documentation
- `README.md` - Main project documentation
- `OTEL_SETUP.md` - OpenTelemetry setup guide
- `QUICK_REFERENCE.md` - Quick reference for common tasks

### Core Configuration
- `.env.example` - Environment template
- `.env` - Active environment (if exists)
- `.gitignore` - Git configuration
- `docker-compose.yml` - Docker orchestration

### Core Scripts
- `start.sh` - Main startup script
- `cleanup.sh` - Cleanup script
- `check-deployment-status.sh` - Status checking
- `install-docker.sh` - Docker installation

### Application Code
- `services/` - All service files
- `k6/` - Load testing scripts

## Files to Archive (Move to archive/ directory)

### Historical Fix Documentation
- `CHECK-WITH-CORRECT-SERVICE-NAME.md`
- `DATABASE_OPERATIONS_FIX.md`
- `DATABASE_TRACING_FIX.md`
- `database-operations-debug-guide.md`
- `LOCK_WORKLOAD_REMOVAL.md`
- `OPENTELEMETRY_SEMANTIC_CONVENTIONS_FIX.md`
- `SOLUTION-database-operations.md`
- `find-actual-service-name.md`
- `verify-database-spans.md`

### Summary/Completion Documentation
- `COMPLETION_SUMMARY.md`
- `MIGRATION_SUMMARY.md`
- `SUMMARY.md`
- `TWO_WEEK_STABLE_CONFIG.md`
- `CONTINUOUS_DEMO_CONFIG.md`

### One-time Fix Scripts
- `apply-thick-mode-fix.sh`
- `deploy-all-fixes.sh`
- `deploy-context-fix.sh`
- `deploy-db-tracing-fix.sh`
- `deploy-enhanced-hr-portal.sh`
- `deploy-fix.sh`
- `deploy-metrics-fix.sh`
- `deploy-newrelic-attributes-fix.sh`
- `deploy-tracing-fix.sh`
- `emergency-deploy-instrumentation.sh`

### Verification Scripts (One-time use)
- `test-otel.sh`
- `verify-db-attributes.sh`
- `verify-instrumentation-on-vm.sh`
- `verify-semantic-conventions.sh`

### Diagnostic Documentation
- `CRITICAL-DIAGNOSTIC-QUERIES.md`

## Cleanup Actions

1. Create `archive/` directory for historical files
2. Create `archive/fixes/` for fix scripts
3. Create `archive/docs/` for old documentation
4. Move files accordingly
5. Update README.md with reference to archived content

## Post-Cleanup Structure
```
oracle/
├── README.md
├── OTEL_SETUP.md
├── QUICK_REFERENCE.md
├── .env.example
├── .gitignore
├── docker-compose.yml
├── start.sh
├── cleanup.sh
├── check-deployment-status.sh
├── install-docker.sh
├── services/
├── k6/
└── archive/
    ├── docs/          # Historical documentation
    └── fixes/         # One-time fix scripts
```
