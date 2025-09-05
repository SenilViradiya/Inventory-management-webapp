# Analytics Integration Documentation

## Overview
The analytics screen integration provides comprehensive real-time and historical analytics data for the inventory management system. The integration includes multiple endpoints for different types of analytics data.

## Authentication
All analytics endpoints require authentication with developer or admin privileges.

```javascript
// First, login to get the token
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'your_username', password: 'your_password' })
});
const { token } = await loginResponse.json();

// Use token in subsequent requests
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

## Analytics Endpoints

### 1. Developer Analytics Dashboard
**Endpoint:** `GET /api/developer/analytics-dashboard`
**Description:** Comprehensive analytics dashboard with all key metrics

**Query Parameters:**
- `startDate` (optional): Start date for date range (ISO format)
- `endDate` (optional): End date for date range (ISO format)

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "dateRange": {
      "start": "2025-09-04T00:00:00.000Z",
      "end": "2025-09-04T23:59:59.999Z"
    },
    "todayMetrics": {
      "sales": 1250.75,
      "itemsSold": 45,
      "transactions": 12,
      "categoryBreakdown": [
        { "category": "Beverages", "value": 750.25 },
        { "category": "Snacks", "value": 500.50 }
      ]
    },
    "stockOverview": {
      "totalProducts": 133,
      "totalStockValue": 295935.88,
      "lowStockProducts": 15,
      "outOfStockProducts": 3
    },
    "batchOverview": {
      "totalBatches": 133,
      "totalBatchValue": 295935.88,
      "expiringBatches": 5
    },
    "topProducts": [
      {
        "id": "product_id",
        "name": "Product Name",
        "totalSold": 25,
        "lastSold": "2025-09-04T12:30:00.000Z",
        "currentStock": 50
      }
    ],
    "recentActivities": [
      {
        "id": "activity_id",
        "action": "REDUCE_STOCK",
        "productName": "Coca Cola",
        "change": -5,
        "timestamp": "2025-09-04T12:30:00.000Z",
        "details": {}
      }
    ],
    "systemHealth": {
      "totalUsers": 25,
      "activeUsers": 18,
      "totalShops": 5,
      "activeShops": 4,
      "totalOrders": 150,
      "recentOrders": 12
    }
  }
}
```

### 2. Real-time Analytics
**Endpoint:** `GET /api/developer/analytics-realtime`
**Description:** Real-time analytics data for live monitoring

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-09-04T14:30:00.000Z",
    "recentMovements": [
      {
        "id": "movement_id",
        "action": "REDUCE_STOCK",
        "productName": "Product Name",
        "change": -2,
        "timestamp": "2025-09-04T14:25:00.000Z",
        "quantityBefore": 50,
        "quantityAfter": 48
      }
    ],
    "hourlySales": [
      {
        "hour": "2025-09-04 14:00",
        "sales": 125.50,
        "transactions": 3,
        "itemsSold": 8
      }
    ],
    "alerts": {
      "lowStock": [
        {
          "id": "product_id",
          "name": "Product Name",
          "currentStock": 3,
          "category": "Beverages",
          "price": 2.50
        }
      ],
      "criticalStock": [],
      "expiringBatches": [
        {
          "id": "batch_id",
          "batchNumber": "BATCH123",
          "productName": "Product Name",
          "expiryDate": "2025-09-10T00:00:00.000Z",
          "quantity": 25,
          "daysToExpiry": 6
        }
      ]
    },
    "summary": {
      "totalMovementsLastHour": 5,
      "totalSalesLast24h": 1250.75,
      "totalTransactionsLast24h": 25,
      "lowStockCount": 15,
      "criticalStockCount": 3,
      "expiringBatchesCount": 5
    }
  }
}
```

### 3. API Endpoints List
**Endpoint:** `GET /api/developer/api-endpoints`
**Description:** List all available API endpoints organized by category

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "endpoints": [...],
    "groupedEndpoints": {
      "Analytics": [...],
      "Products": [...],
      "Inventory": [...]
    },
    "totalEndpoints": 25,
    "categories": ["Analytics", "Products", "Inventory", "Shops", "Users"]
  }
}
```

## Frontend Integration Examples

