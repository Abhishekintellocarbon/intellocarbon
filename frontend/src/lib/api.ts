import { API_URL } from "./config";
import type {
  CheckoutResult,
  Company,
  EmissionFactorReference,
  Facility,
  PlanDefinition,
  ActivityData,
  Subscription,
  SubscriptionTier,
  VerificationRequest,
  VerificationRequestDetail,
} from "./types";
import type {
  BorderInputs,
  BorderResults,
  ComplyInputs,
  ComplyResults,
  IndiaInputs,
  IndiaResults,
  LeadCapture,
  LeadContact,
} from "./intellocalc-types";

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  isSuperAdmin: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

// Access token lives only in memory — never localStorage — so it can't be
// exfiltrated by an XSS payload reading persistent storage.
let accessToken: string | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipRetry?: boolean;
}

const parseJson = async (res: Response) => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

let refreshPromise: Promise<boolean> | null = null;

const doRefresh = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      setAccessToken(null);
      return false;
    }
    const data = await parseJson(res);
    setAccessToken(data?.accessToken ?? null);
    return Boolean(data?.accessToken);
  } catch {
    setAccessToken(null);
    return false;
  }
};

/** De-dupes concurrent refresh attempts so parallel 401s only hit /refresh once. */
export const refreshSession = (): Promise<boolean> => {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

export const apiFetch = async (path: string, options: RequestOptions = {}) => {
  const { skipAuth, skipRetry, headers, ...rest } = options;

  const buildHeaders = () => ({
    "Content-Type": "application/json",
    ...(!skipAuth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...headers,
  });

  let res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: buildHeaders(),
    credentials: "include",
  });

  if (res.status === 401 && !skipAuth && !skipRetry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await fetch(`${API_URL}${path}`, {
        ...rest,
        headers: buildHeaders(),
        credentials: "include",
      });
    }
  }

  const data = await parseJson(res);

  if (!res.ok) {
    throw new ApiError(data?.error?.message ?? "Something went wrong", res.status, data?.error?.code);
  }

  return data;
};

export const authApi = {
  signup: (input: {
    name: string;
    email: string;
    password: string;
    companyName?: string;
    accountType?: "COMPANY" | "VERIFIER";
  }) => apiFetch("/api/auth/signup", { method: "POST", body: JSON.stringify(input), skipAuth: true }),

  login: (input: { email: string; password: string }) =>
    apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(input), skipAuth: true }),

  logout: () => apiFetch("/api/auth/logout", { method: "POST" }),

  forgotPassword: (email: string) =>
    apiFetch("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
      skipAuth: true,
    }),

  resetPassword: (token: string, password: string) =>
    apiFetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
      skipAuth: true,
    }),

  me: (): Promise<{ user: ApiUser }> => apiFetch("/api/auth/me"),
};

export const referenceApi = {
  emissionFactors: (): Promise<EmissionFactorReference> => apiFetch("/api/reference/emission-factors"),
};

export const companyApi = {
  getMine: (): Promise<{ company: Company | null }> => apiFetch("/api/company"),

  create: (input: Record<string, unknown>): Promise<{ company: Company }> =>
    apiFetch("/api/company", { method: "POST", body: JSON.stringify(input) }),

  update: (input: Record<string, unknown>): Promise<{ company: Company }> =>
    apiFetch("/api/company", { method: "PUT", body: JSON.stringify(input) }),
};

export const facilityApi = {
  list: (): Promise<{ facilities: Facility[] }> => apiFetch("/api/facilities"),

  get: (facilityId: string): Promise<{ facility: Facility }> =>
    apiFetch(`/api/facilities/${facilityId}`),

  create: (input: Record<string, unknown>): Promise<{ facility: Facility }> =>
    apiFetch("/api/facilities", { method: "POST", body: JSON.stringify(input) }),

  update: (facilityId: string, input: Record<string, unknown>): Promise<{ facility: Facility }> =>
    apiFetch(`/api/facilities/${facilityId}`, { method: "PUT", body: JSON.stringify(input) }),

  remove: (facilityId: string) => apiFetch(`/api/facilities/${facilityId}`, { method: "DELETE" }),
};

