"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Loader2, Unlink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLinkedGs1Product, unlinkGs1Match } from "@/app/actions/gs1Products";
import type { Gs1Product } from "@/types/gs1";

const METHOD_LABEL: Record<string, string> = {
  gtin_field: "GTIN field match",
  gtin_in_name: "GTIN found in item name",
  exact_name: "Exact name match",
  high_similarity: "High name similarity",
  suggested_similarity: "Suggested match",
  manual: "Manually linked",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-foreground-subtle">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-foreground">{value ?? <span className="italic text-foreground-subtle">—</span>}</dd>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        {title}
      </h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">{children}</dl>
    </div>
  );
}

interface LinkedGs1Data {
  product: Gs1Product;
  link: {
    status: string;
    matchMethod: string;
    matchReason: string | null;
    matchScore: number | null;
  };
}

interface Gs1FieldsPanelProps {
  bcItemId: string;
  canEdit: boolean;
}

export function Gs1FieldsPanel({ bcItemId, canEdit }: Gs1FieldsPanelProps) {
  const [data, setData] = useState<LinkedGs1Data | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setData(undefined);
    setError(null);
    startTransition(async () => {
      try {
        const result = await getLinkedGs1Product(bcItemId);
        setData(result);
      } catch {
        setError("Failed to load GS1 data.");
      }
    });
  }, [bcItemId]);

  function handleUnlink() {
    if (!data) return;
    startTransition(async () => {
      try {
        await unlinkGs1Match(data.product.id, bcItemId);
        setData(null);
      } catch {
        setError("Failed to unlink.");
      }
    });
  }

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center py-12 text-foreground-muted">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg bg-destructive-subtle px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium text-foreground-muted">No GS1 product linked</p>
        <p className="mt-1 text-xs text-foreground-subtle">
          Use &ldquo;Import GS1 Excel&rdquo; in the items header to import and match GS1 products.
        </p>
      </div>
    );
  }

  const { product, link } = data;

  return (
    <div className="space-y-3">
      {/* Link status */}
      <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-raised p-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={link.status === "approved" ? "success" : "info"}>
              {link.status === "approved" ? "Approved" : "Auto-linked"}
            </Badge>
            <span className="text-xs text-foreground-muted">
              {METHOD_LABEL[link.matchMethod] ?? link.matchMethod}
              {link.matchScore !== null && ` (${Math.round(link.matchScore * 100)}%)`}
            </span>
          </div>
          {link.matchReason && (
            <p className="text-[11px] text-foreground-subtle">{link.matchReason}</p>
          )}
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={handleUnlink}
            title="Unlink this GS1 product"
          >
            <Unlink className="size-4" />
            Unlink
          </Button>
        )}
      </div>

      <FieldGroup title="Identification">
        <Field label="GTIN" value={<span className="font-mono">{product.gtin ?? product.normalizedGtin}</span>} />
        <Field label="UPC (GTIN-12)" value={product.gtin12Upc ? <span className="font-mono">{product.gtin12Upc}</span> : null} />
        <Field label="EAN (GTIN-13)" value={product.gtin13Ean ? <span className="font-mono">{product.gtin13Ean}</span> : null} />
        <Field label="GS1 Company Prefix" value={product.gs1CompanyPrefix} />
        <Field label="SKU" value={product.sku} />
      </FieldGroup>

      <FieldGroup title="Product details">
        <Field label="Brand" value={product.brandName} />
        <Field label="Description" value={product.productDescription} />
        <Field label="Short description" value={product.productDescriptionShort} />
        <Field label="Label description" value={product.labelDescription} />
        <Field label="Industry" value={product.productIndustry} />
        <Field label="Packaging level" value={product.packagingLevel} />
        <Field label="Status" value={product.statusLabel} />
        <Field label="GPC Brick" value={product.gpcBrick} />
        <Field label="Target markets" value={product.targetMarkets} />
      </FieldGroup>

      {(product.netWeightNumeric !== null ||
        product.grossWeightNumeric !== null ||
        product.depthNumeric !== null) && (
        <FieldGroup title="Dimensions &amp; weight">
          {product.netWeightNumeric !== null && (
            <Field
              label="Net weight"
              value={`${product.netWeightNumeric}${product.netWeightUnit ? ` ${product.netWeightUnit}` : ""}`}
            />
          )}
          {product.grossWeightNumeric !== null && (
            <Field
              label="Gross weight"
              value={`${product.grossWeightNumeric}${product.grossWeightUnit ? ` ${product.grossWeightUnit}` : ""}`}
            />
          )}
          {product.depthNumeric !== null && (
            <Field
              label="Depth"
              value={`${product.depthNumeric}${product.depthUnit ? ` ${product.depthUnit}` : ""}`}
            />
          )}
          {product.widthNumeric !== null && (
            <Field
              label="Width"
              value={`${product.widthNumeric}${product.widthUnit ? ` ${product.widthUnit}` : ""}`}
            />
          )}
          {product.heightNumeric !== null && (
            <Field
              label="Height"
              value={`${product.heightNumeric}${product.heightUnit ? ` ${product.heightUnit}` : ""}`}
            />
          )}
        </FieldGroup>
      )}

      {product.imageUrl && (
        <FieldGroup title="Image">
          <div className="col-span-full">
            <a
              href={product.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" />
              View product image
            </a>
          </div>
        </FieldGroup>
      )}
    </div>
  );
}
