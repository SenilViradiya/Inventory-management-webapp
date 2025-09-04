const axios = require('axios');

const baseURL = 'http://localhost:5001/api';

async function testCategoryInventoryAPI() {
  try {
    console.log('🔐 Logging in...');
    
    // Login to get token
    const loginResponse = await axios.post(`${baseURL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    console.log('\n📊 Testing Category Inventory Overview API...');
    
    // Test 1: Get all categories inventory overview
    console.log('\n1. Getting all categories inventory overview:');
    const allCategoriesResponse = await axios.get(`${baseURL}/categories/inventory-overview`, { headers });
    console.log('✅ Success:', JSON.stringify(allCategoriesResponse.data, null, 2));
    
    // Test 2: Get specific category inventory overview (if categories exist)
    if (allCategoriesResponse.data.categories && allCategoriesResponse.data.categories.length > 0) {
      const firstCategory = allCategoriesResponse.data.categories[0];
      console.log(`\n2. Getting specific category inventory overview for: ${firstCategory.category.name}`);
      
      const specificCategoryResponse = await axios.get(
        `${baseURL}/categories/inventory-overview?categoryId=${firstCategory.category.id}`,
        { headers }
      );
      console.log('✅ Success:', JSON.stringify(specificCategoryResponse.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testCategoryInventoryAPI();
