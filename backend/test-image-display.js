#!/usr/bin/env node

/**
 * Test script to verify image uploads display correctly in browsers
 * Usage: node test-image-browser-display.js
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5001/api';

// Test credentials
const TEST_CREDENTIALS = {
  email: 'developer@admin.com',
  password: 'Dev@123456'
};

async function loginAndGetToken() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${API_BASE}/users/login`, TEST_CREDENTIALS);
    return response.data.token;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data?.message || error.message);
    process.exit(1);
  }
}

function createTestImage() {
  // Create a simple SVG image for testing
  const svgContent = `
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" fill="#4285f4"/>
  <text x="50" y="55" text-anchor="middle" fill="white" font-family="Arial" font-size="14">TEST</text>
  <text x="50" y="75" text-anchor="middle" fill="white" font-family="Arial" font-size="10">${new Date().toLocaleDateString()}</text>
</svg>`.trim();

  const imagePath = path.join(__dirname, 'test-image.svg');
  fs.writeFileSync(imagePath, svgContent);
  console.log(`📄 Created test SVG image: ${imagePath}`);
  return imagePath;
}

function createTestJPG() {
  // Create a simple text file that we'll treat as a fake JPEG (for testing MIME type handling)
  const content = 'This is a fake JPEG file for testing MIME type handling';
  const imagePath = path.join(__dirname, 'test-image.jpg');
  fs.writeFileSync(imagePath, content);
  console.log(`📄 Created test JPG file: ${imagePath}`);
  return imagePath;
}

async function testImageUpload(token, filePath, description) {
  try {
    console.log(`📤 Testing ${description}...`);
    
    const form = new FormData();
    form.append('image', fs.createReadStream(filePath));
    
    const response = await axios.post(`${API_BASE}/upload/product-image`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log(`✅ ${description} upload successful:`);
    console.log('- Image URL:', response.data.imageUrl);
    console.log('- Blob Name:', response.data.blobName);
    
    // Test if the image can be accessed via HTTP GET
    await testImageAccess(response.data.imageUrl);
    
    return response.data;
  } catch (error) {
    console.error(`❌ ${description} upload failed:`, error.response?.data?.message || error.message);
    return null;
  }
}

async function testImageAccess(imageUrl) {
  try {
    console.log('🌐 Testing image accessibility...');
    
    const response = await axios.head(imageUrl);
    
    console.log('✅ Image is accessible:');
    console.log('- Status:', response.status);
    console.log('- Content-Type:', response.headers['content-type']);
    console.log('- Content-Disposition:', response.headers['content-disposition']);
    console.log('- Cache-Control:', response.headers['cache-control']);
    
    // Check if it's set to display inline (not download)
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition && contentDisposition.includes('inline')) {
      console.log('✅ Image will display in browser (inline)');
    } else if (contentDisposition && contentDisposition.includes('attachment')) {
      console.log('⚠️  Image will download instead of display (attachment)');
    } else {
      console.log('ℹ️  No Content-Disposition header (browser will decide)');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Image access test failed:', error.message);
    return false;
  }
}

async function testProductCreationWithImage(token, imagePath) {
  try {
    console.log('📦 Testing product creation with image...');
    
    const form = new FormData();
    form.append('name', 'Test Product with Image');
    form.append('price', '9.99');
    form.append('category', 'test');
    form.append('quantity', '50');
    form.append('qrCode', `TEST-${Date.now()}`);
    form.append('expirationDate', '2025-12-31');
    form.append('shopId', '507f1f77bcf86cd799439011'); // Dummy shop ID
    form.append('image', fs.createReadStream(imagePath));
    
    const response = await axios.post(`${API_BASE}/products`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('✅ Product created with image:');
    console.log('- Product ID:', response.data._id);
    console.log('- Image URL:', response.data.image);
    
    if (response.data.image) {
      await testImageAccess(response.data.image);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Product creation failed:', error.response?.data?.message || error.message);
    return null;
  }
}

async function cleanupFiles(filePaths) {
  for (const filePath of filePaths) {
    try {
      fs.unlinkSync(filePath);
      console.log(`🧹 Cleaned up: ${path.basename(filePath)}`);
    } catch (error) {
      console.warn(`⚠️  Failed to cleanup ${filePath}:`, error.message);
    }
  }
}

async function runImageTests() {
  console.log('🎨 Starting Image Browser Display Tests\n');
  
  const testFiles = [];
  
  try {
    // Login
    const token = await loginAndGetToken();
    
    // Create test files
    const svgPath = createTestImage();
    const jpgPath = createTestJPG();
    testFiles.push(svgPath, jpgPath);
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test SVG upload
    const svgResult = await testImageUpload(token, svgPath, 'SVG image');
    
    console.log('\n' + '-'.repeat(40) + '\n');
    
    // Test JPG upload
    const jpgResult = await testImageUpload(token, jpgPath, 'JPG image');
    
    console.log('\n' + '-'.repeat(40) + '\n');
    
    // Test product creation with image
    await testProductCreationWithImage(token, svgPath);
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Summary
    console.log('📋 Test Summary:');
    console.log('- SVG Upload:', svgResult ? '✅ Success' : '❌ Failed');
    console.log('- JPG Upload:', jpgResult ? '✅ Success' : '❌ Failed');
    
    if (svgResult || jpgResult) {
      console.log('\n💡 To verify browser display:');
      if (svgResult) console.log(`   Open: ${svgResult.imageUrl}`);
      if (jpgResult) console.log(`   Open: ${jpgResult.imageUrl}`);
      console.log('   Images should display directly in browser, not download.');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    // Cleanup
    await cleanupFiles(testFiles);
  }
}

// Run tests
runImageTests().catch(console.error);
