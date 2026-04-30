import { Archive, Download, FileText, LoaderCircle, Trash2, Upload, X } from 'lucide-react'

import { CategoryBadge } from '@/components/ui/category-badge'
import { UploadStatusBadge } from '@/components/ui/upload-status-badge'

import { CompactDropdownChip, SectionHeading, SurfaceCard, uploadQueue } from './shared'

export function SectionUploadReview() {
  return (
    <section id="uploads" className="space-y-6">
      <SectionHeading
        title="Upload Review Flow"
        description="The design system now documents the live artwork modal in more detail: modal header context, drag-and-drop uploads, queue progress, file list actions, and upload session review cards."
      />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SurfaceCard title="Artwork modal header" eyebrow="Modal chrome">
          <div className="space-y-4">
            <div className="flex items-start justify-between rounded-lg border border-border bg-surface p-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">Mailer Box</h3>
                  <span className="text-lg font-bold text-warning">V3</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <CategoryBadge category={{ name: 'Mailers', color: 'blue' }} />
                  <span className="text-sm text-foreground-muted">320 × 240 × 80 mm</span>
                </div>
                <div className="mt-3 inline-flex">
                  <CompactDropdownChip label="Approved" className="bg-success-subtle text-success border-success/30" />
                </div>
              </div>
              <button className="rounded-md p-1.5 text-foreground-subtle transition-colors hover:bg-surface-raised hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>

            <div className="grid gap-2 text-xs text-foreground-muted sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-3">If no packaging record exists for item + category + version, uploads remain blocked.</div>
              <div className="rounded-lg border border-border bg-surface p-3">Packaging item status sits above upload history and follows the same semantic badge system.</div>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard title="Drop zone + upload progress" eyebrow="Uploads">
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-primary bg-primary-subtle/60 p-8 text-center">
              <Upload className="mx-auto mb-4 size-11 text-primary" />
              <p className="font-medium text-foreground">Drag and drop files here</p>
              <p className="mt-1 text-sm text-foreground-muted">or click to browse</p>
              <p className="mt-2 text-xs text-foreground-subtle">Accepted formats: .ai, .pdf</p>
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary-subtle p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-medium text-primary">Uploading Files…</h4>
                <button className="text-sm text-primary hover:text-primary-hover">Cancel</button>
              </div>
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between text-sm text-primary">
                  <span>Overall Progress</span>
                  <span>61%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
                  <div className="h-full w-[61%] rounded-full bg-primary" />
                </div>
              </div>
              <div className="space-y-2">
                {uploadQueue.map((file) => (
                  <div key={file.name} className="flex items-center gap-3 text-sm">
                    <div className="shrink-0">
                      {file.state === 'complete' ? (
                        <div className="flex size-5 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">✓</div>
                      ) : file.state === 'uploading' ? (
                        <LoaderCircle className="size-5 animate-spin text-primary" />
                      ) : (
                        <div className="flex size-5 items-center justify-center rounded-full border border-primary/30 text-[10px] text-primary">…</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-foreground">{file.name}</p>
                      <p className="text-xs text-foreground-muted">{file.size}</p>
                    </div>
                    <span className="text-xs text-foreground-muted">{file.progress}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <SurfaceCard title="File list actions" eyebrow="Downloads + delete">
          <div className="space-y-2">
            {uploadQueue.slice(0, 2).map((file) => (
              <div key={file.name} className="flex items-center justify-between rounded-md border border-border bg-surface p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-8 text-foreground-subtle" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-foreground-muted">{file.size}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-foreground-subtle">
                  <button className="rounded p-1.5 transition-colors hover:bg-primary-subtle hover:text-primary">
                    <Download className="size-4" />
                  </button>
                  <button className="rounded p-1.5 transition-colors hover:bg-destructive-subtle hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard title="Upload session review card" eyebrow="History">
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="border-b border-border bg-surface-raised p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <UploadStatusBadge status="uploaded" />
                    <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-xs text-foreground-muted">Archived</span>
                    <button className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground-muted">
                      Uploaded
                    </button>
                  </div>
                  <p className="text-sm text-foreground-muted">Uploaded by Jane Doe on Apr 5, 2026 at 9:42 AM HST</p>
                </div>
                <div className="flex items-center gap-1 text-foreground-subtle">
                  <button className="rounded p-1.5 transition-colors hover:bg-surface hover:text-foreground"><Archive className="size-4" /></button>
                  <button className="rounded p-1.5 transition-colors hover:bg-destructive-subtle hover:text-destructive"><Trash2 className="size-4" /></button>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <h4 className="mb-2 text-sm font-medium text-foreground">Files</h4>
                <div className="space-y-2">
                  {uploadQueue.slice(0, 2).map((file) => (
                    <div key={file.name} className="flex items-center justify-between rounded-md border border-border bg-surface-raised px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="size-4 text-foreground-subtle" />
                        <span className="truncate text-foreground">{file.name}</span>
                      </div>
                      <span className="text-xs text-foreground-muted">{file.size}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-foreground">Notes</h4>
                  <span className="text-xs text-foreground-muted">Autosave after edits</span>
                </div>
                <textarea readOnly value="Client wants the dieline marks removed before approval. Notes remain editable without leaving the review card." className="min-h-24 w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none" />
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </section>
  )
}
