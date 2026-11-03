import { useState } from "react";
import { ExternalLink } from "lucide-react";
import solar from "./data/solar-shift.json";
import { linePath, useElementWidth } from "./ProductWatch";
import { formatDate, monthLabel } from "./data";
import { More } from "./Glossary";
import { labelPositions } from "./HubShared";

// A real case for the Trade flows tab: U.S. imports of solar modules (HS 8541.43) by supplier group,
// around the 2024–25 duty case on four Southeast Asian countries, the 2025–26 case on the next three,
// and the suppliers that grew after that.
type Partner = keyof typeof solar.partners;
const sum = (codes: Partner[], index: number) => codes.reduce((total, code) => total + solar.partners[code][index], 0);
const groups = [
  { id: "first", label: "Cambodia, Malaysia, Thailand, Vietnam", short: "First case (4)", color: "#bd5d3d", codes: ["KHM", "MYS", "THA", "VNM"] as Partner[] },
  { id: "second", label: "India, Indonesia, Laos", short: "Second case (3)", color: "#008574", codes: ["IND", "IDN", "LAO"] as Partner[] },
  { id: "newest", label: "Ethiopia, Philippines, Kenya, Nigeria, Djibouti, Egypt", short: "Newest suppliers (6)", color: "#4d6a96", codes: ["ETH", "PHL", "KEN", "NGA", "DJI", "EGY"] as Partner[] },
].map((group) => ({ ...group, values: solar.periods.map((_, index) => sum(group.codes, index)) }));
const named = solar.periods.map((_, index) => groups.reduce((total, group) => total + group.values[index], 0));
const series = [...groups, { id: "rest", label: "All other countries", short: "All others", color: "#a99c86", codes: [] as Partner[], values: solar.world.map((total, index) => Math.max(0, total - named[index])) }];

// Dates from Commerce and Federal Register notices; each marker sits on the month the step happened.
export const solarEvents = [
  { period: "2024-04", title: "Petition filed against Cambodia, Malaysia, Thailand and Vietnam", href: "https://www.trade.gov/final-affirmative-determinations-antidumping-and-countervailing-duty-investigations-crystalline" },
  { period: "2024-10", title: "Preliminary countervailing duties on the four (anti-dumping followed in Nov.)", href: "https://trade.gov/commerce-preliminary-countervailing-duty-investigation-crystalline-photovoltaic-cells-cambodia" },
  { period: "2025-06", title: "Duty orders on the four published (June 24)", href: "https://www.govinfo.gov/content/pkg/FR-2025-06-24/html/2025-11588.htm" },
  { period: "2025-07", title: "New petition against India, Indonesia and Laos (July 17)", href: "https://www.akingump.com/en/insights/alerts/adcvd-petitions-on-solar-cells-and-modules-from-india-indonesia-and-laos-solar-iv" },
  { period: "2026-02", title: "Preliminary countervailing duties on Indonesia published (Feb. 26)", href: "https://www.govinfo.gov/content/pkg/FR-2026-02-26/pdf/2026-03896.pdf" },
  { period: "2026-04", title: "Preliminary anti-dumping duties on India, Indonesia and Laos (Apr. 23)", href: "https://www.govinfo.gov/content/pkg/FR-2026-04-28/html/2026-08194.htm" },
];
const events = solarEvents.map((event) => ({ ...event, index: solar.periods.indexOf(event.period) })).filter((event) => event.index >= 0);

const formatUsd = (value: number) => value >= 1e9 ? `$${(value / 1e9).toFixed(2)}B` : `$${Math.round(value / 1e6)}M`;
const pct = (value: number) => `${Math.round(value * 100)}%`;
// Share of U.S. imports from a group over the months a filter keeps.
const total = (values: number[], keep: (period: string, index: number) => boolean) => values.reduce((sum, value, index) => keep(solar.periods[index], index) ? sum + value : sum, 0);
const spanShare = (values: number[], keep: (period: string, index: number) => boolean) => total(values, keep) / Math.max(1, total(solar.world, keep));

