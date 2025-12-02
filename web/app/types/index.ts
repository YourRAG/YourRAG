export type TabType = "ask" | "search" | "add" | "manage" | "activity" | "profile" | "admin" | "demo";

export type Role = "USER" | "ADMIN";

export interface User {
  id: number;
  githubId?: string;
  giteeId?: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  role: Role;
  topK: number;
  similarityThreshold: number;
  credits: number;
}

// Credits & Billing Types
export type TransactionType =
  | "RECHARGE"
  | "CONSUMPTION"
  | "REFUND"
  | "BONUS"
  | "ADJUSTMENT";

export type TransactionStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface Transaction {
  id: number;
  userId: number;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
  referenceType: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreditsSummary {
  balance: number;
  totalRecharged: number;
  totalConsumed: number;
  totalBonus: number;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
}

// Activity Types
export type ActivityType =
  | "DOCUMENT_ADD"
  | "DOCUMENT_UPDATE"
  | "DOCUMENT_DELETE"
  | "SEARCH"
  | "RAG_QUERY"
  | "LOGIN"
  | "SYSTEM";

export interface Activity {
  id: number;
  type: ActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivitiesResponse {
  activities: Activity[];
  total: number;
}

export interface UserStats {
  documentCount: number;
  searchCount: number;
  queryCount: number;
  totalActivities: number;
}

// Search Types
export interface SearchResult {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  distance: number;
}

export interface RAGMessage {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  sources?: SearchResult[];
}

// Document Management Types
export interface DocumentGroup {
  id: number;
  name: string;
  createdAt: string;
  documentCount: number;
}

export interface DocumentItem {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  group?: DocumentGroup | null;
  vector_dim?: number | null;
  vector_preview?: number[] | null;
}

export interface PaginatedDocumentsResponse {
  documents: DocumentItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
export interface PaginatedSearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}