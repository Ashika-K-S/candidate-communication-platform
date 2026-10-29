import {
  Candidate,
  CandidateFormData,
  Message,
  BulkSendResponse,
  ProviderHealth,
} from "@/types";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown> | null;

  constructor(message: string, status: number, data: Record<string, unknown> | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
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

    if (dataObj) {
      if (typeof dataObj.detail === "string") {
        friendlyMessage = dataObj.detail;
      } else if (typeof dataObj.message === "string") {
        friendlyMessage = dataObj.message;
      } else if (typeof dataObj.error === "string") {
        friendlyMessage = dataObj.error;
      } else {
        // Collect field validation errors: {"email": ["This field must be unique."], ...}
        const fieldErrors = Object.entries(dataObj)
          .map(([key, val]) => {
            if (Array.isArray(val)) return `${key}: ${val.join(" ")}`;
            return `${key}: ${String(val)}`;
          })
          .join(" | ");
        if (fieldErrors) friendlyMessage = fieldErrors;
      }
    } else if (typeof responseData === "string" && responseData.trim()) {
      friendlyMessage = responseData;
    }

    throw new ApiError(friendlyMessage, response.status, dataObj);
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
};
