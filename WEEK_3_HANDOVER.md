# Week 3 Handover: Frontend & Admin Panel

## Context

This is the handover document for **Week 3: Frontend & Admin Panel** of the AI Triage & Specialist Escalation System (CHAT_QUOTE_PLAN_X7).

**Week 2 Status**: ✅ **COMPLETE** - All AI integration is built, tested, and verified.

---

## What Was Completed in Week 2

### ✅ AI Integration (100% Complete)

**Complexity Detection System:**
- [complexity-detector.ts](audico-chat-quote/src/lib/ai/complexity-detector.ts) - Full scoring algorithm
- [test-complexity-detector.ts](audico-chat-quote/scripts/test-complexity-detector.ts) - **23/23 tests passing** ✅
- Budget extraction, zone counting, keyword detection all working

**System Integration:**
- [system-prompts.ts](audico-chat-quote/src/lib/ai/system-prompts.ts) - Escalation guidance added
- [claude-handler.ts](audico-chat-quote/src/lib/ai/claude-handler.ts) - Complexity detection integrated
- [tools.ts](audico-chat-quote/src/lib/ai/tools.ts) - `create_consultation_request` tool defined
- Tool handler implemented with full validation

**Backend Infrastructure:**
- [consultation-request-manager.ts](audico-chat-quote/src/lib/ai/consultation-request-manager.ts) - **28/28 tests passing** ✅
- Database table created and tested
- Reference code generation working
- CRUD operations complete

**Documentation:**
- [ESCALATION_DECISION_LOGIC.md](audico-chat-quote/ESCALATION_DECISION_LOGIC.md) - Complete decision tree
- All algorithms documented
- Edge cases covered

**Total Tests Passing: 51/51** ✅

---

## Week 3 Goals

**Goal**: Build user-facing frontend updates and internal consultant dashboard

### Part A: Frontend Updates (2-3 hours)
Enable customers to see when their project is escalated and track their consultation request.

### Part B: Admin Panel (4-6 hours)
Build internal dashboard for consultants to manage escalated projects.

### Part C: API Endpoints (1-2 hours)
Create REST API for admin panel to interact with consultation requests.

---

## Part A: Frontend Updates

### Tasks Breakdown

1. **Add Escalation Status to Chat UI**
   - Display badge/indicator when project is escalated
   - Show reference code prominently
   - Differentiate escalated conversations visually

2. **Create Consultation Status Component**
   - Display reference code
   - Show status (pending, in_progress, completed)
   - Show expected timeline (24-48 hours)
   - Customer-friendly messaging

3. **Update API Response Handling**
   - Handle `consultationRequest` field in chat responses
   - Display consultation status in conversation
   - Prevent product recommendations when escalated

4. **Add Loading States**
   - Show spinner when creating consultation request
   - Display "Gathering requirements..." during info collection
   - Smooth transition from chat to escalation

5. **Test UI Flows**
   - Simple project flow (no escalation)
   - Complex project flow (escalation triggered)
   - Reference code display
   - Status updates

### Key Files to Modify

#### 1. Update Chat Response Types

**File**: `src/lib/types.ts`

Add consultation request types to chat responses:

```typescript
// Add to existing types
export interface ConsultationRequestSummary {
  id: string;
  referenceCode: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  projectType: string;
  budgetTotal: number;
  zoneCount: number;
  createdAt: string;
}

export interface ChatResponse {
  message: string;
  products?: Product[];
  sessionId: string;
  quoteId?: string;
  quoteItems?: any[];
  needsMoreInfo?: boolean;
  isComplete?: boolean;
  totalPrice?: number;
  extractedBudget?: number;
  flowType?: string;
  processingTime?: number;
  consultationRequest?: ConsultationRequestSummary;  // NEW
  isEscalated?: boolean;                            // NEW
}
```

#### 2. Update Chat Handler to Return Consultation Data

**File**: `src/lib/ai/claude-handler.ts`

In the `chat()` method, detect when consultation is created and return it:

