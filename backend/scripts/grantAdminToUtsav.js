const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Role = require('../models/Role');

async function grantAdminToUtsav() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:admin@inventorey-management-u.ysm2eig.mongodb.net/inventory_management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find admin role
    const adminRole = await Role.findOne({ name: 'admin' });
    if (!adminRole) throw new Error('Admin role not found');

    // Find user
    const user = await User.findOne({ email: 'utsavparmar161@gmail.com' });
    if (!user) throw new Error('User not found');

    // Update role
    user.role = adminRole._id;
    user.organizationRole = 'admin';
    await user.save();
    console.log('User role updated to admin for:', user.email);
  } catch (error) {
    console.error('Error updating user role:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

grantAdminToUtsav();
