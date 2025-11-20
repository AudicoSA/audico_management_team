'use client'

import { useState, useEffect } from 'react'
import { supabase, type OrderTracker } from '@/lib/supabase'

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderTracker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ orderId: string, field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [showCompleted, setShowCompleted] = useState(false)

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



  const bookShipment = async (orderId: string) => {
    if (!confirm(`Are you sure you want to book a shipment for Order #${orderId}? (Dry Run)`)) return

    try {
      const response = await fetch('http://localhost:8000/shipments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, dry_run: true })
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.detail || 'Failed to create shipment')

      alert(`Shipment created! Tracking: ${result.shipment.tracking_number}`)
      fetchOrders() // Refresh

    } catch (err: any) {
      console.error('Shipment booking failed:', err)
      alert(`Failed: ${err.message}`)
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
          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        />
      )
    }

    return (
      <div
        onClick={() => startEdit(order.order_no, field, value)}
        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded min-h-[24px]"
        title="Click to edit"
      >
        {value || <span className="text-gray-300">-</span>}
      </div>
    )
  }

  const OwnerCheckbox = ({ order, field, label, color }: any) => {
    const checked = order[field]
    return (
      <td
        onClick={() => toggleOwner(order.order_no, field, checked)}
        className={`text-center py-1 cursor-pointer hover:opacity-75 transition-opacity border-r border-gray-200 ${checked ? color : 'bg-gray-50'
          }`}
        title={`Toggle ${label}`}
      >
        {checked && '✓'}
      </td>
    )
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders Tracker</h1>
          <p className="text-gray-600 text-sm mt-1">Excel-style order management</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`px-4 py-2 rounded text-sm ${showCompleted
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
          >
            {showCompleted ? 'Hide Completed' : 'Show Completed'}
          </button>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-medium border-r border-gray-700">ORDER NO</th>
                  <th className="px-3 py-2 text-left font-medium border-r border-gray-700">ORDER NAME</th>
                  <th className="px-3 py-2 text-left font-medium border-r border-gray-700">SUPPLIER</th>
                  <th className="px-3 py-2 text-left font-medium border-r border-gray-700">NOTES</th>
                  <th className="px-3 py-2 text-right font-medium border-r border-gray-700">COST</th>
                  <th className="px-3 py-2 text-left font-medium border-r border-gray-700">INVOICE NO</th>
                  <th className="px-3 py-2 text-left font-medium border-r border-gray-700">SUPPLIER INV</th>
                  <th className="px-3 py-2 text-right font-medium border-r border-gray-700">SUPPLIER AMT</th>
                  <th className="px-3 py-2 text-left font-medium border-r border-gray-700">SUPPLIER STATUS</th>
                  <th className="px-3 py-2 text-center font-medium border-r border-gray-700">PAID</th>
                  <th className="px-3 py-2 text-right font-medium border-r border-gray-700">SHIPPING</th>
                  <th className="px-3 py-2 text-right font-medium border-r border-gray-700">PROFIT</th>
                  <th className="px-3 py-2 text-left font-medium border-r border-gray-700">UPDATES</th>
                  <th className="px-3 py-2 text-center font-medium border-r border-gray-700">ACTIONS</th>
                  <th className="px-3 py-2 text-center font-medium bg-blue-700 border-r border-gray-700">WADE</th>
                  <th className="px-3 py-2 text-center font-medium bg-green-700 border-r border-gray-700">LUCKY</th>
                  <th className="px-3 py-2 text-center font-medium bg-purple-700 border-r border-gray-700">KENNY</th>
                  <th className="px-3 py-2 text-center font-medium bg-orange-700 border-r border-gray-700">ACCOUNTS</th>
                  <th className="px-3 py-2 text-center font-medium bg-green-600 border-r border-gray-700">DONE</th>
                  <th className="px-3 py-2 text-center font-medium bg-red-600">URGENT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders
                  .filter(order => showCompleted || !order.flag_done)
                  .map((order, idx) => (
                    <tr key={order.order_no} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-1 font-medium text-gray-900 border-r border-gray-200">
                        {order.order_no}
                      </td>
                      <td className="px-3 py-1 border-r border-gray-200 max-w-xs">
                        <div className="truncate" title={order.order_name || ''}>
                          {order.order_name || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-1 border-r border-gray-200">
                        <EditableCell order={order} field="supplier" value={order.supplier} />
                      </td>
                      <td className="px-3 py-1 border-r border-gray-200 max-w-xs">
                        <EditableCell order={order} field="notes" value={order.notes} />
                      </td>
                      <td className="px-3 py-1 text-right border-r border-gray-200 font-mono">
                        {order.cost ? `R${order.cost.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-3 py-1 border-r border-gray-200">
                        <EditableCell order={order} field="invoice_no" value={order.invoice_no} />
                      </td>
                      <td className="px-3 py-1 border-r border-gray-200">
                        <EditableCell order={order} field="supplier_invoice_no" value={order.supplier_invoice_no} />
                      </td>
                      <td className="px-3 py-1 text-right border-r border-gray-200">
                        <EditableCell order={order} field="supplier_amount" value={order.supplier_amount ? `R${order.supplier_amount.toFixed(2)}` : null} type="number" />
                      </td>
                      <td className="px-3 py-1 border-r border-gray-200">
                        <EditableCell order={order} field="supplier_status" value={order.supplier_status} />
                      </td>
                      <td className="px-3 py-1 text-center border-r border-gray-200">
                        <div
                          onClick={() => toggleOwner(order.order_no, 'order_paid', order.order_paid)}
                          className={`cursor-pointer hover:opacity-75 transition-opacity ${order.order_paid ? 'text-green-600' : 'text-gray-300'
                            }`}
                        >
                          {order.order_paid ? '✓' : '○'}
                        </div>
                      </td>
                      <td className="px-3 py-1 text-right border-r border-gray-200">
                        <EditableCell order={order} field="shipping" value={order.shipping ? `R${order.shipping.toFixed(2)}` : null} type="number" />
                      </td>
                      <td className={`px-3 py-1 text-right font-semibold border-r border-gray-200 ${order.profit && order.profit > 0 ? 'text-green-600' :
                          order.profit && order.profit < 0 ? 'text-red-600' : 'text-gray-500'
                        }`}>
                        {order.profit ? `R${order.profit.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-3 py-1 border-r border-gray-200 max-w-xs">
                        <EditableCell order={order} field="updates" value={order.updates} />
                      </td>
                      <td className="px-3 py-1 text-center border-r border-gray-200">
                        <button
                          onClick={() => bookShipment(order.order_no)}
                          className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs"
                          title="Book Shipment (Dry Run)"
                        >
                          Ship
                        </button>
                      </td>
                      <OwnerCheckbox order={order} field="owner_wade" label="Wade" color="bg-blue-200" />
                      <OwnerCheckbox order={order} field="owner_lucky" label="Lucky" color="bg-green-200" />
                      <OwnerCheckbox order={order} field="owner_kenny" label="Kenny" color="bg-purple-200" />
                      <OwnerCheckbox order={order} field="owner_accounts" label="Accounts" color="bg-orange-200" />
                      <OwnerCheckbox order={order} field="flag_done" label="Done" color="bg-green-300" />
                      <OwnerCheckbox order={order} field="flag_urgent" label="Urgent" color="bg-red-300" />
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
            <p>Showing {orders.filter(o => showCompleted || !o.flag_done).length} of {orders.length} orders • Click any cell to edit • Click checkboxes to toggle</p>
          </div>
        </div>
      )}
    </div>
  )
}
