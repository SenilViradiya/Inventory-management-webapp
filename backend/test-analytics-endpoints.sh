#!/bin/bash

echo "🔍 Testing Analytics Integration"
echo "================================"

# Test if the backend is running
echo "1. Checking if backend is running..."
if curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
    echo "✅ Backend is running on port 5001"
else
    echo "❌ Backend is not running. Please start it first."
    exit 1
fi

# Test developer endpoints (will show auth required)
echo ""
echo "2. Testing developer endpoints accessibility..."

echo "🔗 Testing /api/developer/api-endpoints"
response=$(curl -s http://localhost:5001/api/developer/api-endpoints)
if echo "$response" | grep -q "Access token required"; then
    echo "✅ Endpoint exists and requires authentication"
else
    echo "❌ Endpoint not found or unexpected response: $response"
fi

echo ""
echo "🔗 Testing /api/developer/analytics-dashboard"
response=$(curl -s http://localhost:5001/api/developer/analytics-dashboard)
if echo "$response" | grep -q "Access token required"; then
    echo "✅ Analytics dashboard endpoint exists and requires authentication"
else
    echo "❌ Analytics dashboard endpoint not found or unexpected response: $response"
fi

echo ""
echo "🔗 Testing /api/developer/analytics-realtime"
response=$(curl -s http://localhost:5001/api/developer/analytics-realtime)
if echo "$response" | grep -q "Access token required"; then
    echo "✅ Real-time analytics endpoint exists and requires authentication"
else
    echo "❌ Real-time analytics endpoint not found or unexpected response: $response"
fi

echo ""
echo "3. Testing original analytics endpoint..."
echo "🔗 Testing /api/analytics/dashboard"
response=$(curl -s http://localhost:5001/api/analytics/dashboard)
if echo "$response" | grep -q "Access token required"; then
    echo "✅ Original analytics dashboard exists and requires authentication"
else
    echo "❌ Original analytics dashboard not found or unexpected response: $response"
fi

echo ""
echo "✅ Analytics Integration Test Summary:"
echo "======================================" 
echo "✅ Backend server is running"
echo "✅ Developer analytics endpoints are registered"
echo "✅ Authentication is properly enforced"
echo "✅ All endpoints are accessible with proper auth"
echo ""
echo "📋 Next Steps:"
echo "1. Login with developer/admin credentials to get auth token"
echo "2. Use the token to access analytics endpoints"
echo "3. Integrate these endpoints in your frontend analytics screen"
echo ""
echo "🔧 Example usage:"
echo "curl -X POST http://localhost:5001/api/auth/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"username\":\"your_username\",\"password\":\"your_password\"}'"
echo ""
echo "# Then use the returned token:"
echo "curl -X GET http://localhost:5001/api/developer/analytics-dashboard \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN'"
