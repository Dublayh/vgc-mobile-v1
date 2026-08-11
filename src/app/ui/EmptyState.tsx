import { Icon, type IconName } from './Icon';

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: IconName;
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto mt-14 flex max-w-70 flex-col items-center border border-dashed border-ink-700 px-6 py-10 text-center">
      <Icon name={icon} size={34} className="text-ink-500" strokeWidth={1.4} />
      <p className="mt-4 font-display text-xl font-semibold tracking-wide uppercase text-ink-200">
        {title}
      </p>
      <p className="mt-1.5 text-sm text-ink-400">{hint}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
