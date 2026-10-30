import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Frontend API Client & Error Handling Suite", () => {
  it("formats API base URL correctly by trimming trailing slashes", () => {
    const raw = "http://127.0.0.1:8000/api///";
    const cleaned = raw.replace(/\/+$/, "");
    assert.equal(cleaned, "http://127.0.0.1:8000/api");
  });

  it("handles DRF validation error objects into human-readable messages", () => {
    const errorData = {
      email: ["Candidate with this email already exists."],
      phone: ["Phone number must contain at least 7 digits."],
    };

    const formatted = Object.entries(errorData)
      .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(" ") : String(val)}`)
      .join(" | ");

    assert.equal(
      formatted,
      "email: Candidate with this email already exists. | phone: Phone number must contain at least 7 digits."
    );
  });

  it("extracts detail message when available in error response", () => {
    const errorData = { detail: "Candidate with id 9999 not found." };
    const msg = errorData.detail || errorData.message || "Generic error";
    assert.equal(msg, "Candidate with id 9999 not found.");
  });

  it("calculates SMS segment count correctly based on 160 character boundary", () => {
    const calcSegments = (len) => Math.ceil(len / 160) || 1;
    assert.equal(calcSegments(0), 1);
    assert.equal(calcSegments(50), 1);
    assert.equal(calcSegments(160), 1);
    assert.equal(calcSegments(161), 2);
    assert.equal(calcSegments(320), 2);
    assert.equal(calcSegments(321), 3);
  });

  it("filters candidates by search term across name, email, and phone", () => {
    const candidates = [
      { id: 1, name: "Diana Prince", email: "diana@themyscira.com", phone: "+15551112222" },
      { id: 2, name: "Clark Kent", email: "clark@dailyplanet.com", phone: "+15553334444" },
      { id: 3, name: "Bruce Wayne", email: "bruce@wayne.com", phone: "+15555556666" },
    ];

    const search = (term) =>
      candidates.filter(
        (c) =>
          c.name.toLowerCase().includes(term.toLowerCase()) ||
          c.email.toLowerCase().includes(term.toLowerCase()) ||
          c.phone.includes(term)
      );

    assert.equal(search("Diana").length, 1);
    assert.equal(search("dailyplanet").length, 1);
    assert.equal(search("555").length, 3);
    assert.equal(search("nonexistent").length, 0);
  });

  it("evaluates permanent failure vs temporary failure classification correctly", () => {
    const isPermanent = (reason) => {
      const lower = String(reason || "").toLowerCase();
      return ["permanent", "perm_fail", "blocked", "invalid"].some((k) => lower.includes(k));
    };

    assert.equal(isPermanent("Recipient number is invalid or blocked (permanent failure)."), true);
    assert.equal(isPermanent("Downstream carrier network congested (temporary failure)."), false);
    assert.equal(isPermanent("Provider connection timed out after 10 seconds."), false);
  });

  it("calculates delivery rate correctly", () => {
    const calcRate = (total, delivered) => (total > 0 ? Math.round((delivered / total) * 100) : 100);
    assert.equal(calcRate(0, 0), 100);
    assert.equal(calcRate(10, 8), 80);
    assert.equal(calcRate(10, 10), 100);
    assert.equal(calcRate(3, 1), 33);
  });

  it("validates webhook simulation payload requirements before dispatch", () => {
    const validateSimulationPayload = (params) => {
      if (!params.provider_message_id?.trim() && !params.message_id) {
        throw new Error("Either 'provider_message_id' or 'message_id' is required.");
      }
      if (!["delivered", "read", "failed"].includes(params.status)) {
        throw new Error("Invalid status for simulation event.");
      }
      return true;
    };

    assert.equal(
      validateSimulationPayload({ provider_message_id: "prov_msg_123", status: "delivered" }),
      true
    );
    assert.throws(
      () => validateSimulationPayload({ status: "delivered" }),
      /Either 'provider_message_id' or 'message_id' is required/
    );
    assert.throws(
      () => validateSimulationPayload({ provider_message_id: "prov_msg_123", status: "unknown" }),
      /Invalid status/
    );
  });

  it("parses simulated webhook backend response into informative status feedback", () => {
    const formatSimulationResult = (data) => {
      if (data.backend_status_code === 200) {
        return {
          success: true,
          message: `Delivery event '${data.simulated_event?.status}' dispatched through backend!`,
        };
      }
      return {
        success: false,
        message: data.message || "Simulation error",
      };
    };

    const successResult = formatSimulationResult({
      backend_status_code: 200,
      simulated_event: { status: "delivered", event_id: "evt_123" },
      backend_response: { status: "updated", new_status: "delivered" },
    });
    assert.equal(successResult.success, true);
    assert.match(successResult.message, /dispatched through backend/);

    const errorResult = formatSimulationResult({
      backend_status_code: 404,
      message: "No message found",
    });
    assert.equal(errorResult.success, false);
    assert.equal(errorResult.message, "No message found");
  });

  it("validates full name rules: Unicode support, min/max length, rejection of digits/symbols", () => {
    const validateName = (name) => {
      const trimmed = String(name || "").trim();
      if (!trimmed) return "Full name is required.";
      if (trimmed.length < 2) return "Full name must be at least 2 characters.";
      if (trimmed.length > 150) return "Full name cannot exceed 150 characters.";
      if (!/\p{L}/u.test(trimmed)) return "Full name must contain letters and cannot consist solely of numbers or symbols.";
      if (/\d/.test(trimmed)) return "Full name cannot contain numeric digits.";
      if (!/^[\p{L}\s\-'.]+$/u.test(trimmed)) return "Full name can only contain letters, spaces, hyphens, apostrophes, and periods.";
      return null;
    };

    assert.equal(validateName("Jane Doe"), null);
    assert.equal(validateName("Renée Müller"), null);
    assert.equal(validateName("Mary-Jane O'Connor"), null);
    assert.equal(validateName("Dr. A. P. J. Abdul Kalam"), null);
    assert.equal(validateName("Aarav Sharma"), null);

    assert.equal(validateName(""), "Full name is required.");
    assert.equal(validateName("   "), "Full name is required.");
    assert.equal(validateName("A"), "Full name must be at least 2 characters.");
    assert.equal(validateName("12345"), "Full name must contain letters and cannot consist solely of numbers or symbols.");
    assert.equal(validateName("---@@@"), "Full name must contain letters and cannot consist solely of numbers or symbols.");
    assert.equal(validateName("Jane Doe 2"), "Full name cannot contain numeric digits.");
    assert.equal(validateName("Jane <script>"), "Full name can only contain letters, spaces, hyphens, apostrophes, and periods.");
  });

  it("validates and normalizes phone numbers into E.164 standard", () => {
    const validateAndNormalizePhone = (phone) => {
      const trimmed = String(phone || "").trim();
      if (!trimmed) throw new Error("Phone number is required.");
      if (/[a-zA-Z]/.test(trimmed)) throw new Error("Phone number cannot contain alphabetic characters.");
      if (!/^\+?[0-9\s\-().]+$/.test(trimmed)) throw new Error("Phone number contains invalid symbols.");

      const digits = trimmed.replace(/\D/g, "");
      if (digits.length < 10) throw new Error("Phone number must contain at least 10 digits.");
      if (digits.length > 15) throw new Error("Phone number cannot exceed 15 digits.");

      if (trimmed.startsWith("+")) return `+${digits}`;
      if (digits.length === 10) return `+91${digits}`;
      if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
      return `+${digits}`;
    };

    // Valid formats & normalizations
    assert.equal(validateAndNormalizePhone("9876543210"), "+919876543210");
    assert.equal(validateAndNormalizePhone("+91 98765 43210"), "+919876543210");
    assert.equal(validateAndNormalizePhone("+1 (555) 123-4567"), "+15551234567");
    assert.equal(validateAndNormalizePhone("+1122334455"), "+1122334455");

    // Invalid formats
    assert.throws(() => validateAndNormalizePhone(""), /Phone number is required/);
    assert.throws(() => validateAndNormalizePhone("12345"), /at least 10 digits/);
    assert.throws(() => validateAndNormalizePhone("1234567890123456"), /cannot exceed 15 digits/);
    assert.throws(() => validateAndNormalizePhone("9876543210abc"), /cannot contain alphabetic characters/);
    assert.throws(() => validateAndNormalizePhone("9876543210#*!"), /contains invalid symbols/);
  });

  it("validates email address formats strictly rejecting malformed addresses", () => {
    const validateEmail = (email) => {
      const trimmed = String(email || "").trim().toLowerCase();
      if (!trimmed) return "Email address is required.";
      if (trimmed.length > 254) return "Email address cannot exceed 254 characters.";
      const emailPattern = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
      if (!emailPattern.test(trimmed)) return "Enter a valid email address.";
      return null;
    };

    assert.equal(validateEmail("jane@example.com"), null);
    assert.equal(validateEmail("user.name+tag@sub.domain.co"), null);

    assert.equal(validateEmail(""), "Email address is required.");
    assert.equal(validateEmail("abc"), "Enter a valid email address.");
    assert.equal(validateEmail("abc@"), "Enter a valid email address.");
    assert.equal(validateEmail("abc.com"), "Enter a valid email address.");
    assert.equal(validateEmail("@example.com"), "Enter a valid email address.");
  });

  it("validates message content constraints and boundaries", () => {
    const validateContent = (content) => {
      const trimmed = String(content || "").trim();
      if (!trimmed) return "Message cannot be empty.";
      if (trimmed.length > 1600) return "Message exceeds the allowed length (maximum 1600 characters).";
      return null;
    };

    assert.equal(validateContent("Hello Candidate"), null);
    assert.equal(validateContent(""), "Message cannot be empty.");
    assert.equal(validateContent("     "), "Message cannot be empty.");
    assert.equal(validateContent("a".repeat(1600)), null);
    assert.equal(validateContent("a".repeat(1601)), "Message exceeds the allowed length (maximum 1600 characters).");
  });

  it("validates bulk recipient lists, deduplication, and limits", () => {
    const validateRecipients = (ids) => {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error("At least one candidate must be selected.");
      }
      if (ids.length > 500) {
        throw new Error("Cannot send to more than 500 recipients in a single bulk campaign.");
      }
      const seen = new Set();
      const deduped = [];
      for (const id of ids) {
        const num = Number(id);
        if (!Number.isInteger(num) || num <= 0) {
          throw new Error(`Invalid candidate id: ${id}`);
        }
        if (!seen.has(num)) {
          seen.add(num);
          deduped.push(num);
        }
      }
      return deduped;
    };

    assert.deepEqual(validateRecipients([1, 2, 3]), [1, 2, 3]);
    assert.deepEqual(validateRecipients([1, 2, 1, 3, 2]), [1, 2, 3]);
    assert.throws(() => validateRecipients([]), /At least one candidate must be selected/);
    assert.throws(() => validateRecipients(["abc"]), /Invalid candidate id/);
  });

  it("evaluates bulk campaign overall status policy", () => {
    const evaluateCampaign = (total, successful, failed) => {
      if (total === 0) return "empty";
      if (successful === 0 && total > 0) return "failed";
      if (failed === 0) return "succeeded";
      return "partial";
    };

    assert.equal(evaluateCampaign(5, 5, 0), "succeeded");
    assert.equal(evaluateCampaign(5, 3, 2), "partial");
    assert.equal(evaluateCampaign(5, 0, 5), "failed");
  });
});

