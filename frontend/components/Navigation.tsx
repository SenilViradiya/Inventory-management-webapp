'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '../app/lib/api';
import { toast } from 'react-hot-toast';
import { 
  HomeIcon,
  PackageIcon,
  BarChart3Icon,
  ShoppingCartIcon,
  TruckIcon,
  AlertTriangleIcon,
  UsersIcon,
  SettingsIcon,
  LogOutIcon,
  MenuIcon,
  XIcon,
  CodeIcon,
  UserIcon
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  fullName: string;
  role: {
    name: string;
  };
}

const Navigation = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

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

  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Products', href: '/products', icon: PackageIcon },
    { name: 'Stock', href: '/stock', icon: BarChart3Icon },
    { name: 'Orders', href: '/orders', icon: ShoppingCartIcon },
    { name: 'Suppliers', href: '/suppliers', icon: TruckIcon },
    { name: 'Analytics', href: '/analytics', icon: BarChart3Icon },
    { name: 'Alerts', href: '/alerts', icon: AlertTriangleIcon },
    { name: 'Users', href: '/users', icon: UsersIcon, adminOnly: true },
  ];

  const isActive = (href: string) => pathname === href;
  const isDeveloper = user?.role?.name && ['developer', 'admin', 'superadmin'].includes(user.role.name);

  // Don't show navigation on login page or if user is not logged in
  if (pathname === '/login' || !user) {
    return null;
  }

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      {/* Header with Logo and User Info */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600">
        {/* Logo */}
        <div className="flex items-center">
          <PackageIcon className="w-8 h-8 text-white" />
          <span className="ml-2 text-xl font-bold text-white">Inventory</span>
        </div>

        {/* User Info and Logout */}
        <div className="flex items-center gap-4 text-white">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="text-sm">
              <p className="font-medium">{user.fullName || user.username}</p>
              <p className="text-blue-200 text-xs capitalize">{user.role?.name}</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-blue-200 hover:text-white hover:bg-blue-700 transition-colors"
            title="Logout"
          >
            <LogOutIcon className="w-5 h-5" />
            <span className="hidden md:inline text-sm">Logout</span>
          </button>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="sm:hidden p-2 rounded-md text-blue-200 hover:text-white hover:bg-blue-700"
          >
            {isMobileMenuOpen ? (
              <XIcon className="w-6 h-6" />
            ) : (
              <MenuIcon className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="hidden sm:block">
        <nav className="flex space-x-8 px-4" aria-label="Tabs">
          {navigationItems.map((item) => {
            if (item.adminOnly && !['admin', 'superadmin'].includes(user?.role?.name || '')) {
              return null;
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`${
                  isActive(item.href)
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}

          {/* Developer Portal Tab */}
          {isDeveloper && (
            <Link
              href="/developer"
              className={`${
                isActive('/developer')
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
            >
              <CodeIcon className="w-4 h-4" />
              Developer Portal
            </Link>
          )}
        </nav>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="sm:hidden bg-white border-t border-gray-200 shadow-lg">
          <nav className="px-4 py-4 space-y-2">
            {navigationItems.map((item) => {
              if (item.adminOnly && !['admin', 'superadmin'].includes(user?.role?.name || '')) {
                return null;
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`${
                    isActive(item.href)
                      ? 'bg-blue-100 text-blue-900 border-l-4 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  } group flex items-center px-3 py-2 text-base font-medium rounded-md transition-colors`}
                >
                  <item.icon className="mr-3 flex-shrink-0 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}

            {/* Mobile Developer Portal */}
            {isDeveloper && (
              <Link
                href="/developer"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`${
                  isActive('/developer')
                    ? 'bg-purple-100 text-purple-900 border-l-4 border-purple-600'
                    : 'text-gray-600 hover:bg-purple-50 hover:text-purple-900'
                } group flex items-center px-3 py-2 text-base font-medium rounded-md transition-colors border-t border-gray-200 mt-4 pt-4`}
              >
                <CodeIcon className="mr-3 flex-shrink-0 h-5 w-5" />
                Developer Portal
              </Link>
            )}

            {/* Mobile user info and logout */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-700">{user.fullName || user.username}</p>
                    <p className="text-xs text-gray-500 capitalize">{user.role?.name}</p>
                  </div>
                </div>
                
                {/* Mobile Logout Button */}
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Logout"
                >
                  <LogOutIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
};

export default Navigation;
