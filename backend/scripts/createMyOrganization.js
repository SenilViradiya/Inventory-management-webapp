const mongoose = require('mongoose');
require('dotenv').config();
const Business = require('../models/Business');
const User = require('../models/User');

// Connect to MongoDB using environment variable
// Set MONGODB_URI in .env file or use default localhost connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function createMyOrganization() {
  try {
    console.log('Creating My Organization...');

    // Check if "My Organization" already exists
    let myOrg = await Business.findOne({ 
      organizationType: 'my-organization',
      name: 'My Organization' 
    });

    if (myOrg) {
      console.log('My Organization already exists:', myOrg.name);
    } else {
      // Create "My Organization"
      myOrg = new Business({
        name: 'My Organization',
        organizationType: 'my-organization',
        owner: {
          name: 'System Developer',
          email: 'developer@admin.com',
          phone: '+1-000-000-0000'
        },
        address: {
          street: '123 Tech Street',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94105',
          country: 'USA'
        },
        subscription: {
          plan: 'enterprise',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          isActive: true
        },
        availableRoles: ['developer', 'tester', 'marketer', 'designer', 'manager', 'admin', 'superadmin'],
        status: 'active'
      });

      await myOrg.save();
      console.log('My Organization created successfully:', myOrg.name);
    }

    // Update developer user to be part of My Organization
    const developerUser = await User.findOne({ email: 'developer@admin.com' });
    if (developerUser) {
      developerUser.organization = myOrg._id;
      developerUser.organizationRole = 'superadmin';
      await developerUser.save();

      // Add developer to organization users
      if (!myOrg.users.includes(developerUser._id)) {
        myOrg.users.push(developerUser._id);
        await myOrg.save();
      }

      console.log('Developer user updated with My Organization');
    }

    console.log('Setup completed successfully!');
    console.log('Organization ID:', myOrg._id);
    console.log('Available roles:', myOrg.availableRoles);

  } catch (error) {
    console.error('Error creating My Organization:', error);
  } finally {
    mongoose.connection.close();
  }
}

createMyOrganization();
