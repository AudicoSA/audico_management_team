import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { quoteId, customerEmail, pdfBlob } = body;

        // For now, simple log.
        // To implement real email:
        // 1. Install 'resend' (npm install resend)
        // 2. import { Resend } from 'resend';
        // 3. const resend = new Resend(process.env.RESEND_API_KEY);
        // 4. await resend.emails.send({ ... attachments: [{ content: pdfBlob, filename: 'quote.pdf' }] })

        console.log("----------------------------------------");
        console.log("📧 SENDING EMAIL");
        console.log(`To: ${customerEmail}`);
        console.log(`Quote: ${quoteId}`);
        console.log("----------------------------------------");

        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error sending email:", error);
        return NextResponse.json({ success: false, error: "Failed to send email" }, { status: 500 });
    }
}
