# Stock Summary Page APIs

## Overview
Complete API documentation for the Stock Summary page with comprehensive endpoints for stock management, analytics, and reporting.

## Base URL
```
http://localhost:5001/api/stock
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN'
}
```

---

## 📊 Stock Summary APIs

### 1. Stock Overview
Get comprehensive stock overview with summary statistics.

**Endpoint:** `GET /api/stock/overview`

**Query Parameters:**
- `category` (optional): Filter by category name
- `location` (optional): Filter by location ('godown', 'store', 'both')
- `search` (optional): Search by product name or QR code
- `minStock` (optional): Minimum stock quantity filter
- `maxStock` (optional): Maximum stock quantity filter

**Example Request:**
```bash
curl -X GET "http://localhost:5001/api/stock/overview?category=Beverages&search=coca" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalProducts": 133,
      "totalQuantity": 8494,
      "totalStockValue": 295935.88,
      "lowStockCount": 15,
      "outOfStockCount": 3,
      "averageStockValue": 2225.38
    },
    "locationBreakdown": {
      "godown": {
        "quantity": 6500,
        "value": 180000.50
      },
      "store": {
        "quantity": 1994,
        "value": 115935.38
      }
    },
    "categoryBreakdown": {
      "Beverages": {
        "quantity": 3500,
        "value": 125000.00,
        "products": 45,
        "lowStock": 5,
        "outOfStock": 1
      },
      "Snacks": {
        "quantity": 2800,
        "value": 95000.00,
        "products": 38,
        "lowStock": 8,
        "outOfStock": 2
      }
    },
    "products": [...],
    "filters": {
      "category": "Beverages",
      "location": null,
      "search": "coca",
      "minStock": null,
      "maxStock": null
    }
  }
}
```

### 2. Detailed Stock Summary with Pagination
Get paginated stock data with advanced filtering and sorting.

**Endpoint:** `GET /api/stock/summary-detailed`

**Query Parameters:**
- `page` (default: 1): Page number
- `limit` (default: 20): Items per page
- `category` (optional): Filter by category
- `stockStatus` (optional): 'low', 'out', 'normal', 'all'
- `location` (optional): 'godown', 'store', 'both'
- `sortBy` (default: 'name'): Sort field
- `sortOrder` (default: 'asc'): 'asc' or 'desc'
- `search` (optional): Search query

**Example Request:**
```bash
curl -X GET "http://localhost:5001/api/stock/summary-detailed?page=1&limit=10&stockStatus=low&sortBy=stock.total&sortOrder=asc" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "_id": "product_id",
        "name": "Coca Cola 330ml",
        "qrCode": "12345",
        "categoryName": "Beverages",
        "stock": {
          "total": 3,
          "godown": 2,
          "store": 1
        },
        "price": 2.50,
        "imageUrl": "/uploads/image.jpg",
        "lowStockThreshold": 5,
        "stockStatus": "low",
        "stockValue": 7.50,
        "createdAt": "2025-09-04T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalProducts": 48,
      "hasNextPage": true,
      "hasPrevPage": false,
      "limit": 10
    },
    "filters": {
      "category": "all",
      "stockStatus": "low",
      "location": "both",
      "sortBy": "stock.total",
      "sortOrder": "asc",
      "search": null
    }
  }
}
```

### 3. Stock Alerts
Get critical stock alerts including low stock, out of stock, and expiring batches.

**Endpoint:** `GET /api/stock/alerts`

**Query Parameters:**
- `priority` (optional): 'critical', 'high', 'medium', 'all' (default: 'all')

**Example Request:**
```bash
curl -X GET "http://localhost:5001/api/stock/alerts?priority=critical" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "product_id",
        "type": "out_of_stock",
        "priority": "critical",
        "title": "Out of Stock",
        "message": "Pepsi 330ml is out of stock",
        "product": {
          "_id": "product_id",
          "name": "Pepsi 330ml",
          "stock": { "total": 0, "godown": 0, "store": 0 },
          "price": 2.25,
          "categoryName": "Beverages"
        },
        "timestamp": "2025-09-04T15:30:00.000Z"
      }
    ],
    "summary": {
      "total": 23,
      "critical": 3,
      "high": 15,
      "medium": 5,
      "byType": {
        "outOfStock": 3,
        "lowStock": 15,
        "expiringBatches": 5
      }
    },
    "filter": "critical"
  }
}
```

