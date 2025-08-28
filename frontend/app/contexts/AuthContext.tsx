'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'staff';
  lastLogin: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  handleSessionExpiry: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for stored authentication on mount
    const storedToken = Cookies.get('authToken');
    const storedUser = Cookies.get('userData');

    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(userData);
        
        // Set default authorization header
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        // Clear invalid stored data
        Cookies.remove('authToken');
        Cookies.remove('userData');
      }
    }
    
    // Set loading to false immediately after checking - no delay needed
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const response = await api.post('/users/login', { email, password });
      const { token: authToken, user: userData } = response.data;

      // Store in cookies (expires in 8 hours)
      Cookies.set('authToken', authToken, { expires: 1/3 });
      Cookies.set('userData', JSON.stringify(userData), { expires: 1/3 });

      // Set state
      setToken(authToken);
      setUser(userData);

      // Set default authorization header
      api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

      toast.success('Login successful!');
      
      // Small delay before redirect to ensure state is updated
      setTimeout(() => {
        router.push('/dashboard');
      }, 100);
      
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Clear cookies
    Cookies.remove('authToken');
    Cookies.remove('userData');

    // Clear state
    setToken(null);
    setUser(null);

    // Remove authorization header
    delete api.defaults.headers.common['Authorization'];

    toast.success('Logged out successfully');
    
    // Redirect to login
    router.push('/login');
  };

  const handleSessionExpiry = () => {
    // Silent logout without success message
    Cookies.remove('authToken');
    Cookies.remove('userData');
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      
      // Update stored data
      Cookies.set('userData', JSON.stringify(updatedUser), { expires: 1/3 });
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    logout,
    handleSessionExpiry,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
