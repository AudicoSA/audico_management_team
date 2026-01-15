'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'

interface NewProduct {
    id: string
    supplier_name: string
    sku: string
    name: string
    cost_price: number
    stock_level: number
    status: string
    created_at: string
}

export default function NewProductsPage() {
    const [products, setProducts] = useState<NewProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [processing, setProcessing] = useState(false)
    
    // Use the new SSR client
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    useEffect(() => {
        fetchProducts()
    }, [])

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('new_products_queue')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setProducts(data || [])
        } catch (error) {
            console.error('Error fetching new products:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleSelectAll = () => {
        if (selected.size === products.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(products.map(p => p.id)))
        }
    }

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selected)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelected(newSelected)
    }

    const handleApprove = async () => {
        if (selected.size === 0) return
        setProcessing(true)
        try {
            const { error } = await supabase
                .from('new_products_queue')
                .update({ status: 'approved_pending' })
                .in('id', Array.from(selected))

            if (error) throw error

            // Clear selection and refresh
            setSelected(new Set())
            await fetchProducts()

        } catch (error) {
            console.error('Error approving products:', error)
            alert('Failed to approve products')
        } finally {
            setProcessing(false)
        }
    }

    const handleRemove = async () => {
        if (selected.size === 0) return
        if (!confirm('Are you sure you want to remove these products from the queue?')) return

        setProcessing(true)
        try {
            const { error } = await supabase
                .from('new_products_queue')
                .delete()
                .in('id', Array.from(selected))

            if (error) throw error

            setSelected(new Set())
            await fetchProducts()
        } catch (error) {
            console.error('Error removing products:', error)
            alert('Failed to remove products')
        } finally {
            setProcessing(false)
        }
    }

    return (
        <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-semibold text-gray-900">New Products Discovery</h1>
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                            {products.length} Found
                        </span>
                    </div>
                    {selected.size > 0 && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleRemove}
                                disabled={processing}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                            >
                                {processing ? 'Processing...' : `Remove (${selected.size})`}
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={processing}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                            >
                                {processing ? 'Processing...' : `Approve (${selected.size})`}
                            </button>
                        </div>
                    )}
                </div>

                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    {loading ? (
                        <div className="p-6 text-center text-gray-500">Loading...</div>
                    ) : products.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">
                            No new products found yet. Upload a pricelist to discover new items!
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                checked={products.length > 0 && selected.size === products.length}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Supplier
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            SKU
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Product Name
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Cost Price
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Retail (Est.)
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Stock
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Added
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {products.map((product) => {
                                        const estimatedRetail = product.cost_price ? (product.cost_price * 1.5).toFixed(2) : 'N/A';
                                        const displayName = product.name || product.sku || 'Unnamed Product';
                                        const createdDate = new Date(product.created_at).toLocaleDateString('en-ZA', {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        });

                                        return (
                                            <tr key={product.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        checked={selected.has(product.id)}
                                                        onChange={() => toggleSelect(product.id)}
                                                        disabled={product.status !== 'pending'}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {product.supplier_name}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                                    {product.sku}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                                                    <div className="truncate" title={displayName}>
                                                        {displayName}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                                    R {product.cost_price?.toFixed(2) || '0.00'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    R {estimatedRetail}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {product.stock_level || '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                                    {createdDate}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                        product.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                            product.status === 'approved_pending' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {product.status === 'approved_pending' ? 'Processing...' : product.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
