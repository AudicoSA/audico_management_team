import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get("session_id");

        if (!sessionId) {
            return NextResponse.json(
                { error: "Missing session_id parameter" },
                { status: 400 }
            );
        }

        const supabase = getSupabaseServer();

        const { data, error } = await supabase
            .from("conversation_history")
            .select("*")
            .eq("session_id", sessionId)
            .order("message_index", { ascending: true });

        if (error) {
            console.error("Supabase error fetching history:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ messages: data });
    } catch (error: any) {
        console.error("API error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
