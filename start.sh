#!/bin/bash

# Inventory Management System - Startup Script
echo "🚀 Starting Inventory Management System..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB doesn't appear to be running."
    echo "   Please start MongoDB before running the application."
    echo "   You can start it with: brew services start mongodb-community"
    echo ""
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    jobs -p | xargs -r kill
    exit 0
}

# Set up cleanup trap
trap cleanup INT TERM

echo "📦 Starting Backend Server (Port 5001)..."
echo "🌐 Starting Frontend Server (Port 3000)..."
echo ""
echo "Backend logs: logs/backend.log"
echo "Frontend logs: logs/frontend.log"
echo ""
echo "🔗 Application URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:5001/api"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "================================="

# Start backend and frontend concurrently
npm run dev

# Keep the script running
wait
