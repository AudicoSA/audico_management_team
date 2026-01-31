import { v4 as uuidv4 } from "uuid";
import { getSupabaseServer } from "@/lib/supabase";
import { smartSearchForComponent, searchByBrand } from "@/lib/search";
import { getStepsForScenario, initializeSteps, type CommercialBGMOptions } from "./steps";
import { SpecialistAgent } from "@/lib/agent/specialist";
import { FEATURES } from "@/lib/config";
import type {
  Quote,
  Step,
  Requirements,
  QuoteItem,
  Product,
  ComponentType,
} from "@/lib/types";

export interface SelectProductResult {
  success: boolean;
  addedProduct?: QuoteItem;
  nextStep: Step | null;
  skippedSteps: Step[];
  products: Product[];
  message: string;
  quoteTotal: number;
  isComplete: boolean;
}

/**
 * System Design Engine
 * Controls the step-by-step quote building process
 * Backend owns all state - this is the source of truth
 */
export class SystemDesignEngine {
  private quote: Quote;
  private supabase = getSupabaseServer();

  constructor(quote: Quote) {
    this.quote = quote;
  }

  /**
   * Create a new System Design quote
   */
  static async create(
    sessionId: string,
    requirements: Requirements
  ): Promise<{
    engine: SystemDesignEngine;
    products: Product[];
    message: string;
  }> {
    const supabase = getSupabaseServer();

    // Build commercial options if applicable
    const commercialOptions: CommercialBGMOptions | undefined =
      requirements.type === "commercial_bgm" || requirements.type === "commercial_bgm_details"
        ? {
            zoneCount: requirements.zoneCount,
            hasOutdoor: requirements.hasOutdoor,
            venueSize: requirements.venueSize,
          }
        : undefined;

    // Get step definitions for this scenario
    const stepDefs = getStepsForScenario(requirements.type, requirements.channels, commercialOptions);
    const steps = initializeSteps(stepDefs);

    // Create quote in database
    const quoteId = uuidv4();
    const quote: Quote = {
      id: quoteId,
      sessionId,
      flowType: "system_design",
      requirements,
      steps,
      currentStepIndex: 0,
      selectedProducts: [],
      status: "in_progress",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from("quotes").insert({
      id: quoteId,
      session_id: sessionId,
      flow_type: "system_design",
      requirements,
      steps,
      current_step_index: 0,
      selected_products: [],
      status: "in_progress",
    });

    if (error) {
      throw new Error(`Failed to create quote: ${error.message}`);
    }

    const engine = new SystemDesignEngine(quote);

    // Get products for first step
    const firstStep = steps[0];
    const products = await smartSearchForComponent(firstStep.component, {
      budgetTotal: requirements.budgetTotal,
      useCase: requirements.useCase,
      channels: requirements.channels,
    });

    // Generate welcome message based on scenario type
    let message: string;
    if (requirements.type === "commercial_bgm" || requirements.type === "commercial_bgm_details") {
      const zones = requirements.zoneCount || 1;
      const outdoor = requirements.hasOutdoor;
      const size = requirements.venueSize || "medium";
      message = `Let's build your ${size} venue audio system`;
      if (zones > 1) {
        message += ` with ${zones} zones`;
        if (outdoor) message += " (indoor + outdoor)";
      }
      message += `!\n\nStarting with the ${firstStep.label} - this is the heart of your system. Here are my recommendations:`;
    } else if (requirements.type === "commercial_loud") {
      message = `Let's build your high-power audio system! Starting with the ${firstStep.label}. Here are my recommendations:`;
    } else {
      message = `Let's build your ${requirements.channels || "5.1"} home cinema system! Starting with the ${firstStep.label}. Here are my top recommendations:`;
    }

    return { engine, products, message };
  }

  /**
   * Load an existing quote from database
   */
  static async load(quoteId: string): Promise<SystemDesignEngine | null> {
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (error || !data) {
      return null;
    }

    const quote: Quote = {
      id: data.id,
      sessionId: data.session_id,
      flowType: data.flow_type as "system_design",
      requirements: data.requirements,
      steps: data.steps,
      currentStepIndex: data.current_step_index,
      selectedProducts: data.selected_products,
      status: data.status as Quote["status"],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return new SystemDesignEngine(quote);
  }

  /**
   * Get current step
   */
  getCurrentStep(): Step | null {
    if (this.quote.currentStepIndex >= this.quote.steps.length) {
      return null;
    }
    return this.quote.steps[this.quote.currentStepIndex];
  }

  /**
   * Get quote ID
   */
  getQuoteId(): string {
    return this.quote.id;
  }

  /**
   * Get total steps count
   */
  getTotalSteps(): number {
    return this.quote.steps.length;
  }

  /**
   * Check if quote is complete
   */
  isComplete(): boolean {
    return this.quote.status === "complete";
  }

  /**
   * Get quote total
   */
  getQuoteTotal(): number {
    return this.quote.selectedProducts.reduce(
      (sum, item) => sum + item.lineTotal,
      0
    );
  }

  /**
   * Get selected products
   */
  getSelectedProducts(): QuoteItem[] {
    return this.quote.selectedProducts;
  }

  /**
   * Skip the current step without selecting a product
   * Used when user doesn't need a component (e.g., "skip please, amp has streaming")
   */
  async skipCurrentStep(reason?: string): Promise<{
    skippedStep: Step;
    nextStep: Step | null;
    products: Product[];
    message: string;
    isComplete: boolean;
  }> {
    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      throw new Error("No current step to skip - quote may be complete");
    }

    // Mark current step as skipped
    currentStep.status = "skipped";
    currentStep.skippedReason = reason || "User requested skip";

    // Find next pending step
    const nextStepIndex = this.quote.steps.findIndex(
      (s, i) => i > this.quote.currentStepIndex && s.status === "pending"
    );

    let nextStep: Step | null = null;
    let products: Product[] = [];
    let message: string;
    let isComplete = false;

    if (nextStepIndex === -1) {
      // No more steps - quote is complete
      this.quote.status = "complete";
      this.quote.currentStepIndex = this.quote.steps.length;
      isComplete = true;
      message = this.generateCompletionMessage();
    } else {
      // Move to next step
      this.quote.currentStepIndex = nextStepIndex;
      nextStep = this.quote.steps[nextStepIndex];
      nextStep.status = "current";

      // Get products for next step using specialist agent or simple search
      const speakerBrand = this.getSpeakerBrand();
      const result = await this.getProductsForStep(nextStep, {
        brand: speakerBrand || undefined,
      });

      products = result.products;
      message = result.message || `Skipped ${currentStep.label}. Now let's choose your ${nextStep.label}. ${nextStep.description}:`;
    }

    // Save to database
    await this.save();

    return {
      skippedStep: currentStep,
      nextStep,
      products,
      message,
      isComplete,
    };
  }

  /**
   * Select a product for the current step
   */
  async selectProduct(product: Product): Promise<SelectProductResult> {
    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      return {
        success: false,
        nextStep: null,
        skippedSteps: [],
        products: [],
        message: "Quote is already complete",
        quoteTotal: this.getQuoteTotal(),
        isComplete: true,
      };
    }

    // Determine quantity - double for single speakers (no "pair" in name) on surround/ceiling steps
    let quantity = currentStep.quantity;
    if (
      (currentStep.component === "surrounds" || currentStep.component === "ceiling_speakers") &&
      !this.isPair(product)
    ) {
      // Single speaker - need 2 for a pair (or 4 for 7.1 surrounds)
      quantity = currentStep.quantity * 2;
    }

    // Create quote item
    const quoteItem: QuoteItem = {
      productId: product.id,
      product,
      quantity,
      lineTotal: product.price * quantity,
    };

    // Mark current step as completed
    currentStep.status = "completed";
    currentStep.selectedProduct = quoteItem;

    // Add to selected products
    this.quote.selectedProducts.push(quoteItem);

    // Check if this is a package that covers multiple components
    const skippedSteps: Step[] = [];
    if (currentStep.packageCovers && this.isPackage(product)) {
      for (const coveredComponent of currentStep.packageCovers) {
        const stepToSkip = this.quote.steps.find(
          (s) =>
            s.component === coveredComponent &&
            s.status === "pending" &&
            s.skipIfPackage
        );
        if (stepToSkip) {
          stepToSkip.status = "skipped";
          stepToSkip.skippedReason = `Covered by ${product.name}`;
          skippedSteps.push(stepToSkip);
        }
      }
    }

    // Find next pending step
    const nextStepIndex = this.quote.steps.findIndex(
      (s, i) => i > this.quote.currentStepIndex && s.status === "pending"
    );

    let nextStep: Step | null = null;
    let products: Product[] = [];
    let message: string;
    let isComplete = false;

    if (nextStepIndex === -1) {
      // Quote is complete
      this.quote.status = "complete";
      this.quote.currentStepIndex = this.quote.steps.length;
      isComplete = true;
      message = this.generateCompletionMessage();
    } else {
      // Move to next step
      this.quote.currentStepIndex = nextStepIndex;
      nextStep = this.quote.steps[nextStepIndex];
      nextStep.status = "current";

      // Get products for next step using specialist agent or simple search
      const speakerBrand = this.getSpeakerBrand();
      const selectedBrand = speakerBrand || product.brand;

      const result = await this.getProductsForStep(nextStep, {
        brand: selectedBrand || undefined,
      });

      products = result.products;
      message = result.message || this.generateStepMessage(nextStep, skippedSteps);
    }

    // Save to database
    await this.save();

    return {
      success: true,
      addedProduct: quoteItem,
      nextStep,
      skippedSteps,
      products,
      message,
      quoteTotal: this.getQuoteTotal(),
      isComplete,
    };
  }

