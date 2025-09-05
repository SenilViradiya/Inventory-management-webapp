// Core API Response Types
export interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data?: T[];
  items?: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

// Product Types
export interface Product {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  qrCode: string;
  image?: string;
  imageUrl?: string;
  category: string;
  categoryId?: string;
  expirationDate?: string;
  minimumStock?: number;
  lowStockThreshold?: number;
  brand?: string;
  description?: string;
  sku?: string;
  barcode?: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  stock?: {
    total: number;
    godown: number;
    store: number;
  };
  isLowStock?: boolean;
  isExpiringSoon?: boolean;
  isExpired?: boolean;
  shopId?: string;
  createdBy?: {
    _id: string;
    username: string;
    fullName?: string;
  };
  updatedBy?: {
    _id: string;
    username: string;
    fullName?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProductFormData {
  name: string;
  price: number;
  quantity?: number;
  qrCode: string;
  image?: string;
  imageUrl?: string;
  category: string;
  categoryId?: string;
  expirationDate?: string;
  minimumStock?: number;
  lowStockThreshold?: number;
  brand?: string;
  description?: string;
  sku?: string;
  barcode?: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  shopId: string;
}

// Product Batch Types
export interface ProductBatch {
  _id: string;
  productId: string | Product;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  totalQty: number;
  availableQty: number;
  location: {
    godown: number;
    store: number;
  };
  status: 'active' | 'expired' | 'recalled';
  costPrice?: number;
  sellingPrice?: number;
  supplierInfo?: {
    supplierId?: string;
    supplierName?: string;
    purchaseOrderId?: string;
  };
  qualityChecks?: Array<{
    checkDate: string;
    status: 'passed' | 'failed' | 'pending';
    notes?: string;
    checkedBy: string;
  }>;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  daysUntilExpiry?: number;
  createdAt: string;
  updatedAt: string;
}

// Category Types
export interface Category {
  _id: string;
  name: string;
  description?: string;
  parentCategory?: string;
  subcategories?: Category[];
  isActive: boolean;
  sortOrder?: number;
  image?: string;
  metadata?: {
    productCount?: number;
    totalValue?: number;
    avgPrice?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CategoryFormData {
  name: string;
  description?: string;
  parentCategory?: string;
  isActive?: boolean;
  sortOrder?: number;
  image?: string;
}

// User Types
export interface User {
  _id: string;
  username: string;
  email: string;
  fullName?: string;
  role: {
    _id: string;
    name: string;
    permissions: string[];
  };
  businessId?: string;
  businessName?: string;
  shopId?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserFormData {
  username: string;
  email: string;
  password?: string;
  fullName?: string;
  role: string;
  businessId?: string;
  shopId?: string;
  isActive?: boolean;
}

// Alert Types
export interface Alert {
  _id: string;
  title: string;
  message: string;
  type: 'low_stock' | 'expired_product' | 'expiring_soon' | 'subscription_expiring' | 'order_update' | 'system' | 'custom';
  severity: 'info' | 'warning' | 'error' | 'critical';
  shop?: string;
  user?: string;
  relatedEntity?: {
    entityType: 'product' | 'order' | 'subscription' | 'inquiry' | 'purchase_order';
    entityId: string;
  };
  isRead: boolean;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedNotes?: string;
  metadata?: Record<string, any>;
  actions?: Array<{
    label: string;
    action: string;
    data?: Record<string, any>;
  }>;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Promotion Types
export interface Promotion {
  _id: string;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'bulk_discount';
  value: number;
  minQuantity?: number;
  maxQuantity?: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  startDate: string;
  endDate: string;
  isActive: boolean;
  usageLimit?: number;
  usedCount?: number;
  conditions?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionFormData {
  name: string;
  description?: string;
  type: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'bulk_discount';
  value: number;
  minQuantity?: number;
  maxQuantity?: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  startDate: string;
  endDate: string;
  isActive?: boolean;
  usageLimit?: number;
  conditions?: Record<string, any>;
}

// Order Types
export interface Order {
  _id: string;
  orderNumber: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  totalAmount: number;
  discountAmount?: number;
  finalAmount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod?: string;
  notes?: string;
  createdBy: string;
  shopId: string;
  createdAt: string;
  updatedAt: string;
}

// Supplier Types
export interface Supplier {
  _id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  website?: string;
  taxId?: string;
  paymentTerms?: string;
  notes?: string;
  isActive: boolean;
  rating?: number;
  totalOrders?: number;
  totalValue?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierFormData {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  website?: string;
  taxId?: string;
  paymentTerms?: string;
  notes?: string;
  isActive?: boolean;
  rating?: number;
}

// Purchase Order Types
export interface PurchaseOrder {
  _id: string;
  orderNumber: string;
  supplier: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  totalAmount: number;
  status: 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled';
  expectedDelivery?: string;
  actualDelivery?: string;
  notes?: string;
  createdBy: string;
  shopId: string;
  createdAt: string;
  updatedAt: string;
}

// Stock Movement Types
export interface StockMovement {
  _id: string;
  productId: string;
  action: 'add' | 'remove' | 'transfer' | 'adjustment' | 'sale' | 'purchase' | 'return';
  change: number;
  quantityBefore: number;
  quantityAfter: number;
  location: {
    from?: 'godown' | 'store';
    to?: 'godown' | 'store';
  };
  reason?: string;
  notes?: string;
  relatedDocument?: {
    type: 'order' | 'purchase_order' | 'adjustment' | 'transfer';
    id: string;
  };
  createdBy: string;
  shopId: string;
  createdAt: string;
}

// Activity Log Types
export interface ActivityLog {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, any>;
  user: {
    _id: string;
    username: string;
    fullName?: string;
  };
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// Analytics Types
export interface DashboardStats {
  totalProducts: number;
  totalCategories: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalUsers?: number;
  activeUsers?: number;
  totalOrganizations?: number;
  activeOrganizations?: number;
}

export interface AnalyticsData {
  sales: {
    today: number;
    week: number;
    month: number;
    year: number;
  };
  orders: {
    today: number;
    week: number;
    month: number;
    year: number;
  };
  revenue: {
    today: number;
    week: number;
    month: number;
    year: number;
  };
  topProducts: Array<{
    _id: string;
    name: string;
    sales: number;
    revenue: number;
  }>;
  categoryAnalytics: Array<{
    _id: string;
    name: string;
    productCount: number;
    totalValue: number;
  }>;
}

// Developer Types
export interface DeveloperAppSummary {
  appName: string;
  totalEndpoints: number;
  activeEndpoints: number;
  successRate: number;
  avgResponseTime: number;
  totalRequests: number;
  errorRate: number;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
  diskUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  activeConnections: number;
  requestsPerMinute: number;
}

export interface APIEndpoint {
  path: string;
  method: string;
  description: string;
  status: 'active' | 'deprecated' | 'maintenance';
  category: string;
  responseTime?: number;
  successRate?: number;
  lastUsed?: string;
}

// Common Filter Types
export interface ProductFilters {
  category?: string;
  search?: string;
  lowStock?: boolean;
  expiringSoon?: boolean;
  expired?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CategoryFilters {
  search?: string;
  isActive?: boolean;
  hasProducts?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Export API Response Types
export interface StockSummaryExportData {
  categories: Array<{
    _id: string;
    name: string;
    description?: string;
    productCount: number;
    totalQuantity: number;
    totalValue: number;
    averagePrice: number;
    lowStockCount: number;
    outOfStockCount: number;
    products: Array<{
      _id: string;
      name: string;
      qrCode: string;
      price: number;
      quantity: number;
      totalValue: number;
      isLowStock: boolean;
      isExpiringSoon: boolean;
      isExpired: boolean;
    }>;
  }>;
  summary: {
    totalCategories: number;
    totalProducts: number;
    totalQuantity: number;
    totalValue: number;
    averagePrice: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    expiringProducts: number;
  };
  exportedAt: string;
  exportedBy: string;
}
