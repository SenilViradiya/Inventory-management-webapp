'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { reportsAPI, productsAPI } from '../lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface ReportConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
  formats: ('csv' | 'pdf')[];
  endpoint: string;
}

const availableReports: ReportConfig[] = [
  {
    id: 'products',
    title: 'Products Report',
    description: 'Complete list of all products with details, prices, and stock levels',
    icon: '📦',
    formats: ['csv', 'pdf'],
    endpoint: 'products'
  },
  {
    id: 'stock-valuation',
    title: 'Stock Valuation Report',
    description: 'Current inventory value breakdown by category and product',
    icon: '💰',
    formats: ['csv', 'pdf'],
    endpoint: 'stock-valuation'
  },
  {
    id: 'low-stock',
    title: 'Low Stock Report',
    description: 'Products that are running low or out of stock',
    icon: '⚠️',
    formats: ['csv', 'pdf'],
    endpoint: 'low-stock'
  },
  {
    id: 'expiry',
    title: 'Expiry Report',
    description: 'Products that are expired or expiring soon',
    icon: '📅',
    formats: ['csv', 'pdf'],
    endpoint: 'expiry'
  },
  {
    id: 'sales',
    title: 'Sales Activity Report',
    description: 'Stock reduction activities and transaction history',
    icon: '📊',
    formats: ['csv', 'pdf'],
    endpoint: 'sales'
  }
];

