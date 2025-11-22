import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Debug logging
if (typeof window !== 'undefined') {
  console.log('🔧 Supabase Config:', {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey,
    keyPrefix: supabaseAnonKey?.substring(0, 20) + '...'
  })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type EmailLog = {
  id: string
  gmail_message_id: string
  from_email: string
  subject: string
  category: string
  status: string
  handled_by: string | null
  payload: any
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string
  name: string
  company: string
  street_address: string
  local_area: string
  city: string
  code: string
  country_code: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  created_at?: string
}

export interface OrderTracker {
  order_no: string
  order_name: string | null
  supplier: string | null
  notes: string | null
  cost: number | null
  invoice_no: string | null
  order_paid: boolean | null
  supplier_amount: number | null
  supplier_invoice_no: string | null
  supplier_quote_no: string | null
  supplier_status: string | null
  supplier_invoice_url: string | null
  shipping: number | null
  profit: number | null
  updates: string | null
  owner_wade: boolean | null
  owner_lucky: boolean | null
  owner_kenny: boolean | null
  owner_accounts: boolean | null
  flag_done: boolean | null
  flag_urgent: boolean | null
  source: string | null
}

export type AgentLog = {
  id: string
  created_at: string
  agent: string
  level: string
  event_type: string
  context: any
}
