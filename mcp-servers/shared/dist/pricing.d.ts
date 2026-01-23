import { PriceCalculation, PricingRule } from './types';
/**
 * Calculate selling price using various pricing rules
 */
export declare class PricingCalculator {
    /**
     * Nology pricing: 15% VAT + 15% margin
     * Step 1: Add 15% VAT to cost excluding VAT
     * Step 2: Add 15% margin to VAT-inclusive cost
     * Final markup = 32.25% total on original cost
     */
    static nologyPricing(costExclVat: number): PriceCalculation;
    /**
     * Esquire pricing: 15% VAT + 20% margin
     * Step 1: Add 15% VAT to cost excluding VAT
     * Step 2: Add 20% margin to VAT-inclusive cost
     * Final markup = 38% total on original cost
     */
    static esquirePricing(costExclVat: number): PriceCalculation;
    /**
     * Standard markup pricing
     */
    static standardMarkup(costPrice: number, markupPercentage: number): PriceCalculation;
    /**
     * Custom pricing rule
     */
    static customPricing(costPrice: number, rule: PricingRule): PriceCalculation;
    /**
     * Calculate margin percentage from cost and selling price
     */
    static calculateMargin(costPrice: number, sellingPrice: number): number;
    /**
     * Add VAT to a price
     */
    static addVAT(price: number, vatPercentage?: number): number;
    /**
     * Remove VAT from a price
     */
    static removeVAT(priceInclVat: number, vatPercentage?: number): number;
}
export default PricingCalculator;
