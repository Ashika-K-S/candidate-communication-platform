import React, { useState } from "react";
import { Candidate, BulkSendResponse } from "@/types";
import { messagesApi } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";
import { X, Send, Users, CheckSquare, Square, AlertCircle, ChevronRight, RefreshCw } from "lucide-react";

interface BulkCampaignModalProps {
  isOpen: boolean;
  candidates: Candidate[];
  onClose: () => void;
  onCampaignComplete: () => void;
}

export function BulkCampaignModal({
  isOpen,
  candidates,
  onClose,
  onCampaignComplete,
}: BulkCampaignModalProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [content, setContent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [campaignResult, setCampaignResult] = useState<BulkSendResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<{ recipients?: string; content?: string }>({});

  if (!isOpen) return null;

  const filteredCandidates = candidates.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
  );

  const isAllFilteredSelected =
    filteredCandidates.length > 0 &&
    filteredCandidates.every((c) => selectedIds.includes(c.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIds = new Set(filteredCandidates.map((c) => c.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...filteredCandidates.map((c) => c.id)]);
      setSelectedIds(Array.from(newIds));
      if (formErrors.recipients) setFormErrors((prev) => ({ ...prev, recipients: "" }));
    }
  };

  const handleToggleCandidate = (id: number) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      if (next.length > 0 && formErrors.recipients) {
        setFormErrors((errs) => ({ ...errs, recipients: "" }));
      }
      return next;
    });
  };

  const validate = (): boolean => {
    const errs: { recipients?: string; content?: string } = {};

    if (selectedIds.length === 0) {
      errs.recipients = "At least one candidate must be selected.";
    }

    const trimmed = content.trim();
    if (!trimmed) {
      errs.content = "Message cannot be empty.";
    } else if (trimmed.length > 1600) {
      errs.content = "Message exceeds the allowed length (maximum 1600 characters).";
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleProceedToConfirm = () => {
    if (validate()) {
      setIsConfirming(true);
    }
  };

  const handleStartSending = async () => {
    if (!validate() || isSending) return;

    setIsSending(true);
    setApiError(null);
    setCampaignResult(null);

    try {
      const res = await messagesApi.bulkSend(selectedIds, content.trim());
      setCampaignResult(res);
      setIsConfirming(false);
      onCampaignComplete();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to dispatch bulk campaign.");
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    setCampaignResult(null);
    setIsConfirming(false);
    setSelectedIds([]);
    setContent("");
    setFormErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Bulk Communication Campaign</h3>
              <p className="text-xs text-zinc-500">Dispatch messages to multiple selected candidates independently</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {apiError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{apiError}</span>
            </div>
          )}

          {/* Results Screen */}
          {campaignResult ? (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-xl border text-xs ${
                  campaignResult.successful === 0 && campaignResult.total > 0
                    ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                    : campaignResult.failed > 0
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                    : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                }`}
              >
                <p className="font-semibold text-sm">
                  {campaignResult.successful === 0 && campaignResult.total > 0
                    ? "Campaign Failed: All recipient messages failed to dispatch."
                    : campaignResult.failed > 0
                    ? "Campaign Partially Completed with Errors"
                    : "Campaign Dispatched Successfully!"}
                </p>
                <p className="mt-0.5 text-xs">
                  {campaignResult.successful} sent successfully, {campaignResult.failed} failed out of {campaignResult.total} recipient(s).
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-4">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Campaign Summary</h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-white dark:bg-zinc-900 p-2.5 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-xs text-zinc-500">Total Recipients</span>
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">{campaignResult.total}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2.5 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">Successful</span>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{campaignResult.successful}</p>
                  </div>
                  <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-2.5 border border-rose-200 dark:border-rose-800">
                    <span className="text-xs text-rose-600 dark:text-rose-400">Failed</span>
                    <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{campaignResult.failed}</p>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 block">
                  Individual Candidate Results
                </span>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {campaignResult.results.map((res) => (
                    <div
                      key={res.candidate_id}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                        res.status === "sent"
                          ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/10"
                          : "border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/10"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          {res.candidate_name || `Candidate ID #${res.candidate_id}`}
                        </p>
                        {res.provider_message_id && (
                          <p className="text-[11px] text-zinc-500 font-mono">Ref: {res.provider_message_id}</p>
                        )}
                        {res.failure_reason && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                            Error: {res.failure_reason}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={res.status} isPermanent={res.is_permanent_failure} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : isConfirming ? (
            /* Confirmation Screen */
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-xs">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold mb-1">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Confirm Campaign Dispatch
                </div>
                <p className="text-amber-700 dark:text-amber-400">
                  You are about to send this message to{" "}
                  <strong className="underline">{selectedIds.length} candidate{selectedIds.length > 1 ? "s" : ""}</strong>.
                  Each recipient is processed independently.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 p-3.5">
                <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Message Preview</span>
                <p className="mt-1 text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{content}</p>
              </div>

              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2 block">
                  Selected Recipients ({selectedIds.length})
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {candidates
                    .filter((c) => selectedIds.includes(c.id))
                    .map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300"
                      >
                        {c.name}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            /* Compose & Selection Screen */
            <div className="space-y-4">
              {/* Recipient Selection Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                    Select Recipients ({selectedIds.length} chosen)
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                  >
                    {isAllFilteredSelected ? (
                      <>
                        <CheckSquare className="h-3.5 w-3.5" /> Deselect All
                      </>
                    ) : (
                      <>
                        <Square className="h-3.5 w-3.5" /> Select All ({filteredCandidates.length})
                      </>
                    )}
                  </button>
                </div>
                {formErrors.recipients && (
                  <p className="text-xs text-rose-500 font-medium">{formErrors.recipients}</p>
                )}

                <input
                  type="text"
                  placeholder="Filter candidates by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {filteredCandidates.length === 0 ? (
                    <p className="p-3 text-xs text-zinc-400 text-center italic">No candidates match your search.</p>
                  ) : (
                    filteredCandidates.map((c) => {
                      const isSelected = selectedIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleToggleCandidate(c.id)}
                          className={`p-2.5 flex items-center justify-between cursor-pointer text-xs transition ${
                            isSelected
                              ? "bg-indigo-50/60 dark:bg-indigo-950/30"
                              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="text-indigo-600 dark:text-indigo-400">
                              {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-zinc-400" />}
                            </div>
                            <div>
                              <p className="font-semibold text-zinc-900 dark:text-white">{c.name}</p>
                              <p className="text-[11px] text-zinc-500">{c.phone} &bull; {c.email}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Message Content */}
                <label
                  htmlFor="bulk-campaign-message"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5"
                >
                  Campaign Message *
                </label>
                <textarea
                  id="bulk-campaign-message"
                  rows={4}
                  placeholder="Enter the broadcast message to send to all selected candidates..."
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    if (formErrors.content) setFormErrors((prev) => ({ ...prev, content: "" }));
                  }}
                  aria-invalid={!!formErrors.content}
                  className={`w-full rounded-xl border bg-white dark:bg-zinc-950 p-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 resize-none ${
                    formErrors.content
                      ? "border-rose-500 focus:ring-rose-500"
                      : "border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500"
                  }`}
                />
                {formErrors.content && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.content}</p>
                )}
                <div className="mt-1 flex justify-between text-xs text-zinc-500">
                  <span>Selected: {selectedIds.length} candidate{selectedIds.length !== 1 ? "s" : ""}</span>
                  <span className={content.length > 1600 ? "text-rose-500 font-semibold" : ""}>
                    {content.length}/1600 characters
                  </span>
                </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 dark:border-zinc-800 p-4 flex items-center justify-end gap-3 bg-zinc-50/50 dark:bg-zinc-900/80">
          {campaignResult ? (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 px-5 py-2 text-sm font-medium transition"
            >
              Done & Return
            </button>
          ) : isConfirming ? (
            <>
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                disabled={isSending}
                className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleStartSending}
                disabled={isSending}
                className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 text-sm font-medium transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Dispatching Campaign...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Confirm & Send to {selectedIds.length}
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToConfirm}
                disabled={selectedIds.length === 0 || !content.trim()}
                className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 text-sm font-medium transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                Review Campaign ({selectedIds.length})
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
