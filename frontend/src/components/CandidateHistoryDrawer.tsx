import React, { useState, useEffect } from "react";
import { Candidate, Message } from "@/types";
import { candidatesApi } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";
import { X, Send, History, RefreshCw, AlertCircle, Phone, Mail, Calendar, MessageSquare } from "lucide-react";

interface CandidateHistoryDrawerProps {
  candidate: Candidate | null;
  onClose: () => void;
  onComposeMessage: (candidate: Candidate) => void;
  onRetryMessage: (message: Message) => void;
}

export function CandidateHistoryDrawer({
  candidate,
  onClose,
  onComposeMessage,
  onRetryMessage,
}: CandidateHistoryDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    if (!candidate) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const data = await candidatesApi.getMessages(candidate.id, statusFilter || undefined);
        setMessages(data);
      } catch {
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [candidate, statusFilter]);

  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Candidate Profile
              </span>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <h3 className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">{candidate.name}</h3>

            <div className="mt-3 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-zinc-400" />
                <span>{candidate.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-zinc-400" />
                <span className="font-mono">{candidate.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                <span>Joined {new Date(candidate.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={() => onComposeMessage(candidate)}
                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-semibold transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
                Send Message to {candidate.name.split(" ")[0]}
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              Communication Timeline ({messages.length})
            </span>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="read">Read</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Timeline List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {loading ? (
              <div className="py-12 text-center text-xs text-zinc-400">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                Loading timeline...
              </div>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-xs">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
                No communications found for this candidate.
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 p-4 text-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <StatusBadge status={m.status} isPermanent={m.is_permanent_failure} size="sm" />
                    <span className="text-[11px] text-zinc-400">
                      {new Date(m.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="text-zinc-900 dark:text-zinc-100 font-normal leading-relaxed">{m.content}</p>

                  <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                    <span>Provider Ref: <code className="font-mono">{m.provider_message_id || "N/A"}</code></span>
                    {m.retry_count > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">Retries: {m.retry_count}</span>
                    )}
                  </div>

                  {m.failure_reason && (
                    <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-2.5 text-rose-700 dark:text-rose-300 text-[11px] flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500 mt-0.5" />
                      <span>{m.failure_reason}</span>
                    </div>
                  )}

                  {m.status === "failed" && (
                    <div className="pt-1">
                      <button
                        onClick={() => onRetryMessage(m)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2.5 py-1 text-xs font-semibold transition"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Retry Message
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
