'use client'

import { useState, useEffect } from 'react'
import { supabase, type EmailLog } from '@/lib/supabase'

export default function EmailsPage() {
  const [emails, setEmails] = useState<EmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null)

  useEffect(() => {
    fetchEmails()
  }, [])

  const fetchEmails = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setEmails(data || [])
    } catch (error) {
      console.error('Error fetching emails:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendEmail = async (emailId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/email/send/${emailId}`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to send email')
      }

      alert('Email sent successfully!')
      fetchEmails()
      setSelectedEmail(null)
    } catch (error) {
      console.error('Error sending email:', error)
      alert('Failed to send email. Please try again.')
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFTED: 'bg-yellow-100 text-yellow-800',
      SENT: 'bg-green-100 text-green-800',
      CLASSIFIED: 'bg-blue-100 text-blue-800',
      ESCALATED: 'bg-red-100 text-red-800',
      PENDING: 'bg-gray-100 text-gray-800',
    }
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          styles[status] || styles.PENDING
        }`}
      >
        {status}
      </span>
    )
  }

  const getCategoryBadge = (category: string) => {
    const styles: Record<string, string> = {
      ORDER_STATUS_QUERY: 'bg-purple-100 text-purple-800',
      PRODUCT_QUESTION: 'bg-indigo-100 text-indigo-800',
      QUOTE_REQUEST: 'bg-pink-100 text-pink-800',
      COMPLAINT: 'bg-red-100 text-red-800',
      SUPPLIER_COMMUNICATION: 'bg-orange-100 text-orange-800',
      SUPPLIER_INVOICE: 'bg-amber-100 text-amber-800',
      NEW_ORDER_NOTIFICATION: 'bg-green-100 text-green-800',
    }
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          styles[category] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {category}
      </span>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Queue</h1>
          <p className="text-gray-600 mt-1">
            Review and approve AI-drafted email responses
          </p>
        </div>
        <button
          onClick={fetchEmails}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Loading emails...</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {emails.map((email) => (
              <li key={email.id}>
                <div
                  className="px-4 py-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedEmail(email)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        {getStatusBadge(email.status)}
                        {getCategoryBadge(email.category)}
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {email.subject}
                      </p>
                      <p className="text-sm text-gray-500">
                        From: {email.from_email}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0 text-right">
                      <p className="text-xs text-gray-500">
                        {new Date(email.created_at).toLocaleString()}
                      </p>
                      {email.status === 'DRAFTED' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (
                              confirm(
                                'Are you sure you want to send this email?'
                              )
                            ) {
                              sendEmail(email.id)
                            }
                          }}
                          className="mt-2 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                        >
                          Send Now
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Email Detail Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedEmail.subject}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    From: {selectedEmail.from_email}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    {getStatusBadge(selectedEmail.status)}
                    {getCategoryBadge(selectedEmail.category)}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Email Content
                </h3>
                <div className="bg-gray-50 rounded p-4">
                  <pre className="text-sm text-gray-900 whitespace-pre-wrap">
                    {JSON.stringify(selectedEmail.payload, null, 2)}
                  </pre>
                </div>
              </div>

              {selectedEmail.status === 'DRAFTED' && (
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      if (
                        confirm('Are you sure you want to send this email?')
                      ) {
                        sendEmail(selectedEmail.id)
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Approve & Send
                  </button>
                  <button
                    onClick={() => {
                      alert('Edit functionality coming soon')
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Edit Draft
                  </button>
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
