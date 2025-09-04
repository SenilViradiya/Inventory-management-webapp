# 📚 Inventory Management System - Complete API Documentation

## 🚀 Overview

This comprehensive inventory management system provides advanced features for off-license shops including:

- **🏪 Multi-shop Management** - Support for multiple shops with role-based access
- **📦 Batch-level Inventory Tracking** - FEFO (First Expired First Out) algorithm
- **🎯 Dynamic Promotions** - Time-window based pricing with automatic resolution
- **📊 Advanced Analytics** - Real-time reporting with CSV/PDF exports
- **📱 Mobile-First API** - Optimized for mobile app integration
- **🔐 JWT Authentication** - Secure token-based authentication
- **🚨 Smart Alerts** - Expiry warnings and low stock notifications

## 🌐 Environment Setup

### Local Development
```
Base URL: http://localhost:5001/api
Swagger UI: http://localhost:5001/api-docs
```

### Local Network (Mobile Testing)
```
Base URL: http://[YOUR_IP]:5001/api
Example: http://192.168.1.100:5001/api
```

### Production
```
Base URL: https://api.yourdomain.com/api
Swagger UI: https://api.yourdomain.com/api-docs
```

## 🔐 Authentication

All protected endpoints require JWT authentication:

```http
Authorization: Bearer <your-jwt-token>
```

### Login Flow
1. **POST** `/api/users/login` - Get JWT token
2. Include token in `Authorization` header for subsequent requests
3. Token expires after 24 hours (configurable)

### Example Login Request
```bash
curl -X POST http://localhost:5001/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

## 📋 Complete API Endpoints

### 🔐 Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/users/login` | User login | ❌ |
| POST | `/users/register` | Register new user | ✅ (Admin) |
| GET | `/users/me` | Get current user | ✅ |
| PUT | `/users/me` | Update current user | ✅ |
| GET | `/users` | List all users | ✅ (Admin) |

### 📦 Product Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/products` | List products (paginated, searchable) | ✅ |
| POST | `/products` | Create new product | ✅ (Admin) |
| GET | `/products/:id` | Get product by ID | ✅ |
| PUT | `/products/:id` | Update product | ✅ (Admin) |
| DELETE | `/products/:id` | Delete product | ✅ (Admin) |
| GET | `/products/scan/:code` | Scan QR/Barcode | ✅ |
| POST | `/products/:id/image` | Upload product image | ✅ (Admin) |

**Query Parameters for GET /products:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `search` - Search term (name, barcode, qrCode)
- `category` - Filter by category ID
- `minStock` - Filter by minimum stock level

### 📊 Batch Management (FEFO System)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/batches/product/:productId` | Get batches for product | ✅ |
| POST | `/batches` | Create new batch | ✅ (Admin) |
| PUT | `/batches/:id` | Update batch | ✅ (Admin) |
| DELETE | `/batches/:id` | Delete batch | ✅ (Admin) |

**Batch Fields:**
```json
{
  "productId": "ObjectId",
  "supplierId": "ObjectId", 
  "quantity": "Number",
  "purchasePrice": "Number",
  "expiryDate": "Date",
  "batchNumber": "String",
  "status": "active|expired|sold_out",
  "notes": "String"
}
```

### 🎯 Promotion Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/promotions/active` | Get active promotions | ✅ |
| GET | `/promotions` | List all promotions | ✅ (Admin) |
| POST | `/promotions` | Create promotion | ✅ (Admin) |
| PUT | `/promotions/:id` | Update promotion | ✅ (Admin) |
| DELETE | `/promotions/:id` | Delete promotion | ✅ (Admin) |

**Promotion Fields:**
```json
{
  "name": "String",
  "productIds": ["ObjectId"],
  "discountType": "percentage|fixed",
  "discountValue": "Number",
  "startDate": "Date",
  "endDate": "Date",
  "isActive": "Boolean",
  "conditions": {
    "minQuantity": "Number",
    "maxQuantity": "Number"
  }
}
```

### 📈 Stock Management (FEFO Algorithm)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/stock/add` | Add stock (creates/updates batches) | ✅ (Admin) |
| POST | `/stock/reduce` | Process sale (FEFO consumption) | ✅ |
| GET | `/stock/current` | Get current stock levels | ✅ |
| GET | `/stock/low-stock` | Get low stock alerts | ✅ |
| GET | `/stock/movements` | Get stock movement history | ✅ |

**Add Stock Request:**
```json
{
  "productId": "ObjectId",
  "quantity": 50,
  "purchasePrice": 12.50,
  "expiryDate": "2024-12-31T00:00:00.000Z",
  "supplierId": "ObjectId",
  "batchNumber": "BATCH001"
}
```

