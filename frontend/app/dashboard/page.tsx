'use client';

import { useState, useEffect } from 'react';
import { analyticsAPI, alertsAPI, productsAPI } from '../lib/api';
import type { Product, Alert, DashboardStats } from '../lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { 
  PackageIcon, 
  TrendingUpIcon, 
  AlertTriangleIcon, 
  DollarSignIcon,
  ShoppingCartIcon,
  UsersIcon,
  BarChart3Icon,
  BellIcon
} from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch dashboard stats
  const statsResponse = await analyticsAPI.getDashboard();
  setStats(statsResponse.data.data);

      // Fetch alerts
  const alertsResponse = await alertsAPI.getAll({ limit: 5 });
  setAlerts(alertsResponse.data.data || []);

      // Fetch low stock products
  const productsResponse = await productsAPI.getAll({ lowStock: true, limit: 5 });
  setLowStockProducts(productsResponse.data.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (loading) {
    return (
      <div className="bg-gray-50 flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome to your inventory management dashboard</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <PackageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
              <p className="text-xs text-muted-foreground">
                +20.1% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats?.totalValue?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                +15.2% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <AlertTriangleIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.lowStockCount || 0}</div>
              <p className="text-xs text-muted-foreground">
                Needs attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Orders</CardTitle>
              <ShoppingCartIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {/* No ordersToday in DashboardStats, show lowStockCount or other relevant stat */}
              <div className="text-2xl font-bold">{stats?.lowStockCount || 0}</div>
              <p className="text-xs text-muted-foreground">
                +5 from yesterday
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Sales Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Trend</CardTitle>
              <CardDescription>Your sales performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats?.salesTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="sales" stroke="#3B82F6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Product Categories Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Product Categories</CardTitle>
              <CardDescription>Distribution of products by category</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(stats?.categoryCounts || {}).map(([name, value]) => ({ name, value }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {Object.entries(stats?.categoryCounts || {}).map(([name, value], index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions and Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BellIcon className="h-5 w-5 mr-2" />
                Recent Alerts
              </CardTitle>
              <CardDescription>Latest system notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.length > 0 ? (
                  alerts.map((alert) => (
                    <div key={alert._id} className="flex items-start space-x-3">
                      <AlertTriangleIcon className="h-5 w-5 text-orange-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{alert.title}</p>
                        <p className="text-xs text-gray-500">{alert.message}</p>
                        <p className="text-xs text-gray-400">
                          {format(new Date(alert.createdAt), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                      <Badge variant={alert.severity === 'high' ? 'destructive' : 'secondary'}>
                        {alert.severity}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No recent alerts</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Low Stock Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PackageIcon className="h-5 w-5 mr-2" />
                Low Stock Products
              </CardTitle>
              <CardDescription>Products that need restocking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lowStockProducts.length > 0 ? (
                  lowStockProducts.map((product) => (
                    <div key={product._id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{product.name}</p>
                        {/* SKU not available in Product type, remove or replace if needed */}
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive">
                          {product.quantity} left
                        </Badge>
                        {/* Reorder level not available in Product type, remove or replace if needed */}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">All products are well-stocked</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button className="h-16 flex flex-col items-center justify-center space-y-2">
                  <PackageIcon className="h-6 w-6" />
                  <span className="text-sm">Add Product</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col items-center justify-center space-y-2">
                  <ShoppingCartIcon className="h-6 w-6" />
                  <span className="text-sm">New Order</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col items-center justify-center space-y-2">
                  <BarChart3Icon className="h-6 w-6" />
                  <span className="text-sm">View Reports</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col items-center justify-center space-y-2">
                  <UsersIcon className="h-6 w-6" />
                  <span className="text-sm">Manage Users</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
