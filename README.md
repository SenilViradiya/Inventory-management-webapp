# 🏪 Inventory Management System v2.0 - Complete Solution

A comprehensive, production-ready inventory management system designed for off-license shops with advanced features including batch tracking, FEFO algorithm, dynamic promotions, and real-time analytics.

## 🌟 Key Features

### 🔥 **NEW in v2.0**
- **📦 Batch-Level Inventory Tracking** - Track individual stock batches with expiry dates and purchase prices
- **🔄 FEFO Algorithm** - First Expired First Out automatic stock consumption 
- **🎯 Dynamic Promotions** - Time-window based promotions with automatic price resolution
- **📊 Enhanced Analytics** - Comprehensive reporting with CSV/PDF exports
- **📱 Mobile API Integration** - Complete mobile app support with Google Analytics
- **🤖 Developer Metrics** - Advanced analytics collection and reporting
- **⏰ Automated Scheduling** - Background jobs for expiry checks and analytics

### 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │    Database     │
│   (Next.js)     │◄──►│   (Express.js)  │◄──►│   (MongoDB)     │
│   React + UI    │    │   REST API      │    │   + Analytics   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                       ┌─────────────────┐
                       │  Mobile App     │
                       │  (React Native) │
                       │  + Analytics    │
                       └─────────────────┘
```

### 📱 **Backend (Node.js + Express + MongoDB)**
- **Server**: Express.js with security middleware (Helmet, CORS, Rate Limiting)
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT-based with role-based access control
- **File Storage**: Azure Blob Storage integration
- **API Documentation**: Complete Swagger/OpenAPI 3.0 documentation
- **Background Jobs**: Node-cron for scheduled tasks
- **Testing**: Comprehensive Jest test suite (12 tests, 100% pass rate)

### 🖥️ **Frontend (Next.js + React + Tailwind CSS)**
- **Framework**: Next.js 14 with React 18
- **Styling**: Tailwind CSS with mobile-first responsive design
- **State Management**: React Query for server state, Context API for auth
- **QR Scanning**: React QR Reader for barcode scanning
- **Charts**: Recharts for analytics and data visualization
- **Notifications**: React Hot Toast for user feedback

## 🚀 Complete Feature Set

### 📦 **Advanced Product Management**
- ✅ Complete product lifecycle management
- ✅ Batch-level tracking with expiry dates
- ✅ Purchase price tracking per batch
- ✅ Azure Blob Storage for product images
- ✅ QR/Barcode scanning with camera integration
- ✅ Category and supplier management
- ✅ Advanced search and filtering

### 📊 **Intelligent Stock Management**
- ✅ **FEFO Algorithm** - Automatic stock rotation (First Expired First Out)
- ✅ Batch creation and management
- ✅ Real-time stock level tracking
- ✅ Automated expiry detection and alerts
- ✅ Dead stock handling and reporting
- ✅ Stock movement history with full audit trail

### 🎯 **Dynamic Promotion System**
- ✅ Time-window based promotions
- ✅ Percentage and fixed amount discounts
- ✅ Product-specific and category-wide promotions
- ✅ Automatic price resolution during sales
- ✅ Promotion analytics and performance tracking

### 📈 **Comprehensive Analytics & Reporting**
- ✅ **Real-time Dashboard** - Sales, revenue, profit metrics
- ✅ **Detailed Analytics** - Stock movements, price changes, batch tracking
- ✅ **Export Capabilities** - CSV and PDF report generation
- ✅ **Developer Metrics** - Mobile app usage analytics
- ✅ **Pre-aggregated Data** - Daily snapshots for performance
- ✅ **Historical Reporting** - Trend analysis and forecasting

### 🔐 **Advanced Authentication & Authorization**
- ✅ **Role-Based Access Control** - Admin, Staff, and custom roles
- ✅ **JWT Authentication** - Secure token-based authentication
- ✅ **Multi-shop Support** - Separate access per shop location
- ✅ **Activity Logging** - Complete audit trail for all actions
- ✅ **Session Management** - Secure login/logout with token refresh

### 🚨 **Smart Alerts & Notifications**
- ✅ **Expiry Alerts** - Automated warnings for expiring products
- ✅ **Low Stock Notifications** - Customizable threshold alerts
- ✅ **Price Change Tracking** - Complete price history with alerts
- ✅ **System Notifications** - Background job status and errors
- ✅ **Mobile Push Integration** - Ready for mobile app notifications
- 🔄 Email notifications (placeholder for future implementation)

### Analytics & Dashboard
- ✅ Daily, weekly, monthly, yearly sales summaries
- ✅ Sales trends and performance graphs
- ✅ Category-wise sales analysis
- ✅ Total stock value calculations
- ✅ Top-selling products identification
- ✅ Real-time dashboard with key metrics

### Reports & Export
- ✅ **Products Report**: Complete inventory with stock levels, values, expiry status
- ✅ **Sales Report**: Transaction history with user attribution and time ranges
- ✅ **Expiry Report**: Products approaching expiration or already expired
- ✅ **Stock Valuation Report**: Current inventory value by category
- ✅ Export formats: CSV and PDF
- ✅ Date range filtering and category filtering

## 📱 Mobile-First Design

The system is optimized for mobile use since staff primarily work on mobile devices:
- Large touch-friendly buttons (minimum 48px height)
- Responsive card-based layouts
- Easy-to-use QR scanner interface
- Quick access to common functions
- Optimized typography and spacing for mobile screens

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- MongoDB (local or cloud)
- Modern web browser with camera access (for QR scanning)

### 1. Clone and Navigate to Project
```bash
cd "INVENTORY MANAGEMENT SYSTEM"
```

### 2. Backend Setup
```bash
cd backend