**Reduce Stock Request (Sale):**
```json
{
  "productId": "ObjectId",
  "quantity": 3,
  "reason": "Customer purchase"
}
```

### 📊 Analytics & Reporting

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/analytics/dashboard` | Dashboard analytics | ✅ |
| GET | `/analytics/detail` | Detailed analytics | ✅ |
| GET | `/analytics/detail/export` | Export analytics (CSV/PDF) | ✅ |
| GET | `/analytics/today-sales` | Today's sales summary | ✅ |
| GET | `/analytics/revenue` | Revenue analytics | ✅ (Admin) |
| GET | `/analytics/profit` | Profit analytics | ✅ (Admin) |

**Dashboard Query Parameters:**
- `period` - Time period (today, 7days, 30days, 90days)
- `shopId` - Filter by shop (optional)

**Detailed Analytics Query Parameters:**
- `startDate` - Start date (ISO string)
- `endDate` - End date (ISO string)
- `shopId` - Filter by shop (optional)

**Export Query Parameters:**
- `format` - Export format (csv, pdf)
- `startDate` - Start date
- `endDate` - End date

### 🚨 Alerts & Notifications

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/alerts` | Get all alerts | ✅ |
| PUT | `/alerts/:id/read` | Mark alert as read | ✅ |
| DELETE | `/alerts/:id` | Delete alert | ✅ (Admin) |
| GET | `/enhanced-alerts/expiring-soon` | Get expiry alerts | ✅ |
| GET | `/enhanced-alerts/low-stock` | Get low stock alerts | ✅ |

**Alert Types:**
- `LOW_STOCK` - Product below minimum stock
- `EXPIRY_WARNING` - Product expiring soon
- `EXPIRED_STOCK` - Product expired
- `PRICE_CHANGE` - Product price updated
- `PROMOTION_STARTED` - Promotion activated
- `SYSTEM_UPDATE` - System notifications

### 🏪 Categories & Suppliers

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/categories` | List categories | ✅ |
| POST | `/categories` | Create category | ✅ (Admin) |
| PUT | `/categories/:id` | Update category | ✅ (Admin) |
| DELETE | `/categories/:id` | Delete category | ✅ (Admin) |
| GET | `/suppliers` | List suppliers | ✅ |
| POST | `/suppliers` | Create supplier | ✅ (Admin) |
| PUT | `/suppliers/:id` | Update supplier | ✅ (Admin) |
| DELETE | `/suppliers/:id` | Delete supplier | ✅ (Admin) |

### 📱 Developer Analytics (Mobile App)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/dev-analytics/ingest` | Send analytics data | ❌ |
| GET | `/dev-analytics/report` | Get analytics report | ✅ (Admin) |

**Analytics Ingestion Payload:**
```json
{
  "app": "InventoryMobileApp",
  "version": "1.0.0",
  "metricType": "user_action",
  "eventName": "scan_product",
  "userId": "user_id",
  "sessionId": "session_123",
  "deviceInfo": {
    "platform": "android",
    "version": "12",
    "model": "Samsung Galaxy S21"
  },
  "customData": {
    "scanType": "qr_code",
    "success": true,
    "responseTime": 1250
  }
}
```

### 🏥 System Health

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | API health check | ❌ |
| GET | `/api-docs.json` | Swagger JSON spec | ❌ |

## 📱 Mobile Integration Examples

### React Native / Expo Integration

```javascript
// API Configuration
const API_CONFIG = {
  baseURL: __DEV__ 
    ? 'http://192.168.1.100:5001/api'  // Replace with your IP
    : 'https://api.yourdomain.com/api',
  timeout: 10000,
};

// API Client Setup
import axios from 'axios';

const apiClient = axios.create(API_CONFIG);

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken(); // Get from AsyncStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Example: Scan Product
const scanProduct = async (qrCode) => {
  try {
    const response = await apiClient.get(`/products/scan/${qrCode}`);
    return response.data;
  } catch (error) {
    console.error('Scan failed:', error.response?.data);
    throw error;
  }
};

// Example: Process Sale with FEFO
const processSale = async (productId, quantity) => {
  try {
    const response = await apiClient.post('/stock/reduce', {
      productId,
      quantity,
      reason: 'Mobile app sale'
    });
    return response.data;
  } catch (error) {
    console.error('Sale failed:', error.response?.data);
    throw error;
  }
};

// Example: Send Analytics
const sendAnalytics = async (eventData) => {
  try {
    await apiClient.post('/dev-analytics/ingest', {
      app: 'InventoryMobileApp',
      version: '1.0.0',
      ...eventData
    });
  } catch (error) {
    // Analytics shouldn't break the app
    console.warn('Analytics failed:', error.message);
  }
};
```

