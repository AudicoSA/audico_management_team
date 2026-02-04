import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const results: any = {
        timestamp: new Date().toISOString(),
        env: {
            SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 40) + "...",
            SUPABASE_ANON_KEY_SET: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            SUPABASE_SERVICE_KEY_SET: !!process.env.SUPABASE_SERVICE_KEY || !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            ANTHROPIC_API_KEY_SET: !!process.env.ANTHROPIC_API_KEY,
        },
        quotes_stats: null,
        recent_quotes: null,
        write_test: null,
    };

    try {
        const supabase = getSupabaseServer();

        // Check total quote count
        const { count: totalCount, error: countError } = await supabase
            .from("quotes")
            .select("*", { count: "exact", head: true });

        // Get 5 most recent quotes
        const { data: recentQuotes, error: recentError } = await supabase
            .from("quotes")
            .select("id, session_id, flow_type, created_at, updated_at")
            .order("created_at", { ascending: false })
            .limit(5);

        results.quotes_stats = {
            total_count: totalCount,
            count_error: countError?.message || null,
        };

        results.recent_quotes = {
            quotes: recentQuotes?.map(q => ({
                id: q.id.substring(0, 8) + "...",
                session_id: q.session_id?.substring(0, 8) + "...",
                flow_type: q.flow_type,
                created_at: q.created_at,
            })),
            error: recentError?.message || null,
        };

        // Write test
        const testId = uuidv4();
        const { error: writeError } = await supabase.from("quotes").insert({
            id: testId,
            session_id: "diagnostic-test",
            flow_type: "simple_quote",
            requirements: {},
            selected_products: [],
            status: "in_progress",
        });

        if (writeError) {
            results.write_test = { success: false, error: writeError.message };
        } else {
            results.write_test = { success: true, id: testId };
            // Clean up
            await supabase.from("quotes").delete().eq("id", testId);
        }

    } catch (e: any) {
        results.error = e.message;
    }

    return NextResponse.json(results, {
        headers: { "Cache-Control": "no-store" }
    });
}
