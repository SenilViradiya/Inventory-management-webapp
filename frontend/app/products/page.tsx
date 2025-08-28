'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProducts } from '../contexts/ProductsContext';
import { useRouter } from 'next/navigation';
import { productsAPI, api } from '../lib/api';
import Navigation from '../components/Navigation';
import toast from 'react-hot-toast';

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
}

export default function ProductsPage() {
  const { user } = useAuth();
  const { products, loading: productsLoading, refreshProducts } = useProducts();
  const router = useRouter();
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const categories = ['all', 'beer', 'wine', 'spirits', 'soft-drinks', 'snacks', 'cigarettes', 'water'];

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  useEffect(() => {
    filterAndSortProducts();
  }, [products, searchTerm, selectedCategory, sortBy]);

  const filterAndSortProducts = () => {
    let filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.qrCode.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price':
          return a.price - b.price;
        case 'stock':
          return b.quantity - a.quantity;
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

    setFilteredProducts(filtered);
  };

  const handleDelete = async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete "${productName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      console.log('Deleting product:', productId); // Debug log
      await productsAPI.delete(productId);
      toast.success(`Product "${productName}" deleted successfully`);
      refreshProducts();
    } catch (error: any) {
      console.error('Delete error:', error); // Debug log
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete product';
      toast.error(`Delete failed: ${errorMessage}`);
    }
  };

  const adjustQuantity = async (productId: string, newQuantity: number) => {
    if (newQuantity < 0) {
      toast.error('Quantity cannot be negative');
      return;
    }

    try {
      console.log('Adjusting quantity for product:', productId, 'to:', newQuantity); // Debug log
      
      // Use the new PATCH endpoint for quantity updates
      await api.patch(`/products/${productId}/quantity`, {
        quantity: newQuantity
      });
      
      toast.success(`Quantity updated to ${newQuantity}`);
      refreshProducts();
    } catch (error: any) {
      console.error('Quantity update error:', error); // Debug log
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update quantity';
      toast.error(`Update failed: ${errorMessage}`);
    }
  };

  const getStockStatusColor = (quantity: number) => {
    if (quantity === 0) return 'text-red-600 bg-red-50';
    if (quantity <= 5) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  if (productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Products</h1>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              + Add Product
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Search products..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Name</option>
                <option value="price">Price</option>
                <option value="stock">Stock</option>
                <option value="category">Category</option>
              </select>
            </div>

            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                Total: {filteredProducts.length} products
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div key={product._id} className="bg-gray-50 rounded-lg p-4 border hover:shadow-md transition-shadow">
                {/* Product Image */}
                <div className="w-full h-32 bg-gray-200 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                  {product.image ? (
                    <img 
                      src={`http://localhost:5001${product.image}`} 
                      alt={product.name}
                      className="w-full h-32 object-cover rounded-lg"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : (
                    <div className="text-gray-400 text-sm">No Image</div>
                  )}
                  {/* Error fallback (hidden by default) */}
                  <div className="text-gray-400 text-xs text-center hidden">
                    Image not available
                  </div>
                </div>

                <h3 className="font-semibold text-gray-900 mb-2 truncate">{product.name}</h3>
                
                <div className="space-y-1 text-sm text-gray-600 mb-3">
                  <div>Price: {formatCurrency(product.price)}</div>
                  <div>Category: {product.category}</div>
                  <div>QR: {product.qrCode}</div>
                </div>

                <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-3 ${getStockStatusColor(product.quantity)}`}>
                  Stock: {product.quantity}
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center space-x-2 mb-3">
                  <button
                    onClick={() => adjustQuantity(product._id, Math.max(0, product.quantity - 1))}
                    className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold"
                  >
                    -
                  </button>
                  <span className="font-medium min-w-[3rem] text-center">{product.quantity}</span>
                  <button
                    onClick={() => adjustQuantity(product._id, product.quantity + 1)}
                    className="w-8 h-8 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold"
                  >
                    +
                  </button>
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingProduct(product)}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product._id, product.name)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-2 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg">No products found</div>
              <p className="text-gray-400 mt-2">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {(showAddForm || editingProduct) && (
        <ProductForm
          product={editingProduct}
          onClose={() => {
            setShowAddForm(false);
            setEditingProduct(null);
          }}
          onSuccess={() => {
            setShowAddForm(false);
            setEditingProduct(null);
            refreshProducts();
          }}
        />
      )}
    </div>
  );
}

// Product Form Component
interface ProductFormProps {
  product?: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

function ProductForm({ product, onClose, onSuccess }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    price: product?.price || 0,
    quantity: product?.quantity || 0,
    qrCode: product?.qrCode || '',
    category: product?.category || 'beer',
    description: product?.description || '',
    expirationDate: product?.expirationDate ? product.expirationDate.split('T')[0] : ''
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    product?.image ? `http://localhost:5001${product.image}` : null
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    
    if (formData.price <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }
    
    if (formData.quantity < 0) {
      toast.error('Quantity cannot be negative');
      return;
    }
    
    if (!formData.qrCode.trim()) {
      toast.error('QR Code is required');
      return;
    }
    
    setIsLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('name', formData.name.trim());
      submitData.append('price', formData.price.toString());
      submitData.append('quantity', formData.quantity.toString());
      submitData.append('qrCode', formData.qrCode.trim().toUpperCase());
      submitData.append('category', formData.category);
      submitData.append('description', formData.description.trim());
      if (formData.expirationDate) {
        submitData.append('expirationDate', formData.expirationDate);
      }
      if (selectedImage) {
        submitData.append('image', selectedImage);
      }

      if (product) {
        await productsAPI.update(product._id, submitData);
        toast.success('Product updated successfully');
      } else {
        await productsAPI.create(submitData);
        toast.success('Product created successfully');
      }
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save product');
    } finally {
      setIsLoading(false);
    }
  };

  const generateQRCode = () => {
    const prefix = formData.category.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormData({ ...formData, qrCode: `${prefix}${random}` });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {product ? 'Edit Product' : 'Add New Product'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
              <div className="mt-1">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImage(null);
                        setImagePreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-gray-500">No image selected</div>
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (£)</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={formData.price === 0 ? '' : formData.price}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || value === null) {
                      setFormData({ ...formData, price: 0 });
                    } else {
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue) && numValue >= 0) {
                        setFormData({ ...formData, price: numValue });
                      }
                    }
                  }}
                  placeholder="Enter price"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Price must be greater than £0</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.quantity === 0 ? '' : formData.quantity}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || value === null) {
                      setFormData({ ...formData, quantity: 0 });
                    } else {
                      const numValue = parseInt(value);
                      if (!isNaN(numValue) && numValue >= 0) {
                        setFormData({ ...formData, quantity: numValue });
                      }
                    }
                  }}
                  placeholder="Enter quantity"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum quantity is 0</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">QR Code</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  required
                  value={formData.qrCode}
                  onChange={(e) => setFormData({ ...formData, qrCode: e.target.value.toUpperCase() })}
                  placeholder="Enter or generate QR code"
                  className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={generateQRCode}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm"
                >
                  Generate
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Unique identifier for this product</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="beer">Beer</option>
                <option value="wine">Wine</option>
                <option value="spirits">Spirits</option>
                <option value="soft-drinks">Soft Drinks</option>
                <option value="snacks">Snacks</option>
                <option value="cigarettes">Cigarettes</option>
                <option value="water">Water</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiration Date <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={formData.expirationDate}
                onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty if product doesn't expire</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : product ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
