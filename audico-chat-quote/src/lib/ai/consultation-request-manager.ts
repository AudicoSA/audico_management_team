/**
 * Consultation Request Manager
 *
 * Handles creation, retrieval, and updates of consultation requests for complex audio projects.
 * Related: CHAT_QUOTE_PLAN_X7 - AI Triage & Specialist Escalation System
 */

import { v4 as uuidv4 } from "uuid";
import { getSupabaseServer } from "@/lib/supabase";
import { generateConsultationReferenceCode } from "@/lib/utils";
import type {
  ConsultationRequest,
  CreateConsultationRequestData,
  UpdateConsultationRequestData,
} from "@/lib/types";

export class ConsultationRequestManager {
  private requests: Map<string, ConsultationRequest> = new Map();

  /**
   * Create a new consultation request
   */
  async createRequest(data: CreateConsultationRequestData): Promise<ConsultationRequest> {
    const requestId = uuidv4();

    // Get count of consultations created today to generate reference code
    const todayCount = await this.getTodayCount();
    const referenceCode = generateConsultationReferenceCode(todayCount);

    // Calculate zone count if not provided
    const zoneCount = data.zones.length;

    const request: ConsultationRequest = {
      id: requestId,
      referenceCode,
      sessionId: data.sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      companyName: data.companyName,
      projectType: data.projectType,
      budgetTotal: data.budgetTotal,
      timeline: data.timeline,
      zones: data.zones,
      requirementsSummary: data.requirementsSummary,
      technicalNotes: data.technicalNotes,
      existingEquipment: data.existingEquipment,
      complexityScore: data.complexityScore,
      zoneCount,
      status: "pending",
      priority: data.priority || "normal",
    };

    // Cache in memory
    this.requests.set(requestId, request);

    console.log(`[ConsultationRequestManager] Created request ${requestId} with reference ${referenceCode}`);

    // Save to database
    await this.saveToDatabase(request);

    return request;
  }

  /**
   * Get a consultation request by ID
   */
  async getRequest(requestId: string): Promise<ConsultationRequest | undefined> {
    // Check cache first
    if (this.requests.has(requestId)) {
      return this.requests.get(requestId);
    }

    // Load from database
    const request = await this.loadFromDatabase(requestId);
    if (request) {
      this.requests.set(requestId, request);
    }

    return request;
  }

  /**
   * Get a consultation request by reference code
   */
  async getRequestByReference(referenceCode: string): Promise<ConsultationRequest | undefined> {
    // Check cache first
    const cached = Array.from(this.requests.values()).find(
      (req) => req.referenceCode === referenceCode
    );
    if (cached) {
      return cached;
    }

    // Load from database
    const supabase = getSupabaseServer();

    try {
      const { data, error } = await supabase
        .from("consultation_requests")
        .select("*")
        .eq("reference_code", referenceCode)
        .single();

      if (error || !data) {
        return undefined;
      }

      const request = this.mapFromDatabase(data);
      this.requests.set(request.id, request);
      return request;
    } catch (error) {
      console.error("[ConsultationRequestManager] Error loading by reference:", error);
      return undefined;
    }
  }

  /**
   * Update a consultation request
   */
  async updateRequest(
    requestId: string,
    updates: UpdateConsultationRequestData
  ): Promise<ConsultationRequest> {
    const request = await this.getRequest(requestId);
    if (!request) {
      throw new Error(`Consultation request ${requestId} not found`);
    }

    // Apply updates
    if (updates.status) {
      request.status = updates.status;
    }
    if (updates.assignedTo !== undefined) {
      request.assignedTo = updates.assignedTo;
      if (updates.assignedTo) {
        request.assignedAt = new Date().toISOString();
      }
    }
    if (updates.quoteId !== undefined) {
      request.quoteId = updates.quoteId;
    }
    if (updates.notes !== undefined) {
      request.notes = updates.notes;
    }
    if (updates.priority) {
      request.priority = updates.priority;
    }
    if (updates.technicalNotes !== undefined) {
      request.technicalNotes = updates.technicalNotes;
    }

    request.updatedAt = new Date().toISOString();

    console.log(`[ConsultationRequestManager] Updated request ${requestId}`);

    // Save to database
    await this.saveToDatabase(request);

    return request;
  }