```typescript
interface ChatResponse {
  message: string;
  products?: Product[];
  quoteId?: string;
  quoteItems?: any[];
  needsMoreInfo?: boolean;
  isComplete?: boolean;
  totalPrice?: number;
  consultationRequest?: any;  // Add this
  isEscalated?: boolean;      // Add this
}

// In the tool execution loop, detect consultation creation:
if (block.name === "create_consultation_request" && result.success) {
  // Store consultation data to return in final response
  consultationRequest = result.data;
  isEscalated = true;
}

// In final return:
return {
  message: assistantMessage,
  products: recommendedProducts,
  quoteId: this.context.currentQuoteId,
  quoteItems: this.context.selectedProducts,
  needsMoreInfo: false,
  isComplete: false,
  totalPrice: totalPrice,
  consultationRequest,  // NEW
  isEscalated,         // NEW
};
```

#### 3. Update Chat API Route

**File**: `src/app/api/chat/ai-native/route.ts`

Pass consultation data through to frontend:

```typescript
const apiResponse = {
  message: response.message,
  products: response.products || [],
  sessionId,
  quoteId: response.quoteId || quoteId,
  quoteItems: response.quoteItems || [],
  needsMoreInfo: response.needsMoreInfo || false,
  isComplete: response.isComplete || false,
  totalPrice: response.totalPrice,
  extractedBudget: inferredBudget || undefined,
  flowType: "ai_native",
  processingTime,
  consultationRequest: response.consultationRequest,  // NEW
  isEscalated: response.isEscalated,                 // NEW
};
```

#### 4. Create Consultation Status Component

**File**: `src/components/ConsultationStatus.tsx` (NEW)

```typescript
import { ConsultationRequestSummary } from '@/lib/types';

interface ConsultationStatusProps {
  consultation: ConsultationRequestSummary;
}

export function ConsultationStatus({ consultation }: ConsultationStatusProps) {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const statusLabels = {
    pending: 'Pending Review',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Specialist Consultation Requested
          </h3>

          <div className="space-y-2">
            <div>
              <span className="text-sm text-blue-700 font-medium">Reference Code:</span>
              <span className="ml-2 text-base font-mono font-bold text-blue-900">
                {consultation.referenceCode}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-700 font-medium">Status:</span>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${statusColors[consultation.status]}`}>
                {statusLabels[consultation.status]}
              </span>
            </div>

            <div className="mt-3 text-sm text-blue-700">
              <p className="font-medium mb-1">What happens next:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-600">
                <li>Our AV specialist team will review your requirements within 24 hours</li>
                <li>You'll receive a detailed proposal via email within 24-48 hours</li>
                <li>The proposal will include CAD layouts and professional specifications</li>
                <li>A specialist will be available for a call to discuss the design</li>
              </ul>
            </div>

            <div className="mt-3 p-3 bg-white rounded border border-blue-200">
              <p className="text-xs text-blue-600">
                <strong>Note:</strong> Please save your reference code ({consultation.referenceCode})
                for tracking and future correspondence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### 5. Update Chat Interface Component

**File**: `src/components/chat/ChatInterface.tsx` (or equivalent)

Add consultation status display to chat:

```typescript
import { ConsultationStatus } from '@/components/ConsultationStatus';

// In your chat component, after receiving response:
{response.isEscalated && response.consultationRequest && (
  <ConsultationStatus consultation={response.consultationRequest} />
)}

// Add visual indicator to chat messages when escalated
{response.isEscalated && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
    <div className="flex">
      <div className="flex-shrink-0">
        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="ml-3">
        <p className="text-sm text-yellow-700">
          This project has been escalated to our specialist team for professional design and planning.
        </p>
      </div>
    </div>
  </div>
)}
```

#### 6. Prevent Product Recommendations When Escalated

In your chat handler or UI, check escalation status:

```typescript
// Don't show product cards if escalated
{!response.isEscalated && response.products && response.products.length > 0 && (
  <ProductGrid products={response.products} onAddToQuote={handleAddToQuote} />
)}

// Show message if escalated
{response.isEscalated && (
  <div className="text-center py-8 text-gray-600">
    <p>Product recommendations will be provided by our specialist team in your custom proposal.</p>
  </div>
)}
```

### Testing Checklist - Frontend

