const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('../models/User');
const Role = require('../models/Role');

// Connect to MongoDB using environment variable
// Set MONGODB_URI in .env file or use default localhost connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB Connection Error:', err));

async function createSimpleDeveloper() {
  try {
    // First create or find the superadmin role
    let superadminRole = await Role.findOne({ name: 'superadmin' });
    
    if (!superadminRole) {
      superadminRole = new Role({
        name: 'superadmin',
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
        ],
        description: 'Developer with full system access'
      });
      await superadminRole.save();
      console.log('✅ Superadmin role created');
    }

    // Check if developer user already exists
    const existingDev = await User.findOne({ email: 'developer@admin.com' });
    if (existingDev) {
      // Delete existing and recreate
      await User.deleteOne({ email: 'developer@admin.com' });
      console.log('🗑️ Existing developer user deleted');
    }

    // Create developer user with proper fields
    const hashedPassword = await bcrypt.hash('Dev@123456', 10);
    
    const developerUser = new User({
      username: 'developer',
      email: 'developer@admin.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Developer',
      role: superadminRole._id,  // Use ObjectId reference
      permissions: [
        'all:access',
        'business:create',
        'business:read',
        'business:update',
        'business:delete',
        'users:manage',
        'trial:extend',
        'system:admin'
      ],
      isActive: true,
      isEmailVerified: true
    });

    await developerUser.save();
    console.log('✅ Developer user created successfully');
    console.log('📧 Email: developer@admin.com');
    console.log('🔑 Password: Dev@123456');
    console.log('👑 Role: superadmin');
    
  } catch (error) {
    console.error('❌ Error creating developer user:', error);
  } finally {
    mongoose.connection.close();
  }
}

createSimpleDeveloper();
