#!/bin/bash

# Database Environment Management Script
# This script helps manage different database environments for safe migration testing

set -e  # Exit on any error

echo "🛡️  DATABASE ENVIRONMENT MANAGER"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display current environment
show_current_env() {
    if [ -f .env ]; then
        echo -e "${BLUE}📍 Current Environment:${NC}"
        echo "   $(grep MONGODB_URI .env 2>/dev/null || echo 'MONGODB_URI not found')"
        echo "   $(grep PORT .env 2>/dev/null || echo 'PORT not found')"
        echo "   $(grep NODE_ENV .env 2>/dev/null || echo 'NODE_ENV not found')"
    else
        echo -e "${RED}❌ No .env file found${NC}"
    fi
    echo ""
}

# Function to create backup environment
create_backup_env() {
    echo -e "${YELLOW}📋 Creating backup environment configuration...${NC}"
    
    # Read original MongoDB URI
    if [ -f .env ]; then
        ORIGINAL_URI=$(grep MONGODB_URI .env | cut -d '=' -f2- | tr -d '"' || echo "")
        ORIGINAL_PORT=$(grep PORT .env | cut -d '=' -f2- | tr -d '"' || echo "5001")
    else
        ORIGINAL_URI="mongodb://localhost:27017/inventory-db"
        ORIGINAL_PORT="5001"
    fi
    
    # Create backup URI
    BACKUP_URI=$(echo "$ORIGINAL_URI" | sed 's/inventory-db/inventory-migration-test/')
    BACKUP_PORT=$((ORIGINAL_PORT + 1))
    
    # Create .env.backup file
    cat > .env.backup << EOF
# BACKUP DATABASE ENVIRONMENT FOR MIGRATION TESTING
# This environment uses a separate database for safe testing

MONGODB_URI="$BACKUP_URI"
PORT=$BACKUP_PORT
NODE_ENV=testing

# Keep other environment variables same as production
JWT_SECRET=your_jwt_secret_here
AZURE_STORAGE_ACCOUNT_NAME=your_account_name
AZURE_STORAGE_ACCOUNT_KEY=your_account_key
AZURE_STORAGE_CONTAINER_NAME=inventoryfiles

# Request Logging Configuration
ENABLE_REQUEST_LOGGING=true
ENABLE_RESPONSE_LOGGING=true
ENABLE_PAYLOAD_LOGGING=true
ENABLE_ERROR_LOGGING=true
LOG_LEVEL=debug
EOF

    echo -e "${GREEN}✅ Created .env.backup with:${NC}"
    echo "   Database: $BACKUP_URI"
    echo "   Port: $BACKUP_PORT"
    echo "   Environment: testing"
    echo ""
}

# Function to switch to backup environment
switch_to_backup() {
    if [ ! -f .env.backup ]; then
        echo -e "${RED}❌ Backup environment file not found. Create it first.${NC}"
        exit 1
    fi
    
    # Backup current .env
    if [ -f .env ]; then
        cp .env .env.production.backup
        echo -e "${BLUE}💾 Backed up current .env to .env.production.backup${NC}"
    fi
    
    # Switch to backup environment
    cp .env.backup .env
    echo -e "${GREEN}✅ Switched to backup environment${NC}"
    show_current_env
}

# Function to switch back to production
switch_to_production() {
    if [ ! -f .env.production.backup ]; then
        echo -e "${RED}❌ Production backup not found. Cannot restore.${NC}"
        exit 1
    fi
    
    cp .env.production.backup .env
    echo -e "${GREEN}✅ Switched back to production environment${NC}"
    show_current_env
}

# Function to run migration commands safely
run_migration_test() {
    echo -e "${YELLOW}🧪 Running migration test...${NC}"
    
    # Check if we're using backup database
    if grep -q "migration-test" .env; then
        echo -e "${GREEN}✅ Using backup database - safe to proceed${NC}"
        
        echo -e "${BLUE}📊 Step 1: Analyzing current stock...${NC}"
        node check-stock-status.js
        
        echo -e "${BLUE}🔄 Step 2: Running migration preview...${NC}"
        node migrate-stock-to-batches.js
        
        echo -e "${YELLOW}Ready to execute migration? (y/N):${NC}"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}🚀 Step 3: Executing migration...${NC}"
            node migrate-stock-to-batches.js --execute
        else
            echo -e "${YELLOW}⏸️  Migration execution skipped${NC}"
        fi
    else
        echo -e "${RED}❌ Not using backup database! Switch to backup first for safety.${NC}"
        exit 1
    fi
}

# Function to verify migration results
verify_migration() {
    echo -e "${BLUE}🔍 Verifying migration results...${NC}"
    
    # Check if batch system is working
    node -e "
    const mongoose = require('mongoose');
    const Product = require('./models/Product');
    const ProductBatch = require('./models/ProductBatch');
    
    async function verify() {
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            
            const totalProducts = await Product.countDocuments();
            const productsWithStock = await Product.countDocuments({
                \$or: [{ quantity: { \$gt: 0 } }, { 'stock.total': { \$gt: 0 } }]
            });
            const totalBatches = await ProductBatch.countDocuments();
            const batchedProducts = await ProductBatch.distinct('productId');
            
            console.log('📊 Migration Verification Results:');
            console.log(\`  - Total products: \${totalProducts}\`);
            console.log(\`  - Products with stock: \${productsWithStock}\`);
            console.log(\`  - Total batches: \${totalBatches}\`);
            console.log(\`  - Products with batches: \${batchedProducts.length}\`);
            
            if (batchedProducts.length >= productsWithStock) {
                console.log('✅ Migration appears successful!');
            } else {
                console.log('⚠️  Some products may still need migration');
            }
            
            await mongoose.disconnect();
        } catch (error) {
            console.error('Verification error:', error.message);
        }
    }
    verify();
    "
}

# Main menu
case "${1:-}" in
    "backup-env")
        create_backup_env
        ;;
    "switch-backup")
        switch_to_backup
        ;;
    "switch-production")
        switch_to_production
        ;;
    "test-migration")
        run_migration_test
        ;;
    "verify")
        verify_migration
        ;;
    "status")
        show_current_env
        ;;
    *)
        echo -e "${BLUE}Available commands:${NC}"
        echo "  backup-env        Create backup environment configuration"
        echo "  switch-backup     Switch to backup database environment"
        echo "  switch-production Switch back to production environment"
        echo "  test-migration    Run migration test on backup database"
        echo "  verify           Verify migration results"
        echo "  status           Show current environment status"
        echo ""
        echo -e "${GREEN}🔄 Recommended Migration Workflow:${NC}"
        echo "1. ./manage-db-env.sh backup-env      # Create backup environment"
        echo "2. node safe-migration-tool.js --create-backup  # Copy data to backup DB"
        echo "3. ./manage-db-env.sh switch-backup   # Switch to backup environment"
        echo "4. ./manage-db-env.sh test-migration  # Test migration safely"
        echo "5. ./manage-db-env.sh verify          # Verify results"
        echo "6. ./manage-db-env.sh switch-production  # Switch back when ready"
        echo ""
        show_current_env
        ;;
esac