  /**
   * List consultation requests by session
   */
  async listBySession(sessionId: string): Promise<ConsultationRequest[]> {
    const supabase = getSupabaseServer();

    try {
      const { data, error } = await supabase
        .from("consultation_requests")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[ConsultationRequestManager] Error listing by session:", error);
        return [];
      }

      const requests = (data || []).map((row) => this.mapFromDatabase(row));

      // Cache in memory
      requests.forEach((req) => this.requests.set(req.id, req));

      return requests;
    } catch (error) {
      console.error("[ConsultationRequestManager] Database error:", error);
      return [];
    }
  }

  /**
   * List consultation requests by status
   */
  async listByStatus(status: string): Promise<ConsultationRequest[]> {
    const supabase = getSupabaseServer();

    try {
      const { data, error } = await supabase
        .from("consultation_requests")
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[ConsultationRequestManager] Error listing by status:", error);
        return [];
      }

      const requests = (data || []).map((row) => this.mapFromDatabase(row));

      // Cache in memory
      requests.forEach((req) => this.requests.set(req.id, req));

      return requests;
    } catch (error) {
      console.error("[ConsultationRequestManager] Database error:", error);
      return [];
    }
  }

  /**
   * Get count of consultations created today
   * Used for generating reference codes
   */
  private async getTodayCount(): Promise<number> {
    const supabase = getSupabaseServer();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    try {
      const { count, error } = await supabase
        .from("consultation_requests")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStr);

      if (error) {
        console.error("[ConsultationRequestManager] Error counting today's requests:", error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error("[ConsultationRequestManager] Database error:", error);
      return 0;
    }
  }

  /**
   * Save consultation request to database
   */
  private async saveToDatabase(request: ConsultationRequest): Promise<void> {
    const supabase = getSupabaseServer();

    try {
      const { error } = await supabase.from("consultation_requests").upsert({
        id: request.id,
        reference_code: request.referenceCode,
        session_id: request.sessionId,
        created_at: request.createdAt,
        updated_at: request.updatedAt,
        customer_name: request.customerName || null,
        customer_email: request.customerEmail,
        customer_phone: request.customerPhone || null,
        company_name: request.companyName || null,
        project_type: request.projectType,
        budget_total: request.budgetTotal,
        timeline: request.timeline || null,
        zones: request.zones,
        requirements_summary: request.requirementsSummary,
        technical_notes: request.technicalNotes || null,
        existing_equipment: request.existingEquipment || null,
        complexity_score: request.complexityScore || null,
        zone_count: request.zoneCount || null,
        status: request.status,
        assigned_to: request.assignedTo || null,
        assigned_at: request.assignedAt || null,
        quote_id: request.quoteId || null,
        notes: request.notes || null,
        priority: request.priority,
      });

      if (error) {
        console.error("[ConsultationRequestManager] Error saving request:", error);
        throw new Error(`Failed to save consultation request: ${error.message}`);
      }
    } catch (error) {
      console.error("[ConsultationRequestManager] Database error:", error);
      throw error;
    }
  }

  /**
   * Load consultation request from database
   */
  private async loadFromDatabase(requestId: string): Promise<ConsultationRequest | undefined> {
    const supabase = getSupabaseServer();

    try {
      const { data, error } = await supabase
        .from("consultation_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (error || !data) {
        return undefined;
      }

      return this.mapFromDatabase(data);
    } catch (error) {
      console.error("[ConsultationRequestManager] Database error:", error);
      return undefined;
    }
  }

  /**
   * Map database row to ConsultationRequest object
   */
  private mapFromDatabase(row: any): ConsultationRequest {
    return {
      id: row.id,
      referenceCode: row.reference_code,
      sessionId: row.session_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customerName: row.customer_name || undefined,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone || undefined,
      companyName: row.company_name || undefined,
      projectType: row.project_type,
      budgetTotal: row.budget_total,
      timeline: row.timeline || undefined,
      zones: row.zones || [],
      requirementsSummary: row.requirements_summary,
      technicalNotes: row.technical_notes || undefined,
      existingEquipment: row.existing_equipment || undefined,
      complexityScore: row.complexity_score || undefined,
      zoneCount: row.zone_count || undefined,
      status: row.status,
      assignedTo: row.assigned_to || undefined,
      assignedAt: row.assigned_at || undefined,
      quoteId: row.quote_id || undefined,
      notes: row.notes || undefined,
      priority: row.priority,
    };
  }
}

// Export singleton instance
export const consultationRequestManager = new ConsultationRequestManager();