**Simple Project Flow:**
- [ ] Customer message: "Need soundbar for TV, budget R30k"
- [ ] No escalation indicator shown
- [ ] Products displayed normally
- [ ] Quote flow works as before

**Complex Project Flow:**
- [ ] Customer message: "Need whole home audio, 8 zones, budget R250k"
- [ ] Escalation message shown
- [ ] AI gathers requirements conversationally
- [ ] Consultation status component displayed
- [ ] Reference code visible (format: CQ-YYYYMMDD-XXX)
- [ ] Status badge shows "Pending Review"
- [ ] Next steps clearly explained
- [ ] No product cards shown

**Edge Cases:**
- [ ] Customer closes chat after escalation (reference code saved?)
- [ ] Customer returns to chat (reference code still visible?)
- [ ] Multiple consultations in same session (how to handle?)

---

## Part B: Admin Panel

### Tasks Breakdown

1. **Create Admin Layout & Navigation**
   - Protected route (authentication)
   - Sidebar navigation
   - Dashboard overview

2. **Build Consultation Requests List View**
   - Table with sortable columns
   - Filters (status, priority, date range)
   - Search by reference code, email, name
   - Pagination
   - Quick stats (pending count, in-progress count)

3. **Create Consultation Detail View**
   - Full customer information
   - Project details and requirements
   - Zone-by-zone breakdown
   - Technical notes
   - Status management
   - Assignment controls
   - Internal notes section
   - Link to quote (if created)

4. **Implement Status Management**
   - Change status (pending → in_progress → completed)
   - Assign to specialist (dropdown)
   - Set priority (low, normal, high, urgent)
   - Add internal notes
   - Track assignment timestamp

5. **Add Bulk Actions**
   - Select multiple requests
   - Bulk status update
   - Bulk assignment
   - Export to CSV

### Key Files to Create

#### 1. Admin Page Layout

**File**: `src/app/admin/consultations/page.tsx` (NEW)

```typescript
import { getSupabaseServer } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { ConsultationListTable } from '@/components/admin/ConsultationListTable';

export default async function ConsultationsPage() {
  // Authentication check
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch initial data (or use client-side fetching)
  const { data: consultations } = await supabase
    .from('consultation_requests')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Consultation Requests
        </h1>
        <p className="text-gray-600 mt-2">
          Manage complex audio project requests
        </p>
      </div>

      <ConsultationListTable initialData={consultations || []} />
    </div>
  );
}
```

#### 2. Consultation List Table Component

**File**: `src/components/admin/ConsultationListTable.tsx` (NEW)

```typescript
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ConsultationRequest } from '@/lib/types';

interface Props {
  initialData: ConsultationRequest[];
}

export function ConsultationListTable({ initialData }: Props) {
  const [consultations, setConsultations] = useState(initialData);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter and sort logic
  const filteredConsultations = useMemo(() => {
    let filtered = consultations;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(c => c.priority === priorityFilter);
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.referenceCode.toLowerCase().includes(query) ||
        c.customerEmail.toLowerCase().includes(query) ||
        c.customerName?.toLowerCase().includes(query) ||
        c.companyName?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortColumn as keyof ConsultationRequest];
      const bVal = b[sortColumn as keyof ConsultationRequest];

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [consultations, statusFilter, priorityFilter, searchQuery, sortColumn, sortDirection]);

  // Stats
  const stats = useMemo(() => ({
    total: consultations.length,
    pending: consultations.filter(c => c.status === 'pending').length,
    inProgress: consultations.filter(c => c.status === 'in_progress').length,
    completed: consultations.filter(c => c.status === 'completed').length,
  }), [consultations]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} color="gray" />
        <StatCard label="Pending" value={stats.pending} color="yellow" />
        <StatCard label="In Progress" value={stats.inProgress} color="blue" />
        <StatCard label="Completed" value={stats.completed} color="green" />
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search by reference, email, or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setPriorityFilter('all');
            }}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reference
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Project Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Budget
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredConsultations.map((consultation) => (
              <tr key={consultation.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/admin/consultations/${consultation.id}`}
                    className="text-blue-600 hover:text-blue-800 font-mono font-medium"
                  >
                    {consultation.referenceCode}
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {consultation.customerName || 'N/A'}
                    </div>
                    <div className="text-gray-500">{consultation.customerEmail}</div>
                    {consultation.companyName && (
                      <div className="text-gray-400 text-xs">{consultation.companyName}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatProjectType(consultation.projectType)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  R{consultation.budgetTotal.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={consultation.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <PriorityBadge priority={consultation.priority} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(consultation.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Link
                    href={`/admin/consultations/${consultation.id}`}
                    className="text-blue-600 hover:text-blue-800 mr-4"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleQuickAssign(consultation.id)}
                    className="text-green-600 hover:text-green-800"
                  >
                    Assign
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredConsultations.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No consultation requests found.
          </div>
        )}
      </div>
    </div>
  );
}

