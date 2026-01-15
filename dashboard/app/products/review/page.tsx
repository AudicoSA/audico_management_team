'use client'

import { useState, useEffect } from 'react'

interface PriceChange {
    id: number
    product_id: number
    sku: string
    product_name: string
    current_price: number
    new_price: number
    price_change_pct: number
    supplier_name: string
    created_at: string
}

export default function ReviewPage() {
    const [changes, setChanges] = useState<PriceChange[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<number[]>([])
    const [processing, setProcessing] = useState(false)

    useEffect(() => {
        fetchQueue()
    }, [])

    const fetchQueue = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const res = await fetch(`${apiUrl}/api/products/review-queue`)
            const data = await res.json()
            setChanges(data.changes || [])
        } catch (error) {
            console.error('Failed to fetch queue:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelected(changes.map(c => c.id))
        } else {
            setSelected([])
        }
    }

    const handleSelect = (id: number) => {
        if (selected.includes(id)) {
            setSelected(selected.filter(s => s !== id))
        } else {
            setSelected([...selected, id])
        }
    }

    const handleAction = async (action: 'approve' | 'reject') => {
        if (selected.length === 0) return
        if (!confirm(`Are you sure you want to ${action} ${selected.length} items?`)) return

        setProcessing(true)
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const res = await fetch(`${apiUrl}/api/products/review-action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ids: selected })
            })

            const result = await res.json()
            if (result.success) {
                alert(`Successfully ${action}d ${result.processed} items.`)
                fetchQueue()
                setSelected([])
            } else {
                alert(`Error: ${result.error}`)
            }
        } catch (error) {
            console.error('Action failed:', error)
            alert('Action failed')
        } finally {
            setProcessing(false)
        }
    }

    if (loading) return <div className="p-8">Loading...</div>

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Review Price Changes</h1>
                        <p className="text-gray-600 mt-2">Approve or reject pending price updates from supplier feeds.</p>
                    </div>
                    <div className="space-x-4">
                        <button
                            onClick={() => handleAction('reject')}
                            disabled={selected.length === 0 || processing}
                            className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                        >
                            Reject Selected ({selected.length})
                        </button>
                        <button
                            onClick={() => handleAction('approve')}
                            disabled={selected.length === 0 || processing}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                            Approve Selected ({selected.length})
                        </button>
                    </div>
                </div>

                {changes.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                        ✅ No pending changes. Your prices are up to date!
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            onChange={handleSelectAll}
                                            checked={selected.length === changes.length && changes.length > 0}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Old Price</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Price</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {changes.map((change) => (
                                    <tr key={change.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <input
                                                type="checkbox"
                                                checked={selected.includes(change.id)}
                                                onChange={() => handleSelect(change.id)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{change.product_name}</div>
                                            <div className="text-sm text-gray-500">SKU: {change.sku}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {change.supplier_name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            R{change.current_price.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            R{change.new_price.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${change.price_change_pct > 0
                                                    ? 'bg-red-100 text-red-800'
                                                    : 'bg-green-100 text-green-800'
                                                }`}>
                                                {change.price_change_pct > 0 ? '+' : ''}{change.price_change_pct.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
