"use client";

import { cn } from "@/lib/utils";
import {
  MessageSquare,
  FileText,
  History,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
}

const menuItems: NavItem[] = [
  { icon: <MessageSquare size={20} />, label: "Chat", href: "/", active: true },
  { icon: <FileText size={20} />, label: "Quotes", href: "/quotes" },
  { icon: <History size={20} />, label: "History", href: "/history" },
];

const toolItems: NavItem[] = [
  { icon: <Settings size={20} />, label: "Settings", href: "/settings" },
  { icon: <HelpCircle size={20} />, label: "Help", href: "/help" },
  { icon: <Zap size={20} />, label: "Admin", href: "/login" },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-full bg-background-secondary border-r border-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-border">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Audico"
            className={cn(
              "h-8 object-contain transition-all",
              collapsed ? "w-8" : "w-auto max-w-[120px]"
            )}
          />
        </div>
        <button
          onClick={onToggle}
          className={cn(
            "ml-auto p-1.5 rounded-lg hover:bg-background-elevated transition-colors",
            collapsed && "mx-auto ml-0"
          )}
        >
          {collapsed ? (
            <ChevronRight size={18} className="text-foreground-muted" />
          ) : (
            <ChevronLeft size={18} className="text-foreground-muted" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {/* Menu Section */}
        {!collapsed && (
          <p className="px-3 py-2 text-xs font-medium text-foreground-subtle uppercase tracking-wider">
            Menu
          </p>
        )}
        {menuItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={cn(
              "sidebar-item",
              item.active && "sidebar-item-active",
              collapsed && "justify-center px-2"
            )}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </a>
        ))}

        {/* Tools Section */}
        <div className="pt-4">
          {!collapsed && (
            <p className="px-3 py-2 text-xs font-medium text-foreground-subtle uppercase tracking-wider">
              Tools
            </p>
          )}
          {toolItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={cn(
                "sidebar-item",
                collapsed && "justify-center px-2"
              )}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </a>
          ))}
        </div>
      </nav>

      {/* Upgrade Banner */}
      {!collapsed && (
        <div className="p-3">
          <div className="bg-accent-muted border border-accent/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={18} className="text-accent" />
              <span className="font-semibold text-accent">Pro Mode</span>
            </div>
            <p className="text-sm text-foreground-muted mb-3">
              Get AI-powered recommendations and faster quotes.
            </p>
            <button className="btn-primary w-full text-sm">
              Upgrade Now
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
