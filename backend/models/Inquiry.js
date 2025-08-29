const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['general', 'support', 'sales', 'technical', 'billing', 'feature_request'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['new', 'in_progress', 'resolved', 'closed'],
    default: 'new'
  },
  source: {
    type: String,
    enum: ['website', 'email', 'phone', 'chat', 'social_media'],
    default: 'website'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  responses: [{
    message: {
      type: String,
      required: true
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    respondedAt: {
      type: Date,
      default: Date.now
    },
    isInternal: {
      type: Boolean,
      default: false
    }
  }],
  tags: [{
    type: String,
    lowercase: true
  }],
  metadata: {
    userAgent: String,
    ipAddress: String,
    referrer: String,
    utm: {
      source: String,
      medium: String,
      campaign: String
    }
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  satisfaction: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    submittedAt: Date
  }
}, {
  timestamps: true
});

// Virtual for response time (first response)
inquirySchema.virtual('firstResponseTime').get(function() {
  if (!this.responses || this.responses.length === 0) return null;
  
  const firstResponse = this.responses[0];
  const timeDiff = firstResponse.respondedAt - this.createdAt;
  
  return Math.round(timeDiff / (1000 * 60 * 60)); // in hours
});

// Virtual for resolution time
inquirySchema.virtual('resolutionTime').get(function() {
  if (!this.resolvedAt) return null;
  
  const timeDiff = this.resolvedAt - this.createdAt;
  return Math.round(timeDiff / (1000 * 60 * 60)); // in hours
});

// Virtual for age in days
inquirySchema.virtual('ageInDays').get(function() {
  const timeDiff = new Date() - this.createdAt;
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
});

// Indexes
inquirySchema.index({ status: 1, priority: -1 });
inquirySchema.index({ type: 1 });
inquirySchema.index({ email: 1 });
inquirySchema.index({ createdAt: -1 });
inquirySchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('Inquiry', inquirySchema);
