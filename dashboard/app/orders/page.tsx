'use client'

import { useState, useEffect } from 'react'
import { supabase, type OrderTracker } from '@/lib/supabase'

import BookShipmentModal from '@/components/BookShipmentModal'

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderTracker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ orderId: string, field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [showCompleted, setShowCompleted] = useState(false)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedOrderForBooking, setSelectedOrderForBooking] = useState<string | null>(null)
  const [bookingLoading, setBookingLoading] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('orders_tracker')
        .select('*')
        .order('order_no', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Supabase error:', error)
        setError(error.message || 'Failed to fetch orders')
        return
      }
      setOrders(data || [])
    } catch (error) {
      console.error('Error fetching orders:', error)
      setError('Failed to connect to database')
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (orderId: string, field: string, currentValue: any) => {
    setEditingCell({ orderId, field })
    setEditValue(currentValue?.toString() || '')
  }

  const saveEdit = async (orderId: string, field: string) => {
    try {
      const updateData: any = {}

      // Parse value based on field type
      if (['cost', 'supplier_amount', 'shipping', 'profit'].includes(field)) {
        updateData[field] = editValue ? parseFloat(editValue.replace(/[R,\s]/g, '')) : null
      } else if (['owner_wade', 'owner_lucky', 'owner_kenny', 'owner_accounts', 'flag_done', 'flag_urgent', 'order_paid'].includes(field)) {
        updateData[field] = editValue.toLowerCase() === 'true' || editValue === '1'
      } else {
        updateData[field] = editValue || null
      }

      console.log('Updating order:', orderId, 'with data:', updateData)

      const { error, data } = await supabase
        .from('orders_tracker')
        .update(updateData)
        .eq('order_no', orderId)
        .select()

      console.log('Supabase response:', { error, data, hasError: !!error })

      // Check if error exists and has actual content
      if (error && (error.message || error.details || error.code)) {
        console.error('Supabase error details:', {
          error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw new Error(error.message || error.details || 'Update failed')
      }

      // If no error but also no data, something went wrong
      if (!data || data.length === 0) {
        console.warn('Update returned no data, but no error either')
      }

      console.log('Update successful:', data)

      // Update local state
      setOrders(orders.map(o =>
        o.order_no === orderId ? { ...o, ...updateData } : o
      ))

      setEditingCell(null)
    } catch (err: any) {
      console.error('Failed to update:', err)
      alert(`Failed to update: ${err.message || 'Unknown error'}`)
    }
  }

  const toggleOwner = async (orderId: string, field: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('orders_tracker')
        .update({ [field]: !currentValue })
        .eq('order_no', orderId)

      if (error) throw error

      setOrders(orders.map(o =>
        o.order_no === orderId ? { ...o, [field]: !currentValue } : o
      ))
    } catch (err) {
      console.error('Failed to toggle:', err)
    }
  }

  const openBookingModal = (orderId: string) => {
    setSelectedOrderForBooking(orderId)
    setIsModalOpen(true)
  }

  const handleConfirmBooking = async (collectionAddress: any, dryRun: boolean, supplierInvoice: string, supplierName?: string) => {
    if (!selectedOrderForBooking) return

    setBookingLoading(true)
    try {
      // Optimistic Update of Supplier if changed
      if (supplierName) {
        setOrders(orders.map(o =>
          o.order_no === selectedOrderForBooking ? { ...o, supplier: supplierName } : o
        ))
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/shipments/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrderForBooking,
          dry_run: dryRun,
          collection_address: collectionAddress,
          supplier_invoice: supplierInvoice,
          supplier_name: supplierName // Pass to backend
        })
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.detail || 'Failed to create shipment')

      console.log('Shipment created result:', result)
      alert(`Shipment created! Tracking: ${result.shipment.tracking_number}`)
      setIsModalOpen(false)
      fetchOrders() // Refresh

    } catch (err: any) {
      console.error('Shipment booking failed:', err)
      alert(`Failed: ${err.message}`)
    } finally {
      setBookingLoading(false)
    }
  }

  const EditableCell = ({ order, field, value, type = 'text' }: any) => {
    const isEditing = editingCell?.orderId === order.order_no && editingCell?.field === field

    if (isEditing) {
      return (
        <input
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveEdit(order.order_no, field)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveEdit(order.order_no, field)
            if (e.key === 'Escape') setEditingCell(null)
          }}
          className="w-full px-1 py-0.5 bg-[#2c2c2c] text-white text-xs border border-lime-400 rounded focus:outline-none focus:ring-1 focus:ring-lime-400"
          autoFocus
        />
      )
    }

    return (
      <div
        onClick={() => startEdit(order.order_no, field, value)}
        className="cursor-pointer hover:bg-white/10 px-1 py-0.5 rounded min-h-[20px] transition-colors"
        title="Click to edit"
      >
        {value || <span className="text-gray-600">-</span>}
      </div>
    )
  }

  const OwnerCheckbox = ({ order, field, label, color }: any) => {
    const checked = order[field]
    return (
      <td
        onClick={() => toggleOwner(order.order_no, field, checked)}
        className={`text-center py-1 cursor-pointer hover:brightness-110 transition-all border-l border-white/5 ${checked ? color : 'bg-transparent text-gray-700'
          }`}
        title={`Toggle ${label}`}
      >
        {checked ? '✓' : '·'}
      </td>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders Tracker</h1>
          <p className="text-gray-400 text-xs mt-1">Compact view for high-density management</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${showCompleted
              ? 'bg-lime-400 text-black border-lime-400'
              : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
              }`}
          >
            {showCompleted ? 'Hide Completed' : 'Show Completed'}
          </button>
          <button
            onClick={fetchOrders}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-xs font-medium transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400"></div>
        </div>
      ) : (
        <div className="bg-[#1c1c1c] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-black/40 text-gray-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-2 border-b border-white/5 w-16">No.</th>
                  <th className="p-2 border-b border-white/5 max-w-[120px]">Customer</th>
                  <th className="p-2 border-b border-white/5 max-w-[200px]">Products</th>
                  <th className="p-2 border-b border-white/5 w-24">Supplier</th>
                  <th className="p-2 border-b border-white/5 text-right w-20">Cost</th>
                  <th className="p-2 border-b border-white/5 w-20">Inv #</th>
                  <th className="p-2 border-b border-white/5 w-20">Sup Inv</th>
                  <th className="p-2 border-b border-white/5 text-right w-20">Sup Amt</th>
                  <th className="p-2 border-b border-white/5 w-24">Status</th>
                  <th className="p-2 border-b border-white/5 text-center w-10" title="Paid">Pd</th>
                  <th className="p-2 border-b border-white/5 text-right w-20">Ship</th>
                  <th className="p-2 border-b border-white/5 text-right w-20">Profit</th>
                  <th className="p-2 border-b border-white/5 text-center w-16">Act</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {orders
                  .filter(order => (showCompleted || (!order.flag_done && order.supplier_status !== 'Complete')) && !['Cancelled', 'Missing'].includes(order.supplier_status || ''))
                  .map((order, idx) => (
                    <tr key={order.order_no} className={`hover:bg-white/5 transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}`}>
                      <td className="p-2 font-mono text-gray-500">{order.order_no}</td>
                      <td className="p-2 max-w-[120px]">
                        <div className="truncate font-medium text-white" title={order.order_name || ''}>
                          {order.order_name?.split(' ')[0] || '-'}
                        </div>
                      </td>
                      <td className="p-2 max-w-[250px]">
                        <div className="truncate text-gray-500 text-[10px]" title={order.notes || ''}>
                          {order.notes || '-'}
                        </div>
                      </td>
                      <td className="p-2 truncate max-w-[100px]" title={order.supplier || ''}>
                        <EditableCell order={order} field="supplier" value={order.supplier} />
                      </td>
                      <td className="p-2 text-right font-mono text-gray-400">
                        {order.cost ? `R${order.cost.toFixed(0)}` : '-'}
                      </td>
                      <td className="p-2">
                        <EditableCell order={order} field="invoice_no" value={order.invoice_no} />
                      </td>
                      <td className="p-2">
                        <EditableCell order={order} field="supplier_invoice_no" value={order.supplier_invoice_no} />
                      </td>
                      <td className="p-2 text-right font-mono">
                        <EditableCell order={order} field="supplier_amount" value={order.supplier_amount ? `R${order.supplier_amount.toFixed(0)}` : null} type="number" />
                      </td>
                      <td className="p-2">
                        <div className={`truncate px-1.5 py-0.5 rounded text-[10px] inline-block ${order.supplier_status === 'Shipped' ? 'bg-green-500/20 text-green-400' :
                          order.supplier_status === 'Pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-gray-400'
                          }`}>
                          <EditableCell order={order} field="supplier_status" value={order.supplier_status} />
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <div
                          onClick={() => toggleOwner(order.order_no, 'order_paid', order.order_paid ?? false)}
                          className={`cursor-pointer transition-transform hover:scale-110 ${order.order_paid ? 'text-green-400 font-bold' : 'text-gray-700'
                            }`}
                        >
                          {order.order_paid ? '✓' : '○'}
                        </div>
                      </td>
                      <td className="p-2 text-right font-mono text-gray-500">
                        <EditableCell order={order} field="shipping" value={order.shipping ? `R${order.shipping.toFixed(0)}` : null} type="number" />
                      </td>
                      <td className={`p-2 text-right font-mono font-bold ${order.profit && order.profit > 0 ? 'text-lime-400' :
                        order.profit && order.profit < 0 ? 'text-red-400' : 'text-gray-600'
                        }`}>
                        {order.profit ? `R${order.profit.toFixed(0)}` : '-'}
                      </td>
                      <td className="p-2 text-center">
                        {order.supplier_status !== 'Shipped' && (
                          <button
                            onClick={() => openBookingModal(order.order_no)}
                            disabled={order.supplier_status === 'Awaiting Payment' || order.supplier_status === 'Cancelled'}
                            className={`p-1 rounded transition-colors ${order.supplier_status === 'Awaiting Payment' || order.supplier_status === 'Cancelled'
                              ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                              : 'bg-blue-600/20 hover:bg-blue-600/40 text-blue-400'
                              }`}
                            title={order.supplier_status === 'Awaiting Payment' ? 'Order not paid' : order.supplier_status === 'Cancelled' ? 'Order cancelled' : 'Book Shipment (Dry Run)'}
                          >
                            ✈
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-white/5 text-xs text-gray-500 bg-black/20 flex justify-between">
            <p>Showing {orders.filter(o => showCompleted || !o.flag_done).length} orders</p>
            <p>Compact Mode Active</p>
          </div>
        </div>
      )
      }

      <BookShipmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmBooking}
        orderId={selectedOrderForBooking || ''}
        loading={bookingLoading}
        initialSupplierInvoice={
          orders.find(o => o.order_no === selectedOrderForBooking)?.supplier_invoice_no ||
          orders.find(o => o.order_no === selectedOrderForBooking)?.invoice_no ||
          undefined
        }
        initialSupplier={orders.find(o => o.order_no === selectedOrderForBooking)?.supplier || undefined}
      />
    </div >
  )
}
