#!/bin/bash
# Automated Oracle SQL Comment Check Script
# This script connects to Oracle and runs the verification SQL

ORACLE_HOST="10.0.1.36"
ORACLE_PORT=1521
ORACLE_SERVICE="pdb1.privatesubnet.oracledb.oraclevcn.com"
ORACLE_USER="hr"

echo "Connecting to Oracle Database..."
echo "Host: $ORACLE_HOST:$ORACLE_PORT"
echo "Service: $ORACLE_SERVICE"
echo "User: $ORACLE_USER"
echo ""
echo "You will be prompted for the password..."
echo ""

# Check if sqlplus is available
if ! command -v sqlplus &> /dev/null; then
    echo "Error: sqlplus command not found"
    echo "Please install Oracle Instant Client or use SQL Developer"
    echo ""
    echo "Alternative: Run check_sql_comments.sql manually in SQL Developer or SQL*Plus"
    exit 1
fi

# Run the SQL script
sqlplus -S $ORACLE_USER@//$ORACLE_HOST:$ORACLE_PORT/$ORACLE_SERVICE @check_sql_comments.sql

echo ""
echo "Check complete!"
