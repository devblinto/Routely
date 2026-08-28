"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A copyable code block.
 *
 * The code is rendered as text, never as markup, so a value interpolated into it cannot
 * become live HTML. Long lines scroll inside the block rather than widening the page.
 *
 * `navigator.clipboard` is unavailable on insecure origins and can be denied by permission,
 * so a failure selects the text instead — the user can still copy manually rather than
 * pressing a button that silently does nothing.
 */
export function CodeBlock({
  code,
  label = "Copy code",
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeout.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      const node = codeRef.current;
      if (!node) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }

  return (
    <div className={cn("group/code relative", className)}>
      <pre className="overflow-x-auto rounded-lg bg-muted/60 py-3 pr-12 pl-3 ring-1 ring-border/70">
        <code ref={codeRef} className="font-mono text-xs leading-relaxed whitespace-pre">
          {code}
        </code>
      </pre>

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={copy}
        aria-label={copied ? "Copied" : label}
        className="absolute top-2 right-2"
      >
        {copied ? <Check className="text-primary" aria-hidden /> : <Copy aria-hidden />}
      </Button>

      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}
