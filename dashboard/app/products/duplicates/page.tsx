'use client'

import { useState, useEffect } from 'react'

interface Duplicate {
    sku?: string
    name?: string
    count: number
    product_ids: string
    names?: string
    skus?: string
}
        orphanedRes.json(),
        missingRes.json()
    ])

    setDuplicateSkus(skusData.duplicates || [])
    setDuplicateNames(namesData.duplicates || [])
    setOrphaned(orphanedData.orphaned || [])
    setMissing(missingData.missing || [])
} catch (error) {
    console.error('Failed to fetch data:', error)
} finally {
    setLoading(false)
}
    }

if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-gray-500">Loading duplicate analysis...</div>
        </div>
    )
}

return (
    <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Product Quality Dashboard</h1>
                <p className="text-gray-600 mt-2">Identify and fix duplicate products, orphaned items, and data quality issues</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="text-sm text-gray-600">Duplicate SKUs</div>
                    <div className="text-3xl font-bold text-red-600 mt-2">{duplicateSkus.length}</div>
                    <div className="text-xs text-gray-500 mt-1">Critical SEO issue</div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="text-sm text-gray-600">Duplicate Names</div>
                    <div className="text-3xl font-bold text-yellow-600 mt-2">{duplicateNames.length}</div>
                    <div className="text-xs text-gray-500 mt-1">Needs review</div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="text-sm text-gray-600">Orphaned Products</div>
                    <div className="text-3xl font-bold text-orange-600 mt-2">{orphaned.length}</div>
                    <div className="text-xs text-gray-500 mt-1">Not in any feed</div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="text-sm text-gray-600">Missing Products</div>
                    <div className="text-3xl font-bold text-blue-600 mt-2">{missing.length}</div>
                    <div className="text-xs text-gray-500 mt-1">In feeds, not in store</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6" aria-label="Tabs">
                        {[
                            { id: 'skus', label: 'Duplicate SKUs', count: duplicateSkus.length },
                            { id: 'names', label: 'Duplicate Names', count: duplicateNames.length },
                            { id: 'orphaned', label: 'Orphaned', count: orphaned.length },
                            { id: 'missing', label: 'Missing', count: missing.length }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {tab.label} ({tab.count})
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {/* Duplicate SKUs Tab */}
                    {activeTab === 'skus' && (
                        <div className="space-y-4">
                            {duplicateSkus.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    ✅ No duplicate SKUs found! Your product catalog is clean.
                                </div>
                            ) : (
                                duplicateSkus.map((dup, idx) => (
                                    <div key={idx} className="border border-red-200 rounded-lg p-4 bg-red-50">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-mono text-sm font-semibold text-red-900">SKU: {dup.sku}</span>
                                            <span className="px-3 py-1 bg-red-600 text-white rounded-full text-xs">
                                                {dup.count} duplicates
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-700">
                                            <strong>Product IDs:</strong> {dup.product_ids}
                                        </div>
                                        {dup.names && (
                                            <div className="text-sm text-gray-700 mt-1">
                                                <strong>Names:</strong> {dup.names}
                                            </div>
                                        )}
                                        <div className="mt-3 flex space-x-2">
                                            <button className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                                                Merge Products
                                            </button>
                                            <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300">
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Duplicate Names Tab */}
                    {activeTab === 'names' && (
                        <div className="space-y-4">
                            {duplicateNames.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    ✅ No duplicate product names found!
                                </div>
                            ) : (
                                duplicateNames.slice(0, 20).map((dup, idx) => (
                                    <div key={idx} className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-yellow-900">{dup.name}</span>
                                            <span className="px-3 py-1 bg-yellow-600 text-white rounded-full text-xs">
                                                {dup.count} duplicates
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-700">
                                            <strong>Product IDs:</strong> {dup.product_ids}
                                        </div>
                                        {dup.skus && (
                                            <div className="text-sm text-gray-700 mt-1">
                                                <strong>SKUs:</strong> {dup.skus}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Orphaned Products Tab */}
                    {activeTab === 'orphaned' && (
                        <div className="space-y-4">
                            {orphaned.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    ✅ No orphaned products found!
                                </div>
                            ) : (
                                <div>
                                    <p className="text-sm text-gray-600 mb-4">
                                        These products exist in OpenCart but not in any supplier feed. They may be discontinued or manually added.
                                    </p>
                                    {orphaned.slice(0, 50).map((product, idx) => (
                                        <div key={idx} className="border border-gray-200 rounded-lg p-3 mb-2">
                                            <div className="text-sm">
                                                <strong>SKU:</strong> {product.sku} | <strong>ID:</strong> {product.product_id}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Missing Products Tab */}
                    {activeTab === 'missing' && (
                        <div className="space-y-4">
                            {missing.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    ✅ All supplier products are in OpenCart!
                                </div>
                            ) : (
                                <div>
                                    <p className="text-sm text-gray-600 mb-4">
                                        These products exist in supplier feeds but haven't been pushed to OpenCart yet.
                                    </p>
                                    {missing.slice(0, 50).map((product, idx) => (
                                        <div key={idx} className="border border-gray-200 rounded-lg p-3 mb-2">
                                            <div className="text-sm">
                                                <strong>SKU:</strong> {product.sku} | <strong>Name:</strong> {product.product_name}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Cost: R{product.cost_price?.toFixed(2) || 'N/A'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
)
}
