import { API_URL } from "./config";
import type {
  CheckoutResult,
  Company,
  CompanyDashboardAnalytics,
  EmissionFactorReference,
  Facility,
  PlanDefinition,
  PlanCombinationRule,
  ActivityData,
  Subscription,
  SubscriptionTier,
  VerificationRequest,
  VerificationRequestDetail,
  Notification,
  ReportWindowStatus,
  BrsrCoreReport,
  BrsrCoreMetrics,
  FacilityDashboard,
  ReportGenerationStatus,
  GeneratedReport,
  GeneratedReportType,
  AdminOverview,
  AdminRevenue,
  AdminCompanySummary,
  AdminCompanyDetail,
  AdminFacilityDetail,
  FacilityDocument,
  VerificationQuery,
  VerifierAssignedFacility,
  VerifierAssignedCompany,
  VerifierCompanyDetail,
  VerifierFacilityDetail,
  AdminVerifierSummary,
  CompanyVerifierAssignment,
  AnnexVIChecklistItem,
  AdminInternalOperatorSummary,
  FacilityAssignmentSummary,
  InternalAssignedFacility,
  InternalFacilityDetail,
  EmissionFactor,
  CreateEmissionFactorInput,
  UpdateEmissionFactorInput,
  QuickUpdateValueInput,
  GhgJurisdictionConfig,
  GhgJurisdictionKey,
  GhgEngagement,
  GhgEngagementSummary,
  GhgEngagementInput,
  GhgCalculationResult,
  GhgScope1Entry,
  GhgScope2Entry,
  CrossCheckEntry,
  CrossCheckReview,
  CrossCheckStatus,
  ManualPayment,
  ManualPaymentStatus,
  RecordManualPaymentInput,
  SetCustomSubscriptionInput,
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
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  emailVerified: boolean;
  createdAt: string;
  isSuperAdmin: boolean;
}

export interface PendingUser {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  role: string;
  createdAt: string;
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

/** Fetches raw bytes for an authenticated download endpoint without triggering a browser download — used for inline image thumbnail previews (object URL as an <img> src). */
const fetchAuthedBlob = async (url: string): Promise<Blob> => {
  const fetchDoc = () =>
    fetch(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      credentials: "include",
    });

  let res = await fetchDoc();
  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) res = await fetchDoc();
  }
  if (!res.ok) {
    throw new ApiError("Couldn't load this document. Please try again.", res.status);
  }
  return res.blob();
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

  deleteAccount: (password: string): Promise<{ companyDataRetainedForCompliance: boolean }> =>
    apiFetch("/api/auth/account", { method: "DELETE", body: JSON.stringify({ password }) }),
};

export const referenceApi = {
  emissionFactors: (): Promise<EmissionFactorReference> => apiFetch("/api/reference/emission-factors"),
  reportWindows: (): Promise<ReportWindowStatus> => apiFetch("/api/reference/report-windows"),
};

