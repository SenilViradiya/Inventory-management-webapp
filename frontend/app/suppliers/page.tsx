'use client';

import { useState, useEffect } from 'react';
import { suppliersAPI } from '../lib/api';
import type { Supplier, SupplierFormData } from '../lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { PlusIcon, SearchIcon, MailIcon, PhoneIcon, MapPinIcon, BuildingIcon, EditIcon, TrashIcon } from 'lucide-react';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    },
    taxId: '',
    paymentTerms: ''
  });

  const itemsPerPage = 12;

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    filterSuppliers();
  }, [suppliers, searchTerm, statusFilter]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await suppliersAPI.getAll();
      setSuppliers(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  };

  const filterSuppliers = () => {
    let filtered = [...suppliers];

    if (searchTerm) {
      filtered = filtered.filter(supplier =>
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(supplier => 
        statusFilter === 'active' ? supplier.isActive : !supplier.isActive
      );
    }

    setFilteredSuppliers(filtered);
    setCurrentPage(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Supplier name is required');
      return;
    }

    try {
      if (editingSupplier) {
        await suppliersAPI.update(editingSupplier._id, formData);
        toast.success('Supplier updated successfully');
      } else {
        await suppliersAPI.create(formData);
        toast.success('Supplier created successfully');
      }
      
      resetForm();
      fetchSuppliers();
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast.error('Failed to save supplier');
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      },
      taxId: supplier.taxId || '',
      paymentTerms: supplier.paymentTerms || ''
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (supplierId: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) {
      return;
    }

    try {
      await suppliersAPI.delete(supplierId);
      toast.success('Supplier deleted successfully');
      fetchSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast.error('Failed to delete supplier');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      },
      taxId: '',
      paymentTerms: ''
    });
    setEditingSupplier(null);
    setShowCreateForm(false);
  };

  const paginatedSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);

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
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Suppliers</h1>
              <p className="text-gray-600">Manage your supplier relationships and contacts</p>
            </div>
            <Button onClick={() => setShowCreateForm(true)}>
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Supplier
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BuildingIcon className="w-6 h-6 text-blue-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Suppliers</p>
                  <p className="text-2xl font-bold text-gray-900">{suppliers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BuildingIcon className="w-6 h-6 text-green-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Active Suppliers</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {suppliers.filter(s => s.isActive).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BuildingIcon className="w-6 h-6 text-gray-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Inactive Suppliers</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {suppliers.filter(s => !s.isActive).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</CardTitle>
              <CardDescription>
                {editingSupplier ? 'Update supplier information' : 'Enter supplier details to add them to your system'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <Input
                    placeholder="Supplier Name *"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                  <Input
                    placeholder="Contact Person"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                  <Input
                    placeholder="Phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                  <Input
                    placeholder="Tax ID"
                    value={formData.taxId}
                    onChange={(e) => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
                  />
                  <Input
                    placeholder="Street Address"
                    value={formData.address.street}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      address: { ...prev.address, street: e.target.value }
                    }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">
                    {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
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
                  placeholder="Search suppliers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <Button variant="outline" onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
              }}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Suppliers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {paginatedSuppliers.map((supplier) => (
            <Card key={supplier._id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{supplier.name}</CardTitle>
                    {supplier.contactPerson && (
                      <p className="text-sm text-gray-600">{supplier.contactPerson}</p>
                    )}
                  </div>
                  <Badge variant={supplier.isActive ? 'default' : 'secondary'}>
                    {supplier.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {supplier.email && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MailIcon className="w-4 h-4 mr-2" />
                      {supplier.email}
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <PhoneIcon className="w-4 h-4 mr-2" />
                      {supplier.phone}
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPinIcon className="w-4 h-4 mr-2" />
                      {[supplier.address.street, supplier.address.city, supplier.address.state]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  )}
                  {supplier.taxId && (
                    <div className="text-sm text-gray-600">
                      <strong>Tax ID:</strong> {supplier.taxId}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 pt-2">
                    Added: {format(new Date(supplier.createdAt), 'MMM dd, yyyy')}
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(supplier)}>
                    <EditIcon className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(supplier._id)}>
                    <TrashIcon className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredSuppliers.length)} of {filteredSuppliers.length} suppliers
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

        {filteredSuppliers.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <BuildingIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No suppliers found</p>
                <Button className="mt-4" onClick={() => setShowCreateForm(true)}>
                  Add Your First Supplier
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