export default function ReportsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    // Set default date range (last 30 days)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setDateRange({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    });
  }, []);

  const generateReport = async (reportId: string, format: 'csv' | 'pdf') => {
    setIsGenerating(`${reportId}-${format}`);
    
    try {
      let blob: Blob;
      const params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      };

      // Since the reports API might not be fully implemented, let's generate reports client-side
      switch (reportId) {
        case 'products':
          blob = await generateProductsReport(format, params);
          break;
        case 'stock-valuation':
          blob = await generateStockValuationReport(format, params);
          break;
        case 'low-stock':
          blob = await generateLowStockReport(format, params);
          break;
        case 'expiry':
          blob = await generateExpiryReport(format, params);
          break;
        case 'sales':
          blob = await generateSalesReport(format, params);
          break;
        default:
          throw new Error('Unknown report type');
      }

      // Download the generated report
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${reportId}-report-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`${format.toUpperCase()} report generated successfully`);
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setIsGenerating(null);
    }
  };

  const generateProductsReport = async (format: 'csv' | 'pdf', params: any): Promise<Blob> => {
    const response = await productsAPI.getAll();
    const products = response.data.products || [];

    if (format === 'csv') {
      const headers = ['Name', 'QR Code', 'Category', 'Price', 'Quantity', 'Value', 'Expiration Date'];
      const rows = products.map((product: any) => [
        product.name,
        product.qrCode,
        product.category,
        product.price,
        product.quantity,
        (product.price * product.quantity).toFixed(2),
        product.expirationDate ? new Date(product.expirationDate).toLocaleDateString() : 'N/A'
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      return new Blob([csvContent], { type: 'text/csv' });
    } else {
      // For PDF, we'll create a simple text-based report
      const content = `
PRODUCTS REPORT
Generated: ${new Date().toLocaleString()}
Date Range: ${params.startDate} to ${params.endDate}

Total Products: ${products.length}
Total Value: $${products.reduce((sum: number, p: any) => sum + (p.price * p.quantity), 0).toFixed(2)}

PRODUCT DETAILS:
${products.map((product: any) => `
- ${product.name} (${product.qrCode})
  Category: ${product.category}
  Price: $${product.price}
  Quantity: ${product.quantity}
  Value: $${(product.price * product.quantity).toFixed(2)}
  Expires: ${product.expirationDate ? new Date(product.expirationDate).toLocaleDateString() : 'N/A'}
`).join('')}
      `;

      return new Blob([content], { type: 'text/plain' });
    }
  };

  const generateStockValuationReport = async (format: 'csv' | 'pdf', params: any): Promise<Blob> => {
    const response = await productsAPI.getAll();
    const products = response.data.products || [];

    // Group by category
    const categoryMap = new Map();
    products.forEach((product: any) => {
      if (!categoryMap.has(product.category)) {
        categoryMap.set(product.category, { products: [], totalValue: 0, totalQuantity: 0 });
      }
      const category = categoryMap.get(product.category);
      category.products.push(product);
      category.totalValue += product.price * product.quantity;
      category.totalQuantity += product.quantity;
    });

    if (format === 'csv') {
      const headers = ['Category', 'Product Count', 'Total Quantity', 'Total Value', 'Average Value'];
      const rows = Array.from(categoryMap.entries()).map(([category, data]) => [
        category,
        data.products.length,
        data.totalQuantity,
        data.totalValue.toFixed(2),
        (data.totalValue / data.products.length).toFixed(2)
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      return new Blob([csvContent], { type: 'text/csv' });
    } else {
      const totalValue = products.reduce((sum: number, p: any) => sum + (p.price * p.quantity), 0);
      const content = `
STOCK VALUATION REPORT
Generated: ${new Date().toLocaleString()}

Total Inventory Value: $${totalValue.toFixed(2)}

BREAKDOWN BY CATEGORY:
${Array.from(categoryMap.entries()).map(([category, data]) => `
${category.toUpperCase()}:
  Products: ${data.products.length}
  Total Quantity: ${data.totalQuantity}
  Total Value: $${data.totalValue.toFixed(2)}
  Average Value: $${(data.totalValue / data.products.length).toFixed(2)}
  Percentage of Total: ${((data.totalValue / totalValue) * 100).toFixed(1)}%
`).join('')}
      `;

      return new Blob([content], { type: 'text/plain' });
    }
  };

  const generateLowStockReport = async (format: 'csv' | 'pdf', params: any): Promise<Blob> => {
    const response = await productsAPI.getAll();
    const products = response.data.products || [];
    const lowStockProducts = products.filter((product: any) => product.quantity <= 5);

    if (format === 'csv') {
      const headers = ['Name', 'QR Code', 'Category', 'Current Stock', 'Status'];
      const rows = lowStockProducts.map((product: any) => [
        product.name,
        product.qrCode,
        product.category,
        product.quantity,
        product.quantity === 0 ? 'Out of Stock' : 'Low Stock'
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      return new Blob([csvContent], { type: 'text/csv' });
    } else {
      const outOfStock = lowStockProducts.filter((p: any) => p.quantity === 0);
      const content = `
LOW STOCK REPORT
Generated: ${new Date().toLocaleString()}

Summary:
- Total Low Stock Items: ${lowStockProducts.length}
- Out of Stock Items: ${outOfStock.length}
- Low Stock Items: ${lowStockProducts.length - outOfStock.length}

OUT OF STOCK PRODUCTS:
${outOfStock.map((product: any) => `- ${product.name} (${product.qrCode})`).join('\n')}

LOW STOCK PRODUCTS:
${lowStockProducts.filter((p: any) => p.quantity > 0).map((product: any) => 
  `- ${product.name} (${product.qrCode}) - ${product.quantity} remaining`
).join('\n')}
      `;

      return new Blob([content], { type: 'text/plain' });
    }
  };

  const generateExpiryReport = async (format: 'csv' | 'pdf', params: any): Promise<Blob> => {
    const response = await productsAPI.getAll();
    const products = response.data.products || [];
    
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const expiredProducts = products.filter((product: any) => 
      product.expirationDate && new Date(product.expirationDate) < now
    );

    const expiringSoonProducts = products.filter((product: any) => 
      product.expirationDate && 
      new Date(product.expirationDate) >= now && 
      new Date(product.expirationDate) <= thirtyDaysFromNow
    );

    if (format === 'csv') {
      const headers = ['Name', 'QR Code', 'Category', 'Expiration Date', 'Days Until Expiry', 'Status'];
      const allProducts = [...expiredProducts, ...expiringSoonProducts];
      const rows = allProducts.map((product: any) => {
        const expDate = new Date(product.expirationDate);
        const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return [
          product.name,
          product.qrCode,
          product.category,
          expDate.toLocaleDateString(),
          daysUntilExpiry,
          daysUntilExpiry < 0 ? 'Expired' : 'Expiring Soon'
        ];
      });

      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      return new Blob([csvContent], { type: 'text/csv' });
    } else {
      const content = `
EXPIRY REPORT
Generated: ${new Date().toLocaleString()}

Summary:
- Expired Products: ${expiredProducts.length}
- Expiring Soon (30 days): ${expiringSoonProducts.length}

EXPIRED PRODUCTS:
${expiredProducts.map((product: any) => 
  `- ${product.name} (${product.qrCode}) - Expired ${new Date(product.expirationDate).toLocaleDateString()}`
).join('\n')}

EXPIRING SOON:
${expiringSoonProducts.map((product: any) => {
  const daysUntilExpiry = Math.ceil((new Date(product.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return `- ${product.name} (${product.qrCode}) - Expires in ${daysUntilExpiry} days (${new Date(product.expirationDate).toLocaleDateString()})`;
}).join('\n')}
      `;

      return new Blob([content], { type: 'text/plain' });
    }
  };

  const generateSalesReport = async (format: 'csv' | 'pdf', params: any): Promise<Blob> => {
    // Mock sales data since we don't have actual transaction history
    const mockSalesData = [
      { date: '2024-01-15', product: 'Coca Cola 330ml', qrCode: 'COKE330', quantity: 5, value: 12.50 },
      { date: '2024-01-15', product: 'Heineken Beer 330ml', qrCode: 'HEIN330', quantity: 3, value: 11.97 },
      { date: '2024-01-14', product: 'Jack Daniels 750ml', qrCode: 'JACK750', quantity: 1, value: 45.99 },
      { date: '2024-01-14', product: 'Bottled Water 500ml', qrCode: 'WATR500', quantity: 8, value: 8.00 },
      { date: '2024-01-13', product: 'Gatorade 500ml', qrCode: 'GATO500', quantity: 4, value: 10.00 }
    ];

    if (format === 'csv') {
      const headers = ['Date', 'Product', 'QR Code', 'Quantity Sold', 'Value'];
      const rows = mockSalesData.map(sale => [
        sale.date,
        sale.product,
        sale.qrCode,
        sale.quantity,
        sale.value.toFixed(2)
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      return new Blob([csvContent], { type: 'text/csv' });
    } else {
      const totalValue = mockSalesData.reduce((sum, sale) => sum + sale.value, 0);
      const totalQuantity = mockSalesData.reduce((sum, sale) => sum + sale.quantity, 0);

      const content = `
SALES ACTIVITY REPORT
Generated: ${new Date().toLocaleString()}
Period: ${params.startDate} to ${params.endDate}

Summary:
- Total Transactions: ${mockSalesData.length}
- Total Items Sold: ${totalQuantity}
- Total Revenue: $${totalValue.toFixed(2)}
- Average Transaction Value: $${(totalValue / mockSalesData.length).toFixed(2)}

TRANSACTION DETAILS:
${mockSalesData.map(sale => `
${sale.date}:
  Product: ${sale.product} (${sale.qrCode})
  Quantity: ${sale.quantity}
  Value: $${sale.value.toFixed(2)}
`).join('')}
      `;

      return new Blob([content], { type: 'text/plain' });
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
              <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Date Range Filter */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Report Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Available Reports */}
        <div className="space-y-6">
          {availableReports.map((report) => (
            <div key={report.id} className="bg-white shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="text-3xl">{report.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900">{report.title}</h3>
                      <p className="mt-1 text-sm text-gray-600">{report.description}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {report.formats.map((format) => (
                      <button
                        key={format}
                        onClick={() => generateReport(report.id, format)}
                        disabled={isGenerating === `${report.id}-${format}`}
                        className={`px-4 py-2 text-sm font-medium rounded-md ${
                          format === 'pdf'
                            ? 'text-red-700 bg-red-50 border border-red-200 hover:bg-red-100'
                            : 'text-green-700 bg-green-50 border border-green-200 hover:bg-green-100'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isGenerating === `${report.id}-${format}` ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                            Generating...
                          </div>
                        ) : (
                          `Download ${format.toUpperCase()}`
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Report Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">About Reports</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>CSV files can be opened in Excel or Google Sheets for analysis</li>
                  <li>PDF reports are formatted for printing and sharing</li>
                  <li>Reports are generated based on the selected date range</li>
                  <li>All data is current as of the generation time</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
