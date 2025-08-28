'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { analyticsAPI, productsAPI } from '../lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from 'recharts';

interface AnalyticsData {
  totalProducts: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  categorySummary: Array<{
    category: string;
    count: number;
    value: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    stockReductions: number;
    value: number;
  }>;
}

interface TodaySalesData {
  totalSales: number;
  totalItemsSold: number;
  totalTransactions: number;
  categoryBreakdown: Array<{
    category: string;
    quantity: number;
    value: number;
  }>;
  hourlySales: Array<{
    hour: number;
    sales: number;
    transactions: number;
  }>;
  date: string;
}

export default function AnalyticsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [todaySales, setTodaySales] = useState<TodaySalesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAnalytics();
    }
  }, [isAuthenticated, timeRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      // Fetch regular analytics data
      const productsResponse = await productsAPI.getAll();
      const products = productsResponse.data.products || [];

      // Calculate analytics from products data
      const totalProducts = products.length;
      const totalValue = products.reduce((sum: number, product: any) => 
        sum + (product.price * product.quantity), 0);
      const lowStockItems = products.filter((product: any) => 
        product.quantity > 0 && product.quantity <= 5).length;
      const outOfStockItems = products.filter((product: any) => 
        product.quantity === 0).length;

      // Category summary
      const categoryMap = new Map();
      products.forEach((product: any) => {
        if (!categoryMap.has(product.category)) {
          categoryMap.set(product.category, { count: 0, value: 0 });
        }
        const category = categoryMap.get(product.category);
        category.count += 1;
        category.value += product.price * product.quantity;
      });

      const categorySummary = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        count: data.count,
        value: data.value
      }));

      // Mock monthly trend (in real app, this would come from sales/stock movement data)
      const monthlyTrend = [
        { month: 'Jan', stockReductions: 120, value: 2400 },
        { month: 'Feb', stockReductions: 145, value: 2900 },
        { month: 'Mar', stockReductions: 132, value: 2640 },
        { month: 'Apr', stockReductions: 158, value: 3160 },
        { month: 'May', stockReductions: 167, value: 3340 },
        { month: 'Jun', stockReductions: 189, value: 3780 }
      ];

      const analyticsData: AnalyticsData = {
        totalProducts,
        totalValue,
        lowStockItems,
        outOfStockItems,
        categorySummary,
        monthlyTrend
      };

      setAnalytics(analyticsData);

      // Fetch today's sales data
      try {
        const todayResponse = await analyticsAPI.getTodaySales();
        setTodaySales(todayResponse.data);
      } catch (salesError) {
        console.error('Error fetching today sales:', salesError);
        // Set default empty data if API fails
        setTodaySales({
          totalSales: 0,
          totalItemsSold: 0,
          totalTransactions: 0,
          categoryBreakdown: [],
          hourlySales: [],
          date: new Date().toISOString().split('T')[0]
        });
      }
    } catch (error: any) {
      toast.error('Failed to fetch analytics data');
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getHealthScore = () => {
    if (!analytics) return 0;
    const total = analytics.totalProducts;
    if (total === 0) return 100;
    
    const outOfStockPenalty = (analytics.outOfStockItems / total) * 50;
    const lowStockPenalty = (analytics.lowStockItems / total) * 25;
    
    return Math.max(0, 100 - outOfStockPenalty - lowStockPenalty);
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
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

  const healthScore = getHealthScore();

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
              <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading analytics...</p>
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            {/* Today's Sales Section */}
            {todaySales && (
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 shadow rounded-lg p-6 text-white">
                <h2 className="text-xl font-bold mb-4">Today's Sales - {new Date().toLocaleDateString()}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex items-center">
                      <svg className="h-8 w-8 text-white/90 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      <div>
                        <p className="text-white/80 text-sm">Total Sales</p>
                        <p className="text-2xl font-bold">{formatCurrency(todaySales.totalSales)}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex items-center">
                      <svg className="h-8 w-8 text-white/90 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-3-3-3 3m6 6l-3 3-3-3" />
                      </svg>
                      <div>
                        <p className="text-white/80 text-sm">Items Sold</p>
                        <p className="text-2xl font-bold">{todaySales.totalItemsSold}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex items-center">
                      <svg className="h-8 w-8 text-white/90 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <div>
                        <p className="text-white/80 text-sm">Transactions</p>
                        <p className="text-2xl font-bold">{todaySales.totalTransactions}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hourly Sales Chart */}
                {todaySales.hourlySales.length > 0 && (
                  <div className="bg-white rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Hourly Sales</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={todaySales.hourlySales}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="hour" 
                            tickFormatter={(hour) => `${hour}:00`}
                          />
                          <YAxis tickFormatter={(value) => formatCurrency(value)} />
                          <Tooltip 
                            labelFormatter={(hour) => `${hour}:00 - ${hour + 1}:00`}
                            formatter={(value: any) => [formatCurrency(value), 'Sales']}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="sales" 
                            stroke="#3B82F6" 
                            fill="#3B82F6" 
                            fillOpacity={0.3} 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Category Breakdown */}
                {todaySales.categoryBreakdown.length > 0 && (
                  <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales by Category</h3>
                      <div className="space-y-2">
                        {todaySales.categoryBreakdown.map((category, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="text-gray-700 font-medium">{category.category}</span>
                            <div className="text-right">
                              <div className="text-gray-900 font-semibold">{formatCurrency(category.value)}</div>
                              <div className="text-gray-500 text-sm">{category.quantity} items</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-3-3-3 3m6 6l-3 3-3-3" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Products</dt>
                      <dd className="text-3xl font-bold text-gray-900">{analytics.totalProducts}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Inventory Value</dt>
                      <dd className="text-3xl font-bold text-gray-900">{formatCurrency(analytics.totalValue)}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-8 w-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.73 0L4.084 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Low Stock Items</dt>
                      <dd className="text-3xl font-bold text-gray-900">{analytics.lowStockItems}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(healthScore)}`}>
                      {Math.round(healthScore)}%
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Inventory Health</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs Attention'}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Category Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Category Distribution</h3>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analytics.categorySummary.map(cat => ({
                          name: cat.category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                          value: cat.count,
                          fill: `hsl(${analytics.categorySummary.indexOf(cat) * 360 / analytics.categorySummary.length}, 70%, 50%)`
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Category Values</h3>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.categorySummary.map(cat => ({
                      category: cat.category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                      value: cat.value,
                      count: cat.count
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Value']} />
                      <Bar dataKey="value" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Monthly Trend */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Monthly Activity Trend</h3>
                <p className="text-sm text-gray-600">Stock reductions and transaction values over time</p>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analytics.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'value' ? formatCurrency(Number(value)) : value,
                        name === 'stockReductions' ? 'Transactions' : 'Revenue'
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="stockReductions" fill="#3B82F6" name="Transactions" />
                    <Bar dataKey="value" fill="#10B981" name="Revenue ($)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Link
                    href="/reports"
                    className="flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Generate Report
                  </Link>
                  
                  <Link
                    href="/alerts"
                    className="flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM9 7H4l5-5v5zm6 10h-4v4h4v-4z" />
                    </svg>
                    View Alerts
                  </Link>
                  
                  <Link
                    href="/products"
                    className="flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-3-3-3 3m6 6l-3 3-3-3" />
                    </svg>
                    Manage Products
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No analytics data available</h3>
            <p className="mt-1 text-sm text-gray-500">
              Add some products to your inventory to see analytics.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
