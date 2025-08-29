const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

// Test data
const testUser = {
  username: 'simpleuser',
  email: 'simple@example.com',
  password: 'testpassword123',
  fullName: 'Simple Test User'
};

const testProduct = {
  name: 'Simple Test Product',
  description: 'A simple test product for API testing',
  price: 99.99,
  quantity: 50,
  category: 'Electronics',
  lowStockThreshold: 10,
  qrCode: 'TEST-SIMPLE-' + Date.now(),
  expirationDate: '2025-12-31'
};

let authToken = '';
let userId = '';
let productId = '';

// Helper function to make authenticated requests
const authenticatedRequest = (method, url, data = null) => {
  const config = {
    method,
    url: `${BASE_URL}${url}`,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    config.data = data;
  }
  
  return axios(config);
};

// Test functions
async function testHealthCheck() {
  console.log('\n🏥 Testing Health Check...');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return false;
  }
}

async function testUserRegistration() {
  console.log('\n👤 Testing Simple User Registration...');
  try {
    const response = await axios.post(`${BASE_URL}/simple-users/register`, testUser);
    authToken = response.data.token;
    userId = response.data.user.id;
    console.log('✅ User registration successful:', {
      token: authToken.substring(0, 20) + '...',
      user: response.data.user
    });
    return true;
  } catch (error) {
    console.log('❌ User registration failed:', error.response?.data || error.message);
    return false;
  }
}

async function testUserLogin() {
  console.log('\n🔐 Testing Simple User Login...');
  try {
    const response = await axios.post(`${BASE_URL}/simple-users/login`, {
      email: testUser.email,
      password: testUser.password
    });
    
    authToken = response.data.token;
    userId = response.data.user.id;
    console.log('✅ User login successful:', {
      token: authToken.substring(0, 20) + '...',
      user: response.data.user
    });
    return true;
  } catch (error) {
    console.log('❌ User login failed:', error.response?.data || error.message);
    return false;
  }
}

async function testUserProfile() {
  console.log('\n👤 Testing User Profile...');
  try {
    const response = await authenticatedRequest('get', '/simple-users/profile');
    console.log('✅ Profile retrieval successful:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Profile retrieval failed:', error.response?.data || error.message);
    return false;
  }
}

async function testCreateProduct() {
  console.log('\n📦 Testing Create Product...');
  try {
    const response = await authenticatedRequest('post', '/simple-products', testProduct);
    productId = response.data.product._id;
    console.log('✅ Product creation successful:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Product creation failed:', error.response?.data || error.message);
    return false;
  }
}

async function testGetProducts() {
  console.log('\n📋 Testing Get Products...');
  try {
    const response = await authenticatedRequest('get', '/simple-products');
    console.log('✅ Get products successful:', {
      count: response.data.products?.length || 0,
      products: response.data.products?.slice(0, 2) || []
    });
    return true;
  } catch (error) {
    console.log('❌ Get products failed:', error.response?.data || error.message);
    return false;
  }
}

async function testGetAlerts() {
  console.log('\n🚨 Testing Simple Alerts...');
  try {
    const response = await authenticatedRequest('get', '/simple-alerts/summary');
    console.log('✅ Simple alerts summary successful:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Simple alerts failed:', error.response?.data || error.message);
    return false;
  }
}

async function testAnalytics() {
  console.log('\n📊 Testing Simple Analytics...');
  try {
    const response = await authenticatedRequest('get', '/simple-analytics/dashboard');
    console.log('✅ Simple analytics successful:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Simple analytics failed:', error.response?.data || error.message);
    return false;
  }
}

// Clean up function to remove test user
async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  try {
    // Delete test product if created
    if (productId) {
      await authenticatedRequest('delete', `/simple-products/${productId}`);
    }
    
    console.log('✅ Test data cleaned up');
    return true;
  } catch (error) {
    console.log('❌ Cleanup failed:', error.response?.data || error.message);
    return false;
  }
}

// Main test runner
async function runSimpleTests() {
  console.log('🚀 Starting Simple Backend API Tests...');
  console.log('=========================================');
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Simple User Login', fn: testUserLogin },
    { name: 'User Profile', fn: testUserProfile },
    { name: 'Create Product', fn: testCreateProduct },
    { name: 'Get Products', fn: testGetProducts },
    { name: 'Get Simple Alerts', fn: testGetAlerts },
    { name: 'Simple Analytics', fn: testAnalytics },
    { name: 'Cleanup', fn: cleanupTestData }
  ];
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passedTests++;
      } else {
        failedTests++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} failed with error:`, error.message);
      failedTests++;
    }
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n=========================================');
  console.log('📊 Simple Test Results Summary:');
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📊 Total: ${passedTests + failedTests}`);
  console.log('=========================================');
  
  if (failedTests === 0) {
    console.log('🎉 All tests passed! Basic backend is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.');
  }
}

// Check if server is running first
async function checkServerStatus() {
  try {
    await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running at', BASE_URL);
    return true;
  } catch (error) {
    console.log('❌ Server is not running. Please start the backend server first.');
    console.log('   Run: npm run dev (in the backend directory)');
    return false;
  }
}

// Run tests
async function main() {
  const serverRunning = await checkServerStatus();
  if (serverRunning) {
    await runSimpleTests();
  }
}

main().catch(console.error);
