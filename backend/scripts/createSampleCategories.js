const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Shop = require('../models/Shop');
const Category = require('../models/Category');

async function createSampleCategories() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Find the admin user
    const adminUser = await User.findOne({ email: 'admin@offlicense.com' }).populate('shop');
    if (!adminUser) {
      console.error('Admin user not found');
      return;
    }

    if (!adminUser.shop) {
      console.error('Admin user has no shop associated');
      return;
    }

    const shopId = adminUser.shop._id;
    console.log('Found admin user with shop:', adminUser.shop.name);

    // Clear existing categories for this shop
    await Category.deleteMany({ shop: shopId });
    console.log('Cleared existing categories');

    // Create main categories
    const mainCategories = [
      {
        name: 'Alcoholic Beverages',
        description: 'All alcoholic drinks including beer, wine, and spirits',
        icon: '🍺',
        color: '#DC2626',
        shop: shopId,
        createdBy: adminUser._id
      },
      {
        name: 'Non-Alcoholic Beverages',
        description: 'Soft drinks, juices, water, and other non-alcoholic drinks',
        icon: '🥤',
        color: '#2563EB',
        shop: shopId,
        createdBy: adminUser._id
      },
      {
        name: 'Tobacco Products',
        description: 'Cigarettes, cigars, and other tobacco products',
        icon: '🚬',
        color: '#7C2D12',
        shop: shopId,
        createdBy: adminUser._id
      },
      {
        name: 'Snacks & Confectionery',
        description: 'Chips, chocolates, candies, and other snacks',
        icon: '🍫',
        color: '#7C3AED',
        shop: shopId,
        createdBy: adminUser._id
      },
      {
        name: 'Food Items',
        description: 'Ready meals, sandwiches, and other food products',
        icon: '🥪',
        color: '#059669',
        shop: shopId,
        createdBy: adminUser._id
      },
      {
        name: 'Household Items',
        description: 'Basic household and convenience items',
        icon: '🏠',
        color: '#0891B2',
        shop: shopId,
        createdBy: adminUser._id
      }
    ];

    const createdMainCategories = await Category.insertMany(mainCategories);
    console.log('Created main categories:', createdMainCategories.length);

    // Create subcategories for Alcoholic Beverages
    const alcoholicCategory = createdMainCategories.find(cat => cat.name === 'Alcoholic Beverages');
    const alcoholicSubcategories = [
      {
        name: 'Beer',
        description: 'Lagers, ales, stouts, and other beers',
        icon: '🍺',
        color: '#F59E0B',
        shop: shopId,
        parent: alcoholicCategory._id,
        createdBy: adminUser._id
      },
      {
        name: 'Wine',
        description: 'Red, white, rosé, and sparkling wines',
        icon: '🍷',
        color: '#DC2626',
        shop: shopId,
        parent: alcoholicCategory._id,
        createdBy: adminUser._id
      },
      {
        name: 'Spirits',
        description: 'Whiskey, vodka, gin, rum, and other spirits',
        icon: '🥃',
        color: '#92400E',
        shop: shopId,
        parent: alcoholicCategory._id,
        createdBy: adminUser._id
      },
      {
        name: 'Liqueurs',
        description: 'Sweet and flavored alcoholic beverages',
        icon: '🍸',
        color: '#EC4899',
        shop: shopId,
        parent: alcoholicCategory._id,
        createdBy: adminUser._id
      }
    ];

    await Category.insertMany(alcoholicSubcategories);
    console.log('Created alcoholic beverage subcategories');

    // Create subcategories for Non-Alcoholic Beverages
    const nonAlcoholicCategory = createdMainCategories.find(cat => cat.name === 'Non-Alcoholic Beverages');
    const nonAlcoholicSubcategories = [
      {
        name: 'Soft Drinks',
        description: 'Carbonated soft drinks and sodas',
        icon: '🥤',
        color: '#EF4444',
        shop: shopId,
        parent: nonAlcoholicCategory._id,
        createdBy: adminUser._id
      },
      {
        name: 'Water',
        description: 'Still and sparkling water',
        icon: '💧',
        color: '#06B6D4',
        shop: shopId,
        parent: nonAlcoholicCategory._id,
        createdBy: adminUser._id
      },
      {
        name: 'Juices',
        description: 'Fruit juices and smoothies',
        icon: '🧃',
        color: '#F97316',
        shop: shopId,
        parent: nonAlcoholicCategory._id,
        createdBy: adminUser._id
      },
      {
        name: 'Energy Drinks',
        description: 'Energy and sports drinks',
        icon: '⚡',
        color: '#10B981',
        shop: shopId,
        parent: nonAlcoholicCategory._id,
        createdBy: adminUser._id
      },
      {
        name: 'Hot Beverages',
        description: 'Coffee, tea, and hot chocolate',
        icon: '☕',
        color: '#78350F',
        shop: shopId,
        parent: nonAlcoholicCategory._id,
        createdBy: adminUser._id
      }
    ];

    await Category.insertMany(nonAlcoholicSubcategories);
    console.log('Created non-alcoholic beverage subcategories');

    // Create subcategories for Snacks & Confectionery
    const snacksCategory = createdMainCategories.find(cat => cat.name === 'Snacks & Confectionery');
    const snacksSubcategories = [
      {
        name: 'Chips & Crisps',
        description: 'Potato chips, corn chips, and other crisps',
        icon: '🍟',
        color: '#F59E0B',
        shop: shopId,
        parent: snacksCategory._id,
        createdBy: adminUser._id
      },
      {
        name: 'Chocolate',
        description: 'Chocolate bars, pralines, and chocolate treats',
        icon: '🍫',
        color: '#92400E',
        shop: shopId,
        parent: snacksCategory._id,
        createdBy: adminUser._id
      },
      {
        name: 'Candy & Sweets',
        description: 'Gummies, hard candies, and other sweets',
        icon: '🍬',
        color: '#EC4899',
        shop: shopId,
        parent: snacksCategory._id,
        createdBy: adminUser._id
      },
      {
        name: 'Nuts & Seeds',
        description: 'Peanuts, almonds, and other nuts',
        icon: '🥜',
        color: '#78350F',
        shop: shopId,
        parent: snacksCategory._id,
        createdBy: adminUser._id
      }
    ];

    await Category.insertMany(snacksSubcategories);
    console.log('Created snacks & confectionery subcategories');

    console.log('\n✅ Sample categories created successfully!');
    console.log('Total categories created:', 6 + alcoholicSubcategories.length + nonAlcoholicSubcategories.length + snacksSubcategories.length);

  } catch (error) {
    console.error('Error creating sample categories:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
createSampleCategories();
