'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link2, AlertCircle, Check, X, Search, PlusCircle, ArrowRight } from 'lucide-react'

import { useRouter } from 'next/navigation'

// Types
interface SupplierProduct {
    id: string
    sku: string
    name: string
    description?: string
    price: number
    supplier?: string
    image_url?: string
}

interface Candidate {
    confidence: number
    match_type: string
    price_diff_pct: number
    product: {
        product_id: number
        model: string
        sku: string
        name: string
        price: number
        quantity: number
        image?: string
    }
}

export default function AlignmentPage() {
    const router = useRouter()
    const [unmatched, setUnmatched] = useState<SupplierProduct[]>([])
    const [selectedProduct, setSelectedProduct] = useState<SupplierProduct | null>(null)
    const [candidates, setCandidates] = useState<Candidate[]>([])
    const [loading, setLoading] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
    const [aligning, setAligning] = useState(false)

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

    // Fetch unmatched products on load
    useEffect(() => {
        fetchUnmatched()
    }, [])

    const fetchUnmatched = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API_URL}/api/alignment/unmatched`)
            const data = await res.json()
            setUnmatched(data)
        } catch (error) {
            console.error('Failed to fetch unmatched', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAutoAlign = async () => {
        if (!confirm(`Are you sure you want to run Auto-Alignment?\n\nThis will scan unmatched products and AUTOMATICALLY LINK any that have a 100% Exact Match.\n\nThis cannot be undone easily.`)) {
            return;
        }

        setAligning(true);
        try {
            const res = await fetch(`${API_URL}/api/alignment/auto-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confidence_threshold: 100 })
            });
            const data = await res.json();

            if (data.status === 'success') {
                alert(`Auto-Alignment Complete!\n\n${data.message}`);
                fetchUnmatched(); // Refresh list
            } else {
                alert('Auto-Alignment reported an issue: ' + (data.detail || JSON.stringify(data)));
            }
        } catch (error) {
            console.error(error);
            alert('Failed to run Auto-Alignment');
        } finally {
            setAligning(false);
        }
    }

    const handleSelectProduct = async (product: SupplierProduct) => {
        setSelectedProduct(product)
        setAnalyzing(true)
        setCandidates([])

        try {
            // Assume API endpoint is /api/alignment/candidates/{internal_id}
            const res = await fetch(`${API_URL}/api/alignment/candidates/${product.id}`)
            const data = await res.json()
            setCandidates(data)
        } catch (error) {
            console.error("Failed to fetch candidates", error)
        } finally {
            setAnalyzing(false)
        }
    }

    const handleLink = async (candidate: Candidate) => {
        if (!selectedProduct) return

        if (confirm(`Link '${selectedProduct.name}' to '${candidate.product.name}'?`)) {
            try {
                await fetch(`${API_URL}/api/alignment/link`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        internal_product_id: selectedProduct.id,
                        opencart_product_id: candidate.product.product_id,
                        match_type: candidate.match_type,
                        confidence: candidate.confidence
                    })
                })

                // Remove from list
                setUnmatched(prev => prev.filter(p => p.id !== selectedProduct.id))
                setSelectedProduct(null)
                setCandidates([])
            } catch (error) {
                alert('Failed to link product')
                console.error(error)
            }
        }
    }

    const handleIgnore = async () => {
        if (!selectedProduct) return;

        if (confirm(`Ignore '${selectedProduct.name}'? You won't see it again.`)) {
            try {
                await fetch(`${API_URL}/api/alignment/ignore`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        internal_product_id: selectedProduct.id
                    })
                })

                // Remove from list
                setUnmatched(prev => prev.filter(p => p.id !== selectedProduct.id))
                setSelectedProduct(null)
                setCandidates([])
            } catch (error) {
                alert('Failed to ignore product')
                console.error(error)
            }
        }
    }

    const handleCreate = async () => {
        // If specific product selected, use that. If not, maybe just redirect?
        // Current logic: If matches found = 0, we show big button.
        // But we need to know WHICH product to create.
        // The big button appears when candidates.length === 0, so selectedProduct IS set.

        if (!selectedProduct) return;

        if (confirm(`Send '${selectedProduct.name}' to New Products Queue?`)) {
            try {
                await fetch(`${API_URL}/api/alignment/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        internal_product_id: selectedProduct.id
                    })
                })

                // Remove from list
                setUnmatched(prev => prev.filter(p => p.id !== selectedProduct.id))
                setSelectedProduct(null)
                setCandidates([])

                // Redirect instead of alert
                // router.push('/products/new')
                alert('Product added to New Products Queue!')
            } catch (error) {
                alert('Failed to create product')
                console.error(error)
            }
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-white">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        Product Alignment
                    </h1>
                    <p className="text-slate-400 mt-2">Link supplier feeds to OpenCart products using AI and Price Analysis.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[80vh]">

                    {/* Left Panel: Unmatched List */}
                    <div className="lg:col-span-4 glass rounded-2xl p-4 overflow-y-auto border border-white/10">
                        <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
                            <span>Unmatched Queue</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleAutoAlign}
                                    disabled={aligning || unmatched.length === 0}
                                    className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {aligning ? 'Aligning...' : '⚡ Auto Align'}
                                </button>
                                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">{unmatched.length}</span>
                            </div>
                        </h2>

                        {loading ? (
                            <div className="flex justify-center p-8"><span className="animate-spin text-2xl">⏳</span></div>
                        ) : (
                            <div className="space-y-3">
                                {unmatched.map(product => (
                                    <motion.div
                                        key={product.id}
                                        layoutId={`product-${product.id}`}
                                        onClick={() => handleSelectProduct(product)}
                                        className={`p-4 rounded-xl cursor-pointer transition-all border ${selectedProduct?.id === product.id
                                            ? 'bg-blue-600/20 border-blue-500/50 shadow-lg shadow-blue-900/20'
                                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-mono text-slate-400">{product.sku}</span>
                                            <span className="text-xs font-bold text-emerald-400">R {product.price}</span>
                                        </div>
                                        <h3 className="text-sm font-medium line-clamp-2">{product.name}</h3>
                                        <div className="mt-2 text-xs text-slate-500 flex items-center">
                                            <Search className="w-3 h-3 mr-1" />
                                            Click to analyze matches
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Analysis & Candidates */}
                    <div className="lg:col-span-8 glass rounded-2xl p-6 border border-white/10 flex flex-col relative overflow-hidden">
                        {!selectedProduct ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <Link2 className="w-16 h-16 mb-4 opacity-20" />
                                <p>Select a product to find matches</p>
                            </div>
                        ) : (
                            <>
                                {/* Header Comparison */}
                                <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-white/10 relative">
                                    <div className="flex items-start gap-4">
                                        <div className="flex-1">
                                            <span className="text-xs text-slate-400 uppercase tracking-wider">Source Product</span>
                                            <h2 className="text-xl font-bold text-white mt-1">{selectedProduct.name}</h2>

                                            {/* Description Display */}
                                            {selectedProduct.description && (
                                                <p className="text-sm text-slate-400 mt-2 line-clamp-3 bg-black/20 p-2 rounded border border-white/5">
                                                    {selectedProduct.description}
                                                </p>
                                            )}

                                            <div className="flex items-center gap-4 mt-3">
                                                <span className="px-2 py-1 rounded bg-black/30 text-xs font-mono text-slate-300">{selectedProduct.sku}</span>
                                                <span className="text-lg font-bold text-emerald-400">R {selectedProduct.price}</span>
                                            </div>
                                        </div>

                                        {/* Ignore Button */}
                                        <button
                                            onClick={handleIgnore}
                                            title="Ignore this product (removes from queue)"
                                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/30 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition-all flex items-center"
                                        >
                                            <X className="w-3 h-3 mr-1" />
                                            Ignore
                                        </button>
                                    </div>
                                </div>

                                {/* Candidates List */}
                                <div className="flex-1 overflow-y-auto">
                                    <div className="flex justify-between items-end mb-4">
                                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                                            {analyzing ? 'Analyzing database...' : `Top Matches Found (${candidates.filter(c => c.confidence > 50).length})`}
                                        </h3>

                                        {/* Quick Create Action - Always Visible */}
                                        {candidates.length > 0 && (
                                            <button
                                                onClick={handleCreate}
                                                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-900/40 transition-all"
                                            >
                                                <PlusCircle className="w-3 h-3 mr-1.5" />
                                                Create New
                                            </button>
                                        )}
                                    </div>

                                    {analyzing ? (
                                        <div className="space-y-4">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />
                                            ))}
                                        </div>
                                    ) : candidates.filter(c => c.confidence > 50).length === 0 ? (
                                        <div className="text-center py-12">
                                            <p className="text-slate-400 mb-4">
                                                {candidates.length > 0
                                                    ? `${candidates.length} low-confidence matches hidden.`
                                                    : "No good matches found in OpenCart."}
                                            </p>
                                            <button
                                                onClick={handleCreate}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors flex items-center mx-auto"
                                            >
                                                <PlusCircle className="w-4 h-4 mr-2" />
                                                Create New Product
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {candidates.filter(c => c.confidence > 50).map((cand, idx) => (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.1 }}
                                                    key={cand.product.product_id}
                                                    className="group p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl transition-all"
                                                >
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className={`px-2 py-0.5 rounded text-xs font-bold ${cand.confidence >= 80 ? 'bg-green-500/20 text-green-400' :
                                                                    cand.confidence >= 50 ? 'bg-amber-500/20 text-amber-400' :
                                                                        'bg-red-500/20 text-red-400'
                                                                    }`}>
                                                                    {cand.confidence}% Match
                                                                </div>
                                                                <span className="text-xs text-slate-500 capitalize">{cand.match_type}</span>
                                                            </div>

                                                            <h4 className="font-medium text-slate-200">{cand.product.name}</h4>

                                                            <div className="flex items-center gap-4 mt-2 text-sm">
                                                                <span className="font-mono text-slate-500">{cand.product.sku}</span>
                                                                <span className={`font-bold ${cand.price_diff_pct > 20 ? 'text-red-400' : 'text-slate-300'
                                                                    }`}>
                                                                    R {typeof cand.product.price === 'string' ? parseFloat(cand.product.price).toFixed(2) : cand.product.price.toFixed(2)}
                                                                </span>
                                                                {cand.price_diff_pct > 20 && (
                                                                    <span className="text-xs text-red-400 flex items-center">
                                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                                        {cand.price_diff_pct}% Diff
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() => handleLink(cand)}
                                                            className="opacity-0 group-hover:opacity-100 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-900/50 flex items-center transform translate-x-2 group-hover:translate-x-0"
                                                        >
                                                            <Link2 className="w-4 h-4 mr-2" />
                                                            Link
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))}

                                            {/* Fallback Create Option */}
                                            <div className="pt-6 border-t border-white/10 mt-6 text-center">
                                                <p className="text-sm text-slate-400 mb-3">None of these match?</p>
                                                <button
                                                    onClick={handleCreate}
                                                    className="px-4 py-2 bg-white/5 hover:bg-emerald-600/20 text-slate-300 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/50 rounded-lg text-sm font-medium transition-all flex items-center mx-auto"
                                                >
                                                    <PlusCircle className="w-4 h-4 mr-2" />
                                                    Create '{selectedProduct.name.substring(0, 30)}...' as New
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
