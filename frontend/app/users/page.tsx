'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { usersAPI } from '../lib/api';
import Navigation from '../components/Navigation';
import toast from 'react-hot-toast';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function UsersPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'staff'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!authLoading && isAuthenticated && user?.role !== 'admin') {
      router.push('/dashboard');
      toast.error('Access denied. Admin privileges required.');
    }
  }, [isAuthenticated, authLoading, user, router]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchUsers();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter, statusFilter]);

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data.users || []);
    } catch (error: any) {
      toast.error('Failed to fetch users');
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users.filter(u => {
      const matchesSearch =
        (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && u.isActive) ||
        (statusFilter === 'inactive' && !u.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });

    // Sort by creation date (newest first) and role (admin first)
    filtered.sort((a, b) => {
      if (a.role !== b.role) {
        return a.role === 'admin' ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    setFilteredUsers(filtered);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    // Prevent admin from deactivating themselves
    if (userId === user?.id) {
      toast.error('You cannot deactivate your own account');
      return;
    }

    try {
      await usersAPI.toggleStatus(userId);
      setUsers(users.map(u =>
        u._id === userId ? { ...u, isActive: !currentStatus } : u
      ));
      toast.success(`User ${currentStatus ? 'deactivated' : 'activated'} successfully`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update user status');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleColor = (role: string) => {
    return role === 'admin' ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50';
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Add User
            </button>
          </div>
        </div>

        <main>
          {/* Filters */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search Users
                </label>
                <input
                  type="text"
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Search by name or email..."
                />
              </div>

              {/* Role Filter */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  id="role"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Users Table */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-white shadow rounded-lg">
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your search filters'
                    : 'Get started by adding your first user'
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="min-w-full">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                  <div className="grid grid-cols-12 gap-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="col-span-3">User</div>
                    <div className="col-span-2">Role</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-3">Created</div>
                    <div className="col-span-2">Actions</div>
                  </div>
                </div>
                <div className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((u) => (
                    <div key={u._id} className="px-6 py-4">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        {/* User Info */}
                        <div className="col-span-3">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-primary-600">
                                  {(u.name ?? '').split(' ').map(n => n[0]).join('').toUpperCase()}                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{u.name}</div>
                              <div className="text-sm text-gray-500">{u.email}</div>
                              {u._id === user?.id && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Role */}
                        <div className="col-span-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(u.role)}`}>
                            {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="col-span-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(u.isActive)}`}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        {/* Created Date */}
                        <div className="col-span-3">
                          <div className="text-sm text-gray-900">{formatDate(u.createdAt)}</div>
                        </div>

                        {/* Actions */}
                        <div className="col-span-2">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => toggleUserStatus(u._id, u.isActive)}
                              disabled={u._id === user?.id}
                              className={`text-sm font-medium ${u._id === user?.id
                                ? 'text-gray-400 cursor-not-allowed'
                                : u.isActive
                                  ? 'text-red-600 hover:text-red-700'
                                  : 'text-green-600 hover:text-green-700'
                                }`}
                              title={u._id === user?.id ? 'Cannot modify your own account' : ''}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white shadow rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{users.length}</div>
              <div className="text-sm text-gray-600">Total Users</div>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{users.filter(u => u.isActive).length}</div>
              <div className="text-sm text-gray-600">Active Users</div>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{users.filter(u => u.role === 'admin').length}</div>
              <div className="text-sm text-gray-600">Administrators</div>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{users.filter(u => u.role === 'staff').length}</div>
              <div className="text-sm text-gray-600">Staff Members</div>
            </div>
          </div>
        </main>
      </div>

      {/* Add User Modal */}
      {showAddForm && (
        <AddUserModal
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            setShowAddForm(false);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}

// Add User Modal Component
interface AddUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddUserModal({ onClose, onSuccess }: AddUserModalProps) {
  const [formData, setFormData] = useState({
    username: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'staff' as 'admin' | 'staff',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await usersAPI.register(formData);
      toast.success('User created successfully');
      onSuccess();
    } catch (error: any) {
      // Show all validation errors if present
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        error.response.data.errors.forEach((err: any) => {
          toast.error(err.msg);
        });
      } else {
        toast.error(error.response?.data?.message || 'Failed to create user');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Add New User</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={30}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter username"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Last name"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter email address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter password (min. 6 characters)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="staff">Staff</option>
                <option value="admin">Administrator</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Staff can manage inventory. Administrators have full access.
              </p>
            </div>
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 btn btn-primary"
              >
                {isLoading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
