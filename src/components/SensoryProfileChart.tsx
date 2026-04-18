import { fmtHour, loadToLevel, levelColorVar } from "@/lib/sensory";

export function SensoryProfileChart({ hourly, height = 96 }: { hourly: number[]; height?: number }) {
  const max = 100;
  return (
    <div>
      <div
        className="flex items-end gap-[2px] rounded-md bg-muted/40 p-2"
        style={{ height }}
        role="img"
        aria-label="24-hour sensory load profile"
      >
        {hourly.map((v, h) => {
          const level = loadToLevel(v);
          const heightPct = Math.max(4, (v / max) * 100);
          return (
            <div
              key={h}
              className="flex-1 rounded-sm transition-all"
              style={{
                height: `${heightPct}%`,
                backgroundColor: levelColorVar(level),
              }}
              title={`${fmtHour(h)} — ${v} load`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between px-1 text-[10px] text-muted-foreground">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>11pm</span>
      </div>
    </div>
  );
}