export const activityDataApi = {
  list: (facilityId: string): Promise<{ entries: ActivityData[] }> =>
    apiFetch(`/api/facilities/${facilityId}/activity-data`),

  get: (facilityId: string, dataId: string): Promise<{ entry: ActivityData }> =>
    apiFetch(`/api/facilities/${facilityId}/activity-data/${dataId}`),

  create: (facilityId: string, input: Record<string, unknown>): Promise<{ entry: ActivityData }> =>
    apiFetch(`/api/facilities/${facilityId}/activity-data`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  remove: (facilityId: string, dataId: string) =>
    apiFetch(`/api/facilities/${facilityId}/activity-data/${dataId}`, { method: "DELETE" }),

  downloadReport: async (facilityId: string, dataId: string, type: "cbam" | "ccts"): Promise<void> => {
    const reportUrl = `${API_URL}/api/facilities/${facilityId}/activity-data/${dataId}/report/${type}`;
    const fetchReport = () =>
      fetch(reportUrl, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
      });

    let res = await fetchReport();
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await fetchReport();
    }
    if (!res.ok) {
      throw new ApiError("Couldn't generate the report. Please try again.", res.status);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${type}-report-${dataId.slice(-8)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  },

  submitForVerification: (facilityId: string, dataId: string): Promise<{ request: VerificationRequest }> =>
    apiFetch(`/api/facilities/${facilityId}/activity-data/${dataId}/verification`, { method: "POST" }),

  getVerificationStatus: (facilityId: string, dataId: string): Promise<{ request: VerificationRequest | null }> =>
    apiFetch(`/api/facilities/${facilityId}/activity-data/${dataId}/verification`),
};

export const billingApi = {
  plans: (): Promise<{ plans: PlanDefinition[] }> => apiFetch("/api/billing/plans"),

  subscription: (): Promise<{
    subscription: Subscription | null;
    usage: { facilityCount: number };
    plans: PlanDefinition[];
  }> => apiFetch("/api/billing/subscription"),

  checkout: (tier: SubscriptionTier): Promise<CheckoutResult> =>
    apiFetch("/api/billing/checkout", { method: "POST", body: JSON.stringify({ tier }) }),

  cancel: (): Promise<{ subscription: Subscription }> => apiFetch("/api/billing/cancel", { method: "POST" }),
};

export const intellocalcApi = {
  submitBorder: (contact: LeadContact, inputs: BorderInputs): Promise<{ results: BorderResults }> =>
    apiFetch("/api/leads", {
      method: "POST",
      body: JSON.stringify({ tool: "BORDER", ...contact, inputs }),
      skipAuth: true,
    }),

  submitIndia: (contact: LeadContact, inputs: IndiaInputs): Promise<{ results: IndiaResults }> =>
    apiFetch("/api/leads", {
      method: "POST",
      body: JSON.stringify({ tool: "INDIA", ...contact, inputs }),
      skipAuth: true,
    }),

  submitComply: (
    contact: LeadContact,
    inputs: ComplyInputs,
  ): Promise<{ results: ComplyResults; leadId?: string }> =>
    apiFetch("/api/leads", {
      method: "POST",
      body: JSON.stringify({ tool: "COMPLY", ...contact, inputs }),
      skipAuth: true,
    }),

  complianceMapPdfUrl: (leadId: string) => `${API_URL}/api/leads/${leadId}/compliance-map.pdf`,
};

export const adminApi = {
  listLeads: (filters: {
    tool?: string;
    sector?: string;
    from?: string;
    to?: string;
  }): Promise<{ leads: LeadCapture[] }> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const qs = params.toString();
    return apiFetch(`/api/admin/leads${qs ? `?${qs}` : ""}`);
  },
};

export const verifierApi = {
  listPending: (): Promise<{ requests: VerificationRequestDetail[] }> =>
    apiFetch("/api/verifier/requests/pending"),

  listMine: (): Promise<{ requests: VerificationRequestDetail[] }> => apiFetch("/api/verifier/requests/mine"),

  get: (id: string): Promise<{ request: VerificationRequestDetail }> => apiFetch(`/api/verifier/requests/${id}`),

  claim: (id: string): Promise<{ request: VerificationRequestDetail }> =>
    apiFetch(`/api/verifier/requests/${id}/claim`, { method: "POST" }),

  decide: (
    id: string,
    input: {
      status: "APPROVED" | "REJECTED";
      verifierOrg?: string;
      accreditationNumber?: string;
      statement?: string;
      comments?: string;
    },
  ): Promise<{ request: VerificationRequestDetail }> =>
    apiFetch(`/api/verifier/requests/${id}/decide`, { method: "POST", body: JSON.stringify(input) }),
};
