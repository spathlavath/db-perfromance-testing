#!/bin/bash
# Simple setup for Oracle Linux Server
# Run this once to install the systemd service

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./setup-loadtest.sh"
    exit 1
fi

echo "Installing Oracle HR Load Test Service..."

# Copy service file
cp oracle-loadtest.service /etc/systemd/system/oracle-hr-loadtest.service
systemctl daemon-reload

echo "✓ Service installed"
echo ""
echo "Commands:"
echo "  Start:  sudo systemctl start oracle-hr-loadtest"
echo "  Stop:   sudo systemctl stop oracle-hr-loadtest"
echo "  Status: sudo systemctl status oracle-hr-loadtest"
echo "  Logs:   sudo journalctl -u oracle-hr-loadtest -f"
echo ""
echo "To start on boot: sudo systemctl enable oracle-hr-loadtest"