  /**
   * Get the brand from the front speakers selection (for matching other speakers)
   */
  private getSpeakerBrand(): string | null {
    // Look for the fronts step and get its brand
    const frontsStep = this.quote.steps.find(
      (s) => s.component === "fronts" && s.selectedProduct
    );
    if (frontsStep?.selectedProduct?.product?.brand) {
      return frontsStep.selectedProduct.product.brand;
    }
    return null;
  }

  /**
   * Check if a product is sold as a pair
   */
  private isPair(product: Product): boolean {
    const pairKeywords = ["pair", "set of 2", "2x", "two", "(2)", "x2"];
    const nameLower = product.name.toLowerCase();
    return pairKeywords.some((kw) => nameLower.includes(kw));
  }

  /**
   * Filter out smart/wireless subwoofers (Denon Home, Sonos, etc.)
   */
  private filterOutSmartSubs(products: Product[]): Product[] {
    const smartKeywords = [
      "denon home",
      "sonos",
      "smart",
      "wireless sub",
      "wifi",
      "heos",
    ];
    return products.filter((p) => {
      const nameLower = p.name.toLowerCase();
      return !smartKeywords.some((kw) => nameLower.includes(kw));
    });
  }

  /**
   * Check if a product is a package (covers multiple components)
   */
  private isPackage(product: Product): boolean {
    const packageKeywords = [
      "package",
      "bundle",
      "system",
      "set",
      "kit",
      "combo",
      "5.0",
      "5.1",
      "7.0",
      "7.1",
    ];
    const nameLower = product.name.toLowerCase();
    return packageKeywords.some((kw) => nameLower.includes(kw));
  }

