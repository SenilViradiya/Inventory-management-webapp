import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // You can add auth token here if needed
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
    // Handle common error responses
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Only handle session expiry if we're not on login page and we have stored auth data
          if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            const hasStoredAuth = document.cookie.includes('authToken=');
            
            // Only show session expired if user was previously authenticated and not on login page
            if (hasStoredAuth && currentPath !== '/login') {
              toast.error('Session expired. Please login again.');
              
              // Clear stored auth data
              document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
              document.cookie = 'userData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
              
              // Only redirect if not already on login page
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
      // Network error
      toast.error('Network error. Please check your connection.');
    } else {
      // Other error
      toast.error('An error occurred. Please try again.');
    }
    
    return Promise.reject(error);
  }
);

// API functions
export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/users/login', credentials),
  
  logout: () =>
    api.post('/users/logout'),
  
  getProfile: () =>
    api.get('/users/profile'),
  
  updateProfile: (data: any) =>
    api.put('/users/profile', data),
  
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/users/change-password', data),
};

export const productsAPI = {
  getAll: (params?: any) =>
    api.get('/products', { params }),
  
  getById: (id: string) =>
    api.get(`/products/${id}`),
  
  getByQR: (qrCode: string) =>
    api.get(`/products/qr/${qrCode}`),
  
  create: (data: FormData) =>
    api.post('/products', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  update: (id: string, data: FormData) =>
    api.put(`/products/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  delete: (id: string) =>
    api.delete(`/products/${id}`),
  
  getCategories: () =>
    api.get('/products/categories/list'),
};

export const stockAPI = {
  reduce: (data: { qrCode: string; quantity: number; reason?: string }) =>
    api.post('/stock/reduce', data),
  
  increase: (data: { productId: string; quantity: number; reason?: string }) =>
    api.post('/stock/increase', data),
  
  reverse: (logId: string, data?: { reason?: string }) =>
    api.post(`/stock/reverse/${logId}`, data),
  
  getHistory: (productId: string, params?: any) =>
    api.get(`/stock/history/${productId}`, { params }),
  
  getRecentActivities: (params?: any) =>
    api.get('/stock/recent-activities', { params }),
};

export const analyticsAPI = {
  getDashboard: () =>
    api.get('/analytics/dashboard'),
  
  getSalesTrend: (params?: any) =>
    api.get('/analytics/sales-trend', { params }),
  
  getCategoryPerformance: (params?: any) =>
    api.get('/analytics/category-performance', { params }),
  
  getTodaySales: () =>
    api.get('/analytics/today-sales'),
};

export const alertsAPI = {
  getAll: (params?: any) =>
    api.get('/alerts', { params }),
  
  getLowStock: (params?: any) =>
    api.get('/alerts/low-stock', { params }),
  
  getExpiringSoon: (params?: any) =>
    api.get('/alerts/expiring-soon', { params }),
  
  getExpired: (params?: any) =>
    api.get('/alerts/expired', { params }),
  
  getSummary: () =>
    api.get('/alerts/summary'),
  
  markAsRead: (id: string) =>
    api.put(`/alerts/${id}/read`),
  
  markAllAsRead: () =>
    api.put('/alerts/mark-all-read'),
  
  delete: (id: string) =>
    api.delete(`/alerts/${id}`),
  
  clearRead: () =>
    api.delete('/alerts/clear-read'),
};

export const reportsAPI = {
  exportProducts: (format: 'csv' | 'pdf', params?: any) =>
    api.get('/reports/products', { 
      params: { ...params, format },
      responseType: 'blob'
    }),
  
  exportSales: (format: 'csv' | 'pdf', params?: any) =>
    api.get('/reports/sales', { 
      params: { ...params, format },
      responseType: 'blob'
    }),
  
  exportExpiry: (format: 'csv' | 'pdf', params?: any) =>
    api.get('/reports/expiry', { 
      params: { ...params, format },
      responseType: 'blob'
    }),
  
  exportStockValuation: (format: 'csv' | 'pdf', params?: any) =>
    api.get('/reports/stock-valuation', { 
      params: { ...params, format },
      responseType: 'blob'
    }),
};

export const usersAPI = {
  getAll: (params?: any) =>
    api.get('/users', { params }),
  
  register: (data: any) =>
    api.post('/users/register', data),
  
  toggleStatus: (id: string) =>
    api.put(`/users/${id}/toggle-status`),
};
