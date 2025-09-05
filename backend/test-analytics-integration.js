const axios = require('axios');

// Test the analytics integration in developer endpoints
async function testAnalyticsIntegration() {
  const baseURL = 'http://localhost:5001/api';
  
  // Test credentials (you'll need to use your actual developer credentials)
  const testAuth = {
    username: 'developer', // or your admin username
    password: 'password'   // your actual password
  };

  try {
    console.log('🔐 Testing Analytics Integration...\n');

    // Step 1: Login to get token
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${baseURL}/auth/login`, testAuth);
    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    const headers = { Authorization: `Bearer ${token}` };

    // Step 2: Test analytics dashboard endpoint
    console.log('\n2. Testing Analytics Dashboard...');
    try {
      const analyticsResponse = await axios.get(`${baseURL}/developer/analytics-dashboard`, { headers });
      const analytics = analyticsResponse.data;
      
      console.log('✅ Analytics Dashboard working');
      console.log('📊 Today Metrics:');
      console.log(`   - Sales: $${analytics.data.todayMetrics.sales.toFixed(2)}`);
      console.log(`   - Items Sold: ${analytics.data.todayMetrics.itemsSold}`);
      console.log(`   - Transactions: ${analytics.data.todayMetrics.transactions}`);
      
      console.log('📦 Stock Overview:');
      console.log(`   - Total Products: ${analytics.data.stockOverview.totalProducts}`);
      console.log(`   - Low Stock: ${analytics.data.stockOverview.lowStockProducts}`);
      console.log(`   - Out of Stock: ${analytics.data.stockOverview.outOfStockProducts}`);
      
      console.log('🏪 Batch Overview:');
      console.log(`   - Total Batches: ${analytics.data.batchOverview.totalBatches}`);
      console.log(`   - Expiring Batches: ${analytics.data.batchOverview.expiringBatches}`);
    } catch (error) {
      console.log('❌ Analytics Dashboard failed:', error.response?.data?.message || error.message);
    }

    // Step 3: Test real-time analytics
    console.log('\n3. Testing Real-time Analytics...');
    try {
      const realtimeResponse = await axios.get(`${baseURL}/developer/analytics-realtime`, { headers });
      const realtime = realtimeResponse.data;
      
      console.log('✅ Real-time Analytics working');
      console.log('🕐 Summary:');
      console.log(`   - Movements (last hour): ${realtime.data.summary.totalMovementsLastHour}`);
      console.log(`   - Sales (24h): $${realtime.data.summary.totalSalesLast24h.toFixed(2)}`);
      console.log(`   - Low Stock Alerts: ${realtime.data.summary.lowStockCount}`);
      console.log(`   - Critical Alerts: ${realtime.data.summary.criticalStockCount}`);
    } catch (error) {
      console.log('❌ Real-time Analytics failed:', error.response?.data?.message || error.message);
    }

    // Step 4: Test API endpoints listing
    console.log('\n4. Testing API Endpoints List...');
    try {
      const endpointsResponse = await axios.get(`${baseURL}/developer/api-endpoints`, { headers });
      const endpoints = endpointsResponse.data;
      
      console.log('✅ API Endpoints list working');
      console.log(`📋 Total Endpoints: ${endpoints.data.totalEndpoints}`);
      console.log(`📂 Categories: ${endpoints.data.categories.join(', ')}`);
      
      // Show analytics endpoints specifically
      const analyticsEndpoints = endpoints.data.groupedEndpoints.Analytics || [];
      console.log(`📊 Analytics Endpoints: ${analyticsEndpoints.length}`);
      analyticsEndpoints.forEach(ep => {
        console.log(`   - ${ep.method} ${ep.path}: ${ep.description}`);
      });
    } catch (error) {
      console.log('❌ API Endpoints list failed:', error.response?.data?.message || error.message);
    }

    // Step 5: Test original analytics endpoint (for comparison)
    console.log('\n5. Testing Original Analytics Dashboard...');
    try {
      const originalResponse = await axios.get(`${baseURL}/analytics/dashboard`, { headers });
      console.log('✅ Original Analytics Dashboard working');
      console.log('📈 Dashboard data keys:', Object.keys(originalResponse.data));
    } catch (error) {
      console.log('❌ Original Analytics Dashboard failed:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 Analytics Integration Test Complete!');
    console.log('\n📋 Usage Instructions:');
    console.log('1. Use GET /api/developer/analytics-dashboard for comprehensive analytics');
    console.log('2. Use GET /api/developer/analytics-realtime for live data updates');
    console.log('3. Use GET /api/developer/api-endpoints to see all available endpoints');
    console.log('4. All endpoints require developer/superadmin privileges');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
  }
}

// CURL examples for manual testing
console.log('📋 CURL Examples for Testing:\n');

console.log('1. Login and get token:');
console.log(`curl -X POST http://localhost:5001/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"username":"developer","password":"your_password"}'`);

console.log('\n2. Get Analytics Dashboard:');
console.log(`curl -X GET http://localhost:5001/api/developer/analytics-dashboard \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -H "Content-Type: application/json"`);

console.log('\n3. Get Real-time Analytics:');
console.log(`curl -X GET http://localhost:5001/api/developer/analytics-realtime \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -H "Content-Type: application/json"`);

console.log('\n4. Get API Endpoints:');
console.log(`curl -X GET http://localhost:5001/api/developer/api-endpoints \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -H "Content-Type: application/json"`);

console.log('\n🚀 Running automated test...\n');

// Run the test if axios is available
if (typeof require !== 'undefined') {
  testAnalyticsIntegration().catch(console.error);
} else {
  console.log('Run this script with Node.js to execute automated tests');
}
