'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface PriceChange {
    id: string
    product_id: number
    sku: string
    product_name: string
    current_price: number
    new_price: number
    price_change_pct: number
    supplier_name: string
    status: 'pending' | 'approved' | 'rejected'
    created_at: string
}

export default function PendingChangesPage() {
    const [changes, setChanges] = useState<PriceChange[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [processing, setProcessing] = useState(false)

    useEffect(() => {
        fetchPendingChanges()
    }, [])

    const fetchPendingChanges = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('price_change_queue')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })

        setChanges(data || [])
        setLoading(false)
    }

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelectedIds(newSelected)
    }

    const selectAll = () => {
        if (selectedIds.size === changes.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(changes.map(c => c.id)))
        }
    }

    const approveChanges = async (ids: string[]) => {
        setProcessing(true)

        try {
            // Update status in database
            await supabase
                .from('price_change_queue')
                .update({
                    status: 'approved',
                    reviewed_by: 'dashboard_user', // TODO: Get actual user
                    reviewed_at: new Date().toISOString()
                })
                .in('id', ids)

            // Apply changes to OpenCart via API
            const response = await fetch('/api/stock/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ change_ids: ids })
            })

            if (response.ok) {
                await fetchPendingChanges()
                setSelectedIds(new Set())
            }
        } catch (error) {
            console.error('Failed to approve changes:', error)
        }

        setProcessing(false)
    }

    const rejectChanges = async (ids: string[]) => {
        setProcessing(true)

        await supabase
            .from('price_change_queue')
            .update({
                status: 'rejected',
                reviewed_by: 'dashboard_user',
                reviewed_at: new Date().toISOString()
            })
            .in('id', ids)

        await fetchPendingChanges()
        setSelectedIds(new Set())
        setProcessing(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-500">Loading pending changes...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Pending Price Changes</h1>
                    <p className="text-gray-600 mt-2">Review and approve price changes exceeding 10% threshold</p>
                </div>

                {changes.length > 0 && (
                    <div className="mb-4 flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={selectAll}
                                className="text-sm text-blue-600 hover:text-blue-700"
                            >
                                {selectedIds.size === changes.length ? 'Deselect All' : 'Select All'}
                            </button>
                            {selectedIds.size > 0 && (
                                <span className="text-sm text-gray-600">
                                    {selectedIds.size} selected
                                </span>
                            )}
                        </div>

                        {selectedIds.size > 0 && (
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => approveChanges(Array.from(selectedIds))}
                                    disabled={processing}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                                >
                                    {processing ? 'Processing...' : `Approve ${selectedIds.size}`}
                                </button>
                                <button
                                    onClick={() => rejectChanges(Array.from(selectedIds))}
                                    disabled={processing}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                                >
                                    Reject {selectedIds.size}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === changes.length && changes.length > 0}
                                        onChange={selectAll}
                                        className="rounded border-gray-300"
                                    />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Product
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Supplier
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Current Price
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    New Price
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Change
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {changes.map(change => (
                                <tr key={change.id} className={selectedIds.has(change.id) ? 'bg-blue-50' : ''}>
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(change.id)}
                                            onChange={() => toggleSelect(change.id)}
                                            className="rounded border-gray-300"
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">{change.product_name}</div>
                                        <div className="text-sm text-gray-500">{change.sku}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        {change.supplier_name}
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                                        R{change.current_price.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                                        R{change.new_price.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${change.price_change_pct > 0
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-green-100 text-green-800'
                                            }`}>
                                            {change.price_change_pct > 0 ? '+' : ''}{change.price_change_pct.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm space-x-2">
                                        <button
                                            onClick={() => approveChanges([change.id])}
                                            disabled={processing}
                                            className="text-green-600 hover:text-green-700 disabled:opacity-50"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => rejectChanges([change.id])}
                                            disabled={processing}
                                            className="text-red-600 hover:text-red-700 disabled:opacity-50"
                                        >
                                            Reject
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {changes.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No pending price changes. All changes are within the 10% threshold.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