### 4. Stock Movements History
Get detailed history of all stock movements with filtering.

**Endpoint:** `GET /api/stock/movements`

**Query Parameters:**
- `page` (default: 1): Page number
- `limit` (default: 20): Items per page
- `productId` (optional): Filter by specific product
- `movementType` (optional): 'in', 'out', 'transfer'
- `dateFrom` (optional): Start date (ISO format)
- `dateTo` (optional): End date (ISO format)
- `userId` (optional): Filter by user who made the movement

**Example Request:**
```bash
curl -X GET "http://localhost:5001/api/stock/movements?movementType=out&dateFrom=2025-09-01&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "movements": [
      {
        "_id": "movement_id",
        "action": "REDUCE_STOCK",
        "productId": {
          "_id": "product_id",
          "name": "Coca Cola 330ml",
          "qrCode": "12345",
          "categoryName": "Beverages",
          "imageUrl": "/uploads/image.jpg"
        },
        "userId": {
          "_id": "user_id",
          "username": "john_doe",
          "fullName": "John Doe"
        },
        "change": -5,
        "quantityBefore": 50,
        "quantityAfter": 45,
        "reason": "Sale",
        "createdAt": "2025-09-04T14:25:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 12,
      "totalMovements": 58,
      "hasNextPage": true,
      "hasPrevPage": false,
      "limit": 5
    },
    "summary": {
      "totalMovements": 58,
      "totalStockIn": 250,
      "totalStockOut": 185
    },
    "filters": {
      "productId": null,
      "movementType": "out",
      "dateFrom": "2025-09-01",
      "dateTo": null,
      "userId": null
    }
  }
}
```

### 5. Export Stock Summary
Export stock data as CSV or JSON.

**Endpoint:** `GET /api/stock/export`

**Query Parameters:**
- `format` (default: 'csv'): 'csv' or 'json'
- `category` (optional): Filter by category
- `stockStatus` (optional): 'low', 'out', 'normal', 'all'

**Example Request:**
```bash
# Export as CSV
curl -X GET "http://localhost:5001/api/stock/export?format=csv&category=Beverages" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output stock-summary.csv

# Export as JSON
curl -X GET "http://localhost:5001/api/stock/export?format=json&stockStatus=low" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**CSV Response:**
Downloads a CSV file with columns:
- Product Name, QR Code, Category, Total Stock, Godown Stock, Store Stock, Price, Stock Value, Low Stock Threshold, Stock Status, Created Date

---

## 📦 Existing Stock APIs (Also Available)

### Basic Stock Summary
**Endpoint:** `GET /api/stock/summary`
Simple stock summary from StockService.

### Low Stock Products
**Endpoint:** `GET /api/stock/low-stock`
Get products below their low stock threshold.

### Out of Stock Products
**Endpoint:** `GET /api/stock/out-of-stock`
Get products with zero stock.

---

## 🛠️ Frontend Integration Examples

### React Hook for Stock Summary
```jsx
import { useState, useEffect } from 'react';

const useStockSummary = (filters = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStockSummary();
  }, [filters]);

  const fetchStockSummary = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/stock/overview?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch stock summary');
      
      const result = await response.json();
      setData(result.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch: fetchStockSummary };
};

