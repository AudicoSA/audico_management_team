import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/auth/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    // Authentication check
    const { error: authError } = await requireAdminAuth(req);
    if (authError) {
      return authError;
    }

    const supabase = getSupabaseServer();

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    let query = supabase
      .from("consultation_requests")
      .select("*", { count: "exact" });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (priority && priority !== "all") {
      query = query.eq("priority", priority);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      consultations: data,
      total: count,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("[API] Failed to fetch consultations:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch consultations" },
      { status: 500 }
    );
  }
}