export const notificationApi = {
  list: (): Promise<{ notifications: Notification[] }> => apiFetch("/api/notifications"),
  markRead: (id: string): Promise<{ notification: Notification }> =>
    apiFetch(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => apiFetch("/api/notifications/read-all", { method: "POST" }),
};

export const companyApi = {
  getMine: (): Promise<{ company: Company | null }> => apiFetch("/api/company"),

  create: (input: Record<string, unknown>): Promise<{ company: Company }> =>
    apiFetch("/api/company", { method: "POST", body: JSON.stringify(input) }),

  update: (input: Record<string, unknown>): Promise<{ company: Company }> =>
    apiFetch("/api/company", { method: "PUT", body: JSON.stringify(input) }),

  dashboard: (): Promise<{ analytics: CompanyDashboardAnalytics }> => apiFetch("/api/company/dashboard"),
};

export const facilityApi = {
  list: (): Promise<{ facilities: Facility[] }> => apiFetch("/api/facilities"),

  get: (facilityId: string): Promise<{ facility: Facility }> =>
    apiFetch(`/api/facilities/${facilityId}`),

  dashboard: (facilityId: string): Promise<{ dashboard: FacilityDashboard }> =>
    apiFetch(`/api/facilities/${facilityId}/dashboard`),

  create: (input: Record<string, unknown>): Promise<{ facility: Facility }> =>
    apiFetch("/api/facilities", { method: "POST", body: JSON.stringify(input) }),

  update: (facilityId: string, input: Record<string, unknown>): Promise<{ facility: Facility }> =>
    apiFetch(`/api/facilities/${facilityId}`, { method: "PUT", body: JSON.stringify(input) }),

  remove: (facilityId: string) => apiFetch(`/api/facilities/${facilityId}`, { method: "DELETE" }),

  // Autosave — permissive, always keeps isDraft true. Create the draft on
  // first blur (no id yet), then PATCH it on every blur after.
  autosaveNew: (input: Record<string, unknown>): Promise<{ facility: Facility }> =>
    apiFetch("/api/facilities/draft", { method: "POST", body: JSON.stringify(input) }),

  autosave: (facilityId: string, input: Record<string, unknown>): Promise<{ facility: Facility }> =>
    apiFetch(`/api/facilities/${facilityId}/draft`, { method: "PATCH", body: JSON.stringify(input) }),

  // Explicit "Mark as complete" — strict validation, flips isDraft to false.
  complete: (facilityId: string, input: Record<string, unknown>): Promise<{ facility: Facility }> =>
    apiFetch(`/api/facilities/${facilityId}/complete`, { method: "POST", body: JSON.stringify(input) }),
};

export const reportsApi = {
  status: (facilityId: string): Promise<ReportGenerationStatus> => apiFetch(`/api/facilities/${facilityId}/reports/status`),

  generate: (facilityId: string, reportType: GeneratedReportType): Promise<{ report: GeneratedReport }> =>
    apiFetch(`/api/facilities/${facilityId}/reports/generate`, {
      method: "POST",
      body: JSON.stringify({ reportType }),
    }),

  list: (facilityId: string): Promise<{ reports: GeneratedReport[] }> => apiFetch(`/api/facilities/${facilityId}/reports`),

  downloadPdf: async (facilityId: string, reportId: string, fileName: string): Promise<void> => {
    const reportUrl = `${API_URL}/api/facilities/${facilityId}/reports/${reportId}/pdf`;
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
      throw new ApiError("Couldn't download the report. Please try again.", res.status);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  },
};

export const documentsApi = {
  list: (facilityId: string): Promise<{ documents: FacilityDocument[] }> => apiFetch(`/api/facilities/${facilityId}/documents`),

  // Multipart upload — bypasses apiFetch's JSON Content-Type so the browser
  // can set the multipart boundary itself.
  uploadEvidence: async (facilityId: string, dataId: string, file: File): Promise<{ document: FacilityDocument }> => {
    const formData = new FormData();
    formData.append("file", file);

    const url = `${API_URL}/api/facilities/${facilityId}/activity-data/${dataId}/documents`;
    const doUpload = () =>
      fetch(url, {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
        body: formData,
      });

    let res = await doUpload();
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await doUpload();
    }
    const data = await parseJson(res);
    if (!res.ok) {
      throw new ApiError(data?.error?.message ?? "Couldn't upload this document.", res.status, data?.error?.code);
    }
    return data;
  },

  download: async (facilityId: string, documentId: string, fileName: string): Promise<void> => {
    const url = `${API_URL}/api/facilities/${facilityId}/documents/${documentId}/download`;
    const fetchDoc = () =>
      fetch(url, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
      });

    let res = await fetchDoc();
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await fetchDoc();
    }
    if (!res.ok) {
      throw new ApiError("Couldn't download this document. Please try again.", res.status);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  },
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

  // Autosave — permissive, always keeps status DRAFT and never calculates.
  // Create the draft on first blur (no id yet), then PATCH it on every
  // blur after.
  autosaveNew: (facilityId: string, input: Record<string, unknown>): Promise<{ entry: ActivityData }> =>
    apiFetch(`/api/facilities/${facilityId}/activity-data/draft`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  autosave: (
    facilityId: string,
    dataId: string,
    input: Record<string, unknown>,
  ): Promise<{ entry: ActivityData }> =>
    apiFetch(`/api/facilities/${facilityId}/activity-data/${dataId}/draft`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  // Explicit "Submit" — strict validation, flips status to SUBMITTED and
  // runs the calculation engine.
  submit: (
    facilityId: string,
    dataId: string,
    input: Record<string, unknown>,
  ): Promise<{ entry: ActivityData }> =>
    apiFetch(`/api/facilities/${facilityId}/activity-data/${dataId}/submit`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

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

export const brsrApi = {
  list: (facilityId: string): Promise<{ reports: BrsrCoreReport[] }> =>
    apiFetch(`/api/brsr/facilities/${facilityId}/data`),

  // One endpoint for both autosave (submit: false, permissive) and the
  // explicit Submit action (submit: true, strict) — see brsr.controller.ts.
  save: (facilityId: string, input: Record<string, unknown>, submit: boolean): Promise<{ report: BrsrCoreReport }> =>
    apiFetch(`/api/brsr/facilities/${facilityId}/data`, {
      method: "POST",
      body: JSON.stringify({ ...input, submit }),
    }),

  getReport: (
    facilityId: string,
    reportingPeriod: string,
  ): Promise<{ report: BrsrCoreReport; facility: Facility; metrics: BrsrCoreMetrics }> =>
    apiFetch(`/api/brsr/facilities/${facilityId}/report/${encodeURIComponent(reportingPeriod)}`),

  downloadPdf: async (reportId: string): Promise<void> => {
    const reportUrl = `${API_URL}/api/brsr/report/${reportId}/pdf`;
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
    link.download = `brsr-core-report-${reportId.slice(-8)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  },
};

export const billingApi = {
  plans: (): Promise<{ plans: PlanDefinition[]; combinationRules: PlanCombinationRule[] }> =>
    apiFetch("/api/billing/plans"),

  // A company can hold several subscriptions at once (each a separate tier) —
  // see the backend's Subscription model comment.
  subscription: (): Promise<{
    subscriptions: Subscription[];
    usage: { facilityCount: number };
    plans: PlanDefinition[];
    combinationRules: PlanCombinationRule[];
  }> => apiFetch("/api/billing/subscription"),

  checkout: (tier: SubscriptionTier): Promise<CheckoutResult> =>
    apiFetch("/api/billing/checkout", { method: "POST", body: JSON.stringify({ tier }) }),

  cancel: (tier: SubscriptionTier): Promise<{ subscription: Subscription }> =>
    apiFetch("/api/billing/cancel", { method: "POST", body: JSON.stringify({ tier }) }),
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

export type EsgWaitlistFramework = "ESG_GRI" | "ESG_ISSB" | "ESG_CSRD" | "ESG_CDP";

export const esgApi = {
  joinWaitlist: (tool: EsgWaitlistFramework, email: string): Promise<{ leadId: string }> =>
    apiFetch("/api/leads/esg-waitlist", {
      method: "POST",
      body: JSON.stringify({ tool, email }),
      skipAuth: true,
    }),
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

  listPendingUsers: (): Promise<{ users: PendingUser[] }> => apiFetch("/api/admin/pending-users"),

  approveUser: (userId: string): Promise<{ user: PendingUser }> =>
    apiFetch(`/api/admin/pending-users/${userId}/approve`, { method: "POST" }),

  rejectUser: (userId: string): Promise<{ user: PendingUser }> =>
    apiFetch(`/api/admin/pending-users/${userId}/reject`, { method: "POST" }),

  overview: (): Promise<AdminOverview> => apiFetch("/api/admin/overview"),

  revenue: (): Promise<AdminRevenue> => apiFetch("/api/admin/revenue"),

  listCompanies: (): Promise<{ companies: AdminCompanySummary[] }> => apiFetch("/api/admin/companies"),

  getCompany: (companyId: string): Promise<{ company: AdminCompanyDetail }> =>
    apiFetch(`/api/admin/companies/${companyId}`),

  getFacility: (facilityId: string): Promise<{ facility: AdminFacilityDetail }> =>
    apiFetch(`/api/admin/facilities/${facilityId}`),

  downloadDocument: async (documentId: string, fileName: string): Promise<void> => {
    const url = `${API_URL}/api/admin/documents/${documentId}/download`;
    const fetchDoc = () =>
      fetch(url, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
      });

    let res = await fetchDoc();
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await fetchDoc();
    }
    if (!res.ok) {
      throw new ApiError("Couldn't download this document. Please try again.", res.status);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  },

  listVerifiers: (): Promise<{ verifiers: AdminVerifierSummary[] }> => apiFetch("/api/admin/verifiers"),

  createVerifier: (input: { name: string; email: string; password: string }): Promise<{ verifier: AdminVerifierSummary }> =>
    apiFetch("/api/admin/verifiers", { method: "POST", body: JSON.stringify(input) }),

  assignVerifier: (companyId: string, verifierId: string): Promise<{ assignment: CompanyVerifierAssignment }> =>
    apiFetch(`/api/admin/companies/${companyId}/verifiers`, { method: "POST", body: JSON.stringify({ verifierId }) }),

  unassignVerifier: (companyId: string, verifierId: string) =>
    apiFetch(`/api/admin/companies/${companyId}/verifiers/${verifierId}`, { method: "DELETE" }),

  deactivateVerifier: (verifierId: string) =>
    apiFetch(`/api/admin/verifiers/${verifierId}/deactivate`, { method: "PATCH" }),

  reactivateVerifier: (verifierId: string) =>
    apiFetch(`/api/admin/verifiers/${verifierId}/reactivate`, { method: "PATCH" }),

  listInternalOperators: (): Promise<{ operators: AdminInternalOperatorSummary[] }> =>
    apiFetch("/api/admin/internal-operators"),

  createInternalOperator: (input: { name: string; email: string; password: string }): Promise<{ operator: AdminInternalOperatorSummary }> =>
    apiFetch("/api/admin/internal-operators", { method: "POST", body: JSON.stringify(input) }),

  listFacilityAssignments: (facilityId: string): Promise<{ assignments: FacilityAssignmentSummary[] }> =>
    apiFetch(`/api/admin/facilities/${facilityId}/assignments`),

  assignOperator: (facilityId: string, userId: string): Promise<{ assignment: FacilityAssignmentSummary }> =>
    apiFetch(`/api/admin/facilities/${facilityId}/assignments`, { method: "POST", body: JSON.stringify({ userId }) }),

  unassignOperator: (facilityId: string, userId: string) =>
    apiFetch(`/api/admin/facilities/${facilityId}/assignments/${userId}`, { method: "DELETE" }),

  deactivateInternalOperator: (userId: string) =>
    apiFetch(`/api/admin/internal-operators/${userId}/deactivate`, { method: "PATCH" }),

  reactivateInternalOperator: (userId: string) =>
    apiFetch(`/api/admin/internal-operators/${userId}/reactivate`, { method: "PATCH" }),

  listEmissionFactors: (): Promise<{ factors: EmissionFactor[] }> => apiFetch("/api/admin/emission-factors"),

  createEmissionFactor: (input: CreateEmissionFactorInput): Promise<{ factor: EmissionFactor }> =>
    apiFetch("/api/admin/emission-factors", { method: "POST", body: JSON.stringify(input) }),

  updateEmissionFactor: (id: string, input: UpdateEmissionFactorInput): Promise<{ factor: EmissionFactor }> =>
    apiFetch(`/api/admin/emission-factors/${id}`, { method: "PUT", body: JSON.stringify(input) }),

  supersedeEmissionFactor: (id: string, input: QuickUpdateValueInput): Promise<{ factor: EmissionFactor }> =>
    apiFetch(`/api/admin/emission-factors/${id}/supersede`, { method: "PUT", body: JSON.stringify(input) }),

  updateCbamCertificatePrice: (input: QuickUpdateValueInput): Promise<{ factor: EmissionFactor }> =>
    apiFetch("/api/admin/cbam-certificate-price", { method: "PUT", body: JSON.stringify(input) }),

  updateCeaGridFactor: (input: QuickUpdateValueInput): Promise<{ factor: EmissionFactor }> =>
    apiFetch("/api/admin/cea-grid-factor", { method: "PUT", body: JSON.stringify(input) }),

  fetchDocumentBlob: (documentId: string): Promise<Blob> => fetchAuthedBlob(`${API_URL}/api/admin/documents/${documentId}/download`),

  listManualPayments: (filters: {
    companyId?: string;
    status?: ManualPaymentStatus;
    from?: string;
    to?: string;
  }): Promise<{ payments: ManualPayment[] }> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const qs = params.toString();
    return apiFetch(`/api/admin/manual-payments${qs ? `?${qs}` : ""}`);
  },

  recordManualPayment: (input: RecordManualPaymentInput): Promise<{ payment: ManualPayment }> =>
    apiFetch("/api/admin/manual-payments", { method: "POST", body: JSON.stringify(input) }),

  reverseManualPayment: (id: string, reason: string): Promise<{ payment: ManualPayment }> =>
    apiFetch(`/api/admin/manual-payments/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason }) }),

  getCompanySubscription: (companyId: string): Promise<{ subscriptions: Subscription[] }> =>
    apiFetch(`/api/admin/companies/${companyId}/subscription`),

  setCustomSubscription: (companyId: string, input: SetCustomSubscriptionInput): Promise<{ subscription: Subscription }> =>
    apiFetch(`/api/admin/companies/${companyId}/custom-subscription`, { method: "POST", body: JSON.stringify(input) }),
};

