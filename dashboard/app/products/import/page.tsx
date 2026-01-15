'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

import UploadStatusList from '@/components/UploadStatusList'

export default function ImportProductsPage() {
    // ... (existing state) ...
    const [file, setFile] = useState<File | null>(null)
    const [instruction, setInstruction] = useState('retail')
    const [markup, setMarkup] = useState('')
    const [uploading, setUploading] = useState(false)
    const [supplierName, setSupplierName] = useState('')
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            setMessage(null)
        }
    }

    const handleUpload = async () => {
        if (!file) return

        setUploading(true)
        setMessage(null)

        try {
            const filename = `${Date.now()}-${file.name}`
            const { data, error } = await supabase.storage
                .from('invoices')
                .upload(`price_lists/manual_upload/${filename}`, file)

            if (error) throw error

            // Create record in price_list_uploads
            const { error: dbError } = await supabase
                .from('price_list_uploads')
                .insert({
                    filename: file.name,
                    storage_path: data.path,
                    supplier_name: 'Manual Upload',
                    status: 'pending',
                    uploaded_by: 'dashboard_user',
                    instruction: instruction,
                    markup_pct: markup ? parseFloat(markup) : null
                })

            if (dbError) throw dbError

            setMessage({ type: 'success', text: 'File uploaded successfully! Processing started.' })
            setFile(null)
        } catch (error: any) {
            console.error('Upload failed:', error)
            setMessage({ type: 'error', text: error.message || 'Upload failed' })
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Import Pricelist</h1>
                    <p className="text-gray-600 mt-2">Upload supplier pricelists (Excel, CSV, PDF) for processing.</p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
                    <div className="space-y-6">

                        {/* Price Type Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Price Type in File
                            </label>
                            <select
                                value={instruction}
                                onChange={(e) => setInstruction(e.target.value)}
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-gray-900"
                            >
                                <option value="cost_excl_vat">Cost Price (Excl VAT) - Add VAT (15%) & Markup</option>
                                <option value="cost_incl_vat">Cost Price (Incl VAT) - Add Markup</option>
                                <option value="retail">Retail Price - Use As Is</option>
                            </select>
                            <p className="mt-1 text-sm text-gray-500">
                                Tell the AI how to interpret the prices in the file.
                            </p>
                        </div>

                        {/* Markup Percentage (Only for Cost Price) */}
                        {(instruction === 'cost_excl_vat' || instruction === 'cost_incl_vat') && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Markup Percentage (%)
                                </label>
                                <div className="mt-1 relative rounded-md shadow-sm w-full sm:w-1/3">
                                    <input
                                        type="number"
                                        value={markup}
                                        onChange={(e) => setMarkup(e.target.value)}
                                        className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-3 pr-12 sm:text-sm border-gray-300 rounded-md text-gray-900"
                                        placeholder="30"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <span className="text-gray-500 sm:text-sm">%</span>
                                    </div>
                                </div>
                                <p className="mt-1 text-sm text-gray-500">
                                    Override default markup. Leave empty to use supplier defaults.
                                </p>
                            </div>
                        )}

                        <div className="border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-blue-500 transition-colors">
                            <label htmlFor="file-upload" className="cursor-pointer block p-12 w-full h-full">
                                <input
                                    type="file"
                                    id="file-upload"
                                    className="hidden"
                                    onChange={handleFileChange}
                                    accept=".csv,.xlsx,.xls,.pdf"
                                />
                                <div className="space-y-2">
                                    <div className="mx-auto h-12 w-12 text-gray-400">
                                        <svg className="h-full w-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    </div>
                                    <div className="text-gray-600">
                                        <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
                                    </div>
                                    <p className="text-xs text-gray-500">CSV, Excel, or PDF up to 10MB</p>
                                </div>
                            </label>
                        </div>

                        {file && (
                            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0 h-10 w-10 rounded bg-blue-100 flex items-center justify-center text-blue-600">
                                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setFile(null)}
                                    className="text-gray-400 hover:text-red-500"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        {message && (
                            <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button
                                onClick={handleUpload}
                                disabled={!file || uploading}
                                className={`px-6 py-2 rounded-md text-white font-medium ${!file || uploading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                            >
                                {uploading ? 'Uploading...' : 'Process Pricelist'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Status List */}
                <UploadStatusList />
            </div>
        </div>
    )
}

