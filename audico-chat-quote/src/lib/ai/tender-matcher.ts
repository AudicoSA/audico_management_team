/**
 * Tender Product Matcher
 * 
 * Takes extracted items from Vision AI and matches them to products in the database.
 * Flags unmatched items for future sourcing.
 */

import { ProductSearchEngine } from "./product-search-engine";
import { getSupabaseServer } from "@/lib/supabase";
import type { Product } from "@/lib/types";

export interface ExtractedItem {
    quantity: number;
    description: string;
    brand: string | null;
    model: string | null;
    specifications: Record<string, any>;
    category: string;
}

export interface MatchResult {
    extractedItem: ExtractedItem;
    matches: {
        product: Product;
        confidence: "high" | "medium" | "low";
        matchReason: string;
    }[];
    status: "matched" | "partial" | "unmatched";
}

export interface TenderMatchResults {
    results: MatchResult[];
    summary: {
        total: number;
        matched: number;
        partial: number;
        unmatched: number;
    };
}

/**
 * Match extracted items to products in the database
 */
export async function matchTenderItems(
    items: ExtractedItem[],
    sessionId: string
): Promise<TenderMatchResults> {
    const results: MatchResult[] = [];
    let matched = 0;
    let partial = 0;
    let unmatched = 0;

    console.log(`[TenderMatcher] Matching ${items.length} items`);

    for (const item of items) {
        const matchResult = await matchSingleItem(item, sessionId);
        results.push(matchResult);

        if (matchResult.status === "matched") matched++;
        else if (matchResult.status === "partial") partial++;
        else unmatched++;
    }

    console.log(`[TenderMatcher] Results: ${matched} matched, ${partial} partial, ${unmatched} unmatched`);

    return {
        results,
        summary: {
            total: items.length,
            matched,
            partial,
            unmatched,
        },
    };
}

/**
 * Match a single extracted item to products
 */
async function matchSingleItem(
    item: ExtractedItem,
    sessionId: string
): Promise<MatchResult> {
    const matches: MatchResult["matches"] = [];

    // Build search query from item details
    const searchTerms: string[] = [];

    if (item.brand) searchTerms.push(item.brand);
    if (item.model) searchTerms.push(item.model);
    searchTerms.push(item.description);

    // Add key specifications to search
    if (item.specifications) {
        const specs = item.specifications;
        if (specs.size) searchTerms.push(specs.size);
        if (specs.power) searchTerms.push(specs.power);
        if (specs.channels) searchTerms.push(`${specs.channels} channel`);
    }

    const searchQuery = searchTerms.join(" ");
    console.log(`[TenderMatcher] Searching: "${searchQuery}"`);

    try {
        // Search for matching products
        const products = await ProductSearchEngine.searchByKeywords(searchQuery, {
            limit: 10,
        });

        // Score and rank matches
        for (const product of products) {
            const { confidence, reason } = scoreMatch(item, product);

            if (confidence !== "none") {
                matches.push({
                    product,
                    confidence,
                    matchReason: reason,
                });
            }
        }

        // Sort by confidence (high > medium > low)
        matches.sort((a, b) => {
            const order = { high: 0, medium: 1, low: 2 };
            return order[a.confidence] - order[b.confidence];
        });

        // Take top 3 matches
        const topMatches = matches.slice(0, 3);

        // Determine status
        let status: MatchResult["status"];
        if (topMatches.length > 0 && topMatches[0].confidence === "high") {
            status = "matched";
        } else if (topMatches.length > 0) {
            status = "partial";
        } else {
            status = "unmatched";
            // Flag unmatched item for future sourcing
            await flagUnmatchedProduct(item, sessionId);
        }

        return {
            extractedItem: item,
            matches: topMatches,
            status,
        };

    } catch (error) {
        console.error(`[TenderMatcher] Error matching item:`, error);

        // Flag as unmatched on error
        await flagUnmatchedProduct(item, sessionId);

        return {
            extractedItem: item,
            matches: [],
            status: "unmatched",
        };
    }
}

/**
 * Score how well a product matches an extracted item
 */
