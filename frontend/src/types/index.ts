export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface Candidate {
  id: number;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateFormData {
  name: string;
  email: string;
  phone: string;
}

export interface RetryAttempt {
  id: number;
  attempt_number: number;
  previous_status: string;
  previous_provider_message_id: string | null;
  new_provider_message_id: string | null;
  status: MessageStatus;
  failure_reason: string | null;
  is_permanent_failure: boolean;
  forced: boolean;
  created_at: string;
}

export interface DeliveryEvent {
  id: number;
  event_id: string;
  status: MessageStatus;
  provider_message_id: string | null;
  failure_reason: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
}

export interface Message {
  id: number;
  candidate: number;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  content: string;
  provider: string;
  provider_message_id: string | null;
  status: MessageStatus;
  failure_reason: string | null;
  is_permanent_failure: boolean;
  retry_count: number;
  retry_attempts?: RetryAttempt[];
  delivery_events?: DeliveryEvent[];
  created_at: string;
  updated_at: string;
}

export interface BulkCandidateResult {
  candidate_id: number;
  candidate_name: string | null;
  message_id: number | null;
  status: MessageStatus;
  provider_message_id: string | null;
  failure_reason: string | null;
  is_permanent_failure?: boolean;
}

export interface BulkSendResponse {
  total: number;
  successful: number;
  failed: number;
  results: BulkCandidateResult[];
}

export interface ProviderHealth {
  status: "healthy" | "unhealthy";
  provider: string;
  latency_ms?: number;
  error?: string;
  provider_info?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  detail?: string;
  error?: string;
  message?: string;
  [key: string]: unknown;
}
