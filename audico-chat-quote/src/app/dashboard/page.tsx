import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import UploadStatusList from "@/components/dashboard/UploadStatusList"

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const supabase = createServerComponentClient({ cookies })

    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        redirect('/login')
    }

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-white mb-8">Dashboard Overview</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-xl font-semibold text-white mb-4">System Status</h2>
                    <UploadStatusList />
                </div>

                <div className="glass p-6 rounded-2xl border border-white/10">
                    <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
                    <div className="space-y-4">
                        <p className="text-slate-400">Select an action from the sidebar to get started.</p>

                        <div className="grid grid-cols-2 gap-4">
                            <a href="/dashboard/alignment" className="p-4 bg-blue-600/10 border border-blue-600/20 rounded-xl hover:bg-blue-600/20 transition-all">
                                <h3 className="font-semibold text-blue-400">Align Products</h3>
                                <p className="text-sm text-slate-500 mt-1">Match supplier feeds</p>
                            </a>
                            <a href="/dashboard/stock" className="p-4 bg-purple-600/10 border border-purple-600/20 rounded-xl hover:bg-purple-600/20 transition-all">
                                <h3 className="font-semibold text-purple-400">Stock Updates</h3>
                                <p className="text-sm text-slate-500 mt-1">Review price changes</p>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
