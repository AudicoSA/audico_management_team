'use client'

import { useState, useEffect } from 'react'
import { supabaseClient as supabase } from '@/lib/supabase'

interface Supplier {
    id: string
    name: string
    company: string
    street_address: string
    local_area: string
    city: string
    code: string
    country_code: string
    contact_name?: string
    contact_email?: string
    contact_phone?: string
}

interface BookShipmentModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (address: any, dryRun: boolean, supplierInvoice: string, supplierName?: string) => void
    orderId: string
    loading: boolean
    initialSupplierInvoice?: string
    initialSupplier?: string
}

export default function BookShipmentModal({ isOpen, onClose, onConfirm, orderId, loading, initialSupplierInvoice, initialSupplier }: BookShipmentModalProps) {
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('custom')
    const [saveAsNew, setSaveAsNew] = useState(false)
    const [newSupplierName, setNewSupplierName] = useState('')
    const [dryRun, setDryRun] = useState(true)
    const [supplierInvoice, setSupplierInvoice] = useState('')

    const [address, setAddress] = useState({
        company: 'Audico Online',
        street_address: 'Audiovisual House, 58b Maple Road',
        local_area: 'Pomona',
        city: 'Kempton Park',
        code: '1619',
        country_code: 'ZA'
    })

    const [contactInfo, setContactInfo] = useState({
        name: '',
        email: '',
        phone: ''
    })

    useEffect(() => {
        if (isOpen) {
            setSupplierInvoice(initialSupplierInvoice || '')
            loadAndSelectSupplier(initialSupplier)
        }
    }, [isOpen, initialSupplierInvoice, initialSupplier])

    const loadAndSelectSupplier = async (preselectName?: string) => {
        const { data, error } = await supabase
            .from('supplier_addresses')
            .select('*')
            .order('name')

        if (error) {
            console.error('Error fetching suppliers:', error)
            return
        }

        if (data) {
            setSuppliers(data)

            if (preselectName) {
                let match = data.find((s: Supplier) => s.name.toLowerCase() === preselectName.toLowerCase())
                if (!match) match = data.find((s: Supplier) => s.company?.toLowerCase() === preselectName.toLowerCase())
                if (!match) match = data.find((s: Supplier) => s.name.toLowerCase().includes(preselectName.toLowerCase()))

                if (match) {
                    setSelectedSupplierId(match.id)
                    setAddress({
                        company: match.company,
                        street_address: match.street_address,
                        local_area: match.local_area,
                        city: match.city,
                        code: match.code,
                        country_code: match.country_code
                    })
                    setContactInfo({
                        name: match.contact_name || '',
                        email: match.contact_email || '',
                        phone: match.contact_phone || ''
                    })
                    setSaveAsNew(false)
                }
            }
        }
    }

    const handleSupplierChange = (supplierId: string) => {
        setSelectedSupplierId(supplierId)
        if (supplierId === 'custom') {
            setAddress({
                company: '',
                street_address: '',
                local_area: '',
                city: '',
                code: '',
                country_code: 'ZA'
            })
            setContactInfo({ name: '', email: '', phone: '' })
            return
        }

        const supplier = suppliers.find(s => s.id === supplierId)
        if (supplier) {
            setAddress({
                company: supplier.company,
                street_address: supplier.street_address,
                local_area: supplier.local_area,
                city: supplier.city,
                code: supplier.code,
                country_code: supplier.country_code
            })
            setContactInfo({
                name: supplier.contact_name || '',
                email: supplier.contact_email || '',
                phone: supplier.contact_phone || ''
            })
            setSaveAsNew(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (saveAsNew && newSupplierName) {
            const { error } = await supabase.from('supplier_addresses').insert({
                name: newSupplierName,
                company: address.company,
                street_address: address.street_address,
                local_area: address.local_area,
                city: address.city,
                code: address.code,
                country_code: address.country_code,
                contact_name: contactInfo.name,
                contact_email: contactInfo.email,
                contact_phone: contactInfo.phone
            })

            if (error) {
                console.error('Failed to save supplier:', error)
                alert('Failed to save new supplier, but proceeding with booking.')
            } else {
                loadAndSelectSupplier()
            }
        }

        let finalSupplierName = ''
        if (saveAsNew && newSupplierName) {
            finalSupplierName = newSupplierName
        } else if (selectedSupplierId !== 'custom') {
            const s = suppliers.find(s => s.id === selectedSupplierId)
            if (s) finalSupplierName = s.name
        } else {
            finalSupplierName = address.company
        }

        onConfirm(address, dryRun, supplierInvoice, finalSupplierName)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-[#1c1c1c] border border-white/10 rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4 text-white">Book Shipment for Order #{orderId}</h2>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">

                        <div>
                            <label className="block text-sm font-medium text-gray-400">Supplier Invoice (Customer Reference)</label>
                            <input
                                type="text"
                                value={supplierInvoice}
                                onChange={e => setSupplierInvoice(e.target.value)}
                                placeholder="e.g. ORD123456"
                                className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-white focus:border-blue-500 focus:outline-none sm:text-sm"
                                required
                            />
                        </div>

                        <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                            <label className="block text-sm font-medium text-gray-400 mb-2">Load from Address Book</label>
                            <select
                                value={selectedSupplierId}
                                onChange={(e) => handleSupplierChange(e.target.value)}
                                className="block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-white focus:border-blue-500 focus:outline-none sm:text-sm"
                            >
                                <option value="custom">-- Select a Supplier --</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.city})</option>
                                ))}
                            </select>
                        </div>

                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider pt-2">Collection Address (From)</h3>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400">Contact Name</label>
                                <input
                                    type="text"
                                    value={contactInfo.name}
                                    onChange={e => setContactInfo({ ...contactInfo, name: e.target.value })}
                                    className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-white sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400">Email</label>
                                <input
                                    type="email"
                                    value={contactInfo.email}
                                    onChange={e => setContactInfo({ ...contactInfo, email: e.target.value })}
                                    className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-white sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400">Phone</label>
                                <input
                                    type="tel"
                                    value={contactInfo.phone}
                                    onChange={e => setContactInfo({ ...contactInfo, phone: e.target.value })}
                                    className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-white sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400">Company / Supplier</label>
                            <input
                                type="text"
                                value={address.company}
                                onChange={e => setAddress({ ...address, company: e.target.value })}
                                className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-white sm:text-sm"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400">Street Address</label>
                            <input
                                type="text"
                                value={address.street_address}
                                onChange={e => setAddress({ ...address, street_address: e.target.value })}
                                className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-white sm:text-sm"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400">City</label>
                                <input
                                    type="text"
                                    value={address.city}
                                    onChange={e => setAddress({ ...address, city: e.target.value })}
                                    className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-white sm:text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400">Postal Code</label>
                                <input
                                    type="text"
                                    value={address.code}
                                    onChange={e => setAddress({ ...address, code: e.target.value })}
                                    className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-white sm:text-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400">Area / Suburb</label>
                                <input
                                    type="text"
                                    value={address.local_area}
                                    onChange={e => setAddress({ ...address, local_area: e.target.value })}
                                    className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-white sm:text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400">Country Code</label>
                                <input
                                    type="text"
                                    value={address.country_code}
                                    onChange={e => setAddress({ ...address, country_code: e.target.value })}
                                    className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-white sm:text-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-white/10">
                            <div className="flex items-center">
                                <input
                                    id="save-new"
                                    type="checkbox"
                                    checked={saveAsNew}
                                    onChange={(e) => setSaveAsNew(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-[#111]"
                                />
                                <label htmlFor="save-new" className="ml-2 block text-sm text-white">
                                    Save as new supplier
                                </label>
                            </div>

                            {saveAsNew && (
                                <div className="mt-2">
                                    <input
                                        type="text"
                                        value={newSupplierName}
                                        onChange={e => setNewSupplierName(e.target.value)}
                                        placeholder="e.g. Rectron JHB"
                                        className="block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-white sm:text-sm"
                                        required={saveAsNew}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-white/10">
                            <div className="flex items-center">
                                <input
                                    id="dry-run"
                                    type="checkbox"
                                    checked={dryRun}
                                    onChange={(e) => setDryRun(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-[#111]"
                                />
                                <label htmlFor="dry-run" className="ml-2 block text-sm text-white font-medium">
                                    Test Mode (Dry Run)
                                </label>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 ml-6">
                                If checked, no actual shipment will be created with the courier.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-gray-400 hover:bg-white/5"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? 'Booking...' : 'Confirm Booking'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
