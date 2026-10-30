import {
  Candidate,
  CandidateFormData,
  Message,
  BulkSendResponse,
  ProviderHealth,
} from "@/types";

/**
 * Resolves and normalizes the backend API base URL:
 * - Checks NEXT_PUBLIC_API_URL first, then NEXT_PUBLIC_API_BASE_URL, then API_URL (fallback for SSR/Node),
 *   defaulting to "http://127.0.0.1:8000/api" for local development.
 * - Trims whitespace and trailing slashes.
 * - Prevents duplicate /api/api paths.
 * - Guarantees that the base URL ends with "/api".
 */
export function resolveApiBaseUrl(rawEnv?: string): string {
  const envUrl =
    rawEnv ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_URL ||
    "http://127.0.0.1:8000/api";

  let cleaned = envUrl.trim().replace(/\/+$/, "");

  // Prevent duplicate /api/api if configured like https://domain.com/api/api
  cleaned = cleaned.replace(/(\/api)+$/i, "/api");

  // Ensure base URL ends with /api
  if (!cleaned.toLowerCase().endsWith("/api")) {
    cleaned = `${cleaned}/api`;
  }

  return cleaned;
}

/**
 * Builds a request URL ensuring no duplicate /api/api/ paths.
 */
export function buildRequestUrl(endpoint: string, baseUrl: string = API_BASE_URL): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  // Ensure leading slash
  let cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // Prevent duplicate /api if endpoint also starts with /api (e.g. "/api/candidates/" when base is ".../api")
  if (cleanEndpoint.toLowerCase().startsWith("/api/")) {
    cleanEndpoint = cleanEndpoint.slice(4);
  } else if (cleanEndpoint.toLowerCase() === "/api") {
    cleanEndpoint = "/";
  }

  return `${normalizedBase}${cleanEndpoint}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown> | null;
  fieldErrors: Record<string, string>;

  constructor(
    message: string,
    status: number,
    data: Record<string, unknown> | null = null,
    fieldErrors: Record<string, string> = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = buildRequestUrl(endpoint, API_BASE_URL);
  
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Network error";
    throw new ApiError(
      `Unable to connect to backend at ${API_BASE_URL}. Ensure Django is running. (${errorMsg})`,
      0
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  let responseData: unknown = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await response.text();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    let friendlyMessage = `Request failed with status ${response.status}`;
    const dataObj = typeof responseData === "object" && responseData !== null
      ? (responseData as Record<string, unknown>)
      : null;
    const extractedFieldErrors: Record<string, string> = {};

    if (dataObj) {
      if (typeof dataObj.detail === "string") {
        friendlyMessage = dataObj.detail;
      } else if (typeof dataObj.message === "string") {
        friendlyMessage = dataObj.message;
      } else if (typeof dataObj.error === "string") {
        friendlyMessage = dataObj.error;
      }

      // Collect field validation errors: {"email": ["This field must be unique."], ...}
      for (const [key, val] of Object.entries(dataObj)) {
        if (key !== "detail" && key !== "message" && key !== "error") {
          extractedFieldErrors[key] = Array.isArray(val) ? val.join(" ") : String(val);
        }
      }

      const formattedFieldErrors = Object.entries(extractedFieldErrors)
        .map(([key, val]) => `${key}: ${val}`)
        .join(" | ");

      if (formattedFieldErrors && friendlyMessage.startsWith("Request failed with status")) {
        friendlyMessage = formattedFieldErrors;
      }
    } else if (typeof responseData === "string" && responseData.trim()) {
      friendlyMessage = responseData;
    }

    throw new ApiError(friendlyMessage, response.status, dataObj, extractedFieldErrors);
  }

  return responseData as T;
}

export const candidatesApi = {
  list: async (search?: string): Promise<Candidate[]> => {
    const query = search ? `?search=${encodeURIComponent(search.trim())}` : "";
    return request<Candidate[]>(`/candidates/${query}`);
  },

  get: async (id: number): Promise<Candidate> => {
    return request<Candidate>(`/candidates/${id}/`);
  },

  create: async (data: CandidateFormData): Promise<Candidate> => {
    return request<Candidate>("/candidates/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: Partial<CandidateFormData>): Promise<Candidate> => {
    return request<Candidate>(`/candidates/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number): Promise<void> => {
    return request<void>(`/candidates/${id}/`, {
      method: "DELETE",
    });
  },

  getMessages: async (id: number, status?: string): Promise<Message[]> => {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<Message[]>(`/candidates/${id}/messages/${query}`);
  },
};

export const messagesApi = {
  list: async (params?: { candidate?: number; status?: string; search?: string }): Promise<Message[]> => {
    const searchParams = new URLSearchParams();
    if (params?.candidate) searchParams.set("candidate", String(params.candidate));
    if (params?.status) searchParams.set("status", params.status);
    if (params?.search) searchParams.set("search", params.search);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return request<Message[]>(`/messages/${qs}`);
  },

  get: async (id: number): Promise<Message> => {
    return request<Message>(`/messages/${id}/`);
  },

  send: async (candidateId: number, content: string): Promise<Message> => {
    return request<Message>("/messages/send/", {
      method: "POST",
      body: JSON.stringify({
        candidate_id: candidateId,
        content: content.trim(),
      }),
    });
  },

  bulkSend: async (candidateIds: number[], content: string): Promise<BulkSendResponse> => {
    return request<BulkSendResponse>("/messages/bulk-send/", {
      method: "POST",
      body: JSON.stringify({
        candidate_ids: candidateIds,
        content: content.trim(),
      }),
    });
  },

  retry: async (id: number, force = false): Promise<{
    message_id: number;
    status: string;
    attempt_number: number;
    provider_message_id?: string | null;
    failure_reason?: string | null;
    is_permanent_failure?: boolean;
    forced?: boolean;
  }> => {
    return request(`/messages/${id}/retry/`, {
      method: "POST",
      body: JSON.stringify({ force }),
    });
  },
};

export const providerApi = {
  health: async (): Promise<ProviderHealth> => {
    return request<ProviderHealth>("/provider/health/");
  },

  simulateEvent: async (params: {
    provider_message_id?: string;
    message_id?: number;
    status: "delivered" | "read" | "failed";
    failure_reason?: string;
    backend_url?: string;
  }): Promise<{
    simulated_event?: {
      event_id: string;
      status: string;
      timestamp: string;
      provider_message_id?: string;
      message_id?: number;
      failure_reason?: string;
    };
    backend_status_code?: number;
    backend_response?: Record<string, unknown>;
    error?: string;
    message?: string;
  }> => {
    return request("/provider/simulate-event/", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },
};

