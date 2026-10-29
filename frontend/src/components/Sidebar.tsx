import React from "react";
import {
  LayoutDashboard,
  Users,
  Send,
  MessageSquareShare,
  History,
  Activity,
  X,
  Radio,
} from "lucide-react";

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  candidateCount: number;
  messageCount: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenDirectMessage: () => void;
  onOpenBulkCampaign: () => void;
}

export function Sidebar({
  currentTab,
  onTabChange,
  candidateCount,
  messageCount,
  isMobileOpen,
  onCloseMobile,
  onOpenDirectMessage,
  onOpenBulkCampaign,
}: SidebarProps) {
  const navItems = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: "candidates",
      label: "Candidates",
      icon: Users,
      badge: candidateCount > 0 ? candidateCount : null,
    },
    {
      id: "messages",
      label: "Message History",
      icon: History,
      badge: messageCount > 0 ? messageCount : null,
    },
    {
      id: "health",
      label: "Provider Health",
      icon: Activity,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-transform duration-200 lg:static lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-500/20">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-white">
                TalentReach
              </span>
              <span className="block text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                Recruitment Comm
              </span>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1 rounded-lg text-zinc-400 hover:text-zinc-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Menu
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  onCloseMobile();
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-zinc-400"}`} />
                  {item.label}
                </div>
                {item.badge !== null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Action Hub */}
          <div className="pt-6 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Quick Actions
          </div>

          <button
            onClick={() => {
              onOpenDirectMessage();
              onCloseMobile();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition"
          >
            <Send className="h-4 w-4 text-blue-500" />
            Send Single SMS
          </button>

          <button
            onClick={() => {
              onOpenBulkCampaign();
              onCloseMobile();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition"
          >
            <MessageSquareShare className="h-4 w-4 text-purple-500" />
            Launch Bulk Campaign
          </button>
        </div>

        {/* Footer info */}
        <div className="border-t border-zinc-100 dark:border-zinc-800 p-4">
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 p-3 text-xs">
            <span className="font-semibold text-zinc-900 dark:text-white block">PostgreSQL Connected</span>
            <span className="text-[11px] text-zinc-500 mt-0.5 block">candidate_platform db</span>
          </div>
        </div>
      </aside>
    </>
  );
}
