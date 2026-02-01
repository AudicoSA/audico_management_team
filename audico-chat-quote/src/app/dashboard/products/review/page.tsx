export const dynamic = "force-dynamic";

import Link from 'next/link'

export default function ReviewPricesPage() {
    return (
        <div className="p-6 bg-[#0a0a0a] min-h-full">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/dashboard/products" className="text-gray-500 hover:text-white transition-colors">
                        ← Back
                    </Link>
                    <h1 className="text-2xl font-semibold text-white">Price Changes Review</h1>
                </div>

                <div className="bg-[#111] border border-white/10 shadow-xl rounded-xl p-12 text-center">
                    <div className="text-6xl mb-4">💰</div>
                    <h2 className="text-xl font-bold text-white mb-2">Coming Soon</h2>
                    <p className="text-gray-400">
                        Price change detection and review will be available in a future update.
                    </p>
                </div>
            </div>
        </div>
    )
}
