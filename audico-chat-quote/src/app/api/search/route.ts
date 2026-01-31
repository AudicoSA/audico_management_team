import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/search";
import { SearchFiltersSchema } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, filters = {}, k = 30 } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Query is required" },
        { status: 400 }
      );
    }

    // Validate filters
    const validatedFilters = SearchFiltersSchema.safeParse(filters);
    if (!validatedFilters.success) {
      return NextResponse.json(
        { success: false, error: "Invalid filters", details: validatedFilters.error },
        { status: 400 }
      );
    }

    // Perform search
    const items = await searchProducts(query, validatedFilters.data, k);

    return NextResponse.json({
      success: true,
      query,
      items,
      count: items.length,
    });
  } catch (error: any) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
