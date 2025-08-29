# Inventory Management System - API Endpoints Documentation

## Base URL
- **Development**: `http://localhost:5001/api`
- **Network Access**: `http://192.168.1.14:5001/api`

## Authentication
All endpoints (except login) require authentication using JWT tokens.

### Authentication Methods:
1. **Bearer Token**: `Authorization: Bearer <jwt_token>`
2. **Cookie**: `token=<jwt_token>` (automatically handled by browser)

---

## 📋 Complete API Endpoints Reference

### 🔐 Authentication Endpoints

#### POST `/users/login`
**Purpose**: User login with username/email and password
**Access**: Public
**Request Body**:
```json
{
  "username": "admin",     // or use "email": "admin@example.com"
  "password": "admin123"
}
```
**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "60d5ecb54b24a0c8e8f5d123",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "firstName": "Admin",
    "lastName": "User",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Login successful"
}
```

#### POST `/users/logout`
**Purpose**: Logout current user
**Access**: Authenticated users
**Response**:
```json
{
  "message": "Logged out successfully"
}
```

#### GET `/users/profile`
**Purpose**: Get current user profile
**Access**: Authenticated users
**Response**:
```json
{
  "_id": "60d5ecb54b24a0c8e8f5d123",
  "username": "admin",
  "email": "admin@example.com",
  "role": "admin",
  "firstName": "Admin",
  "lastName": "User",
  "isActive": true,
  "lastLogin": "2024-01-15T10:30:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 📦 Product Management Endpoints

#### GET `/products`
**Purpose**: Get all products with filtering and pagination
**Access**: Authenticated users
**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 50)
- `category` (string): Filter by category
- `search` (string): Search in name and barcode
- `lowStock` (boolean): Filter low stock items
- `expiringSoon` (boolean): Filter expiring products
- `expired` (boolean): Filter expired products
- `sortBy` (string): Sort field (default: 'name')
- `sortOrder` (string): 'asc' or 'desc' (default: 'asc')

**Example Request**: `GET /products?category=Beverages&lowStock=true&page=1&limit=20`

**Response**:
```json
{
  "products": [
    {
      "_id": "60d5ecb54b24a0c8e8f5d456",
      "name": "Coca Cola 500ml",
      "image": "/uploads/products/product-1234567890-123456789.jpg",
      "price": 2.50,
      "category": "Beverages",
      "description": "Refreshing cola drink",
      "expirationDate": "2024-12-31T23:59:59.000Z",
      "quantity": 25,
      "qrCode": "ABC-abc-1234",
      "lowStockThreshold": 5,
      "isLowStock": false,
      "isExpired": false,
      "isExpiringSoon": false,
      "createdBy": "60d5ecb54b24a0c8e8f5d123",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100,
    "itemsPerPage": 20
  }
}
```

#### GET `/products/:id`
**Purpose**: Get single product by ID
**Access**: Authenticated users
**Response**: Single product object (same structure as above)

#### GET `/products/barcode/:barcode`
**Purpose**: Get product by barcode/QR code (IMPORTANT for scanning)
**Access**: Authenticated users
**Example**: `GET /products/barcode/ABC-abc-1234`
**Response**: Single product object or 404 if not found

#### POST `/products`
**Purpose**: Create new product (with optional image upload)
**Access**: Authenticated users
**Content-Type**: `multipart/form-data` (for image upload) or `application/json`
**Request Body**:
```json
{
  "name": "New Product",
  "price": 15.99,
  "category": "Beverages",
  "description": "Product description",
  "expirationDate": "2024-12-31T23:59:59.000Z",
  "quantity": 50,
  "qrCode": "NEW-PRODUCT-123",
  "lowStockThreshold": 10
}
```
**Response**: Created product object

#### PUT `/products/:id`
**Purpose**: Update existing product
**Access**: Authenticated users
**Request Body**: Same as POST (all fields)
**Response**: Updated product object

#### PATCH `/products/:id/quantity`
**Purpose**: Update product quantity (for stock operations)
**Access**: Authenticated users
**Request Body**:
```json
{
  "quantityChange": -1    // Negative to reduce, positive to add
}
```
**Response**: Updated product object

#### DELETE `/products/:id`
**Purpose**: Delete product
**Access**: Admin only
**Response**:
```json
{
  "message": "Product deleted successfully"
}
```

---

### 📊 Stock Management Endpoints

