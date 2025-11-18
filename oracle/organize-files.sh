#!/bin/bash

# Oracle Performance Testing Directory Cleanup Script
# This script organizes files into appropriate directories

set -e

ORACLE_DIR="/Users/spathlavath/otel/db-perfromance-testing/oracle"
cd "$ORACLE_DIR"

echo "🧹 Starting cleanup of Oracle performance testing directory..."
echo "Current directory: $(pwd)"

# Create archive directories
echo ""
echo "📁 Creating archive directories..."
mkdir -p archive/docs
mkdir -p archive/fixes
mkdir -p archive/diagnostic

# Move historical fix documentation
echo ""
echo "📄 Moving historical fix documentation to archive/docs..."
mv -v CHECK-WITH-CORRECT-SERVICE-NAME.md archive/docs/ 2>/dev/null || echo "  ⚠️  CHECK-WITH-CORRECT-SERVICE-NAME.md not found"
mv -v DATABASE_OPERATIONS_FIX.md archive/docs/ 2>/dev/null || echo "  ⚠️  DATABASE_OPERATIONS_FIX.md not found"
mv -v DATABASE_TRACING_FIX.md archive/docs/ 2>/dev/null || echo "  ⚠️  DATABASE_TRACING_FIX.md not found"
mv -v database-operations-debug-guide.md archive/docs/ 2>/dev/null || echo "  ⚠️  database-operations-debug-guide.md not found"
mv -v LOCK_WORKLOAD_REMOVAL.md archive/docs/ 2>/dev/null || echo "  ⚠️  LOCK_WORKLOAD_REMOVAL.md not found"
mv -v OPENTELEMETRY_SEMANTIC_CONVENTIONS_FIX.md archive/docs/ 2>/dev/null || echo "  ⚠️  OPENTELEMETRY_SEMANTIC_CONVENTIONS_FIX.md not found"
mv -v SOLUTION-database-operations.md archive/docs/ 2>/dev/null || echo "  ⚠️  SOLUTION-database-operations.md not found"
mv -v find-actual-service-name.md archive/docs/ 2>/dev/null || echo "  ⚠️  find-actual-service-name.md not found"
mv -v verify-database-spans.md archive/docs/ 2>/dev/null || echo "  ⚠️  verify-database-spans.md not found"

# Move summary/completion documentation
echo ""
echo "📊 Moving summary documentation to archive/docs..."
mv -v COMPLETION_SUMMARY.md archive/docs/ 2>/dev/null || echo "  ⚠️  COMPLETION_SUMMARY.md not found"
mv -v MIGRATION_SUMMARY.md archive/docs/ 2>/dev/null || echo "  ⚠️  MIGRATION_SUMMARY.md not found"
mv -v SUMMARY.md archive/docs/ 2>/dev/null || echo "  ⚠️  SUMMARY.md not found"
mv -v TWO_WEEK_STABLE_CONFIG.md archive/docs/ 2>/dev/null || echo "  ⚠️  TWO_WEEK_STABLE_CONFIG.md not found"
mv -v CONTINUOUS_DEMO_CONFIG.md archive/docs/ 2>/dev/null || echo "  ⚠️  CONTINUOUS_DEMO_CONFIG.md not found"

# Move diagnostic documentation
echo ""
echo "🔍 Moving diagnostic documentation to archive/diagnostic..."
mv -v CRITICAL-DIAGNOSTIC-QUERIES.md archive/diagnostic/ 2>/dev/null || echo "  ⚠️  CRITICAL-DIAGNOSTIC-QUERIES.md not found"

