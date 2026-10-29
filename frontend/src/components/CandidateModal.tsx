import React, { useState, useEffect } from "react";
import { Candidate, CandidateFormData } from "@/types";
import { X, UserPlus, Save, AlertCircle } from "lucide-react";

interface CandidateModalProps {
  isOpen: boolean;
  candidateToEdit?: Candidate | null;
  onClose: () => void;
  onSave: (data: CandidateFormData) => Promise<void>;
}

export function CandidateModal({ isOpen, candidateToEdit, onClose, onSave }: CandidateModalProps) {
  const [formData, setFormData] = useState<CandidateFormData>({
    name: "",
    email: "",
    phone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (candidateToEdit) {
      setFormData({
        name: candidateToEdit.name,
        email: candidateToEdit.email,
        phone: candidateToEdit.phone,
      });
    } else {
      setFormData({ name: "", email: "", phone: "" });
    }
    setErrors({});
    setApiError(null);
  }, [candidateToEdit, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "Full name is required.";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = "Enter a valid email address.";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required.";
    } else {
      const digits = formData.phone.replace(/\D/g, "");
      if (digits.length < 7) {
        newErrors.phone = "Phone number must contain at least 7 digits.";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
      });
      onClose();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Failed to save candidate.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              {candidateToEdit ? <Save className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
              {candidateToEdit ? "Edit Candidate" : "Add New Candidate"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {apiError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
            <span>{apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Jane Doe"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full rounded-xl border bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 ${
                errors.name
                  ? "border-rose-500 focus:ring-rose-500"
                  : "border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500"
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
              Email Address *
            </label>
            <input
              type="email"
              placeholder="e.g. jane.doe@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full rounded-xl border bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 ${
                errors.email
                  ? "border-rose-500 focus:ring-rose-500"
                  : "border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500"
              }`}
            />
            {errors.email && <p className="mt-1 text-xs text-rose-500">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
              Phone Number *
            </label>
            <input
              type="text"
              placeholder="e.g. +1 555-123-4567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={`w-full rounded-xl border bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 ${
                errors.phone
                  ? "border-rose-500 focus:ring-rose-500"
                  : "border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500"
              }`}
            />
            {errors.phone && <p className="mt-1 text-xs text-rose-500">{errors.phone}</p>}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-sm font-medium transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : candidateToEdit ? (
                "Update Candidate"
              ) : (
                "Create Candidate"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
