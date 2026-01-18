'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Play, RefreshCw, Server, AlertTriangle, CheckCircle, Clock, ChevronRight, Activity } from 'lucide-react'

// Types
interface SyncSession {
    id: string
    started_at: string
    completed_at?: string
    status: 'running' | 'completed' | 'partial' | 'failed'
    total_suppliers: number
    completed_suppliers: number
    failed_suppliers: number
    triggered_by: string
}

interface SyncLog {
    id: string
    supplier_name: string
    status: 'success' | 'failed' | 'error'
    duration_seconds: number
    output?: string
    error?: string
    created_at: string
}

export default function FeedsPage() {
    const [sessions, setSessions] = useState<SyncSession[]>([])
    const [selectedSession, setSelectedSession] = useState<SyncSession | null>(null)
    const [logs, setLogs] = useState<SyncLog[]>([])
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({})
    const [view, setView] = useState<'status' | 'suppliers'>('suppliers')

    // Config
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

    // Load data on mount
    useEffect(() => {
        fetchSessions()
        fetchSuppliers()
        // Auto-refresh every 10s
        const interval = setInterval(() => {
            fetchSessions()
            if (selectedSession) fetchLogs(selectedSession.id)
        }, 10000)
        return () => clearInterval(interval)
    }, [selectedSession])

    const fetchSuppliers = async () => {
        try {
            const res = await fetch(`${API_URL}/api/mcp/suppliers`)
            const data = await res.json()
            setSuppliers(data.suppliers)
        } catch (error) {
            console.error("Failed to fetch suppliers", error)
        }
    }

    const fetchSessions = async () => {
        try {
            const res = await fetch(`${API_URL}/api/mcp/sync-status`)
            const data = await res.json()
            setSessions(data.recent_syncs)

            // If no session selected, select the first one (latest)
            if (!selectedSession && data.recent_syncs.length > 0) {
                fetchLogs(data.recent_syncs[0].id)
                setSelectedSession(data.recent_syncs[0])
            }
        } catch (error) {
            console.error("Failed to fetch sessions", error)
        }
    }

    const fetchLogs = async (sessionId: string) => {
        try {
            const res = await fetch(`${API_URL}/api/mcp/sync-status/${sessionId}`)
            const data = await res.json()
            setLogs(data.logs)
        } catch (error) {
            console.error("Failed to fetch logs", error)
        }
    }

    const handleSessionClick = (session: SyncSession) => {
        setSelectedSession(session)
        fetchLogs(session.id)
    }

    const handleGlobalSync = async () => {
        if (!confirm("Start a full sync of all supplier feeds? This may take a few minutes.")) return

        try {
            const res = await fetch(`${API_URL}/api/mcp/sync-all`, { method: 'POST' })
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }))
                alert(`Failed to start sync: ${err.detail || res.statusText}`)
                return;
            }
            alert("Global sync started in background.")
            setTimeout(fetchSessions, 1000)
        } catch (error) {
            alert(`Failed to start sync: ${error}`)
        }
    }

    const handleSingleSync = async (supplierEndpoint: string, supplierName: string) => {
        setSyncingMap(prev => ({ ...prev, [supplierEndpoint]: true }))
        try {
            const res = await fetch(`${API_URL}/api/mcp/sync/${supplierEndpoint}`, { method: 'POST' })
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }))
                alert(`Failed to sync ${supplierName}: ${err.detail || res.statusText}`)
            }
            setTimeout(fetchSessions, 2000)
        } catch (error) {
            alert(`Failed to sync ${supplierName}: ${error}`)
        } finally {
            setTimeout(() => {
                setSyncingMap(prev => ({ ...prev, [supplierEndpoint]: false }))
            }, 5000)
        }
    }

    // Helper for duration
    const formatDuration = (start: string, end?: string) => {
        if (!end) return "Running..."
        const s = new Date(start).getTime()
        const e = new Date(end).getTime()
        const diff = (e - s) / 1000
        return `${diff.toFixed(1)}s`
    }

    const checkHealth = async () => {
        try {
            const res = await fetch(`${API_URL}/api/mcp/health`)
            const data = await res.json()
            alert(JSON.stringify(data, null, 2))
        } catch (error) {
            alert(`Health check failed: ${error}`)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-white">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent flex items-center gap-3">
                            <Server className="w-8 h-8 text-orange-500" />
                            MCP Supplier Feeds
                        </h1>
                        <p className="text-slate-400 mt-2">Manage and monitor automated supplier feed synchronizations.</p>
                    </div>
                    <button
                        onClick={checkHealth}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors border border-slate-700"
                    >
                        Test Connection
                    </button>
                </div>

                {/* Tabs / View Switcher */}
                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => setView('suppliers')}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${view === 'suppliers' ? 'bg-orange-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                    >
                        Suppliers Grid
                    </button>
                    <button
                        onClick={() => setView('status')}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${view === 'status' ? 'bg-orange-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                    >
                        Sync Logs
                    </button>
                </div>

                {view === 'suppliers' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Sync All Card */}
                        <div className="glass p-6 rounded-2xl border border-orange-500/30 bg-orange-900/10 flex flex-col justify-between hover:scale-[1.02] transition-transform">
                            <div>
                                <h3 className="text-xl font-bold text-orange-200 mb-2">Sync All Feeds</h3>
                                <p className="text-sm text-orange-200/60">Trigger a sequential sync of all enabled suppliers.</p>
                            </div>
                            <button
                                onClick={handleGlobalSync}
                                className="mt-6 w-full py-3 bg-orange-600 hover:bg-orange-500 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
                            >
                                <Play className="w-5 h-5" /> Trigger All
                            </button>
                        </div>

                        {suppliers.map(sup => (
                            <div key={sup.endpoint} className={`glass p-6 rounded-2xl border ${sup.enabled ? 'border-white/10' : 'border-red-900/30 opacity-60'} flex flex-col justify-between`}>
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-lg font-bold text-slate-200">{sup.name}</h3>
                                        <Activity className={`w-4 h-4 ${sup.enabled ? 'text-green-500' : 'text-slate-600'}`} />
                                    </div>
                                    <p className="text-xs font-mono text-slate-500 mb-4">{sup.endpoint}</p>
                                    {!sup.enabled && <div className="text-xs text-red-400 font-bold uppercase tracking-wider">Disabled</div>}
                                </div>
                                <button
                                    onClick={() => handleSingleSync(sup.endpoint, sup.name)}
                                    disabled={!sup.enabled || syncingMap[sup.endpoint]}
                                    className={`mt-4 w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${!sup.enabled
                                        ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                        : syncingMap[sup.endpoint]
                                            ? 'bg-blue-600/50 text-white cursor-wait'
                                            : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/30'
                                        }`}
                                >
                                    {syncingMap[sup.endpoint] ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    {syncingMap[sup.endpoint] ? 'Syncing...' : 'Sync Now'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}


                {view === 'status' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[75vh]">

                        {/* Left Panel: History */}
                        <div className="lg:col-span-4 glass rounded-2xl p-4 overflow-y-auto border border-white/10 flex flex-col">
                            <h2 className="text-lg font-semibold mb-4 px-2 text-slate-300">Sync History</h2>
                            <div className="space-y-2">
                                {sessions.map(session => (
                                    <div
                                        key={session.id}
                                        onClick={() => handleSessionClick(session)}
                                        className={`p-4 rounded-xl cursor-pointer transition-all border ${selectedSession?.id === session.id
                                            ? 'bg-white/10 border-orange-500/50'
                                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                {session.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-400" />}
                                                {session.status === 'failed' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                                                {session.status === 'partial' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                                                {session.status === 'running' && <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />}
                                                <span className="font-mono text-xs text-slate-400">
                                                    {new Date(session.started_at).toLocaleDateString()} {new Date(session.started_at).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <Badge status={session.status} />
                                        </div>

                                        <div className="flex justify-between items-center text-xs text-slate-400 mt-2">
                                            <span>
                                                <span className="text-slate-200 font-bold">{session.completed_suppliers}</span> success,
                                                <span className="text-red-300 font-bold ml-1">{session.failed_suppliers}</span> failed
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatDuration(session.started_at, session.completed_at)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Panel: Details */}
                        <div className="lg:col-span-8 glass rounded-2xl p-6 border border-white/10 overflow-y-auto">
                            {!selectedSession ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                    <Activity className="w-16 h-16 mb-4 opacity-20" />
                                    <p>Select a sync session to view details</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/10">
                                        <div>
                                            <h2 className="text-xl font-bold">Sync Details</h2>
                                            <p className="text-slate-400 text-sm font-mono mt-1">{selectedSession.id}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm text-slate-400">Total Suppliers</div>
                                            <div className="text-2xl font-bold">{selectedSession.total_suppliers}</div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {logs.map((log) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                key={log.id}
                                                className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                                                            }`} />
                                                        <span className="font-bold text-lg">{log.supplier_name}</span>
                                                    </div>
                                                    <span className="font-mono text-xs text-slate-400">{log.duration_seconds}s</span>
                                                </div>

                                                {log.error ? (
                                                    <div className="mt-2 p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-sm text-red-200 font-mono">
                                                        {log.error}
                                                    </div>
                                                ) : (
                                                    <div className="mt-2 text-sm text-slate-400 line-clamp-1">
                                                        {log.output || "No output logged"}
                                                    </div>
                                                )}
                                            </motion.div>
                                        ))}

                                        {selectedSession.status === 'running' && (
                                            <div className="flex justify-center p-8">
                                                <span className="animate-pulse text-slate-500">Waiting for next update...</span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function Badge({ status }: { status: string }) {
    const styles = {
        running: 'bg-blue-500/20 text-blue-300',
        completed: 'bg-green-500/20 text-green-300',
        partial: 'bg-amber-500/20 text-amber-300',
        failed: 'bg-red-500/20 text-red-300'
    }
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${styles[status as keyof typeof styles]}`}>
            {status}
        </span>
    )
}
