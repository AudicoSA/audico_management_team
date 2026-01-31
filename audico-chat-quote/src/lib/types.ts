import { z } from "zod";

// ============================================================
// Product Types
// ============================================================

export interface Product {
  id: string;
  name: string;
  sku: string;
  model: string | null;
  brand: string | null;
  category: string | null;
  price: number;
  cost: number;
  stock: {
    total: number;
    jhb: number;
    cpt: number;
    dbn: number;
  };
  images: string[];
  specifications: Record<string, any>;
  useCase?: string;
  opencartProductId?: number;
}

export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  category?: string;
  inStockOnly?: boolean;
  useCase?: "Home" | "Commercial" | "Both";
}

export interface SearchResult {
  success: boolean;
  query: string;
  items: Product[];
  count: number;
}

// ============================================================
// Quote Types
// ============================================================

export type FlowType = "system_design" | "simple_quote" | "tender";
export type QuoteStatus = "in_progress" | "complete" | "abandoned";

export interface QuoteItem {
  productId: string;
  product: Product;
  quantity: number;
  lineTotal: number;
}

export interface Quote {
  id: string;
  sessionId: string;
  flowType: FlowType;
  requirements: Requirements;
  steps: Step[];
  currentStepIndex: number;
  selectedProducts: QuoteItem[];
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// System Design Types
// ============================================================

export type ComponentType =
  | "avr"
  | "fronts"
  | "center"
  | "surrounds"
  | "subwoofer"
  | "height"
  | "amp"
  | "ceiling_speakers"
  | "ceiling_speakers_z2"
  | "outdoor_speakers"
  | "wall_speakers"
  | "source";

export interface Step {
  id: number;
  component: ComponentType;
  label: string;
  description: string;
  searchQuery: string;
  budget: {
    min: number;
    max: number;
  };
  quantity: number;
  packageCovers?: ComponentType[];
  skipIfPackage?: boolean;
  status: "pending" | "current" | "completed" | "skipped";
  selectedProduct?: QuoteItem;
  skippedReason?: string;
}

export interface Requirements {
  type: "home_cinema" | "commercial_bgm" | "commercial_bgm_details" | "commercial_loud" | "commercial_loud_details" | "worship" | "education" | "video_conference" | "video_conference_details";
  channels?: "5.1" | "5.1.2" | "5.1.4" | "7.1" | "7.1.2" | "7.1.4" | "9.1" | "2.0" | "stereo";
  surroundMounting?: "ceiling" | "bookshelf" | "wall";
  frontType?: "floorstanding" | "bookshelf";
  budgetTotal?: number;
  roomSqm?: number;
  useCase?: "Home" | "Commercial";
  // Commercial BGM specific
  zoneCount?: number;
  hasOutdoor?: boolean;
  venueSize?: "small" | "medium" | "large";
  // Multi-room tracking
  additionalZones?: {
    name: string;
    type: string;
    mounting?: string;
    budget?: number;
    requirements?: string;  // "background music" vs "big sound"
  }[];
  primaryZone?: {
    type: "home_cinema" | "commercial_bgm" | "commercial_loud";
    channels?: string;
    budget?: number;
    roomSize?: number;
  };
  budgetAllocation?: {
    [zoneName: string]: number;
  };
}

// ============================================================
// Chat Types
// ============================================================

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  products?: Product[];
  step?: Step;
  timestamp: Date;
  consultationRequest?: ConsultationRequestSummary;
  isEscalated?: boolean;
}

export type IntentType = "system_design" | "simple_quote" | "tender" | "question" | "greeting";

// Consultation Request Summary for Chat Responses
export interface ConsultationRequestSummary {
  id: string;
  referenceCode: string;
  status: ConsultationStatus;
  projectType: ConsultationProjectType;
  budgetTotal: number;
  zoneCount?: number;
  createdAt: string;
}

// ============================================================
// API Response Types
// ============================================================

export interface SystemDesignStartResponse {
  quoteId: string;
  scenario: string;
  currentStep: Step;
  totalSteps: number;
  products: Product[];
  message: string;
}

export interface SystemDesignSelectResponse {
  success: boolean;
  addedProduct: QuoteItem;
  currentStep: Step | null;
  products: Product[];
  message: string;
  quoteTotal: number;
  skippedSteps: Step[];
  isComplete: boolean;
}

export interface SimpleQuoteAddResponse {
  success: boolean;
  item: QuoteItem;
  quoteTotal: number;
  itemCount: number;
}

// ============================================================
// Zod Schemas for Validation
// ============================================================

