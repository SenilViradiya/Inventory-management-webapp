const axios = require('axios');

/**
 * Test script for Request/Response Logging Middleware
 * This script makes various API calls to test the logging functionality
 */

const BASE_URL = 'http://localhost:5001';

// Test data
const testData = {
    user: {
        username: 'testuser',
        password: 'testpass123',
        email: 'test@example.com',
        phone: '+1234567890'
    },
    product: {
        name: 'Test Product',
        category: 'Test Category',
        price: 25.99,
        stock: 100
    }
};

async function testLogging() {
    console.log('🚀 Starting Request/Response Logging Tests...\n');

    try {
        // Test 1: GET request with query parameters
        console.log('📝 Test 1: GET request with query parameters');
        await axios.get(`${BASE_URL}/api/categories/stock-summary`, {
            params: {
                categoryName: 'Juices',
                limit: 5
            }
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        // Test 2: POST request with body data (should mask sensitive fields)
        console.log('📝 Test 2: POST request with sensitive data (should be masked)');
        try {
            await axios.post(`${BASE_URL}/api/users/register`, testData.user);
        } catch (error) {
            // Expected to fail, but we want to test logging
            console.log('   (Expected to fail - testing logging only)');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        // Test 3: GET request to test response logging
        console.log('📝 Test 3: GET request to test response logging');
        try {
            await axios.get(`${BASE_URL}/api/analytics/dashboard`);
        } catch (error) {
            console.log('   (May fail if not authenticated - testing logging only)');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        // Test 4: Large payload test (should be truncated)
        console.log('📝 Test 4: Large payload test (should be truncated)');
        const largeData = {
            products: Array(1000).fill(null).map((_, i) => ({
                id: i,
                name: `Product ${i}`,
                description: 'A'.repeat(100), // Large description
                category: `Category ${i % 10}`,
                price: Math.random() * 100
            }))
        };
        
        try {
            await axios.post(`${BASE_URL}/api/products/bulk`, largeData);
        } catch (error) {
            console.log('   (Expected to fail - testing large payload logging)');
        }

        console.log('\n✅ Logging tests completed!');
        console.log('\n📋 Check your console output above to see the logged requests/responses');
        console.log('📋 Log files are saved in the backend/logs directory');
        
    } catch (error) {
        console.error('❌ Error during testing:', error.message);
    }
}

// Configuration test function
function printCurrentConfig() {
    console.log('🔧 Current Logging Configuration:');
    console.log('================================');
    console.log('ENABLE_REQUEST_LOGGING:', process.env.ENABLE_REQUEST_LOGGING);
    console.log('ENABLE_RESPONSE_LOGGING:', process.env.ENABLE_RESPONSE_LOGGING);
    console.log('ENABLE_PAYLOAD_LOGGING:', process.env.ENABLE_PAYLOAD_LOGGING);
    console.log('LOG_REQUEST_HEADERS:', process.env.LOG_REQUEST_HEADERS);
    console.log('LOG_RESPONSE_HEADERS:', process.env.LOG_RESPONSE_HEADERS);
    console.log('LOG_SENSITIVE_DATA:', process.env.LOG_SENSITIVE_DATA);
    console.log('MAX_LOG_SIZE:', process.env.MAX_LOG_SIZE);
    console.log('EXCLUDE_ROUTES:', process.env.EXCLUDE_ROUTES);
    console.log('================================\n');
}

// Run the tests
if (require.main === module) {
    require('dotenv').config();
    printCurrentConfig();
    testLogging();
}

module.exports = { testLogging, printCurrentConfig };
