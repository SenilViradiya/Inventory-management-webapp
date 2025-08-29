const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Inventory Management System API',
    version: '1.0.0',
    description: 'Comprehensive API for off-license shop inventory management with barcode scanning, stock tracking, and analytics',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:5001/api',
      description: 'Development server',
    },
    {
      url: 'https://your-production-url.com/api',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'token',
      },
    },
    schemas: {
      User: {
        type: 'object',
        required: ['username', 'email', 'password', 'firstName', 'lastName'],
        properties: {
          _id: {
            type: 'string',
            description: 'Unique identifier for the user',
            example: '60d5ecb54b24a0c8e8f5d123',
          },
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 30,
            description: 'Unique username for login',
            example: 'admin',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
            example: 'admin@example.com',
          },
          role: {
            type: 'string',
            enum: ['admin', 'staff'],
            description: 'User role determining permissions',
            example: 'admin',
          },
          firstName: {
            type: 'string',
            description: 'User first name',
            example: 'John',
          },
          lastName: {
            type: 'string',
            description: 'User last name',
            example: 'Doe',
          },
          isActive: {
            type: 'boolean',
            description: 'Whether the user account is active',
            example: true,
          },
          lastLogin: {
            type: 'string',
            format: 'date-time',
            description: 'Last login timestamp',
            example: '2024-01-15T10:30:00.000Z',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-01T00:00:00.000Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z',
          },
        },
      },
      Product: {
        type: 'object',
        required: ['name', 'price', 'category', 'expirationDate', 'quantity', 'qrCode'],
        properties: {
          _id: {
            type: 'string',
            description: 'Unique identifier for the product',
            example: '60d5ecb54b24a0c8e8f5d456',
          },
          name: {
            type: 'string',
            description: 'Product name',
            example: 'Coca Cola 500ml',
          },
          image: {
            type: 'string',
            description: 'URL or file path to product image',
            example: '/uploads/products/product-1234567890-123456789.jpg',
          },
          price: {
            type: 'number',
            minimum: 0,
            description: 'Product price',
            example: 2.50,
          },
          category: {
            type: 'string',
            description: 'Product category',
            example: 'Beverages',
          },
          description: {
            type: 'string',
            description: 'Product description',
            example: 'Refreshing cola drink in 500ml bottle',
          },
          expirationDate: {
            type: 'string',
            format: 'date-time',
            description: 'Product expiration date',
            example: '2024-12-31T23:59:59.000Z',
          },
          quantity: {
            type: 'integer',
            minimum: 0,
            description: 'Current stock quantity',
            example: 25,
          },
          qrCode: {
            type: 'string',
            description: 'Unique QR/Barcode for the product',
            example: 'ABC-abc-1234',
          },
          lowStockThreshold: {
            type: 'integer',
            minimum: 0,
            description: 'Threshold for low stock alerts',
            example: 5,
          },
          isLowStock: {
            type: 'boolean',
            description: 'Virtual property indicating if stock is low',
            example: false,
          },
          isExpired: {
            type: 'boolean',
            description: 'Virtual property indicating if product is expired',
            example: false,
          },
          isExpiringSoon: {
            type: 'boolean',
            description: 'Virtual property indicating if product expires within 7 days',
            example: false,
          },
          createdBy: {
            type: 'string',
            description: 'User ID who created the product',
            example: '60d5ecb54b24a0c8e8f5d123',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-01T00:00:00.000Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z',
          },
        },
      },
      ActivityLog: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: '60d5ecb54b24a0c8e8f5d789',
          },
          user: {
            type: 'string',
            description: 'User ID who performed the action',
            example: '60d5ecb54b24a0c8e8f5d123',
          },
          action: {
            type: 'string',
            description: 'Action performed',
            example: 'PRODUCT_CREATED',
          },
          details: {
            type: 'object',
            description: 'Additional details about the action',
            example: {
              productId: '60d5ecb54b24a0c8e8f5d456',
              productName: 'Coca Cola 500ml',
            },
          },
          ipAddress: {
            type: 'string',
            example: '192.168.1.100',
          },
          userAgent: {
            type: 'string',
            example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z',
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: {
            type: 'string',
            description: 'Username or email for login',
            example: 'admin',
          },
          password: {
            type: 'string',
            description: 'User password',
            example: 'admin123',
          },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: {
            type: 'string',
            description: 'JWT authentication token',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
          user: {
            $ref: '#/components/schemas/User',
          },
          message: {
            type: 'string',
            example: 'Login successful',
          },
        },
      },
      DashboardMetrics: {
        type: 'object',
        properties: {
          totalProducts: {
            type: 'integer',
            example: 150,
          },
          lowStock: {
            type: 'integer',
            example: 12,
          },
          totalValue: {
            type: 'number',
            example: 15750.50,
          },
          todaysSales: {
            type: 'integer',
            example: 45,
          },
          expiredProducts: {
            type: 'integer',
            example: 3,
          },
          expiringSoon: {
            type: 'integer',
            example: 8,
          },
        },
      },
      QuantityUpdateRequest: {
        type: 'object',
        required: ['quantityChange'],
        properties: {
          quantityChange: {
            type: 'integer',
            description: 'Amount to add (positive) or subtract (negative) from current quantity',
            example: -1,
          },
        },
      },
      StockReduceRequest: {
        type: 'object',
        required: ['productId', 'quantity'],
        properties: {
          productId: {
            type: 'string',
            description: 'Product ID',
            example: '60d5ecb54b24a0c8e8f5d456',
          },
          quantity: {
            type: 'integer',
            minimum: 1,
            description: 'Quantity to reduce from stock',
            example: 2,
          },
          reason: {
            type: 'string',
            description: 'Reason for stock reduction',
            example: 'Sale',
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Error message',
            example: 'Product not found',
          },
          error: {
            type: 'object',
            description: 'Additional error details (development only)',
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication token missing or invalid',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              message: 'Access denied. No token provided.',
            },
          },
        },
      },
      ForbiddenError: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              message: 'Access denied. Admin role required.',
            },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              message: 'Product not found',
            },
          },
        },
      },
      ValidationError: {
        description: 'Request validation failed',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'Validation failed',
                },
                errors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: {
                        type: 'string',
                        example: 'price',
                      },
                      message: {
                        type: 'string',
                        example: 'Price must be a positive number',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: ['./routes/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
