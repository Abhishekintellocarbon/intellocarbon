export function ComplyProgress({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
      <div
        className="h-full rounded-full bg-gradient-teal-blue transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(4, percent))}%` }}
      />
    </div>
  );
}
