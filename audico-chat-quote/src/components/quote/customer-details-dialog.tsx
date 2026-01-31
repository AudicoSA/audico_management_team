"use client";

import { useState, useEffect } from "react";
import { X, FileText, Loader2 } from "lucide-react";

interface CustomerDetails {
    customerName: string;
    companyName: string;
    customerEmail: string;
    customerPhone: string;
    customerAddress: string;
    vatNumber: string;
}

interface CustomerDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (details: CustomerDetails) => void;
    isLoading?: boolean;
}

export function CustomerDetailsDialog({
    isOpen,
    onClose,
    onConfirm,
    isLoading = false,
}: CustomerDetailsDialogProps) {
    const [formData, setFormData] = useState<CustomerDetails>({
        customerName: "",
        companyName: "",
        customerEmail: "",
        customerPhone: "",
        customerAddress: "",
        vatNumber: "",
    });

    // Load from localStorage on mount (client-side only)
    useEffect(() => {
        try {
            const saved = localStorage.getItem("audico_customer_details");
            if (saved) {
                setFormData(JSON.parse(saved));
            }
        } catch (e) {
            console.warn("Failed to load customer details", e);
        }
    }, []);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Save to localStorage for next time
        try {
            localStorage.setItem("audico_customer_details", JSON.stringify(formData));
        } catch (e) {
            console.warn("Failed to save customer details", e);
        }

        onConfirm(formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-background-secondary">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-accent/10 rounded-lg">
                            <FileText size={20} className="text-accent" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-foreground">Quote Details</h2>
                            <p className="text-xs text-foreground-muted">Add customer info for the invoice</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-background-elevated rounded-lg transition-colors"
                    >
                        <X size={20} className="text-foreground-muted" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-foreground-muted">Full Name</label>
                            <input
                                required
                                type="text"
                                value={formData.customerName}
                                onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                                className="input-field w-full"
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-foreground-muted">Company (Optional)</label>
                            <input
                                type="text"
                                value={formData.companyName}
                                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                                className="input-field w-full"
                                placeholder="Acme Corp"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-foreground-muted">Email</label>
                            <input
                                required
                                type="email"
                                value={formData.customerEmail}
                                onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                                className="input-field w-full"
                                placeholder="john@example.com"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-foreground-muted">Phone</label>
                            <input
                                type="tel"
                                value={formData.customerPhone}
                                onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                                className="input-field w-full"
                                placeholder="+27..."
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground-muted">Address</label>
                        <textarea
                            required
                            rows={3}
                            value={formData.customerAddress}
                            onChange={(e) => setFormData(prev => ({ ...prev, customerAddress: e.target.value }))}
                            className="input-field w-full resize-none"
                            placeholder="Full billing address..."
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground-muted">VAT Number (Optional)</label>
                        <input
                            type="text"
                            value={formData.vatNumber}
                            onChange={(e) => setFormData(prev => ({ ...prev, vatNumber: e.target.value }))}
                            className="input-field w-full"
                            placeholder="4..."
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary flex items-center gap-2 px-6"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <FileText size={16} />
                                    Generate PDF
                                </>
                            )}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}
