const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Role = require('../models/Role');

async function checkUtsavPermissions() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:admin@inventorey-management-u.ysm2eig.mongodb.net/inventory_management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Find user
    const user = await User.findOne({ email: 'utsavparmar161@gmail.com' }).populate('role');
    if (!user) throw new Error('User not found');
    console.log('User role:', user.role?.name || user.role);
    console.log('User permissions:', user.permissions);
    if (user.role && user.role.permissions) {
      console.log('Role permissions:', user.role.permissions);
    }
  } catch (error) {
    console.error('Error checking permissions:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

checkUtsavPermissions();
