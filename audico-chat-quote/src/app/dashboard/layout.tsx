"use client";

export const dynamic = "force-dynamic";

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
    LayoutGrid,
    ShoppingBag,
    Package,
    FileText,
    Link2,
    Bell,
    Search,
    AlertOctagon,
    Bot,
    LogOut,
    Rss,
    BarChart2
} from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()

    // Only create Supabase client on the client side
    const supabase = useMemo(() => {
        if (typeof window === "undefined") return null;
        return createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
    }, []);

    const handleSignOut = async () => {
        if (!supabase) return;
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <div className="flex min-h-screen bg-[#121212] text-white">
            {/* Sidebar */}
            <aside className="fixed left-0 top-0 h-screen w-20 lg:w-64 bg-[#1c1c1c] border-r border-white/5 flex flex-col items-center lg:items-start py-8 z-50 transition-all duration-300">
                {/* Logo */}
                <div className="px-6 mb-12 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-lime-400 flex items-center justify-center text-black font-bold text-xl shadow-[0_0_20px_rgba(163,230,53,0.3)]">
                        A
                    </div>
                    <span className="hidden lg:block text-xl font-bold tracking-tight text-white">Audico AI</span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 w-full px-4 space-y-2">
                    <NavItem href="/dashboard" icon={<LayoutGrid size={22} />} label="Dashboard" active={pathname === '/dashboard'} />
                    <NavItem href="/dashboard/products" icon={<ShoppingBag size={22} />} label="Products" active={pathname?.startsWith('/dashboard/products')} />
                    <NavItem href="/dashboard/orders" icon={<Package size={22} />} label="Orders" active={pathname === '/dashboard/orders'} />

                    <div className="pt-4 pb-2">
                        <p className="hidden lg:block px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Management</p>
                        <div className="w-8 h-[1px] bg-white/10 lg:hidden mx-auto mb-2"></div>
                    </div>

                    <NavItem href="/dashboard/alignment" icon={<Link2 size={22} />} label="Alignment" active={pathname === '/dashboard/alignment'} />
                    <NavItem href="/dashboard/stock" icon={<BarChart2 size={22} />} label="Stock Updates" active={pathname === '/dashboard/stock'} />
                    <NavItem href="/dashboard/kait" icon={<Bot size={22} />} label="Kait's Desk" active={pathname === '/dashboard/kait'} />
                    <NavItem href="/dashboard/logs" icon={<FileText size={22} />} label="System Logs" active={pathname === '/dashboard/logs'} />
                    <NavItem href="/dashboard/feeds" icon={<Rss size={22} />} label="Feeds" active={pathname === '/dashboard/feeds'} />
                </nav>

                {/* Footer / User Profile */}
                <div className="w-full px-4 mt-auto space-y-2">
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                        <LogOut size={20} />
                        <span className="hidden lg:block font-medium">Sign Out</span>
                    </button>
                    <Link
                        href="/"
                        className="flex items-center justify-center lg:justify-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-lime-400 to-emerald-500"></div>
                        <div className="hidden lg:block overflow-hidden">
                            <p className="text-xs text-gray-400 truncate">Back to Chat Quote</p>
                        </div>
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-20 lg:ml-64 p-8 overflow-x-hidden">
                {/* Top Header */}
                <header className="flex justify-between items-center mb-10">
                    <h1 className="text-2xl font-bold text-white">
                        {getPageTitle(pathname)}
                    </h1>

                    <div className="flex items-center gap-4">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="bg-[#1c1c1c] border border-white/5 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50 w-64 transition-all placeholder:text-gray-600"
                            />
                        </div>
                        <button className="relative p-2 rounded-full bg-[#1c1c1c] text-gray-400 hover:text-white transition-colors border border-white/5">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-lime-500"></span>
                        </button>
                    </div>
                </header>

                {children}
            </main>
        </div>
    )
}

function NavItem({ href, icon, label, active }: { href: string, icon: React.ReactNode, label: string, active?: boolean }) {
    return (
        <Link
            href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${active
                    ? 'bg-lime-500/10 text-lime-400 border-l-2 border-lime-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
        >
            <span className={`transition-colors ${active ? 'text-lime-400' : 'group-hover:text-lime-400'}`}>{icon}</span>
            <span className="hidden lg:block font-medium">{label}</span>
        </Link>
    )
}

function getPageTitle(pathname: string | null): string {
    if (!pathname) return 'Dashboard';
    if (pathname === '/dashboard') return 'Overview';
    if (pathname.startsWith('/dashboard/products')) return 'Products';
    if (pathname === '/dashboard/orders') return 'Orders';
    if (pathname === '/dashboard/alignment') return 'Product Alignment';
    if (pathname === '/dashboard/stock') return 'Stock Updates';
    if (pathname === '/dashboard/kait') return "Kait's Desk";
    if (pathname === '/dashboard/logs') return 'System Logs';
    if (pathname === '/dashboard/feeds') return 'Feed Management';
    return 'Dashboard';
}
