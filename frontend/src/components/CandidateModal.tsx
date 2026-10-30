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
    const name = formData.name.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim();

    // 1. Full name validation
    if (!name) {
      newErrors.name = "Full name is required.";
    } else if (name.length < 2) {
      newErrors.name = "Full name must be at least 2 characters.";
    } else if (name.length > 150) {
      newErrors.name = "Full name cannot exceed 150 characters.";
    } else if (!/\p{L}/u.test(name)) {
      newErrors.name = "Full name must contain letters and cannot consist solely of numbers or symbols.";
    } else if (/\d/.test(name)) {
      newErrors.name = "Full name cannot contain numeric digits.";
    } else if (!/^[\p{L}\s\-'.]+$/u.test(name)) {
      newErrors.name = "Full name can only contain letters, spaces, hyphens, apostrophes, and periods.";
    }

    // 2. Email address validation
    if (!email) {
      newErrors.email = "Email address is required.";
    } else if (email.length > 254) {
      newErrors.email = "Email address cannot exceed 254 characters.";
    } else if (!/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(email)) {
      newErrors.email = "Enter a valid email address.";
    }

    // 3. Phone number validation
    if (!phone) {
      newErrors.phone = "Phone number is required.";
    } else if (/[a-zA-Z]/.test(phone)) {
      newErrors.phone = "Phone number cannot contain alphabetic characters.";
    } else if (!/^\+?[0-9\s\-().]+$/.test(phone)) {
      newErrors.phone = "Phone number contains invalid symbols. Only digits, +, -, and spaces are allowed.";
    } else {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10) {
        newErrors.phone = "Phone number must contain at least 10 digits.";
      } else if (digits.length > 15) {
        newErrors.phone = "Phone number cannot exceed 15 digits.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const normalizePhone = (rawPhone: string): string => {
    const trimmed = rawPhone.trim();
    const digits = trimmed.replace(/\D/g, "");
    if (trimmed.startsWith("+")) {
      return `+${digits}`;
    }
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    if (digits.startsWith("91") && digits.length === 12) {
      return `+${digits}`;
    }
    return `+${digits}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: normalizePhone(formData.phone),
      });
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "fieldErrors" in err) {
        const fe = (err as { fieldErrors?: Record<string, string>; message?: string }).fieldErrors;
        if (fe && Object.keys(fe).length > 0) {
          setErrors((prev) => ({ ...prev, ...fe }));
        }
      }
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
            aria-label="Close dialog"
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          <div>
            <label
              htmlFor="candidate-name"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5"
            >
              Full Name *
            </label>
            <input
              id="candidate-name"
              type="text"
              placeholder="e.g. Jane Doe"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
              }}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "candidate-name-error" : undefined}
              className={`w-full rounded-xl border bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 ${
                errors.name
                  ? "border-rose-500 focus:ring-rose-500"
                  : "border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500"
              }`}
            />
            {errors.name && (
              <p id="candidate-name-error" className="mt-1 text-xs text-rose-500">
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="candidate-email"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5"
            >
              Email Address *
            </label>
            <input
              id="candidate-email"
              type="email"
              placeholder="e.g. jane.doe@example.com"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
              }}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "candidate-email-error" : undefined}
              className={`w-full rounded-xl border bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 ${
                errors.email
                  ? "border-rose-500 focus:ring-rose-500"
                  : "border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500"
              }`}
            />
            {errors.email && (
              <p id="candidate-email-error" className="mt-1 text-xs text-rose-500">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="candidate-phone"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5"
            >
              Phone Number *
            </label>
            <input
              id="candidate-phone"
              type="tel"
              placeholder="e.g. +91 98765 43210 or 9876543210"
              value={formData.phone}
              onChange={(e) => {
                setFormData({ ...formData, phone: e.target.value });
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }));
              }}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "candidate-phone-error" : undefined}
              className={`w-full rounded-xl border bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 ${
                errors.phone
                  ? "border-rose-500 focus:ring-rose-500"
                  : "border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500"
              }`}
            />
            {errors.phone && (
              <p id="candidate-phone-error" className="mt-1 text-xs text-rose-500">
                {errors.phone}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
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
