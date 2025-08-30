'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import { toast } from 'react-hot-toast';

interface ShopProfile {
  name: string;
  address: string;
  postcode: string;
  contactNumber: string;
  vatNumber: string;
  vatPercentage: number;
  invoicePrefix: string;
  paymentTerms: string;
  logo?: string;
  theme: 'light' | 'dark';
}

interface StockSettings {
  lowStockThreshold: number;
  defaultUnit: string;
  qrScanEnabled: boolean;
}

interface NotificationSettings {
  emailAlerts: boolean;
  lowStockAlerts: boolean;
  salesAlerts: boolean;
  endOfDayReports: boolean;
}

interface ReportSettings {
  dailyReports: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
  csvExport: boolean;
  pdfExport: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  permissions: {
    addProducts: boolean;
    editStock: boolean;
    processSales: boolean;
    viewReports: boolean;
    manageUsers: boolean;
  };
  isActive: boolean;
  lastLogin?: string;
}

export default function ShopSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);

  // Shop Profile State
  const [shopProfile, setShopProfile] = useState<ShopProfile>({
    name: 'Premium Off-License',
    address: '123 High Street, London',
    postcode: 'SW1A 1AA',
    contactNumber: '+44 20 7946 0958',
    vatNumber: 'GB123456789',
    vatPercentage: 20,
    invoicePrefix: 'UK-INV-2025-',
    paymentTerms: 'Net 30 days',
    theme: 'light'
  });

  // Stock Settings State
  const [stockSettings, setStockSettings] = useState<StockSettings>({
    lowStockThreshold: 5,
    defaultUnit: 'pcs',
    qrScanEnabled: true
  });

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailAlerts: true,
    lowStockAlerts: true,
    salesAlerts: false,
    endOfDayReports: true
  });

  // Report Settings State
  const [reportSettings, setReportSettings] = useState<ReportSettings>({
    dailyReports: true,
    weeklyReports: true,
    monthlyReports: true,
    csvExport: true,
    pdfExport: true
  });

  // Staff Members State (fake data)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([
    {
      id: '1',
      name: 'John Smith',
      email: 'john@offlicense.com',
      role: 'admin',
      permissions: {
        addProducts: true,
        editStock: true,
        processSales: true,
        viewReports: true,
        manageUsers: true
      },
      isActive: true,
      lastLogin: '2025-08-30T06:30:00Z'
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah@offlicense.com',
      role: 'staff',
      permissions: {
        addProducts: false,
        editStock: true,
        processSales: true,
        viewReports: false,
        manageUsers: false
      },
      isActive: true,
      lastLogin: '2025-08-29T18:15:00Z'
    },
    {
      id: '3',
      name: 'Mike Davis',
      email: 'mike@offlicense.com',
      role: 'staff',
      permissions: {
        addProducts: true,
        editStock: true,
        processSales: true,
        viewReports: true,
        manageUsers: false
      },
      isActive: false,
      lastLogin: '2025-08-25T14:22:00Z'
    }
  ]);

  const [showAddStaffForm, setShowAddStaffForm] = useState(false);
  const [newStaffData, setNewStaffData] = useState({
    name: '',
    email: '',
    role: 'staff' as 'admin' | 'staff',
    permissions: {
      addProducts: false,
      editStock: false,
      processSales: false,
      viewReports: false,
      manageUsers: false
    }
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Shop profile updated successfully');
    } catch (error) {
      toast.error('Failed to update shop profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStockSettings = async () => {
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Stock settings updated successfully');
    } catch (error) {
      toast.error('Failed to update stock settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Notification settings updated successfully');
    } catch (error) {
      toast.error('Failed to update notification settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReports = async () => {
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Report settings updated successfully');
    } catch (error) {
      toast.error('Failed to update report settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddStaff = async () => {
    if (!newStaffData.name || !newStaffData.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const newStaff: StaffMember = {
        id: Date.now().toString(),
        ...newStaffData,
        isActive: true
      };
      setStaffMembers([...staffMembers, newStaff]);
      setNewStaffData({
        name: '',
        email: '',
        role: 'staff',
        permissions: {
          addProducts: false,
          editStock: false,
          processSales: false,
          viewReports: false,
          manageUsers: false
        }
      });
      setShowAddStaffForm(false);
      toast.success('Staff member added successfully');
    } catch (error) {
      toast.error('Failed to add staff member');
    } finally {
      setSaving(false);
    }
  };

  const toggleStaffStatus = (staffId: string) => {
    setStaffMembers(staffMembers.map(staff => 
      staff.id === staffId 
        ? { ...staff, isActive: !staff.isActive }
        : staff
    ));
    toast.success('Staff status updated');
  };

  const updateStaffPermissions = (staffId: string, permission: keyof StaffMember['permissions'], value: boolean) => {
    setStaffMembers(staffMembers.map(staff => 
      staff.id === staffId 
        ? { 
            ...staff, 
            permissions: { 
              ...staff.permissions, 
              [permission]: value 
            } 
          }
        : staff
    ));
    toast.success('Permissions updated');
  };

  const removeStaff = (staffId: string) => {
    if (confirm('Are you sure you want to remove this staff member?')) {
      setStaffMembers(staffMembers.filter(staff => staff.id !== staffId));
      toast.success('Staff member removed');
    }
  };

  const tabs = [
    { id: 'profile', name: 'Shop Profile', icon: '🏪' },
    { id: 'users', name: 'Users & Roles', icon: '👥' },
    { id: 'inventory', name: 'Inventory', icon: '📦' },
    { id: 'reports', name: 'Reports & Exports', icon: '📊' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
    { id: 'appearance', name: 'Appearance', icon: '🎨' }
  ];

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Shop Settings</h1>
            <p className="text-gray-600 mt-1">Manage your shop configuration and preferences</p>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Shop Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Shop Name</label>
                      <input
                        type="text"
                        value={shopProfile.name}
                        onChange={(e) => setShopProfile({ ...shopProfile, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number</label>
                      <input
                        type="tel"
                        value={shopProfile.contactNumber}
                        onChange={(e) => setShopProfile({ ...shopProfile, contactNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                    <textarea
                      value={shopProfile.address}
                      onChange={(e) => setShopProfile({ ...shopProfile, address: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Postcode</label>
                    <input
                      type="text"
                      value={shopProfile.postcode}
                      onChange={(e) => setShopProfile({ ...shopProfile, postcode: e.target.value })}
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Tax Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">VAT Registration Number</label>
                      <input
                        type="text"
                        value={shopProfile.vatNumber}
                        onChange={(e) => setShopProfile({ ...shopProfile, vatNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">VAT Percentage (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={shopProfile.vatPercentage}
                        onChange={(e) => setShopProfile({ ...shopProfile, vatPercentage: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Invoice Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Prefix</label>
                      <input
                        type="text"
                        value={shopProfile.invoicePrefix}
                        onChange={(e) => setShopProfile({ ...shopProfile, invoicePrefix: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">e.g., UK-INV-2025-</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Default Payment Terms</label>
                      <select
                        value={shopProfile.paymentTerms}
                        onChange={(e) => setShopProfile({ ...shopProfile, paymentTerms: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Net 30 days">Net 30 days</option>
                        <option value="Net 15 days">Net 15 days</option>
                        <option value="Net 7 days">Net 7 days</option>
                        <option value="Due on receipt">Due on receipt</option>
                        <option value="Cash on delivery">Cash on delivery</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            )}

            {/* Users & Roles Tab */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Staff Management</h3>
                  <button
                    onClick={() => setShowAddStaffForm(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    + Add Staff
                  </button>
                </div>

                {/* Add Staff Form */}
                {showAddStaffForm && (
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <h4 className="font-medium text-gray-900 mb-4">Add New Staff Member</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                        <input
                          type="text"
                          value={newStaffData.name}
                          onChange={(e) => setNewStaffData({ ...newStaffData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input
                          type="email"
                          value={newStaffData.email}
                          onChange={(e) => setNewStaffData({ ...newStaffData, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                      <select
                        value={newStaffData.role}
                        onChange={(e) => setNewStaffData({ ...newStaffData, role: e.target.value as 'admin' | 'staff' })}
                        className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-3">Permissions</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(newStaffData.permissions).map(([permission, checked]) => (
                          <label key={permission} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => setNewStaffData({
                                ...newStaffData,
                                permissions: { ...newStaffData.permissions, [permission]: e.target.checked }
                              })}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700 capitalize">
                              {permission.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={handleAddStaff}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                      >
                        {saving ? 'Adding...' : 'Add Staff'}
                      </button>
                      <button
                        onClick={() => setShowAddStaffForm(false)}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Staff List */}
                <div className="bg-white border rounded-lg overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b">
                    <h4 className="font-medium text-gray-900">Current Staff Members</h4>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {staffMembers.map((staff) => (
                      <div key={staff.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h5 className="font-medium text-gray-900">{staff.name}</h5>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                staff.role === 'admin' 
                                  ? 'bg-purple-100 text-purple-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {staff.role}
                              </span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                staff.isActive 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {staff.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{staff.email}</p>
                            {staff.lastLogin && (
                              <p className="text-xs text-gray-500 mt-1">
                                Last login: {new Date(staff.lastLogin).toLocaleDateString()}
                              </p>
                            )}
                            
                            <div className="mt-4">
                              <h6 className="text-sm font-medium text-gray-700 mb-2">Permissions</h6>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {Object.entries(staff.permissions).map(([permission, hasPermission]) => (
                                  <label key={permission} className="flex items-center">
                                    <input
                                      type="checkbox"
                                      checked={hasPermission}
                                      onChange={(e) => updateStaffPermissions(staff.id, permission as keyof StaffMember['permissions'], e.target.checked)}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <span className="ml-2 text-sm text-gray-600 capitalize">
                                      {permission.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => toggleStaffStatus(staff.id)}
                              className={`px-3 py-1 text-sm font-medium rounded-md ${
                                staff.isActive
                                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                  : 'bg-green-100 text-green-800 hover:bg-green-200'
                              }`}
                            >
                              {staff.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => removeStaff(staff.id)}
                              className="px-3 py-1 text-sm font-medium rounded-md bg-red-100 text-red-800 hover:bg-red-200"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Inventory Tab */}
            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Stock Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Low Stock Alert Threshold</label>
                      <input
                        type="number"
                        min="1"
                        value={stockSettings.lowStockThreshold}
                        onChange={(e) => setStockSettings({ ...stockSettings, lowStockThreshold: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Alert when stock falls below this number</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Default Unit</label>
                      <select
                        value={stockSettings.defaultUnit}
                        onChange={(e) => setStockSettings({ ...stockSettings, defaultUnit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="pcs">Pieces (pcs)</option>
                        <option value="kg">Kilograms (kg)</option>
                        <option value="g">Grams (g)</option>
                        <option value="L">Litres (L)</option>
                        <option value="ml">Millilitres (ml)</option>
                        <option value="boxes">Boxes</option>
                        <option value="cases">Cases</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">QR Code Scanning</h3>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={stockSettings.qrScanEnabled}
                      onChange={(e) => setStockSettings({ ...stockSettings, qrScanEnabled: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      Enable QR code scanning for stock updates
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    When enabled, staff can scan product QR codes to quickly update stock levels
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveStockSettings}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            )}

            {/* Reports & Exports Tab */}
            {activeTab === 'reports' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Sales Reports</h3>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={reportSettings.dailyReports}
                        onChange={(e) => setReportSettings({ ...reportSettings, dailyReports: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">Enable Daily Sales Reports</span>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={reportSettings.weeklyReports}
                        onChange={(e) => setReportSettings({ ...reportSettings, weeklyReports: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">Enable Weekly Sales Reports</span>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={reportSettings.monthlyReports}
                        onChange={(e) => setReportSettings({ ...reportSettings, monthlyReports: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">Enable Monthly Sales Reports</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Export Options</h3>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={reportSettings.csvExport}
                        onChange={(e) => setReportSettings({ ...reportSettings, csvExport: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">Enable CSV Export</span>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={reportSettings.pdfExport}
                        onChange={(e) => setReportSettings({ ...reportSettings, pdfExport: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">Enable PDF Export</span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Quick Actions</h4>
                  <div className="flex gap-3">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                      📊 Generate Today's Report
                    </button>
                    <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                      📄 Download This Week (CSV)
                    </button>
                    <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                      📋 Download This Month (PDF)
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveReports}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Email Alerts</h3>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={notificationSettings.emailAlerts}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, emailAlerts: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">Enable Email Alerts</span>
                    </div>
                    
                    {notificationSettings.emailAlerts && (
                      <div className="ml-7 space-y-3">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={notificationSettings.lowStockAlerts}
                            onChange={(e) => setNotificationSettings({ ...notificationSettings, lowStockAlerts: e.target.checked })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-3 text-sm text-gray-600">Low Stock Alerts</span>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={notificationSettings.salesAlerts}
                            onChange={(e) => setNotificationSettings({ ...notificationSettings, salesAlerts: e.target.checked })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-3 text-sm text-gray-600">New Sale Notifications</span>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={notificationSettings.endOfDayReports}
                            onChange={(e) => setNotificationSettings({ ...notificationSettings, endOfDayReports: e.target.checked })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-3 text-sm text-gray-600">End-of-Day Reports</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-amber-50 p-4 rounded-lg">
                  <h4 className="font-medium text-amber-900 mb-2">📧 Email Configuration</h4>
                  <p className="text-sm text-amber-800 mb-3">Configure SMTP settings to receive notifications</p>
                  <button className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                    ⚙️ Configure Email Settings
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveNotifications}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Branding</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Shop Logo</label>
                      <div className="flex items-center space-x-4">
                        <div className="h-20 w-20 bg-gray-200 rounded-lg flex items-center justify-center">
                          {shopProfile.logo ? (
                            <img src={shopProfile.logo} alt="Shop Logo" className="h-full w-full object-cover rounded-lg" />
                          ) : (
                            <span className="text-gray-400 text-xs">No Logo</span>
                          )}
                        </div>
                        <div>
                          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                            📤 Upload Logo
                          </button>
                          <p className="text-xs text-gray-500 mt-1">Recommended: 200x200px, PNG or JPG</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Theme</h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="theme"
                        value="light"
                        checked={shopProfile.theme === 'light'}
                        onChange={(e) => setShopProfile({ ...shopProfile, theme: e.target.value as 'light' | 'dark' })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-3 text-sm text-gray-700">🌞 Light Theme</span>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="theme"
                        value="dark"
                        checked={shopProfile.theme === 'dark'}
                        onChange={(e) => setShopProfile({ ...shopProfile, theme: e.target.value as 'light' | 'dark' })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-3 text-sm text-gray-700">🌙 Dark Theme</span>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-medium text-purple-900 mb-2">🎨 Preview</h4>
                  <p className="text-sm text-purple-800 mb-3">See how your settings will look</p>
                  <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                    👁️ Preview Changes
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Appearance'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
