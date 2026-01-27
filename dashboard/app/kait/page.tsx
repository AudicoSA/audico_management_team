'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
    Bot,
    Mail,
    Clock,
    CheckCircle2,
    AlertCircle,
    MessageSquare
} from 'lucide-react'

// Kait Avatar (Realistic version)
const KAIT_AVATAR_PATH = '/images/kait_real.png'

interface Workflow {
    id: string
    order_no: string
    status: string
    last_action_at: string
    logs: string[]
    metadata: any
}

export default function KaitDashboard() {
    const [workflows, setWorkflows] = useState<Workflow[]>([])
    const [loading, setLoading] = useState(true)

    const [drafts, setDrafts] = useState<any[]>([])

    useEffect(() => {
        fetchWorkflows()
        fetchDrafts()

        // Poll every 10s for live feel
        const interval = setInterval(() => {
            fetchWorkflows()
            fetchDrafts()
        }, 10000)
        return () => clearInterval(interval)
    }, [])

    const fetchWorkflows = async () => {
        const { data, error } = await supabase
            .from('kait_workflows')
            .select('*')
            .order('last_action_at', { ascending: false })
            .limit(50)

        if (data) setWorkflows(data)
        setLoading(false)
    }

    const fetchDrafts = async () => {
        const { data } = await supabase
            .from('kait_email_drafts')
            .select('*')
            .eq('status', 'draft')
            .order('created_at', { ascending: false })

        if (data) setDrafts(data)
    }

    const approveDraft = async (id: string) => {
        await supabase.from('kait_email_drafts').update({ status: 'approved' }).eq('id', id)
        // Optimistic update
        setDrafts(drafts.filter(d => d.id !== id))
        // Refresh workflows shortly after to see 'Sent' status update
        setTimeout(fetchWorkflows, 5000)
    }

    const [rejectingId, setRejectingId] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [feedbackText, setFeedbackText] = useState('')

    const confirmReject = async (id: string) => {
        if (!feedbackText.trim()) return

        await supabase.from('kait_email_drafts').update({
            status: 'changes_requested',
            feedback: feedbackText
        }).eq('id', id)

        // Optimistic update
        setDrafts(drafts.filter(d => d.id !== id))
        setRejectingId(null)
        setFeedbackText('')
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            case 'customer_emailed': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
            case 'supplier_contacted': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            case 'waiting_reply': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
            case 'invoiced': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
            case 'paid': return 'bg-green-500/20 text-green-400 border-green-500/30'
            case 'complete': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
            default: return 'bg-gray-800 text-gray-400 border-gray-700'
        }
    }

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-white p-6 gap-6 overflow-hidden">

            {/* Header / Persona */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        {/* Avatar Replacement */}
                        <div className="h-16 w-16 rounded-full border-2 border-[#ccff00] overflow-hidden bg-gray-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={KAIT_AVATAR_PATH} alt="Kait" className="h-full w-full object-cover" />
                        </div>
                        <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-green-500 border-2 border-black"></span>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Kait Bayes <span className="text-[#ccff00]">.</span>
                        </h1>
                        <p className="text-gray-400 flex items-center gap-2">
                            <Bot className="h-4 w-4" />
                            Customer Service Representative • Online & Working
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <span className="inline-flex items-center rounded-full border border-[#ccff00] px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-[#ccff00]">
                        Active Workflows: {workflows.length}
                    </span>
                    {drafts.length > 0 && (
                        <span className="inline-flex items-center rounded-full border border-orange-500 px-2.5 py-0.5 text-xs font-semibold text-orange-500 animate-pulse">
                            Drafts Waiting: {drafts.length}
                        </span>
                    )}
                </div>
            </div>

            {/* Separator Replacement */}
            <div className="h-[1px] w-full bg-white/10" />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden">

                {/* Active Workflows Column */}
                <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Clock className="w-5 h-5 text-[#ccff00]" />
                        Active Orders
                    </h2>

                    {/* ScrollArea Replacement */}
                    <div className="flex-1 overflow-y-auto pr-4 space-y-4 pb-20">
                        {workflows.map((wf) => (
                            /* Card Replacement */
                            <div key={wf.id} className="rounded-xl border bg-[#111] text-card-foreground shadow border-white/5 p-4 hover:border-[#ccff00]/50 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-lg text-white">Order #{wf.order_no}</h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                                            {/* Badge Replacement */}
                                            <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${getStatusColor(wf.status)}`}>
                                                {wf.status.replace('_', ' ').toUpperCase()}
                                            </span>
                                            <span>• Last action: {new Date(wf.last_action_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                    <Bot className="w-5 h-5 text-gray-600" />
                                </div>

                                {/* Latest Log / Action */}
                                <div className="bg-black/40 rounded p-3 text-sm font-mono text-gray-300 border border-white/5">
                                    {wf.logs && wf.logs.length > 0 ? (
                                        <div className="flex gap-2">
                                            <span className="text-[#ccff00]">{'>'}</span>
                                            {wf.logs[wf.logs.length - 1]}
                                        </div>
                                    ) : (
                                        <span className="text-gray-500 italic">Initializing...</span>
                                    )}
                                </div>
                            </div>
                        ))}

                        {workflows.length === 0 && !loading && (
                            <div className="text-center py-20 text-gray-500">
                                <h3 className="text-lg">Kait is waiting for new assignments...</h3>
                                <p className="text-sm">Assign a supplier to an order to wake her up.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Outbox + Activity */}
                <div className="flex flex-col gap-4 overflow-hidden h-full">

                    {/* Outbox Section (Only Shows if Drafts Exist) */}
                    {drafts.length > 0 && (
                        <div className="flex flex-col gap-2 shrink-0 max-h-[50%]">
                            <h2 className="text-xl font-semibold flex items-center gap-2 text-orange-400">
                                <Mail className="w-5 h-5" />
                                Review Needed ({drafts.length})
                            </h2>
                            <div className="overflow-y-auto space-y-3 pr-2">
                                {drafts.map(draft => (
                                    <div key={draft.id} className="border border-orange-500/30 bg-orange-500/5 rounded-lg p-3 relative group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-orange-300">Order #{draft.payload?.order_id || 'Unknown'}</span>
                                            <span className="text-[10px] text-gray-500">{new Date(draft.created_at).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="text-xs text-gray-300 font-semibold mb-1">To: {draft.to_email}</div>
                                        <div className="text-xs text-white font-bold mb-2">{draft.subject}</div>

                                        {/* Show Reject Input if this draft is being rejected */}
                                        {rejectingId === draft.id ? (
                                            <div className="flex flex-col gap-2 mt-2 bg-black/40 p-2 rounded border border-red-500/30">
                                                <p className="text-[10px] text-red-300 font-semibold">Teach Kait: What's wrong?</p>
                                                <textarea
                                                    className="w-full bg-[#111] border border-white/20 rounded p-1 text-xs text-white"
                                                    rows={2}
                                                    placeholder="e.g. Sonos is supplied by Planetworld..."
                                                    value={feedbackText}
                                                    onChange={(e) => setFeedbackText(e.target.value)}
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => confirmReject(draft.id)}
                                                        className="flex-1 py-1 bg-red-600/80 hover:bg-red-600 text-white text-[10px] font-bold rounded">
                                                        Submit Correction
                                                    </button>
                                                    <button
                                                        onClick={() => { setRejectingId(null); setFeedbackText('') }}
                                                        className="py-1 px-2 bg-gray-700 hover:bg-gray-600 text-white text-[10px] font-bold rounded">
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Draft Content with Expand Toggle */}
                                                <div
                                                    className={`text-xs text-gray-400 italic mb-2 bg-black/20 p-2 rounded whitespace-pre-wrap transition-all cursor-pointer ${expandedId === draft.id ? '' : 'line-clamp-3'
                                                        }`}
                                                    onClick={() => setExpandedId(expandedId === draft.id ? null : draft.id)}
                                                    title="Click to expand/collapse"
                                                >
                                                    {draft.draft_content || "Content preview unavailable"}
                                                </div>

                                                {/* Controls */}
                                                <div className="flex gap-2 items-center">
                                                    <button
                                                        onClick={() => setExpandedId(expandedId === draft.id ? null : draft.id)}
                                                        className="text-[10px] text-gray-500 hover:text-white underline mr-auto"
                                                    >
                                                        {expandedId === draft.id ? 'Show Less' : 'Read More'}
                                                    </button>

                                                    <button
                                                        onClick={() => approveDraft(draft.id)}
                                                        className="flex-1 py-1.5 px-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors">
                                                        <Mail className="w-3 h-3" /> Send
                                                    </button>

                                                    {/* Reject Button */}
                                                    <button
                                                        onClick={() => { setRejectingId(draft.id); setFeedbackText('') }}
                                                        className="py-1.5 px-3 bg-red-900/40 border border-red-500/30 hover:bg-red-900/60 text-red-200 text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors"
                                                        title="Reject & Teach">
                                                        <AlertCircle className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Activity Feed */}
                    <div className="flex flex-col gap-2 overflow-hidden flex-1">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-purple-400" />
                            Activity Stream
                        </h2>
                        {/* Card Replacement */}
                        <div className="rounded-xl border bg-[#111] text-card-foreground shadow border-white/5 p-4 h-full overflow-hidden flex flex-col">
                            {/* ScrollArea Replacement */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="space-y-6 relative border-l border-white/10 ml-3 pl-6 py-2">
                                    {workflows.flatMap(w => w.logs.map(l => ({ log: l, order: w.order_no })))
                                        // sort randomly or by time if we had it parsed, simple reverse for now
                                        .slice(0, 50)
                                        .map((item, i) => (
                                            <div key={i} className="relative">
                                                <div className="absolute -left-[29px] top-1 h-3 w-3 rounded-full bg-[#ccff00] border-2 border-[#111]"></div>
                                                <div className="text-xs text-gray-500 mb-1">Order #{item.order}</div>
                                                <p className="text-sm text-gray-300 leading-snug">{item.log}</p>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
