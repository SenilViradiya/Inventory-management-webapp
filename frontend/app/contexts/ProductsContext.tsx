import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { productsAPI } from '../lib/api';

interface Category {
  _id: string;
  name: string;
  description?: string;
  parent?: string;
  children?: Category[];
  isActive: boolean;
  icon?: string;
  color?: string;
}

interface Product {
  _id: string;
  name: string;
  price: number;
  quantity: number; // Legacy field for backward compatibility
  stock?: {
    godown: number;
    store: number;
    total: number;
    reserved: number;
  };
  qrCode: string;
  image?: string;
  imageUrl?: string;
  category: string;
  expirationDate: string;
  description?: string;
  lowStockThreshold?: number;
  createdAt: string;
  updatedAt: string;
  minimumStock?: number;
}

interface ProductsContextType {
  products: Product[];
  categories: Category[];
  loading: boolean;
  categoriesLoading: boolean;
  refreshProducts: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  updateProductQuantity: (productId: string, newQuantity: number) => void;
}

const ProductsContext = createContext<ProductsContextType | null>(null);

export const useProducts = () => {
  const context = useContext(ProductsContext);
  if (!context) {
    // Return default values when context is not available (e.g., on login page)
    return {
      products: [],
      categories: [],
      loading: false,
      categoriesLoading: false,
      refreshProducts: async () => {},
      refreshCategories: async () => {},
      updateProductQuantity: () => {}
    };
  }
  return context;
};

interface ProductsProviderProps {
  children: React.ReactNode;
}

export const ProductsProvider: React.FC<ProductsProviderProps> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const [lastCategoriesFetch, setLastCategoriesFetch] = useState<number>(0);

  const refreshProducts = async (force: boolean = false) => {
    try {
      // Avoid too frequent refreshes (minimum 5 seconds between calls)
      const now = Date.now();
      if (!force && (now - lastFetch) < 5000 && products.length > 0) {
        return;
      }

      // Only show loading for initial fetch or when forced
      if (products.length === 0 || force) {
        setLoading(true);
      }
      
      const response = await productsAPI.getAll();
      setProducts(response.data.products || response.data || []);
      setLastFetch(now);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshCategories = async (force: boolean = false) => {
    try {
      // Avoid too frequent refreshes (minimum 30 seconds between calls)
      const now = Date.now();
      if (!force && (now - lastCategoriesFetch) < 30000 && categories.length > 0) {
        return;
      }

      // Only show loading for initial fetch or when forced
      if (categories.length === 0 || force) {
        setCategoriesLoading(true);
      }
      
      const token = Cookies.get('authToken');
      const response = await fetch('http://localhost:5001/api/categories/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const categoriesData = await response.json();
        setCategories(categoriesData);
        setLastCategoriesFetch(now);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const updateProductQuantity = (productId: string, newQuantity: number) => {
    setProducts(prevProducts =>
      prevProducts.map(product =>
        product._id === productId
          ? { ...product, quantity: newQuantity }
          : product
      )
    );
  };

  useEffect(() => {
    // Initial load with force=true to ensure we always fetch on mount
    refreshProducts(true);
    refreshCategories(true);
  }, []);

  const value = {
    products,
    categories,
    loading,
    categoriesLoading,
    refreshProducts,
    refreshCategories,
    updateProductQuantity
  };

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
};
