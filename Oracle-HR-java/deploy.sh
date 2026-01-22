#!/bin/bash

# Oracle Java HR Portal - Quick Deployment Script
# This script automates the deployment on Oracle Linux VM

set -e  # Exit on error

echo "=========================================="
echo "Oracle Java HR Portal - Deployment Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if Docker is installed
echo "Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    echo "Run: sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin"
    exit 1
fi
print_success "Docker is installed"

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not available. Please install Docker Compose plugin."
    exit 1
fi
print_success "Docker Compose is available"

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running. Please start Docker."
    echo "Run: sudo systemctl start docker"
    exit 1
fi
print_success "Docker daemon is running"

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found!"
    print_info "Please create .env file with your Oracle database credentials."
    print_info "You can copy from .env.example: cp .env.example .env"
    exit 1
fi
print_success ".env file found"

# Parse command line arguments
ACTION=${1:-up}

case $ACTION in
    up|start)
        echo ""
        echo "Starting Oracle Java HR Portal..."
        echo "Building and starting containers..."
        docker compose up --build -d

        echo ""
        print_success "Application started successfully!"
        echo ""
        print_info "Waiting for application to be healthy..."
        sleep 10

        # Check health
        if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
            print_success "Application is healthy!"
            echo ""
            echo "Application URL: http://localhost:3000"
            echo "Health Check: http://localhost:3000/health"
            echo ""
            echo "View logs with: docker compose logs -f"
            echo "Stop with: ./deploy.sh stop"
        else
            print_warning "Application may still be starting up. Check logs with: docker compose logs -f"
        fi
        ;;

    stop)
        echo ""
        echo "Stopping Oracle Java HR Portal..."
        docker compose stop
        print_success "Application stopped"
        ;;

    down)
        echo ""
        echo "Stopping and removing Oracle Java HR Portal..."
        docker compose down
        print_success "Application stopped and removed"
        ;;

    restart)
        echo ""
        echo "Restarting Oracle Java HR Portal..."
        docker compose restart
        print_success "Application restarted"
        echo ""
        print_info "Check health with: curl http://localhost:3000/health"
        ;;

    logs)
        echo ""
        echo "Showing application logs (Ctrl+C to exit)..."
        docker compose logs -f oracle-test-app
        ;;

    status)
        echo ""
        echo "Application Status:"
        docker compose ps
        echo ""
        echo "Health Check:"
        if curl -sf http://localhost:3000/health; then
            echo ""
            print_success "Application is healthy!"
        else
            echo ""
            print_error "Application is not responding"
        fi
        ;;

    rebuild)
        echo ""
        echo "Rebuilding Oracle Java HR Portal from scratch..."
        docker compose down
        docker compose build --no-cache
        docker compose up -d
        print_success "Application rebuilt and started"
        ;;

    clean)
        echo ""
        print_warning "This will remove all containers, images, and volumes!"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker compose down -v
            docker rmi $(docker images | grep oracle-java | awk '{print $3}') 2>/dev/null || true
            print_success "Cleanup completed"
        else
            print_info "Cleanup cancelled"
        fi
        ;;

    test)
        echo ""
        echo "Running API tests..."
        echo ""

        # Health check
        echo -n "Testing /health endpoint... "
        if curl -sf http://localhost:3000/health > /dev/null; then
            print_success "OK"
        else
            print_error "FAILED"
        fi

        # Pool stats
        echo -n "Testing /pool-stats endpoint... "
        if curl -sf http://localhost:3000/pool-stats > /dev/null; then
            print_success "OK"
        else
            print_error "FAILED"
        fi

        # Employees
        echo -n "Testing /employees endpoint... "
        if curl -sf http://localhost:3000/employees > /dev/null; then
            print_success "OK"
        else
            print_error "FAILED"
        fi

        # Departments
        echo -n "Testing /departments endpoint... "
        if curl -sf http://localhost:3000/departments > /dev/null; then
            print_success "OK"
        else
            print_error "FAILED"
        fi

        # Jobs
        echo -n "Testing /jobs endpoint... "
        if curl -sf http://localhost:3000/jobs > /dev/null; then
            print_success "OK"
        else
            print_error "FAILED"
        fi

        echo ""
        print_success "API tests completed"
        ;;

    k6)
        echo ""
        echo "Running k6 load test..."
        docker run --rm -i --network oracle-java_oracle-network \
          -v $(pwd)/k6/scripts:/scripts \
          -e BASE_URL=http://oracle-test-app:3000 \
          grafana/k6 run /scripts/load-test.js
        ;;

    help|*)
        echo ""
        echo "Usage: ./deploy.sh [command]"
        echo ""
        echo "Commands:"
        echo "  up, start    - Build and start the application (default)"
        echo "  stop         - Stop the application"
        echo "  down         - Stop and remove containers"
        echo "  restart      - Restart the application"
        echo "  logs         - Show application logs"
        echo "  status       - Show application status and health"
        echo "  rebuild      - Rebuild from scratch"
        echo "  clean        - Remove all containers, images, and volumes"
        echo "  test         - Run API endpoint tests"
        echo "  k6           - Run k6 load test"
        echo "  help         - Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./deploy.sh up       # Start the application"
        echo "  ./deploy.sh logs     # View logs"
        echo "  ./deploy.sh status   # Check status"
        echo "  ./deploy.sh test     # Test endpoints"
        ;;
esac

echo ""
