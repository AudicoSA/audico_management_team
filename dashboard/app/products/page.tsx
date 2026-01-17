import Link from 'next/link'

export default function ProductsPage() {
    const sections = [
        {
            title: '🆕 New Products Discovery',
            description: 'Review and approve new products found in supplier pricelists.',
            href: '/products/new',
            color: 'bg-blue-50 text-blue-700',
            icon: '✨'
        },
        {
            title: '📝 Price Changes',
            description: 'Review and approve price changes detected from suppliers.',
            href: '/products/review',
            color: 'bg-yellow-50 text-yellow-700',
            icon: '💰'
        },
        {
            title: '📤 Import Pricelist',
            description: 'Upload new supplier pricelists (PDF, Excel, CSV).',
            href: '/products/import',
            color: 'bg-green-50 text-green-700',
            icon: '📁'
        },
        {
            title: '⚠️ Duplicates',
            description: 'Manage and merge duplicate products.',
            href: '/products/duplicates',
            color: 'bg-red-50 text-red-700',
            icon: '🔄'
        }
    ]

    return (
        <div className="py-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Product Management</h1>
                    <Link
                        href="/feeds"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
                            <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200 border border-gray-200 h-full">
                                <div className="p-6 flex items-start space-x-4">
                                    <div className={`flex-shrink-0 p-3 rounded-lg ${section.color} text-2xl`}>
                                        {section.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                                            {section.title}
                                        </h3>
                                        <p className="mt-1 text-sm text-gray-500">
                                            {section.description}
                                        </p>
                                    </div>
                                    <div className="self-center">
                                        <svg className="h-5 w-5 text-gray-400 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
