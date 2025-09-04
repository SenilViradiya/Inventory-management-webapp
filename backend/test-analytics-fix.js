const fetch = require('node-fetch');

async function testAnalytics() {
  try {
    // Test the dashboard endpoint that was returning empty data
    console.log('=== Testing Dashboard Analytics ===');
    const dashboardResponse = await fetch('http://localhost:5001/api/analytics/dashboard', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY2Yzk1NmIzYjA5YjhhMzE0YzliYTFhNyIsInVzZXJuYW1lIjoidXRzYXYiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MjU0NTM0MjcsImV4cCI6MTcyNTQ1NzAyN30.i1j7S6_HPYJ6GQqgJ4YjGgKs3PGNdvS3mHVlT7qF7tc', // Replace with your actual token
        'Content-Type': 'application/json'
      }
    });

    if (dashboardResponse.ok) {
      const dashboardData = await dashboardResponse.json();
      console.log('Dashboard Data:', JSON.stringify(dashboardData, null, 2));
    } else {
      console.error('Dashboard request failed:', dashboardResponse.status, await dashboardResponse.text());
    }

    console.log('\n=== Testing Detail Analytics ===');
    // Test the detail endpoint with corrected logic
    const detailResponse = await fetch('http://localhost:5001/api/analytics/detail', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY2Yzk1NmIzYjA5YjhhMzE0YzliYTFhNyIsInVzZXJuYW1lIjoidXRzYXYiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MjU0NTM0MjcsImV4cCI6MTcyNTQ1NzAyN30.i1j7S6_HPYJ6GQqgJ4YjGgKs3PGNdvS3mHVlT7qF7tc', // Replace with your actual token
        'Content-Type': 'application/json'
      }
    });

    if (detailResponse.ok) {
      const detailData = await detailResponse.json();
      console.log('Detail Data:', JSON.stringify(detailData, null, 2));
    } else {
      console.error('Detail request failed:', detailResponse.status, await detailResponse.text());
    }

  } catch (error) {
    console.error('Error testing analytics:', error);
  }
}

testAnalytics();