// Usage in component
const StockSummaryPage = () => {
  const [filters, setFilters] = useState({ category: 'all', stockStatus: 'all' });
  const { data, loading, error } = useStockSummary(filters);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="stock-summary">
      <div className="overview-cards">
        <div className="card">
          <h3>Total Products</h3>
          <p>{data.overview.totalProducts}</p>
        </div>
        <div className="card">
          <h3>Total Stock Value</h3>
          <p>${data.overview.totalStockValue.toFixed(2)}</p>
        </div>
        <div className="card alert">
          <h3>Low Stock Alerts</h3>
          <p>{data.overview.lowStockCount}</p>
        </div>
        <div className="card critical">
          <h3>Out of Stock</h3>
          <p>{data.overview.outOfStockCount}</p>
        </div>
      </div>
      
      <div className="category-breakdown">
        {Object.entries(data.categoryBreakdown).map(([category, stats]) => (
          <div key={category} className="category-card">
            <h4>{category}</h4>
            <p>Products: {stats.products}</p>
            <p>Quantity: {stats.quantity}</p>
            <p>Value: ${stats.value.toFixed(2)}</p>
            <p>Low Stock: {stats.lowStock}</p>
            <p>Out of Stock: {stats.outOfStock}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### JavaScript Class for Stock Management
```javascript
class StockSummaryAPI {
  constructor(baseURL = '/api/stock', authToken) {
    this.baseURL = baseURL;
    this.authToken = authToken;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Get overview data
  async getOverview(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/overview?${params}`);
  }

  // Get detailed summary with pagination
  async getDetailedSummary(page = 1, filters = {}) {
    const params = new URLSearchParams({ page, ...filters });
    return this.request(`/summary-detailed?${params}`);
  }

  // Get stock alerts
  async getAlerts(priority = 'all') {
    return this.request(`/alerts?priority=${priority}`);
  }

  // Get stock movements
  async getMovements(page = 1, filters = {}) {
    const params = new URLSearchParams({ page, ...filters });
    return this.request(`/movements?${params}`);
  }

  // Export stock data
  async exportStock(format = 'csv', filters = {}) {
    const params = new URLSearchParams({ format, ...filters });
    const response = await fetch(`${this.baseURL}/export?${params}`, {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });

    if (format === 'csv') {
      return response.blob();
    }
    return response.json();
  }
}

// Usage
const stockAPI = new StockSummaryAPI('/api/stock', yourAuthToken);

// Get overview
const overview = await stockAPI.getOverview({ category: 'Beverages' });

// Get alerts
const alerts = await stockAPI.getAlerts('critical');

// Export as CSV
const csvBlob = await stockAPI.exportStock('csv', { stockStatus: 'low' });
const url = URL.createObjectURL(csvBlob);
const a = document.createElement('a');
a.href = url;
a.download = 'low-stock-report.csv';
a.click();
```

---

## 🎨 CSS Styling Examples

```css
.stock-summary {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
  border-left: 4px solid #3b82f6;
}

.card.alert {
  border-left-color: #f59e0b;
}

.card.critical {
  border-left-color: #ef4444;
}

.card h3 {
  margin: 0 0 10px 0;
  color: #666;
  font-size: 14px;
  text-transform: uppercase;
}

.card p {
  margin: 0;
  font-size: 24px;
  font-weight: bold;
  color: #1f2937;
}

.category-breakdown {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.category-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.category-card h4 {
  margin: 0 0 15px 0;
  color: #1f2937;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 5px;
}

.category-card p {
  margin: 5px 0;
  display: flex;
  justify-content: space-between;
}

/* Responsive design */
@media (max-width: 768px) {
  .overview-cards {
    grid-template-columns: 1fr 1fr;
  }
  
  .category-breakdown {
    grid-template-columns: 1fr;
  }
}
```

## 🧪 Testing the APIs

Use this test script to verify all endpoints:

```bash
#!/bin/bash

# First, get auth token
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}' | \
  jq -r '.token')

echo "Testing Stock Summary APIs..."

# Test overview
echo "1. Testing stock overview..."
curl -s -X GET "http://localhost:5001/api/stock/overview" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.overview'

# Test detailed summary
echo "2. Testing detailed summary..."
curl -s -X GET "http://localhost:5001/api/stock/summary-detailed?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.pagination'

# Test alerts
echo "3. Testing stock alerts..."
curl -s -X GET "http://localhost:5001/api/stock/alerts" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.summary'

# Test movements
echo "4. Testing stock movements..."
curl -s -X GET "http://localhost:5001/api/stock/movements?limit=3" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.summary'

echo "All tests completed!"
```

---

## 📝 Notes

- All endpoints support authentication and proper error handling
- Pagination is available for large datasets
- Export functionality supports both CSV and JSON formats
- Real-time alerts help identify critical stock issues
- Comprehensive filtering and sorting options
- Integration with both legacy quantity and new batch-based inventory systems
- All monetary values are in the system's base currency
- Timestamps are in ISO 8601 format
