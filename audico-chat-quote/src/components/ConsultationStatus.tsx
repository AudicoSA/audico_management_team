"use client";

import { ConsultationRequestSummary } from "@/lib/types";

interface ConsultationStatusProps {
  consultation: ConsultationRequestSummary;
}

export function ConsultationStatus({ consultation }: ConsultationStatusProps) {
  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-gray-100 text-gray-800 border-gray-200",
  };

  const statusLabels = {
    pending: "Pending Review",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
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
