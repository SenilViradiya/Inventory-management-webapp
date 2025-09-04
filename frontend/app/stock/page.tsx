'use client';

import { useState, useEffect } from 'react';
import { stockAPI, productsAPI } from '../lib/api';
import type { StockMovement, Product } from '../lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { ArrowUpIcon, ArrowDownIcon, PackageIcon, AlertTriangleIcon, SearchIcon } from 'lucide-react';

export default function StockPage() {
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<StockMovement[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [adjustmentLocation, setAdjustmentLocation] = useState<'godown' | 'store'>('store');

  const itemsPerPage = 20;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterMovements();
  }, [stockMovements, searchTerm, typeFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [movementsRes, lowStockRes] = await Promise.all([
        stockAPI.getMovements({ page: 1, limit: 100 }),
        stockAPI.getLowStock()
      ]);

      setStockMovements(movementsRes.data?.data || []);
      setLowStockProducts(lowStockRes.data?.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  };

  const filterMovements = () => {
    let filtered = [...stockMovements];

    if (searchTerm) {
      filtered = filtered.filter(movement =>
        movement.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.reason?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter) {
      filtered = filtered.filter(movement => movement.type === typeFilter);
    }

    setFilteredMovements(filtered);
    setCurrentPage(1);
  };

  const handleStockAdjustment = async () => {
    if (!selectedProductId || adjustmentQuantity <= 0) {
      toast.error('Please select a product and enter a valid quantity');
      return;
    }

    try {
      await stockAPI.adjustStock(selectedProductId, {
        [adjustmentLocation]: adjustmentQuantity,
        reason: adjustmentReason || `Manual adjustment - ${adjustmentLocation}`
      });

      toast.success('Stock adjusted successfully');
      setShowAdjustForm(false);
      setSelectedProductId('');
      setAdjustmentQuantity(0);
      setAdjustmentReason('');
      fetchData();
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast.error('Failed to adjust stock');
    }
  };

  const paginatedMovements = filteredMovements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'OUT':
      case 'SALE':
      case 'DAMAGE':
        return <ArrowDownIcon className="w-4 h-4 text-red-500" />;
      case 'IN':
      case 'RETURN':
        return <ArrowUpIcon className="w-4 h-4 text-green-500" />;
      default:
        return <PackageIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getMovementBadge = (type: string) => {
    const colors: Record<string, string> = {
      'SALE': 'bg-red-100 text-red-800',
      'IN': 'bg-green-100 text-green-800',
      'OUT': 'bg-orange-100 text-orange-800',
      'MOVE': 'bg-blue-100 text-blue-800',
      'ADJUST': 'bg-purple-100 text-purple-800',
      'DAMAGE': 'bg-pink-100 text-pink-800',
      'RETURN': 'bg-emerald-100 text-emerald-800'
    };

    return (
      <Badge variant="secondary" className={colors[type] || 'bg-gray-100 text-gray-800'}>
        {type}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Stock Management</h1>
          <p className="text-gray-600">Monitor stock movements and manage inventory levels</p>
        </div>

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5 text-orange-500" />
                <CardTitle className="text-orange-800">Low Stock Alert</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {lowStockProducts.slice(0, 6).map((product) => (
                  <div key={product._id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">Category: {product.categoryName}</p>
                    </div>
                    <Badge variant="destructive">{product.quantity} left</Badge>
                  </div>
                ))}
              </div>
              {lowStockProducts.length > 6 && (
                <p className="text-sm text-orange-700 mt-3">
                  And {lowStockProducts.length - 6} more products with low stock
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-4 mb-6">
          <Button onClick={() => setShowAdjustForm(!showAdjustForm)}>
            <PackageIcon className="w-4 h-4 mr-2" />
            Adjust Stock
          </Button>
        </div>

        {/* Stock Adjustment Form */}
        {showAdjustForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Stock Adjustment</CardTitle>
              <CardDescription>Adjust stock levels for products</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <select
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="">Select Product</option>
                  {lowStockProducts.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name} (Current: {product.quantity})
                    </option>
                  ))}
                </select>

                <select
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={adjustmentLocation}
                  onChange={(e) => setAdjustmentLocation(e.target.value as 'godown' | 'store')}
                >
                  <option value="store">Store</option>
                  <option value="godown">Godown</option>
                </select>

                <Input
                  type="number"
                  placeholder="Quantity"
                  value={adjustmentQuantity || ''}
                  onChange={(e) => setAdjustmentQuantity(Number(e.target.value))}
                  min="1"
                />

                <Input
                  placeholder="Reason (optional)"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleStockAdjustment}>Apply Adjustment</Button>
                <Button variant="outline" onClick={() => setShowAdjustForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search movements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="SALE">Sale</option>
                <option value="IN">Stock In</option>
                <option value="OUT">Stock Out</option>
                <option value="MOVE">Transfer</option>
                <option value="ADJUST">Adjustment</option>
                <option value="DAMAGE">Damage</option>
                <option value="RETURN">Return</option>
              </select>

              <Button variant="outline" onClick={() => {
                setSearchTerm('');
                setTypeFilter('');
              }}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stock Movements */}
        <Card>
          <CardHeader>
            <CardTitle>Stock Movements</CardTitle>
            <CardDescription>Recent stock transactions and adjustments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {paginatedMovements.map((movement) => (
                <div key={movement._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    {getMovementIcon(movement.type)}
                    <div>
                      <p className="font-medium text-gray-900">
                        {movement.productName || 'Unknown Product'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Product ID: {movement.productId}
                      </p>
                      {movement.reason && (
                        <p className="text-sm text-gray-600 mt-1">{movement.reason}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`font-semibold ${
                        movement.type === 'OUT' || movement.type === 'SALE' || movement.type === 'DAMAGE'
                          ? 'text-red-600' 
                          : 'text-green-600'
                      }`}>
                        {movement.type === 'OUT' || movement.type === 'SALE' || movement.type === 'DAMAGE' ? '-' : '+'}
                        {movement.quantity}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(movement.createdAt), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                    {getMovementBadge(movement.type)}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-700">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredMovements.length)} of {filteredMovements.length} movements
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {filteredMovements.length === 0 && (
              <div className="text-center py-8">
                <PackageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No stock movements found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
