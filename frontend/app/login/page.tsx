'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);
  const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  // Better redirect logic with loading check
  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasRedirected) {
      setHasRedirected(true);
      // Redirect developer or superadmin to /developer page
      if (user && (user.username === 'developer' || user.role === 'superadmin')) {
        router.replace('/developer');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [isAuthenticated, authLoading, router, hasRedirected, user]);

  // Show loading while auth is being checked
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render login form if already authenticated
  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await login(email, password);
    } catch (error) {
      // Error is handled by the auth context
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoCredentials = (role: 'admin' | 'staff' | 'developer') => {
    if (role === 'admin') {
      setEmail('admin@offlicense.com');
      setPassword('admin123');
    } else if (role === 'developer') {
      setEmail('developer@admin.com');
      setPassword('Dev@123456');
    } else {
      setEmail('staff1@offlicense.com');
      setPassword('staff123');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-600">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Inventory Management
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">Demo Credentials</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillDemoCredentials('admin')}
                className="w-full inline-flex justify-center py-2 px-3 border border-gray-300 rounded-md shadow-sm bg-white text-xs font-medium text-gray-500 hover:bg-gray-50"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => fillDemoCredentials('staff')}
                className="w-full inline-flex justify-center py-2 px-3 border border-gray-300 rounded-md shadow-sm bg-white text-xs font-medium text-gray-500 hover:bg-gray-50"
              >
                Staff
              </button>
              <button
                type="button"
                onClick={() => fillDemoCredentials('developer')}
                className="w-full inline-flex justify-center py-2 px-3 border border-blue-300 rounded-md shadow-sm bg-blue-50 text-xs font-medium text-blue-600 hover:bg-blue-100"
              >
                Developer
              </button>
            </div>
          </div>
        </form>
        
        <div className="text-center">
          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>Admin:</strong> admin@offlicense.com / admin123</p>
            <p><strong>Staff:</strong> staff1@offlicense.com / staff123</p>
            <p><strong>Developer:</strong> developer@admin.com / Dev@123456</p>
          </div>
        </div>
      </div>
    </div>
  );
}
