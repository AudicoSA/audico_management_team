import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { consultationRequestManager } from "@/lib/ai/consultation-request-manager";
import { requireAdminAuth } from "@/lib/auth/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication check
    const { error: authError } = await requireAdminAuth(req);
    if (authError) {
      return authError;
    }

    const consultation = await consultationRequestManager.getRequest(params.id);

    if (!consultation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(consultation);
  } catch (error: any) {
    console.error("[API] Failed to fetch consultation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch consultation" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication check
    const { error: authError } = await requireAdminAuth(req);
    if (authError) {
      return authError;
    }

    const body = await req.json();
    const { status, assignedTo, priority, notes } = body;

    const updates: any = {};
    if (status) updates.status = status;
    if (assignedTo !== undefined) {
      updates.assignedTo = assignedTo;
      // If assigning to someone, set assignedAt timestamp
      if (assignedTo) {
        updates.assignedAt = new Date().toISOString();
      }
    }
    if (priority) updates.priority = priority;
    if (notes !== undefined) updates.notes = notes;

    const updated = await consultationRequestManager.updateRequest(params.id, updates);

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[API] Failed to update consultation:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update consultation" },
      { status: 500 }
    );
  }
}
