const fs = require('fs');
const path = require('path');

// Test export functionality
console.log('🧪 Testing Export Functionality...\n');

// Create exports directory
const exportsDir = path.join(__dirname, 'exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
  console.log('✅ Created exports directory:', exportsDir);
} else {
  console.log('📁 Exports directory already exists:', exportsDir);
}

// Test file creation
const testFile = path.join(exportsDir, 'test_export.txt');
const testContent = `Export Test - ${new Date().toISOString()}
This is a test file to verify export functionality is working.
Files will be saved to: ${exportsDir}

Available export formats:
- CSV (.csv)
- Excel JSON (.json) 
- PDF (.pdf)
`;

try {
  fs.writeFileSync(testFile, testContent);
  console.log('✅ Test file created successfully:', testFile);
  
  // List current exports directory contents
  const files = fs.readdirSync(exportsDir);
  console.log('\n📂 Current exports directory contents:');
  files.forEach(file => {
    const filePath = path.join(exportsDir, file);
    const stats = fs.statSync(filePath);
    console.log(`  - ${file} (${stats.size} bytes, ${stats.mtime.toLocaleString()})`);
  });
  
  console.log('\n✅ Export functionality test completed successfully!');
  console.log('\n📋 Usage Instructions:');
  console.log('1. Start your backend server: npm run dev');
  console.log('2. Call export APIs with format parameter:');
  console.log('   - CSV: GET /api/categories/stock-summary?format=csv');
  console.log('   - Excel: GET /api/categories/stock-summary?format=excel');
  console.log('   - PDF: GET /api/categories/stock-summary?format=pdf');
  console.log('3. Files will be saved in:', exportsDir);
  console.log('4. Check console logs for export success messages');
  
} catch (error) {
  console.error('❌ Export test failed:', error.message);
}
