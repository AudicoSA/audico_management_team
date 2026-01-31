import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

/**
 * GET /api/admin/categories
 * Returns all distinct category_name values from the products table
 * Used for debugging and configuring search filters
 */
export async function GET() {
  try {
    const supabase = getSupabaseServer();

    // Query distinct category names with counts
    const { data, error } = await supabase
      .from("products")
      .select("category_name")
      .eq("active", true)
      .not("category_name", "is", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Count occurrences of each category
    const categoryCounts: Record<string, number> = {};
    for (const row of data || []) {
      const cat = row.category_name;
      if (cat) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
    }

    // Sort by count descending
    const sorted = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json({
      total: sorted.length,
      categories: sorted,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
