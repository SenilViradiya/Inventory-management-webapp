const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

// Test data
const testUser = {
  username: 'testuser',
  email: 'admin@offlicense.com',
  password: 'admin123',
  fullName: 'Test User'
};

const testProduct = {
  name: 'Test Product',
  description: 'A test product for API testing',
  price: 99.99,
  quantity: 50,
  category: 'Electronics',
  lowStockThreshold: 10
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
  console.log('\n👤 Testing User Registration...');
  try {
    const response = await axios.post(`${BASE_URL}/users/signup`, testUser);
    console.log('✅ User registration successful:', response.data);
    return true;
  } catch (error) {
    console.log('❌ User registration failed:', error.response?.data || error.message);
    return false;
  }
}

async function testUserLogin() {
  console.log('\n🔐 Testing User Login...');
  try {
    const response = await axios.post(`${BASE_URL}/users/login`, {
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

async function testCreateProduct() {
  console.log('\n📦 Testing Create Product...');
  try {
    const response = await authenticatedRequest('post', '/products', testProduct);
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
    const response = await authenticatedRequest('get', '/products');
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

async function testUpdateProduct() {
  console.log('\n✏️ Testing Update Product...');
  try {
    const updateData = {
      name: 'Updated Test Product',
      price: 149.99,
      quantity: 75
    };
    
    const response = await authenticatedRequest('put', `/products/${productId}`, updateData);
    console.log('✅ Product update successful:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Product update failed:', error.response?.data || error.message);
    return false;
  }
}

async function testGetAlerts() {
  console.log('\n🚨 Testing Alerts...');
  try {
    const response = await authenticatedRequest('get', '/alerts/summary');
    console.log('✅ Alerts summary successful:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Alerts failed:', error.response?.data || error.message);
    return false;
  }
}

async function testAnalytics() {
  console.log('\n📊 Testing Analytics...');
  try {
    const response = await authenticatedRequest('get', '/analytics/dashboard');
    console.log('✅ Analytics successful:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Analytics failed:', error.response?.data || error.message);
    return false;
  }
}

async function testRoles() {
  console.log('\n👥 Testing Roles...');
  try {
    const response = await authenticatedRequest('get', '/roles');
    console.log('✅ Roles retrieval successful:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Roles failed:', error.response?.data || error.message);
    return false;
  }
}

async function testCategories() {
  console.log('\n📂 Testing Categories...');
  try {
    const response = await authenticatedRequest('get', '/categories');
    console.log('✅ Categories retrieval successful:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Categories failed:', error.response?.data || error.message);
    return false;
  }
}

async function testDeleteProduct() {
  console.log('\n🗑️ Testing Delete Product...');
  try {
    const response = await authenticatedRequest('delete', `/products/${productId}`);
    console.log('✅ Product deletion successful:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Product deletion failed:', error.response?.data || error.message);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Backend API Tests...');
  console.log('===================================');
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'User Registration', fn: testUserRegistration },
    { name: 'User Login', fn: testUserLogin },
    { name: 'Create Product', fn: testCreateProduct },
    { name: 'Get Products', fn: testGetProducts },
    { name: 'Update Product', fn: testUpdateProduct },
    { name: 'Get Alerts', fn: testGetAlerts },
    { name: 'Analytics', fn: testAnalytics },
    { name: 'Roles', fn: testRoles },
    { name: 'Categories', fn: testCategories },
    { name: 'Delete Product', fn: testDeleteProduct }
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
  
  console.log('\n===================================');
  console.log('📊 Test Results Summary:');
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📊 Total: ${passedTests + failedTests}`);
  console.log('===================================');
  
  if (failedTests === 0) {
    console.log('🎉 All tests passed! Backend is working correctly.');
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
    await runAllTests();
  }
}

main().catch(console.error);
