const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Product = require('../models/Product');

const sampleUsers = [
  {
    username: 'admin',
    email: 'admin@offlicense.com',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin'
  },
  {
    username: 'staff1',
    email: 'staff1@offlicense.com',
    password: 'staff123',
    firstName: 'John',
    lastName: 'Doe',
    role: 'staff'
  },
  {
    username: 'staff2',
    email: 'staff2@offlicense.com',
    password: 'staff123',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'staff'
  }
];

const sampleProducts = [
  // Alcoholic Beverages
  {
    name: 'Heineken Beer 330ml',
    price: 2.50,
    category: 'Beer',
    description: 'Premium lager beer',
    expirationDate: new Date('2024-12-31'),
    quantity: 48,
    qrCode: 'HEIN330',
    lowStockThreshold: 10
  },
  {
    name: 'Corona Extra 355ml',
    price: 3.00,
    category: 'Beer',
    description: 'Light Mexican beer',
    expirationDate: new Date('2024-11-30'),
    quantity: 36,
    qrCode: 'CORN355',
    lowStockThreshold: 8
  },
  {
    name: 'Jack Daniels Whiskey 750ml',
    price: 45.99,
    category: 'Spirits',
    description: 'Tennessee whiskey',
    expirationDate: new Date('2029-08-28'),
    quantity: 12,
    qrCode: 'JACK750',
    lowStockThreshold: 3
  },
  {
    name: 'Smirnoff Vodka 700ml',
    price: 25.99,
    category: 'Spirits',
    description: 'Premium vodka',
    expirationDate: new Date('2028-12-31'),
    quantity: 8,
    qrCode: 'SMIR700',
    lowStockThreshold: 4
  },
  {
    name: 'Chardonnay Wine 750ml',
    price: 18.99,
    category: 'Wine',
    description: 'Dry white wine',
    expirationDate: new Date('2026-09-15'),
    quantity: 24,
    qrCode: 'CHAR750',
    lowStockThreshold: 6
  },
  {
    name: 'Cabernet Sauvignon 750ml',
    price: 22.99,
    category: 'Wine',
    description: 'Full-bodied red wine',
    expirationDate: new Date('2027-03-20'),
    quantity: 18,
    qrCode: 'CABS750',
    lowStockThreshold: 5
  },

  // Non-Alcoholic Beverages
  {
    name: 'Coca-Cola 330ml',
    price: 1.25,
    category: 'Soft Drinks',
    description: 'Classic cola',
    expirationDate: new Date('2024-10-15'),
    quantity: 72,
    qrCode: 'COKE330',
    lowStockThreshold: 20
  },
  {
    name: 'Pepsi Cola 330ml',
    price: 1.20,
    category: 'Soft Drinks',
    description: 'Cola drink',
    expirationDate: new Date('2024-10-20'),
    quantity: 60,
    qrCode: 'PEPS330',
    lowStockThreshold: 15
  },
  {
    name: 'Red Bull Energy 250ml',
    price: 3.50,
    category: 'Energy Drinks',
    description: 'Energy drink',
    expirationDate: new Date('2024-12-01'),
    quantity: 24,
    qrCode: 'REDB250',
    lowStockThreshold: 8
  },
  {
    name: 'Monster Energy 500ml',
    price: 4.25,
    category: 'Energy Drinks',
    description: 'Energy drink',
    expirationDate: new Date('2024-11-15'),
    quantity: 18,
    qrCode: 'MONS500',
    lowStockThreshold: 6
  },
  {
    name: 'Orange Juice 1L',
    price: 3.99,
    category: 'Juices',
    description: 'Fresh orange juice',
    expirationDate: new Date('2024-09-05'), // Expiring soon!
    quantity: 12,
    qrCode: 'ORAN1L',
    lowStockThreshold: 5
  },
  {
    name: 'Apple Juice 1L',
    price: 3.75,
    category: 'Juices',
    description: 'Pure apple juice',
    expirationDate: new Date('2024-09-10'),
    quantity: 15,
    qrCode: 'APPL1L',
    lowStockThreshold: 5
  },

  // Snacks
  {
    name: 'Pringles Original 165g',
    price: 3.99,
    category: 'Snacks',
    description: 'Potato chips',
    expirationDate: new Date('2024-12-31'),
    quantity: 32,
    qrCode: 'PRIN165',
    lowStockThreshold: 10
  },
  {
    name: 'Kit Kat Chocolate 45g',
    price: 1.50,
    category: 'Snacks',
    description: 'Chocolate wafer bar',
    expirationDate: new Date('2024-11-30'),
    quantity: 48,
    qrCode: 'KITK45',
    lowStockThreshold: 15
  },
  {
    name: 'Doritos Nacho 150g',
    price: 2.99,
    category: 'Snacks',
    description: 'Nacho cheese tortilla chips',
    expirationDate: new Date('2024-10-31'),
    quantity: 28,
    qrCode: 'DORI150',
    lowStockThreshold: 8
  },

  // Cigarettes
  {
    name: 'Marlboro Gold Pack',
    price: 12.50,
    category: 'Cigarettes',
    description: 'Light cigarettes pack of 20',
    expirationDate: new Date('2026-08-28'),
    quantity: 15,
    qrCode: 'MARL20G',
    lowStockThreshold: 5
  },
  {
    name: 'Camel Blue Pack',
    price: 11.99,
    category: 'Cigarettes',
    description: 'Light cigarettes pack of 20',
    expirationDate: new Date('2026-09-15'),
    quantity: 12,
    qrCode: 'CAML20B',
    lowStockThreshold: 5
  },

  // Low stock items for testing
  {
    name: 'Premium Water 500ml',
    price: 1.99,
    category: 'Water',
    description: 'Premium bottled water',
    expirationDate: new Date('2025-08-28'),
    quantity: 3, // Low stock!
    qrCode: 'WATR500',
    lowStockThreshold: 5
  },
  {
    name: 'Energy Bar Chocolate',
    price: 2.25,
    category: 'Snacks',
    description: 'Chocolate energy bar',
    expirationDate: new Date('2024-08-30'), // Expired!
    quantity: 8,
    qrCode: 'EBAR001',
    lowStockThreshold: 5
  },
  {
    name: 'Gatorade Sports Drink',
    price: 2.75,
    category: 'Sports Drinks',
    description: 'Electrolyte sports drink',
    expirationDate: new Date('2024-09-02'), // Expiring very soon!
    quantity: 2, // Low stock!
    qrCode: 'GATO500',
    lowStockThreshold: 8
  }
];

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_management');
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    console.log('Cleared existing data');

    // Create users
    const users = [];
    for (const userData of sampleUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const user = new User({
        ...userData,
        password: hashedPassword
      });
      await user.save();
      users.push(user);
      console.log(`Created user: ${userData.username} (${userData.role})`);
    }

    // Create products (assign to admin user as creator)
    const adminUser = users.find(user => user.role === 'admin');
    
    for (const productData of sampleProducts) {
      const product = new Product({
        ...productData,
        createdBy: adminUser._id
      });
      await product.save();
      console.log(`Created product: ${productData.name}`);
    }

    console.log('\n=== SEEDING COMPLETED ===');
    console.log(`Created ${users.length} users and ${sampleProducts.length} products`);
    console.log('\nDefault login credentials:');
    console.log('Admin: admin@offlicense.com / admin123');
    console.log('Staff: staff1@offlicense.com / staff123');
    console.log('Staff: staff2@offlicense.com / staff123');
    console.log('\nSample QR codes for testing:');
    console.log('- COKE330 (Coca-Cola)');
    console.log('- HEIN330 (Heineken)');
    console.log('- JACK750 (Jack Daniels)');
    console.log('- WATR500 (Low stock item)');
    console.log('- GATO500 (Low stock + expiring soon)');
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
};

// Run the seeding
seedDatabase();
