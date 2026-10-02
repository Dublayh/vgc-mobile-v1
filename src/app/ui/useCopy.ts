import { useEffect, useRef, useState } from 'react';

/**
 * Clipboard copy with a transient "copied" flag for inline confirmation.
 * Resolves false when the clipboard is blocked so callers can fall back
 * (e.g. show the text in a textarea).
 */
export function useCopy(resetMs = 2200): {
  copied: boolean;
  copy: (text: string) => Promise<boolean>;
} {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const copy = async (text: string) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = false;
    }
    setCopied(ok);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), resetMs);
    return ok;
  };
  return { copied, copy };
}
