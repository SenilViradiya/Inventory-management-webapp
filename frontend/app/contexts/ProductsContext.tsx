import React, { createContext, useContext, useState, useEffect } from 'react';
import { productsAPI } from '../lib/api';

interface Product {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  qrCode: string;
  image?: string;
  category: string;
  expirationDate: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  minimumStock?: number;
}

interface ProductsContextType {
  products: Product[];
  loading: boolean;
  refreshProducts: () => Promise<void>;
  updateProductQuantity: (productId: string, newQuantity: number) => void;
}

const ProductsContext = createContext<ProductsContextType | null>(null);

export const useProducts = () => {
  const context = useContext(ProductsContext);
  if (!context) {
    // Return default values when context is not available (e.g., on login page)
    return {
      products: [],
      loading: false,
      refreshProducts: async () => {},
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
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<number>(0);

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
  }, []);

  const value = {
    products,
    loading,
    refreshProducts,
    updateProductQuantity
  };

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
};
