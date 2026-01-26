'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
    const supabase = createClientComponentClient()
    const [workflows, setWorkflows] = useState<Workflow[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchWorkflows()
        // Poll every 10s for live feel
        const interval = setInterval(fetchWorkflows, 10000)
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return 'bg-blue-500/20 text-blue-400'
            case 'customer_emailed': return 'bg-purple-500/20 text-purple-400'
            case 'supplier_contacted': return 'bg-yellow-500/20 text-yellow-400'
            case 'waiting_reply': return 'bg-orange-500/20 text-orange-400'
            case 'invoiced': return 'bg-indigo-500/20 text-indigo-400'
            case 'paid': return 'bg-green-500/20 text-green-400'
            case 'complete': return 'bg-gray-500/20 text-gray-400'
            default: return 'bg-gray-800 text-gray-400'
        }
    }

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-white p-6 gap-6">

            {/* Header / Persona */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Avatar className="h-16 w-16 border-2 border-[#ccff00]">
                            <AvatarImage src={KAIT_AVATAR_PATH} alt="Kait" />
                            <AvatarFallback>KA</AvatarFallback>
                        </Avatar>
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
                    <Badge variant="outline" className="border-[#ccff00] text-[#ccff00]">
                        Active Workflows: {workflows.length}
                    </Badge>
                </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">

                {/* Active Workflows Column */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Clock className="w-5 h-5 text-[#ccff00]" />
                        Active Orders
                    </h2>

                    <ScrollArea className="h-[calc(100vh-250px)] pr-4">
                        <div className="space-y-4">
                            {workflows.map((wf) => (
                                <Card key={wf.id} className="bg-[#111] border-white/5 p-4 hover:border-[#ccff00]/50 transition-colors">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-lg text-white">Order #{wf.order_no}</h3>
                                            <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                                                <Badge className={getStatusColor(wf.status)}>{wf.status.replace('_', ' ').toUpperCase()}</Badge>
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
                                </Card>
                            ))}

                            {workflows.length === 0 && !loading && (
                                <div className="text-center py-20 text-gray-500">
                                    <h3 className="text-lg">Kait is waiting for new assignments...</h3>
                                    <p className="text-sm">Assign a supplier to an order to wake her up.</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Notifications / Activity Feed (Right Column) */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-purple-400" />
                        Activity Stream
                    </h2>
                    <Card className="bg-[#111] border-white/5 p-4 h-full">
                        <ScrollArea className="h-[calc(100vh-250px)]">
                            <div className="space-y-6 relative border-l border-white/10 ml-3 pl-6 py-2">
                                {workflows.flatMap(w => w.logs.map(l => ({ log: l, order: w.order_no })))
                                    .sort((a, b) => -1) // Reverse logic needed if logs contain timestamps, currently simplistic
                                    .slice(0, 20)
                                    .map((item, i) => (
                                        <div key={i} className="relative">
                                            <div className="absolute -left-[29px] top-1 h-3 w-3 rounded-full bg-[#ccff00] border-2 border-[#111]"></div>
                                            <div className="text-xs text-gray-500 mb-1">Order #{item.order}</div>
                                            <p className="text-sm text-gray-300 leading-snug">{item.log}</p>
                                        </div>
                                    ))}
                            </div>
                        </ScrollArea>
                    </Card>
                </div>

            </div>
        </div>
    )
}