  /**
   * Generate message for next step
   */
  private generateStepMessage(step: Step, skippedSteps: Step[]): string {
    let message = "";

    if (skippedSteps.length > 0) {
      const skippedNames = skippedSteps.map((s) => s.label).join(" and ");
      message = `Great choice! That package includes ${skippedNames}, so we'll skip those. `;
    } else {
      message = "Excellent choice! ";
    }

    message += `Now for the ${step.label}. ${step.description}:`;
    return message;
  }

  /**
   * Generate completion message
   */
  private generateCompletionMessage(): string {
    const items = this.quote.selectedProducts;
    const total = this.getQuoteTotal();

    let message = "🎉 Your system is complete!\n\n";
    for (const item of items) {
      const qty = item.quantity > 1 ? ` (x${item.quantity})` : "";
      message += `• ${item.product.name}${qty}: R ${item.lineTotal.toLocaleString()}\n`;
    }
    message += `\n**Total: R ${total.toLocaleString()}**\n\n`;

    // Check for additional zones mentioned in requirements
    const zones = this.quote.requirements.additionalZones;
    if (zones && zones.length > 0) {
      const zoneNames = zones.map((z: { name: string }) => z.name).join(", ");
      message += `You also mentioned **${zoneNames}** speakers - would you like me to help with those next?\n\n`;
    }

    message += "Ready to generate your quote?";

    return message;
  }

