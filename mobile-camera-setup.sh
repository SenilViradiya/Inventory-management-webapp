#!/bin/bash

echo "🔧 Mobile Camera Access Setup for Inventory Management System"
echo "============================================================"
echo ""

# Get local IP address
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

echo "📱 Your current network setup:"
echo "   Local Frontend: http://localhost:3001"
echo "   Local Backend:  http://localhost:5001"
echo "   Network IP:     $LOCAL_IP"
echo ""

echo "🌐 For MOBILE ACCESS (required for camera), choose one option:"
echo ""
echo "Option 1 - Using ngrok (Recommended):"
echo "   1. Install ngrok: brew install ngrok (Mac) or download from ngrok.com"
echo "   2. Run: ngrok http 3001"
echo "   3. Use the HTTPS URL provided (e.g., https://abc123.ngrok.io)"
echo ""
echo "Option 2 - Local Network HTTPS:"
echo "   1. Install mkcert: brew install mkcert (Mac)"
echo "   2. Run: mkcert -install"
echo "   3. Run: mkcert localhost $LOCAL_IP"
echo "   4. Configure Next.js with SSL certificates"
echo ""
echo "Option 3 - Alternative Methods:"
echo "   • Use 'Upload Image' button instead of camera"
echo "   • Take photo with phone camera, then upload the image"
echo "   • Use manual barcode entry"
echo ""

echo "🚨 Common Mobile Issues:"
echo "   ❌ HTTP sites can't access camera on mobile"
echo "   ❌ Chrome requires HTTPS for getUserMedia() on mobile"
echo "   ❌ Safari needs user interaction before camera access"
echo "   ✅ File upload works without HTTPS"
echo ""

echo "📋 Testing Steps:"
echo "   1. Open scanner page on mobile via HTTPS URL"
echo "   2. Check browser debug console for errors"
echo "   3. Allow camera permissions when prompted"
echo "   4. Look for debug logs in the scanner console"
echo ""

# Check if ngrok is installed
if command -v ngrok &> /dev/null; then
    echo "✅ ngrok is available - you can run 'ngrok http 3001' now"
else
    echo "⚠️  ngrok not found - install with 'brew install ngrok'"
fi

echo ""
echo "🔍 Debug your mobile access at: https://your-ngrok-url.ngrok.io/scanner"
echo "   The scanner page has a debug console that shows detailed camera errors"