// Helper components
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="text-sm font-medium text-gray-500 uppercase">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${colors[color as keyof typeof colors]}`}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${colors[status as keyof typeof colors]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors = {
    low: 'bg-gray-100 text-gray-600',
    normal: 'bg-blue-100 text-blue-600',
    high: 'bg-orange-100 text-orange-600',
    urgent: 'bg-red-100 text-red-600',
  };

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[priority as keyof typeof colors]}`}>
      {priority}
    </span>
  );
}

function formatProjectType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
```

#### 3. Consultation Detail Page

**File**: `src/app/admin/consultations/[id]/page.tsx` (NEW)

```typescript
import { getSupabaseServer } from '@/lib/supabase';
import { notFound, redirect } from 'next/navigation';
import { ConsultationDetailView } from '@/components/admin/ConsultationDetailView';

interface Props {
  params: { id: string };
}

export default async function ConsultationDetailPage({ params }: Props) {
  const supabase = getSupabaseServer();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch consultation
  const { data: consultation, error } = await supabase
    .from('consultation_requests')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !consultation) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <ConsultationDetailView consultation={consultation} />
    </div>
  );
}
```

#### 4. Consultation Detail Component

**File**: `src/components/admin/ConsultationDetailView.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { ConsultationRequest } from '@/lib/types';

interface Props {
  consultation: ConsultationRequest;
}

