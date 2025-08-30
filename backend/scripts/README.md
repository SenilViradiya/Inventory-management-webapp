# Database Scripts

This directory contains utility scripts for managing the inventory management database. All scripts now use environment variables for database configuration.

## Environment Variables

Make sure your `.env` file in the backend directory contains:

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/inventory_management
# or for cloud databases:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name
```

## Available Scripts

### 1. `createDeveloper.js`
Creates a developer user with superadmin privileges.

```bash
node scripts/createDeveloper.js
```

### 2. `createSimpleDeveloper.js`
Creates a simple developer user with superadmin privileges.

```bash
node scripts/createSimpleDeveloper.js
```

### 3. `createMyOrganization.js`
Creates a default organization/business entity.

```bash
node scripts/createMyOrganization.js
```

### 4. `seedData.js`
Seeds the database with sample users, roles, and products.

```bash
node scripts/seedData.js
```

### 5. `seedEnhancedData.js`
Seeds the database with enhanced sample data.

```bash
node scripts/seedEnhancedData.js
```

### 6. `test-db-connection.js`
Tests the database connection using environment variables.

```bash
node scripts/test-db-connection.js
```

## Usage Examples

### Local Development
```bash
# Set local MongoDB
MONGODB_URI=mongodb://localhost:27017/inventory_management

# Run scripts
node scripts/seedData.js
node scripts/createDeveloper.js
```

### Production/Cloud Database
```bash
# Set cloud MongoDB (update with your actual credentials)
MONGODB_URI=mongodb+srv://admin:password@cluster.mongodb.net/inventory_management

# Run scripts
node scripts/seedData.js
```

## Default Test Accounts

After running the seed scripts, you can use these test accounts:

- **Developer**: `developer@admin.com` / `Dev@123456`
- **Admin**: `admin@offlicense.com` / `admin123`
- **Staff**: `staff1@offlicense.com` / `staff123`

## Troubleshooting

1. **Connection Issues**: Make sure MongoDB is running locally or your cloud database is accessible
2. **Environment Variables**: Ensure `.env` file exists and contains correct `MONGODB_URI`
3. **Permissions**: Make sure your database user has the necessary permissions
4. **Network**: For cloud databases, ensure your IP is whitelisted

## Testing Connection

Run the test script to verify your database connection:

```bash
node scripts/test-db-connection.js
```

This will show:
- ✅ Whether environment variables are set
- ✅ Connection status
- ✅ Database name and host information
- 💡 Troubleshooting tips if connection fails
