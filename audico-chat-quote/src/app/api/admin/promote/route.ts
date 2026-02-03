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

        // 1. Try finding profile directly
        let { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("email", email)
            .single();

        let userId = profile?.id;

        // 2. If no profile found, look up in Auth (source of truth)
        if (!userId) {
            console.log("Profile not found, checking Auth via Admin API...");
            const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
            if (authError) {
                return NextResponse.json({ error: "Failed to list auth users", details: authError }, { status: 500 });
            }

            const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
            if (!user) {
                return NextResponse.json({ error: "User not found in Auth system. Please sign in at least once." }, { status: 404 });
            }
            userId = user.id;

            // Create missing profile if needed
            const { error: insertError } = await supabase.from("profiles").insert({
                id: userId,
                email: email,
                role: 'admin',
                is_active: true
            });

            if (!insertError) {
                return NextResponse.json({ success: true, message: "Created new admin profile for existing user.", userId });
            }
        }

        // 3. Update role to admin
        const { error: updateError } = await supabase
            .from("profiles")
            .update({ role: "admin", is_active: true })
            .eq("id", userId);

        if (updateError) {
            return NextResponse.json({ error: "Failed to update role", details: updateError }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `User ${email} promoted to admin.`,
            userId: userId,
            new_role: "admin"
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
