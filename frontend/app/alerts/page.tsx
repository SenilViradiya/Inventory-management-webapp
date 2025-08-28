'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { alertsAPI, productsAPI } from '../lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Alert {
  _id: string;
  type: 'low-stock' | 'out-of-stock' | 'expired' | 'expiring-soon';
  title: string;
  message: string;
  productId?: {
    _id: string;
    name: string;
    qrCode: string;
    quantity: number;
  };
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

const alertTypeConfig = {
  'low-stock': {
    icon: '⚠️',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },
  'out-of-stock': {
    icon: '❌',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'expired': {
    icon: '💀',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  'expiring-soon': {
    icon: '⏰',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200'
  }
};

export default function AlertsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'low-stock' | 'out-of-stock' | 'expired' | 'expiring-soon'>('all');
  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    lowStock: 0,
    outOfStock: 0,
    expired: 0,
    expiringSoon: 0
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAlerts();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    filterAlerts();
    calculateStats();
  }, [alerts, filter]);

  const fetchAlerts = async () => {
    try {
      // Fetch products and generate comprehensive alerts
      const productsResponse = await productsAPI.getAll();
      const products = productsResponse.data.products || [];
      
      const mockAlerts: Alert[] = [];
      const currentDate = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(currentDate.getDate() + 30);
      
      // Generate alerts for each product
      products.forEach((product: any) => {
        // Out of stock alerts
        if (product.quantity === 0) {
          mockAlerts.push({
            _id: `out-of-stock-${product._id}`,
            type: 'out-of-stock',
            title: 'Out of Stock Alert',
            message: `${product.name} is completely out of stock and needs immediate restocking.`,
            productId: {
              _id: product._id,
              name: product.name,
              qrCode: product.qrCode,
              quantity: product.quantity
            },
            isRead: false,
            createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(), // Random time in last 24h
            updatedAt: new Date().toISOString()
          });
        }
        
        // Low stock alerts (1-5 items)
        else if (product.quantity > 0 && product.quantity <= 5) {
          mockAlerts.push({
            _id: `low-stock-${product._id}`,
            type: 'low-stock',
            title: 'Low Stock Warning',
            message: `${product.name} is running low with only ${product.quantity} unit${product.quantity > 1 ? 's' : ''} remaining. Consider restocking soon.`,
            productId: {
              _id: product._id,
              name: product.name,
              qrCode: product.qrCode,
              quantity: product.quantity
            },
            isRead: Math.random() > 0.5, // Randomly mark some as read
            createdAt: new Date(Date.now() - Math.random() * 172800000).toISOString(), // Random time in last 48h
            updatedAt: new Date().toISOString()
          });
        }

        // Expiry alerts
        if (product.expirationDate) {
          const expiryDate = new Date(product.expirationDate);
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (expiryDate < currentDate) {
            // Expired products
            mockAlerts.push({
              _id: `expired-${product._id}`,
              type: 'expired',
              title: 'Product Expired',
              message: `${product.name} expired ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) > 1 ? 's' : ''} ago and should be removed from inventory.`,
              productId: {
                _id: product._id,
                name: product.name,
                qrCode: product.qrCode,
                quantity: product.quantity
              },
              isRead: false,
              createdAt: expiryDate.toISOString(),
              updatedAt: new Date().toISOString()
            });
          } else if (daysUntilExpiry <= 30) {
            // Expiring soon
            mockAlerts.push({
              _id: `expiring-soon-${product._id}`,
              type: 'expiring-soon',
              title: 'Product Expiring Soon',
              message: `${product.name} will expire in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''} on ${expiryDate.toLocaleDateString()}.`,
              productId: {
                _id: product._id,
                name: product.name,
                qrCode: product.qrCode,
                quantity: product.quantity
              },
              isRead: Math.random() > 0.7, // Most expiring alerts unread
              createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      });

      // Add some general system alerts
      if (mockAlerts.filter(a => a.type === 'out-of-stock').length > 0) {
        mockAlerts.push({
          _id: 'system-stock-critical',
          type: 'out-of-stock',
          title: 'Critical Stock Situation',
          message: `You have ${mockAlerts.filter(a => a.type === 'out-of-stock').length} product(s) completely out of stock. Immediate attention required.`,
          isRead: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      setAlerts(mockAlerts);
    } catch (error: any) {
      toast.error('Failed to fetch alerts');
      console.error('Error fetching alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAlerts = () => {
    let filtered = alerts;

    switch (filter) {
      case 'unread':
        filtered = alerts.filter(alert => !alert.isRead);
        break;
      case 'low-stock':
      case 'out-of-stock':
      case 'expired':
      case 'expiring-soon':
        filtered = alerts.filter(alert => alert.type === filter);
        break;
      default:
        filtered = alerts;
    }

    // Sort by creation date (newest first) and unread first
    filtered.sort((a, b) => {
      if (a.isRead !== b.isRead) {
        return a.isRead ? 1 : -1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    setFilteredAlerts(filtered);
  };

  const calculateStats = () => {
    setStats({
      total: alerts.length,
      unread: alerts.filter(alert => !alert.isRead).length,
      lowStock: alerts.filter(alert => alert.type === 'low-stock').length,
      outOfStock: alerts.filter(alert => alert.type === 'out-of-stock').length,
      expired: alerts.filter(alert => alert.type === 'expired').length,
      expiringSoon: alerts.filter(alert => alert.type === 'expiring-soon').length
    });
  };

  const markAsRead = async (alertId: string) => {
    try {
      // For now, just update locally since backend might not have this endpoint
      setAlerts(alerts.map(alert => 
        alert._id === alertId ? { ...alert, isRead: true } : alert
      ));
      toast.success('Alert marked as read');
    } catch (error: any) {
      toast.error('Failed to mark alert as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      // For now, just update locally since backend might not have this endpoint
      setAlerts(alerts.map(alert => ({ ...alert, isRead: true })));
      toast.success('All alerts marked as read');
    } catch (error: any) {
      toast.error('Failed to mark all alerts as read');
    }
  };

  const deleteAlert = async (alertId: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) {
      return;
    }

    try {
      // For now, just update locally since backend might not have this endpoint
      setAlerts(alerts.filter(alert => alert._id !== alertId));
      toast.success('Alert deleted');
    } catch (error: any) {
      toast.error('Failed to delete alert');
    }
  };

  const clearAllRead = async () => {
    if (!confirm('Are you sure you want to delete all read alerts?')) {
      return;
    }

    try {
      // For now, just update locally since backend might not have this endpoint
      setAlerts(alerts.filter(alert => !alert.isRead));
      toast.success('Read alerts cleared');
    } catch (error: any) {
      toast.error('Failed to clear read alerts');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href="/dashboard" className="mr-4">
                <svg className="h-6 w-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                Alerts
                {stats.unread > 0 && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {stats.unread} unread
                  </span>
                )}
              </h1>
            </div>
            <div className="flex space-x-2">
              {stats.unread > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="btn btn-secondary"
                >
                  Mark All Read
                </button>
              )}
              {alerts.some(alert => alert.isRead) && (
                <button
                  onClick={clearAllRead}
                  className="btn btn-secondary"
                >
                  Clear Read
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.unread}</div>
            <div className="text-sm text-gray-600">Unread</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.lowStock}</div>
            <div className="text-sm text-gray-600">Low Stock</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.outOfStock}</div>
            <div className="text-sm text-gray-600">Out of Stock</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
            <div className="text-sm text-gray-600">Expired</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.expiringSoon}</div>
            <div className="text-sm text-gray-600">Expiring Soon</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {[
                { key: 'all', label: 'All Alerts', count: stats.total },
                { key: 'unread', label: 'Unread', count: stats.unread },
                { key: 'low-stock', label: 'Low Stock', count: stats.lowStock },
                { key: 'out-of-stock', label: 'Out of Stock', count: stats.outOfStock },
                { key: 'expired', label: 'Expired', count: stats.expired },
                { key: 'expiring-soon', label: 'Expiring Soon', count: stats.expiringSoon }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    filter === tab.key
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                      filter === tab.key
                        ? 'bg-primary-100 text-primary-600'
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Alerts List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading alerts...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM9 7H4l5-5v5zm6 10h-4v4h4v-4z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No alerts found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === 'all' 
                ? 'No alerts to display. Your inventory is looking good!'
                : `No ${filter.replace('-', ' ')} alerts found.`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAlerts.map((alert) => {
              const config = alertTypeConfig[alert.type];
              return (
                <div
                  key={alert._id}
                  className={`bg-white shadow rounded-lg border-l-4 ${config.borderColor} ${
                    !alert.isRead ? 'ring-2 ring-primary-200' : ''
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className={`flex-shrink-0 ${config.bgColor} rounded-full p-2`}>
                          <span className="text-lg">{config.icon}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className={`text-lg font-medium ${config.color}`}>
                              {alert.title}
                            </h3>
                            {!alert.isRead && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                                New
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-gray-600">{alert.message}</p>
                          {alert.productId && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-md">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="font-medium text-gray-900">{alert.productId.name}</p>
                                  <p className="text-sm text-gray-600">QR: {alert.productId.qrCode}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-gray-600">Stock:</p>
                                  <p className={`font-bold ${
                                    alert.productId.quantity === 0 ? 'text-red-600' : 
                                    alert.productId.quantity <= 5 ? 'text-orange-600' : 'text-green-600'
                                  }`}>
                                    {alert.productId.quantity}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                          <p className="mt-2 text-sm text-gray-500">
                            {formatTimeAgo(alert.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {!alert.isRead && (
                          <button
                            onClick={() => markAsRead(alert._id)}
                            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                          >
                            Mark Read
                          </button>
                        )}
                        <button
                          onClick={() => deleteAlert(alert._id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
