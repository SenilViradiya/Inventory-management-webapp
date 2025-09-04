'use client';

import { useState, useEffect } from 'react';
import { useProducts } from '../contexts/ProductsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toast } from 'react-hot-toast';
import { PlusIcon, SearchIcon, EditIcon, TrashIcon, PackageIcon } from 'lucide-react';

export default function ProductsPage() {
  const {
    products,
    loading,
    categories,
    currentPage,
    totalPages,
    filters,
    setFilters,
    clearFilters,
    createProduct,
    updateProduct,
    deleteProduct,
    fetchProducts,
    fetchCategories
  } = useProducts();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [localCategoryFilter, setLocalCategoryFilter] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    categoryId: '',
    description: '',
    quantity: 0,
    lowStockThreshold: 0
  });

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchTerm) {
        setFilters({ ...filters, search: localSearchTerm });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearchTerm]);

  const convertToFormData = (data: any): FormData => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key].toString());
      }
    });
    return formData;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }

    try {
      if (editingProduct) {
        await updateProduct(editingProduct._id, convertToFormData(formData));
        toast.success('Product updated successfully');
      } else {
        await createProduct(convertToFormData(formData));
        toast.success('Product created successfully');
      }
      
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price,
      categoryId: product.categoryId || '',
      description: product.description || '',
      quantity: product.quantity,
      lowStockThreshold: product.lowStockThreshold
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await deleteProduct(productId);
      toast.success('Product deleted successfully');
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: 0,
      categoryId: '',
      description: '',
      quantity: 0,
      lowStockThreshold: 0
    });
    setEditingProduct(null);
    setShowCreateForm(false);
  };

  const getStockStatus = (product: any) => {
    if (product.quantity === 0) {
      return { status: 'Out of Stock', color: 'bg-red-100 text-red-800' };
    } else if (product.quantity <= product.lowStockThreshold) {
      return { status: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { status: 'In Stock', color: 'bg-green-100 text-green-800' };
    }
  };

  const handleCategoryFilterChange = (categoryId: string) => {
    setLocalCategoryFilter(categoryId);
    setFilters({ ...filters, category: categoryId || undefined });
  };

  const handleClearFilters = () => {
    setLocalSearchTerm('');
    setLocalCategoryFilter('');
    clearFilters();
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchProducts(newPage);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Products</h1>
              <p className="text-gray-600">Manage your product inventory</p>
            </div>
            <Button onClick={() => setShowCreateForm(true)}>
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</CardTitle>
              <CardDescription>
                {editingProduct ? 'Update product information' : 'Enter product details to add to inventory'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <Input
                    placeholder="Product Name *"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                  <Input
                    type="number"
                    placeholder="Price *"
                    value={formData.price || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: Number(e.target.value) }))}
                    required
                    min="0"
                    step="0.01"
                  />
                  <select
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    value={formData.categoryId}
                    onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                  >
                    <option value="">Select Category</option>
                    {categories.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    placeholder="Quantity *"
                    value={formData.quantity || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    required
                    min="0"
                  />
                  <Input
                    type="number"
                    placeholder="Low Stock Threshold"
                    value={formData.lowStockThreshold || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, lowStockThreshold: Number(e.target.value) }))}
                    min="0"
                  />
                  <Input
                    placeholder="Description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">
                    {editingProduct ? 'Update Product' : 'Add Product'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search products..."
                  value={localSearchTerm}
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={localCategoryFilter}
                onChange={(e) => handleCategoryFilterChange(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value=""
                onChange={() => {}}
              >
                <option value="">All Status</option>
                <option value="in-stock">In Stock</option>
                <option value="low-stock">Low Stock</option>
                <option value="out-of-stock">Out of Stock</option>
              </select>

              <Button variant="outline" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {products.map((product) => {
            const stockStatus = getStockStatus(product);
            return (
              <Card key={product._id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <p className="text-sm text-gray-600">{product.categoryName}</p>
                    </div>
                    <Badge variant="secondary" className={stockStatus.color}>
                      {stockStatus.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Price:</span>
                      <span className="font-semibold">₹{product.price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Stock:</span>
                      <span className="font-semibold">{product.quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">QR Code:</span>
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                        {product.qrCode?.slice(0, 8)}...
                      </span>
                    </div>
                    {product.description && (
                      <p className="text-sm text-gray-600 mt-2">
                        {product.description.length > 60 
                          ? product.description.substring(0, 60) + '...' 
                          : product.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(product)}>
                      <EditIcon className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(product._id)}>
                      <TrashIcon className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {products.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <PackageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No products found</p>
                <Button className="mt-4" onClick={() => setShowCreateForm(true)}>
                  Add Your First Product
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
