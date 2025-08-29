const mongoose = require('mongoose');

const simpleUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'staff', 'user'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Virtual for full name
simpleUserSchema.virtual('displayName').get(function() {
  return this.fullName || `${this.firstName} ${this.lastName}`;
});

// Update the updatedAt field before saving
simpleUserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for better performance
simpleUserSchema.index({ email: 1 });
simpleUserSchema.index({ username: 1 });

module.exports = mongoose.model('SimpleUser', simpleUserSchema);
