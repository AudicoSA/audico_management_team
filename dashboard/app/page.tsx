'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Package, TrendingUp, Activity, CheckCircle2, Clock, AlertCircle, ArrowUpRight, Plus, CreditCard } from 'lucide-react'
import { useEffect, useState } from 'react'
import ChatWidget from './components/ChatWidget'

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

  return (
    <div className="space-y-8">
      {/* Welcome & Credit Card Section (Imitating the reference layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Welcome Content */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between"
          >
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">Good Afternoon, Admin!</h2>
              <p className="text-gray-400 mt-1">Here is what's happening with your operations today.</p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-[#1c1c1c] hover:bg-[#2c2c2c] text-white text-sm font-medium rounded-xl border border-white/5 transition-colors">
                Manage Widgets
              </button>
              <button className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black text-sm font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(163,230,53,0.3)]">
                + Add Widget
              </button>
            </div>
          </motion.div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              label="Pending Emails"
              value={metrics.pendingApprovals}
              subtext="+15% from yesterday"
              icon={Mail}
              trend="up"
            />
            <StatCard
              label="Active Orders"
              value={metrics.ordersActive}
              subtext="Processing normally"
              icon={Package}
              trend="neutral"
            />
            <StatCard
              label="System Health"
              value="99.9%"
              subtext="AI Agents Operational"
              icon={Activity}
              trend="up"
              accent
            />
          </div>

          {/* Activity Graph Replaced by Ask Kait Chat */}
          <ChatWidget />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LinkCard
              title="Email Queue"
              desc="Manage customer inquiries"
              href="/emails"
              icon={Mail}
            />
            <LinkCard
              title="Product Catalog"
              desc="Manage stock and prices"
              href="/products"
              icon={Package}
            />
          </div>
        </div>

        {/* Right Column: "Card" Style Widgets */}
        <div className="space-y-6">
          {/* Agent Status Block */}
          <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-white">Agent Status</h3>
              <Activity size={18} className="text-lime-400" />
            </div>
            <div className="space-y-4">
              <AgentRow name="Email Agent" status="active" />
              <AgentRow name="Orders Agent" status="active" />
              <AgentRow name="Stock Agent" status="idle" />
              <AgentRow name="CS Agent" status="idle" />
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-gray-400">Daily Token Limit</span>
                <span className="text-white font-medium">$12.40 / $20.00</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full w-[62%] bg-gradient-to-r from-lime-400 to-emerald-400"></div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="p-3 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors border border-white/5 text-sm font-medium text-gray-300 hover:text-white hover:border-lime-500/30">
                <Plus size={20} className="text-lime-400" />
                New Product
              </button>
              <button className="p-3 bg-white/5 hover:bg-white/10 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors border border-white/5 text-sm font-medium text-gray-300 hover:text-white hover:border-lime-500/30">
                <ArrowUpRight size={20} className="text-lime-400" />
                Sync Stock
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, subtext, icon: Icon, trend, accent }: any) {
  return (
    <div className={`p-6 rounded-2xl border ${accent ? 'bg-gradient-to-br from-[#1c1c1c] to-[#252525] border-lime-500/20' : 'bg-[#1c1c1c] border-white/5'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${accent ? 'bg-lime-400 text-black' : 'bg-white/5 text-gray-400'}`}>
          <Icon size={20} />
        </div>
        {trend === 'up' && (
          <span className="text-xs font-medium text-lime-400 bg-lime-400/10 px-2 py-1 rounded-full flex items-center gap-1">
            <TrendingUp size={12} /> +12%
          </span>
        )}
      </div>
      <p className="text-gray-400 text-sm">{label}</p>
      <h3 className="text-2xl font-bold text-white mt-1">{value}</h3>
      <p className="text-xs text-gray-500 mt-2">{subtext}</p>
    </div>
  )
}

function LinkCard({ title, desc, href, icon: Icon }: any) {
  return (
    <Link href={href} className="group p-6 bg-[#1c1c1c] border border-white/5 rounded-2xl hover:bg-[#252525] transition-all flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-lime-400/20 group-hover:text-lime-400 transition-colors">
          <Icon size={20} />
        </div>
        <div>
          <h4 className="font-semibold text-white group-hover:text-lime-400 transition-colors">{title}</h4>
          <p className="text-sm text-gray-400">{desc}</p>
        </div>
      </div>
      <ArrowUpRight size={18} className="text-gray-600 group-hover:text-lime-400 transition-colors" />
    </Link>
  )
}

function AgentRow({ name, status }: any) {
  const isIdle = status === 'idle'
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${isIdle ? 'bg-gray-500' : 'bg-lime-400 animate-pulse'}`}></div>
        <span className="text-sm font-medium text-white">{name}</span>
      </div>
      <span className={`text-xs px-2 py-1 rounded-md ${isIdle ? 'bg-gray-800 text-gray-400' : 'bg-lime-400/10 text-lime-400'}`}>
        {status}
      </span>
    </div>
  )
}
