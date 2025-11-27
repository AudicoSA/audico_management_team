'use client'

import { useState, useEffect, useRef } from 'react'

interface SupplierStatus {
    sessionId?: string
    supplier: string
    supplierName: string
    status: 'idle' | 'running' | 'completed' | 'failed'
    startedAt?: string
    completedAt?: string
    duration?: number
    result?: {
        success: boolean
        duration: number
        output?: string
        error?: string
    }
    error?: string
    lastOutput?: string
    message?: string
}

interface SyncAllStatusResponse {
    suppliers: Record<string, SupplierStatus>
    timestamp: string
}

export default function MCPSyncStatusPage() {
    const [suppliers, setSuppliers] = useState<Record<string, SupplierStatus>>({})
    const [syncing, setSyncing] = useState(false)
    const [polling, setPolling] = useState(false)
    const pollingInterval = useRef<NodeJS.Timeout | null>(null)

    const MCP_SERVICE_URL = process.env.NEXT_PUBLIC_MCP_SERVICE_URL || 'https://mcp-http-service-production-b30b.up.railway.app'

    useEffect(() => {
        // Initial load
        fetchStatus()

        // Cleanup on unmount
        return () => {
            if (pollingInterval.current) {
                clearInterval(pollingInterval.current)
            }
        }
    }, [])

    const fetchStatus = async () => {
        try {
            const response = await fetch(`${MCP_SERVICE_URL}/sync-all-status`)
            const data: SyncAllStatusResponse = await response.json()
            setSuppliers(data.suppliers)

            // Check if any syncs are still running
            const hasRunning = Object.values(data.suppliers).some(s => s.status === 'running')

            if (hasRunning && !polling) {
                startPolling()
            } else if (!hasRunning && polling) {
                stopPolling()
            }
        } catch (error) {
            console.error('Failed to fetch status:', error)
        }
    }

    const startPolling = () => {
        if (pollingInterval.current) return

        setPolling(true)
        pollingInterval.current = setInterval(() => {
            fetchStatus()
        }, 2000) // Poll every 2 seconds
    }

    const stopPolling = () => {
        if (pollingInterval.current) {
            clearInterval(pollingInterval.current)
            pollingInterval.current = null
        }
        setPolling(false)
    }

    const triggerSync = async () => {
        setSyncing(true)

        try {
            const response = await fetch(`${MCP_SERVICE_URL}/sync-all`, {
                method: 'POST'
            })

            const result = await response.json()

            if (result.success) {
                // Start polling for status updates
                startPolling()
                fetchStatus()
            } else {
                alert('Failed to start sync')
            }
        } catch (error) {
            console.error('Failed to trigger sync:', error)
            alert('Failed to trigger sync')
        } finally {
            setSyncing(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-600 bg-green-50'
            case 'running': return 'text-blue-600 bg-blue-50 animate-pulse'
            case 'failed': return 'text-red-600 bg-red-50'
            case 'idle': return 'text-gray-600 bg-gray-50'
            default: return 'text-gray-600 bg-gray-50'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return '✅'
            case 'running': return '⏳'
            case 'failed': return '❌'
            case 'idle': return '⏸️'
            default: return '❓'
        }
    }

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '-'
        if (seconds < 60) return `${seconds.toFixed(1)}s`
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}m ${secs}s`
    }

    const supplierList = Object.entries(suppliers).sort((a, b) => {
        // Sort by status: running first, then completed, then failed, then idle
        const statusOrder = { running: 0, completed: 1, failed: 2, idle: 3 }
        return (statusOrder[a[1].status as keyof typeof statusOrder] || 4) -
            (statusOrder[b[1].status as keyof typeof statusOrder] || 4)
    })

    const stats = {
        total: supplierList.length,
        running: supplierList.filter(([_, s]) => s.status === 'running').length,
        completed: supplierList.filter(([_, s]) => s.status === 'completed').length,
        failed: supplierList.filter(([_, s]) => s.status === 'failed').length,
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">MCP Sync Status</h1>
                        <p className="text-gray-600 mt-2">Monitor automated supplier feed syncs</p>
                    </div>

                    <button
                        onClick={triggerSync}
                        disabled={syncing || stats.running > 0}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        {syncing ? 'Starting...' : stats.running > 0 ? `Syncing (${stats.running}/${stats.total})` : 'Trigger Manual Sync'}
                    </button>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <div className="text-sm text-gray-600">Total Suppliers</div>
                        <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-4">
                        <div className="text-sm text-blue-600">Running</div>
                        <div className="text-2xl font-bold text-blue-900">{stats.running}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-4">
                        <div className="text-sm text-green-600">Completed</div>
                        <div className="text-2xl font-bold text-green-900">{stats.completed}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-4">
                        <div className="text-sm text-red-600">Failed</div>
                        <div className="text-2xl font-bold text-red-900">{stats.failed}</div>
                    </div>
                </div>

                {/* Supplier List */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-900">Supplier Sync Status</h2>
                        {polling && (
                            <p className="text-sm text-blue-600 mt-1">🔄 Auto-refreshing every 2 seconds...</p>
                        )}
                    </div>

                    <div className="divide-y divide-gray-200">
                        {supplierList.map(([key, supplier]) => (
                            <div key={key} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4 flex-1">
                                        <span className="text-2xl">{getStatusIcon(supplier.status)}</span>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900">{supplier.supplierName}</h3>
                                            <div className="flex items-center space-x-4 mt-1">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(supplier.status)}`}>
                                                    {supplier.status.toUpperCase()}
                                                </span>
                                                {supplier.duration !== undefined && (
                                                    <span className="text-sm text-gray-600">
                                                        Duration: {formatDuration(supplier.duration)}
                                                    </span>
                                                )}
                                                {supplier.startedAt && (
                                                    <span className="text-sm text-gray-500">
                                                        Started: {new Date(supplier.startedAt).toLocaleTimeString()}
                                                    </span>
                                                )}
                                            </div>
                                            {supplier.lastOutput && supplier.status === 'running' && (
                                                <div className="mt-2 text-xs text-gray-600 font-mono bg-gray-100 p-2 rounded">
                                                    {supplier.lastOutput}
                                                </div>
                                            )}
                                            {supplier.error && (
                                                <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                                                    {supplier.error}
                                                </div>
                                            )}
                                            {supplier.result?.output && supplier.status === 'completed' && (
                                                <div className="mt-2 text-xs text-green-600">
                                                    ✓ Sync completed successfully
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