function scoreMatch(
    item: ExtractedItem,
    product: Product
): { confidence: "high" | "medium" | "low" | "none"; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    const productText = `${product.name} ${product.brand} ${product.category}`.toLowerCase();
    const itemText = `${item.description} ${item.brand || ""} ${item.model || ""}`.toLowerCase();

    // Brand match (strong signal)
    if (item.brand) {
        const itemBrand = item.brand.toLowerCase();
        if (product.brand?.toLowerCase() === itemBrand) {
            score += 40;
            reasons.push("Brand match");
        } else if (productText.includes(itemBrand)) {
            score += 20;
            reasons.push("Brand mentioned");
        }
    }

    // Model match (very strong signal)
    if (item.model) {
        const itemModel = item.model.toLowerCase();
        if (productText.includes(itemModel)) {
            score += 50;
            reasons.push("Model match");
        }
    }

    // Category match
    const categoryMappings: Record<string, string[]> = {
        speaker: ["speaker", "loudspeaker", "monitor"],
        amplifier: ["amplifier", "amp", "power amp"],
        receiver: ["receiver", "avr"],
        subwoofer: ["subwoofer", "sub", "bass"],
        microphone: ["microphone", "mic", "wireless mic"],
        conferencing: ["conference", "video bar", "speakerphone"],
    };

    const itemCategory = item.category.toLowerCase();
    const matchingTerms = categoryMappings[itemCategory] || [itemCategory];

    if (matchingTerms.some(term => productText.includes(term))) {
        score += 20;
        reasons.push("Category match");
    }

    // Specification matches
    if (item.specifications) {
        const specs = item.specifications;

        // Size match
        if (specs.size) {
            const sizeStr = specs.size.toString().toLowerCase();
            if (productText.includes(sizeStr)) {
                score += 15;
                reasons.push("Size match");
            }
        }

        // Power match
        if (specs.power) {
            const powerStr = specs.power.toString().toLowerCase().replace("w", "");
            if (productText.includes(powerStr + "w") || productText.includes(powerStr + " watt")) {
                score += 10;
                reasons.push("Power match");
            }
        }
    }

    // Description keyword overlap
    const itemWords = itemText.split(/\s+/).filter(w => w.length > 2);
    const matchingWords = itemWords.filter(word => productText.includes(word));
    if (matchingWords.length > 0) {
        score += Math.min(matchingWords.length * 5, 15);
        if (matchingWords.length >= 2) {
            reasons.push("Keywords match");
        }
    }

    // Determine confidence level
    if (score >= 60) {
        return { confidence: "high", reason: reasons.join(", ") };
    } else if (score >= 30) {
        return { confidence: "medium", reason: reasons.join(", ") };
    } else if (score >= 15) {
        return { confidence: "low", reason: reasons.join(", ") || "Partial match" };
    }

    return { confidence: "none", reason: "No match" };
}

/**
 * Flag an unmatched product for future sourcing
 */
async function flagUnmatchedProduct(
    item: ExtractedItem,
    sessionId: string
): Promise<void> {
    const supabase = getSupabaseServer();

    try {
        // Check if similar product was already flagged
        const searchText = `${item.brand || ""} ${item.description}`.trim().toLowerCase();

        const { data: existing } = await supabase
            .from("flagged_products")
            .select("id, request_count")
            .ilike("original_text", `%${searchText.substring(0, 50)}%`)
            .limit(1);

        if (existing && existing.length > 0) {
            // Increment request count
            await supabase
                .from("flagged_products")
                .update({
                    request_count: existing[0].request_count + 1,
                })
                .eq("id", existing[0].id);

            console.log(`[TenderMatcher] Incremented request count for existing flagged product`);
        } else {
            // Insert new flagged product
            await supabase.from("flagged_products").insert({
                session_id: sessionId,
                original_text: `${item.quantity}x ${item.brand || ""} ${item.description}`.trim(),
                extracted_specs: {
                    quantity: item.quantity,
                    brand: item.brand,
                    model: item.model,
                    category: item.category,
                    specifications: item.specifications,
                },
                status: "pending",
            });

            console.log(`[TenderMatcher] Flagged new product: ${item.description}`);
        }
    } catch (error) {
        console.error(`[TenderMatcher] Failed to flag product:`, error);
        // Non-critical - continue without failing
    }
}

export { flagUnmatchedProduct };
