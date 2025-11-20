'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Check, X, Upload, Filter, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface StockUpdate {
    id: string
    created_at: string
    sku: string
    field_name: string
    old_value: string | null
    new_value: string
    supplier_name: string
    status: string
    upload_id: string
}

export default function StockPage() {
    const [updates, setUpdates] = useState<StockUpdate[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending')

    useEffect(() => {
        fetchUpdates()
    }, [filter])

    async function fetchUpdates() {
        setLoading(true)
        let query = supabase.from('stock_updates').select('*').order('created_at', { ascending: false })

        if (filter !== 'all') {
            query = query.eq('status', filter)
        }

        const { data, error } = await query
        if (!error && data) {
            setUpdates(data)
        }
        setLoading(false)
    }

    async function approveUpdate(id: string) {
        await supabase
            .from('stock_updates')
            .update({ status: 'approved', approved_at: new Date().toISOString() })
            .eq('id', id)

        fetchUpdates()
    }

    async function rejectUpdate(id: string) {
        await supabase
            .from('stock_updates')
            .update({ status: 'rejected' })
            .eq('id', id)

        fetchUpdates()
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent mb-2">
                        Stock & Price Updates
                    </h1>
                    <p className="text-slate-400">AI-powered price list extraction via Gemini</p>
                </motion.div>

                {/* Filters */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center space-x-4 mb-6"
                >
                    <button
                        onClick={() => setFilter('pending')}
                        className={`px-4 py-2 rounded-lg transition-all ${filter === 'pending'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'glass text-slate-400 hover:text-white'
                            }`}
                    >
                        <Clock className="w-4 h-4 inline mr-2" />
                        Pending
                    </button>
                    <button
                        onClick={() => setFilter('approved')}
                        className={`px-4 py-2 rounded-lg transition-all ${filter === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'glass text-slate-400 hover:text-white'
                            }`}
                    >
                        <Check className="w-4 h-4 inline mr-2" />
                        Approved
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg transition-all ${filter === 'all'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'glass text-slate-400 hover:text-white'
                            }`}
                    >
                        <Filter className="w-4 h-4 inline mr-2" />
                        All
                    </button>
                </motion.div>

                {/* Updates List */}
                {loading ? (
                    <div className="glass rounded-2xl p-12 text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-slate-400">Loading updates...</p>
                    </div>
                ) : updates.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass rounded-2xl p-12 text-center"
                    >
                        <Upload className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-white mb-2">No Updates Yet</h3>
                        <p className="text-slate-400">Upload a price list to see Gemini AI extract and analyze changes</p>
                    </motion.div>
                ) : (
                    <div className="space-y-4">
                        {updates.map((update, index) => (
                            <motion.div
                                key={update.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="glass rounded-xl p-6 hover:bg-white/10 transition-all"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-3">
                                            <span className="px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 text-sm font-medium">
                                                {update.sku}
                                            </span>
                                            <span className="px-2 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300">
                                                {update.supplier_name}
                                            </span>
                                            <span className="text-sm text-slate-400">
                                                {new Date(update.created_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <div className="flex items-center space-x-6">
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Field</p>
                                                <p className="text-white font-medium capitalize">{update.field_name}</p>
                                            </div>

                                            <div className="flex items-center space-x-4">
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-1">Old Value</p>
                                                    <p className="text-slate-300">{update.old_value || 'N/A'}</p>
                                                </div>

                                                {update.field_name === 'price' ? (
                                                    parseFloat(update.new_value) > parseFloat(update.old_value || '0') ? (
                                                        <TrendingUp className="w-5 h-5 text-red-400" />
                                                    ) : (
                                                        <TrendingDown className="w-5 h-5 text-green-400" />
                                                    )
                                                ) : null}

                                                <div>
                                                    <p className="text-xs text-slate-500 mb-1">New Value</p>
                                                    <p className="text-white font-semibold">{update.new_value}</p>
                                                </div>
                                            </div>

                                            {update.field_name === 'price' && update.old_value && (
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-1">Change</p>
                                                    <PercentageChange oldValue={update.old_value} newValue={update.new_value} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {update.status === 'pending' && (
                                        <div className="flex items-center space-x-2 ml-4">
                                            <button
                                                onClick={() => approveUpdate(update.id)}
                                                className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-all"
                                                title="Approve"
                                            >
                                                <Check className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => rejectUpdate(update.id)}
                                                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-all"
                                                title="Reject"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}

                                    {update.status === 'approved' && (
                                        <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-medium">
                                            ✓ Approved
                                        </div>
                                    )}

                                    {update.status === 'rejected' && (
                                        <div className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-sm font-medium">
                                            ✗ Rejected
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function PercentageChange({ oldValue, newValue }: { oldValue: string; newValue: string }) {
    const old = parseFloat(oldValue)
    const newVal = parseFloat(newValue)
    const change = ((newVal - old) / old) * 100
    const isIncrease = change > 0

    return (
        <span className={`font-semibold ${isIncrease ? 'text-red-400' : 'text-green-400'}`}>
            {isIncrease ? '+' : ''}{change.toFixed(1)}%
        </span>
    )
}
