const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');
const Category = require('../models/Category');
const StockMovement = require('../models/StockMovement');
const Role = require('../models/Role');
const Shop = require('../models/Shop');
require('dotenv').config();

// Sample product data with Azure image URLs (placeholders)
const sampleProducts = [
  {
    name: 'Coca Cola 500ml',
    description: 'Refreshing cola drink in 500ml bottle',
    price: 2.50,
    stock: {
      godown: 180,
      store: 20,
      total: 200,
      reserved: 0
    },
    quantity: 200, // Legacy field
    qrCode: 'CC500ML001',
    category: null, // Will be set to actual category
    expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months from now
    lowStockThreshold: 50,
    imageUrl: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&h=400&fit=crop', // Placeholder
    shopId: null, // Will be set to actual shop
    barcode: '8901030851456',
    weight: 500,
    dimensions: { length: 6, width: 6, height: 20 },
    tags: ['beverage', 'cola', 'soft drink']
  },
  {
    name: 'Pepsi 500ml',
    description: 'Cola flavored carbonated soft drink',
    price: 2.45,
    stock: {
      godown: 150,
      store: 30,
      total: 180,
      reserved: 0
    },
    quantity: 180,
    qrCode: 'PP500ML001',
    category: null,
    expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    lowStockThreshold: 40,
    imageUrl: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400&h=400&fit=crop',
    shopId: null,
    barcode: '8901030851789',
    weight: 500,
    dimensions: { length: 6, width: 6, height: 20 },
    tags: ['beverage', 'cola', 'soft drink']
  },
  {
    name: 'Budweiser Beer 330ml',
    description: 'Premium lager beer in aluminum can',
    price: 4.99,
    stock: {
      godown: 240,
      store: 60,
      total: 300,
      reserved: 12
    },
    quantity: 300,
    qrCode: 'BUD330ML001',
    category: null,
    expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    lowStockThreshold: 100,
    imageUrl: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&h=400&fit=crop',
    shopId: null,
    barcode: '5000329002971',
    weight: 330,
    dimensions: { length: 5.3, width: 5.3, height: 11.5 },
    tags: ['alcohol', 'beer', 'lager'],
    isAlcoholic: true,
    alcoholContent: 5.0
  },
  {
    name: 'Johnnie Walker Red Label 700ml',
    description: 'Blended Scotch whisky with bold flavors',
    price: 24.99,
    stock: {
      godown: 45,
      store: 5,
      total: 50,
      reserved: 2
    },
    quantity: 50,
    qrCode: 'JWRL700ML001',
    category: null,
    expirationDate: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000), // 5 years
    lowStockThreshold: 20,
    imageUrl: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&h=400&fit=crop',
    shopId: null,
    barcode: '5000267014043',
    weight: 700,
    dimensions: { length: 8, width: 8, height: 28 },
    tags: ['alcohol', 'whisky', 'scotch', 'premium'],
    isAlcoholic: true,
    alcoholContent: 40.0
  },
  {
    name: 'Heineken Beer 500ml',
    description: 'Dutch premium lager beer',
    price: 5.49,
    stock: {
      godown: 200,
      store: 48,
      total: 248,
      reserved: 8
    },
    quantity: 248,
    qrCode: 'HNK500ML001',
    category: null,
    expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    lowStockThreshold: 80,
    imageUrl: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=400&fit=crop',
    shopId: null,
    barcode: '8712000042301',
    weight: 500,
    dimensions: { length: 6, width: 6, height: 20 },
    tags: ['alcohol', 'beer', 'lager', 'dutch'],
    isAlcoholic: true,
    alcoholContent: 5.0
  },
  {
    name: 'Grey Goose Vodka 750ml',
    description: 'Premium French vodka made from wheat',
    price: 45.99,
    stock: {
      godown: 28,
      store: 2,
      total: 30,
      reserved: 1
    },
    quantity: 30,
    qrCode: 'GG750ML001',
    category: null,
    expirationDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
    lowStockThreshold: 15,
    imageUrl: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&h=400&fit=crop',
    shopId: null,
    barcode: '3016570001516',
    weight: 750,
    dimensions: { length: 8.5, width: 8.5, height: 32 },
    tags: ['alcohol', 'vodka', 'premium', 'french'],
    isAlcoholic: true,
    alcoholContent: 40.0
  },
  {
    name: 'Red Bull Energy Drink 250ml',
    description: 'Energy drink with caffeine and taurine',
    price: 3.99,
    stock: {
      godown: 360,
      store: 40,
      total: 400,
      reserved: 0
    },
    quantity: 400,
    qrCode: 'RB250ML001',
    category: null,
    expirationDate: new Date(Date.now() + 540 * 24 * 60 * 60 * 1000), // 18 months
    lowStockThreshold: 100,
    imageUrl: 'https://images.unsplash.com/photo-1571979195097-59d223315f90?w=400&h=400&fit=crop',
    shopId: null,
    barcode: '9002490100008',
    weight: 250,
    dimensions: { length: 5.3, width: 5.3, height: 11 },
    tags: ['energy drink', 'caffeine', 'sports']
  },
  {
    name: 'Marlboro Red Cigarettes',
    description: 'Classic full flavor cigarettes - 20 pack',
    price: 12.99,
    stock: {
      godown: 150,
      store: 30,
      total: 180,
      reserved: 0
    },
    quantity: 180,
    qrCode: 'MARLRED001',
    category: null,
    expirationDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000), // 2 years
    lowStockThreshold: 50,
    imageUrl: 'https://images.unsplash.com/photo-1568443120949-c35acdfd56ea?w=400&h=400&fit=crop',
    shopId: null,
    barcode: '7622210923196',
    weight: 20,
    dimensions: { length: 8.7, width: 5.5, height: 2.5 },
    tags: ['tobacco', 'cigarettes'],
    isTobacco: true,
    ageRestricted: true
  }
];

