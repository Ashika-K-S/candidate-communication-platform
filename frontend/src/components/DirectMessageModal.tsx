import React, { useState, useEffect } from "react";
import { Candidate, Message } from "@/types";
import { candidatesApi, messagesApi } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";
import { X, Send, History, Sparkles, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";

interface DirectMessageModalProps {
  isOpen: boolean;
  candidates: Candidate[];
  preselectedCandidate?: Candidate | null;
  onClose: () => void;
  onMessageSent: (newMessage: Message) => void;
}

const TEMPLATES = [
  {
    name: "Interview Invite",
    text: "Hi {name}, we were impressed by your profile and would love to schedule an interview with our team. Please let us know your availability this week!",
  },
  {
    name: "Status Update",
    text: "Hello {name}, thank you for taking the time to speak with us. We are currently reviewing feedback and will have an update for you shortly.",
  },
  {
    name: "Offer Discussion",
    text: "Hi {name}, congratulations! We are excited to extend an offer to join our team. Are you free for a brief call today to review details?",
  },
];

export function DirectMessageModal({
  isOpen,
  candidates,
  preselectedCandidate,
  onClose,
  onMessageSent,
}: DirectMessageModalProps) {
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | "">("");
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string; data?: Message } | null>(null);
  const [candidateHistory, setCandidateHistory] = useState<Message[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [errors, setErrors] = useState<{ candidate?: string; content?: string }>({});

  useEffect(() => {
    if (preselectedCandidate) {
      setSelectedCandidateId(preselectedCandidate.id);
    } else if (candidates.length > 0 && selectedCandidateId === "") {
      setSelectedCandidateId(candidates[0].id);
    }
  }, [preselectedCandidate, candidates, selectedCandidateId]);

  // Load history whenever selectedCandidateId changes
  useEffect(() => {
    if (!isOpen || !selectedCandidateId) {
      setCandidateHistory([]);
      return;
    }

    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const msgs = await candidatesApi.getMessages(Number(selectedCandidateId));
        setCandidateHistory(msgs);
      } catch {
        setCandidateHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
    setSendResult(null);
  }, [selectedCandidateId, isOpen]);

  if (!isOpen) return null;

  const currentCandidate = candidates.find((c) => c.id === Number(selectedCandidateId));
  const charCount = content.length;
  const smsSegments = Math.ceil(charCount / 160) || 1;

  const validate = (): boolean => {
    const newErrors: { candidate?: string; content?: string } = {};

    if (!selectedCandidateId) {
      newErrors.candidate = "Please select a candidate.";
    } else if (!currentCandidate) {
      newErrors.candidate = "Selected candidate does not exist.";
    } else if (!currentCandidate.phone || !currentCandidate.phone.trim()) {
      newErrors.candidate = "This candidate does not have a valid phone number.";
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      newErrors.content = "Message cannot be empty.";
    } else if (trimmedContent.length > 1600) {
      newErrors.content = "Message exceeds the allowed length (maximum 1600 characters).";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleApplyTemplate = (tplText: string) => {
    const candidateName = currentCandidate ? currentCandidate.name.split(" ")[0] : "Candidate";
    setContent(tplText.replace("{name}", candidateName));
    if (errors.content) setErrors((prev) => ({ ...prev, content: "" }));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;

    if (!validate()) return;

    setIsSending(true);
    setSendResult(null);

    try {
      const msg = await messagesApi.send(Number(selectedCandidateId), content.trim());
      setSendResult({
        success: msg.status === "sent",
        message:
          msg.status === "sent"
            ? `Message dispatched successfully! Provider Ref: ${msg.provider_message_id || "N/A"}`
            : `Message recorded with status '${msg.status}': ${msg.failure_reason || "Check provider logs"}`,
        data: msg,
      });

      // Update local history
      setCandidateHistory((prev) => [msg, ...prev]);
      onMessageSent(msg);
      setContent("");
      setErrors({});
    } catch (err: unknown) {
      setSendResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to send message.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Direct Messenger</h3>
              <p className="text-xs text-zinc-500">Send an SMS / communication directly to a candidate</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Candidate Selector */}
          <div>
            <label
              htmlFor="recipient-candidate-select"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5"
            >
              Recipient Candidate *
            </label>
            <select
              id="recipient-candidate-select"
              value={selectedCandidateId}
              onChange={(e) => {
                setSelectedCandidateId(Number(e.target.value));
                if (errors.candidate) setErrors((prev) => ({ ...prev, candidate: "" }));
              }}
              disabled={isSending}
              aria-invalid={!!errors.candidate}
              aria-describedby={errors.candidate ? "candidate-error" : undefined}
              className={`w-full rounded-xl border bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 ${
                errors.candidate
                  ? "border-rose-500 focus:ring-rose-500"
                  : "border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500"
              }`}
            >
              <option value="" disabled>Select a candidate...</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} &bull; {c.phone} ({c.email})
                </option>
              ))}
            </select>
            {errors.candidate && (
              <p id="candidate-error" className="mt-1 text-xs text-rose-500">
                {errors.candidate}
              </p>
            )}
          </div>

          {currentCandidate && (
            <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-900 dark:text-white">{currentCandidate.name}</span>
                <span className="text-zinc-400">&bull;</span>
                <span className="text-zinc-600 dark:text-zinc-300 font-mono">{currentCandidate.phone}</span>
              </div>
              <span className="text-zinc-500">{currentCandidate.email}</span>
            </div>
          )}

          {/* Quick Templates */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              Quick Templates
            </div>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  type="button"
                  onClick={() => handleApplyTemplate(tpl.text)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-300 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>

          {/* Message Content */}
          <div>
            <label
              htmlFor="direct-message-content"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5"
            >
              Message Content *
            </label>
            <textarea
              id="direct-message-content"
              rows={4}
              placeholder="Type your recruitment message here..."
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (errors.content) setErrors((prev) => ({ ...prev, content: "" }));
              }}
              disabled={isSending}
              aria-invalid={!!errors.content}
              aria-describedby={errors.content ? "message-content-error" : undefined}
              className={`w-full rounded-xl border bg-white dark:bg-zinc-950 p-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 resize-none ${
                errors.content
                  ? "border-rose-500 focus:ring-rose-500"
                  : "border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500"
              }`}
            />
            {errors.content && (
              <p id="message-content-error" className="mt-1 text-xs text-rose-500">
                {errors.content}
              </p>
            )}
            <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
              <span>{smsSegments} SMS segment{smsSegments > 1 ? "s" : ""}</span>
              <span className={charCount > 1600 ? "text-rose-500 font-semibold" : ""}>
                {charCount}/1600 characters
              </span>
            </div>
          </div>

          {/* Result Alert */}
          {sendResult && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                sendResult.success
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
              }`}
            >
              {sendResult.success ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold">{sendResult.success ? "Message Dispatched" : "Dispatch Alert"}</p>
                <p className="mt-0.5">{sendResult.message}</p>
              </div>
            </div>
          )}

          {/* Previous History with Candidate */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Previous Communications ({candidateHistory.length})
              </span>
              {loadingHistory && <RefreshCw className="h-3 w-3 animate-spin text-zinc-400" />}
            </div>

            {candidateHistory.length === 0 ? (
              <p className="text-xs text-zinc-400 italic py-2">No messages sent to this candidate yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {candidateHistory.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <StatusBadge status={m.status} isPermanent={m.is_permanent_failure} size="sm" />
                      <span className="text-zinc-400 text-[11px]">
                        {new Date(m.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-zinc-800 dark:text-zinc-200 line-clamp-2">{m.content}</p>
                    {m.failure_reason && (
                      <p className="text-rose-500 mt-1 text-[11px]">Reason: {m.failure_reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-zinc-100 dark:border-zinc-800 p-4 flex items-center justify-end gap-3 bg-zinc-50/50 dark:bg-zinc-900/80">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !selectedCandidateId || !content.trim()}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm font-medium transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            {isSending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending Message...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Message
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
