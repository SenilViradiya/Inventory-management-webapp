'use client';

import { QueryClient, QueryClientProvider } from 'react-query';
import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProductsProvider } from './contexts/ProductsContext';

// Conditional Products Provider - only load when authenticated
function ConditionalProductsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Only provide ProductsContext when user is authenticated
  if (isLoading) {
    return <>{children}</>;
  }
  
  if (isAuthenticated) {
    return <ProductsProvider>{children}</ProductsProvider>;
  }
  
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConditionalProductsProvider>
          {children}
        </ConditionalProductsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