async function createSampleProducts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_management');
    console.log('Connected to MongoDB');

    // Get or create a default user (admin)
    let defaultUser = await User.findOne().populate('role');
    if (!defaultUser) {
      console.log('No users found. Please run createDeveloper.js first');
      return;
    }

    console.log(`Using user: ${defaultUser.username} with role: ${defaultUser.role?.name || 'Unknown'}`);

    // Get or create default shop
    let defaultShop = await Shop.findOne();
    if (!defaultShop) {
      defaultShop = new Shop({
        name: 'Default Shop',
        address: {
          street: '123 Main Street',
          city: 'Default City',
          state: 'Default State',
          postalCode: '12345',
          country: 'Default Country'
        },
        phone: '555-0123',
        email: 'shop@example.com',
        owner: defaultUser._id,
        subscription: {
          plan: 'free',
          status: 'active',
          startDate: new Date(),
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        },
        isActive: true
      });
      await defaultShop.save();
      console.log('Created default shop');
    }

    // Get or create default category
    let defaultCategory = await Category.findOne();
    if (!defaultCategory) {
      defaultCategory = new Category({
        name: 'General',
        description: 'General products category',
        shop: defaultShop._id,
        createdBy: defaultUser._id
      });
      await defaultCategory.save();
      console.log('Created default category');
    }

    // Get default shop from user or use created shop
    const defaultShopId = defaultUser.shopId || defaultShop._id;

    // Clear existing products (optional - comment out if you want to keep existing)
    // await Product.deleteMany({});
    // console.log('Cleared existing products');

    // Create products with proper stock structure
    const createdProducts = [];
    
    for (const productData of sampleProducts) {
      // Check if product already exists
      const existingProduct = await Product.findOne({ qrCode: productData.qrCode });
      if (existingProduct) {
        console.log(`Product with QR code ${productData.qrCode} already exists, skipping...`);
        continue;
      }

      // Set default values
      productData.category = defaultCategory._id;
      productData.shopId = defaultShopId;
      productData.createdBy = defaultUser._id;

      const product = new Product(productData);
      await product.save();
      createdProducts.push(product);

      // Create initial stock movement record for godown stock
      const stockMovement = new StockMovement({
        productId: product._id,
        movementType: 'godown_in',
        fromLocation: 'supplier',
        toLocation: 'godown',
        quantity: product.stock.godown,
        previousStock: { godown: 0, store: 0, total: 0 },
        newStock: {
          godown: product.stock.godown,
          store: 0,
          total: product.stock.godown
        },
        reason: 'Initial stock setup',
        performedBy: defaultUser._id
      });
      await stockMovement.save();

      // If there's store stock, create movement for that too
      if (product.stock.store > 0) {
        const storeMovement = new StockMovement({
          productId: product._id,
          movementType: 'godown_to_store',
          fromLocation: 'godown',
          toLocation: 'store',
          quantity: product.stock.store,
          previousStock: {
            godown: product.stock.godown + product.stock.store,
            store: 0,
            total: product.stock.total
          },
          newStock: {
            godown: product.stock.godown,
            store: product.stock.store,
            total: product.stock.total
          },
          reason: 'Initial store stock allocation',
          performedBy: defaultUser._id
        });
        await storeMovement.save();
      }

      console.log(`Created product: ${product.name} - Godown: ${product.stock.godown}, Store: ${product.stock.store}, Total: ${product.stock.total}`);
    }

    console.log(`\n✅ Successfully created ${createdProducts.length} sample products with stock tracking!`);
    
    // Display summary
    const totalProducts = await Product.countDocuments();
    const totalGodownStock = await Product.aggregate([
      { $group: { _id: null, total: { $sum: '$stock.godown' } } }
    ]);
    const totalStoreStock = await Product.aggregate([
      { $group: { _id: null, total: { $sum: '$stock.store' } } }
    ]);

    console.log(`\n📊 Stock Summary:`);
    console.log(`Total Products: ${totalProducts}`);
    console.log(`Total Godown Stock: ${totalGodownStock[0]?.total || 0}`);
    console.log(`Total Store Stock: ${totalStoreStock[0]?.total || 0}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating sample products:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createSampleProducts();
}

module.exports = createSampleProducts;
