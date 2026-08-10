"use client";

import { useEffect, useState } from "react";
import { signedAttachmentUrl } from "@/lib/models/messages";
import { DocumentIcon } from "@/components/icons";
import type { MessageRow } from "@/lib/models/messages";

/**
 * Renders a message's attachment.
 *
 * The bucket is private, so there is no permanent URL — a signed one is minted
 * per view and expires. That is the point: an internal attachment should not
 * be readable by anyone who happens to hold a link.
 *
 * Images render inline because a preview is the whole reason to send one.
 * Everything else is a row with a name, a type and a size, which is what a
 * person needs to decide whether to open it.
 */

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميغابايت`;
}

export default function Attachment({ message }: { message: MessageRow }) {
  const path = message.attachment_path;
  const isImage = (message.attachment_type ?? "").startsWith("image/");
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    signedAttachmentUrl(path).then(({ data, error }) => {
      if (!alive) return;
      if (error || !data?.signedUrl) {
        console.error("[chat] could not sign attachment url", error);
        setFailed(true);
        return;
      }
      setUrl(data.signedUrl);
    });
    return () => {
      alive = false;
    };
  }, [path]);

  if (!path) return null;

  if (failed) {
    return (
      <p className="t-caption rounded-[var(--radius-sm)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-[color:var(--status-danger-fg)]">
        تعذّر فتح المرفق
      </p>
    );
  }

  if (isImage) {
    return (
      <a
        href={url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-fit overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border-subtle)]"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={message.attachment_name ?? "صورة مرفقة"}
            className="max-h-72 max-w-[min(320px,100%)] object-cover"
            loading="lazy"
          />
        ) : (
          <span className="skeleton-shimmer block h-40 w-[240px]" />
        )}
      </a>
    );
  }

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-fit max-w-full items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2.5 transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-hover)]"
    >
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[var(--radius-xs)] bg-[var(--surface-raised)] text-[color:var(--content-accent)]">
        <DocumentIcon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span dir="auto" className="t-body-sm block truncate font-semibold text-[color:var(--content-primary)]">
          {message.attachment_name}
        </span>
        <span className="t-micro block text-[color:var(--content-tertiary)]">
          {message.attachment_size ? humanSize(message.attachment_size) : "ملف"}
        </span>
      </span>
    </a>
  );
}
