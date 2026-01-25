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
    name?: string
}

interface MissingProduct {
    sku: string
    product_name?: string
    supplier: string
}

// ... existing code ...



// ... (existing code) ...



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

export default function DuplicatesPage() {
    const [duplicateSkus, setDuplicateSkus] = useState<Duplicate[]>([])
    const [duplicateNames, setDuplicateNames] = useState<Duplicate[]>([])
    const [potentialDuplicates, setPotentialDuplicates] = useState<PotentialDuplicate[]>([])
    const [orphaned, setOrphaned] = useState<OrphanedProduct[]>([])
    const [missing, setMissing] = useState<MissingProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [statusMessage, setStatusMessage] = useState("Processing...")
    const [activeTab, setActiveTab] = useState<'skus' | 'names' | 'potential' | 'orphaned' | 'missing'>('skus')

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setStatusMessage("Fetching data...")
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

    const callMergeApi = async (sourceIds: number[], targetId?: number, determineTarget: boolean = false) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

        const res = await fetch(`${apiUrl}/api/products/merge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_product_ids: sourceIds,
                target_product_id: targetId,
                determine_target: determineTarget
            })
        });

        return await res.json();
    }

    const executeMerge = async (sourceIds: number[], targetId?: number, determineTarget: boolean = false) => {
        if (!confirm(`Are you sure you want to merge these products? IDs: ${sourceIds.join(', ')}\n${targetId ? `Target: ${targetId}` : 'Target: Auto-detect'}`)) {
            return;
        }

        try {
            setLoading(true);
            setStatusMessage("Merging...");

            const data = await callMergeApi(sourceIds, targetId, determineTarget);

            if (data.success) {
                alert(`Success! Merged into Product ID ${data.target_id}.\nDeleted IDs: ${data.deleted_ids.join(', ')}`);
                fetchData();
            } else {
                alert(`Merge Failed: ${data.detail || 'Unknown error'}`);
            }

        } catch (err) {
            console.error(err);
            alert("Error merging products.");
        } finally {
            setLoading(false);
        }
    }

    const handleMerge = async (duplicate: Duplicate) => {
        if (!duplicate.product_ids) return;

        // Parse IDs (string "1,2,3" -> [1,2,3])
        const ids = duplicate.product_ids.toString().split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

        if (ids.length < 2) {
            alert("Need at least 2 products to merge.");
            return;
        }

        // Call generic merge with determine_target = true
        await executeMerge(ids, undefined, true);
    }

    const handleMergeAll = async () => {
        let itemsToProcess: Array<{ sourceIds: number[], targetId?: number, determineTarget: boolean }> = [];

        // 1. Identify items based on active tab
        if (activeTab === 'skus') {
            duplicateSkus.forEach(dup => {
                const ids = dup.product_ids.toString().split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                if (ids.length >= 2) {
                    itemsToProcess.push({ sourceIds: ids, determineTarget: true });
                }
            });
        } else if (activeTab === 'potential') {
            potentialDuplicates.forEach(dup => {
                itemsToProcess.push({
                    sourceIds: [dup.unaligned.product_id],
                    targetId: dup.aligned.product_id,
                    determineTarget: false
                });
            });
        } else {
            alert("Merge All is only available for Duplicate SKUs and Potential Duplicates tabs.");
            return;
        }

        if (itemsToProcess.length === 0) {
            alert("No items to merge!");
            return;
        }

        // 2. Confirm
        if (!confirm(`⚠️  WARNING: BATCH MERGE\n\nThis will automatically merge ${itemsToProcess.length} groups of products.\n\nAre you sure you want to proceed?`)) {
            return;
        }

        // 3. Process sequentially
        setLoading(true);
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < itemsToProcess.length; i++) {
            const item = itemsToProcess[i];
            setStatusMessage(`Merging group ${i + 1} of ${itemsToProcess.length}...`);

            try {
                const res = await callMergeApi(item.sourceIds, item.targetId, item.determineTarget);
                if (res.success) {
                    successCount++;
                } else {
                    failCount++;
                    console.error(`Failed to merge group ${i}:`, res);
                }
            } catch (error) {
                failCount++;
                console.error(`Error merging group ${i}:`, error);
            }
        }

        // 4. Finish
        alert(`Batch Merge Complete!\n\nSuccessful: ${successCount}\nFailed: ${failCount}`);
        setStatusMessage("Refreshing data...");
        fetchData();
    }

    const handleViewDetails = (duplicate: Duplicate) => {
        alert(`Duplicate Details:\n\nSKU: ${duplicate.sku}\nProduct IDs: ${duplicate.product_ids}\nNames: ${duplicate.names || 'N/A'}`);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-500">{statusMessage}</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-white">Product Quality Dashboard</h1>
                    <p className="text-gray-400 mt-2">Identify and fix duplicate products, orphaned items, and data quality issues</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <SummaryCard
                    label="Duplicate SKUs"
                    count={duplicateSkus.length}
                    severity="critical"
                    desc="Critical SEO issue"
                />
                <SummaryCard
                    label="Duplicate Names"
                    count={duplicateNames.length}
                    severity="warning"
                    desc="Needs review"
                />
                <SummaryCard
                    label="Potential Duplicates"
                    count={potentialDuplicates.length}
                    severity="info"
                    desc="Unaligned vs Aligned"
                />
                <SummaryCard
                    label="Orphaned Products"
                    count={orphaned.length}
                    severity="error"
                    desc="Not in any feed"
                />
                <SummaryCard
                    label="Missing Products"
                    count={missing.length}
                    severity="neutral"
                    desc="In feeds, not in store"
                />
            </div>

            {/* Tabs & Content */}
            <div className="bg-[#1c1c1c] rounded-2xl border border-white/5 overflow-hidden">
                <div className="border-b border-white/5 flex justify-between items-center pr-6">
                    <nav className="flex space-x-6 px-6" aria-label="Tabs">
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
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                    ? 'border-lime-400 text-lime-400'
                                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
                                    }`}
                            >
                                {tab.label} <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-gray-300">{tab.count}</span>
                            </button>
                        ))}
                    </nav>

                    {/* Batch Action Button */}
                    {(activeTab === 'skus' && duplicateSkus.length > 0) || (activeTab === 'potential' && potentialDuplicates.length > 0) ? (
                        <button
                            onClick={handleMergeAll}
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm flex items-center"
                        >
                            <span className="mr-2">⚡</span> Merge All ({activeTab === 'skus' ? duplicateSkus.length : potentialDuplicates.length})
                        </button>
                    ) : null}
                </div>

                <div className="p-6">
                    {/* Duplicate SKUs Tab */}
                    {activeTab === 'skus' && (
                        <div className="space-y-4">
                            {duplicateSkus.length === 0 ? (
                                <EmptyState message="✅ No duplicate SKUs found! Your product catalog is clean." />
                            ) : (
                                duplicateSkus.map((dup, idx) => (
                                    <div key={idx} className="border border-red-500/20 rounded-xl p-4 bg-red-500/5">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-mono text-sm font-semibold text-red-400">SKU: {dup.sku}</span>
                                            <span className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-xs border border-red-500/20">
                                                {dup.count} duplicates
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-400">
                                            <strong className="text-gray-300">Product IDs:</strong> {dup.product_ids}
                                        </div>
                                        {dup.names && (
                                            <div className="text-sm text-gray-400 mt-1">
                                                <strong className="text-gray-300">Names:</strong> {dup.names}
                                            </div>
                                        )}
                                        <div className="mt-4 flex space-x-3">
                                            <button
                                                onClick={() => handleMerge(dup)}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Merge Products
                                            </button>
                                            <button
                                                onClick={() => handleViewDetails(dup)}
                                                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                                            >
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
                                <EmptyState message="✅ No duplicate product names found!" />
                            ) : (
                                duplicateNames.slice(0, 20).map((dup, idx) => (
                                    <div key={idx} className="border border-yellow-500/20 rounded-xl p-4 bg-yellow-500/5">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-yellow-400">{dup.name}</span>
                                            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-xs border border-yellow-500/20">
                                                {dup.count} duplicates
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-400">
                                            <strong className="text-gray-300">Product IDs:</strong> {dup.product_ids}
                                        </div>
                                        {dup.skus && (
                                            <div className="text-sm text-gray-400 mt-1">
                                                <strong className="text-gray-300">SKUs:</strong> {dup.skus}
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
                                <EmptyState message="✅ No fuzzy duplicates found!" />
                            ) : (
                                <div className="space-y-6">
                                    <p className="text-sm text-purple-300 bg-purple-500/10 p-4 rounded-xl border border-purple-500/20">
                                        <strong>What is this?</strong> These are products in OpenCart that are
                                        NOT correctly aligned to Supabase, but share a Model Number or SKU with
                                        an aligned product. The "Unaligned" version is likely a duplicate.
                                    </p>

                                    {potentialDuplicates.map((dup, idx) => (
                                        <div key={idx} className="border border-purple-500/20 rounded-xl overflow-hidden bg-[#1c1c1c]">
                                            <div className="bg-purple-500/10 px-4 py-2 border-b border-purple-500/20 flex justify-between items-center">
                                                <span className="text-xs font-semibold uppercase text-purple-400 tracking-wider">
                                                    {dup.reason}
                                                </span>
                                            </div>
                                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Bad / Unaligned */}
                                                <div className="bg-red-500/5 p-4 rounded-xl border border-red-500/10 hover:border-red-500/30 transition-colors">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-bold text-red-400 uppercase">Duplicate (Unaligned)</span>
                                                        <span className="text-xs text-gray-500">ID: {dup.unaligned.product_id}</span>
                                                    </div>
                                                    <div className="font-semibold text-gray-200 text-sm mb-1">{dup.unaligned.name}</div>
                                                    <div className="text-xs text-gray-500 font-mono">
                                                        Model: {dup.unaligned.model || '-'} | SKU: {dup.unaligned.sku || '-'}
                                                    </div>
                                                    <button
                                                        className="mt-4 w-full py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-bold rounded-lg transition border border-red-500/20"
                                                        onClick={() => executeMerge([dup.unaligned.product_id], dup.aligned.product_id)}
                                                    >
                                                        Delete Duplicate (Merge into Aligned)
                                                    </button>
                                                </div>

                                                {/* Good / Aligned */}
                                                <div className="bg-green-500/5 p-4 rounded-xl border border-green-500/10 hover:border-green-500/30 transition-colors">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-bold text-green-400 uppercase">Correct (Aligned)</span>
                                                        <span className="text-xs text-gray-500">ID: {dup.aligned.product_id}</span>
                                                    </div>
                                                    <div className="font-semibold text-gray-200 text-sm mb-1">{dup.aligned.name}</div>
                                                    <div className="text-xs text-gray-500 font-mono">
                                                        Model: {dup.aligned.model || '-'} | SKU: {dup.aligned.sku || '-'}
                                                    </div>
                                                    <div className="mt-4 flex justify-center">
                                                        <span className="text-xs text-green-500 py-2 flex items-center">
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
                                <EmptyState message="✅ No orphaned products found!" />
                            ) : (
                                <div>
                                    <p className="text-sm text-gray-400 mb-4">
                                        These products exist in OpenCart but not in any supplier feed. They may be discontinued or manually added.
                                    </p>
                                    {orphaned.slice(0, 100).map((product, idx) => (
                                        <div key={idx} className="border border-white/5 rounded-xl p-4 mb-2 hover:bg-white/5 bg-[#1c1c1c] transition-colors">
                                            <div className="text-sm">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-semibold text-gray-200 line-clamp-1 mr-2">{product.name || 'Unknown Name'}</span>
                                                    <span className="text-xs text-gray-500 whitespace-nowrap">ID: {product.product_id}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 font-mono">
                                                    SKU: <span className="bg-white/10 text-gray-300 px-1.5 py-0.5 rounded">{product.sku}</span>
                                                </div>
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
                                <EmptyState message="✅ All supplier products are in OpenCart!" />
                            ) : (
                                <div>
                                    <p className="text-sm text-gray-400 mb-4">
                                        These products exist in supplier feeds but haven't been pushed to OpenCart yet.
                                    </p>
                                    {missing.slice(0, 100).map((product, idx) => (
                                        <div key={idx} className="border border-white/5 rounded-xl p-4 mb-2 hover:bg-white/5 bg-[#1c1c1c] transition-colors">
                                            <div className="text-sm">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-semibold text-gray-200 line-clamp-1 mr-2">{product.product_name || 'Unknown Name'}</span>
                                                    <span className="text-xs text-gray-500 whitespace-nowrap">{product.supplier}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 font-mono">
                                                    SKU: <span className="bg-white/10 text-gray-300 px-1.5 py-0.5 rounded">{product.sku}</span>
                                                </div>
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
    )
}

function SummaryCard({ label, count, severity, desc }: { label: string, count: number, severity: 'critical' | 'warning' | 'info' | 'error' | 'neutral', desc: string }) {
    const colors = {
        critical: 'border-red-500/20 text-red-500',
        warning: 'border-yellow-500/20 text-yellow-500',
        info: 'border-purple-500/20 text-purple-500',
        error: 'border-orange-500/20 text-orange-500',
        neutral: 'border-blue-500/20 text-blue-500'
    }

    const countColors = {
        critical: 'text-red-400',
        warning: 'text-yellow-400',
        info: 'text-purple-400',
        error: 'text-orange-400',
        neutral: 'text-blue-400'
    }

    return (
        <div className={`bg-[#1c1c1c] rounded-xl border p-6 ${colors[severity]}`}>
            <div className="text-sm text-gray-400">{label}</div>
            <div className={`text-3xl font-bold mt-2 ${countColors[severity]}`}>{count}</div>
            <div className="text-xs text-gray-600 mt-1">{desc}</div>
        </div>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="text-center py-12 text-gray-500 bg-white/5 rounded-xl border border-white/5 border-dashed">
            {message}
        </div>
    )
}