  /**
   * Get products for a step using either specialist agent or simple search
   * When USE_SPECIALIST_AGENT=true, uses Claude with tool-calling for intelligent recommendations
   * Otherwise falls back to simple keyword search
   */
  private async getProductsForStep(
    step: Step,
    options: {
      brand?: string;
    } = {}
  ): Promise<{ products: Product[]; message?: string }> {
    // Check if specialist agent is enabled
    if (FEATURES.useSpecialistAgent) {
      try {
        console.log(`[Engine] Using specialist agent for ${step.component}`);
        const agent = new SpecialistAgent({
          currentStep: step,
          requirements: this.quote.requirements,
          selectedProducts: this.quote.selectedProducts,
          quoteId: this.quote.id,
        });

        const result = await agent.getRecommendations();
        if (result.products.length > 0) {
          return {
            products: result.products,
            message: result.message,
          };
        }
        // Fall through to simple search if agent returns no products
        console.log("[Engine] Agent returned no products, falling back to simple search");
      } catch (error) {
        console.error("[Engine] Specialist agent error, falling back to simple search:", error);
      }
    }

    // Simple search fallback
    let products: Product[];

    // For center and surrounds, try brand matching (same brand as fronts looks better)
    // For subwoofer, DON'T brand match - users want the best sub regardless of brand
    if (options.brand && (step.component === "center" || step.component === "surrounds")) {
      // Try to match brand for speaker components
      products = await searchByBrand(
        step.component,
        options.brand,
        this.quote.requirements.budgetTotal
          ? this.quote.requirements.budgetTotal * 0.2
          : undefined
      );

      // Fallback if no brand matches
      if (products.length === 0) {
        products = await smartSearchForComponent(step.component, {
          budgetTotal: this.quote.requirements.budgetTotal,
          useCase: this.quote.requirements.useCase,
        });
      }
    } else {
      // Subwoofer and other components - use smartSearch (no brand preference)
      products = await smartSearchForComponent(step.component, {
        budgetTotal: this.quote.requirements.budgetTotal,
        useCase: this.quote.requirements.useCase,
        channels: this.quote.requirements.channels,
      });

      // Filter out smart subs (Denon Home, Sonos wireless subs don't work with most AVRs)
      if (step.component === "subwoofer") {
        products = this.filterOutSmartSubs(products);
      }
    }

    return { products };
  }

  /**
   * Save quote to database
   */
  private async save(): Promise<void> {
    const { error } = await this.supabase
      .from("quotes")
      .update({
        steps: this.quote.steps,
        current_step_index: this.quote.currentStepIndex,
        selected_products: this.quote.selectedProducts,
        status: this.quote.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", this.quote.id);

    if (error) {
      console.error("Failed to save quote:", error);
      throw new Error(`Failed to save quote: ${error.message}`);
    }
  }

  /**
   * Get quote summary
   */
  getSummary() {
    return {
      id: this.quote.id,
      status: this.quote.status,
      requirements: this.quote.requirements,
      steps: this.quote.steps,
      currentStepIndex: this.quote.currentStepIndex,
      totalSteps: this.quote.steps.length,
      selectedProducts: this.quote.selectedProducts,
      total: this.getQuoteTotal(),
    };
  }
}
