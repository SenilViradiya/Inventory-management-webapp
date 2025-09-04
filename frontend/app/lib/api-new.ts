import axios from 'axios';
import toast from 'react-hot-toast';
import type { 
  Product, 
  ProductFormData, 
  Category, 
  CategoryFormData,
  User, 
  UserFormData,
  Alert,
  Promotion,
  PromotionFormData,
  Order,
  Supplier,
  SupplierFormData,
  PurchaseOrder,
  StockMovement,
  ActivityLog,
  DashboardStats,
  AnalyticsData,
  ApiResponse,
  PaginatedResponse,
  ProductBatch
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            const hasStoredAuth = document.cookie.includes('authToken=');

            if (hasStoredAuth && currentPath !== '/login') {
              toast.error('Session expired. Please login again.');
              document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
              document.cookie = 'userData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

              if (currentPath !== '/login') {
                window.location.href = '/login';
              }
            }
          }
          break;

        case 403:
          toast.error('Access denied. Insufficient permissions.');
          break;

        case 404:
          toast.error('Resource not found.');
          break;

        case 500:
          toast.error('Server error. Please try again later.');
          break;

        default:
          if (data?.message) {
            toast.error(data.message);
          } else {
            toast.error('An unexpected error occurred.');
          }
      }
    } else if (error.request) {
      toast.error('Network error. Please check your connection.');
    } else {
      toast.error('An error occurred. Please try again.');
    }

    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/users/login', credentials),

  signup: (userData: { username: string; email: string; password: string; fullName: string }) =>
    api.post('/users/signup', userData),

  logout: () =>
    api.post('/users/logout'),

  getProfile: () =>
    api.get('/users/profile'),

  updateProfile: (userData: Partial<User>) =>
    api.put('/users/profile', userData),

  changePassword: (passwords: { currentPassword: string; newPassword: string }) =>
    api.post('/users/change-password', passwords),
};