export const internalDataEntryApi = {
  listFacilities: (): Promise<{ facilities: InternalAssignedFacility[] }> => apiFetch("/api/internal-data-entry/facilities"),

  getFacility: (facilityId: string): Promise<InternalFacilityDetail> =>
    apiFetch(`/api/internal-data-entry/facilities/${facilityId}`),
};

export const verifierApi = {
  getChecklistItems: (): Promise<{ items: AnnexVIChecklistItem[] }> => apiFetch("/api/verifier/checklist-items"),

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
      qualifications?: string;
      comments?: string;
    },
  ): Promise<{ request: VerificationRequestDetail }> =>
    apiFetch(`/api/verifier/requests/${id}/decide`, { method: "POST", body: JSON.stringify(input) }),

  updateChecklist: (id: string, checklistState: Record<string, boolean>): Promise<{ request: VerificationRequestDetail }> =>
    apiFetch(`/api/verifier/requests/${id}/checklist`, { method: "PATCH", body: JSON.stringify({ checklistState }) }),

  raiseQuery: (id: string, queryText: string): Promise<{ query: VerificationQuery }> =>
    apiFetch(`/api/verifier/requests/${id}/queries`, { method: "POST", body: JSON.stringify({ queryText }) }),

  listQueries: (id: string): Promise<{ queries: VerificationQuery[] }> => apiFetch(`/api/verifier/requests/${id}/queries`),

  listFacilities: (): Promise<{ facilities: VerifierAssignedFacility[] }> => apiFetch("/api/verifier/facilities"),

  listCompanies: (): Promise<{ companies: VerifierAssignedCompany[] }> => apiFetch("/api/verifier/companies"),

  getCompany: (companyId: string): Promise<VerifierCompanyDetail> => apiFetch(`/api/verifier/companies/${companyId}`),

  getFacility: (facilityId: string): Promise<VerifierFacilityDetail> => apiFetch(`/api/verifier/facilities/${facilityId}`),

  downloadDocument: async (facilityId: string, documentId: string, fileName: string): Promise<void> => {
    const url = `${API_URL}/api/verifier/facilities/${facilityId}/documents/${documentId}/download`;
    const fetchDoc = () =>
      fetch(url, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
      });

    let res = await fetchDoc();
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await fetchDoc();
    }
    if (!res.ok) {
      throw new ApiError("Couldn't download this document. Please try again.", res.status);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  },

  fetchDocumentBlob: (facilityId: string, documentId: string): Promise<Blob> =>
    fetchAuthedBlob(`${API_URL}/api/verifier/facilities/${facilityId}/documents/${documentId}/download`),
};

