// Local-only API client for the InPro dashboard. All data comes from the
// desktop app's local backend (SQLite via IPC); there is no cloud account.

export interface UserProfile {
  uid: string;
  display_name: string;
  email: string;
}

export interface Session {
  id: string;
  uid: string;
  title: string;
  session_type: string;
  started_at: number;
  ended_at?: number;
  sync_state: 'clean' | 'dirty';
  updated_at: number;
}

export interface Transcript {
  id: string;
  session_id: string;
  start_at: number;
  end_at?: number;
  speaker: string;
  text: string;
  lang?: string;
  created_at: number;
  sync_state: 'clean' | 'dirty';
}

export interface AiMessage {
  id: string;
  session_id: string;
  sent_at: number;
  role: 'user' | 'assistant';
  content: string;
  tokens?: number;
  model?: string;
  created_at: number;
  sync_state: 'clean' | 'dirty';
}

export interface Summary {
  session_id: string;
  generated_at: number;
  model?: string;
  text: string;
  tldr: string;
  bullet_json: string;
  action_json: string;
  tokens_used?: number;
  updated_at: number;
  sync_state: 'clean' | 'dirty';
}

export interface PromptPreset {
  id: string;
  uid: string;
  title: string;
  prompt: string;
  is_default: number;
  created_at: number;
  sync_state: 'clean' | 'dirty';
}

export interface SessionDetails {
  session: Session;
  transcripts: Transcript[];
  ai_messages: AiMessage[];
  summary: Summary | null;
}

export interface PersonaProfile {
  uid?: string;
  enabled: number | boolean | null;
  display_name: string | null;
  target_role: string | null;
  resume_text: string | null;
  resume_file_name: string | null;
  competence_mode: string | null;
  expertise_notes: string | null;
  language_level: string | null;
  answer_language: string | null;
  extra_instructions: string | null;
  updated_at?: number;
}

export interface PersonaOptions {
  competenceModes: { id: string; label: string }[];
  languageLevels: { id: string; label: string }[];
  maxResumeChars: number;
  supportedExtensions: string[];
}

export interface ModelOption {
  id: string;
  name: string;
  custom?: boolean;
  pricing?: { input?: number; output?: number; perMinute?: number; free?: boolean; note?: string };
}

export interface ModelSettings {
  providers: { id: string; name: string; hasKey: boolean; llmModels: ModelOption[]; sttModels: ModelOption[] }[];
  availableLlm: ModelOption[];
  availableStt: ModelOption[];
  selectedModels: { llm: string | null; stt: string | null };
}

export const LOCAL_USER: UserProfile = {
  uid: 'default_user',
  display_name: 'Local User',
  email: '',
};

// ---------------------------------------------------------------------------
// API origin (injected by the desktop app through runtime-config.json)

let API_ORIGIN = process.env.NODE_ENV === 'development' ? 'http://localhost:9001' : '';
let apiUrlInitialized = false;
let initializationPromise: Promise<void> | null = null;

const initializeApiUrl = async () => {
  if (apiUrlInitialized) return;
  try {
    const response = await fetch('/runtime-config.json');
    if (response.ok) {
      const config = await response.json();
      if (config.API_URL) API_ORIGIN = config.API_URL;
    }
  } catch (error) {
    console.log('Runtime config not available, using fallback API URL:', API_ORIGIN);
  }
  apiUrlInitialized = true;
};

if (typeof window !== 'undefined') {
  initializationPromise = initializeApiUrl();
}

export const getApiHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-User-ID': LOCAL_USER.uid,
});

export const apiCall = async (path: string, options: RequestInit = {}) => {
  if (!apiUrlInitialized && initializationPromise) await initializationPromise;
  if (!apiUrlInitialized) await initializeApiUrl();
  return fetch(`${API_ORIGIN}${path}`, {
    ...options,
    headers: { ...getApiHeaders(), ...(options.headers || {}) },
  });
};

const json = async <T,>(response: Response, what: string): Promise<T> => {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to ${what}: ${response.status} ${text}`);
  }
  return response.json();
};

// ---------------------------------------------------------------------------
// Conversations

export const searchConversations = async (query: string): Promise<Session[]> => {
  if (!query.trim()) return [];
  return json(await apiCall(`/api/conversations/search?q=${encodeURIComponent(query)}`), 'search conversations');
};

export const getSessions = async (): Promise<Session[]> =>
  json(await apiCall('/api/conversations'), 'fetch sessions');

export const getSessionDetails = async (sessionId: string): Promise<SessionDetails> =>
  json(await apiCall(`/api/conversations/${sessionId}`), 'fetch session details');

export const createSession = async (title?: string): Promise<{ id: string }> =>
  json(await apiCall('/api/conversations', { method: 'POST', body: JSON.stringify({ title }) }), 'create session');

export const deleteSession = async (sessionId: string): Promise<void> => {
  const response = await apiCall(`/api/conversations/${sessionId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete session');
};

// ---------------------------------------------------------------------------
// User

export const getUserProfile = async (): Promise<UserProfile> =>
  json(await apiCall('/api/user/profile'), 'fetch user profile');

export const updateUserProfile = async (data: { displayName: string }): Promise<void> => {
  const response = await apiCall('/api/user/profile', { method: 'PUT', body: JSON.stringify(data) });
  if (!response.ok) throw new Error('Failed to update profile');
};

export const checkApiKeyStatus = async (): Promise<{ hasApiKey: boolean }> =>
  json(await apiCall('/api/user/api-key-status'), 'check API key status');

// ---------------------------------------------------------------------------
// Interview profile (persona)

export const getPersona = async (): Promise<PersonaProfile | null> =>
  json(await apiCall('/api/persona'), 'fetch interview profile');

export const getPersonaOptions = async (): Promise<PersonaOptions> =>
  json(await apiCall('/api/persona/options'), 'fetch profile options');

export const savePersona = async (profile: Partial<PersonaProfile> & Record<string, unknown>): Promise<PersonaProfile> =>
  json(await apiCall('/api/persona', { method: 'PUT', body: JSON.stringify(profile) }), 'save interview profile');

export const deletePersona = async (): Promise<void> => {
  const response = await apiCall('/api/persona', { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to remove interview profile');
};

// ---------------------------------------------------------------------------
// AI models (read-only)

export const getModelSettings = async (): Promise<ModelSettings> =>
  json(await apiCall('/api/models'), 'fetch model settings');

// ---------------------------------------------------------------------------
// Prompt presets (kept for the local API; not used by the Ask prompt)

export const getPresets = async (): Promise<PromptPreset[]> =>
  json(await apiCall('/api/presets'), 'fetch presets');

export const createPreset = async (data: { title: string; prompt: string }): Promise<{ id: string }> =>
  json(await apiCall('/api/presets', { method: 'POST', body: JSON.stringify(data) }), 'create preset');

export const updatePreset = async (id: string, data: { title: string; prompt: string }): Promise<void> => {
  const response = await apiCall(`/api/presets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  if (!response.ok) throw new Error('Failed to update preset');
};

export const deletePreset = async (id: string): Promise<void> => {
  const response = await apiCall(`/api/presets/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete preset');
};