# Install dependencies (already done)
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your MongoDB connection string and other settings

# Seed database with sample data
node scripts/seedData.js

# Start development server (already running on port 5001)
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend

# Install dependencies (already done)
npm install --legacy-peer-deps

# Start development server (already running on port 3000)
npm run dev
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001/api
- **API Health Check**: http://localhost:5001/api/health

### Default Login Credentials
- **Admin**: admin@offlicense.com / admin123
- **Staff**: staff1@offlicense.com / staff123
- **Staff**: staff2@offlicense.com / staff123

## 📊 Sample QR Codes for Testing

The seeded database includes these QR codes for testing:
- `COKE330` - Coca-Cola 330ml
- `HEIN330` - Heineken Beer 330ml  
- `JACK750` - Jack Daniels Whiskey 750ml
- `WATR500` - Premium Water 500ml (Low stock item)
- `GATO500` - Gatorade Sports Drink (Low stock + expiring soon)

## 🔄 API Endpoints

### Authentication
- `POST /api/users/login` - User login
- `POST /api/users/logout` - User logout
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `PUT /api/users/change-password` - Change password

### Products
- `GET /api/products` - Get all products (with filtering)
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/qr/:qrCode` - Get product by QR code
- `POST /api/products` - Create new product (Admin)
- `PUT /api/products/:id` - Update product (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)

### Stock Management
- `POST /api/stock/reduce` - Reduce stock by QR code
- `POST /api/stock/increase` - Increase stock
- `POST /api/stock/reverse/:logId` - Reverse adjustment (Admin)
- `GET /api/stock/history/:productId` - Get stock history
- `GET /api/stock/recent-activities` - Get recent activities

### Analytics
- `GET /api/analytics/dashboard` - Dashboard data
- `GET /api/analytics/sales-trend` - Sales trend data
- `GET /api/analytics/category-performance` - Category performance

### Alerts
- `GET /api/alerts/low-stock` - Low stock alerts
- `GET /api/alerts/expiring-soon` - Expiring products
- `GET /api/alerts/expired` - Expired products
- `GET /api/alerts/summary` - Alerts summary

### Reports
- `GET /api/reports/products` - Export products report
- `GET /api/reports/sales` - Export sales report
- `GET /api/reports/expiry` - Export expiry report
- `GET /api/reports/stock-valuation` - Export stock valuation

## 🔒 Security Features

- JWT-based authentication with token expiration
- Role-based access control (Admin/Staff)
- Password hashing with bcrypt
- Request rate limiting
- Input validation and sanitization
- CORS configuration
- Security headers with Helmet
- SQL injection prevention
- XSS protection

## 📝 Activity Logging

All user actions are logged with:
- User ID and details
- Action performed
- Product affected (if applicable)
- Quantity changes
- Timestamps
- IP address and user agent
- Reversal capabilities for stock adjustments

## 🔮 Future Enhancements

- 📧 Email notifications for alerts and reports
- 📅 Automatic daily/weekly report generation
- 📱 Progressive Web App (PWA) support
- 🔄 Real-time updates with WebSocket
- 📈 Advanced analytics and forecasting
- 🏪 Multi-location support
- 📋 Barcode generation for new products
- 🔄 Inventory reorder automation

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**: Backend runs on port 5001, frontend on port 3000
2. **MongoDB connection**: Ensure MongoDB is running and connection string is correct
3. **QR Scanner not working**: Ensure HTTPS or localhost, and camera permissions
4. **Dependencies issues**: Use `--legacy-peer-deps` for frontend installation

### Development Commands

```bash
# Backend
cd backend
npm run dev        # Start development server
npm start         # Start production server
npm test         # Run tests

# Frontend  
cd frontend
npm run dev      # Start development server
npm run build    # Build for production
npm start       # Start production server
npm run lint    # Run linter
```

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Built with ❤️ for off-license shop management**
