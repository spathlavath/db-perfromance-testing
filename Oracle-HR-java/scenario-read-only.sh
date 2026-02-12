#!/bin/bash
# Scenario 1: Read-Only Queries (Fast, no blocking)
# Use case: Standard application read operations

BASE_URL="${BASE_URL:-http://localhost:3002}"

echo "[$(date)] [READ-ONLY] Starting read-only query scenario..."

# Simple SELECT queries
curl -sf $BASE_URL/employees/100 > /dev/null
curl -sf $BASE_URL/employees/101 > /dev/null
curl -sf $BASE_URL/employees/102 > /dev/null

# Department queries
curl -sf $BASE_URL/departments/60/employees > /dev/null
curl -sf $BASE_URL/departments/50/employees > /dev/null

# Job queries
curl -sf $BASE_URL/jobs > /dev/null

echo "[$(date)] [READ-ONLY] Completed"
