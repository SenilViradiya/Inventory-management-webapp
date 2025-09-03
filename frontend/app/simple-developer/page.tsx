'use client';

import React, { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import {
  Users,
  Building2,
  BarChart3,
  Shield,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Mail,
  Phone,
  Package,
  TrendingUp,
  DollarSign,
  Clock,
  Settings,
  UserPlus
} from 'lucide-react';

interface User {
  _id: string;
  username: string;
  email: string;
  fullName?: string;
  role: {
    name: string;
    permissions: string[];
  };
  businessId?: string;
  businessName?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

interface Organization {
  _id: string;
  name: string;
  owner: {
    name: string;
    email: string;
    phone?: string;
  };
  organizationType: string;
  description?: string;
  website?: string;
  industry?: string;
  subscription: {
    plan: string;
    isActive: boolean;
    startDate: string;
    endDate: string;
    trialExtensions?: number;
  };
  settings: {
    maxUsers: number;
    maxProducts: number;
    features: string[];
  };
  status: string;
  createdAt: string;
}

interface BusinessStats {
  total: number;
  active: number;
  trial: number;
  expired: number;
}

interface SystemAnalytics {
  overview: {
    totalProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    recentProducts: number;
    expiringSoon: number;
    totalInventoryValue: number;
    totalQuantity: number;
  };
  categories: Array<{
    _id: string;
    count: number;
    totalQuantity: number;
    totalValue: number;
  }>;
  alerts: {
    lowStock: number;
    outOfStock: number;
    expiringSoon: number;
  };
}

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalOrganizations: number;
  activeOrganizations: number;
}

export default function DeveloperDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalOrganizations: 0,
    activeOrganizations: 0
  });
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [businessStats, setBusinessStats] = useState<BusinessStats>({
    total: 0,
    active: 0,
    trial: 0,
    expired: 0
  });
  const [systemAnalytics, setSystemAnalytics] = useState<SystemAnalytics>({
    overview: {
      totalProducts: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      recentProducts: 0,
      expiringSoon: 0,
      totalInventoryValue: 0,
      totalQuantity: 0
    },
    categories: [],
    alerts: {
      lowStock: 0,
      outOfStock: 0,
      expiringSoon: 0
    }
  });
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddOrganization, setShowAddOrganization] = useState(false);
  const [showEditOrganization, setShowEditOrganization] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'staff',
    businessId: ''
  });
  const [organizationForm, setOrganizationForm] = useState({
    name: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    organizationType: 'client-organization',
    description: '',
    website: '',
    industry: '',
    subscriptionPlan: 'trial',
    maxUsers: 5,
    maxProducts: 100
  });

  // Fetch all data on component mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchUsers(),
        fetchOrganizations(),
        fetchSystemAnalytics()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = Cookies.get('authToken');
      console.log('Fetching users with token:', token ? 'Token exists' : 'No token');

      const response = await fetch('http://localhost:5001/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Users response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Users data:', data);

      setUsers(data.users || []);

      // Update user stats
      const totalUsers = data.users?.length || 0;
      const activeUsers = data.users?.filter((user: User) => user.isActive).length || 0;

      setStats(prev => ({
        ...prev,
        totalUsers,
        activeUsers
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const token = Cookies.get('authToken');
      console.log('Fetching organizations with token:', token ? 'Token exists' : 'No token');

      const response = await fetch('http://localhost:5001/api/businesses', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Organizations response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Organizations data:', data);

      setOrganizations(data.businesses || []);
      setBusinessStats(data.stats || { total: 0, active: 0, trial: 0, expired: 0 });

      // Update organization stats
      setStats(prev => ({
        ...prev,
        totalOrganizations: data.stats?.total || 0,
        activeOrganizations: data.stats?.active || 0
      }));
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  const fetchSystemAnalytics = async () => {
    try {
      const token = Cookies.get('authToken');
      const response = await fetch('http://localhost:5001/api/simple-analytics/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSystemAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching system analytics:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = Cookies.get('authToken');
      const response = await fetch('http://localhost:5001/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          firstName: formData.fullName.split(' ')[0] || formData.username,
          lastName: formData.fullName.split(' ').slice(1).join(' ') || '',
          phone: formData.phone,
          role: formData.role,
          organization: formData.businessId || null,
          organizationRole: formData.role
        })
      });

      if (response.ok) {
        setShowAddUser(false);
        setFormData({
          username: '',
          email: '',
          password: '',
          fullName: '',
          phone: '',
          role: 'staff',
          businessId: ''
        });
        fetchUsers();
        toast.success('User created successfully!');
      } else {
        const errorData = await response.json();
        toast.error('Error creating user: ' + (errorData.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Error creating user: ' + error.message);
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = Cookies.get('authToken');
      const response = await fetch('http://localhost:5001/api/businesses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: organizationForm.name,
          owner: {
            name: organizationForm.ownerName,
            email: organizationForm.ownerEmail,
            phone: organizationForm.ownerPhone
          },
          organizationType: organizationForm.organizationType,
          description: organizationForm.description,
          website: organizationForm.website,
          industry: organizationForm.industry,
          subscription: {
            plan: organizationForm.subscriptionPlan
          },
          settings: {
            maxUsers: organizationForm.maxUsers,
            maxProducts: organizationForm.maxProducts,
            features: ['inventory_management', 'qr_scanning']
          }
        })
      });

      if (response.ok) {
        setShowAddOrganization(false);
        setOrganizationForm({
          name: '',
          ownerName: '',
          ownerEmail: '',
          ownerPhone: '',
          organizationType: 'client-organization',
          description: '',
          website: '',
          industry: '',
          subscriptionPlan: 'trial',
          maxUsers: 5,
          maxProducts: 100
        });
        fetchOrganizations();
        toast.success('Organization created successfully!');
      } else {
        const errorData = await response.json();
        toast.error('Error creating organization: ' + (errorData.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      toast.error('Error creating organization: ' + error.message);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const token = Cookies.get('authToken');
      const response = await fetch(`http://localhost:5001/api/users/${userId}/toggle-status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });

      if (response.ok) {
        fetchUsers();
        toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
      } else {
        const errorData = await response.json();
        toast.error('Error updating user status: ' + (errorData.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('Error updating user status: ' + error.message);
    }
  };

  const handleDeleteOrganization = async (organizationId: string) => {
    if (!window.confirm('Are you sure you want to delete this organization? This action cannot be undone.')) {
      return;
    }

    try {
      const token = Cookies.get('authToken');
      const response = await fetch(`http://localhost:5001/api/businesses/${organizationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchOrganizations();
        toast.success('Organization deleted successfully!');
      } else {
        const errorData = await response.json();
        toast.error('Error deleting organization: ' + (errorData.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting organization:', error);
      toast.error('Error deleting organization: ' + error.message);
    }
  };

  const handleEditOrganization = (organization: Organization) => {
    setEditingOrganization(organization);
    setOrganizationForm({
      name: organization.name,
      ownerName: organization.owner.name,
      ownerEmail: organization.owner.email,
      ownerPhone: organization.owner.phone || '',
      organizationType: organization.organizationType,
      description: organization.description || '',
      website: organization.website || '',
      industry: organization.industry || '',
      subscriptionPlan: organization.subscription.plan,
      maxUsers: organization.settings.maxUsers,
      maxProducts: organization.settings.maxProducts
    });
    setShowEditOrganization(true);
  };

  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrganization) return;

    try {
      const token = Cookies.get('authToken');
      const response = await fetch(`http://localhost:5001/api/businesses/${editingOrganization._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: organizationForm.name,
          owner: {
            name: organizationForm.ownerName,
            email: organizationForm.ownerEmail,
            phone: organizationForm.ownerPhone
          },
          organizationType: organizationForm.organizationType,
          description: organizationForm.description,
          website: organizationForm.website,
          industry: organizationForm.industry,
          subscription: {
            plan: organizationForm.subscriptionPlan
          },
          settings: {
            maxUsers: organizationForm.maxUsers,
            maxProducts: organizationForm.maxProducts,
            features: ['inventory_management', 'qr_scanning']
          }
        })
      });

      if (response.ok) {
        setShowEditOrganization(false);
        setEditingOrganization(null);
        setOrganizationForm({
          name: '',
          ownerName: '',
          ownerEmail: '',
          ownerPhone: '',
          organizationType: 'client-organization',
          description: '',
          website: '',
          industry: '',
          subscriptionPlan: 'trial',
          maxUsers: 5,
          maxProducts: 100
        });
        fetchOrganizations();
        toast.success('Organization updated successfully!');
      } else {
        const errorData = await response.json();
        toast.error('Error updating organization: ' + (errorData.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating organization:', error);
      toast.error('Error updating organization: ' + error.message);
    }
  };

  const handleAssignUserToOrganization = async (userId: string, organizationId: string) => {
    try {
      const token = Cookies.get('authToken');
      const response = await fetch(`http://localhost:5001/api/users/${userId}/assign-organization`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ organizationId })
      });

      if (response.ok) {
        fetchUsers();
        toast.success('User assigned to organization successfully!');
      } else {
        const errorData = await response.json();
        toast.error('Error assigning user to organization: ' + (errorData.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error assigning user to organization:', error);
      toast.error('Error assigning user to organization: ' + error.message);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '', // Don't prefill password for security
      fullName: user.fullName || '',
      phone: '', // We'll need to add phone to User interface or get from API
      role: user.role.name,
      businessId: user.businessId || ''
    });
    setShowEditUser(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const token = Cookies.get('authToken');
      const updateData: any = {
        username: formData.username,
        email: formData.email,
        firstName: formData.fullName.split(' ')[0] || formData.username,
        lastName: formData.fullName.split(' ').slice(1).join(' ') || '',
        role: formData.role,
        organization: formData.businessId || null,
        organizationRole: formData.role
      };

      // Only include password if it's provided
      if (formData.password.trim()) {
        updateData.password = formData.password;
      }

      const response = await fetch(`http://localhost:5001/api/users/${editingUser._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        setShowEditUser(false);
        setEditingUser(null);
        setFormData({
          username: '',
          email: '',
          password: '',
          fullName: '',
          phone: '',
          role: 'staff',
          businessId: ''
        });
        fetchUsers();
        toast.success('User updated successfully!');
      } else {
        const errorData = await response.json();
        toast.error('Error updating user: ' + (errorData.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Error updating user: ' + error.message);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = Cookies.get('authToken');
      const response = await fetch(`http://localhost:5001/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchUsers();
        toast.success('User deleted successfully!');
      } else {
        const errorData = await response.json();
        toast.error('Error deleting user: ' + (errorData.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Error deleting user: ' + error.message);
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.fullName && user.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.owner.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Developer Dashboard</h1>
                <p className="text-sm text-gray-500">System Administration & Management</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: BarChart3 },
              { id: 'users', name: 'User Management', icon: Users },
              { id: 'organizations', name: 'Organizations', icon: Building2 },
              { id: 'analytics', name: 'System Analytics', icon: TrendingUp }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <tab.icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.totalUsers}</dd>
                      <dd className="text-sm text-green-600">{stats.activeUsers} active</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Building2 className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Organizations</dt>
                      <dd className="text-lg font-medium text-gray-900">{businessStats.total}</dd>
                      <dd className="text-sm text-green-600">{businessStats.active} active</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Package className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Products</dt>
                      <dd className="text-lg font-medium text-gray-900">{systemAnalytics.overview.totalProducts}</dd>
                      <dd className="text-sm text-blue-600">{systemAnalytics.overview.totalQuantity} items</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <DollarSign className="h-8 w-8 text-yellow-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Inventory Value</dt>
                      <dd className="text-lg font-medium text-gray-900">{formatCurrency(systemAnalytics.overview.totalInventoryValue)}</dd>
                      <dd className="text-sm text-gray-600">Total system value</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerts Section */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">System Alerts</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center p-4 bg-red-50 rounded-lg">
                    <AlertCircle className="h-6 w-6 text-red-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Out of Stock</p>
                      <p className="text-lg font-bold text-red-900">{systemAnalytics.alerts.outOfStock}</p>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-yellow-50 rounded-lg">
                    <AlertCircle className="h-6 w-6 text-yellow-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Low Stock</p>
                      <p className="text-lg font-bold text-yellow-900">{systemAnalytics.alerts.lowStock}</p>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-orange-50 rounded-lg">
                    <Clock className="h-6 w-6 text-orange-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">Expiring Soon</p>
                      <p className="text-lg font-bold text-orange-900">{systemAnalytics.alerts.expiringSoon}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setShowAddUser(true)}
                    className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <UserPlus className="h-5 w-5 mr-2" />
                    Add New User
                  </button>
                  <button
                    onClick={() => setShowAddOrganization(true)}
                    className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Building2 className="h-5 w-5 mr-2" />
                    Add Organization
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* User Management Header */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                <p className="text-sm text-gray-600">Manage system users and their permissions</p>
              </div>
              <button
                onClick={() => setShowAddUser(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search users..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Users Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              {/* Debug Information */}
              {/* <div className="px-6 py-4 bg-yellow-50 border-b border-yellow-200">
                <div className="text-sm text-yellow-800">
                  <p><strong>Debug Info:</strong></p>
                  <p>Total users: {users.length}</p>
                  <p>Filtered users: {filteredUsers.length}</p>
                  <p>Search term: "{searchTerm}"</p>
                  <p>Loading: {loading ? 'Yes' : 'No'}</p>
                </div>
              </div> */}

              <div className="min-w-full divide-y divide-gray-200">
                <div className="bg-gray-50 px-6 py-3">
                  <div className="grid grid-cols-6 gap-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div>User</div>
                    <div>Role</div>
                    <div>Organization</div>
                    <div>Status</div>
                    <div>Last Login</div>
                    <div>Actions</div>
                  </div>
                </div>
                <div className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <div className="px-6 py-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-500">Loading users...</p>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-lg font-medium text-gray-900">No users found</p>
                      <p className="text-sm text-gray-500">
                        {users.length === 0
                          ? "No users exist in the system yet. Add some users to get started."
                          : "No users match your search criteria. Try adjusting your search term."
                        }
                      </p>
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <div key={user._id} className="px-6 py-4">
                        <div className="grid grid-cols-6 gap-4 items-center">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {user.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{user.fullName || user.username}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                          <div>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.role.name === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : user.role.name === 'manager'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                              }`}>
                              {user.role.name}
                            </span>
                          </div>
                          <div className="text-sm text-gray-900">
                            {user.businessName || 'No Organization'}
                          </div>
                          <div>
                            {user.isActive ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <XCircle className="w-3 h-3 mr-1" />
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleToggleUserStatus(user._id, user.isActive)}
                              className="text-blue-600 hover:text-blue-900"
                              title={user.isActive ? 'Deactivate User' : 'Activate User'}
                            >
                              {user.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                            <button
                              className="text-green-600 hover:text-green-900"
                              title="Edit User"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              className="text-purple-600 hover:text-purple-900"
                              title="Assign to Organization"
                              onClick={() => {
                                const orgId = prompt('Enter Organization ID to assign user to:');
                                if (orgId) {
                                  handleAssignUserToOrganization(user._id, orgId);
                                }
                              }}
                            >
                              <Building2 className="h-4 w-4" />
                            </button>
                            <button
                              className="text-red-600 hover:text-red-900"
                              title="Delete User"
                              onClick={() => handleDeleteUser(user._id, user.username)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'organizations' && (
          <div className="space-y-6">
            {/* Organizations Header */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Organizations</h2>
                <p className="text-sm text-gray-600">Manage client organizations and subscriptions</p>
              </div>
              <button
                onClick={() => setShowAddOrganization(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Organization
              </button>
            </div>

            {/* Organizations Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-gray-900">{businessStats.total}</div>
                <div className="text-sm text-gray-600">Total Organizations</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-green-600">{businessStats.active}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-yellow-600">{businessStats.trial}</div>
                <div className="text-sm text-gray-600">Trial</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="text-2xl font-bold text-red-600">{businessStats.expired}</div>
                <div className="text-sm text-gray-600">Expired</div>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search organizations..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Organizations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrganizations.map((org) => (
                <div key={org._id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{org.name}</h3>
                        <p className="text-sm text-gray-500">{org.organizationType}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${org.subscription.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {org.subscription.plan}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-4 w-4 mr-2" />
                        {org.owner.email}
                      </div>
                      {org.owner.phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="h-4 w-4 mr-2" />
                          {org.owner.phone}
                        </div>
                      )}
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        Expires: {formatDate(org.subscription.endDate)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-gray-500">Max Users:</span>
                        <span className="ml-1 font-medium">{org.settings.maxUsers}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Max Products:</span>
                        <span className="ml-1 font-medium">{org.settings.maxProducts}</span>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                      <button
                        className="text-blue-600 hover:text-blue-900"
                        title="View Organization"
                        onClick={() => setSelectedOrganization(org)}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        className="text-green-600 hover:text-green-900"
                        title="Edit Organization"
                        onClick={() => handleEditOrganization(org)}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteOrganization(org._id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete Organization"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">System Analytics</h2>
              <p className="text-sm text-gray-600">System-wide inventory and usage analytics</p>
            </div>

            {/* Analytics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Package className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Products</p>
                    <p className="text-2xl font-semibold text-gray-900">{systemAnalytics.overview.totalProducts}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Inventory Value</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(systemAnalytics.overview.totalInventoryValue)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <AlertCircle className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
                    <p className="text-2xl font-semibold text-gray-900">{systemAnalytics.overview.lowStockProducts}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Recent Products</p>
                    <p className="text-2xl font-semibold text-gray-900">{systemAnalytics.overview.recentProducts}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Categories Table */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Top Categories</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Products
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {systemAnalytics.categories.map((category, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {category._id || 'Uncategorized'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {category.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {category.totalQuantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(category.totalValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-8">Add New User</h3>
              <form onSubmit={handleCreateUser} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                    <input
                      type="text"
                      required
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      required
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                    <input
                      type="password"
                      required
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <select
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Organization (Optional)</label>
                  <select
                    className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.businessId}
                    onChange={(e) => setFormData({ ...formData, businessId: e.target.value })}
                  >
                    <option value="">No Organization</option>
                    {organizations.map((org) => (
                      <option key={org._id} value={org._id}>
                        {org.name} ({org.organizationType})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowAddUser(false)}
                    className="px-8 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUser && editingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-8">Edit User</h3>
              <form onSubmit={handleUpdateUser} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                    <input
                      type="text"
                      required
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      required
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password (leave blank to keep current)</label>
                    <input
                      type="password"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter new password or leave blank"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <select
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Organization (Optional)</label>
                  <select
                    className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.businessId}
                    onChange={(e) => setFormData({ ...formData, businessId: e.target.value })}
                  >
                    <option value="">No Organization</option>
                    {organizations.map((org) => (
                      <option key={org._id} value={org._id}>
                        {org.name} ({org.organizationType})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditUser(false);
                      setEditingUser(null);
                      setFormData({
                        username: '',
                        email: '',
                        password: '',
                        fullName: '',
                        phone: '',
                        role: 'staff',
                        businessId: ''
                      });
                    }}
                    className="px-8 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Update User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Organization Modal */}
      {showAddOrganization && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-5xl bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-8">Add New Organization</h3>
              <form onSubmit={handleCreateOrganization} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Organization Name</label>
                    <input
                      type="text"
                      required
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={organizationForm.name}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Organization Type</label>
                    <select
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={organizationForm.organizationType}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, organizationType: e.target.value })}
                    >
                      <option value="client-organization">Client Organization</option>
                      <option value="my-organization">My Organization</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Owner Name</label>
                    <input
                      type="text"
                      required
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={organizationForm.ownerName}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, ownerName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Owner Email</label>
                    <input
                      type="email"
                      required
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={organizationForm.ownerEmail}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, ownerEmail: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Owner Phone</label>
                    <input
                      type="tel"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={organizationForm.ownerPhone}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, ownerPhone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                    <input
                      type="text"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={organizationForm.industry}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, industry: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Plan</label>
                    <select
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={organizationForm.subscriptionPlan}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, subscriptionPlan: e.target.value })}
                    >
                      <option value="trial">Trial</option>
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                    <input
                      type="url"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={organizationForm.website}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, website: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Users</label>
                    <input
                      type="number"
                      min="1"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={organizationForm.maxUsers}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, maxUsers: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Products</label>
                    <input
                      type="number"
                      min="1"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={organizationForm.maxProducts}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, maxProducts: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    rows={4}
                    className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={organizationForm.description}
                    onChange={(e) => setOrganizationForm({ ...organizationForm, description: e.target.value })}
                    placeholder="Enter organization description..."
                  />
                </div>
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowAddOrganization(false)}
                    className="px-8 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 text-base font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Create Organization
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Edit Organization Modal */}
      {showEditOrganization && editingOrganization && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-5xl bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-8">Edit Organization</h3>
              <form onSubmit={handleUpdateOrganization} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Organization Name</label>
                    <input
                      type="text"
                      required
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={organizationForm.name}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Organization Type</label>
                    <select
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={organizationForm.organizationType}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, organizationType: e.target.value })}
                    >
                      <option value="client-organization">Client Organization</option>
                      <option value="my-organization">My Organization</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Owner Name</label>
                    <input
                      type="text"
                      required
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={organizationForm.ownerName}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, ownerName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Owner Email</label>
                    <input
                      type="email"
                      required
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={organizationForm.ownerEmail}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, ownerEmail: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Owner Phone</label>
                    <input
                      type="tel"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={organizationForm.ownerPhone}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, ownerPhone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                    <input
                      type="text"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={organizationForm.industry}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, industry: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Plan</label>
                    <select
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={organizationForm.subscriptionPlan}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, subscriptionPlan: e.target.value })}
                    >
                      <option value="trial">Trial</option>
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                    <input
                      type="url"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={organizationForm.website}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, website: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Users</label>
                    <input
                      type="number"
                      min="1"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={organizationForm.maxUsers}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, maxUsers: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Products</label>
                    <input
                      type="number"
                      min="1"
                      className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={organizationForm.maxProducts}
                      onChange={(e) => setOrganizationForm({ ...organizationForm, maxProducts: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    rows={4}
                    className="block w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={organizationForm.description}
                    onChange={(e) => setOrganizationForm({ ...organizationForm, description: e.target.value })}
                    placeholder="Enter organization description..."
                  />
                </div>
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditOrganization(false);
                      setEditingOrganization(null);
                    }}
                    className="px-8 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Update Organization
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
