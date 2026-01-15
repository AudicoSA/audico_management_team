'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { formatDistanceToNow } from 'date-fns'

interface UploadRecord {
    id: string
    filename: string
    supplier_name: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    created_at: string
    total_rows: number | null
    processed_rows: number | null
    error_message: string | null
    instruction: string | null
}

export default function UploadStatusList() {
    const [uploads, setUploads] = useState<UploadRecord[]>([])
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const fetchUploads = async () => {
        const { data, error } = await supabase
            .from('price_list_uploads')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10)

        if (data) {
            setUploads(data)
        }
    }

    useEffect(() => {
        fetchUploads()

        // Set up real-time subscription
        const channel = supabase
            .channel('price_list_uploads_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'price_list_uploads'
                },
                (payload) => {
                    console.log('Real-time update:', payload)
                    fetchUploads() // Refresh list on any change
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase])

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800'
            case 'processing': return 'bg-blue-100 text-blue-800'
            case 'failed': return 'bg-red-100 text-red-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-medium text-gray-900">Recent Uploads</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Products</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {uploads.map((upload) => (
                            <tr key={upload.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {upload.filename}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {upload.supplier_name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {upload.instruction === 'retail' ? 'Retail' :
                                        upload.instruction === 'cost_incl_vat' ? 'Cost (Incl VAT)' : 'Cost (Excl VAT)'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(upload.status)}`}>
                                        {upload.status}
                                    </span>
                                    {upload.error_message && (
                                        <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={upload.error_message}>
                                            {upload.error_message}
                                        </p>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {upload.status === 'completed' ? (
                                        <span className="font-medium text-green-600">{upload.processed_rows} extracted</span>
                                    ) : (
                                        '-'
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {formatDistanceToNow(new Date(upload.created_at), { addSuffix: true })}
                                </td>
                            </tr>
                        ))}
                        {uploads.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                                    No uploads found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
