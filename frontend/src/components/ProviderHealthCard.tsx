import React, { useState } from "react";
import { ProviderHealth } from "@/types";
import { providerApi } from "@/lib/api";
import { Activity, RefreshCw, Zap, ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";

interface ProviderHealthCardProps {
  health: ProviderHealth | null;
  loading: boolean;
  onRefresh: () => void;
}

export function ProviderHealthCard({ health, loading, onRefresh }: ProviderHealthCardProps) {
  const [simProviderId, setSimProviderId] = useState("");
  const [simStatus, setSimStatus] = useState<"delivered" | "read" | "failed">("delivered");
  const [simReason, setSimReason] = useState("");
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<{ success: boolean; message: string } | null>(null);

  const isHealthy = health?.status === "healthy";

  const handleSimulateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simProviderId.trim()) {
      setSimResult({ success: false, message: "Provider Message ID is required to simulate a delivery event." });
      return;
    }

    setSimLoading(true);
    setSimResult(null);

    try {
      const data = await providerApi.simulateEvent({
        provider_message_id: simProviderId.trim(),
        status: simStatus,
        failure_reason: simStatus === "failed" ? simReason.trim() || "Carrier rejected" : undefined,
      });

      if (data.backend_status_code === 200 || (!data.backend_status_code && !data.error)) {
        setSimResult({
          success: true,
          message: `Delivery event '${simStatus}' dispatched through backend! Backend response: ${JSON.stringify(
            data.backend_response || data
          )}`,
        });
      } else {
        setSimResult({
          success: false,
          message: `Simulation error: ${data.message || JSON.stringify(data.backend_response || data)}`,
        });
      }
    } catch (err: unknown) {
      setSimResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to simulate delivery event",
      });
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              isHealthy ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            }`}
          >
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-zinc-900 dark:text-white">Communication Provider</h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                  isHealthy
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isHealthy ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                {isHealthy ? "Operational" : "Unavailable"}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Service: <span className="font-mono text-zinc-700 dark:text-zinc-300">dummy-provider (127.0.0.1:8001)</span>
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 transition hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Checking..." : "Check Latency"}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/40 p-4">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Health Status</span>
          <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
            {isHealthy ? (
              <>
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Healthy & Connected
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-rose-500" /> Service Unreachable
              </>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/40 p-4">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Roundtrip Latency</span>
          <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
            {health?.latency_ms !== undefined ? `${health.latency_ms} ms` : "N/A"}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/40 p-4">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Simulation Engine</span>
          <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500" /> Webhook Simulator Ready
          </p>
        </div>
      </div>

      {/* Simulator Section */}
      <div className="mt-6 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/30 dark:bg-zinc-800/20 p-5">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Test Delivery Status Webhook Simulator
          </h4>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Simulate a provider webhook callback event without waiting for third-party carriers.
        </p>

        <form onSubmit={handleSimulateEvent} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
              Provider Message ID
            </label>
            <input
              type="text"
              placeholder="e.g. prov_msg_..."
              value={simProviderId}
              onChange={(e) => setSimProviderId(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="w-36">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
              Event Status
            </label>
            <select
              value={simStatus}
              onChange={(e) => setSimStatus(e.target.value as "delivered" | "read" | "failed")}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="delivered">Delivered</option>
              <option value="read">Read</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {simStatus === "failed" && (
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                Failure Reason
              </label>
              <input
                type="text"
                placeholder="Reason (optional)"
                value={simReason}
                onChange={(e) => setSimReason(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={simLoading || !simProviderId.trim()}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-medium transition disabled:opacity-50 flex items-center gap-1.5 h-[36px]"
          >
            {simLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            Fire Webhook Event
          </button>
        </form>

        {simResult && (
          <div
            className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2 ${
              simResult.success
                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
            }`}
          >
            {simResult.success ? (
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
            )}
            <span className="break-all">{simResult.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