# Move one-time fix scripts
echo ""
echo "🔧 Moving one-time fix scripts to archive/fixes..."
mv -v apply-thick-mode-fix.sh archive/fixes/ 2>/dev/null || echo "  ⚠️  apply-thick-mode-fix.sh not found"
mv -v deploy-all-fixes.sh archive/fixes/ 2>/dev/null || echo "  ⚠️  deploy-all-fixes.sh not found"
mv -v deploy-context-fix.sh archive/fixes/ 2>/dev/null || echo "  ⚠️  deploy-context-fix.sh not found"
mv -v deploy-db-tracing-fix.sh archive/fixes/ 2>/dev/null || echo "  ⚠️  deploy-db-tracing-fix.sh not found"
mv -v deploy-enhanced-hr-portal.sh archive/fixes/ 2>/dev/null || echo "  ⚠️  deploy-enhanced-hr-portal.sh not found"
mv -v deploy-fix.sh archive/fixes/ 2>/dev/null || echo "  ⚠️  deploy-fix.sh not found"
mv -v deploy-metrics-fix.sh archive/fixes/ 2>/dev/null || echo "  ⚠️  deploy-metrics-fix.sh not found"
mv -v deploy-newrelic-attributes-fix.sh archive/fixes/ 2>/dev/null || echo "  ⚠️  deploy-newrelic-attributes-fix.sh not found"
mv -v deploy-tracing-fix.sh archive/fixes/ 2>/dev/null || echo "  ⚠️  deploy-tracing-fix.sh not found"
mv -v emergency-deploy-instrumentation.sh archive/fixes/ 2>/dev/null || echo "  ⚠️  emergency-deploy-instrumentation.sh not found"

# Move verification scripts
echo ""
echo "✅ Moving verification scripts to archive/fixes..."
mv -v test-otel.sh archive/fixes/ 2>/dev/null || echo "  ⚠️  test-otel.sh not found"
mv -v verify-db-attributes.sh archive/fixes/ 2>/dev/null || echo "  ⚠️  verify-db-attributes.sh not found"
mv -v verify-instrumentation-on-vm.sh archive/fixes/ 2>/dev/null || echo "  ⚠️  verify-instrumentation-on-vm.sh not found"
mv -v verify-semantic-conventions.sh archive/fixes/ 2>/dev/null || echo "  ⚠️  verify-semantic-conventions.sh not found"

# Create archive README
echo ""
echo "📝 Creating archive README..."
cat > archive/README.md << 'EOF'
# Archive Directory

This directory contains historical documentation, one-time fix scripts, and diagnostic files that were used during the development and troubleshooting phases of the Oracle performance testing setup.

## Directory Structure

### docs/
Contains historical documentation about fixes, migrations, and configuration changes that have been applied to the project.

### fixes/
Contains one-time deployment and fix scripts that were used to resolve specific issues. These scripts are kept for reference but are no longer needed for regular operations.

### diagnostic/
Contains diagnostic queries and troubleshooting documentation used during development.

## Note
These files are preserved for historical reference and troubleshooting purposes. For current operations, refer to the main README.md and documentation in the parent directory.
EOF

# List remaining files
echo ""
echo "✨ Cleanup complete! Remaining files in oracle/:"
echo ""
ls -1 *.md 2>/dev/null | grep -v "CLEANUP_PLAN.md" || echo "No markdown files"
echo ""
ls -1 *.sh 2>/dev/null || echo "No shell scripts"
echo ""
ls -1 *.yml *.yaml 2>/dev/null || echo "No YAML files"

# Show archive contents
echo ""
echo "📦 Archive contents:"
echo ""
echo "archive/docs/:"
ls -1 archive/docs/ 2>/dev/null || echo "  (empty)"
echo ""
echo "archive/fixes/:"
ls -1 archive/fixes/ 2>/dev/null || echo "  (empty)"
echo ""
echo "archive/diagnostic/:"
ls -1 archive/diagnostic/ 2>/dev/null || echo "  (empty)"

echo ""
echo "✅ Cleanup completed successfully!"
echo ""
echo "📂 Current clean structure:"
tree -L 1 -F --dirsfirst 2>/dev/null || ls -lah

echo ""
echo "💡 Tip: Review the CLEANUP_PLAN.md file for details about what was moved and why."
