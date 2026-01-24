/**
 * Product Auto-Tagging for Consultation Mode
 * Automatically tags products during sync with scenario_tags, mounting_type, and exclusion flags
 *
 * Build #10: Sustainable auto-tagging (no manual curation needed!)
 */
export declare class ProductAutoTagger {
    /**
     * Tag product scenarios based on name, description, and category
     * Returns: ['commercial_bgm', 'home_cinema', 'conference', etc.]
     */
    static tagScenarios(product: {
        product_name: string;
        description?: string;
        category_name?: string;
    }): string[];
    /**
     * Detect mounting type from product name/description
     * Returns: 'ceiling' | 'wall' | 'floor' | 'in-wall' | null
     */
    static detectMountingType(product: {
        product_name: string;
        description?: string;
    }): string | null;
    /**
     * Determine if product should be excluded from consultation mode
     * Excludes: brackets, cables, car audio, bluetooth party speakers, accessories
     */
    static shouldExcludeFromConsultation(product: {
        product_name: string;
        description?: string;
        category_name?: string;
    }): boolean;
    /**
     * Auto-tag a product with all consultation mode fields
     * Call this during product sync in MCP servers
     */
    static autoTag(product: {
        product_name: string;
        description?: string;
        category_name?: string;
    }): {
        scenario_tags: string[];
        mounting_type: string | null;
        exclude_from_consultation: boolean;
    };
}
export default ProductAutoTagger;
//# sourceMappingURL=auto-tagger.d.ts.map