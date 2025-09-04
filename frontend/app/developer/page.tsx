'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { developerAPI, authAPI } from '../lib/api';
import type { SystemMetrics, APIEndpoint, DeveloperAppSummary } from '../lib/types';
import { toast } from 'react-hot-toast';
import { 
  CodeIcon, 
  DatabaseIcon, 
  ServerIcon, 
  MonitorIcon,
  KeyIcon,
  SettingsIcon,
  BarChart3Icon,
  ShieldIcon,
  GitBranchIcon,
  TerminalIcon,
  BugIcon,
  RocketIcon,
  LogOutIcon,
  UserIcon,
  ActivityIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from 'lucide-react';

type TabType = 'overview' | 'metrics' | 'apis' | 'monitoring' | 'settings' | 'store-analytics';

export default function DeveloperPortalPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [apiEndpoints, setApiEndpoints] = useState<APIEndpoint[]>([]);
  const [appSummary, setAppSummary] = useState<DeveloperAppSummary | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  // Store analytics states
  const [stores, setStores] = useState<{ _id: string; name: string }[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [storeAnalytics, setStoreAnalytics] = useState<any>(null);
  const [latestRequests, setLatestRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }
      
      // Check if user has developer/superadmin role
      if (!user || (user.username !== 'developer' && user.role !== 'superadmin')) {
        toast.error('Access denied. Developer privileges required.');
        router.push('/dashboard');
        return;
      }
      
      // User is authenticated and has proper role, fetch data
      fetchStores();
      fetchAllData();
    }
  }, [isAuthenticated, isLoading, user, router]);
  // Fetch all stores for dropdown
  async function fetchStores() {
    try {
      const res = await developerAPI.getAllStores();
      setStores(res.data.shops || []);
    } catch (error) {
      console.error('Error fetching stores:', error);
      setStores([]);
    }
  }

  // Fetch analytics for selected store
  async function fetchStoreAnalytics(storeId: string) {
    try {
      const res = await developerAPI.getStoreAnalytics(storeId);
      setStoreAnalytics(res.data.data || null);
    } catch (error) {
      setStoreAnalytics(null);
    }
  }

  // Fetch latest requests for selected store
  async function fetchLatestRequests(storeId: string) {
    setRequestsLoading(true);
    try {
      const res = await developerAPI.getLatestRequests(storeId);
      setLatestRequests(res.data.data || []);
    } catch (error) {
      setLatestRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }

  // Remove old useEffect that depended on user state
  
  const fetchAllData = async () => {
  // Fetch all stores for dropdown
  const fetchStores = async () => {
    try {
      // Replace with real API call
      const res = await developerAPI.getAllStores();
      setStores(res.data.data || []);
    } catch (error) {
      setStores([]);
    }
  };

  // Fetch analytics for selected store
  const fetchStoreAnalytics = async (storeId: string) => {
    try {
      // Replace with real API call
      const res = await developerAPI.getStoreAnalytics(storeId);
      setStoreAnalytics(res.data.data || null);
    } catch (error) {
      setStoreAnalytics(null);
    }
  };

  // Fetch latest requests for selected store
  const fetchLatestRequests = async (storeId: string) => {
    setRequestsLoading(true);
    try {
      // Replace with real API call
      const res = await developerAPI.getLatestRequests(storeId);
      setLatestRequests(res.data.data || []);
    } catch (error) {
      setLatestRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  };
    try {
      setLoading(true);
      
      // Fetch system metrics (mock data for now since endpoint might not exist)
      setSystemMetrics({
        serverStatus: 'healthy',
        databaseStatus: 'connected',
        apiCalls: 15420,
        activeUsers: 32,
        memoryUsage: 68,
        cpuUsage: 24,
        diskUsage: 45,
        uptime: '7d 14h 23m'
      });

      // Fetch API endpoints (mock data)
      setApiEndpoints([
        { method: 'GET', path: '/api/products', description: 'Get all products', status: 'active', calls: 2156, avgResponseTime: 142 },
        { method: 'POST', path: '/api/products', description: 'Create new product', status: 'active', calls: 487, avgResponseTime: 256 },
        { method: 'GET', path: '/api/analytics/dashboard', description: 'Get dashboard analytics', status: 'active', calls: 1203, avgResponseTime: 318 },
        { method: 'POST', path: '/api/stock/adjust', description: 'Adjust stock levels', status: 'active', calls: 298, avgResponseTime: 189 },
        { method: 'GET', path: '/api/alerts', description: 'Get system alerts', status: 'active', calls: 567, avgResponseTime: 98 },
        { method: 'POST', path: '/api/orders', description: 'Create new order', status: 'active', calls: 345, avgResponseTime: 275 },
        { method: 'GET', path: '/api/suppliers', description: 'Get suppliers list', status: 'active', calls: 167, avgResponseTime: 125 },
        { method: 'POST', path: '/api/auth/login', description: 'User authentication', status: 'active', calls: 89, avgResponseTime: 445 }
      ]);

      // Try to fetch real app summary
      try {
        const summaryResponse = await developerAPI.getAppSummary('inventory-system');
        setAppSummary(summaryResponse.data.data);
      } catch (error) {
        console.log('App summary not available:', error);
        // Set mock summary data
        setAppSummary({
          app: 'inventory-system',
          summary: [
            { _id: 'api_calls', count: 15420, last: new Date().toISOString() },
            { _id: 'errors', count: 23, last: new Date().toISOString() },
            { _id: 'successful_operations', count: 15397, last: new Date().toISOString() }
          ]
        });
      }

      generateApiKey();
    } catch (error) {
      console.error('Error fetching developer data:', error);
      toast.error('Failed to load developer portal data');
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = () => {
    const key = `inv_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    setApiKey(key);
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      toast.success('Logged out successfully');
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      // Force logout even if API call fails
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.push('/login');
    }
  };

  const handleIngestTestMetric = async () => {
    try {
      await developerAPI.ingestMetric({
        app: 'inventory-system',
        metricType: 'test_metric',
        value: 1,
        details: { source: 'developer_portal', timestamp: new Date().toISOString() }
      });
      toast.success('Test metric ingested successfully');
      fetchAllData(); // Refresh data
    } catch (error) {
      console.error('Error ingesting metric:', error);
      toast.error('Failed to ingest test metric');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'warning':
      case 'slow':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
      case 'disconnected':
        return 'bg-red-100 text-red-800';
      case 'beta':
        return 'bg-blue-100 text-blue-800';
      case 'deprecated':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CodeIcon className="w-8 h-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Developer Portal</h1>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                v2.1.0
              </Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <UserIcon className="w-4 h-4" />
                <span>{user?.fullName || user?.username}</span>
                <Badge className="bg-purple-100 text-purple-800">
                  {user?.role}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOutIcon className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex mt-4 border-b">
            {[
              { id: 'overview', label: 'Overview', icon: MonitorIcon },
              { id: 'metrics', label: 'Metrics', icon: BarChart3Icon },
              { id: 'apis', label: 'API Status', icon: ServerIcon },
              { id: 'monitoring', label: 'Monitoring', icon: ActivityIcon },
              { id: 'settings', label: 'Settings', icon: SettingsIcon },
              { id: 'store-analytics', label: 'Store Analytics', icon: BarChart3Icon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        {/* Store Analytics Tab */}
        {activeTab === 'store-analytics' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Store Analytics</CardTitle>
                <CardDescription>Select a store to view analytics and latest requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-center mb-4">
                  <select
                    className="border rounded px-3 py-2"
                    value={selectedStore}
                    onChange={e => {
                      setSelectedStore(e.target.value);
                      fetchStoreAnalytics(e.target.value);
                      fetchLatestRequests(e.target.value);
                    }}
                  >
                    <option value="">Select Store</option>
                    {stores.map(store => (
                      <option key={store._id} value={store._id}>{store.name}</option>
                    ))}
                  </select>
                  <Button variant="outline" onClick={() => {
                    if (selectedStore) {
                      fetchStoreAnalytics(selectedStore);
                      fetchLatestRequests(selectedStore);
                    }
                  }}>Refresh</Button>
                </div>
                {selectedStore && storeAnalytics ? (
                  <div className="mb-6">
                    <h3 className="font-semibold text-lg mb-2">Analytics for {stores.find(s => s._id === selectedStore)?.name}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Example analytics cards, replace with real data */}
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900">Total Sales</h4>
                        <p className="text-2xl font-bold text-blue-600">{storeAnalytics.totalSales || 0}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900">Total Orders</h4>
                        <p className="text-2xl font-bold text-green-600">{storeAnalytics.totalOrders || 0}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900">Low Stock Items</h4>
                        <p className="text-2xl font-bold text-red-600">{storeAnalytics.lowStockCount || 0}</p>
                      </div>
                    </div>
                  </div>
                ) : selectedStore ? (
                  <div className="text-gray-500">No analytics available for this store.</div>
                ) : null}
                {selectedStore && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Latest Requests</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white border rounded">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 border">Method</th>
                            <th className="px-4 py-2 border">Path</th>
                            <th className="px-4 py-2 border">Request Body</th>
                            <th className="px-4 py-2 border">Status Code</th>
                            <th className="px-4 py-2 border">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {requestsLoading ? (
                            <tr><td colSpan={5} className="text-center py-4">Loading...</td></tr>
                          ) : latestRequests.length > 0 ? (
                            latestRequests.map((req, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 border font-mono">{req.method}</td>
                                <td className="px-4 py-2 border font-mono">{req.path}</td>
                                <td className="px-4 py-2 border font-mono whitespace-pre-wrap max-w-xs">{JSON.stringify(req.body)}</td>
                                <td className="px-4 py-2 border font-mono">{req.statusCode}</td>
                                <td className="px-4 py-2 border font-mono">{new Date(req.timestamp).toLocaleString()}</td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan={5} className="text-center py-4">No requests found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* System Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Server Status</p>
                      <Badge className={getStatusColor(systemMetrics?.serverStatus || 'unknown')}>
                        {systemMetrics?.serverStatus || 'Unknown'}
                      </Badge>
                    </div>
                    <ServerIcon className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Database</p>
                      <Badge className={getStatusColor(systemMetrics?.databaseStatus || 'unknown')}>
                        {systemMetrics?.databaseStatus || 'Unknown'}
                      </Badge>
                    </div>
                    <DatabaseIcon className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">API Calls</p>
                      <p className="text-2xl font-bold">{systemMetrics?.apiCalls.toLocaleString() || 0}</p>
                    </div>
                    <TrendingUpIcon className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Active Users</p>
                      <p className="text-2xl font-bold">{systemMetrics?.activeUsers || 0}</p>
                    </div>
                    <UserIcon className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* System Resources */}
            <Card>
              <CardHeader>
                <CardTitle>System Resources</CardTitle>
                <CardDescription>Current system resource utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Memory Usage</span>
                      <span>{systemMetrics?.memoryUsage || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${systemMetrics?.memoryUsage || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>CPU Usage</span>
                      <span>{systemMetrics?.cpuUsage || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${systemMetrics?.cpuUsage || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Disk Usage</span>
                      <span>{systemMetrics?.diskUsage || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-600 h-2 rounded-full" 
                        style={{ width: `${systemMetrics?.diskUsage || 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <ClockIcon className="w-4 h-4" />
                    <span>Uptime: {systemMetrics?.uptime || 'Unknown'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Developer Actions</CardTitle>
                <CardDescription>Common development and testing actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button onClick={handleIngestTestMetric} className="h-20 flex flex-col gap-2">
                    <RocketIcon className="w-6 h-6" />
                    Test Metric
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <BugIcon className="w-6 h-6" />
                    Debug Logs
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <TerminalIcon className="w-6 h-6" />
                    Console
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col gap-2">
                    <GitBranchIcon className="w-6 h-6" />
                    Deploy
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Application Metrics Summary</CardTitle>
                <CardDescription>Aggregated metrics for the inventory system</CardDescription>
              </CardHeader>
              <CardContent>
                {appSummary ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {appSummary.summary.map((metric) => (
                      <div key={metric._id} className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900 capitalize">
                          {metric._id.replace(/_/g, ' ')}
                        </h4>
                        <p className="text-2xl font-bold text-blue-600">{metric.count.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">
                          Last updated: {new Date(metric.last).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No metrics data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Metric Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button onClick={handleIngestTestMetric}>
                    Ingest Test Metric
                  </Button>
                  <Button variant="outline" onClick={fetchAllData}>
                    Refresh Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* APIs Tab */}
        {activeTab === 'apis' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Endpoints Status</CardTitle>
                <CardDescription>Current status and performance of all API endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {apiEndpoints.map((endpoint, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="font-mono">
                          {endpoint.method}
                        </Badge>
                        <div>
                          <p className="font-medium">{endpoint.path}</p>
                          <p className="text-sm text-gray-600">{endpoint.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">{endpoint.calls.toLocaleString()} calls</p>
                          <p className="text-xs text-gray-500">{endpoint.avgResponseTime}ms avg</p>
                        </div>
                        <Badge className={getStatusColor(endpoint.status)}>
                          {endpoint.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Monitoring Tab */}
        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">API Health Check Passed</p>
                        <p className="text-xs text-gray-500">2 minutes ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <ActivityIcon className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium">Database Connection Stable</p>
                        <p className="text-xs text-gray-500">5 minutes ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                      <AlertTriangleIcon className="w-5 h-5 text-yellow-600" />
                      <div>
                        <p className="text-sm font-medium">High Memory Usage Detected</p>
                        <p className="text-xs text-gray-500">10 minutes ago</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <XCircleIcon className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="text-sm font-medium">Disk Space Warning</p>
                        <p className="text-xs text-gray-500">Disk usage above 80%</p>
                      </div>
                    </div>
                    <div className="text-center py-4 text-gray-500">
                      No other alerts at this time
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Configuration</CardTitle>
                <CardDescription>Manage API keys and access tokens</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Developer API Key</label>
                    <div className="flex gap-2">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        readOnly
                        className="font-mono"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? 'Hide' : 'Show'}
                      </Button>
                      <Button onClick={generateApiKey}>
                        Regenerate
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Use this key for API authentication in development
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Developer Tools</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button variant="outline" className="w-full justify-start">
                    <TerminalIcon className="w-4 h-4 mr-2" />
                    Open API Documentation
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <CodeIcon className="w-4 h-4 mr-2" />
                    Download SDK
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <ShieldIcon className="w-4 h-4 mr-2" />
                    Security Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
