import React from "react";
import { ProviderHealth } from "@/types";
import { UserPlus, Send, Users, Menu, RefreshCw } from "lucide-react";

interface NavbarProps {
  currentTab: string;
  providerHealth: ProviderHealth | null;
  healthLoading: boolean;
  onRefreshHealth: () => void;
  onOpenAddCandidate: () => void;
  onOpenDirectMessage: () => void;
  onOpenBulkCampaign: () => void;
  onToggleMobileMenu: () => void;
}

export function Navbar({
  currentTab,
  providerHealth,
  healthLoading,
  onRefreshHealth,
  onOpenAddCandidate,
  onOpenDirectMessage,
  onOpenBulkCampaign,
  onToggleMobileMenu,
}: NavbarProps) {
  const isHealthy = providerHealth?.status === "healthy";

  const getTabTitle = () => {
    switch (currentTab) {
      case "overview":
        return "Dashboard Overview";
      case "candidates":
        return "Candidate Directory";
      case "messages":
        return "Communication History & Logs";
      case "health":
        return "Provider Health Monitor";
      default:
        return "Dashboard";
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 px-4 sm:px-6 backdrop-blur-md">
      {/* Left: Mobile Toggle + Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-xl text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
            {getTabTitle()}
          </h1>
        </div>
      </div>

      {/* Right: Provider status pill & Action shortcuts */}
      <div className="flex items-center gap-3">
        {/* Provider Status Pill */}
        <div
          onClick={onRefreshHealth}
          title="Click to refresh provider connectivity"
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-xs font-medium"
        >
          <span className={`h-2 w-2 rounded-full ${isHealthy ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
          <span className="text-zinc-600 dark:text-zinc-300">
            Provider: {isHealthy ? "Online" : "Offline"}
          </span>
          {isHealthy && providerHealth?.latency_ms !== undefined && (
            <span className="text-zinc-400 font-mono text-[11px]">{providerHealth.latency_ms}ms</span>
          )}
          <RefreshCw className={`h-3 w-3 text-zinc-400 ${healthLoading ? "animate-spin" : ""}`} />
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddCandidate}
            className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm transition"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add Candidate
          </button>

          <button
            onClick={onOpenDirectMessage}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition"
          >
            <Send className="h-3.5 w-3.5" />
            Send Message
          </button>

          <button
            onClick={onOpenBulkCampaign}
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition"
          >
            <Users className="h-3.5 w-3.5" />
            Bulk Campaign
          </button>
        </div>
      </div>
    </header>
  );
}
