import React from "react";
import { MessageStatus } from "@/types";
import { CheckCircle2, Clock, Eye, AlertCircle, Send } from "lucide-react";

interface StatusBadgeProps {
  status: MessageStatus;
  isPermanent?: boolean;
  size?: "sm" | "md";
}

export function StatusBadge({ status, isPermanent = false, size = "md" }: StatusBadgeProps) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs font-medium";

  switch (status) {
    case "pending":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 ${sizeClasses}`}
        >
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          Pending
        </span>
      );
    case "sent":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 ${sizeClasses}`}
        >
          <Send className="w-3.5 h-3.5" />
          Sent
        </span>
      );
    case "delivered":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 ${sizeClasses}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Delivered
        </span>
      );
    case "read":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 ${sizeClasses}`}
        >
          <Eye className="w-3.5 h-3.5" />
          Read
        </span>
      );
    case "failed":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 ${sizeClasses}`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          {isPermanent ? "Failed (Permanent)" : "Failed"}
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center rounded-full bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 ${sizeClasses}`}
        >
          {status}
        </span>
      );
  }
}
