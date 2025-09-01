const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Shop = require('../models/Shop');
const Product = require('../models/Product');

async function addProductsForUtsav() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:admin@inventorey-management-u.ysm2eig.mongodb.net/inventory_management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find user and shop
    const user = await User.findOne({ email: 'utsavparmar161@gmail.com' }).populate('shop');
    if (!user) throw new Error('User not found');
    if (!user.shop) throw new Error('User has no shop assigned');
    const shopId = user.shop._id;
    console.log('Found user and shop:', user.shop.name);

    // Sample products with all schema parameters
    const products = [
      {
        name: 'Coca-Cola 500ml',
        image: 'https://example.com/images/coca-cola-500ml.jpg',
        azureBlobName: '',
        price: 1.5,
        category: 'Non-Alcoholic Beverages',
        description: 'Refreshing soft drink',
        expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180), // 6 months from now
        quantity: 100,
        stock: {
          godown: 60,
          store: 40,
          reserved: 5
        },
        qrCode: 'COCA500ML001',
        lowStockThreshold: 10,
        createdBy: user._id
      },
      {
        name: 'Heineken Beer 330ml',
        image: 'https://example.com/images/heineken-330ml.jpg',
        azureBlobName: '',
        price: 2.0,
        category: 'Alcoholic Beverages',
        description: 'Premium lager beer',
        expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90), // 3 months from now
        quantity: 50,
        stock: {
          godown: 30,
          store: 20,
          reserved: 2
        },
        qrCode: 'HEINEKEN330ML001',
        lowStockThreshold: 8,
        createdBy: user._id
      },
      {
        name: 'Walkers Crisps 45g',
        image: 'https://example.com/images/walkers-crisps-45g.jpg',
        azureBlobName: '',
        price: 1.0,
        category: 'Snacks & Confectionery',
        description: 'Classic salted potato crisps',
        expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60), // 2 months from now
        quantity: 200,
        stock: {
          godown: 120,
          store: 80,
          reserved: 10
        },
        qrCode: 'WALKERS45G001',
        lowStockThreshold: 20,
        createdBy: user._id
      },
      {
        name: 'Marlboro Gold Cigarettes',
        image: 'https://example.com/images/marlboro-gold.jpg',
        azureBlobName: '',
        price: 12.0,
        category: 'Tobacco & Smoking',
        description: 'Pack of 20 premium cigarettes',
        expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year from now
        quantity: 30,
        stock: {
          godown: 15,
          store: 15,
          reserved: 0
        },
        qrCode: 'MARLBOROGOLD001',
        lowStockThreshold: 5,
        createdBy: user._id
      },
      {
        name: 'Evian Water 1L',
        image: 'https://example.com/images/evian-1l.jpg',
        azureBlobName: '',
        price: 1.2,
        category: 'Non-Alcoholic Beverages',
        description: 'Natural mineral water',
        expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120), // 4 months from now
        quantity: 80,
        stock: {
          godown: 50,
          store: 30,
          reserved: 3
        },
        qrCode: 'EVIAN1L001',
        lowStockThreshold: 10,
        createdBy: user._id
      }
    ];

    // Insert products
    const createdProducts = await Product.insertMany(products);
    console.log('Created products:', createdProducts.length);
    createdProducts.forEach(p => {
      console.log(`- ${p.name}: ${p.image}`);
    });

    console.log('\n✅ Products with all schema parameters added successfully!');
    console.log(`📦 Total products added: ${createdProducts.length}`);
  } catch (error) {
    console.error('Error adding products:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

addProductsForUtsav();
