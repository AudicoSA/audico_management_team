import { NextRequest, NextResponse } from "next/server";
import { SystemDesignEngine } from "@/lib/flows/system-design/engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/system-design/skip
 * Skip the current step in a guided quote flow
 * Used when user doesn't need a particular component (e.g., "skip please, amp has streaming")
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quoteId, reason } = body;

    if (!quoteId) {
      return NextResponse.json(
        { error: "quoteId is required" },
        { status: 400 }
      );
    }

    // Load the existing quote
    const engine = await SystemDesignEngine.load(quoteId);
    if (!engine) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    // Skip the current step
    const result = await engine.skipCurrentStep(reason);

    return NextResponse.json({
      success: true,
      skippedStep: result.skippedStep,
      nextStep: result.nextStep,
      currentStep: result.nextStep, // Alias for frontend compatibility
      products: result.products,
      message: result.message,
      isComplete: result.isComplete,
      quoteTotal: engine.getQuoteTotal(),
      quoteItems: engine.getSelectedProducts(),
      totalSteps: engine.getTotalSteps(),
    });
  } catch (error: any) {
    console.error("Skip step error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to skip step" },
      { status: 500 }
    );
  }
}
