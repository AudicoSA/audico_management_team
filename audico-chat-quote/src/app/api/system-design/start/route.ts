import { NextRequest, NextResponse } from "next/server";
import { SystemDesignEngine } from "@/lib/flows/system-design/engine";
import { RequirementsSchema } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requirements, sessionId = uuidv4() } = body;

    // Validate requirements
    const validated = RequirementsSchema.safeParse(requirements);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Invalid requirements",
          details: validated.error.flatten(),
        },
        { status: 400 }
      );
    }

    // Create System Design quote
    const { engine, products, message } = await SystemDesignEngine.create(
      sessionId,
      validated.data
    );

    const summary = engine.getSummary();

    return NextResponse.json({
      success: true,
      quoteId: engine.getQuoteId(),
      scenario: validated.data.type,
      currentStep: summary.steps[0],
      totalSteps: summary.totalSteps,
      products,
      message,
      quoteTotal: 0,
      selectedProducts: [],
    });
  } catch (error: any) {
    console.error("System Design Start API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start system design" },
      { status: 500 }
    );
  }
}