### React Component Example
```jsx
import React, { useState, useEffect } from 'react';

const AnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [realtimeData, setRealtimeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchRealtimeData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/developer/analytics-dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setAnalytics(data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setLoading(false);
    }
  };

  const fetchRealtimeData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/developer/analytics-realtime', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setRealtimeData(data.data);
    } catch (error) {
      console.error('Error fetching realtime data:', error);
    }
  };

  if (loading) return <div>Loading analytics...</div>;

  return (
    <div className="analytics-dashboard">
      <h1>Analytics Dashboard</h1>
      
      {/* Today's Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Today's Sales</h3>
          <p>${analytics.todayMetrics.sales.toFixed(2)}</p>
        </div>
        <div className="metric-card">
          <h3>Items Sold</h3>
          <p>{analytics.todayMetrics.itemsSold}</p>
        </div>
        <div className="metric-card">
          <h3>Transactions</h3>
          <p>{analytics.todayMetrics.transactions}</p>
        </div>
      </div>

      {/* Stock Overview */}
      <div className="stock-overview">
        <h2>Stock Overview</h2>
        <div className="stock-grid">
          <div>Total Products: {analytics.stockOverview.totalProducts}</div>
          <div>Low Stock: {analytics.stockOverview.lowStockProducts}</div>
          <div>Out of Stock: {analytics.stockOverview.outOfStockProducts}</div>
        </div>
      </div>

      {/* Real-time Alerts */}
      {realtimeData && (
        <div className="alerts-section">
          <h2>Real-time Alerts</h2>
          {realtimeData.alerts.lowStock.length > 0 && (
            <div className="alert alert-warning">
              <h3>Low Stock Items ({realtimeData.alerts.lowStock.length})</h3>
              {realtimeData.alerts.lowStock.map(item => (
                <div key={item.id}>{item.name} - {item.currentStock} left</div>
              ))}
            </div>
          )}
          {realtimeData.alerts.expiringBatches.length > 0 && (
            <div className="alert alert-danger">
              <h3>Expiring Batches ({realtimeData.alerts.expiringBatches.length})</h3>
              {realtimeData.alerts.expiringBatches.map(batch => (
                <div key={batch.id}>
                  {batch.productName} - Expires in {batch.daysToExpiry} days
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Activities */}
      <div className="activities-section">
        <h2>Recent Activities</h2>
        {analytics.recentActivities.map(activity => (
          <div key={activity.id} className="activity-item">
            <span>{activity.action}</span>
            <span>{activity.productName}</span>
            <span>{activity.change}</span>
            <span>{new Date(activity.timestamp).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
```

### JavaScript/Vanilla Example
```javascript
class AnalyticsManager {
  constructor(authToken) {
    this.authToken = authToken;
    this.baseURL = '/api/developer';
  }

  async fetchAnalytics(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await fetch(`${this.baseURL}/analytics-dashboard?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error('Failed to fetch analytics');
    return response.json();
  }

  async fetchRealtimeData() {
    const response = await fetch(`${this.baseURL}/analytics-realtime`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error('Failed to fetch realtime data');
    return response.json();
  }

  async startRealtimeUpdates(callback, interval = 30000) {
    const updateData = async () => {
      try {
        const data = await this.fetchRealtimeData();
        callback(data);
      } catch (error) {
        console.error('Error updating realtime data:', error);
      }
    };

    await updateData(); // Initial fetch
    return setInterval(updateData, interval);
  }
}

// Usage
const analytics = new AnalyticsManager(yourAuthToken);
analytics.fetchAnalytics().then(data => {
  console.log('Analytics data:', data);
});
```

## CSS Styling Example
```css
.analytics-dashboard {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.metric-card {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.metric-card h3 {
  margin: 0 0 10px 0;
  color: #666;
  font-size: 14px;
  text-transform: uppercase;
}

.metric-card p {
  margin: 0;
  font-size: 24px;
  font-weight: bold;
  color: #2563eb;
}

.alert {
  padding: 15px;
  margin: 10px 0;
  border-radius: 4px;
}

.alert-warning {
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  color: #856404;
}

.alert-danger {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.activity-item {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr 2fr;
  gap: 10px;
  padding: 10px;
  border-bottom: 1px solid #eee;
}
```

## Error Handling
```javascript
const handleAnalyticsError = (error) => {
  if (error.status === 401) {
    // Redirect to login
    window.location.href = '/login';
  } else if (error.status === 403) {
    // Show access denied message
    showError('Access denied. Developer privileges required.');
  } else {
    // Show generic error
    showError('Failed to load analytics data. Please try again.');
  }
};
```

## Testing the Integration

Use the provided test scripts:
```bash
# Test all endpoints
./test-analytics-endpoints.sh

# Or test manually with curl:
curl -X GET http://localhost:5001/api/developer/analytics-dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Notes
- All analytics endpoints require authentication with developer or admin privileges
- Real-time data should be fetched periodically (recommended: every 30 seconds)
- Date ranges are optional and default to last 30 days
- All monetary values are in the system's base currency
- Timestamps are in ISO format
- The system supports both legacy quantity and new batch-based inventory tracking
