'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Package, TrendingUp, Activity, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function Home() {
  const [metrics, setMetrics] = useState({
    emailsToday: 0,
    ordersActive: 0,
    pendingApprovals: 0,
    aiUptime: 99.9
  })

  useEffect(() => {
    // Animate counters
    const timer = setTimeout(() => {
      setMetrics({
        emailsToday: 24,
        ordersActive: 156,
        pendingApprovals: 7,
        aiUptime: 99.9
      })
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  const cards = [
    {
      title: 'Email Queue',
      description: 'AI-powered inbox management',
      icon: Mail,
      href: '/emails',
      color: 'from-blue-500 to-cyan-500',
      stat: `${metrics.pendingApprovals} pending`,
      badge: metrics.pendingApprovals
    },
    {
      title: 'Orders Tracker',
      description: 'Real-time order management',
      icon: Package,
      href: '/orders',
      color: 'from-emerald-500 to-teal-500',
      stat: `${metrics.ordersActive} active`
    },
    {
      title: 'Stock Updates',
      description: 'Gemini-powered price lists',
      icon: TrendingUp,
      href: '/stock',
      color: 'from-violet-500 to-purple-500',
      stat: 'AI extraction ready',
      badge: 'NEW'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Audico AI Command Center
            </h1>
            <p className="mt-3 text-xl text-slate-400">
              Multi-agent operations powered by AI
            </p>
          </motion.div>

          {/* Live Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <MetricCard
              label="Emails Today"
              value={metrics.emailsToday}
              icon={Mail}
              color="text-blue-400"
            />
            <MetricCard
              label="Active Orders"
              value={metrics.ordersActive}
              icon={Package}
              color="text-emerald-400"
            />
            <MetricCard
              label="Pending"
              value={metrics.pendingApprovals}
              icon={Clock}
              color="text-amber-400"
            />
            <MetricCard
              label="AI Uptime"
              value={`${metrics.aiUptime}%`}
              icon={Activity}
              color="text-green-400"
            />
          </motion.div>
        </div>
      </div>

      {/* Main Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
            >
              <Link href={card.href}>
                <div className="group relative glass glass-hover rounded-2xl p-6 cursor-pointer">
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />

                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${card.color}`}>
                      <card.icon className="w-6 h-6 text-white" />
                    </div>
                    {card.badge && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {typeof card.badge === 'number' ? card.badge : card.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-semibold text-white mb-2">
                    {card.title}
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">
                    {card.description}
                  </p>
                  <p className="text-slate-300 font-medium">
                    {card.stat}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Agent Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-12 glass rounded-2xl p-6"
        >
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-400" />
            AI Agent Status
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AgentStatus name="Email Agent" status="active" />
            <AgentStatus name="Orders Agent" status="active" />
            <AgentStatus name="Stock Agent" status="ready" />
            <AgentStatus name="CS Agent" status="idle" />
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

function AgentStatus({ name, status }: { name: string; status: 'active' | 'ready' | 'idle' }) {
  const statusConfig = {
    active: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: CheckCircle2 },
    ready: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Clock },
    idle: { color: 'text-slate-400', bg: 'bg-slate-500/20', icon: AlertCircle }
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div className="flex items-center space-x-3">
      <div className={`p-2 rounded-lg ${config.bg}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-white">{name}</p>
        <p className={`text-xs ${config.color} capitalize`}>{status}</p>
      </div>
    </div>
  )
}
