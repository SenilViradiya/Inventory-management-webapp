#!/bin/bash

echo "🚀 Inventory Management System Startup"
echo "======================================"

# Check if HTTPS is requested
if [ "$1" = "https" ]; then
    echo "🔒 Starting with HTTPS support..."
    echo ""
    echo "📱 Access URLs:"
    echo "   - Local:   https://localhost:3000"
    echo "   - Network: https://192.168.1.14:3000"
    echo ""
    echo "⚠️  You'll need to accept the self-signed certificate warning in your browser."
    echo ""
    
    # Start backend in background
    cd backend && npm run dev &
    BACKEND_PID=$!
    
    # Wait a moment for backend to start
    sleep 3
    
    # Start frontend with HTTPS
    cd ../frontend && npm run dev:https
    
    # Kill backend when frontend stops
    kill $BACKEND_PID
else
    echo "🌐 Starting with HTTP (localhost camera support only)..."
    echo ""
    echo "📱 Access URLs:"
    echo "   - Local:   http://localhost:3001"
    echo "   - Network: http://192.168.1.14:3001"
    echo ""
    echo "📝 Note: Camera requires HTTPS for network access."
    echo "   Run './start-system.sh https' for camera support on mobile devices."
    echo ""
    
    # Start both services
    npm run dev
fi
