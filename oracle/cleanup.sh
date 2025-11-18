#!/bin/bash

echo "🧹 Cleaning up Oracle Test App containers and resources..."

# Stop and remove containers
docker-compose down

# Remove stopped containers
docker-compose rm -f

# Remove dangling images
echo "Removing dangling images..."
docker image prune -f

# Remove volumes (optional - uncomment if needed)
# docker volume prune -f

echo "✅ Cleanup complete!"
