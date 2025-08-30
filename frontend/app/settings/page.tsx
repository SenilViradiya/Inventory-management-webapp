'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import { toast } from 'react-hot-toast';
import Cookies from 'js-cookie';
import { 
  Package, 
  Wine, 
  Coffee, 
  Cookie, 
  Cigarette, 
  Droplets, 
  Pizza, 
  Candy, 
  Zap, 
  Home, 
  Folder, 
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  Filter,
  ShoppingBag,
  Car,
  Milk,
  Soup,
  Apple,
  Smartphone,
  Monitor
} from 'lucide-react';

interface Category {
  _id: string;
  name: string;
  description?: string;
  parent?: string;
  children?: Category[];
  isActive: boolean;
  icon?: string;
  sortOrder: number;
  productCount?: number;
}

interface CategoryFormData {
  name: string;
  description: string;
  parent: string;
  icon: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    parent: '',
    icon: 'Package'
  });

  // Predefined icons for categories
  const iconOptions = [
    { value: 'Package', label: 'Package', icon: Package },
    { value: 'Wine', label: 'Wine & Spirits', icon: Wine },
    { value: 'Coffee', label: 'Beverages', icon: Coffee },
    { value: 'Cookie', label: 'Snacks', icon: Cookie },
    { value: 'Cigarette', label: 'Tobacco', icon: Cigarette },
    { value: 'Droplets', label: 'Water', icon: Droplets },
    { value: 'Pizza', label: 'Food', icon: Pizza },
    { value: 'Candy', label: 'Candy', icon: Candy },
    { value: 'Zap', label: 'Electronics', icon: Zap },
    { value: 'Home', label: 'Household', icon: Home },
    { value: 'Folder', label: 'General', icon: Folder },
    { value: 'ShoppingBag', label: 'Shopping', icon: ShoppingBag },
    { value: 'Car', label: 'Automotive', icon: Car },
    { value: 'Milk', label: 'Dairy', icon: Milk },
    { value: 'Soup', label: 'Meals', icon: Soup },
    { value: 'Apple', label: 'Fresh Produce', icon: Apple },
    { value: 'Smartphone', label: 'Mobile', icon: Smartphone },
    { value: 'Monitor', label: 'Computers', icon: Monitor }
  ];

  // Helper function to get icon component
  const getIconComponent = (iconName: string) => {
    const iconOption = iconOptions.find(opt => opt.value === iconName);
    if (iconOption) {
      const IconComponent = iconOption.icon;
      return <IconComponent className="w-5 h-5" />;
    }
    return <Package className="w-5 h-5" />;
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadCategories();
  }, [user, router]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const token = Cookies.get('authToken');
      const response = await fetch('http://localhost:5001/api/products/categories/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    try {
      setSubmitting(true);
      const token = Cookies.get('authToken');
      
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        parent: formData.parent || undefined,
        icon: formData.icon,
      };

      const url = editingCategory 
        ? `http://localhost:5001/api/categories/${editingCategory._id}`
        : 'http://localhost:5001/api/categories/create';
      
      const method = editingCategory ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save category');
      }

      const savedCategory = await response.json();
      toast.success(`Category ${editingCategory ? 'updated' : 'created'} successfully`);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        parent: '',
        icon: 'Package'
      });
      setShowAddForm(false);
      setEditingCategory(null);
      
      // Reload categories
      loadCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      toast.error(error.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      parent: category.parent || '',
      icon: category.icon || 'Package'
    });
    setShowAddForm(true);
  };

  const handleDelete = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Are you sure you want to delete "${categoryName}"?`)) {
      return;
    }

    try {
      const token = Cookies.get('authToken');
      const response = await fetch(`http://localhost:5001/api/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete category');
      }

      toast.success('Category deleted successfully');
      loadCategories();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast.error(error.message || 'Failed to delete category');
    }
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      description: '',
      parent: '',
      icon: 'Package'
    });
    setShowAddForm(false);
    setEditingCategory(null);
  };

  // Get parent categories for dropdown
  const parentCategories = categories; // Fetch all categories dynamically from the database

  const renderCategory = (category: Category, level = 0) => {
    return (
      <div key={category._id} className="border rounded-lg p-4 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div style={{ marginLeft: `${level * 20}px` }} className="flex items-center space-x-3">
              {getIconComponent(category.icon || 'Package')}
              <div>
                <h3 className="font-semibold text-gray-900">{category.name}</h3>
                {category.description && (
                  <p className="text-sm text-gray-600">{category.description}</p>
                )}
                <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                  <span>Products: {category.productCount || 0}</span>
                  <span>Active: {category.isActive ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleEdit(category)}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="Edit category"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(category._id, category.name)}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
              title="Delete category"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Render children */}
        {category.children && category.children.length > 0 && (
          <div className="mt-4 space-y-2">
            {category.children.map(child => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Category Management
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage product categories and subcategories for your shop
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </button>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter category name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent Category
                  </label>
                  <select
                    value={formData.parent}
                    onChange={(e) => setFormData({ ...formData, parent: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">No Parent (Main Category)</option>
                    {parentCategories.map(category => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter category description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icon
                </label>
                <div className="grid grid-cols-6 md:grid-cols-9 gap-2">
                  {iconOptions.map(option => {
                    const IconComponent = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: option.value })}
                        className={`p-3 border rounded-lg flex items-center justify-center hover:bg-gray-50 ${
                          formData.icon === option.value ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                        }`}
                        title={option.label}
                      >
                        <IconComponent className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingCategory ? 'Update' : 'Create'} Category
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Categories List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
            <p className="text-gray-600 mb-4">Get started by creating your first category</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Category
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {categories.filter(cat => !cat.parent).map(category => renderCategory(category))}
          </div>
        )}
      </div>
    </div>
  );
}