## 🔄 Error Handling

### Standard Error Response Format
```json
{
  "message": "Error description",
  "error": "Detailed error (development only)",
  "code": "ERROR_CODE",
  "timestamp": "2024-09-02T10:30:00.000Z"
}
```

### Common Error Codes
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate data)
- `422` - Validation Error (invalid data format)
- `500` - Internal Server Error

### Mobile Error Handling Example
```javascript
const handleAPIError = (error) => {
  if (error.response) {
    const { status, data } = error.response;
    
    switch (status) {
      case 401:
        // Token expired - redirect to login
        logout();
        break;
      case 400:
      case 422:
        // Show validation errors
        showErrorMessage(data.message);
        break;
      case 500:
        // Show generic error
        showErrorMessage('Something went wrong. Please try again.');
        break;
      default:
        showErrorMessage(data.message || 'An error occurred');
    }
  } else {
    // Network error
    showErrorMessage('Please check your internet connection');
  }
};
```

## 📊 Data Models

### Product Schema
```json
{
  "_id": "ObjectId",
  "name": "String (required)",
  "qrCode": "String (unique)",
  "barcode": "String (optional)",
  "price": "Number (required)",
  "costPrice": "Number",
  "categoryId": "ObjectId",
  "description": "String",
  "brand": "String",
  "size": "String",
  "alcoholContent": "String",
  "currentStock": "Number (calculated)",
  "minStock": "Number",
  "maxStock": "Number",
  "imageUrl": "String",
  "isActive": "Boolean (default: true)",
  "shopId": "ObjectId (required)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### ProductBatch Schema
```json
{
  "_id": "ObjectId",
  "productId": "ObjectId (required)",
  "supplierId": "ObjectId",
  "quantity": "Number (required)",
  "purchasePrice": "Number (required)",
  "expiryDate": "Date",
  "batchNumber": "String",
  "status": "String (active|expired|sold_out)",
  "notes": "String",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### User Schema
```json
{
  "_id": "ObjectId",
  "username": "String (unique, required)",
  "email": "String (unique, required)",
  "password": "String (hashed)",
  "firstName": "String (required)",
  "lastName": "String (required)",
  "role": "String (admin|staff)",
  "shopId": "ObjectId",
  "isActive": "Boolean (default: true)",
  "lastLogin": "Date",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

## 🚀 Quick Start Guide

### 1. Import Postman Collection
1. Download `Inventory-Management-API-v2.postman_collection.json`
2. Import into Postman
3. Import `Inventory-Management-Environments.postman_environment.json`

### 2. Set Environment Variables
Update these variables in Postman environment:
- `baseUrl` - Your API base URL
- `username` - Your login username
- `password` - Your login password
- `shopId` - Your shop ID

### 3. Test Authentication
1. Run "Authentication > Login" request
2. Token will be auto-saved to `authToken` variable
3. All subsequent requests will use this token

### 4. Test Core Functionality
1. Create a category
2. Create a supplier
3. Create a product
4. Add stock (creates batch)
5. Process a sale (FEFO consumption)
6. Check analytics

## 📋 Testing Checklist

### ✅ Basic Functionality
- [ ] User authentication (login/register)
- [ ] Product CRUD operations
- [ ] Category and supplier management
- [ ] QR/Barcode scanning

### ✅ Advanced Features
- [ ] Batch creation and management
- [ ] FEFO stock consumption
- [ ] Promotion creation and pricing
- [ ] Analytics and reporting
- [ ] CSV/PDF export

### ✅ Mobile Integration
- [ ] API calls from mobile app
- [ ] Error handling
- [ ] Analytics ingestion
- [ ] Offline capability (if implemented)

## 🔧 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `cors` middleware is properly configured
   - Check if origin is allowed in CORS settings

2. **Authentication Errors**
   - Verify JWT token format
   - Check token expiration
   - Ensure proper Authorization header format

3. **Database Connection**
   - Check MongoDB connection string
   - Verify database is running
   - Check network connectivity

4. **File Upload Issues**
   - Verify file size limits
   - Check upload middleware configuration
   - Ensure proper file permissions

### Debug Mode
Set `NODE_ENV=development` for detailed error messages in API responses.

---

## 📞 Support

For technical support or questions:
- 📧 Email: support@inventorymanagement.com
- 📚 Documentation: [API Docs](http://localhost:5001/api-docs)
- 🐛 Issues: Report bugs through your preferred channel

---

*Last Updated: September 2, 2024*
