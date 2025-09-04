const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
require('dotenv').config();

// Import routes
const productRoutes = require('./routes/products');
const stockRoutes = require('./routes/stock');
const userRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const reportRoutes = require('./routes/reports');
const alertRoutes = require('./routes/alerts');
const roleRoutes = require('./routes/roles');
const subscriptionRoutes = require('./routes/subscriptions');
const categoryRoutes = require('./routes/categories');
const orderRoutes = require('./routes/orders');
const supplierRoutes = require('./routes/suppliers');
const purchaseOrderRoutes = require('./routes/purchase-orders');
const inquiryRoutes = require('./routes/inquiries');
const superadminRoutes = require('./routes/superadmin');
const enhancedAlertRoutes = require('./routes/enhanced-alerts');
const simpleUserRoutes = require('./routes/simple-users');
const simpleProductRoutes = require('./routes/simple-products');
const simpleAlertRoutes = require('./routes/simple-alerts');
const businessRoutes = require('./routes/businesses');
const shopRoutes = require('./routes/shops');
const simpleAnalyticsRoutes = require('./routes/simple-analytics');
const inventoryRoutes = require('./routes/inventory');
const uploadRoutes = require('./routes/upload');
const developerAnalyticsRoutes = require('./routes/developer-analytics');
const developerRoutes = require('./routes/developer');
const batchRoutes = require('./routes/batches');
const promotionRoutes = require('./routes/promotions');

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS configuration - Allow all origins for development
app.use(cors({
  origin: '*' // Allow all origins
  // methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
  // allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  // optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(morgan('combined'));

// Custom Request/Response Logger (configurable via .env)
const requestLogger = require('./middleware/requestLogger');
app.use(requestLogger);

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Inventory Management API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
  }
}));

// API JSON endpoint for swagger spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes
app.use('/api/products', productRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/enhanced-alerts', enhancedAlertRoutes);
app.use('/api/simple-users', simpleUserRoutes);
app.use('/api/simple-products', simpleProductRoutes);
app.use('/api/simple-alerts', simpleAlertRoutes);
app.use('/api/simple-analytics', simpleAnalyticsRoutes);
app.use('/api/shops', shopRoutes); // New shops endpoint  
app.use('/api/businesses', shopRoutes); // Map businesses to shops for backward compatibility
app.use('/api/inventory', inventoryRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/dev-analytics', developerAnalyticsRoutes);
app.use('/api/developer', developerRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Inventory Management API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
});

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_management');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const PORT = process.env.PORT || 5001;

// Start server
const startServer = async () => {
  await connectDB();
  
  // Get network interfaces to find the local IP
  const getNetworkIP = () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    
    for (const interfaceName in interfaces) {
      const networkInterface = interfaces[interfaceName];
      for (const alias of networkInterface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          return alias.address;
        }
      }
    }
    return 'localhost';
  };
  
  const networkIP = getNetworkIP();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Server accessible at:`);
    console.log(`- Local: http://localhost:${PORT}`);
    console.log(`- Network: http://${networkIP}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Schedule expiry job: run once on startup and then every 24 hours.
  try {
    const { scheduleDaily, executeExpiryJob } = require('./services/expiryRunner');
    // Run once immediately (non-blocking)
    executeExpiryJob().catch(err => console.error('Expiry job error:', err));
    // Schedule with node-cron default 02:00 daily
    scheduleDaily();
    console.log('Expiry job scheduled (daily at 02:00)');
  } catch (err) {
    console.error('Could not schedule expiry job:', err);
  }
};

startServer();

module.exports = app;
