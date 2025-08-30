'use client';

import React, { useState, useEffect } from 'react';
import { Package, ArrowRightLeft, Plus, History, AlertTriangle, TrendingUp } from 'lucide-react';

interface Product {
  _id: string;
  name: string;
  qrCode: string;
  stock: {
    godown: number;
    store: number;
    total: number;
    reserved: number;
  };
  lowStockThreshold: number;
  price: number;
  imageUrl?: string;
}

interface StockMovement {
  _id: string;
  movementType: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  previousStock: {
    godown: number;
    store: number;
    total: number;
  };
  newStock: {
    godown: number;
    store: number;
    total: number;
  };
  reason: string;
  createdAt: string;
  performedBy: {
    username: string;
    fullName: string;
  };
}

export default function StockManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockHistory, setStockHistory] = useState<StockMovement[]>([]);
  const [stockSummary, setStockSummary] = useState({
    totalProducts: 0,
    totalGodownStock: 0,
    totalStoreStock: 0,
    totalStock: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'movements'>('overview');

  // Movement form states
  const [movementQuantity, setMovementQuantity] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [movementNotes, setMovementNotes] = useState('');
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<'godown-to-store' | 'store-to-godown'>('godown-to-store');

  useEffect(() => {
    fetchProducts();
    fetchStockSummary();
  }, []);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/products', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Failed to fetch products');
    }
  };

  const fetchStockSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/stock/summary', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStockSummary(data.data);
      }
    } catch (error) {
      console.error('Error fetching stock summary:', error);
    }
  };

  const fetchStockHistory = async (productId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/stock/movement-history/${productId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStockHistory(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching stock history:', error);
    }
  };

  const handleStockMovement = async () => {
    if (!selectedProduct || !movementQuantity) {
      alert('Please select a product and enter quantity');
      return;
    }

    const quantity = parseInt(movementQuantity);
    if (quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    // Check stock availability
    if (movementType === 'godown-to-store' && selectedProduct.stock.godown < quantity) {
      alert(`Insufficient stock in godown. Available: ${selectedProduct.stock.godown}`);
      return;
    }

    if (movementType === 'store-to-godown' && selectedProduct.stock.store < quantity) {
      alert(`Insufficient stock in store. Available: ${selectedProduct.stock.store}`);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const endpoint = movementType === 'godown-to-store' ? '/api/stock/move-to-store' : '/api/stock/move-to-godown';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: selectedProduct._id,
          quantity,
          reason: movementReason,
          notes: movementNotes
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        
        // Refresh data
        fetchProducts();
        fetchStockSummary();
        if (selectedProduct) {
          fetchStockHistory(selectedProduct._id);
        }
        
        // Reset form
        setMovementQuantity('');
        setMovementReason('');
        setMovementNotes('');
        setIsMovementModalOpen(false);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to move stock');
      }
    } catch (error) {
      console.error('Error moving stock:', error);
      alert('Failed to move stock');
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (product: Product) => {
    if (product.stock.total === 0) return { status: 'Out of Stock', color: 'text-red-600 bg-red-50' };
    if (product.stock.total <= product.lowStockThreshold) return { status: 'Low Stock', color: 'text-yellow-600 bg-yellow-50' };
    return { status: 'In Stock', color: 'text-green-600 bg-green-50' };
  };

  const formatMovementType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Stock Management</h1>
            <p className="text-gray-600">Manage godown and store inventory</p>
          </div>
        </div>

        {/* Stock Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">{stockSummary.totalProducts}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Godown Stock</p>
                <p className="text-2xl font-bold text-gray-900">{stockSummary.totalGodownStock}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Store Stock</p>
                <p className="text-2xl font-bold text-gray-900">{stockSummary.totalStoreStock}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                <p className="text-2xl font-bold text-orange-600">{stockSummary.lowStockProducts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Product Overview
              </button>
              <button
                onClick={() => setActiveTab('movements')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'movements' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Stock Movements
              </button>
            </nav>
          </div>
          
          {/* Product Overview Tab */}
          {activeTab === 'overview' && (
            <div className="p-6">
              <div className="space-y-4">
                {products.map((product) => {
                  const stockStatus = getStockStatus(product);
                  return (
                    <div key={product._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-4">
                        {product.imageUrl && (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div>
                          <h3 className="font-semibold text-gray-900">{product.name}</h3>
                          <p className="text-sm text-gray-500">QR: {product.qrCode}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-700">
                            Godown: <span className="text-blue-600">{product.stock.godown}</span> | 
                            Store: <span className="text-green-600">{product.stock.store}</span>
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            Total: {product.stock.total}
                          </div>
                        </div>
                        
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${stockStatus.color}`}>
                          {stockStatus.status}
                        </span>
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              setIsMovementModalOpen(true);
                            }}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-1" />
                            Move Stock
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedProduct(product);
                              fetchStockHistory(product._id);
                              setActiveTab('movements');
                            }}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <History className="h-4 w-4 mr-1" />
                            History
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Stock Movements Tab */}
          {activeTab === 'movements' && (
            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">Stock Movement History</h3>
                <p className="text-sm text-gray-500">
                  {selectedProduct ? `Movement history for ${selectedProduct.name}` : 'Select a product to view movement history'}
                </p>
              </div>
              
              {stockHistory.length > 0 ? (
                <div className="space-y-4">
                  {stockHistory.map((movement) => (
                    <div key={movement._id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {formatMovementType(movement.movementType)}
                            </span>
                            <span className="text-sm text-gray-500">
                              {movement.fromLocation} → {movement.toLocation}
                            </span>
                          </div>
                          <p className="font-semibold mt-1 text-gray-900">
                            Quantity: {movement.quantity}
                          </p>
                          <p className="text-sm text-gray-600">
                            {movement.reason}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm text-gray-700">
                            <div>Before: G:{movement.previousStock.godown} S:{movement.previousStock.store} = {movement.previousStock.total}</div>
                            <div>After: G:{movement.newStock.godown} S:{movement.newStock.store} = {movement.newStock.total}</div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(movement.createdAt).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            by {movement.performedBy?.fullName || movement.performedBy?.username}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {selectedProduct ? 'No movement history found' : 'Select a product to view movement history'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stock Movement Modal */}
        {isMovementModalOpen && selectedProduct && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Move Stock: {selectedProduct.name}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Transfer stock between godown and store locations
                </p>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Current Godown Stock</label>
                      <div className="text-2xl font-bold text-blue-600">
                        {selectedProduct.stock.godown}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Current Store Stock</label>
                      <div className="text-2xl font-bold text-green-600">
                        {selectedProduct.stock.store}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Movement Direction</label>
                    <select
                      value={movementType}
                      onChange={(e) => setMovementType(e.target.value as 'godown-to-store' | 'store-to-godown')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="godown-to-store">Godown → Store</option>
                      <option value="store-to-godown">Store → Godown</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={movementQuantity}
                      onChange={(e) => setMovementQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter quantity to move"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                    <input
                      type="text"
                      value={movementReason}
                      onChange={(e) => setMovementReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Store replenishment"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                    <textarea
                      value={movementNotes}
                      onChange={(e) => setMovementNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Additional notes..."
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={handleStockMovement}
                      disabled={loading}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {loading ? 'Moving...' : 'Move Stock'}
                    </button>
                    <button
                      onClick={() => {
                        setIsMovementModalOpen(false);
                        setMovementQuantity('');
                        setMovementReason('');
                        setMovementNotes('');
                      }}
                      className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
