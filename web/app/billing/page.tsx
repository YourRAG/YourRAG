"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Coins,
  Receipt,
  TrendingUp,
  TrendingDown,
  Gift,
  RefreshCw,
  CreditCard,
  Zap,
  Crown,
  Star,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Transaction, TransactionType, TransactionStatus, CreditsSummary } from "../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Recharge Plans (UI only for now)
const rechargePlans = [
  {
    id: "basic",
    name: "Basic",
    credits: 100,
    price: 9.9,
    icon: Zap,
    color: "from-blue-400 to-blue-600",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    credits: 500,
    price: 39.9,
    bonus: 50,
    icon: Star,
    color: "from-purple-400 to-purple-600",
    popular: true,
  },
  {
    id: "premium",
    name: "Premium",
    credits: 1000,
    price: 69.9,
    bonus: 150,
    icon: Crown,
    color: "from-amber-400 to-orange-600",
    popular: false,
  },
];

// Transaction type configs
const transactionTypeConfig: Record<TransactionType, {
  label: string;
  icon: typeof TrendingUp;
  color: string;
  bgColor: string;
}> = {
  RECHARGE: {
    label: "Recharge",
    icon: TrendingUp,
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  CONSUMPTION: {
    label: "Consumption",
    icon: TrendingDown,
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
  REFUND: {
    label: "Refund",
    icon: RefreshCw,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  BONUS: {
    label: "Bonus",
    icon: Gift,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  ADJUSTMENT: {
    label: "Adjustment",
    icon: Sparkles,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
  },
};

// Transaction status configs
const transactionStatusConfig: Record<TransactionStatus, {
  label: string;
  icon: typeof CheckCircle2;
  color: string;
}> = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    color: "text-amber-500",
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle2,
    color: "text-green-500",
  },
  FAILED: {
    label: "Failed",
    icon: XCircle,
    color: "text-red-500",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: AlertCircle,
    color: "text-slate-400",
  },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCredits(credits: number): string {
  if (Math.abs(credits) >= 10000) {
    return (credits / 1000).toFixed(1) + "k";
  }
  return credits.toLocaleString();
}

export default function BillingPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<CreditsSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<TransactionType | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/credits/summary`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      } else if (response.status === 401) {
        router.push("/");
      }
    } catch (err) {
      console.error("Failed to fetch summary:", err);
    }
  }, [router]);

  const fetchTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
      });
      if (filterType) {
        params.append("type", filterType);
      }

      const response = await fetch(
        `${API_URL}/credits/transactions?${params}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
        setTotal(data.total);
      } else if (response.status === 401) {
        router.push("/");
      }
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
      setError("Failed to load transactions");
    } finally {
      setTransactionsLoading(false);
    }
  }, [router, page, filterType]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchSummary();
      await fetchTransactions();
      setLoading(false);
    };
    init();
  }, [fetchSummary, fetchTransactions]);

  useEffect(() => {
    if (!loading) {
      fetchTransactions();
    }
  }, [page, filterType]);

  const totalPages = Math.ceil(total / pageSize);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-slate-500">Loading billing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-500" />
                Billing
              </h1>
            </div>

            {/* Credits Badge in Header */}
            {summary && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 rounded-full border border-amber-200/50">
                <Coins className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-amber-900">
                  {formatCredits(summary.balance)}
                </span>
                <span className="text-amber-600 text-sm">credits</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Recharge Section */}
          <div className="lg:col-span-1 space-y-6">
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-blue-100 text-sm">Available Balance</p>
                  <p className="text-3xl font-bold">
                    {summary ? formatCredits(summary.balance) : "0"}
                  </p>
                </div>
              </div>
              
              {summary && (
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
                  <div>
                    <p className="text-blue-200 text-xs">Recharged</p>
                    <p className="text-lg font-semibold">
                      {formatCredits(summary.totalRecharged)}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-200 text-xs">Used</p>
                    <p className="text-lg font-semibold">
                      {formatCredits(summary.totalConsumed)}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-200 text-xs">Bonus</p>
                    <p className="text-lg font-semibold">
                      {formatCredits(summary.totalBonus)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Recharge Plans */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-slate-400" />
                  Recharge Plans
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Choose a plan to top up your credits
                </p>
              </div>

              <div className="p-4 space-y-3">
                {rechargePlans.map((plan) => {
                  const Icon = plan.icon;
                  return (
                    <button
                      key={plan.id}
                      disabled
                      className="relative w-full p-4 rounded-xl border-2 border-slate-200 hover:border-blue-300 transition-all duration-200 text-left group disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {plan.popular && (
                        <div className="absolute -top-2 left-4 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium rounded-full">
                          Popular
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center shadow-lg`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {plan.name}
                            </span>
                            {plan.bonus && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                                +{plan.bonus} bonus
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500">
                            {plan.credits.toLocaleString()} credits
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-900">
                            ${plan.price}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                <p className="text-xs text-slate-500 text-center">
                  Payment integration coming soon
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Transaction History */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-slate-400" />
                  Transaction History
                </h2>

                {/* Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value as TransactionType | "");
                      setPage(1);
                    }}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Types</option>
                    <option value="RECHARGE">Recharge</option>
                    <option value="CONSUMPTION">Consumption</option>
                    <option value="BONUS">Bonus</option>
                    <option value="REFUND">Refund</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                  </select>
                </div>
              </div>

              {/* Transactions List */}
              <div className="divide-y divide-slate-100">
                {transactionsLoading ? (
                  <div className="py-12 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="py-12 text-center">
                    <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No transactions yet</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Your transaction history will appear here
                    </p>
                  </div>
                ) : (
                  transactions.map((transaction) => {
                    const typeConfig = transactionTypeConfig[transaction.type];
                    const statusConfig = transactionStatusConfig[transaction.status];
                    const TypeIcon = typeConfig.icon;
                    const StatusIcon = statusConfig.icon;
                    const isPositive = transaction.amount > 0;

                    return (
                      <div
                        key={transaction.id}
                        className="px-6 py-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          {/* Type Icon */}
                          <div
                            className={`w-10 h-10 rounded-xl ${typeConfig.bgColor} flex items-center justify-center`}
                          >
                            <TypeIcon className={`w-5 h-5 ${typeConfig.color}`} />
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">
                                {typeConfig.label}
                              </span>
                              <span
                                className={`flex items-center gap-1 text-xs ${statusConfig.color}`}
                              >
                                <StatusIcon className="w-3 h-3" />
                                {statusConfig.label}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 truncate">
                              {transaction.description}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {formatDate(transaction.createdAt)}
                            </p>
                          </div>

                          {/* Amount */}
                          <div className="text-right">
                            <div
                              className={`flex items-center gap-1 font-semibold ${
                                isPositive ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {isPositive ? (
                                <ArrowUpRight className="w-4 h-4" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4" />
                              )}
                              <span>
                                {isPositive ? "+" : ""}
                                {formatCredits(transaction.amount)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              Balance: {formatCredits(transaction.balanceAfter)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Showing {(page - 1) * pageSize + 1}-
                    {Math.min(page * pageSize, total)} of {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-slate-600">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}