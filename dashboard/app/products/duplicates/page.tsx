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

interface OrphanedProduct {
    product_id: number
    sku: string
}

interface MissingProduct {
    sku: string
    supplier: string
}

export default function DuplicatesPage() {
    const [duplicateSkus, setDuplicateSkus] = useState<Duplicate[]>([])
    const [duplicateNames, setDuplicateNames] = useState<Duplicate[]>([])
    const [potentialDuplicates, setPotentialDuplicates] = useState<PotentialDuplicate[]>([])
    const [orphaned, setOrphaned] = useState<OrphanedProduct[]>([])
    const [missing, setMissing] = useState<MissingProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'skus' | 'names' | 'potential' | 'orphaned' | 'missing'>('skus')

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

            const [skusRes, namesRes, potentialRes, orphanedRes, missingRes] = await Promise.all([
                fetch(`${apiUrl}/api/products/duplicates/skus`),
                fetch(`${apiUrl}/api/products/duplicates/names`),
                fetch(`${apiUrl}/api/products/duplicates/potential`),
                fetch(`${apiUrl}/api/products/orphaned`),
                fetch(`${apiUrl}/api/products/missing`)
            ])

            const [skusData, namesData, potentialData, orphanedData, missingData] = await Promise.all([
                skusRes.json(),
                namesRes.json(),
                potentialRes.json(),
                orphanedRes.json(),
                missingRes.json()
            ])

            setDuplicateSkus(skusData.duplicates || [])
            setDuplicateNames(namesData.duplicates || [])
            setPotentialDuplicates(potentialData.duplicates || [])
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

}

// Define type for potential duplicates
interface PotentialDuplicate {
    unaligned: {
        product_id: number
        sku: string
        model: string
        name: string
    }
    aligned: {
        product_id: number
        sku: string
        model: string
        name: string
    }
    reason: string
}

return (
    <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Product Quality Dashboard</h1>
                <p className="text-gray-600 mt-2">Identify and fix duplicate products, orphaned items, and data quality issues</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
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

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 border-l-4 border-l-purple-500">
                    <div className="text-sm text-gray-600">Potential Duplicates</div>
                    <div className="text-3xl font-bold text-purple-600 mt-2">{potentialDuplicates.length}</div>
                    <div className="text-xs text-gray-500 mt-1">Unaligned vs Aligned</div>
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
                            { id: 'potential', label: 'Potential (Fuzzy)', count: potentialDuplicates.length },
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

                    {/* Potential / Fuzzy Duplicates Tab */}
                    {activeTab === 'potential' && (
                        <div className="space-y-4">
                            {potentialDuplicates.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    ✅ No fuzzy duplicates found!
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <p className="text-sm text-gray-600 bg-purple-50 p-4 rounded border border-purple-100">
                                        <strong>What is this?</strong> These are products in OpenCart that are
                                        NOT correctly aligned to Supabase, but share a Model Number or SKU with
                                        an aligned product. The "Unaligned" version is likely a duplicate that
                                        should be deleted.
                                    </p>

                                    {potentialDuplicates.map((dup, idx) => (
                                        <div key={idx} className="border border-purple-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                            <div className="bg-purple-50 px-4 py-2 border-b border-purple-100 flex justify-between items-center">
                                                <span className="text-xs font-semibold uppercase text-purple-700 tracking-wider">
                                                    {dup.reason}
                                                </span>
                                            </div>
                                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Bad / Unaligned */}
                                                <div className="bg-red-50 p-3 rounded border border-red-100">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-bold text-red-600 uppercase">Duplicate (Unaligned)</span>
                                                        <span className="text-xs text-gray-500">ID: {dup.unaligned.product_id}</span>
                                                    </div>
                                                    <div className="font-semibold text-gray-900 text-sm mb-1">{dup.unaligned.name}</div>
                                                    <div className="text-xs text-gray-600 font-mono">
                                                        Model: {dup.unaligned.model || '-'} | SKU: {dup.unaligned.sku || '-'}
                                                    </div>
                                                    <button
                                                        className="mt-3 w-full py-1.5 bg-red-100 text-red-700 hover:bg-red-200 text-xs font-semibold rounded transition"
                                                        onClick={async () => {
                                                            if (!confirm(`Are you sure you want to delete Unaligned product ${dup.unaligned.product_id}? This cannot be undone.`)) return;
                                                            // Future implementation: Backend delete endpoint
                                                            alert(`Please implement delete for ID: ${dup.unaligned.product_id}`)
                                                        }}
                                                    >
                                                        Delete Duplicate
                                                    </button>
                                                </div>

                                                {/* Good / Aligned */}
                                                <div className="bg-green-50 p-3 rounded border border-green-100">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-bold text-green-600 uppercase">Correct (Aligned)</span>
                                                        <span className="text-xs text-gray-500">ID: {dup.aligned.product_id}</span>
                                                    </div>
                                                    <div className="font-semibold text-gray-900 text-sm mb-1">{dup.aligned.name}</div>
                                                    <div className="text-xs text-gray-600 font-mono">
                                                        Model: {dup.aligned.model || '-'} | SKU: {dup.aligned.sku || '-'}
                                                    </div>
                                                    <div className="mt-3 flex justify-center">
                                                        <span className="text-xs text-green-700 py-1.5 flex items-center">
                                                            <span className="mr-1">✓</span> Syspro Linked
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
                                                <strong>SKU:</strong> {product.sku} | <strong>Supplier:</strong> {product.supplier}
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
