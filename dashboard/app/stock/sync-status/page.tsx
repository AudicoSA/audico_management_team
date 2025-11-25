'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface SyncSession {
    id: string
    started_at: string
    completed_at: string | null
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
    error: string | null
    created_at: string
}

export default function MCPSyncStatusPage() {
    const [sessions, setSessions] = useState<SyncSession[]>([])
    const [selectedSession, setSelectedSession] = useState<string | null>(null)
    const [logs, setLogs] = useState<SyncLog[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)

    useEffect(() => {
        fetchSessions()
    }, [])

    useEffect(() => {
        if (selectedSession) {
            fetchLogs(selectedSession)
        }
    }, [selectedSession])

    const fetchSessions = async () => {
        setLoading(true)

        const { data } = await supabase
            .from('mcp_sync_sessions')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(20)

        setSessions(data || [])
        setLoading(false)
    }

    const fetchLogs = async (sessionId: string) => {
        const { data } = await supabase
            .from('mcp_sync_log')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at')

        setLogs(data || [])
    }

    const triggerSync = async () => {
        setSyncing(true)

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/mcp/sync-all`, {
                method: 'POST'
            })

            const result = await response.json()

            if (result.success) {
                alert(`Sync completed: ${result.completed}/${result.total} suppliers successful`)
                fetchSessions()
            } else {
                alert('Sync failed')
            }
        } catch (error) {
            alert('Failed to trigger sync')
        } finally {
            setSyncing(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-600 bg-green-50'
            case 'running': return 'text-blue-600 bg-blue-50'
            case 'partial': return 'text-yellow-600 bg-yellow-50'
            case 'failed': return 'text-red-600 bg-red-50'
            default: return 'text-gray-600 bg-gray-50'
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-500">Loading sync status...</div>
            </div>
        )
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
                        disabled={syncing}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {syncing ? 'Syncing...' : 'Trigger Manual Sync'}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Sync Sessions List */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Syncs</h2>

                        <div className="space-y-3">
                            {sessions.map(session => (
                                <div
                                    key={session.id}
                                    onClick={() => setSelectedSession(session.id)}
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedSession === session.id
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(session.status)}`}>
                                            {session.status.toUpperCase()}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {new Date(session.started_at).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">
                                            {session.completed_suppliers}/{session.total_suppliers} completed
                                        </span>
                                        {session.failed_suppliers > 0 && (
                                            <span className="text-red-600">
                                                {session.failed_suppliers} failed
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sync Logs Detail */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            {selectedSession ? 'Sync Details' : 'Select a sync session'}
                        </h2>

                        {selectedSession && logs.length > 0 ? (
                            <div className="space-y-3">
                                {logs.map(log => (
                                    <div key={log.id} className="p-4 rounded-lg border border-gray-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium text-gray-900">{log.supplier_name}</span>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${log.status === 'success'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                                }`}>
                                                {log.status}
                                            </span>
                                        </div>

                                        <div className="text-sm text-gray-600">
                                            Duration: {log.duration_seconds.toFixed(1)}s
                                        </div>

                                        {log.error && (
                                            <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                                                {log.error}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                {selectedSession ? 'No logs found' : 'Select a session to view details'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
