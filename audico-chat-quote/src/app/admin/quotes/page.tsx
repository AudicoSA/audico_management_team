```javascript
import { getSupabaseServer } from "@/lib/supabase";
import { QuotesList } from "@/components/admin/quotes-list";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic"; // Ensure fresh data on every request

export default async function AdminQuotesPage() {
    const supabase = getSupabaseServer();

    // Use service key implicitly if configured on server, but getSupabaseServer uses configured logic.
    // We need to fetch ALL quotes.
    // Note: If RLS is enabled and limiting to session, this might return empty if not using Service Role.
    // In `lib / supabase.ts`, `getSupabaseServer` uses `SUPABASE_SERVICE_KEY` if available.

    const { data: quotes, error } = await supabase
        .from("quotes")
        .select("*, selected_products")
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) {
        console.error("Error fetching admin quotes:", error);
    }

    return (
                            Recent Quotes
                        </h2>

                        <QuotesList quotes={quotes || []} />
                    </div>
                </div>
            </main>
        </div>
    );
}
