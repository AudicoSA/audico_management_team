import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { LayoutGrid, ShoppingBag, Package, FileText, Settings, Link2, Bell, Search, PlusCircle, AlertOctagon, Bot } from 'lucide-react'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Audico AI Dashboard',
  description: 'Executive Management System for Audico Online',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#121212] text-white`}>
        <div className="flex min-h-screen">

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
              <NavItem href="/" icon={<LayoutGrid size={22} />} label="Dashboard" />
              <NavItem href="/products" icon={<ShoppingBag size={22} />} label="Products" />
              <NavItem href="/orders" icon={<Package size={22} />} label="Orders" />
              <div className="pt-4 pb-2">
                <p className="hidden lg:block px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Management</p>
                <div className="w-8 h-[1px] bg-white/10 lg:hidden mx-auto mb-2"></div>
              </div>
              <NavItem href="/alignment" icon={<Link2 size={22} />} label="Alignment" />
              <NavItem href="/products/duplicates" icon={<AlertOctagon size={22} />} label="Quality Control" />
              <NavItem href="/kait" icon={<Bot size={22} />} label="Kait's Desk" />
              <NavItem href="/logs" icon={<FileText size={22} />} label="System Logs" />
            </nav>

            {/* Footer / User Profile */}
            <div className="w-full px-4 mt-auto">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3 cursor-pointer hover:bg-white/10 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-lime-400 to-emerald-500"></div>
                <div className="hidden lg:block overflow-hidden">
                  <p className="text-sm font-medium text-white truncate">Admin User</p>
                  <p className="text-xs text-gray-400 truncate">admin@audico.co.za</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 ml-20 lg:ml-64 p-8 overflow-x-hidden">
            {/* Top Header (Search & Notifications) */}
            <header className="flex justify-between items-center mb-10">
              <h1 className="text-2xl font-bold text-white">Overview</h1>

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
      </body>
    </html>
  )
}

function NavItem({ href, icon, label }: { href: string, icon: React.ReactNode, label: string }) {
  // Simple check for active state would require usePathname hook which makes this client component
  // For now, simpler approach is fine or turn this into client component later
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all group"
    >
      <span className="group-hover:text-lime-400 transition-colors">{icon}</span>
      <span className="hidden lg:block font-medium">{label}</span>

      {/* Active Indicator (Conceptual) */}
      {/* <div className="ml-auto w-1.5 h-1.5 rounded-full bg-lime-400 opacity-0 group-hover:opacity-100"></div> */}
    </Link>
  )
}