#### POST `/stock/reduce`
**Purpose**: Reduce stock quantity (main scanning operation)
**Access**: Authenticated users
**Request Body**:
```json
{
  "productId": "60d5ecb54b24a0c8e8f5d456",
  "quantity": 1,
  "reason": "Sale"
}
```
**Response**:
```json
{
  "message": "Stock reduced successfully",
  "product": {
    // Updated product object
  },
  "transaction": {
    "_id": "transaction_id",
    "type": "REDUCE",
    "quantity": 1,
    "reason": "Sale",
    "performedBy": "user_id",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### POST `/stock/adjust`
**Purpose**: Adjust stock (admin only)
**Access**: Admin only
**Request Body**:
```json
{
  "productId": "60d5ecb54b24a0c8e8f5d456",
  "newQuantity": 50,
  "reason": "Stock count correction"
}
```

#### GET `/stock/transactions`
**Purpose**: Get stock transaction history
**Access**: Authenticated users
**Query Parameters**:
- `page`, `limit`: Pagination
- `productId`: Filter by product
- `startDate`, `endDate`: Date range filter
**Response**: Array of transaction objects

---

### 📈 Analytics Endpoints

#### GET `/analytics/dashboard`
**Purpose**: Get dashboard metrics (main dashboard data)
**Access**: Authenticated users
**Response**:
```json
{
  "totalProducts": 150,
  "lowStock": 12,
  "totalValue": 15750.50,
  "todaysSales": 45,
  "expiredProducts": 3,
  "expiringSoon": 8,
  "categoriesBreakdown": {
    "Beverages": 65,
    "Spirits": 25,
    "Wine": 35,
    "Beer": 20,
    "Snacks": 5
  },
  "recentActivity": [
    {
      "action": "STOCK_REDUCED",
      "productName": "Coca Cola 500ml",
      "quantity": 1,
      "user": "John Doe",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### GET `/analytics/sales`
**Purpose**: Get sales analytics with date ranges
**Access**: Authenticated users
**Query Parameters**:
- `period`: 'daily', 'weekly', 'monthly', 'yearly'
- `startDate`, `endDate`: Custom date range
**Response**:
```json
{
  "period": "weekly",
  "totalSales": 245,
  "totalRevenue": 1250.75,
  "salesByDay": [
    {
      "date": "2024-01-15",
      "sales": 45,
      "revenue": 225.50
    }
  ],
  "topProducts": [
    {
      "productId": "60d5ecb54b24a0c8e8f5d456",
      "name": "Coca Cola 500ml",
      "quantitySold": 25,
      "revenue": 62.50
    }
  ]
}
```

#### GET `/analytics/todays-sales`
**Purpose**: Get today's sales count (quick metric)
**Access**: Authenticated users
**Response**:
```json
{
  "count": 45,
  "date": "2024-01-15"
}
```

---

### 🚨 Alerts Endpoints

#### GET `/alerts`
**Purpose**: Get all system alerts
**Access**: Authenticated users
**Response**:
```json
{
  "lowStockAlerts": [
    {
      "productId": "60d5ecb54b24a0c8e8f5d456",
      "name": "Coca Cola 500ml",
      "currentQuantity": 3,
      "threshold": 5,
      "category": "Beverages"
    }
  ],
  "expiringAlerts": [
    {
      "productId": "60d5ecb54b24a0c8e8f5d789",
      "name": "Milk 1L",
      "expirationDate": "2024-01-20T23:59:59.000Z",
      "daysUntilExpiry": 5
    }
  ],
  "expiredAlerts": [
    {
      "productId": "60d5ecb54b24a0c8e8f5d012",
      "name": "Bread",
      "expirationDate": "2024-01-10T23:59:59.000Z",
      "daysExpired": 5
    }
  ]
}
```

---

### 👥 User Management Endpoints (Admin Only)

#### GET `/users`
**Purpose**: Get all users
**Access**: Admin only
**Response**: Array of user objects

#### POST `/users/register`
**Purpose**: Create new user
**Access**: Admin only
**Request Body**:
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "staff"
}
```

#### PUT `/users/:id`
**Purpose**: Update user
**Access**: Admin only

#### DELETE `/users/:id`
**Purpose**: Delete user
**Access**: Admin only

---

### 📄 Reports Endpoints

#### GET `/reports/products`
**Purpose**: Generate products report
**Access**: Authenticated users
**Query Parameters**:
- `format`: 'csv' or 'pdf'
- `category`: Filter by category
- `lowStock`: Include only low stock items
**Response**: File download or JSON data

#### GET `/reports/sales`
**Purpose**: Generate sales report
**Access**: Authenticated users
**Query Parameters**:
- `format`: 'csv' or 'pdf'
- `startDate`, `endDate`: Date range
- `category`: Filter by category

#### GET `/reports/expiry`
**Purpose**: Generate expiry report
**Access**: Authenticated users

#### GET `/reports/valuation`
**Purpose**: Generate stock valuation report
**Access**: Authenticated users

---

## 🔧 Error Responses

### Standard Error Format:
```json
{
  "message": "Error description",
  "error": "Additional error details (development only)"
}
```

### HTTP Status Codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (no token or invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

### Validation Error Format:
```json
{
  "message": "Validation failed",
  "errors": [
    {
      "field": "price",
      "message": "Price must be a positive number"
    }
  ]
}
```

---

## 📱 Mobile App Development Notes

### Key Endpoints for Mobile App:

1. **Login**: `POST /users/login`
2. **Dashboard Data**: `GET /analytics/dashboard`
3. **Product Scanning**: `GET /products/barcode/:barcode`
4. **Stock Reduction**: `POST /stock/reduce`
5. **Product Listing**: `GET /products`
6. **Quantity Update**: `PATCH /products/:id/quantity`
7. **Alerts**: `GET /alerts`

### Authentication Flow:
1. User logs in with `POST /users/login`
2. Store the returned JWT token
3. Include token in all subsequent requests as `Authorization: Bearer <token>`
4. Handle 401 responses by redirecting to login

### Demo Credentials:
- **Username**: `admin`
- **Password**: `admin123`
- **Test Barcode**: `ABC-abc-1234`

### Image URLs:
Product images are accessible at: `http://localhost:5001/uploads/products/filename.jpg`

### Network Configuration:
- **Local**: `http://localhost:5001/api`
- **Network**: `http://192.168.1.14:5001/api` (for mobile device testing)

---

## 📖 Swagger Documentation

**Interactive API Documentation**: `http://localhost:5001/api-docs`

The Swagger UI provides:
- Interactive endpoint testing
- Request/response examples
- Authentication testing
- Schema definitions
- Complete API reference

This allows the mobile developer to test all endpoints directly in the browser before implementing them in the mobile app.
