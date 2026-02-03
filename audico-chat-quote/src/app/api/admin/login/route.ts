import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { password } = await req.json();

        // Verification against env var or fallback
        const validPassword = process.env.ADMIN_PASSWORD || "Audico2026!";

        if (password !== validPassword) {
            return NextResponse.json({ error: "Invalid password" }, { status: 401 });
        }

        // Set a simple auth cookie
        const response = NextResponse.json({ success: true });

        // Set cookie valid for 7 days
        response.cookies.set("audico_admin_access", "true", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
        });

        return response;
    } catch (error) {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
