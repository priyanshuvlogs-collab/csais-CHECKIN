"use client";

import { useState } from "react";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard can be unavailable on http; select-and-copy fallback not needed.
        }
      }}
      className="ml-2 rounded border border-line bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted hover:text-foreground"
      title="Copy to clipboard"
    >
      {copied ? "Copied!" : (label ?? "Copy")}
    </button>
  );
}
