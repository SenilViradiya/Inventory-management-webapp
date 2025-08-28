#!/bin/bash

# Inventory Management System - Tunnel Setup Script
echo "🚀 Setting up tunnels for Inventory Management System..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to cleanup background processes
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    pkill -f "npm run dev"
    pkill -f "lt --port"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start the application servers
echo -e "${BLUE}Starting backend and frontend servers...${NC}"
cd "$(dirname "$0")"
npm run dev &
SERVER_PID=$!

# Wait for servers to start
echo -e "${YELLOW}Waiting for servers to start...${NC}"
sleep 10

# Check if servers are running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo -e "${RED}Frontend server failed to start${NC}"
    exit 1
fi

if ! curl -s http://localhost:5001/api/products > /dev/null 2>&1; then
    echo -e "${YELLOW}Backend server starting... (MongoDB connection may take time)${NC}"
fi

# Create unique subdomain names
TIMESTAMP=$(date +%s)
BACKEND_SUBDOMAIN="inventory-backend-${TIMESTAMP}"
FRONTEND_SUBDOMAIN="inventory-frontend-${TIMESTAMP}"

# Start backend tunnel
echo -e "${BLUE}Creating backend tunnel...${NC}"
lt --port 5001 --subdomain $BACKEND_SUBDOMAIN > /tmp/backend-tunnel.log 2>&1 &
BACKEND_TUNNEL_PID=$!

# Start frontend tunnel
echo -e "${BLUE}Creating frontend tunnel...${NC}"
lt --port 3000 --subdomain $FRONTEND_SUBDOMAIN > /tmp/frontend-tunnel.log 2>&1 &
FRONTEND_TUNNEL_PID=$!

# Wait for tunnels to be established
sleep 5

# Extract URLs from tunnel logs
BACKEND_URL=$(grep -o 'https://[^[:space:]]*' /tmp/backend-tunnel.log | head -1)
FRONTEND_URL=$(grep -o 'https://[^[:space:]]*' /tmp/frontend-tunnel.log | head -1)

# Update frontend environment
if [ ! -z "$BACKEND_URL" ]; then
    echo "NEXT_PUBLIC_API_URL=${BACKEND_URL}/api" > frontend/.env.local
    echo -e "${GREEN}Updated frontend API URL to: ${BACKEND_URL}/api${NC}"
fi

# Display tunnel information
echo -e "\n${GREEN}🎉 Tunnels are now active!${NC}"
echo -e "${GREEN}=================================${NC}"
echo -e "${BLUE}Backend API:${NC} ${BACKEND_URL}/api"
echo -e "${BLUE}Frontend App:${NC} ${FRONTEND_URL}"
echo -e "${GREEN}=================================${NC}"
echo -e "\n${YELLOW}Share these URLs with your peers:${NC}"
echo -e "📱 Main Application: ${FRONTEND_URL}"
echo -e "🔧 API Endpoint: ${BACKEND_URL}/api"
echo -e "\n${YELLOW}Test the connection:${NC}"
echo -e "curl ${BACKEND_URL}/api/products"
echo -e "\n${RED}Press Ctrl+C to stop all services${NC}"

# Keep the script running
wait
