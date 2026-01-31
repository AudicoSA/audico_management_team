import { getSupabaseServer } from "@/lib/supabase";
import { QuoteItem } from "@/lib/types";

export interface SavedQuote {
    id: string;
    quote_id: string; // The PF Number
    session_id?: string;
    customer_details: any;
    items: QuoteItem[];
    totals: {
        subTotal: number;
        vat: number;
        total: number;
    };
    created_at: string;
}

export const quoteManager = {
    async saveQuote(data: Omit<SavedQuote, "id" | "created_at">) {
        const supabase = getSupabaseServer();

        // Ensure data is JSON-friendly
        const payload = {
            quote_id: data.quote_id,
            session_id: data.session_id,
            customer_details: data.customer_details,
            items: data.items,
            totals: data.totals
        };

        const { error } = await supabase
            .from("quotes")
            .upsert(payload, { onConflict: "quote_id" });

        if (error) {
            console.error("[QuoteManager] Error saving quote:", error);
            throw error;
        }

        return true;
    },

    async getQuote(quoteId: string): Promise<SavedQuote | null> {
        const supabase = getSupabaseServer();

        const { data, error } = await supabase
            .from("quotes")
            .select("*")
            .eq("quote_id", quoteId)
            .single();

        if (error || !data) {
            return null;
        }

        return data as SavedQuote;
    }
};
