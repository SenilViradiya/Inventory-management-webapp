// Organization management placeholder page
'use client';

import Navigation from '../components/Navigation';

export default function OrganizationPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Navigation />
            <div className="max-w-3xl mx-auto py-10">
                <h1 className="text-3xl font-bold mb-4">Organization Management</h1>
                <p className="text-gray-600">This is the organization management page. Add your organization features here.</p>
            </div>
        </div>
    );
}