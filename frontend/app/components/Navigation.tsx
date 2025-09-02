'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Package,
  ScanLine,
  AlertTriangle,
  BarChart3,
  FileText,
  Users,
  LogOut,
  User,
  ArrowRightLeft,
  Settings
} from 'lucide-react';

const Navigation = () => {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/scanner', icon: ScanLine, label: 'Scanner' },
    { href: '/products', icon: Package, label: 'Products' },
    { href: '/stock-management', icon: ArrowRightLeft, label: 'Stock Management' },
    { href: '/alerts', icon: AlertTriangle, label: 'Alerts' },
    { href: '/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/reports', icon: FileText, label: 'Reports' },
    ...(user?.role === 'admin' ? [
      { href: '/org', icon: Users, label: 'Organization' },
      { href: '/users', icon: Users, label: 'Users' }
    ] : []),
    { href: '/settings', icon: Settings, label: 'Categories' },
    { href: '/shop-settings', icon: Settings, label: 'Shop Settings' },
  ];

  return (
    <div className="bg-white shadow-sm border-b mb-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600 mr-2" />
            <h1 className="text-xl font-bold text-gray-900">Inventory System</h1>
          </div>

          {/* User Info and Logout */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-gray-500" />
              <div className="text-sm">
                <div className="font-medium text-gray-900">{user?.fullName}</div>
                <div className="text-gray-500 capitalize">{user?.role}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 overflow-x-auto pb-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = typeof window !== 'undefined' && window.location.pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${isActive
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Navigation;
