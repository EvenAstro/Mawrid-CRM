"use client";

/**
 * A tiny inline trend line for KPI cards — draws itself in on mount via a
 * stroke-dashoffset animation (see .spark-draw in globals.css). Purely
 * decorative context (the real numbers live in the KPI card itself), so
 * values are normalized to fit the viewBox and no axes/labels are drawn.
 */
export default function Sparkline({
  values,
  color,
  width = 84,
  height = 28,
  delay = 0,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  delay?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const pad = 3;
  const stepX = (width - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => ({
    x: pad + i * stepX,
    y: height - pad - ((v - min) / range) * (height - pad * 2),
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="overflow-visible">
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="spark-draw"
        style={{ animationDelay: `${delay}ms`, stroke: color }}
      />
    </svg>
  );
}
