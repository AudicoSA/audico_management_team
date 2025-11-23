'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Supplier {
    id: string
    name: string
}

interface PricingRule {
    id: string
    supplier_id: string
    pricing_type: 'cost' | 'retail' | 'mixed'
    default_markup_pct: number
    category_markups: Record<string, number>
    notes: string
}

export default function PricingConfigPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [pricingRules, setPricingRules] = useState<Record<string, PricingRule>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)

        // Fetch MCP suppliers only (those with supplier_type configured)
        const { data: suppliersData } = await supabase
            .from('suppliers')
            .select('id, name')
            .eq('is_active', true)
            .not('supplier_type', 'is', null)
            .order('name')

        // Fetch pricing rules
        const { data: rulesData } = await supabase
            .from('supplier_pricing_rules')
            .select('*')

        setSuppliers(suppliersData || [])

        // Index rules by supplier_id
        const rulesMap: Record<string, PricingRule> = {}
        rulesData?.forEach(rule => {
            rulesMap[rule.supplier_id] = rule
        })
        setPricingRules(rulesMap)

        setLoading(false)
    }

    const saveRule = async (supplierId: string, updates: Partial<PricingRule>) => {
        setSaving(supplierId)

        try {
            // Use upsert to handle both insert and update
            const { error } = await supabase
                .from('supplier_pricing_rules')
                .upsert({
                    supplier_id: supplierId,
                    ...updates
                }, {
                    onConflict: 'supplier_id'
                })

            if (error) {
                console.error('Failed to save pricing rule:', error)
            }

            await fetchData()
        } catch (e) {
            console.error('Save error:', e)
        } finally {
            setSaving(null)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-500">Loading pricing configuration...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Supplier Pricing Configuration</h1>
                    <p className="text-gray-600 mt-2">Configure pricing rules for MCP supplier feeds (cost vs retail, markup percentages)</p>
                </div>

                <div className="space-y-6">
                    {suppliers.map(supplier => {
                        const rule = pricingRules[supplier.id]
                        const pricingType = rule?.pricing_type || 'cost'
                        const markup = rule?.default_markup_pct || 30.0

                        return (
                            <div key={supplier.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-semibold text-gray-900">{supplier.name}</h2>
                                    {saving === supplier.id && (
                                        <span className="text-sm text-blue-600">Saving...</span>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Pricing Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Pricing Type
                                        </label>
                                        <select
                                            value={pricingType}
                                            onChange={(e) => saveRule(supplier.id, {
                                                pricing_type: e.target.value as 'cost' | 'retail' | 'mixed'
                                            })}
                                            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value="cost">Cost Price (needs markup)</option>
                                            <option value="retail">Retail Price (use as-is)</option>
                                            <option value="mixed">Mixed (varies by product)</option>
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {pricingType === 'cost' && 'Supplier provides cost prices - markup will be applied'}
                                            {pricingType === 'retail' && 'Supplier provides retail prices - use directly'}
                                            {pricingType === 'mixed' && 'Some products cost, some retail - configure per product'}
                                        </p>
                                    </div>

                                    {/* Default Markup */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Default Markup %
                                        </label>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max="200"
                                                step="0.1"
                                                value={markup}
                                                onChange={(e) => saveRule(supplier.id, {
                                                    default_markup_pct: parseFloat(e.target.value)
                                                })}
                                                disabled={pricingType === 'retail'}
                                                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                                            />
                                            <span className="text-gray-600">%</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Example: R1,000 cost × {markup}% = R{(1000 * (1 + markup / 100)).toFixed(2)} retail
                                        </p>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Notes
                                    </label>
                                    <textarea
                                        value={rule?.notes || ''}
                                        onChange={(e) => saveRule(supplier.id, { notes: e.target.value })}
                                        placeholder="Add notes about this supplier's pricing..."
                                        rows={2}
                                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Status Indicator */}
                                <div className="mt-4 flex items-center space-x-2">
                                    {rule ? (
                                        <>
                                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                            <span className="text-sm text-gray-600">Configured</span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                                            <span className="text-sm text-gray-600">Using defaults (30% markup)</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {suppliers.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No MCP suppliers found. Please add suppliers first.
                    </div>
                )}
            </div>
        </div>
    )
}