export const crossCheckApi = {
  listForFacility: (facilityId: string): Promise<{ entries: CrossCheckEntry[] }> =>
    apiFetch(`/api/cross-check/facilities/${facilityId}`),

  review: (
    activityDataId: string,
    documentId: string,
    input: { status: CrossCheckStatus; notes?: string },
  ): Promise<{ review: CrossCheckReview }> =>
    apiFetch(`/api/cross-check/activity-data/${activityDataId}/documents/${documentId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
};

export const queriesApi = {
  list: (facilityId: string): Promise<{ queries: VerificationQuery[] }> => apiFetch(`/api/facilities/${facilityId}/queries`),

  respond: (facilityId: string, queryId: string, responseText: string): Promise<{ query: VerificationQuery }> =>
    apiFetch(`/api/facilities/${facilityId}/queries/${queryId}/respond`, {
      method: "POST",
      body: JSON.stringify({ responseText }),
    }),
};

export const ghgRunnerApi = {
  listJurisdictions: (): Promise<{ jurisdictions: GhgJurisdictionConfig[] }> => apiFetch("/api/ghg-runner/jurisdictions"),

  list: (search?: string): Promise<{ engagements: GhgEngagementSummary[] }> =>
    apiFetch(`/api/ghg-runner/engagements${search ? `?search=${encodeURIComponent(search)}` : ""}`),

  get: (id: string): Promise<{ engagement: GhgEngagement; calculation: GhgCalculationResult }> =>
    apiFetch(`/api/ghg-runner/engagements/${id}`),

  create: (input: GhgEngagementInput): Promise<{ engagement: GhgEngagement; calculation: GhgCalculationResult }> =>
    apiFetch("/api/ghg-runner/engagements", { method: "POST", body: JSON.stringify(input) }),

  update: (id: string, input: GhgEngagementInput): Promise<{ engagement: GhgEngagement; calculation: GhgCalculationResult }> =>
    apiFetch(`/api/ghg-runner/engagements/${id}`, { method: "PUT", body: JSON.stringify(input) }),

  finalize: (id: string): Promise<{ engagement: GhgEngagement; calculation: GhgCalculationResult }> =>
    apiFetch(`/api/ghg-runner/engagements/${id}/finalize`, { method: "POST" }),

  duplicate: (id: string): Promise<{ engagement: GhgEngagement; calculation: GhgCalculationResult }> =>
    apiFetch(`/api/ghg-runner/engagements/${id}/duplicate`, { method: "POST" }),

  calculate: (input: {
    scope1Entries: GhgScope1Entry[];
    scope2Entries: GhgScope2Entry[];
    jurisdiction: GhgJurisdictionKey;
  }): Promise<{ calculation: GhgCalculationResult }> =>
    apiFetch("/api/ghg-runner/calculate", { method: "POST", body: JSON.stringify(input) }),

  generateReport: (id: string): Promise<{ engagement: GhgEngagement }> =>
    apiFetch(`/api/ghg-runner/engagements/${id}/generate-report`, { method: "POST" }),

  downloadReport: async (id: string, fileName: string): Promise<void> => {
    const url = `${API_URL}/api/ghg-runner/engagements/${id}/report`;
    const fetchDoc = () =>
      fetch(url, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
      });

    let res = await fetchDoc();
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await fetchDoc();
    }
    if (!res.ok) {
      throw new ApiError("Couldn't download this report. Please try again.", res.status);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  },
};

export interface DpaGeneratorInput {
  customerCompanyName: string;
  signingDate: string;
  signatoryName: string;
  signatoryDesignation: string;
}

export const dpaGeneratorApi = {
  // Stateless generate-and-download tool — nothing is persisted server-side,
  // so this is a single POST that streams the PDF straight back, unlike the
  // GHG Runner's separate generate-then-GET-download steps.
  generate: async (input: DpaGeneratorInput): Promise<{ blob: Blob; fileName: string }> => {
    const url = `${API_URL}/api/admin/dpa-generator/generate`;
    const fetchDoc = () =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(input),
      });

    let res = await fetchDoc();
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await fetchDoc();
    }
    if (!res.ok) {
      const data = await parseJson(res);
      throw new ApiError(data?.error?.message ?? "Couldn't generate the DPA. Please try again.", res.status, data?.error?.code);
    }
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const fileName = /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? "dpa.pdf";
    const blob = await res.blob();
    return { blob, fileName };
  },
};

export interface NdaGeneratorInput {
  recipientName: string;
  recipientType: "INDIVIDUAL" | "COMPANY";
  recipientAddress: string;
  effectiveDate: string;
}

export const ndaGeneratorApi = {
  // Stateless generate-and-download tool — nothing is persisted server-side,
  // same single-POST-streams-the-PDF shape as dpaGeneratorApi.generate above.
  generate: async (input: NdaGeneratorInput): Promise<{ blob: Blob; fileName: string }> => {
    const url = `${API_URL}/api/admin/nda-generator/generate`;
    const fetchDoc = () =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(input),
      });

    let res = await fetchDoc();
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await fetchDoc();
    }
    if (!res.ok) {
      const data = await parseJson(res);
      throw new ApiError(data?.error?.message ?? "Couldn't generate the NDA. Please try again.", res.status, data?.error?.code);
    }
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const fileName = /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? "nda.pdf";
    const blob = await res.blob();
    return { blob, fileName };
  },
};