export default function SolarShift() {
  const [mode, setMode] = useState<"value" | "share">("share");
  const [hover, setHover] = useState<number | null>(null);
  const [chartRef, width] = useElementWidth<HTMLDivElement>();
  const periods = solar.periods;
  const count = periods.length;
  const plotted = series.map((line) => ({ ...line, plot: line.values.map((value, index) => mode === "share" ? (solar.world[index] ? value / solar.world[index] : 0) : value) }));

  const compact = width < 480, height = compact ? 210 : 250, left = 44, right = compact ? 12 : 150, top = 12, bottom = 26;
  const high = mode === "share" ? 1 : Math.ceil(Math.max(...solar.world) / 2.5e8) * 2.5e8;
  const ticks = Array.from({ length: 5 }, (_, index) => (high / 4) * index);
  const x = (index: number) => left + (index / Math.max(1, count - 1)) * (width - left - right);
  const y = (value: number) => top + (1 - value / high) * (height - top - bottom);
  const slot = (width - left - right) / Math.max(1, count - 1);
  const pointerIndex = (clientX: number, rect: DOMRect) => Math.max(0, Math.min(count - 1, Math.round((((clientX - rect.left) / rect.width) * width - left) / slot)));
  const every = compact ? 12 : 6;
  const labelYs = labelPositions(plotted.map((line) => y(line.plot[count - 1])), 13);
  const tickLabel = (tick: number) => mode === "share" ? pct(tick) : tick >= 1e9 ? `$${(tick / 1e9).toFixed(1)}B` : `$${Math.round(tick / 1e6)}M`;

  // Each group's share in 2024 (before the first orders), 2025, and the latest six months.
  const year = (prefix: string) => (period: string) => period.startsWith(prefix);
  const recent = (_: string, index: number) => index >= count - 6;
  const [first, second, newest] = groups;
  const shares = (values: number[]) => `${pct(spanShare(values, year("2024")))} → ${pct(spanShare(values, year("2025")))} → ${pct(spanShare(values, recent))}`;
  const monthly = (keep: (period: string, index: number) => boolean) => total(solar.world, keep) / Math.max(1, solar.periods.filter(keep).length);
  const metrics = [
    { label: "FIRST CASE · 4 COUNTRIES", value: shares(first.values), note: "share of U.S. imports, 2024 → 2025 → last 6 mo." },
    { label: "SECOND CASE · 3 COUNTRIES", value: shares(second.values), note: "share of U.S. imports, 2024 → 2025 → last 6 mo." },
    { label: "NEWEST SUPPLIERS · 6", value: shares(newest.values), note: "share of U.S. imports, 2024 → 2025 → last 6 mo." },
    { label: "ALL U.S. IMPORTS", value: `${formatUsd(monthly(year("2024")))} → ${formatUsd(monthly(recent))}`, note: "average per month, 2024 → last 6 mo." },
  ];

  const moveHover = (key: string) => {
    if (key === "ArrowRight") setHover((index) => index === null ? 0 : Math.min(count - 1, index + 1));
    if (key === "ArrowLeft") setHover((index) => index === null ? count - 1 : Math.max(0, index - 1));
  };
  const eventsAt = (index: number) => events.filter((event) => event.index === index);

  return <div className="flow-trend solar-shift">
    <More className="flow-trend-summary" gist="Each time duties hit, U.S. solar imports jumped to the next country."><p>Once duties loomed on solar modules from <b style={{ color: first.color }}>Cambodia, Malaysia, Thailand and Vietnam</b>, U.S. imports moved to <b style={{ color: second.color }}>India, Indonesia and Laos</b>. When those three faced their own case, imports moved again, to <b style={{ color: newest.color }}>Ethiopia, the Philippines, Kenya, Nigeria, Djibouti and Egypt</b>. Supply that moves country by country, one step ahead of each duty case, is the pattern a screener follows up: does each new supplier have the factories to make what it ships, who owns them, and where do its cells come from?</p></More>
    <div className="metric-ribbon solar-metrics">{metrics.map((metric) => <div className="metric-cell" key={metric.label}><span className="metric-label">{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></div>)}</div>
    <div className="flow-trend-chips" role="tablist" aria-label="Measure">{([["share", "Share of U.S. imports"], ["value", "Monthly value"]] as const).map(([id, label]) => <button type="button" role="tab" key={id} aria-selected={mode === id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}>{label}</button>)}</div>
    <div className="product-charts" ref={chartRef} tabIndex={0} aria-label="Solar import chart. Use left and right arrow keys to step through months." onKeyDown={(event) => moveHover(event.key)} onBlur={() => setHover(null)}>
      <div className="chart-shell">
        <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`U.S. monthly imports of solar modules by supplier group, ${mode === "share" ? "as a share of all U.S. imports" : "in U.S. dollars"}, ${monthLabel(periods[0])} to ${monthLabel(periods[count - 1])}, with duty-case milestones marked`}
          onPointerMove={(event) => setHover(pointerIndex(event.clientX, event.currentTarget.getBoundingClientRect()))} onPointerLeave={() => setHover(null)}>
          {ticks.map((tick) => <g key={tick}><line className="chart-gridline" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text className="axis-label" x={left - 7} y={y(tick) + 3} textAnchor="end">{tickLabel(tick)}</text></g>)}
          {periods.map((period, index) => index % every === 0 && <text key={period} className="axis-label" x={x(index)} y={height - 8} textAnchor="middle">{monthLabel(period)}</text>)}
          {events.map((event, order) => <g key={event.period} className="event-marker event-drop" style={{ animationDelay: `${400 + order * 140}ms` }}><line x1={x(event.index)} x2={x(event.index)} y1={top} y2={height - bottom} /><path d={`M${x(event.index)} ${height - bottom - 9}l4.5 4.5-4.5 4.5-4.5-4.5z`} /></g>)}
          <g className="chart-draw" key={mode}>
            {plotted.map((line) => <path key={line.id} className="trend-line" stroke={line.color} strokeWidth={line.id === "rest" ? 1.4 : 2.4} d={linePath(line.plot, x, y)} />)}
          </g>
          {plotted.filter((line) => line.id !== "rest").map((line) => <circle key={`${line.id}${mode}`} className="chart-pulse" cx={x(count - 1)} cy={y(line.plot[count - 1])} r="3" stroke={line.color} />)}
          {!compact && plotted.map((line, index) => <text key={line.id} className="direct-label label-fade" x={width - right + 10} y={labelYs[index] + 3} style={{ fill: line.color }}>{line.short}</text>)}
          {hover !== null && <g className="crosshair"><line className="crosshair-slide" x1={0} x2={0} y1={top} y2={height - bottom} style={{ transform: `translateX(${x(hover)}px)` }} />{plotted.map((line) => <circle key={line.id} cx={x(hover)} cy={y(line.plot[hover])} r="3.5" fill={line.color} />)}</g>}
          <rect x={left} y={top} width={Math.max(0, width - left - right)} height={height - top - bottom} fill="transparent" />
        </svg>
        {hover !== null && <div className="chart-tooltip" style={{ left: `${Math.min(72, Math.max(14, (hover / Math.max(1, count - 1)) * 72 + 6))}%` }} role="status">
          <b>{monthLabel(periods[hover]).toUpperCase()} · {formatUsd(solar.world[hover])} TOTAL</b>
          {series.map((line) => <span key={line.id}><i style={{ background: line.color }} />{line.short} <em>{formatUsd(line.values[hover])} · {pct(solar.world[hover] ? line.values[hover] / solar.world[hover] : 0)}</em></span>)}
          {eventsAt(hover).map((event) => <span key={event.period} className="tooltip-event"><i />{event.title}</span>)}
        </div>}
      </div>
    </div>
    <ol className="solar-events">{events.map((event) => <li key={event.period} onPointerEnter={() => setHover(event.index)} onPointerLeave={() => setHover(null)}><b>{monthLabel(event.period)}</b> <a href={event.href} target="_blank" rel="noreferrer">{event.title} <ExternalLink size={10} /></a></li>)}</ol>
    <details className="data-table-toggle"><summary>View data as a table</summary><div className="table-scroll"><table><thead><tr><th>Month</th>{series.map((line) => <th key={line.id}>{line.short}</th>)}<th>All countries</th></tr></thead><tbody>{periods.map((period, index) => <tr key={period}><td>{monthLabel(period)}</td>{series.map((line) => <td key={line.id}>{formatUsd(line.values[index])}</td>)}<td>{formatUsd(solar.world[index])}</td></tr>)}</tbody></table></div></details>
    <More className="visual-footnote" gist="U.S.-reported monthly solar module imports (HS 8541.43), from UN Comtrade."><p>U.S.-reported monthly imports of HS 8541.43 (photovoltaic cells assembled in modules or panels) by country of origin, UN Comtrade, {monthLabel(periods[0])} – {monthLabel(periods[count - 1])} (retrieved {formatDate(solar.generatedAt.slice(0, 10))}). A shift in suppliers after duties is legal and expected; it is a lead only where the new supply cannot be explained by new local capacity. Shows the full span regardless of the period menu. Refresh with <code>npm run data:solar-shift</code>.</p></More>
  </div>;
}
