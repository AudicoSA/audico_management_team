"use client";

import { useState } from 'react'
import { Link2, Box, BarChart2, Truck, Upload, LogOut, LayoutDashboard, Settings } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Alignment', href: '/dashboard/alignment', icon: Link2 },
        { name: 'Stock Updates', href: '/dashboard/stock', icon: BarChart2 },
        // Add more items as we migrate them
    ]

    return (
        <div className="flex h-screen bg-[#0a0a0a]">
            {/* Sidebar */}
            <div className="w-64 border-r border-white/10 bg-[#0a0a0a] flex flex-col">
                <div className="p-6">
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">A</span>
                        Audico AI
                    </h1>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <a
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.name}
                            </a>
                        )
                    })}
                </nav>

                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                    <a href="/" className="flex items-center gap-3 px-4 py-3 mt-2 text-slate-500 hover:text-white transition-colors text-sm">
                        Back to Chat Quote
                    </a>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                {children}
            </div>
        </div>
    )
}
