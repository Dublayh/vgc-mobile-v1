/** "Ask Claude" — copies a structured prompt to the clipboard (plan §4 AdviceExport). */
import { Button } from '../../app/ui/Button';
import { useCopy } from '../../app/ui/useCopy';

export function AdviceButton({ onCopy }: { onCopy: () => string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="flex items-center gap-2">
      <Button onClick={() => copy(onCopy())}>Ask Claude — copy prompt</Button>
      {copied && <span className="text-xs text-legal">Copied — paste into claude.ai</span>}
    </div>
  );
}
