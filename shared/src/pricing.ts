import { PriceCalculation, PricingRule } from './types';

/**
 * Calculate selling price using various pricing rules
 */
export class PricingCalculator {
  /**
   * Nology pricing: 15% VAT + 15% margin
   * Step 1: Add 15% VAT to cost excluding VAT
   * Step 2: Add 15% margin to VAT-inclusive cost
   * Final markup = 32.25% total on original cost
   */
  static nologyPricing(costExclVat: number): PriceCalculation {
    const costInclVat = costExclVat * 1.15; // Add 15% VAT
    const sellingPrice = costInclVat * 1.15; // Add 15% margin
    const totalMargin = ((sellingPrice - costExclVat) / costExclVat) * 100;

    return {
      cost_price: costExclVat,
      retail_price: sellingPrice,
      selling_price: sellingPrice,
      margin_percentage: parseFloat(totalMargin.toFixed(2)),
      vat_inclusive: true,
    };
  }

  /**
   * Esquire pricing: 15% VAT + 20% margin
   * Step 1: Add 15% VAT to cost excluding VAT
   * Step 2: Add 20% margin to VAT-inclusive cost
   * Final markup = 38% total on original cost
   */
  static esquirePricing(costExclVat: number): PriceCalculation {
    const costInclVat = costExclVat * 1.15; // Add 15% VAT
    const sellingPrice = costInclVat * 1.20; // Add 20% margin
    const totalMargin = ((sellingPrice - costExclVat) / costExclVat) * 100;

    return {
      cost_price: costExclVat,
      retail_price: sellingPrice,
      selling_price: sellingPrice,
      margin_percentage: parseFloat(totalMargin.toFixed(2)),
      vat_inclusive: true,
    };
  }

  /**
   * Standard markup pricing
   */
  static standardMarkup(
    costPrice: number,
    markupPercentage: number
  ): PriceCalculation {
    const sellingPrice = costPrice * (1 + markupPercentage / 100);

    return {
      cost_price: costPrice,
      selling_price: parseFloat(sellingPrice.toFixed(2)),
      margin_percentage: markupPercentage,
      vat_inclusive: true,
    };
  }

  /**
   * Custom pricing rule
   */
  static customPricing(
    costPrice: number,
    rule: PricingRule
  ): PriceCalculation {
    let workingPrice = costPrice;

    // Apply VAT to cost if specified
    if (rule.apply_vat_to_cost) {
      workingPrice = costPrice * (1 + rule.vat_percentage / 100);
    }

    // Apply margin
    const sellingPrice = rule.apply_margin_to_vat_inclusive
      ? workingPrice * (1 + rule.margin_percentage / 100)
      : costPrice * (1 + rule.margin_percentage / 100);

    return {
      cost_price: costPrice,
      selling_price: parseFloat(sellingPrice.toFixed(2)),
      margin_percentage: rule.margin_percentage,
      vat_inclusive: rule.apply_vat_to_cost || false,
    };
  }

  /**
   * Calculate margin percentage from cost and selling price
   */
  static calculateMargin(costPrice: number, sellingPrice: number): number {
    if (costPrice === 0) return 0;
    return parseFloat((((sellingPrice - costPrice) / costPrice) * 100).toFixed(2));
  }

  /**
   * Add VAT to a price
   */
  static addVAT(price: number, vatPercentage: number = 15): number {
    return parseFloat((price * (1 + vatPercentage / 100)).toFixed(2));
  }

  /**
   * Remove VAT from a price
   */
  static removeVAT(priceInclVat: number, vatPercentage: number = 15): number {
    return parseFloat((priceInclVat / (1 + vatPercentage / 100)).toFixed(2));
  }
}

export default PricingCalculator;
