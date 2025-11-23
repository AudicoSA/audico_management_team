import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service key if available, otherwise fall back to anon key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: NextRequest) {
    try {
        const { change_ids } = await request.json()

        if (!change_ids || !Array.isArray(change_ids)) {
            return NextResponse.json(
                { error: 'Invalid change_ids' },
                { status: 400 }
            )
        }

        // Get the price changes
        const { data: changes, error: fetchError } = await supabase
            .from('price_change_queue')
            .select('*')
            .in('id', change_ids)
            .eq('status', 'approved')

        if (fetchError) {
            return NextResponse.json(
                { error: fetchError.message },
                { status: 500 }
            )
        }

        // Apply changes to OpenCart via backend API
        const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:8000'}/api/stock/apply-changes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ changes })
        })

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to apply changes to OpenCart' },
                { status: 500 }
            )
        }

        const result = await response.json()

        return NextResponse.json({
            success: true,
            applied: result.updated || 0,
            failed: result.failed || 0
        })

    } catch (error: any) {
        console.error('Approve changes error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
