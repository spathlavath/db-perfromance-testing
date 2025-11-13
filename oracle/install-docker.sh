#!/bin/bash

# Simple Docker Installation Script for Oracle VM
# Run this script on the Oracle VM itself
# Usage: chmod +x install-docker.sh && sudo ./install-docker.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Docker Installation for Oracle VM              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run with sudo: sudo ./install-docker.sh${NC}"
    exit 1
fi

CURRENT_USER="${SUDO_USER:-$USER}"
echo -e "${BLUE}Installing Docker for user:${NC} ${CURRENT_USER}"
echo ""

# Step 1: Install Docker Engine
echo -e "${YELLOW}[1/5] Installing Docker Engine...${NC}"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✓ Docker is already installed: ${DOCKER_VERSION}${NC}"
else
    echo "Installing Docker..."
    yum install -y yum-utils
    yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    yum install -y docker-ce docker-ce-cli containerd.io
    echo -e "${GREEN}✓ Docker Engine installed${NC}"
fi
echo ""

# Step 2: Install Docker Compose
echo -e "${YELLOW}[2/5] Installing Docker Compose...${NC}"
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo -e "${GREEN}✓ Docker Compose is already installed: ${COMPOSE_VERSION}${NC}"
else
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    COMPOSE_VERSION=$(docker-compose --version)
    echo -e "${GREEN}✓ Docker Compose installed: ${COMPOSE_VERSION}${NC}"
fi
echo ""

# Step 3: Add user to docker group
echo -e "${YELLOW}[3/5] Adding user to docker group...${NC}"
if groups ${CURRENT_USER} | grep -q docker; then
    echo -e "${GREEN}✓ User ${CURRENT_USER} is already in docker group${NC}"
else
    usermod -aG docker ${CURRENT_USER}
    echo -e "${GREEN}✓ User ${CURRENT_USER} added to docker group${NC}"
    echo -e "${YELLOW}⚠️  You need to log out and back in for group changes to take effect${NC}"
fi
echo ""

# Step 4: Configure firewall for port 3000
echo -e "${YELLOW}[4/5] Configuring firewall...${NC}"
if systemctl is-active --quiet firewalld; then
    firewall-cmd --permanent --add-port=3000/tcp
    firewall-cmd --reload
    echo -e "${GREEN}✓ Firewall configured to allow port 3000${NC}"
else
    echo -e "${YELLOW}⚠️  Firewall not active${NC}"
fi
echo ""

# Step 5: Start and enable Docker service
echo -e "${YELLOW}[5/5] Starting Docker service...${NC}"
systemctl start docker
systemctl enable docker
if systemctl is-active --quiet docker; then
    echo -e "${GREEN}✓ Docker service started and enabled${NC}"
else
    echo -e "${RED}✗ Failed to start Docker service${NC}"
    exit 1
fi
echo ""

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Docker Installation Complete!               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo -e "${BLUE}1. Log out and back in to activate docker group:${NC}"
echo -e "   ${GREEN}exit${NC}"
echo -e "   ${GREEN}ssh -A -i ./Downloads/ssh-key-2025-11-03.key opc@150.136.71.213${NC}"
echo ""
echo -e "${BLUE}2. Or activate docker group in current session:${NC}"
echo -e "   ${GREEN}newgrp docker${NC}"
echo ""
echo -e "${BLUE}3. Navigate to application directory:${NC}"
echo -e "   ${GREEN}cd db-perfromance-testing/oracle${NC}"
echo ""
echo -e "${BLUE}4. Start the application:${NC}"
echo -e "   ${GREEN}docker-compose up --build${NC}"
echo ""
echo -e "${BLUE}5. Verify installation:${NC}"
echo -e "   ${GREEN}docker --version${NC}"
echo -e "   ${GREEN}docker-compose --version${NC}"
echo -e "   ${GREEN}docker ps${NC}"
echo ""
echo -e "${GREEN}Happy Testing! 🚀${NC}"
