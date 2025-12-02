"use client";

import { useState, useEffect, useCallback } from "react";
import {
  KeyRound,
  Plus,
  Loader2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Gift,
  Trash2,
  Download,
} from "lucide-react";
import { formatDate } from "../utils/format";

interface RedemptionCode {
  id: number;
  code: string;
  amount: number;
  status: "ACTIVE" | "USED" | "EXPIRED" | "DISABLED";
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  createdByUser?: { username: string };
  usedByUser?: { username: string };
}

interface RedemptionCodesManagerProps {
  apiUrl: string;
}

export default function RedemptionCodesManager({ apiUrl }: RedemptionCodesManagerProps) {
  const [codes, setCodes] = useState<RedemptionCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [minAmountFilter, setMinAmountFilter] = useState<string>("");
  const [maxAmountFilter, setMaxAmountFilter] = useState<string>("");
  const pageSize = 10;

  // Generate State
  const [generateAmount, setGenerateAmount] = useState(100);
  const [generateCount, setGenerateCount] = useState(1);
  const [generatePrefix, setGeneratePrefix] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<RedemptionCode[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      if (statusFilter) {
        params.append("status", statusFilter);
      }
      if (minAmountFilter) {
        params.append("minAmount", minAmountFilter);
      }
      if (maxAmountFilter) {
        params.append("maxAmount", maxAmountFilter);
      }

      const res = await fetch(`${apiUrl}/redemption/admin/list?${params}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCodes(data.items);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch codes:", error);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, page, statusFilter, minAmountFilter, maxAmountFilter]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setSuccessMsg(null);
    setGeneratedCodes([]);
    
    try {
      const res = await fetch(`${apiUrl}/redemption/admin/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(generateAmount),
          count: Number(generateCount),
          prefix: generatePrefix,
          // expiresAt could be added if UI supports date picker
        }),
        credentials: "include",
      });

      if (res.ok) {
        const newCodes = await res.json();
        setGeneratedCodes(newCodes);
        setSuccessMsg(`Successfully generated ${newCodes.length} codes!`);
        fetchCodes();
        // Don't close form immediately so user can copy codes
      }
    } catch (error) {
      console.error("Failed to generate codes:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add toast here
  };

  const copyAllGenerated = () => {
    const text = generatedCodes.map(c => c.code).join("\n");
    copyToClipboard(text);
  };

  const handleDownloadTxt = () => {
    if (generatedCodes.length === 0) return;
    
    const text = generatedCodes.map(c => c.code).join("\r\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `redemption_codes_${new Date().toISOString().slice(0, 19).replace(/[:]/g, "-")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / pageSize);

  const handleCleanupUsed = async () => {
    if (!confirm("Are you sure you want to delete all USED redemption codes? This action cannot be undone.")) {
      return;
    }
    
    setIsCleaningUp(true);
    try {
      const res = await fetch(`${apiUrl}/redemption/admin/cleanup/used`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Deleted ${data.deleted} used codes`);
        fetchCodes();
      }
    } catch (error) {
      console.error("Failed to cleanup codes:", error);
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-lg">
            <KeyRound className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="font-semibold text-slate-900">Redemption Codes</h3>
          <span className="text-sm text-slate-500">({total} total)</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleCleanupUsed}
            disabled={isCleaningUp}
            className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
          >
            {isCleaningUp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Clean Used
          </button>
          
          <button
            onClick={() => setShowGenerateForm(!showGenerateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            {showGenerateForm ? "Close Generator" : "Generate Codes"}
            {!showGenerateForm && <Plus className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Generator Form */}
      {showGenerateForm && (
        <div className="p-6 bg-slate-50 border-b border-slate-100">
          <div className="max-w-3xl mx-auto space-y-6">
            <h4 className="font-medium text-slate-900">Generate New Codes</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount (Credits)
                </label>
                <input
                  type="number"
                  min="1"
                  value={generateAmount}
                  onChange={(e) => setGenerateAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Count
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={generateCount}
                  onChange={(e) => setGenerateCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Prefix (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. EVENT-"
                  value={generatePrefix}
                  onChange={(e) => setGeneratePrefix(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || generateAmount <= 0 || generateCount <= 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>

            {/* Generated Result */}
            {generatedCodes.length > 0 && (
               <div className="mt-6 bg-white p-4 rounded-xl border border-green-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">{successMsg}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDownloadTxt}
                        className="flex items-center gap-2 text-sm bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
                      >
                        <Download className="w-4 h-4" />
                        Export TXT
                      </button>
                      <button
                        onClick={copyAllGenerated}
                        className="flex items-center gap-2 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
                      >
                        <Copy className="w-4 h-4" />
                        Copy All Codes
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-sm">
                    {generatedCodes.slice(0, 3).map(c => (
                      <div key={c.id} className="flex justify-between py-1">
                        <span>{c.code}</span>
                        <span className="text-slate-400">{c.amount} pts</span>
                      </div>
                    ))}
                    {generatedCodes.length > 3 && (
                      <div className="text-center text-slate-500 py-2 border-t border-slate-200 mt-2">
                        ... and {generatedCodes.length - 3} more codes (click "Copy All Codes" to copy)
                      </div>
                    )}
                  </div>
               </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="USED">Used</option>
            <option value="EXPIRED">Expired</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Amount:</label>
          <input
            type="number"
            placeholder="Min"
            value={minAmountFilter}
            onChange={(e) => {
              setMinAmountFilter(e.target.value);
              setPage(1);
            }}
            className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <span className="text-slate-400">-</span>
          <input
            type="number"
            placeholder="Max"
            value={maxAmountFilter}
            onChange={(e) => {
              setMaxAmountFilter(e.target.value);
              setPage(1);
            }}
            className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        
        {(statusFilter || minAmountFilter || maxAmountFilter) && (
          <button
            onClick={() => {
              setStatusFilter("");
              setMinAmountFilter("");
              setMaxAmountFilter("");
              setPage(1);
            }}
            className="text-sm text-slate-500 hover:text-slate-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* List */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Status
              </th>
               <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Usage
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
                </td>
              </tr>
            ) : codes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No redemption codes found
                </td>
              </tr>
            ) : (
              codes.map((code) => {
                // Mask the code: show first 4 and last 4 characters only
                const maskedCode = code.code.length > 8
                  ? `${code.code.slice(0, 4)}****${code.code.slice(-4)}`
                  : code.code;
                
                return (
                <tr key={code.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => copyToClipboard(code.code)} title="Click to copy full code">
                      <code className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono text-sm">
                        {maskedCode}
                      </code>
                      <Copy className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 font-medium text-slate-900">
                      <Gift className="w-4 h-4 text-amber-500" />
                      {code.amount}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      code.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                      code.status === 'USED' ? 'bg-slate-100 text-slate-700' :
                      code.status === 'EXPIRED' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {code.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {code.usedByUser ? (
                       <div className="text-sm">
                         <p className="text-slate-900">{code.usedByUser.username}</p>
                         <p className="text-slate-500 text-xs">
                           {code.usedAt && formatDate(code.usedAt)}
                         </p>
                       </div>
                    ) : (
                      <span className="text-slate-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {formatDate(code.createdAt)}
                  </td>
                </tr>
              );})
            )}
          </tbody>
        </table>
      </div>

       {/* Pagination */}
       {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}