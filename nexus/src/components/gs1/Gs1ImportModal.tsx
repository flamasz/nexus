"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  approveGs1Match,
  denyGs1Match,
  getGs1ImportReview,
  importGs1Excel,
  unlinkGs1Match,
} from "@/app/actions/gs1Products";
import { cn } from "@/lib/utils";
import type {
  Gs1ImportBatch,
  Gs1ImportResult,
  Gs1ReviewRow,
} from "@/types/gs1";

type Step = "upload" | "reviewing";

const METHOD_LABEL: Record<string, string> = {
  gtin_field: "GTIN field match",
  gtin_in_name: "GTIN in item name",
  exact_name: "Exact name match",
  high_similarity: "High similarity",
  suggested_similarity: "Suggested match",
  manual: "Manually linked",
};

const STATUS_FILTER_LABELS = ["All", "Auto-linked", "Suggestions", "Denied"] as const;
type StatusFilter = (typeof STATUS_FILTER_LABELS)[number];

function filterRows(rows: Gs1ReviewRow[], filter: StatusFilter): Gs1ReviewRow[] {
  if (filter === "All") return rows;
  if (filter === "Auto-linked")
    return rows.filter(
      (r) => r.candidate.status === "auto_linked" || r.candidate.status === "approved",
    );
  if (filter === "Suggestions")
    return rows.filter((r) => r.candidate.status === "suggested");
  if (filter === "Denied")
    return rows.filter(
      (r) => r.candidate.status === "denied" || r.candidate.status === "superseded",
    );
  return rows;
}

// ── Upload step ───────────────────────────────────────────────────────────────

