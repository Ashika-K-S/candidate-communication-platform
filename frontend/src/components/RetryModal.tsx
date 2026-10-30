import React, { useState } from "react";
import { Message } from "@/types";
import { messagesApi } from "@/lib/api";
import { X, RefreshCw, AlertTriangle, ShieldAlert } from "lucide-react";

interface RetryModalProps {
  isOpen: boolean;
  message: Message | null;
  onClose: () => void;
  onRetrySuccess: (updatedMessage: Message) => void;
}

export function RetryModal({ isOpen, message, onClose, onRetrySuccess }: RetryModalProps) {
  const [force, setForce] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !message) return null;

  const isPermanent = message.is_permanent_failure;
  const isFailedState = message.status === "failed";

  const handleRetry = async () => {
    if (!isFailedState) {
      setErrorMsg(`Message #${message.id} is in '${message.status}' status and cannot be retried. Only failed messages can be retried.`);
      return;
    }

    if (isPermanent && !force) {
      setErrorMsg("This message has a permanent failure. You must check 'Force retry' to proceed.");
      return;
    }

    setIsRetrying(true);
    setErrorMsg(null);

    try {
      await messagesApi.retry(message.id, force);
      // Fetch refreshed message to ensure full object
      const fullMsg = await messagesApi.get(message.id);
      onRetrySuccess(fullMsg);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Retry attempt failed.");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Retry Failed Message</h3>
              <p className="text-xs text-zinc-500">Message ID #{message.id} &bull; Attempt #{message.retry_count + 1}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="mt-4 space-y-3.5 text-xs">
          <div>
            <span className="text-zinc-500 uppercase font-semibold tracking-wider text-[11px]">Recipient</span>
            <p className="font-medium text-zinc-900 dark:text-white text-sm">
              {message.candidate_name} &bull; {message.candidate_phone}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-3">
            <span className="text-zinc-500 uppercase font-semibold tracking-wider text-[11px]">Message Snippet</span>
            <p className="mt-1 text-zinc-800 dark:text-zinc-200 line-clamp-3">{message.content}</p>
          </div>

          <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-3">
            <span className="text-rose-600 dark:text-rose-400 uppercase font-semibold tracking-wider text-[11px] flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Failure Reason
            </span>
            <p className="mt-1 text-rose-800 dark:text-rose-300">{message.failure_reason || "Unknown failure reason"}</p>
          </div>

          {/* Permanent Failure Notice & Force Toggle */}
          {isPermanent && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3.5">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold mb-1">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                Permanent Carrier Failure Detected
              </div>
              <p className="text-amber-700 dark:text-amber-400 text-[11px] mb-3">
                This message was flagged as a permanent rejection (e.g. invalid recipient number or carrier block).
                Automatic retries are blocked to prevent spamming unreachable destinations.
              </p>

              <label className="flex items-start gap-2 cursor-pointer font-medium text-zinc-900 dark:text-white">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>Force retry despite permanent rejection warning</span>
              </label>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isRetrying}
            className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying || (isPermanent && !force)}
            className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 text-sm font-medium transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Execute Retry
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