export function ConsultationDetailView({ consultation: initialData }: Props) {
  const [consultation, setConsultation] = useState(initialData);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notes, setNotes] = useState('');

  async function handleStatusChange(newStatus: string) {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/consultations/${consultation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const updated = await response.json();
        setConsultation(updated);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAssign(specialist: string) {
    // Similar to handleStatusChange
  }

  async function handleAddNote() {
    // Add internal note
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {consultation.referenceCode}
            </h1>
            <p className="text-gray-500 mt-1">
              Created {new Date(consultation.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex gap-3">
            <select
              value={consultation.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={isUpdating}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={consultation.priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="low">Low Priority</option>
              <option value="normal">Normal Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Customer Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{consultation.customerName || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-sm text-gray-900">{consultation.customerEmail}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Phone</dt>
            <dd className="mt-1 text-sm text-gray-900">{consultation.customerPhone || 'N/A'}</dd>
          </div>
          {consultation.companyName && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Company</dt>
              <dd className="mt-1 text-sm text-gray-900">{consultation.companyName}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Project Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Project Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Project Type</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {consultation.projectType.replace(/_/g, ' ')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Budget</dt>
            <dd className="mt-1 text-sm text-gray-900 font-semibold">
              R{consultation.budgetTotal.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Zone Count</dt>
            <dd className="mt-1 text-sm text-gray-900">{consultation.zoneCount} zones</dd>
          </div>
          {consultation.timeline && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Timeline</dt>
              <dd className="mt-1 text-sm text-gray-900">{consultation.timeline}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm font-medium text-gray-500">Complexity Score</dt>
            <dd className="mt-1 text-sm text-gray-900">{consultation.complexityScore || 'N/A'}/100</dd>
          </div>
        </dl>
      </div>

      {/* Zones */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Zones ({consultation.zoneCount})</h2>
        <div className="space-y-4">
          {consultation.zones.map((zone: any, index: number) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-lg text-gray-900 mb-2">
                {zone.name}
              </h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-gray-500">Location</dt>
                  <dd className="text-gray-900">{zone.location}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Use Case</dt>
                  <dd className="text-gray-900">{zone.use_case}</dd>
                </div>
                {zone.dimensions && (
                  <div>
                    <dt className="text-gray-500">Dimensions</dt>
                    <dd className="text-gray-900">
                      {zone.dimensions.length}m × {zone.dimensions.width}m × {zone.dimensions.height}m
                    </dd>
                  </div>
                )}
                {zone.budget_allocation && (
                  <div>
                    <dt className="text-gray-500">Budget Allocation</dt>
                    <dd className="text-gray-900">R{zone.budget_allocation.toLocaleString()}</dd>
                  </div>
                )}
                {zone.notes && (
                  <div className="col-span-2">
                    <dt className="text-gray-500">Notes</dt>
                    <dd className="text-gray-900">{zone.notes}</dd>
                  </div>
                )}
              </dl>
            </div>
          ))}
        </div>
      </div>

      {/* Requirements & Technical Notes */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Requirements Summary</h2>
        <p className="text-gray-900 whitespace-pre-wrap">{consultation.requirementsSummary}</p>

        {consultation.technicalNotes && (
          <div className="mt-4">
            <h3 className="font-semibold text-gray-700 mb-2">Technical Notes</h3>
            <p className="text-gray-900 whitespace-pre-wrap">{consultation.technicalNotes}</p>
          </div>
        )}

        {consultation.existingEquipment && (
          <div className="mt-4">
            <h3 className="font-semibold text-gray-700 mb-2">Existing Equipment</h3>
            <p className="text-gray-900 whitespace-pre-wrap">{consultation.existingEquipment}</p>
          </div>
        )}
      </div>

      {/* Internal Notes */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Internal Notes</h2>
        <div className="space-y-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes (not visible to customer)..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
          <button
            onClick={handleAddNote}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Note
          </button>

          {consultation.notes && (
            <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{consultation.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Assignment */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Assignment</h2>
        <div className="space-y-3">
          <select
            value={consultation.assignedTo || ''}
            onChange={(e) => handleAssign(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Unassigned</option>
            <option value="john@audico.co.za">John Smith</option>
            <option value="jane@audico.co.za">Jane Doe</option>
            <option value="mike@audico.co.za">Mike Johnson</option>
          </select>

          {consultation.assignedAt && (
            <p className="text-sm text-gray-500">
              Assigned on {new Date(consultation.assignedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Part C: API Endpoints

### Create REST API for Admin Operations

#### 1. List Consultations API

**File**: `src/app/api/admin/consultations/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServer();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('consultation_requests')
      .select('*', { count: 'exact' });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      consultations: data,
      total: count,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('[API] Failed to fetch consultations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch consultations' },
      { status: 500 }
    );
  }
}
```

#### 2. Get Single Consultation API

**File**: `src/app/api/admin/consultations/[id]/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { consultationRequestManager } from '@/lib/ai/consultation-request-manager';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseServer();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const consultation = await consultationRequestManager.getRequest(params.id);

    if (!consultation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(consultation);
  } catch (error: any) {
    console.error('[API] Failed to fetch consultation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch consultation' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseServer();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { status, assignedTo, priority, notes } = body;

    const updates: any = {};
    if (status) updates.status = status;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (priority) updates.priority = priority;
    if (notes !== undefined) updates.notes = notes;

    const updated = await consultationRequestManager.updateRequest(params.id, updates);

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('[API] Failed to update consultation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update consultation' },
      { status: 500 }
    );
  }
}
```

---

## Testing Strategy

### Manual Testing Checklist

**Frontend:**
- [ ] Simple project shows normal flow
- [ ] Complex project triggers escalation
- [ ] Consultation status displays correctly
- [ ] Reference code visible and copyable
- [ ] Status badge shows correct color
- [ ] Next steps clearly explained
- [ ] Responsive design works on mobile

**Admin Panel:**
- [ ] List view loads all consultations
- [ ] Filters work (status, priority, search)
- [ ] Sorting works on columns
- [ ] Stats cards show correct counts
- [ ] Click reference code navigates to detail
- [ ] Detail view shows all information
- [ ] Zone breakdown is readable
- [ ] Status update works
- [ ] Assignment works
- [ ] Priority update works
- [ ] Internal notes can be added
- [ ] Timestamps display correctly

**API:**
- [ ] GET /api/admin/consultations returns list
- [ ] GET /api/admin/consultations/[id] returns single
- [ ] PATCH /api/admin/consultations/[id] updates
- [ ] Authentication required
- [ ] Filters work via query params
- [ ] Pagination works

### Test Scenarios

**Scenario 1: Customer Escalation Flow**
1. Customer: "I need whole home audio, 8 zones, budget R250k"
2. AI detects complexity and responds with escalation message
3. AI gathers requirements (name, email, phone, zones, etc.)
4. AI creates consultation request
5. Customer sees reference code and status
6. Customer sees timeline expectations

**Scenario 2: Consultant Review Flow**
1. Consultant logs into admin panel
2. Sees new pending request in list
3. Clicks reference code to view details
4. Reviews customer info, zones, requirements
5. Changes status to "in_progress"
6. Assigns to themselves
7. Adds internal notes
8. Customer status updates (future: email notification)

**Scenario 3: Search and Filter**
1. Admin has 50+ consultations
2. Search by reference code → finds exact match
3. Filter by status "pending" → shows only pending
4. Filter by priority "urgent" → shows only urgent
5. Reset filters → shows all again

---

## Success Criteria

**Frontend:**
- [ ] Escalation status clearly visible in chat
- [ ] Reference code prominently displayed
- [ ] Customer understands next steps
- [ ] UI responsive on mobile and desktop
- [ ] No product recommendations shown for escalated projects

**Admin Panel:**
- [ ] Consultants can view all requests
- [ ] Filtering and search work efficiently
- [ ] Status management is intuitive
- [ ] All customer information displayed
- [ ] Zone breakdown is clear
- [ ] Assignment workflow works
- [ ] Internal notes functionality

**API:**
- [ ] Endpoints respond within 500ms
- [ ] Authentication enforced
- [ ] Proper error handling
- [ ] Data validation
- [ ] Pagination works for large datasets

---

## Resources

### Documentation
- [CHAT_QUOTE_PLAN_X7.md](CHAT_QUOTE_PLAN_X7.md) - Master plan
- [WEEK_2_HANDOVER.md](WEEK_2_HANDOVER.md) - Week 2 completion
- [ESCALATION_DECISION_LOGIC.md](audico-chat-quote/ESCALATION_DECISION_LOGIC.md) - Decision logic
- [CONSULTATION_REQUEST_API.md](CONSULTATION_REQUEST_API.md) - API documentation

### Code Files (Already Complete)
- [consultation-request-manager.ts](audico-chat-quote/src/lib/ai/consultation-request-manager.ts) - Manager class
- [complexity-detector.ts](audico-chat-quote/src/lib/ai/complexity-detector.ts) - Scoring algorithm
- [types.ts](audico-chat-quote/src/lib/types.ts) - TypeScript types
- [supabase.ts](audico-chat-quote/src/lib/supabase.ts) - Database types

### Database
- Table: `consultation_requests`
- Migration: `audico-chat-quote/supabase/migrations/005_consultation_requests.sql`
- All indexes created
- Triggers working

---

## Notes for Next Agent

1. **Week 2 is fully complete** ✅
   - All backend logic working
   - Tests passing (51/51)
   - AI integration complete
   - Tool handler implemented

2. **Database is ready** ✅
   - Table exists and is tested
   - Reference code generation works
   - Manager has CRUD operations

3. **Focus on UI/UX**
   - Make escalation clear to customer
   - Admin panel should be intuitive
   - Prioritize consultant workflow

4. **Authentication**
   - Admin panel needs auth check
   - Use Supabase Auth or your existing auth system
   - Protect all admin routes

5. **Styling**
   - Use Tailwind CSS (already in project)
   - Match existing design system
   - Mobile responsive required

6. **Future Enhancements** (Week 4+)
   - Email notifications to sales team
   - Customer confirmation emails
   - Link consultation to final quote
   - Specialist workload dashboard

Good luck with Week 3! The foundation is solid. 🎉
