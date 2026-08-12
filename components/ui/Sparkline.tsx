"use client";

/**
 * A tiny inline trend line for KPI tiles.
 *
 * `animate` is opt-in rather than always-on: under the Meridian motion rule
 * dashboard content does not animate in, and the self-drawing stroke is an
 * entrance like any other. Marketing surfaces pass `animate` to get it back.
 *
 * Values are normalised to the viewBox with no axes or labels — the real
 * figure lives in the tile beside it, so this only has to carry shape.
 */
export default function Sparkline({
  values,
  color,
  width = 84,
  height = 28,
  delay = 0,
  animate = false,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  delay?: number;
  animate?: boolean;
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
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="overflow-visible"
      aria-hidden="true"
    >
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animate ? "spark-draw" : undefined}
        style={animate ? { animationDelay: `${delay}ms`, stroke: color } : { stroke: color }}
      />
      {/* The endpoint is the value that matters — the rest is just the path to it. */}
      <circle cx={last.x} cy={last.y} r={2.2} fill={color} />
    </svg>
  );
}
