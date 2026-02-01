export const dynamic = "force-dynamic";

import Link from 'next/link'

export default function ProductsPage() {
    const sections = [
        {
            title: '🆕 New Products Discovery',
            description: 'Review and approve new products found in supplier pricelists.',
            href: '/dashboard/products/new',
            color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            icon: '✨'
        },
        {
            title: '📝 Price Changes',
            description: 'Review and approve price changes detected from suppliers.',
            href: '/dashboard/products/review',
            color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            icon: '💰'
        },
        {
            title: '📤 Import Pricelist',
            description: 'Upload new supplier pricelists (PDF, Excel, CSV).',
            href: '/dashboard/products/import',
            color: 'bg-green-500/20 text-green-400 border-green-500/30',
            icon: '📁'
        },
        {
            title: '⚠️ Duplicates',
            description: 'Manage and merge duplicate products.',
            href: '/dashboard/products/duplicates',
            color: 'bg-red-500/20 text-red-400 border-red-500/30',
            icon: '🔄'
        }
    ]

    return (
        <div className="p-6 bg-[#0a0a0a] min-h-full">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-white">Product Management</h1>
                    <Link
                        href="/dashboard/feeds"
                        className="inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                    >
                        <span className="mr-2">🔌</span>
                        Manage Feeds
                    </Link>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
                    {sections.map((section) => (
                        <Link
                            key={section.href}
                            href={section.href}
                            className="block group"
                        >
                            <div className="bg-[#111] overflow-hidden shadow-xl rounded-xl hover:shadow-2xl transition-all duration-200 border border-white/10 h-full hover:border-white/20">
                                <div className="p-6 flex items-start space-x-4">
                                    <div className={`flex-shrink-0 p-3 rounded-lg border ${section.color} text-2xl`}>
                                        {section.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-medium text-white group-hover:text-blue-400 transition-colors">
                                            {section.title}
                                        </h3>
                                        <p className="mt-1 text-sm text-gray-400">
                                            {section.description}
                                        </p>
                                    </div>
                                    <div className="self-center">
                                        <svg className="h-5 w-5 text-gray-600 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
