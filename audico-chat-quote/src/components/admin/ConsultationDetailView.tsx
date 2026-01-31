"use client";

import { useState } from "react";
import { ConsultationRequest } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  consultation: ConsultationRequest;
}

export function ConsultationDetailView({ consultation: initialData }: Props) {
  const [consultation, setConsultation] = useState(initialData);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notes, setNotes] = useState("");

  async function handleStatusChange(newStatus: string) {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/consultations/${consultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const updated = await response.json();
        setConsultation(updated);
      } else {
        console.error("Failed to update status");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handlePriorityChange(newPriority: string) {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/consultations/${consultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });

      if (response.ok) {
        const updated = await response.json();
        setConsultation(updated);
      } else {
        console.error("Failed to update priority");
      }
    } catch (error) {
      console.error("Failed to update priority:", error);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAssign(specialist: string) {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/consultations/${consultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: specialist || null }),
      });

      if (response.ok) {
        const updated = await response.json();
        setConsultation(updated);
      } else {
        console.error("Failed to assign");
      }
    } catch (error) {
      console.error("Failed to assign:", error);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAddNote() {
    if (!notes.trim()) return;

    setIsUpdating(true);
    try {
      const existingNotes = consultation.notes || "";
      const timestamp = new Date().toLocaleString("en-ZA");
      const newNotes = existingNotes
        ? `${existingNotes}\n\n[${timestamp}]\n${notes}`
        : `[${timestamp}]\n${notes}`;

      const response = await fetch(`/api/admin/consultations/${consultation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: newNotes }),
      });

      if (response.ok) {
        const updated = await response.json();
        setConsultation(updated);
        setNotes("");
      } else {
        console.error("Failed to add note");
      }
    } catch (error) {
      console.error("Failed to add note:", error);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/admin/consultations"
        className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to list
      </Link>

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
              disabled={isUpdating}
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
            <dd className="mt-1 text-sm text-gray-900">{consultation.customerName || "N/A"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <a href={`mailto:${consultation.customerEmail}`} className="text-blue-600 hover:underline">
                {consultation.customerEmail}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Phone</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {consultation.customerPhone ? (
                <a href={`tel:${consultation.customerPhone}`} className="text-blue-600 hover:underline">
                  {consultation.customerPhone}
                </a>
              ) : (
                "N/A"
              )}
            </dd>
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
              {consultation.projectType.replace(/_/g, " ")}
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
            <dd className="mt-1 text-sm text-gray-900">{consultation.complexityScore || "N/A"}/100</dd>
          </div>
        </dl>
      </div>

      {/* Zones */}
      {consultation.zones && consultation.zones.length > 0 && (
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
                    <dd className="text-gray-900">{zone.useCase || zone.use_case}</dd>
                  </div>
                  {zone.dimensions && (
                    <div>
                      <dt className="text-gray-500">Dimensions</dt>
                      <dd className="text-gray-900">
                        {zone.dimensions.length}m × {zone.dimensions.width}m × {zone.dimensions.height}m
                      </dd>
                    </div>
                  )}
                  {zone.budgetAllocation && (
                    <div>
                      <dt className="text-gray-500">Budget Allocation</dt>
                      <dd className="text-gray-900">R{zone.budgetAllocation.toLocaleString()}</dd>
                    </div>
                  )}
                  {zone.ceilingType && (
                    <div>
                      <dt className="text-gray-500">Ceiling Type</dt>
                      <dd className="text-gray-900">{zone.ceilingType}</dd>
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
      )}

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
            disabled={!notes.trim() || isUpdating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
            value={consultation.assignedTo || ""}
            onChange={(e) => handleAssign(e.target.value)}
            disabled={isUpdating}
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
