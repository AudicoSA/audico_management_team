import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const results: any = {
        env: {
            SUPABASE_URL_SET: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            SUPABASE_ANON_KEY_SET: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            SUPABASE_SERVICE_KEY_SET: !!process.env.SUPABASE_SERVICE_KEY || !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            ANTHROPIC_API_KEY_SET: !!process.env.ANTHROPIC_API_KEY,
        },
        write_test: null,
    };

    try {
        const supabase = getSupabaseServer();
        const testId = uuidv4();

        // Attempt to write a test quote
        const { error: writeError } = await supabase.from("quotes").insert({
            id: testId,
            session_id: "diagnostic-test",
            flow_type: "simple_quote",
            requirements: {},
            selected_products: [],
            status: "in_progress",
        });

        if (writeError) {
            results.write_test = { success: false, error: writeError };
        } else {
            results.write_test = { success: true, id: testId };
            // Clean up
            await supabase.from("quotes").delete().eq("id", testId);
        }

    } catch (e: any) {
        results.error = e.message;
    }

    return NextResponse.json(results);
}