// Products API
export const productsAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    lowStock?: boolean;
    expiringSoon?: boolean;
    expired?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => api.get<PaginatedResponse<Product>>('/products', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Product>>(`/products/${id}`),

  create: (productData: FormData) =>
    api.post<ApiResponse<Product>>('/products', productData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  update: (id: string, productData: FormData) =>
    api.put<ApiResponse<Product>>(`/products/${id}`, productData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/products/${id}`),

  getByQRCode: (qrCode: string) =>
    api.get<ApiResponse<Product>>(`/products/qr/${qrCode}`),

  getLowStock: () =>
    api.get<ApiResponse<Product[]>>('/products/low-stock'),

  getExpiring: (days?: number) =>
    api.get<ApiResponse<Product[]>>('/products/expiring', { params: { days } }),

  getExpired: () =>
    api.get<ApiResponse<Product[]>>('/products/expired'),

  bulkUpdate: (products: Array<{ id: string; quantity: number }>) =>
    api.post<ApiResponse<void>>('/products/bulk-update', { products }),

  generateQRCode: () =>
    api.get<ApiResponse<{ qrCode: string }>>('/products/generate-qr'),

  searchByBarcode: (barcode: string) =>
    api.get<ApiResponse<any>>(`/products/barcode/${barcode}`),
};

// Categories API
export const categoriesAPI = {
  getAll: (includeProducts?: boolean) =>
    api.get<ApiResponse<Category[]>>('/categories/list', { 
      params: { includeProducts } 
    }),

  getById: (id: string) =>
    api.get<ApiResponse<Category>>(`/categories/${id}`),

  create: (categoryData: CategoryFormData) =>
    api.post<ApiResponse<Category>>('/categories/create', categoryData),

  update: (id: string, categoryData: Partial<CategoryFormData>) =>
    api.put<ApiResponse<Category>>(`/categories/${id}`, categoryData),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/categories/${id}`),

  getHierarchy: () =>
    api.get<ApiResponse<Category[]>>('/categories/hierarchy'),

  reorder: (categories: Array<{ id: string; sortOrder: number }>) =>
    api.post<ApiResponse<void>>('/categories/reorder', { categories }),
};

// Stock Management API
export const stockAPI = {
  moveToStore: (productId: string, quantity: number, reason?: string, notes?: string) =>
    api.post<ApiResponse<StockMovement>>('/stock/move-to-store', {
      productId,
      quantity,
      reason,
      notes
    }),

  moveToGodown: (productId: string, quantity: number, reason?: string, notes?: string) =>
    api.post<ApiResponse<StockMovement>>('/stock/move-to-godown', {
      productId,
      quantity,
      reason,
      notes
    }),

  bulkMoveToStore: (movements: Array<{
    productId: string;
    quantity: number;
    reason?: string;
    notes?: string;
  }>) => api.post<ApiResponse<StockMovement[]>>('/stock/bulk-move-to-store', { movements }),

  bulkMoveToGodown: (movements: Array<{
    productId: string;
    quantity: number;
    reason?: string;
    notes?: string;
  }>) => api.post<ApiResponse<StockMovement[]>>('/stock/bulk-move-to-godown', { movements }),

  adjustStock: (productId: string, adjustments: {
    godown?: number;
    store?: number;
    reason: string;
    notes?: string;
  }) => api.post<ApiResponse<StockMovement>>('/stock/adjust', {
    productId,
    ...adjustments
  }),

  getMovements: (params?: {
    productId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedResponse<StockMovement>>('/stock/movements', { params }),

  getStockLevels: (productId: string) =>
    api.get<ApiResponse<{
      godown: number;
      store: number;
      total: number;
      reserved: number;
    }>>(`/stock/levels/${productId}`),

  reduceStock: (productId: string, quantity: number, location: 'godown' | 'store', reason?: string) =>
    api.post<ApiResponse<StockMovement>>('/stock/reduce', {
      productId,
      quantity,
      location,
      reason
    }),

  addStock: (productId: string, quantity: number, location: 'godown' | 'store', reason?: string) =>
    api.post<ApiResponse<StockMovement>>('/stock/add', {
      productId,
      quantity,
      location,
      reason
    }),
};

// Batches API
export const batchesAPI = {
  getAll: (productId?: string) =>
    api.get<ApiResponse<ProductBatch[]>>('/batches', { params: { productId } }),

  getById: (id: string) =>
    api.get<ApiResponse<ProductBatch>>(`/batches/${id}`),

  create: (batchData: {
    productId: string;
    batchNumber: string;
    quantity: number;
    costPrice: number;
    sellingPrice: number;
    expirationDate: string;
    manufactureDate?: string;
    supplier?: string;
    location: 'godown' | 'store';
  }) => api.post<ApiResponse<ProductBatch>>('/batches', batchData),

  update: (id: string, batchData: Partial<ProductBatch>) =>
    api.put<ApiResponse<ProductBatch>>(`/batches/${id}`, batchData),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/batches/${id}`),

  getExpiring: (days?: number) =>
    api.get<ApiResponse<ProductBatch[]>>('/batches/expiring', { params: { days } }),

  getFEFO: (productId: string) =>
    api.get<ApiResponse<ProductBatch[]>>(`/batches/fefo/${productId}`),
};

// Analytics API
export const analyticsAPI = {
  getDashboard: () =>
    api.get<ApiResponse<DashboardStats>>('/analytics/dashboard'),

  getTodaySales: () =>
    api.get<ApiResponse<AnalyticsData>>('/analytics/today-sales'),

  getSalesTrend: (period?: 'week' | 'month' | 'year') =>
    api.get<ApiResponse<any>>('/analytics/sales-trend', { params: { period } }),

  getCategoryAnalytics: () =>
    api.get<ApiResponse<any>>('/analytics/categories'),

  getStockAnalytics: () =>
    api.get<ApiResponse<any>>('/analytics/stock'),

  getTopProducts: (limit?: number) =>
    api.get<ApiResponse<any>>('/analytics/top-products', { params: { limit } }),

  getDetailedAnalytics: (startDate: string, endDate: string) =>
    api.get<ApiResponse<any>>('/analytics/detail', { 
      params: { startDate, endDate } 
    }),

  exportData: (format: 'csv' | 'pdf', startDate: string, endDate: string) =>
    api.get(`/analytics/export/${format}`, {
      params: { startDate, endDate },
      responseType: 'blob'
    }),
};

// Alerts API
export const alertsAPI = {
  getAll: (params?: {
    type?: string;
    severity?: string;
    isRead?: boolean;
    isResolved?: boolean;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedResponse<Alert>>('/alerts', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Alert>>(`/alerts/${id}`),

  markAsRead: (id: string) =>
    api.patch<ApiResponse<Alert>>(`/alerts/${id}/read`),

  markAsResolved: (id: string, notes?: string) =>
    api.patch<ApiResponse<Alert>>(`/alerts/${id}/resolve`, { notes }),

  bulkMarkAsRead: (ids: string[]) =>
    api.post<ApiResponse<void>>('/alerts/bulk-read', { ids }),

  getUnreadCount: () =>
    api.get<ApiResponse<{ count: number }>>('/alerts/unread-count'),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/alerts/${id}`),

  generateAlerts: () =>
    api.post<ApiResponse<void>>('/alerts/generate'),
};

// Promotions API
export const promotionsAPI = {
  getAll: (params?: {
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedResponse<Promotion>>('/promotions', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Promotion>>(`/promotions/${id}`),

  create: (promotionData: PromotionFormData) =>
    api.post<ApiResponse<Promotion>>('/promotions', promotionData),

  update: (id: string, promotionData: Partial<PromotionFormData>) =>
    api.put<ApiResponse<Promotion>>(`/promotions/${id}`, promotionData),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/promotions/${id}`),

  activate: (id: string) =>
    api.patch<ApiResponse<Promotion>>(`/promotions/${id}/activate`),

  deactivate: (id: string) =>
    api.patch<ApiResponse<Promotion>>(`/promotions/${id}/deactivate`),

  getActive: () =>
    api.get<ApiResponse<Promotion[]>>('/promotions/active'),

  calculateDiscount: (productId: string, quantity: number, promotionId?: string) =>
    api.post<ApiResponse<{
      originalPrice: number;
      discountAmount: number;
      finalPrice: number;
      appliedPromotion?: Promotion;
    }>>('/promotions/calculate', { productId, quantity, promotionId }),
};

// Users API
export const usersAPI = {
  getAll: (params?: {
    role?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedResponse<User>>('/users', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<User>>(`/users/${id}`),

  create: (userData: UserFormData) =>
    api.post<ApiResponse<User>>('/users', userData),

  update: (id: string, userData: Partial<UserFormData>) =>
    api.put<ApiResponse<User>>(`/users/${id}`, userData),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/users/${id}`),

  activate: (id: string) =>
    api.patch<ApiResponse<User>>(`/users/${id}/activate`),

  deactivate: (id: string) =>
    api.patch<ApiResponse<User>>(`/users/${id}/deactivate`),

  resetPassword: (id: string) =>
    api.post<ApiResponse<{ temporaryPassword: string }>>(`/users/${id}/reset-password`),

  getRoles: () =>
    api.get<ApiResponse<Array<{ _id: string; name: string; permissions: string[] }>>>('/roles'),
};

// Orders API
export const ordersAPI = {
  getAll: (params?: {
    status?: string;
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedResponse<Order>>('/orders', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Order>>(`/orders/${id}`),

  create: (orderData: {
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    items: Array<{
      productId: string;
      quantity: number;
    }>;
    notes?: string;
  }) => api.post<ApiResponse<Order>>('/orders', orderData),

  update: (id: string, orderData: Partial<Order>) =>
    api.put<ApiResponse<Order>>(`/orders/${id}`, orderData),

  updateStatus: (id: string, status: string) =>
    api.patch<ApiResponse<Order>>(`/orders/${id}/status`, { status }),

  cancel: (id: string, reason?: string) =>
    api.patch<ApiResponse<Order>>(`/orders/${id}/cancel`, { reason }),

  generateInvoice: (id: string) =>
    api.get(`/orders/${id}/invoice`, { responseType: 'blob' }),
};

// Suppliers API
export const suppliersAPI = {
  getAll: (params?: {
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedResponse<Supplier>>('/suppliers', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Supplier>>(`/suppliers/${id}`),

  create: (supplierData: SupplierFormData) =>
    api.post<ApiResponse<Supplier>>('/suppliers', supplierData),

  update: (id: string, supplierData: Partial<SupplierFormData>) =>
    api.put<ApiResponse<Supplier>>(`/suppliers/${id}`, supplierData),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/suppliers/${id}`),

  activate: (id: string) =>
    api.patch<ApiResponse<Supplier>>(`/suppliers/${id}/activate`),

  deactivate: (id: string) =>
    api.patch<ApiResponse<Supplier>>(`/suppliers/${id}/deactivate`),
};

// Purchase Orders API
export const purchaseOrdersAPI = {
  getAll: (params?: {
    status?: string;
    supplierId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedResponse<PurchaseOrder>>('/purchase-orders', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`),

  create: (poData: {
    supplierId: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>;
    expectedDeliveryDate?: string;
    notes?: string;
  }) => api.post<ApiResponse<PurchaseOrder>>('/purchase-orders', poData),

  update: (id: string, poData: Partial<PurchaseOrder>) =>
    api.put<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`, poData),

  updateStatus: (id: string, status: string) =>
    api.patch<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/status`, { status }),

  receive: (id: string, receivedItems: Array<{
    productId: string;
    quantity: number;
    condition: 'good' | 'damaged' | 'partial';
  }>) => api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/receive`, { receivedItems }),

  generatePO: (id: string) =>
    api.get(`/purchase-orders/${id}/generate`, { responseType: 'blob' }),
};

// Reports API
export const reportsAPI = {
  getSalesReport: (startDate: string, endDate: string, format: 'json' | 'csv' | 'pdf' = 'json') =>
    api.get('/reports/sales', {
      params: { startDate, endDate, format },
      responseType: format === 'json' ? 'json' : 'blob'
    }),

  getInventoryReport: (format: 'json' | 'csv' | 'pdf' = 'json') =>
    api.get('/reports/inventory', {
      params: { format },
      responseType: format === 'json' ? 'json' : 'blob'
    }),

  getStockMovementReport: (startDate: string, endDate: string, format: 'json' | 'csv' | 'pdf' = 'json') =>
    api.get('/reports/stock-movements', {
      params: { startDate, endDate, format },
      responseType: format === 'json' ? 'json' : 'blob'
    }),

  getLowStockReport: (format: 'json' | 'csv' | 'pdf' = 'json') =>
    api.get('/reports/low-stock', {
      params: { format },
      responseType: format === 'json' ? 'json' : 'blob'
    }),

  getExpiryReport: (days: number = 30, format: 'json' | 'csv' | 'pdf' = 'json') =>
    api.get('/reports/expiry', {
      params: { days, format },
      responseType: format === 'json' ? 'json' : 'blob'
    }),
};

// Activity Logs API
export const activityAPI = {
  getLogs: (params?: {
    userId?: string;
    action?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedResponse<ActivityLog>>('/analytics/activity-logs', { params }),

  getRecentActivity: (limit?: number) =>
    api.get<ApiResponse<ActivityLog[]>>('/analytics/recent-activity', { params: { limit } }),
};

// Upload API
export const uploadAPI = {
  uploadImage: (file: File, folder: string = 'products') => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', folder);
    
    return api.post<ApiResponse<{
      url: string;
      filename: string;
      size: number;
    }>>('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  deleteImage: (filename: string) =>
    api.delete<ApiResponse<void>>(`/upload/image/${filename}`),
};

export default api;
