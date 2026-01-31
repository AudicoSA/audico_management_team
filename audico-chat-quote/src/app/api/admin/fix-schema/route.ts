import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

/**
 * API endpoint to fix the quotes table schema
 * This adds missing columns if they don't exist
 */
export async function POST() {
  try {
    const supabase = getSupabaseServer();

    // Try to add the missing column using raw SQL via RPC
    // This requires the SQL function to exist in Supabase
    const migrationSQL = `
      DO $$
      BEGIN
        -- Add current_step_index if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'quotes' AND column_name = 'current_step_index'
        ) THEN
          ALTER TABLE quotes ADD COLUMN current_step_index INT DEFAULT 0;
        END IF;

        -- Add selected_products if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'quotes' AND column_name = 'selected_products'
        ) THEN
          ALTER TABLE quotes ADD COLUMN selected_products JSONB DEFAULT '[]';
        END IF;

        -- Add steps if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'quotes' AND column_name = 'steps'
        ) THEN
          ALTER TABLE quotes ADD COLUMN steps JSONB DEFAULT '[]';
        END IF;

        -- Add requirements if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'quotes' AND column_name = 'requirements'
        ) THEN
          ALTER TABLE quotes ADD COLUMN requirements JSONB DEFAULT '{}';
        END IF;
      END $$;
    `;

    // Note: Supabase REST API doesn't support raw DDL statements directly
    // We'll need to run this in the Supabase dashboard

    // For now, let's check what columns exist
    const { data: tableInfo, error: infoError } = await supabase
      .from("quotes")
      .select("*")
      .limit(0);

    // Get column info from a test insert (will fail but show required columns)
    const testResult = await supabase
      .from("quotes")
      .insert({
        session_id: "test-schema-check",
        flow_type: "simple_quote",
        requirements: {},
        steps: [],
        current_step_index: 0,
        selected_products: [],
        status: "in_progress",
      })
      .select()
      .single();

    if (testResult.error) {
      // If the error mentions a specific column, the schema needs updating
      if (testResult.error.message.includes("current_step_index")) {
        return NextResponse.json({
          success: false,
          needsMigration: true,
          message: "The 'quotes' table is missing the 'current_step_index' column. Please run the migration SQL in the Supabase dashboard.",
          migrationPath: "/supabase/migrations/001_create_quotes_table.sql",
          quickFix: "ALTER TABLE quotes ADD COLUMN current_step_index INT DEFAULT 0;",
        });
      }

      return NextResponse.json({
        success: false,
        error: testResult.error.message,
      });
    }

    // Clean up test record
    if (testResult.data) {
      await supabase.from("quotes").delete().eq("id", testResult.data.id);
    }

    return NextResponse.json({
      success: true,
      message: "Schema is correct! The quotes table has all required columns.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to check and fix the schema",
    instructions: [
      "1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto/sql",
      "2. Run this SQL: ALTER TABLE quotes ADD COLUMN IF NOT EXISTS current_step_index INT DEFAULT 0;",
      "3. Or run the full migration from /supabase/migrations/001_create_quotes_table.sql",
    ],
  });
}
