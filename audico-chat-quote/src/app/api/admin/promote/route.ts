import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get("email");
        const secret = searchParams.get("secret");

        // Simple protection for this bootstrap endpoint
        if (secret !== "audico-bootstrap-2026") {
            return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
        }

        if (!email) {
            return NextResponse.json({ error: "Missing email" }, { status: 400 });
        }

        const supabase = getSupabaseServer();

        // 1. Find the profile by email
        // Note: 'profiles' usually has 'id' equal to auth.users.id
        // But we might not have email in 'profiles' depending on the trigger.
        // 'profiles' table definition in `supabase.ts` shows `email` column.

        const { data: profile, error: fetchError } = await supabase
            .from("profiles")
            .select("*")
            .eq("email", email)
            .single();

        if (fetchError || !profile) {
            // Fallback: If profile doesn't have email column populated (rare), try to search auth.users?
            // Service key can access auth.users via supabase.auth.admin

            // Let's try to update direct matches first.
            return NextResponse.json({ error: "Profile not found for this email. Ensure you have logged in at least once.", details: fetchError }, { status: 404 });
        }

        // 2. Update role to admin
        const { error: updateError } = await supabase
            .from("profiles")
            .update({ role: "admin", is_active: true })
            .eq("id", profile.id);

        if (updateError) {
            return NextResponse.json({ error: "Failed to update role", details: updateError }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `User ${email} promoted to admin.`,
            profile_id: profile.id,
            new_role: "admin"
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
