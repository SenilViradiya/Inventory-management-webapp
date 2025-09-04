const { createReadStream } = require('fs');
const axios = require('axios');

// Test the PDF export functionality
async function testPDFExport() {
  try {
    console.log('Testing PDF export...');
    
    // Test with a category that should have products
    const response = await axios({
      method: 'GET',
      url: 'http://localhost:5001/api/categories/stock-summary',
      params: {
        categoryName: 'Juices',
        format: 'pdf'
      },
      headers: {
        'Authorization': 'Bearer test-token', // You'll need to replace with actual token
        'Content-Type': 'application/json'
      },
      responseType: 'stream'
    });

    console.log('PDF export response received');
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Content-Disposition:', response.headers['content-disposition']);
    
    // Save the PDF file
    const fs = require('fs');
    const writer = fs.createWriteStream('test_stock_summary.pdf');
    response.data.pipe(writer);
    
    writer.on('finish', () => {
      console.log('PDF file saved as test_stock_summary.pdf');
    });

    writer.on('error', (err) => {
      console.error('Error saving PDF:', err);
    });

  } catch (error) {
    if (error.response) {
      console.error('HTTP Error:', error.response.status);
      console.error('Error message:', error.response.data);
    } else {
      console.error('Request failed:', error.message);
    }
  }
}

// Only run if server is available
console.log('Note: Make sure the backend server is running on localhost:5001');
console.log('You may need to update the Authorization token in this script');

// Uncomment the line below to test (after updating the auth token)
// testPDFExport();

console.log('Test script ready. Update the auth token and uncomment testPDFExport() to run.');
