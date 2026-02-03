import { getSupabaseServer } from "@/lib/supabase";
import { QuotesList } from "@/components/admin/quotes-list";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic"; // Ensure fresh data on every request

export default async function AdminQuotesPage() {
    const supabase = getSupabaseServer();

    // Use service key implicitly if configured on server, but getSupabaseServer uses configured logic.
    // We need to fetch ALL quotes.
    // Note: If RLS is enabled and limiting to session, this might return empty if not using Service Role.
    // In `lib/supabase.ts`, `getSupabaseServer` uses `SUPABASE_SERVICE_KEY` if available.

    const { data: quotes, error } = await supabase
        .from("quotes")
        .select("*, selected_products")
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) {
        console.error("Error fetching admin quotes:", error);
    }

    return (
        <AdminShell>
            <div className="w-full h-full flex flex-col p-8 max-w-6xl mx-auto overflow-y-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
                    <p className="text-muted-foreground">
                        View incoming quotes and fulfillment details.
                    </p>
                </header>

                <div className="bg-card/30 backdrop-blur-sm border border-border rounded-xl p-6 shadow-2xl">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        Recent Quotes
                    </h2>

                    <QuotesList quotes={quotes || []} />
                </div>
            </div>
        </AdminShell>
    );
}
