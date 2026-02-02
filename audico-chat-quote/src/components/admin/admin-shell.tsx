"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";

export function AdminShell({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="flex h-screen bg-background text-foreground">
            <Sidebar
                collapsed={collapsed}
                onToggle={() => setCollapsed(!collapsed)}
            />
            <main className="flex-1 flex flex-col items-center overflow-hidden relative">
                {children}
            </main>
        </div>
    );
}
