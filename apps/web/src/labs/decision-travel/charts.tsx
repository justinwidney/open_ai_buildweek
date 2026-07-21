import type { LifeStateSnapshot, MonthlyForecastBand } from "@control-ai/engine";
import { fmtMoney } from "./format";
import { STOP_MONTHS } from "./pathModel";

const PLUM = "#6a4a97";
const PLUM_SOFT = "rgba(106, 74, 151, 0.18)";
const MUTED = "#a58b5c";
const GRID = "rgba(124, 98, 56, 0.25)";
const AXIS_LABEL = "#6d5c3f";

function sampleYearly(snapshots: readonly LifeStateSnapshot[]): { month: number; nw: number }[] {
  const out: { month: number; nw: number }[] = [];
  for (let i = 0; i < snapshots.length; i += STOP_MONTHS) out.push({ month: snapshots[i]!.month, nw: snapshots[i]!.netWorthCents });
  return out;
}

export function NetWorthChart({ journey, baseline, month, startAge, horizon }: { journey: readonly LifeStateSnapshot[]; baseline: readonly LifeStateSnapshot[]; month: number; startAge: number; horizon: number }) {
  const W = 640;
  const H = 240;
  const pad = 40;
  const j = sampleYearly(journey);
  const b = sampleYearly(baseline);
  const maxNw = Math.max(1, ...j.map((p) => p.nw), ...b.map((p) => p.nw));
  const x = (m: number) => pad + (m / horizon) * (W - pad * 2);
  const y = (nw: number) => H - pad - (Math.max(0, nw) / maxNw) * (H - pad * 2);
  const line = (pts: { month: number; nw: number }[]) => pts.map((p) => `${x(p.month)},${y(p.nw)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Net worth over time: your path versus the do-nothing baseline">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad} y1={y(maxNw * f)} x2={W - pad} y2={y(maxNw * f)} stroke={GRID} strokeWidth={1} />
          <text x={4} y={y(maxNw * f) + 3} fill={AXIS_LABEL} fontSize={10}>{fmtMoney(maxNw * f)}</text>
        </g>
      ))}
      <line x1={x(month)} y1={pad - 8} x2={x(month)} y2={H - pad} stroke="rgba(58,46,30,0.4)" strokeWidth={1.5} strokeDasharray="4 4" />
      <polyline points={line(b)} fill="none" stroke={MUTED} strokeWidth={2} strokeDasharray="5 4" />
      <polyline points={line(j)} fill="none" stroke={PLUM} strokeWidth={2.5} strokeLinejoin="round" />
      {[0, 10, 20, 30, 40].filter((yr) => yr * 12 <= horizon).map((yr) => (
        <text key={yr} x={x(yr * 12)} y={H - 8} fill={AXIS_LABEL} fontSize={10} textAnchor="middle">{startAge + yr}</text>
      ))}
      <g fontSize={11}>
        <rect x={pad} y={6} width={10} height={3} fill={PLUM} /><text x={pad + 14} y={11} fill={AXIS_LABEL}>Your path</text>
        <rect x={pad + 88} y={6} width={10} height={3} fill={MUTED} /><text x={pad + 102} y={11} fill={AXIS_LABEL}>Do nothing</text>
      </g>
    </svg>
  );
}

export function ForecastBandsChart({ bands, startMonth, startAge }: { bands: readonly MonthlyForecastBand[]; startMonth: number; startAge: number }) {
  const W = 640;
  const H = 240;
  const pad = 44;
  const yearly = bands.filter((_, i) => i % STOP_MONTHS === 0);
  const maxV = Math.max(1, ...yearly.map((s) => s.percentileCents[90] ?? 0));
  const totalMonths = bands.length - 1;
  const x = (i: number) => pad + (i / Math.max(1, totalMonths)) * (W - pad * 2);
  const y = (v: number) => H - pad - (Math.max(0, v) / maxV) * (H - pad * 2);
  const upper = yearly.map((s) => `${x(s.month - startMonth)},${y(s.percentileCents[90] ?? 0)}`);
  const lower = yearly.map((s) => `${x(s.month - startMonth)},${y(s.percentileCents[10] ?? 0)}`).reverse();
  const median = yearly.map((s) => `${x(s.month - startMonth)},${y(s.percentileCents[50] ?? 0)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Monte Carlo forecast: median net worth with a 10th-to-90th percentile band">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad} y1={y(maxV * f)} x2={W - pad} y2={y(maxV * f)} stroke={GRID} strokeWidth={1} />
          <text x={4} y={y(maxV * f) + 3} fill={AXIS_LABEL} fontSize={10}>{fmtMoney(maxV * f)}</text>
        </g>
      ))}
      <polygon points={[...upper, ...lower].join(" ")} fill={PLUM_SOFT} stroke="none" />
      <polyline points={median} fill="none" stroke={PLUM} strokeWidth={2.5} />
      {[0, 10, 20, 30, 40].filter((yr) => yr * 12 <= totalMonths).map((yr) => (
        <text key={yr} x={x(yr * 12)} y={H - 8} fill={AXIS_LABEL} fontSize={10} textAnchor="middle">{startAge + yr}</text>
      ))}
      <g fontSize={11}>
        <rect x={pad} y={6} width={10} height={3} fill={PLUM} /><text x={pad + 14} y={11} fill={AXIS_LABEL}>Median (P50)</text>
        <rect x={pad + 100} y={4} width={10} height={8} fill={PLUM_SOFT} /><text x={pad + 114} y={11} fill={AXIS_LABEL}>P10–P90</text>
      </g>
    </svg>
  );
}