function UploadStep({
  onImported,
}: {
  onImported: (result: Gs1ImportResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      setError(null);
    }
  }

  function handleSubmit() {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const result = await importGs1Excel(fd);
        onImported(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary hover:bg-primary-subtle/30",
          file && "border-primary bg-primary-subtle/20",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={handleFileChange}
        />
        {file ? (
          <>
            <FileSpreadsheet className="size-10 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-foreground-muted">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </>
        ) : (
          <>
            <Upload className="size-10 text-foreground-muted" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Drop your GS1 Data Hub export here
              </p>
              <p className="text-xs text-foreground-muted">
                .xlsx files only · ExportAllProducts sheet required
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button disabled={!file || isPending} onClick={handleSubmit}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Importing…
            </>
          ) : (
            <>
              <FileSpreadsheet className="size-4" />
              Import
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ── Review step ───────────────────────────────────────────────────────────────

function SummaryCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border border-border px-3 py-2 text-center", highlight && value > 0 && "border-primary bg-primary-subtle")}>
      <p className={cn("text-xl font-bold", highlight && value > 0 ? "text-primary" : "text-foreground")}>
        {value}
      </p>
      <p className="text-[11px] text-foreground-muted">{label}</p>
    </div>
  );
}

function ReviewStep({
  batchId,
  result,
}: {
  batchId: string;
  result: Gs1ImportResult;
}) {
  const [batch, setBatch] = useState<Gs1ImportBatch | null>(null);
  const [rows, setRows] = useState<Gs1ReviewRow[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await getGs1ImportReview(batchId);
        setBatch(data.batch);
        setRows(data.rows);
      } catch {
        setLoadError("Failed to load review data.");
      }
    });
  }, [batchId]);

  async function handleApprove(candidateId: string) {
    setActionError(null);
    startTransition(async () => {
      try {
        await approveGs1Match(candidateId);
        setRows((prev) =>
          prev.map((r) =>
            r.candidate.id === candidateId
              ? { ...r, candidate: { ...r.candidate, status: "approved" } }
              : r.candidate.status === "suggested" && r.gs1Product.id === prev.find(x => x.candidate.id === candidateId)?.gs1Product.id
              ? { ...r, candidate: { ...r.candidate, status: "superseded" } }
              : r,
          ),
        );
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Action failed.");
      }
    });
  }

  async function handleDeny(candidateId: string) {
    setActionError(null);
    startTransition(async () => {
      try {
        await denyGs1Match(candidateId);
        setRows((prev) =>
          prev.map((r) =>
            r.candidate.id === candidateId
              ? { ...r, candidate: { ...r.candidate, status: "denied" } }
              : r,
          ),
        );
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Action failed.");
      }
    });
  }

  async function handleUnlink(row: Gs1ReviewRow) {
    setActionError(null);
    startTransition(async () => {
      try {
        await unlinkGs1Match(row.gs1Product.id, row.bcItemId);
        setRows((prev) =>
          prev.map((r) =>
            r.candidate.id === row.candidate.id
              ? { ...r, candidate: { ...r.candidate, status: "denied" } }
              : r,
          ),
        );
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Action failed.");
      }
    });
  }

  const visible = filterRows(rows, filter);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <SummaryCard label="Total rows" value={result.totalRows} />
        <SummaryCard label="New" value={result.createdCount} />
        <SummaryCard label="Updated" value={result.updatedCount} />
        <SummaryCard label="Auto-linked" value={result.autoLinkedCount} highlight />
        <SummaryCard label="Suggestions" value={result.suggestedCount} highlight />
        <SummaryCard label="Errors" value={result.errorCount} />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {STATUS_FILTER_LABELS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f
                ? "bg-primary-subtle text-primary"
                : "text-foreground-muted hover:bg-surface hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {actionError && (
        <p className="rounded-lg bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {loadError && (
        <p className="rounded-lg bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      )}

      {/* Rows */}
      <div className="max-h-[40vh] space-y-2 overflow-y-auto">
        {isPending && rows.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-foreground-muted">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-4 text-center text-sm text-foreground-muted">
            No rows to show for this filter.
          </p>
        ) : (
          visible.map((row) => (
            <ReviewRowCard
              key={row.candidate.id}
              row={row}
              isPending={isPending}
              onApprove={() => handleApprove(row.candidate.id)}
              onDeny={() => handleDeny(row.candidate.id)}
              onUnlink={() => handleUnlink(row)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ReviewRowCard({
  row,
  isPending,
  onApprove,
  onDeny,
  onUnlink,
}: {
  row: Gs1ReviewRow;
  isPending: boolean;
  onApprove: () => void;
  onDeny: () => void;
  onUnlink: () => void;
}) {
  const { candidate, gs1Product, bcDisplayName, bcItemNumber, bcGtin } = row;
  const status = candidate.status;

  const isAutoLinked = status === "auto_linked" || status === "approved";
  const isSuggested = status === "suggested";
  const isDenied = status === "denied" || status === "superseded";

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-3",
        isDenied && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        {/* GS1 side */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {gs1Product.productDescription ?? gs1Product.brandName ?? gs1Product.normalizedGtin}
          </p>
          <p className="text-xs text-foreground-muted font-mono">
            GTIN {gs1Product.normalizedGtin}
            {gs1Product.brandName && ` · ${gs1Product.brandName}`}
          </p>
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          {isAutoLinked && (
            <Badge variant={status === "approved" ? "success" : "info"}>
              {status === "approved" ? "Approved" : "Auto-linked"}
            </Badge>
          )}
          {isSuggested && <Badge variant="warning">Suggestion</Badge>}
          {isDenied && <Badge variant="secondary">Denied</Badge>}
        </div>
      </div>

      {/* BC item */}
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{bcDisplayName}</p>
          <p className="text-xs text-foreground-muted font-mono">
            {bcItemNumber ?? "No BC #"}
            {bcGtin && ` · GTIN ${bcGtin}`}
          </p>
        </div>
      </div>

      {/* Match reason */}
      <p className="mt-1.5 text-[11px] text-foreground-subtle">
        {METHOD_LABEL[candidate.matchMethod] ?? candidate.matchMethod}
        {candidate.matchReason && ` — ${candidate.matchReason}`}
      </p>

      {/* Actions */}
      {!isDenied && (
        <div className="mt-2 flex gap-2">
          {isSuggested && (
            <Button size="sm" variant="outline" disabled={isPending} onClick={onApprove}>
              <CheckCircle className="size-3.5" />
              Approve link
            </Button>
          )}
          {isAutoLinked && (
            <Button size="sm" variant="outline" disabled={isPending} onClick={onUnlink}>
              <X className="size-3.5" />
              Unlink
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={isPending} onClick={onDeny}>
            Deny
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Gs1ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Gs1ImportModal({ open, onOpenChange }: Gs1ImportModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [importResult, setImportResult] = useState<Gs1ImportResult | null>(null);

  function handleImported(result: Gs1ImportResult) {
    setImportResult(result);
    setStep("reviewing");
  }

  function handleClose() {
    onOpenChange(false);
    // Reset after close animation
    setTimeout(() => {
      setStep("upload");
      setImportResult(null);
    }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" ? "Import GS1 Data Hub Export" : "GS1 Import Review"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload"
              ? "Upload an .xlsx file exported from GS1 Data Hub. Nexus will parse products, deduplicate by GTIN, and detect matches with your Business Central items."
              : "Review auto-detected matches. Approve suggestions or unlink auto-linked items before closing."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" ? (
          <UploadStep onImported={handleImported} />
        ) : importResult ? (
          <ReviewStep batchId={importResult.batchId} result={importResult} />
        ) : null}

        {step === "reviewing" && (
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={handleClose}>
              Done
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
