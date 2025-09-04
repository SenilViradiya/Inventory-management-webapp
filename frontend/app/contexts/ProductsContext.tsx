'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { productsAPI, categoriesAPI } from '../lib/api';
import type { Product, Category, ProductFilters, ProductSort } from '../lib/types';
import toast from 'react-hot-toast';

interface ProductsContextType {
  // Products
  products: Product[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  totalProducts: number;
  
  // Categories
  categories: Category[];
  categoriesLoading: boolean;
  
  // Filters and sorting
  filters: ProductFilters;
  sort: ProductSort;
  
  // Actions
  fetchProducts: (page?: number) => Promise<void>;
  fetchCategories: () => Promise<void>;
  createProduct: (productData: FormData) => Promise<Product | null>;
  updateProduct: (id: string, productData: FormData) => Promise<Product | null>;
  deleteProduct: (id: string) => Promise<boolean>;
  getProductById: (id: string) => Promise<Product | null>;
  getProductByQRCode: (qrCode: string) => Promise<Product | null>;
  
  // Filter and sort actions
  setFilters: (filters: Partial<ProductFilters>) => void;
  setSort: (sort: ProductSort) => void;
  clearFilters: () => void;
  
  // Utility actions
  refreshProducts: () => Promise<void>;
  searchProducts: (query: string) => void;
  updateProductQuantity: (productId: string, newQuantity: number) => void;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  
  const [filters, setFiltersState] = useState<ProductFilters>({});
  const [sort, setSortState] = useState<ProductSort>({
    field: 'name',
    order: 'asc'
  });

  // Track if component has mounted to prevent duplicate API calls
  const hasMounted = useRef(false);

  const fetchProducts = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page,
        limit: 20,
        sortBy: sort.field,
        sortOrder: sort.order,
        ...filters
      };
      
      const response = await productsAPI.getAll(params);
      
      if (response.data?.data && Array.isArray(response.data.data)) {
        setProducts(response.data.data);
        setCurrentPage(response.data.pagination?.currentPage || 1);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setTotalProducts(response.data.pagination?.totalItems || 0);
      } else if (Array.isArray(response.data)) {
        // Fallback for non-paginated response
        setProducts(response.data);
        setCurrentPage(1);
        setTotalPages(1);
        setTotalProducts(response.data.length);
      }
      
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to fetch products';
      setError(message);
      console.log('Products fetch error:', message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true);
      const response = await categoriesAPI.getAll(true);
      if (response.data?.data && Array.isArray(response.data.data)) {
        setCategories(response.data.data);
      } else if (Array.isArray(response.data)) {
        setCategories(response.data);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to fetch categories';
      console.log('Categories fetch error:', message);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const createProduct = async (productData: FormData): Promise<Product | null> => {
    try {
      const response = await productsAPI.create(productData);
      let newProduct: Product;
      
      if (response.data?.data) {
        newProduct = response.data.data;
      } else {
        newProduct = response.data as unknown as Product;
      }
      
      setProducts(prev => [newProduct, ...prev]);
      setTotalProducts(prev => prev + 1);
      
      toast.success('Product created successfully!');
      return newProduct;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to create product';
      toast.error(message);
      return null;
    }
  };

  const updateProduct = async (id: string, productData: FormData): Promise<Product | null> => {
    try {
      const response = await productsAPI.update(id, productData);
      let updatedProduct: Product;
      
      if (response.data?.data) {
        updatedProduct = response.data.data;
      } else {
        updatedProduct = response.data as unknown as Product;
      }
      
      setProducts(prev => 
        prev.map(product => 
          product._id === id ? updatedProduct : product
        )
      );
      
      toast.success('Product updated successfully!');
      return updatedProduct;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update product';
      toast.error(message);
      return null;
    }
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    try {
      await productsAPI.delete(id);
      
      setProducts(prev => prev.filter(product => product._id !== id));
      setTotalProducts(prev => Math.max(0, prev - 1));
      
      toast.success('Product deleted successfully!');
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to delete product';
      toast.error(message);
      return false;
    }
  };

  const getProductById = async (id: string): Promise<Product | null> => {
    try {
      const response = await productsAPI.getById(id);
      return response.data?.data || (response.data as unknown as Product);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Product not found';
      toast.error(message);
      return null;
    }
  };

  const getProductByQRCode = async (qrCode: string): Promise<Product | null> => {
    try {
      const response = await productsAPI.getByQRCode(qrCode);
      return response.data?.data || (response.data as unknown as Product);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Product not found';
      toast.error(message);
      return null;
    }
  };

  const setFilters = (newFilters: Partial<ProductFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const setSort = (newSort: ProductSort) => {
    setSortState(newSort);
    setCurrentPage(1); // Reset to first page when sort changes
  };

  const clearFilters = () => {
    setFiltersState({});
    setCurrentPage(1);
  };

  const refreshProducts = async () => {
    await fetchProducts(currentPage);
  };

  const searchProducts = (query: string) => {
    setFilters({ search: query });
  };

  const updateProductQuantity = (productId: string, newQuantity: number) => {
    setProducts(prev => 
      prev.map(product => 
        product._id === productId 
          ? { 
              ...product, 
              quantity: newQuantity,
              stock: product.stock ? { ...product.stock, total: newQuantity } : undefined
            }
          : product
      )
    );
  };

  // Fetch products and categories on mount
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      fetchProducts(1);
      fetchCategories();
    }
  }, []);

  // Fetch products when filters or sort change (but not on initial mount)
  useEffect(() => {
    if (!hasMounted.current) return; // Prevent running on initial mount
    fetchProducts(1); // Reset to page 1 when filters or sort change
  }, [filters, sort]);

  const value: ProductsContextType = {
    // Products
    products,
    loading,
    error,
    currentPage,
    totalPages,
    totalProducts,
    
    // Categories
    categories,
    categoriesLoading,
    
    // Filters and sorting
    filters,
    sort,
    
    // Actions
    fetchProducts,
    fetchCategories,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductById,
    getProductByQRCode,
    
    // Filter and sort actions
    setFilters,
    setSort,
    clearFilters,
    
    // Utility actions
    refreshProducts,
    searchProducts,
    updateProductQuantity,
  };

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductsProvider');
  }
  return context;
}
