const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  icon: {
    type: String, // URL or icon name
    default: 'folder'
  },
  color: {
    type: String,
    default: '#6B7280'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// Virtual for getting subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent'
});

// Virtual for getting products in this category
categorySchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category'
});

// Virtual for full path (Parent > Child)
categorySchema.virtual('fullPath').get(function() {
  // This would need to be populated to work properly
  return this.parent ? `${this.parent.name} > ${this.name}` : this.name;
});

// Index for better performance
categorySchema.index({ shop: 1, name: 1 }, { unique: true });
categorySchema.index({ parent: 1 });

// Pre-save middleware
categorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get category hierarchy
categorySchema.statics.getHierarchy = async function(shopId) {
  const categories = await this.find({ shop: shopId, isActive: true })
    .populate('subcategories')
    .sort({ sortOrder: 1, name: 1 });
  
  // Build tree structure
  const categoryMap = new Map();
  const rootCategories = [];
  
  categories.forEach(cat => {
    categoryMap.set(cat._id.toString(), { ...cat.toObject(), children: [] });
  });
  
  categories.forEach(cat => {
    if (cat.parent) {
      const parent = categoryMap.get(cat.parent.toString());
      if (parent) {
        parent.children.push(categoryMap.get(cat._id.toString()));
      }
    } else {
      rootCategories.push(categoryMap.get(cat._id.toString()));
    }
  });
  
  return rootCategories;
};

module.exports = mongoose.model('Category', categorySchema);
