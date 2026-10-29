import React from "react";
import { Users, Send, CheckCircle2, AlertTriangle, ArrowUpRight } from "lucide-react";

interface StatsCardsProps {
  totalCandidates: number;
  totalMessages: number;
  deliveredMessages: number;
  failedMessages: number;
  onFilterFailed?: () => void;
  onFilterAll?: () => void;
}

export function StatsCards({
  totalCandidates,
  totalMessages,
  deliveredMessages,
  failedMessages,
  onFilterFailed,
  onFilterAll,
}: StatsCardsProps) {
  const deliveryRate = totalMessages > 0
    ? Math.round((deliveredMessages / totalMessages) * 100)
    : 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Candidates */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 shadow-sm transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Total Candidates
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Users className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {totalCandidates}
          </span>
          <span className="text-xs text-zinc-500">recruitment pool</span>
        </div>
      </div>

      {/* 2. Messages Dispatched */}
      <div
        onClick={onFilterAll}
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 shadow-sm transition hover:border-blue-500/30 hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Total Messages
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Send className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {totalMessages}
          </span>
          <span className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:underline">
            View all <ArrowUpRight className="ml-0.5 h-3 w-3" />
          </span>
        </div>
      </div>

      {/* 3. Delivered */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 shadow-sm transition hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Delivered
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {deliveredMessages}
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {deliveryRate}% rate
            </span>
          </div>
        </div>
      </div>

      {/* 4. Failures & Retries */}
      <div
        onClick={onFilterFailed}
        className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${
          failedMessages > 0
            ? "border-rose-300 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20"
            : "border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Failed Messages
          </span>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              failedMessages > 0
                ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                : "bg-zinc-500/10 text-zinc-500"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <span
            className={`text-3xl font-bold tracking-tight ${
              failedMessages > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-white"
            }`}
          >
            {failedMessages}
          </span>
          {failedMessages > 0 ? (
            <span className="inline-flex items-center text-xs font-semibold text-rose-600 dark:text-rose-400 group-hover:underline">
              Inspect & Retry <ArrowUpRight className="ml-0.5 h-3 w-3" />
            </span>
          ) : (
            <span className="text-xs text-zinc-400">All healthy</span>
          )}
        </div>
      </div>
    </div>
  );
}