export const RequirementsSchema = z.object({
  type: z.enum(["home_cinema", "commercial_bgm", "commercial_bgm_details", "commercial_loud", "commercial_loud_details", "worship", "education", "video_conference", "video_conference_details"]),
  channels: z.enum(["5.1", "5.1.2", "5.1.4", "7.1", "7.1.2", "7.1.4", "9.1", "2.0", "stereo"]).optional(),
  surroundMounting: z.enum(["ceiling", "bookshelf", "wall"]).optional(),
  frontType: z.enum(["floorstanding", "bookshelf"]).optional(),
  budgetTotal: z.number().positive().optional(),
  roomSqm: z.number().positive().optional(),
  useCase: z.enum(["Home", "Commercial"]).optional(),
  // Commercial BGM specific
  zoneCount: z.number().positive().optional(),
  hasOutdoor: z.boolean().optional(),
  venueSize: z.enum(["small", "medium", "large"]).optional(),
  additionalZones: z.array(z.object({
    name: z.string(),
    type: z.string(),
    mounting: z.string().optional(),
    budget: z.number().positive().optional(),
    requirements: z.string().optional(),
  })).optional(),
  primaryZone: z.object({
    type: z.enum(["home_cinema", "commercial_bgm", "commercial_loud"]),
    channels: z.string().optional(),
    budget: z.number().positive().optional(),
    roomSize: z.number().positive().optional(),
  }).optional(),
  budgetAllocation: z.record(z.string(), z.number()).optional(),
});

export const SearchFiltersSchema = z.object({
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().positive().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  inStockOnly: z.boolean().optional(),
  useCase: z.enum(["Home", "Commercial", "Both"]).optional(),
});

// ============================================================
// Consultation Request Types
// ============================================================

export type ConsultationProjectType =
  | "residential_multi_zone"
  | "commercial"
  | "home_cinema_premium"
  | "whole_home_audio"
  | "other";

export type ConsultationStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type ConsultationPriority = "low" | "normal" | "high" | "urgent";

export interface ConsultationZone {
  name: string;
  location: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  useCase: string;
  ceilingType?: string;
  budgetAllocation?: number;
  notes?: string;
}

export interface ConsultationRequest {
  id: string;
  referenceCode: string;
  sessionId: string;
  createdAt: string;
  updatedAt: string;

  // Customer Information
  customerName?: string;
  customerEmail: string;
  customerPhone?: string;
  companyName?: string;

  // Project Details
  projectType: ConsultationProjectType;
  budgetTotal: number;
  timeline?: string;
  zones: ConsultationZone[];

  // Requirements
  requirementsSummary: string;
  technicalNotes?: string;
  existingEquipment?: string;

  // Metrics
  complexityScore?: number;
  zoneCount?: number;

  // Status & Assignment
  status: ConsultationStatus;
  assignedTo?: string;
  assignedAt?: string;
  quoteId?: string;
  notes?: string;
  priority: ConsultationPriority;
}

export interface CreateConsultationRequestData {
  sessionId: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  companyName?: string;
  projectType: ConsultationProjectType;
  budgetTotal: number;
  timeline?: string;
  zones: ConsultationZone[];
  requirementsSummary: string;
  technicalNotes?: string;
  existingEquipment?: string;
  complexityScore?: number;
  priority?: ConsultationPriority;
}

export interface UpdateConsultationRequestData {
  status?: ConsultationStatus;
  assignedTo?: string;
  quoteId?: string;
  notes?: string;
  priority?: ConsultationPriority;
  technicalNotes?: string;
}

// Zod Schema for Consultation Requests
export const ConsultationZoneSchema = z.object({
  name: z.string(),
  location: z.string(),
  dimensions: z.object({
    length: z.number().positive().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  }).optional(),
  useCase: z.string(),
  ceilingType: z.string().optional(),
  budgetAllocation: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const CreateConsultationRequestSchema = z.object({
  sessionId: z.string(),
  customerEmail: z.string().email(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  companyName: z.string().optional(),
  projectType: z.enum([
    "residential_multi_zone",
    "commercial",
    "home_cinema_premium",
    "whole_home_audio",
    "other"
  ]),
  budgetTotal: z.number().positive(),
  timeline: z.string().optional(),
  zones: z.array(ConsultationZoneSchema).min(1),
  requirementsSummary: z.string().min(10),
  technicalNotes: z.string().optional(),
  existingEquipment: z.string().optional(),
  complexityScore: z.number().min(0).max(100).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
});
