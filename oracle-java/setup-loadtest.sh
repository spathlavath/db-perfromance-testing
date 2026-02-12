#!/bin/bash
# Simple setup for Oracle Linux Server
# Run this once to install the systemd service

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./setup-loadtest.sh"
    exit 1
fi

echo "Installing Oracle Load Test Service..."

# Copy service file
cp oracle-loadtest.service /etc/systemd/system/
systemctl daemon-reload

echo "✓ Service installed"
echo ""
echo "Commands:"
echo "  Start:  sudo systemctl start oracle-loadtest"
echo "  Stop:   sudo systemctl stop oracle-loadtest"
echo "  Status: sudo systemctl status oracle-loadtest"
echo "  Logs:   sudo journalctl -u oracle-loadtest -f"
echo ""
echo "To start on boot: sudo systemctl enable oracle-loadtest"
