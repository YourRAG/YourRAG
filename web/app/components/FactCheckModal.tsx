"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Shield, ShieldCheck, ShieldAlert, ShieldQuestion, ExternalLink, AlertTriangle, CheckCircle2, XCircle, HelpCircle } from "lucide-react";

interface FactCheckSource {
  title: string;
  url: string;
  snippet: string;
}

interface FactCheckResult {
  credibility_score: number;
  verdict: "verified" | "mostly_true" | "mixed" | "unverified" | "false";
  analysis: string;
  sources: FactCheckSource[];
  claims_checked: number;
}

interface FactCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: FactCheckResult | null;
  isLoading?: boolean;
  onRetry?: () => void;
}

const verdictConfig = {
  verified: {
    label: "Verified",
    labelCn: "已验证",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: CheckCircle2,
    iconColor: "text-green-500",
  },
  mostly_true: {
    label: "Mostly True",
    labelCn: "大部分真实",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    icon: ShieldCheck,
    iconColor: "text-emerald-500",
  },
  mixed: {
    label: "Mixed",
    labelCn: "真假参半",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
  },
  unverified: {
    label: "Unverified",
    labelCn: "无法验证",
    color: "text-slate-700",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    icon: HelpCircle,
    iconColor: "text-slate-500",
  },
  false: {
    label: "False",
    labelCn: "不实信息",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    icon: XCircle,
    iconColor: "text-red-500",
  },
};

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  if (score >= 20) return "text-orange-600";
  return "text-red-600";
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  if (score >= 20) return "bg-orange-500";
  return "bg-red-500";
}

export default function FactCheckModal({
  isOpen,
  onClose,
  result,
  isLoading = false,
  onRetry,
}: FactCheckModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const verdictInfo = result ? verdictConfig[result.verdict] : null;
  const VerdictIcon = verdictInfo?.icon || ShieldQuestion;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-900">Fact Check Result</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-64px)]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <ShieldQuestion className="w-16 h-16 text-slate-300" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              </div>
              <p className="mt-4 text-slate-600 font-medium">Verifying information...</p>
              <p className="mt-1 text-sm text-slate-400">Searching online sources</p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* Score Card */}
              <div className={`p-4 rounded-xl ${verdictInfo?.bgColor} ${verdictInfo?.borderColor} border`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white shadow-sm`}>
                      <VerdictIcon className={`w-6 h-6 ${verdictInfo?.iconColor}`} />
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${verdictInfo?.color}`}>
                        {verdictInfo?.labelCn}
                      </div>
                      <div className="text-xs text-slate-500">
                        {verdictInfo?.label}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${getScoreColor(result.credibility_score)}`}>
                      {result.credibility_score}
                    </div>
                    <div className="text-xs text-slate-500">Credibility Score</div>
                  </div>
                </div>
                {/* Score Bar */}
                <div className="mt-3 h-2 bg-white/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getScoreBgColor(result.credibility_score)} transition-all duration-500`}
                    style={{ width: `${result.credibility_score}%` }}
                  />
                </div>
              </div>

              {/* Analysis */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Analysis</h4>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {result.analysis}
                </p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-slate-700">{result.claims_checked}</span>
                  <span>claims analyzed</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-slate-700">{result.sources.length}</span>
                  <span>sources found</span>
                </div>
              </div>

              {/* Sources */}
              {result.sources.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Sources</h4>
                  <div className="space-y-2">
                    {result.sources.map((source, index) => (
                      <div
                        key={index}
                        className="bg-white border border-slate-200 rounded-lg p-3 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="text-sm font-medium text-slate-800 line-clamp-1">
                            {source.title || `Source ${index + 1}`}
                          </h5>
                          {source.url && (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                              title="Open source"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                          {source.snippet}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Retry Button */}
              {onRetry && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={onRetry}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    Retry Fact Check
                  </button>
                </div>
              )}

              {/* Disclaimer */}
              <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
                Results are based on AI analysis and may not be 100% accurate.
                Always verify important information from multiple sources.
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <ShieldAlert className="w-16 h-16 text-slate-300" />
              <p className="mt-4 text-slate-600">No results available</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Score badge component for inline display
export function CredibilityBadge({
  score,
  verdict,
  onClick,
  size = "sm",
}: {
  score: number;
  verdict: string;
  onClick?: (e: React.MouseEvent) => void;
  size?: "sm" | "md";
}) {
  const verdictInfo = verdictConfig[verdict as keyof typeof verdictConfig] || verdictConfig.unverified;
  const VerdictIcon = verdictInfo.icon;

  const sizeClasses = size === "sm" 
    ? "px-1.5 py-0.5 text-xs gap-1"
    : "px-2 py-1 text-sm gap-1.5";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={`inline-flex items-center ${sizeClasses} rounded-md ${verdictInfo.bgColor} ${verdictInfo.color} ${verdictInfo.borderColor} border font-medium hover:opacity-80 transition-opacity`}
      title={`Credibility: ${score}% - Click for details`}
    >
      <VerdictIcon className={`w-3 h-3 ${verdictInfo.iconColor}`} />
      <span>{score}%</span>
    </button>
  );
}