'use client';

import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import StockManagement from '../components/StockManagement';

export default function StockManagementPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <StockManagement />
    </div>
  );
}
