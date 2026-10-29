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
});

