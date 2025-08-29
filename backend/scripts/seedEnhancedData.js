const mongoose = require('mongoose');
const Role = require('../models/Role');
const { SubscriptionPlan } = require('../models/Subscription');

const seedRoles = async () => {
  try {
    // Check if roles already exist
    const existingRoles = await Role.countDocuments();
    if (existingRoles > 0) {
      console.log('Roles already exist, skipping seed...');
      return;
    }

    const roles = [
      {
        name: 'superadmin',
        description: 'Super Administrator with full system access',
        permissions: [
          'view_inventory',
          'edit_inventory',
          'delete_inventory',
          'view_reports',
          'generate_reports',
          'manage_staff',
          'view_analytics',
          'manage_orders',
          'manage_suppliers',
          'manage_categories',
          'view_all_shops',
          'manage_subscriptions',
          'manage_inquiries'
        ]
      },
      {
        name: 'admin',
        description: 'Shop Administrator with full shop management access',
        permissions: [
          'view_inventory',
          'edit_inventory',
          'delete_inventory',
          'view_reports',
          'generate_reports',
          'manage_staff',
          'view_analytics',
          'manage_orders',
          'manage_suppliers',
          'manage_categories'
        ]
      },
      {
        name: 'staff',
        description: 'Staff member with customizable permissions',
        permissions: [
          'view_inventory',
          'edit_inventory'
        ]
      }
    ];

    await Role.insertMany(roles);
    console.log('✅ Roles seeded successfully');

  } catch (error) {
    console.error('❌ Error seeding roles:', error);
  }
};

const seedSubscriptionPlans = async () => {
  try {
    // Check if plans already exist
    const existingPlans = await SubscriptionPlan.countDocuments();
    if (existingPlans > 0) {
      console.log('Subscription plans already exist, skipping seed...');
      return;
    }

    const plans = [
      {
        name: 'free',
        displayName: 'Free Plan',
        description: 'Perfect for small businesses getting started',
        price: {
          monthly: 0,
          yearly: 0
        },
        features: {
          maxProducts: 100,
          maxStaff: 2,
          advancedAnalytics: false,
          exportReports: false,
          apiAccess: false,
          prioritySupport: false,
          customBranding: false,
          multiLocation: false
        },
        sortOrder: 1
      },
      {
        name: 'basic',
        displayName: 'Basic Plan',
        description: 'Great for growing businesses',
        price: {
          monthly: 29,
          yearly: 290
        },
        features: {
          maxProducts: 1000,
          maxStaff: 5,
          advancedAnalytics: true,
          exportReports: true,
          apiAccess: false,
          prioritySupport: false,
          customBranding: false,
          multiLocation: false
        },
        sortOrder: 2
      },
      {
        name: 'premium',
        displayName: 'Premium Plan',
        description: 'Everything you need for enterprise-level inventory management',
        price: {
          monthly: 79,
          yearly: 790
        },
        features: {
          maxProducts: -1, // Unlimited
          maxStaff: -1, // Unlimited
          advancedAnalytics: true,
          exportReports: true,
          apiAccess: true,
          prioritySupport: true,
          customBranding: true,
          multiLocation: true
        },
        sortOrder: 3
      }
    ];

    await SubscriptionPlan.insertMany(plans);
    console.log('✅ Subscription plans seeded successfully');

  } catch (error) {
    console.error('❌ Error seeding subscription plans:', error);
  }
};

const seedEnhancedData = async () => {
  try {
    console.log('🌱 Seeding enhanced data...');
    
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_management');
      console.log('📦 Connected to MongoDB');
    }

    await seedRoles();
    await seedSubscriptionPlans();

    console.log('✅ Enhanced data seeding completed successfully');
    
  } catch (error) {
    console.error('❌ Error in enhanced data seeding:', error);
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedEnhancedData()
    .then(() => {
      console.log('🎉 Seeding process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding process failed:', error);
      process.exit(1);
    });
}

module.exports = {
  seedRoles,
  seedSubscriptionPlans,
  seedEnhancedData
};
