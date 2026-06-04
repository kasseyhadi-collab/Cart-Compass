import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListProductsQueryKey, getListCategoriesQueryKey, getListStoresQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";

// ─── Types ───────────────────────────────────────────────────────────────────

type SheetResult = { inserted: number; updated: number; skipped: number };
type ImportError = { sheet: string; row: number; message: string };
type ImportResult = {
  products: SheetResult;
  stores: SheetResult;
  prices: SheetResult;
  errors: ImportError[];
};
type UploadState = "idle" | "uploading" | "success" | "error";
type DownloadState = "idle" | "loading" | "error";

type StatsData = {
  products: number;
  stores: number;
  priceRecords: number;
  productsMissingPrices: number;
  productsMissingBaseUnit: number;
  lastImport: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBase() {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

async function triggerDownload(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px bg-gray-200 flex-1" />
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</span>
      <div className="h-px bg-gray-200 flex-1" />
    </div>
  );
}

function SheetSummary({ label, result }: { label: string; result: SheetResult }) {
  const total = result.inserted + result.updated + result.skipped;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 rounded-full bg-[#1F7A4C]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[#1F7A4C] text-xs font-bold">{label[0]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#1E293B] text-sm">{label}</p>
        <div className="flex gap-4 mt-1 flex-wrap">
          {result.inserted > 0 && (
            <span className="text-xs text-emerald-600 font-medium">+{result.inserted} added</span>
          )}
          {result.updated > 0 && (
            <span className="text-xs text-blue-600 font-medium">~{result.updated} updated</span>
          )}
          {result.skipped > 0 && (
            <span className="text-xs text-amber-600 font-medium">{result.skipped} skipped</span>
          )}
          {total === 0 && (
            <span className="text-xs text-gray-400">No data in sheet</span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <span className="text-sm font-bold text-[#1E293B]">{total}</span>
        <p className="text-xs text-gray-400">rows</p>
      </div>
    </div>
  );
}

// ─── Stat item ────────────────────────────────────────────────────────────────

function StatItem({
  label,
  value,
  warn,
  isDate,
}: {
  label: string;
  value: number | string | null;
  warn?: boolean;
  isDate?: boolean;
}) {
  const displayValue = isDate
    ? formatDate(value as string | null)
    : value ?? "—";

  return (
    <div className={`rounded-xl p-3 flex flex-col gap-0.5 ${warn ? "bg-amber-50 border border-amber-100" : "bg-gray-50"}`}>
      <span className={`text-xs font-medium leading-tight ${warn ? "text-amber-600" : "text-gray-500"}`}>
        {label}
      </span>
      <span className={`text-xl font-bold leading-tight ${warn ? "text-amber-700" : "text-[#1E293B]"}`}>
        {displayValue}
      </span>
    </div>
  );
}

// ─── Data quality card ────────────────────────────────────────────────────────

function DataQualityCard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${getBase()}/api/admin/stats`)
      .then((r) => {
        if (!r.ok) throw new Error("stats failed");
        return r.json() as Promise<StatsData>;
      })
      .then((data) => { if (!cancelled) { setStats(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-[#1E293B] text-sm">Data Quality</h2>
        {loading && (
          <div className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-[#1F7A4C] animate-spin" />
        )}
        {error && (
          <span className="text-xs text-red-500">Could not load</span>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <StatItem label="Products" value={stats.products} />
          <StatItem label="Stores" value={stats.stores} />
          <StatItem label="Price Records" value={stats.priceRecords} />
          <StatItem
            label="Missing Prices"
            value={stats.productsMissingPrices}
            warn={stats.productsMissingPrices > 0}
          />
          <StatItem
            label="Missing BaseUnit"
            value={stats.productsMissingBaseUnit}
            warn={stats.productsMissingBaseUnit > 0}
          />
          <StatItem label="Last Import" value={stats.lastImport} isDate />
        </div>
      )}

      {!stats && !loading && !error && (
        <p className="text-xs text-gray-400 text-center py-4">No data yet</p>
      )}
    </div>
  );
}

// ─── Download card ────────────────────────────────────────────────────────────

function DownloadCard({
  icon,
  title,
  description,
  filename,
  buttonLabel,
  endpoint,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  filename: string;
  buttonLabel: string;
  endpoint: string;
  accent: "green" | "navy";
}) {
  const [state, setState] = useState<DownloadState>("idle");

  const accentStyles = {
    green: {
      icon: "bg-[#1F7A4C]/10 text-[#1F7A4C]",
      button: "bg-[#1F7A4C] hover:bg-[#1A6640] text-white",
      spinner: "border-white/30 border-t-white",
    },
    navy: {
      icon: "bg-[#1E293B]/10 text-[#1E293B]",
      button: "bg-[#1E293B] hover:bg-[#0F172A] text-white",
      spinner: "border-white/30 border-t-white",
    },
  }[accent];

  async function handleDownload() {
    setState("loading");
    try {
      await triggerDownload(`${getBase()}${endpoint}`, filename);
      setState("idle");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accentStyles.icon}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#1E293B] text-sm leading-tight">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{description}</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl px-3 py-2 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="text-xs text-gray-500 font-mono truncate">{filename}</span>
      </div>

      <button
        onClick={handleDownload}
        disabled={state === "loading"}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${accentStyles.button} disabled:opacity-70`}
      >
        {state === "loading" ? (
          <>
            <div className={`w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0 ${accentStyles.spinner}`} />
            <span>Generating…</span>
          </>
        ) : state === "error" ? (
          <span>Download failed — try again</span>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {buttonLabel}
          </>
        )}
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  async function handleFile(file: File) {
    if (!file.name.endsWith(".xlsx")) {
      setErrorMessage("Please upload an .xlsx file.");
      setUploadState("error");
      return;
    }

    setFileName(file.name);
    setUploadState("uploading");
    setResult(null);
    setErrorMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${getBase()}/api/admin/import`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error ?? "Import failed.");
        setUploadState("error");
        return;
      }

      setResult(data as ImportResult);
      setUploadState("success");

      await queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getListStoresQueryKey() });
    } catch {
      setErrorMessage("Network error — could not reach the server.");
      setUploadState("error");
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function reset() {
    setUploadState("idle");
    setResult(null);
    setErrorMessage("");
    setFileName("");
  }

  const totalErrors = result?.errors.length ?? 0;
  const totalImported =
    (result?.products.inserted ?? 0) +
    (result?.products.updated ?? 0) +
    (result?.stores.inserted ?? 0) +
    (result?.stores.updated ?? 0) +
    (result?.prices.inserted ?? 0) +
    (result?.prices.updated ?? 0);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <Link href="/">
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-[#1E293B]">Admin Tools</h1>
          <p className="text-xs text-gray-500">Manage catalog data via spreadsheet</p>
        </div>
      </div>

      <div className="max-w-[430px] mx-auto px-4 py-6 space-y-5">

        {/* ── Data Quality Dashboard ── */}
        <SectionDivider label="Data Quality" />
        <DataQualityCard />

        {/* ── Workflow hint ── */}
        <div className="bg-[#1E293B] rounded-2xl px-4 py-3.5 flex items-start gap-3">
          <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-xs text-slate-300 leading-relaxed">
            <span className="text-white font-semibold">Maintenance workflow: </span>
            Export → edit prices → save → re-import. No database access needed.
          </p>
        </div>

        {/* ── Download section ── */}
        <SectionDivider label="Download" />

        <DownloadCard
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
          }
          title="Blank Template"
          description="Empty spreadsheet with all three sheets and correct column headers — ready to fill in."
          filename="CartCompass_Template.xlsx"
          buttonLabel="Download Blank Template"
          endpoint="/api/admin/template"
          accent="green"
        />

        <DownloadCard
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          }
          title="Export Current Data"
          description="Full database snapshot — all products, stores, and prices. Edit and re-import to update."
          filename={`CartCompass_Export_${today}.xlsx`}
          buttonLabel="Export Current Data"
          endpoint="/api/admin/export"
          accent="navy"
        />

        {/* ── Import section ── */}
        <SectionDivider label="Import" />

        {/* Format reference */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="font-semibold text-[#1E293B] text-sm mb-3">Expected column headers</h2>
          <div className="space-y-2">
            {[
              { sheet: "Products", cols: "ProductID, ProductName, Category, Brand, PackageSize, UnitType" },
              { sheet: "Stores",   cols: "StoreID, StoreName" },
              { sheet: "Prices",   cols: "ProductID, StoreID, Price, UnitPrice" },
            ].map(({ sheet, cols }) => (
              <div key={sheet} className="flex gap-2">
                <span className="text-xs font-semibold text-[#1F7A4C] w-16 flex-shrink-0 mt-0.5">{sheet}</span>
                <span className="text-xs text-gray-500">{cols}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Each sheet is optional. ProductID and StoreID are used for upserts when present.
          </p>
        </div>

        {/* Upload dropzone */}
        {(uploadState === "idle" || uploadState === "error") && (
          <div>
            <div
              className={`rounded-2xl border-2 border-dashed transition-colors cursor-pointer p-8 text-center ${
                dragOver
                  ? "border-[#1F7A4C] bg-[#1F7A4C]/5"
                  : uploadState === "error"
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200 bg-white hover:border-[#1F7A4C]/50 hover:bg-[#1F7A4C]/5"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={onInputChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-[#1F7A4C]/10 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F7A4C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p className="font-semibold text-[#1E293B] text-sm">
                {dragOver ? "Drop to upload" : "Tap to choose an XLSX file"}
              </p>
              <p className="text-xs text-gray-400 mt-1">or drag and drop here</p>
            </div>

            {uploadState === "error" && (
              <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            )}
          </div>
        )}

        {/* Uploading */}
        {uploadState === "uploading" && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <div className="w-12 h-12 rounded-full border-4 border-[#1F7A4C]/20 border-t-[#1F7A4C] animate-spin mx-auto mb-4" />
            <p className="font-semibold text-[#1E293B] text-sm">Importing {fileName}…</p>
            <p className="text-xs text-gray-400 mt-1">Parsing sheets and updating records</p>
          </div>
        )}

        {/* Import result */}
        {uploadState === "success" && result && (
          <div className="space-y-4">
            {/* Banner */}
            <div className={`rounded-2xl px-4 py-4 flex items-center gap-3 ${
              totalErrors > 0 ? "bg-amber-50 border border-amber-200" : "bg-emerald-50 border border-emerald-200"
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                totalErrors > 0 ? "bg-amber-100" : "bg-emerald-100"
              }`}>
                {totalErrors > 0 ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
              <div>
                <p className={`font-bold text-sm ${totalErrors > 0 ? "text-amber-800" : "text-emerald-800"}`}>
                  {totalErrors > 0 ? "Import completed with warnings" : "Import successful"}
                </p>
                <p className={`text-xs ${totalErrors > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {totalImported} records {totalErrors > 0
                    ? `processed, ${totalErrors} row${totalErrors !== 1 ? "s" : ""} skipped`
                    : "added or updated"}
                </p>
              </div>
            </div>

            {/* Sheet breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <h2 className="font-semibold text-[#1E293B] text-sm mb-1">Sheet results</h2>
              <p className="text-xs text-gray-400 mb-3">{fileName}</p>
              <SheetSummary label="Products" result={result.products} />
              <SheetSummary label="Stores"   result={result.stores} />
              <SheetSummary label="Prices"   result={result.prices} />
            </div>

            {/* Row errors */}
            {result.errors.length > 0 && (
              <div className="bg-white rounded-2xl border border-amber-100 p-4">
                <h2 className="font-semibold text-[#1E293B] text-sm mb-3">
                  Skipped rows ({result.errors.length})
                </h2>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                        {err.sheet} row {err.row}
                      </span>
                      <span className="text-gray-600 pt-0.5">{err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 py-3.5 rounded-2xl border-2 border-[#1F7A4C] text-[#1F7A4C] font-semibold text-sm hover:bg-[#1F7A4C]/5 transition-colors"
              >
                Import another file
              </button>
              <Link href="/">
                <button className="flex-1 py-3.5 rounded-2xl bg-[#1F7A4C] text-white font-semibold text-sm hover:bg-[#1F7A4C]/90 transition-colors">
                  Go to app
                </button>
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
