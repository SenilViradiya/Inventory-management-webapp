# Inventory Management System API Documentation for Mobile Development

## 🚀 Quick Start Guide

### Base URL
- **Development**: `http://localhost:5001/api`
- **Production**: `https://your-production-domain.com/api`

### Authentication
All endpoints (except login and health check) require JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Test Credentials
- **Username**: `admin`
- **Password**: `admin123`
- **Test Barcode**: `ABC-abc-1234`

---

## 📱 Essential Mobile Endpoints

### 1. Authentication Flow

#### Login
```http
POST /users/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d5ecb54b24a0c8e8f5d123",
    "username": "admin",
    "email": "admin@example.com",
    "fullName": "Admin User",
    "role": "admin",
    "lastLogin": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Get Profile
```http
GET /users/profile
Authorization: Bearer <token>
```

#### Logout
```http
POST /users/logout
Authorization: Bearer <token>
```

---

### 2. Barcode Scanning & Product Lookup

#### Get Product by Barcode (Primary Mobile Endpoint)
```http
GET /products/barcode/{barcode}
Authorization: Bearer <token>

Example: GET /products/barcode/ABC-abc-1234
```

**Response:**
```json
{
  "_id": "60d5ecb54b24a0c8e8f5d456",
  "name": "Coca Cola 500ml",
  "image": "/uploads/products/product-1234567890-123456789.jpg",
  "price": 2.50,
  "category": "Beverages",
  "description": "Refreshing cola drink in 500ml bottle",
  "expirationDate": "2024-12-31T23:59:59.000Z",
  "quantity": 25,
  "qrCode": "ABC-abc-1234",
  "lowStockThreshold": 5,
  "isLowStock": false,
  "isExpired": false,
  "isExpiringSoon": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 3. Stock Operations (Core Mobile Functionality)

#### Update Product Quantity (Quick Stock Adjustment)
```http
PATCH /products/{productId}/quantity
Authorization: Bearer <token>
Content-Type: application/json

{
  "quantityChange": -1
}
```
- Use **negative values** to reduce stock (sales)
- Use **positive values** to add stock (restocking)

#### Reduce Stock (Detailed Transaction)
```http
POST /stock/reduce
Authorization: Bearer <token>
Content-Type: application/json

{
  "productId": "60d5ecb54b24a0c8e8f5d456",
  "quantity": 2,
  "reason": "Sale"
}
```

---

### 4. Product Management

#### Get All Products (with Mobile-Friendly Filtering)
```http
GET /products?page=1&limit=20&search=cola&category=Beverages&lowStock=true
Authorization: Bearer <token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)
- `search`: Search in name and barcode
- `category`: Filter by category
- `lowStock`: true/false - Show only low stock items
- `expired`: true/false - Show only expired items
- `expiringSoon`: true/false - Show items expiring within 7 days
- `sortBy`: name, price, quantity, expirationDate
- `sortOrder`: asc, desc

#### Create Product (with Image Upload)
```http
POST /products
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- name: "Coca Cola 500ml"
- price: "2.50"
- category: "Beverages"
- description: "Refreshing cola drink"
- expirationDate: "2024-12-31T23:59:59.000Z"
- quantity: "25"
- qrCode: "ABC-abc-1234"
- lowStockThreshold: "5"
- image: [file] (optional)
```

#### Update Product
```http
PUT /products/{productId}
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

#### Delete Product (Admin Only)
```http
DELETE /products/{productId}
Authorization: Bearer <token>
```

---

### 5. Dashboard & Analytics

#### Dashboard Metrics
```http
GET /analytics/dashboard
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalProducts": 150,
  "lowStock": 12,
  "totalValue": 15750.50,
  "todaysSales": 45,
  "expiredProducts": 3,
  "expiringSoon": 8
}
```

#### Today's Sales Count
```http
GET /analytics/todays-sales
Authorization: Bearer <token>
```

#### Sales Analytics
```http
GET /analytics/sales?period=daily&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
```

---

### 6. Alerts & Notifications

#### Get Alerts
```http
GET /alerts?type=low_stock&limit=50
Authorization: Bearer <token>
```

**Alert Types:**
- `low_stock`: Products below threshold
- `expired`: Expired products
- `expiring_soon`: Products expiring within 7 days

---

### 7. Reports (for Export Features)

#### Products Report
```http
GET /reports/products?format=csv&category=Beverages
Authorization: Bearer <token>
```

#### Sales Report
```http
GET /reports/sales?format=pdf&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
```

---

## 🔧 Mobile App Implementation Guide

### Recommended App Flow

1. **Login Screen**
   - POST `/users/login`
   - Store JWT token securely (AsyncStorage/Keychain)
   - Navigate to main app

2. **Dashboard Screen**
   - GET `/analytics/dashboard` for KPIs
   - GET `/alerts` for notifications
   - Real-time updates every 30 seconds

3. **Scanner Screen** (Primary Feature)
   - Use device camera for barcode scanning
   - GET `/products/barcode/{scanned-code}`
   - Show product details
   - Quick quantity adjustment buttons
   - PATCH `/products/{id}/quantity` for stock changes

4. **Products List Screen**
   - GET `/products` with pagination
   - Search and filter capabilities
   - Pull-to-refresh functionality

5. **Product Detail Screen**
   - Show full product information
   - Stock adjustment controls
   - Edit capabilities (if admin)

### Essential Mobile Considerations

#### Image Handling
- Product images available at: `{baseUrl.replace('/api', '')}/uploads/products/{filename}`
- Full URL example: `http://localhost:5001/uploads/products/product-1234567890-123456789.jpg`

#### Error Handling
```javascript
// Standard error response format
{
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Specific validation error"
    }
  ]
}
```

#### Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request / Validation Error
- `401`: Unauthorized / Invalid Token
- `403`: Forbidden / Insufficient Permissions
- `404`: Not Found
- `500`: Server Error

#### Pagination Response Format
```json
{
  "products": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100,
    "itemsPerPage": 20
  }
}
```

---

## 🔒 Security & Permissions

### Role-Based Access
- **Admin**: Full access to all endpoints
- **Staff**: Limited to stock operations and viewing

### Admin-Only Endpoints
- `POST /users/register`
- `DELETE /products/{id}`
- `POST /stock/adjust`
- `POST /stock/transactions/{id}/reverse`
- `GET /users`
- `PUT /users/{id}/toggle-status`

### Rate Limiting
- 100 requests per 15 minutes per IP address
- Authentication required for all endpoints except login and health check

---

## 📋 Testing Checklist for Mobile App

1. **Authentication**
   - [ ] Login with valid credentials
   - [ ] Login with invalid credentials
   - [ ] Token persistence across app restarts
   - [ ] Automatic logout on token expiry
   - [ ] Profile data retrieval

2. **Barcode Scanning**
   - [ ] Scan valid barcode (ABC-abc-1234)
   - [ ] Scan invalid barcode
   - [ ] Manual barcode entry
   - [ ] Camera permissions handling
   - [ ] Product display after successful scan

3. **Stock Operations**
   - [ ] Reduce stock quantity
   - [ ] Increase stock quantity
   - [ ] Handle insufficient stock scenarios
   - [ ] Real-time stock updates

4. **Product Management**
   - [ ] List products with pagination
   - [ ] Search products by name/barcode
   - [ ] Filter by category
   - [ ] Filter by low stock
   - [ ] Create new product (admin)
   - [ ] Image upload functionality

5. **Dashboard**
   - [ ] Load dashboard metrics
   - [ ] Display alerts
   - [ ] Real-time updates
   - [ ] Handle offline scenarios

6. **Error Handling**
   - [ ] Network connectivity issues
   - [ ] Server errors
   - [ ] Validation errors
   - [ ] Unauthorized access

---

## 📄 Postman Collection

Import the provided Postman collection files:
- `Inventory-Management-API.postman_collection.json`
- `Inventory-Management.postman_environment.json`

These files contain all endpoints with examples and automated token management.

---

## 🚀 Production Deployment Notes

1. Update base URLs in mobile app configuration
2. Implement HTTPS for production
3. Configure proper CORS settings
4. Set up proper JWT secrets
5. Implement proper error logging
6. Set up database backups
7. Configure SSL certificates for API server

---

This documentation provides everything needed to build a complete mobile inventory management app with barcode scanning, stock management, and real-time analytics capabilities.
