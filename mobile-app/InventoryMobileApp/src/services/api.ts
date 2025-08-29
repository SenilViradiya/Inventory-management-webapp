import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://192.168.1.14:5001/api';

const apiClient = {
  get: async (endpoint: string) => {
    const token = await AsyncStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  post: async (endpoint: string, data?: any) => {
    const token = await AsyncStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  patch: async (endpoint: string, data?: any) => {
    const token = await AsyncStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },
};

// API endpoints
export const authAPI = {
  login: (credentials: {email: string; password: string}) =>
    apiClient.post('/users/login', credentials),
};

export const productsAPI = {
  getAll: (filters?: any) => {
    const query = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiClient.get(`/products${query}`);
  },
  getByBarcode: (qrCode: string) => apiClient.get(`/products/barcode/${qrCode}`),
  updateQuantity: (id: string, quantity: number) => apiClient.patch(`/products/${id}/quantity`, { quantity }),
};

export const analyticsAPI = {
  getDashboard: () => apiClient.get('/analytics/dashboard'),
};
