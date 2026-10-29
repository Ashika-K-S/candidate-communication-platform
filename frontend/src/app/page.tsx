"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Candidate, Message, ProviderHealth, CandidateFormData } from "@/types";
import { candidatesApi, messagesApi, providerApi } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { StatsCards } from "@/components/StatsCards";
import { StatusBadge } from "@/components/StatusBadge";
import { CandidateModal } from "@/components/CandidateModal";
import { DirectMessageModal } from "@/components/DirectMessageModal";
import { BulkCampaignModal } from "@/components/BulkCampaignModal";
import { CandidateHistoryDrawer } from "@/components/CandidateHistoryDrawer";
import { RetryModal } from "@/components/RetryModal";
import { ProviderHealthCard } from "@/components/ProviderHealthCard";
import {
  Send,
  MessageSquareShare,
  Search,
  UserPlus,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  AlertCircle,
  History,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
} from "lucide-react";

export default function DashboardPage() {
  // Navigation
  const [currentTab, setCurrentTab] = useState<string>("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data states
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth | null>(null);

  // Loading states
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Filtering states
  const [candidateSearch, setCandidateSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [messageStatusFilter, setMessageStatusFilter] = useState<string>("");

  // Modals & Drawers
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [candidateToEdit, setCandidateToEdit] = useState<Candidate | null>(null);

  const [isDirectMessageOpen, setIsDirectMessageOpen] = useState(false);
  const [directMessageCandidate, setDirectMessageCandidate] = useState<Candidate | null>(null);

  const [isBulkCampaignOpen, setIsBulkCampaignOpen] = useState(false);

  const [selectedDrawerCandidate, setSelectedDrawerCandidate] = useState<Candidate | null>(null);

  const [retryModalMessage, setRetryModalMessage] = useState<Message | null>(null);

  // Notifications / Feedback
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch Candidates
  const fetchCandidates = useCallback(async (searchQuery?: string) => {
    setLoadingCandidates(true);
    try {
      const data = await candidatesApi.list(searchQuery);
      setCandidates(data);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to load candidates", "error");
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  // 2. Fetch Messages
  const fetchMessages = useCallback(async (status?: string, search?: string) => {
    setLoadingMessages(true);
    try {
      const data = await messagesApi.list({
        status: status || undefined,
        search: search || undefined,
      });
      setMessages(data);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to load messages", "error");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // 3. Fetch Provider Health
  const fetchHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const data = await providerApi.health();
      setProviderHealth(data);
    } catch {
      setProviderHealth({
        status: "unhealthy",
        provider: "dummy-provider",
        error: "Provider service unreachable",
      });
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  // Initial Data Load
  useEffect(() => {
    fetchCandidates();
    fetchMessages();
    fetchHealth();
  }, [fetchCandidates, fetchMessages, fetchHealth]);

  // Debounced Candidate Search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCandidates(candidateSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [candidateSearch, fetchCandidates]);

  // Debounced Message Search / Filter
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMessages(messageStatusFilter, messageSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [messageSearch, messageStatusFilter, fetchMessages]);

  // Candidate Save Handler (Add / Edit)
  const handleSaveCandidate = async (formData: CandidateFormData) => {
    if (candidateToEdit) {
      const updated = await candidatesApi.update(candidateToEdit.id, formData);
      setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast(`Candidate ${updated.name} updated successfully!`);
    } else {
      const created = await candidatesApi.create(formData);
      setCandidates((prev) => [created, ...prev]);
      showToast(`Candidate ${created.name} added successfully!`);
    }
  };

  // Candidate Delete Handler
  const handleDeleteCandidate = async (candidate: Candidate) => {
    if (!window.confirm(`Are you sure you want to delete candidate ${candidate.name}?`)) {
      return;
    }
    try {
      await candidatesApi.delete(candidate.id);
      setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
      showToast(`Candidate ${candidate.name} deleted.`);
      fetchMessages();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to delete candidate.", "error");
    }
  };

  // Compute Stats Summary
  const totalCandidates = candidates.length;
  const totalMessages = messages.length;
  const deliveredMessages = messages.filter((m) => m.status === "delivered" || m.status === "read").length;
  const failedMessages = messages.filter((m) => m.status === "failed").length;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50/60 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        candidateCount={totalCandidates}
        messageCount={totalMessages}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenDirectMessage={() => {
          setDirectMessageCandidate(null);
          setIsDirectMessageOpen(true);
        }}
        onOpenBulkCampaign={() => setIsBulkCampaignOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Navbar */}
        <Navbar
          currentTab={currentTab}
          providerHealth={providerHealth}
          healthLoading={loadingHealth}
          onRefreshHealth={fetchHealth}
          onOpenAddCandidate={() => {
            setCandidateToEdit(null);
            setIsCandidateModalOpen(true);
          }}
          onOpenDirectMessage={() => {
            setDirectMessageCandidate(null);
            setIsDirectMessageOpen(true);
          }}
          onOpenBulkCampaign={() => setIsBulkCampaignOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Global Toast */}
        {toast && (
          <div
            className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-xs font-semibold shadow-xl border animate-in slide-in-from-bottom-3 duration-200 ${
              toast.type === "success"
                ? "bg-zinc-900 text-white border-zinc-700 dark:bg-white dark:text-zinc-900"
                : "bg-rose-600 text-white border-rose-700"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-white" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Main Body Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW DASHBOARD */}
          {/* ========================================================================= */}
          {currentTab === "overview" && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <StatsCards
                totalCandidates={totalCandidates}
                totalMessages={totalMessages}
                deliveredMessages={deliveredMessages}
                failedMessages={failedMessages}
                onFilterFailed={() => {
                  setMessageStatusFilter("failed");
                  setCurrentTab("messages");
                }}
                onFilterAll={() => {
                  setMessageStatusFilter("");
                  setCurrentTab("messages");
                }}
              />

              {/* Quick Launch Cards Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  onClick={() => {
                    setDirectMessageCandidate(null);
                    setIsDirectMessageOpen(true);
                  }}
                  className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-gradient-to-br from-blue-500/5 to-indigo-500/10 p-5 cursor-pointer hover:border-blue-500/40 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition">
                      <Send className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-zinc-900 dark:text-white">Direct Message</h4>
                      <p className="text-xs text-zinc-500">Dispatch an immediate communication</p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setIsBulkCampaignOpen(true)}
                  className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-gradient-to-br from-purple-500/5 to-pink-500/10 p-5 cursor-pointer hover:border-purple-500/40 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition">
                      <MessageSquareShare className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-zinc-900 dark:text-white">Bulk Campaign</h4>
                      <p className="text-xs text-zinc-500">Multi-candidate independent broadcasts</p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setCandidateToEdit(null);
                    setIsCandidateModalOpen(true);
                  }}
                  className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-gradient-to-br from-emerald-500/5 to-teal-500/10 p-5 cursor-pointer hover:border-emerald-500/40 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition">
                      <UserPlus className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-zinc-900 dark:text-white">Add Candidate</h4>
                      <p className="text-xs text-zinc-500">Expand your talent pool</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Feed */}
              <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-indigo-500" />
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">Recent Communications</h3>
                  </div>
                  <button
                    onClick={() => setCurrentTab("messages")}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View All &rarr;
                  </button>
                </div>

                {loadingMessages ? (
                  <div className="py-8 text-center text-xs text-zinc-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading communications...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-400 italic">
                    No communication messages sent yet. Click &quot;Direct Message&quot; above to start.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {messages.slice(0, 5).map((m) => (
                      <div key={m.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-900 dark:text-white">{m.candidate_name}</span>
                            <span className="text-zinc-400">&bull;</span>
                            <span className="text-zinc-500 font-mono text-[11px]">{m.candidate_phone}</span>
                          </div>
                          <p className="text-zinc-600 dark:text-zinc-300 line-clamp-1">{m.content}</p>
                          {m.failure_reason && (
                            <p className="text-rose-500 text-[11px]">Reason: {m.failure_reason}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <StatusBadge status={m.status} isPermanent={m.is_permanent_failure} size="sm" />
                          <span className="text-[11px] text-zinc-400">
                            {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {m.status === "failed" && (
                            <button
                              onClick={() => setRetryModalMessage(m)}
                              className="rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-1 text-xs font-semibold transition"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CANDIDATES DIRECTORY */}
          {/* ========================================================================= */}
          {currentTab === "candidates" && (
            <div className="space-y-4">
              {/* Search & Actions Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search candidates by name, email, or phone..."
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-10 pr-4 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchCandidates(candidateSearch)}
                    disabled={loadingCandidates}
                    className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingCandidates ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={() => {
                      setCandidateToEdit(null);
                      setIsCandidateModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-semibold transition shadow-sm"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add Candidate
                  </button>
                </div>
              </div>

              {/* Candidate Table */}
              <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 text-zinc-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-3.5 px-4">Candidate</th>
                        <th className="py-3.5 px-4">Contact</th>
                        <th className="py-3.5 px-4">Added On</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {loadingCandidates ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-zinc-400">
                            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-500" />
                            Loading candidates from PostgreSQL...
                          </td>
                        </tr>
                      ) : candidates.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-zinc-400 italic">
                            No candidates found. Click &quot;Add Candidate&quot; to create one.
                          </td>
                        </tr>
                      ) : (
                        candidates.map((c) => (
                          <tr key={c.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center shrink-0">
                                  {c.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-semibold text-zinc-900 dark:text-white block">{c.name}</span>
                                  <span className="text-[11px] text-zinc-400">ID #{c.id}</span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="space-y-1 text-zinc-600 dark:text-zinc-300">
                                <div className="flex items-center gap-1.5">
                                  <Mail className="h-3.5 w-3.5 text-zinc-400" />
                                  <span>{c.email}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Phone className="h-3.5 w-3.5 text-zinc-400" />
                                  <span className="font-mono">{c.phone}</span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-zinc-500">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                                <span>{new Date(c.created_at).toLocaleDateString()}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setDirectMessageCandidate(c);
                                    setIsDirectMessageOpen(true);
                                  }}
                                  title="Send Message"
                                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
                                >
                                  <Send className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setSelectedDrawerCandidate(c)}
                                  title="View Communication History"
                                  className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setCandidateToEdit(c);
                                    setIsCandidateModalOpen(true);
                                  }}
                                  title="Edit Candidate"
                                  className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCandidate(c)}
                                  title="Delete Candidate"
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: MESSAGE HISTORY & LOGS */}
          {/* ========================================================================= */}
          {currentTab === "messages" && (
            <div className="space-y-4">
              {/* Filter Tabs & Search */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl">
                  {["", "pending", "sent", "delivered", "read", "failed"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setMessageStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                        messageStatusFilter === st
                          ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                      }`}
                    >
                      {st || "All Messages"}
                    </button>
                  ))}
                </div>

                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search messages by content or candidate..."
                    value={messageSearch}
                    onChange={(e) => setMessageSearch(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-10 pr-4 py-2 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                </div>
              </div>

              {/* Messages Table */}
              <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 text-zinc-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-3.5 px-4">Recipient</th>
                        <th className="py-3.5 px-4">Message Content</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Provider Ref</th>
                        <th className="py-3.5 px-4">Timestamp</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {loadingMessages ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-zinc-400">
                            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-500" />
                            Loading message log...
                          </td>
                        </tr>
                      ) : messages.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-zinc-400 italic">
                            No messages match the current status filter.
                          </td>
                        </tr>
                      ) : (
                        messages.map((m) => (
                          <tr key={m.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-zinc-900 dark:text-white block">{m.candidate_name}</span>
                              <span className="text-[11px] text-zinc-400 font-mono">{m.candidate_phone}</span>
                            </td>

                            <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                              <p className="text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-relaxed">{m.content}</p>
                              {m.failure_reason && (
                                <p className="text-rose-500 mt-1 text-[11px] font-medium">
                                  Failure: {m.failure_reason}
                                </p>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <StatusBadge status={m.status} isPermanent={m.is_permanent_failure} size="sm" />
                            </td>

                            <td className="py-3.5 px-4 text-zinc-500 font-mono text-[11px]">
                              {m.provider_message_id || "-"}
                            </td>

                            <td className="py-3.5 px-4 text-zinc-400 text-[11px]">
                              {new Date(m.created_at).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              {m.status === "failed" ? (
                                <button
                                  onClick={() => setRetryModalMessage(m)}
                                  className="rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2.5 py-1 text-xs font-semibold transition"
                                >
                                  Retry
                                </button>
                              ) : (
                                <span className="text-[11px] text-zinc-400">Completed</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: PROVIDER HEALTH & DIAGNOSTICS */}
          {/* ========================================================================= */}
          {currentTab === "health" && (
            <div className="space-y-6">
              <ProviderHealthCard
                health={providerHealth}
                loading={loadingHealth}
                onRefresh={fetchHealth}
              />
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: Candidate Add/Edit */}
      <CandidateModal
        isOpen={isCandidateModalOpen}
        candidateToEdit={candidateToEdit}
        onClose={() => setIsCandidateModalOpen(false)}
        onSave={handleSaveCandidate}
      />

      {/* MODAL 2: Direct Single Messenger */}
      <DirectMessageModal
        isOpen={isDirectMessageOpen}
        candidates={candidates}
        preselectedCandidate={directMessageCandidate}
        onClose={() => setIsDirectMessageOpen(false)}
        onMessageSent={(newMsg) => {
          setMessages((prev) => [newMsg, ...prev]);
          showToast(`Message sent to ${newMsg.candidate_name}`);
        }}
      />

      {/* MODAL 3: Bulk Campaign */}
      <BulkCampaignModal
        isOpen={isBulkCampaignOpen}
        candidates={candidates}
        onClose={() => setIsBulkCampaignOpen(false)}
        onCampaignComplete={() => {
          fetchMessages();
          showToast("Bulk campaign dispatched successfully!");
        }}
      />

      {/* MODAL 4: Failed Message Retry */}
      <RetryModal
        isOpen={Boolean(retryModalMessage)}
        message={retryModalMessage}
        onClose={() => setRetryModalMessage(null)}
        onRetrySuccess={(updatedMsg) => {
          setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
          showToast(`Message #${updatedMsg.id} retried successfully! Status: ${updatedMsg.status}`);
        }}
      />

      {/* DRAWER: Candidate Profile & Full Timeline */}
      <CandidateHistoryDrawer
        candidate={selectedDrawerCandidate}
        onClose={() => setSelectedDrawerCandidate(null)}
        onComposeMessage={(cand) => {
          setSelectedDrawerCandidate(null);
          setDirectMessageCandidate(cand);
          setIsDirectMessageOpen(true);
        }}
        onRetryMessage={(msg) => {
          setRetryModalMessage(msg);
        }}
      />
    </div>
  );
}
