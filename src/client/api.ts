import type {
  Capabilities,
  PublicSession,
  ScenarioBriefing,
  Tone,
} from '../shared/contracts.js';

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = 'UNKNOWN',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;

export async function getCapabilities(): Promise<Capabilities> {
  return request<Capabilities>(`${API_BASE}/capabilities`);
}

export async function getBriefing(): Promise<ScenarioBriefing> {
  const payload = await request<{ briefing: ScenarioBriefing }>(
    `${API_BASE}/scenario`,
  );
  return payload.briefing;
}

export async function createSession(): Promise<PublicSession> {
  const payload = await request<{ session: PublicSession }>(
    `${API_BASE}/sessions`,
    {
      method: 'POST',
    },
  );
  return payload.session;
}

export async function playTurn(
  sessionId: string,
  text: string,
): Promise<{ session: PublicSession; directorSummary: string }> {
  return request(
    `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/turns`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    },
  );
}

export async function requestSpeech(
  text: string,
  tone: Tone,
  sessionId: string | null,
): Promise<Blob | null> {
  const response = await fetch(`${API_BASE}/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, tone, sessionId }),
  });

  if (response.status === 204) return null;
  if (!response.ok) throw await toApiError(response);
  return response.blob();
}

async function request<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: ApiErrorPayload | null = null;
  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    payload = null;
  }
  return new ApiError(
    payload?.error?.message ?? `请求失败 (${response.status})`,
    response.status,
    payload?.error?.code,
  );
}
