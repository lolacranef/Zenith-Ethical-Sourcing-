import { useState } from "react";
import { Database, Globe2, Search, ShieldAlert } from "lucide-react";
import hubElectronics from "./data/hub-electronics.json";
import sayari from "./data/sayari-hub-electronics.json";
import { HowToRead, Term } from "./Glossary";
import { SERIES_COLORS, linePath, useElementWidth } from "./ProductWatch";
import { CountBars, countryNames, formatUsd, labelPositions, smallShare, times } from "./HubShared";
import { formatCount, formatDate, formatGap, formatShare } from "./data";

type Codes = Record<string, number>;
type Route = { code: number; name: string; reported: boolean; toRussia: Codes; toWorld: Codes };
type Year = { year: number; routes: Route[] };
type ChipSource = { code: number; name: string; value: number; partnerReported: number | null };
type FlagKey = "chplCritical" | "sanctioned" | "ofacSdn" | "stateProcurement" | "exportControls";
type SayariRoute = { records: number; earliest: string; latest: string; suppliers: number; buyers: number; origin: [string, number][]; supplierFlags: { chplCritical: number; sanctioned: number; sanctionedAdjacent: number }; buyerFlags: Record<FlagKey, number>; supplierWarnings: Record<"sanctioned" | "ofacSdn" | "entityList" | "massAddress" | "diversionAddress", number | null> };

const years = (hubElectronics.years as unknown as Year[]).filter((year) => year.year <= new Date().getUTCFullYear() - 2);
const codeNames = hubElectronics.codes as Record<string, string>;
const chipSources = hubElectronics.chipSources as unknown as Record<string, { year: number; sources: ChipSource[] }>;
const sayariRoutes = sayari.routes as unknown as Record<string, SayariRoute>;
const russiaAll = sayari.russiaAll;
const CODES = Object.keys(codeNames);
const total = (codes: Codes | undefined) => CODES.reduce((sum, code) => sum + (codes?.[code] ?? 0), 0);
const BASELINE = 2021;
const shortName = (name: string) => name.replace("China, Hong Kong SAR", "Hong Kong").replace("United Arab Emirates", "UAE").replace("Viet Nam", "Vietnam").replace("Rep. of Korea", "South Korea");
const routeOf = (year: Year, code: number) => year.routes.find((route) => route.code === code);
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

// Per-hub framing. Written 2026-10-19; context and leads to check, not findings.
export const electronicsHubs: { code: number; label: string; iso: string; note: string; cards: { title: string; body: string }[]; sources: { label: string; url: string }[] }[] = [
  { code: 784, label: "UAE", iso: "ARE", note: "The UAE has not adopted Western sanctions on Russia. In November 2023 the U.S. Treasury designated about 21 UAE-based firms and individuals for supplying Russia with high-priority dual-use goods.",
    cards: [
      { title: "Chips missing from UAE statistics", body: "The UAE reports only a few million dollars of chips a year to Russia, yet Sayari holds thousands of Russian import records of chips shipped from the UAE. UAE figures may not fully capture free-zone re-exports." },
      { title: "Same playbook as gold", body: "The free-zone features that make the UAE a gold hub (fast licensing, no customs duty, re-export logistics) also suit electronics. A supplier formed shortly before its first Russian shipment is a classic red flag." },
    ],
    sources: [
      { label: "Kelley Drye: OFAC enhances sanctions on Russia’s procurement networks (Nov 2023)", url: "https://www.kelleydrye.com/viewpoints/blogs/trade-and-manufacturing-monitor/ofac-enhances-sanctions-on-russia-and-its-procurement-networks-abroad" },
    ] },
  { code: 344, label: "Hong Kong", iso: "HKG", note: "Hong Kong follows China’s position and has not adopted Western sanctions. Public analyses have named it the largest third-country route for Western-designed chips reaching Russia.",
    cards: [
      { title: "The largest third-country route", body: "Chips shipped from Hong Kong make up about a quarter of Russia’s chip import records in Sayari, second only to China, and over 900 Russian companies bought through it. Its reported value fell after 2021, so records and statistics tell different stories." },
      { title: "Many small intermediaries", body: "More than 1,700 suppliers shipped chips from Hong Kong to Russia. Sayari flags 114 of them for using an address shared by many companies and 84 for addresses the U.S. Commerce Department lists as high diversion risk." },
      { title: "Matches official figures", body: "A U.S. Commerce Department official told Reuters that CHPL shipments through Hong Kong fell 28% between January and May 2024, in line with the lower 2024 figure Hong Kong reports." },
    ],
    sources: [
      { label: "The Standard (Reuters): illicit chip flows to Russia seen slowing, but China and Hong Kong remain hubs (2024)", url: "https://www.thestandard.com.hk/news/article/218629/Illicit-chip-flows-to-Russia-seen-slowing-but-China-Hong-Kong-remain-transshipment-hubs" },
    ] },
  { code: 792, label: "Türkiye", iso: "TUR", note: "Türkiye is a NATO member that has not adopted EU or U.S. sanctions on Russia. From 1 March 2023 it began blocking the transit of Western-sanctioned goods to Russia, though goods made in Türkiye can still be shipped.",
    cards: [
      { title: "A route that opened after 2021", body: "Türkiye reported under $1M of these goods sent to Russia in 2021 and about $20M a year in 2022 and 2023, while Sayari shows nearly 400 Russian buyers of Turkish-shipped chips." },
      { title: "After the 2023 tightening", body: "Türkiye’s reported figure roughly halved in 2024, a year after it began blocking transit of sanctioned goods. Goods made in Türkiye were exempt, so check whether chips moved into locally assembled products, other codes or other routes." },
    ],
    sources: [
      { label: "AJOT (Reuters): Turkey blocks transit of goods sanctioned by EU, US to Russia (Mar 2023)", url: "https://www.ajot.com/news/turkey-blocks-transit-of-goods-sanctioned-by-eu-us-to-russia" },
    ] },
  { code: 398, label: "Kazakhstan", iso: "KAZ", note: "Kazakhstan is in the Eurasian Economic Union with Russia and shares a long land border. Goods move into Russia without customs declarations, so Russian import records barely capture this route.",
    cards: [
      { title: "Visible in statistics, not in shipments", body: "Kazakhstan reported about $50–60M a year of these goods sent to Russia in 2022 and 2023, yet Sayari holds only a few hundred Russian import records, from just 8 suppliers. The customs union means most of this trade carries no declaration." },
      { title: "Compare imports with re-exports", body: "A sharp rise in Kazakhstan’s own imports of these codes from China and Europe after 2022, without matching domestic demand, is the usual sign of re-export." },
    ],
    sources: [] },
  { code: 51, label: "Armenia", iso: "ARM", note: "Armenia is in the Eurasian Economic Union with Russia, so goods cross without customs declarations. It is also a gold route to the UAE, as the gold hub shows.",
    cards: [
      { title: "Statistics without records", body: "Armenia reported about $50M a year of these goods sent to Russia in 2022 and 2023, but Sayari holds just two Russian import records from Armenia. Only national statistics show this route." },
      { title: "Two routes through one country", body: "Armenia rose as a gold source for the UAE and as an electronics source for Russia over the same period. Checking whether the same trading companies appear in both is a natural next step." },
    ],
    sources: [] },
  { code: 417, label: "Kyrgyzstan", iso: "KGZ", note: "Kyrgyzstan is in the Eurasian Economic Union with Russia, so goods cross without customs declarations. On 20 July 2023 the U.S. Treasury designated Kyrgyz firms it described as frequent exporters of controlled electronics, including integrated circuits, to Russia.",
    cards: [
      { title: "Few buyers, heavily sanctioned", body: "Only 17 Russian companies appear in Sayari buying chips shipped from Kyrgyzstan, but 12 of them are sanctioned, far above the rate across all routes." },
      { title: "A small economy with a sudden trade", body: "Kyrgyzstan reported almost none of these goods sent to Russia in 2021 and $19M in 2023. For a country with little electronics industry, that jump points to re-export." },
    ],
    sources: [
      { label: "RFE/RL: U.S. sanctions target Kyrgyz firms supplying Russia with weapons technology (Jul 2023)", url: "https://www.rferl.org/a/russia-us-sanctions-kudrin-kyrgyz-weapons-technology/32512031.html" },
    ] },
];

function AnnualChart({ shown, code, hover, onHover, width }: { shown: Year[]; code: number; hover: number | null; onHover: (index: number | null) => void; width: number }) {
  const compact = width < 480, height = compact ? 190 : 230, left = 52, right = compact ? 10 : 150, top = 14, bottom = 26;
  const series = [
    { key: "all", label: "All three CHPL codes", color: SERIES_COLORS.reported, dash: undefined as string | undefined, values: shown.map((year) => total(routeOf(year, code)!.toRussia)) },
    { key: "chips", label: "Integrated circuits", color: SERIES_COLORS.mirror, dash: "6 4", values: shown.map((year) => routeOf(year, code)!.toRussia["8542"] ?? 0) },
  ];
  const peak = Math.max(1e6, ...series[0].values);
  const step = peak > 2e9 ? 1e9 : peak > 800e6 ? 250e6 : peak > 400e6 ? 100e6 : peak > 100e6 ? 50e6 : peak > 40e6 ? 10e6 : 5e6;
  const max = Math.ceil(peak * 1.08 / step) * step;
  const x = (index: number) => left + (index / Math.max(1, shown.length - 1)) * (width - left - right);
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  const slot = (width - left - right) / Math.max(1, shown.length - 1);
  const pointerIndex = (clientX: number, rect: DOMRect) => Math.max(0, Math.min(shown.length - 1, Math.round((((clientX - rect.left) / rect.width) * width - left) / slot)));
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step).filter((_, index, all) => all.length <= 6 || index % 2 === 0);
  const last = shown.length - 1;
  return <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Exports to Russia of CHPL electronics by year, as reported by the hub"
    onPointerMove={(event) => onHover(pointerIndex(event.clientX, event.currentTarget.getBoundingClientRect()))} onPointerLeave={() => onHover(null)}>
    {ticks.map((tick) => <g key={tick}><line className="chart-gridline" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text className="axis-label" x={left - 7} y={y(tick) + 3} textAnchor="end">{tick === 0 ? "$0" : formatUsd(tick)}</text></g>)}
    {shown.map((year, index) => <text key={year.year} className="axis-label" x={x(index)} y={height - 8} textAnchor="middle">{year.year}</text>)}
    {series.map((line) => <path key={line.key} className="trend-line" stroke={line.color} strokeDasharray={line.dash} d={linePath(line.values, x, y)} />)}
    {series.map((line) => line.values.map((value, index) => <circle key={`${line.key}${index}`} cx={x(index)} cy={y(value)} r="4" fill={line.color} stroke="var(--paper)" strokeWidth="2" />))}
    {!compact && labelPositions(series.map((line) => y(line.values[last]))).map((labelY, index) => <text key={series[index].key} className="direct-label" x={width - right + 10} y={labelY + 3}>{series[index].label}</text>)}
    {hover !== null && <g className="crosshair"><line x1={x(hover)} x2={x(hover)} y1={top} y2={height - bottom} /></g>}
    <rect x={left} y={top} width={width - left - right} height={height - top - bottom} fill="transparent" />
  </svg>;
}

function CompareRow({ label, route, all, routeTotal, allTotal, widest }: { label: string; route: number; all: number; routeTotal: number; allTotal: number; widest: number }) {
  const routeShare = route / routeTotal, allShare = all / allTotal;
  return <div className="hub-compare-row" role="listitem">
    <span className="risk-bar-label">{label}</span>
    <span className="hub-compare-bars">
      <span className="risk-bar-track" title={`${formatCount(route)} of ${formatCount(routeTotal)} buyers on this route`}><i style={{ width: `${Math.max(1, (routeShare / widest) * 100)}%`, background: SERIES_COLORS.reported }} /></span>
      <span className="risk-bar-track" title={`${formatCount(all)} of ${formatCount(allTotal)} buyers across all routes`}><i style={{ width: `${Math.max(1, (allShare / widest) * 100)}%`, background: SERIES_COLORS.mirror }} /></span>
    </span>
    <span className="risk-bar-value">{formatShare(route, routeTotal)} <small>vs {formatShare(all, allTotal)}</small></span>
  </div>;
}

const FLAGS: [string, FlagKey][] = [["Sanctioned (any list)", "sanctioned"], ["On the U.S. OFAC SDN list", "ofacSdn"], ["Russian state procurement contractor", "stateProcurement"], ["Export-control listed", "exportControls"]];

export function ElectronicsHub({ code }: { code: number }) {
  const hub = electronicsHubs.find((item) => item.code === code)!;
  const [hover, setHover] = useState<number | null>(null);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const shown = years.filter((year) => routeOf(year, code)?.reported);
  const latest = shown.at(-1)!;
  const baseline = years.find((year) => year.year === BASELINE)!;
  const hovered = hover === null ? null : shown[hover];
  const own = (year: Year) => routeOf(year, code)!;
  const toRussiaLatest = total(own(latest).toRussia);
  const toRussiaBase = routeOf(baseline, code)?.reported ? total(own(baseline).toRussia) : null;
  const routes = latest.routes.map((route) => { const before = routeOf(baseline, route.code); return { ...route, latestTotal: route.reported ? total(route.toRussia) : null, baseTotal: before?.reported ? total(before.toRussia) : null }; })
    .sort((a, b) => (b.latestTotal ?? -1) - (a.latestTotal ?? -1));
  const routeSum = routes.reduce((sum, item) => sum + (item.latestTotal ?? 0), 0);
  const rank = routes.findIndex((item) => item.code === code) + 1;
  const ahead = routes.slice(0, Math.max(0, rank - 1)).map((item) => shortName(item.name));
  const topCode = CODES.reduce((best, key) => (own(latest).toRussia[key] ?? 0) > (own(latest).toRussia[best] ?? 0) ? key : best, CODES[0]);
  const chips = chipSources[String(code)];
  const route = sayariRoutes[String(code)];
  const widest = Math.max(...FLAGS.flatMap(([, key]) => [route.buyerFlags[key] / Math.max(1, route.buyers), russiaAll.buyerFlags[key] / russiaAll.buyers]));
  const departure = russiaAll.departure as [string, number][];
  const listed = departure.some(([iso]) => iso === hub.iso);
  const originTop = route.origin[0];

  const moveHover = (key: string) => {
    if (key === "ArrowRight") setHover((index) => index === null ? 0 : Math.min(shown.length - 1, index + 1));
    if (key === "ArrowLeft") setHover((index) => index === null ? shown.length - 1 : Math.max(0, index - 1));
  };

  return <>
    <div className="section-title-row"><div><p className="eyebrow">HUB WATCH <span>/</span> {hub.label.toUpperCase()} → RUSSIA <span>/</span> CHPL ELECTRONICS</p><h2>Dual-use electronics from {hub.label} to Russia</h2></div><span className="data-chip">UN COMTRADE · SAYARI</span></div>
    <HowToRead><p>Since 2022 the U.S., EU, UK and Japan have restricted exports to Russia of the electronics its weapons rely on, listed by product code in the <b>Common High Priority List (CHPL)</b>. This page follows three of the most important codes: integrated circuits (HS 8542), network equipment (8517.62) and satellite-navigation receivers (8526.91). Russia stopped publishing trade data in 2022, so the figures come from what {hub.label} and other <Term k="transshipment">transit</Term> countries report sending Russia, plus Sayari records of Russian import declarations. {hub.note} Trade in these goods is not illegal in itself, and much of what reaches Russia is Chinese-made.</p></HowToRead>

    <section className="metric-ribbon hub-metrics" aria-label={`${hub.label} to Russia electronics headline figures`}>
      <div className="metric-cell"><span className="metric-label">EXPORTS TO RUSSIA {latest.year}</span><strong>{formatUsd(toRussiaLatest)}</strong><small>{toRussiaBase === null ? `No ${BASELINE} figure` : toRussiaBase < 1e6 ? `From under $1M in ${BASELINE}, the year before sanctions` : `${times(toRussiaLatest, toRussiaBase)} ${BASELINE}, the year before sanctions`}</small></div>
      <div className="metric-cell"><span className="metric-label">RANK AMONG LISTED ROUTES {latest.year}</span><strong>{rank ? ordinal(rank) : "—"}</strong><small>Of {routes.filter((item) => item.reported).length} reporting countries{ahead.length ? `, behind ${ahead.join(", ")}` : ""}</small></div>
      <div className="metric-cell"><span className="metric-label">SANCTIONED RUSSIAN BUYERS</span><strong>{route.buyers >= 5 ? formatShare(route.buyerFlags.sanctioned, route.buyers) : "—"}</strong><small>{route.buyers >= 5 ? `${route.buyerFlags.sanctioned} of ${route.buyers} chip buyers on this route, vs ${formatShare(russiaAll.buyerFlags.sanctioned, russiaAll.buyers)} across all routes${route.buyers < 30 ? " (small sample)" : ""}` : `Too few buyers in Sayari to compare (${route.buyers})`}</small></div>
      <div className="metric-cell"><span className="metric-label">SHARE OF RUSSIA’S CHIP RECORDS</span><strong>{route.records / russiaAll.records < 0.001 ? "<0.1%" : smallShare(route.records, russiaAll.records)}</strong><small>{formatCount(route.records)} Russian import records of chips shipped from {hub.label}</small></div>
    </section>

    <div className="hub-grid">
      <article className="visual-card">
        <div className="visual-card-head"><div><p className="eyebrow">TREND <span>/</span> {shown[0].year}–{latest.year}</p><h2>{hub.label}-reported exports to Russia</h2></div><span className="data-chip">UN COMTRADE</span></div>
        <div className="product-charts" ref={chartRef} tabIndex={0} aria-label="Annual chart. Use left and right arrow keys to step through years." onKeyDown={(event) => moveHover(event.key)} onBlur={() => setHover(null)}>
          <span className="series-legend"><span><i className="legend-line" style={{ background: SERIES_COLORS.reported }} />All three CHPL codes</span><span><i className="legend-line dashed" style={{ borderColor: SERIES_COLORS.mirror }} />Integrated circuits only</span></span>
          <div className="chart-shell">
            <AnnualChart shown={shown} code={code} hover={hover} onHover={setHover} width={chartWidth} />
            {hovered && <div className="chart-tooltip" style={{ left: `${Math.min(76, Math.max(14, (hover! / Math.max(1, shown.length - 1)) * 78 + 5))}%` }} role="status">
              <b>{hovered.year}</b>
              {CODES.map((key) => <span key={key}>{codeNames[key]} <em>{formatUsd(own(hovered).toRussia[key] ?? 0)}</em></span>)}
              <span><i style={{ background: SERIES_COLORS.reported }} />Total <em>{formatUsd(total(own(hovered).toRussia))}</em></span>
            </div>}
          </div>
        </div>
        <p className="visual-footnote">Values {hub.label} reports to UN Comtrade as exports to Russia, through {latest.year}. Re-exports through free zones or bonded warehouses may be recorded differently or not at all, so these figures are a floor.</p>
        <details className="data-table-toggle"><summary>View data as a table</summary><div className="table-scroll"><table><thead><tr><th>Year</th>{CODES.map((key) => <th key={key}>{codeNames[key]} ({key})</th>)}<th>Total to Russia</th><th>To the world</th></tr></thead><tbody>{shown.map((year) => <tr key={year.year}><td>{year.year}</td>{CODES.map((key) => <td key={key}>{formatUsd(own(year).toRussia[key] ?? 0)}</td>)}<td>{formatUsd(total(own(year).toRussia))}</td><td>{formatUsd(total(own(year).toWorld))}</td></tr>)}</tbody></table></div></details>
      </article>

      <article className="visual-card">
        <div className="visual-card-head"><div><p className="eyebrow">WHO MADE THEM <span>/</span> SAYARI</p><h2>Declared origin of {hub.label}-routed chips</h2></div></div>
        {route.records >= 20 ? <CountBars rows={route.origin} total={route.records} /> : <p className="intel-empty">Only {route.records} Russian import record{route.records === 1 ? "" : "s"} from {hub.label}, too few to show a pattern.</p>}
        <p className="visual-footnote">Origin declared on {formatCount(route.records)} Russian import records of integrated circuits shipped from {hub.label}, {formatDate(route.earliest)} – {formatDate(route.latest)}. Chips made in Malaysia, Taiwan, Thailand or the Philippines are often packaged or tested there for U.S. and European chip companies.</p>
      </article>
    </div>

    <article className="visual-card analysis-card">
      <div className="visual-card-head"><div><p className="eyebrow">ROUTES <span>/</span> {BASELINE} VS {latest.year}</p><h2>Which countries report sending these goods to Russia</h2></div></div>
      <p className="analysis-legend">Each row is what that country itself reports exporting to Russia across the three codes. A large jump after {BASELINE} in a country that makes few of these goods suggests re-export.</p>
      <div className="table-scroll analysis-table"><table>
        <thead><tr><th>Country</th><th>{BASELINE}</th><th>{latest.year}</th><th>Change</th><th>Share of listed routes {latest.year}</th></tr></thead>
        <tbody>{routes.map((item) => <tr key={item.code} className={item.code === code ? "hub-highlight" : ""}>
          <td><b>{shortName(item.name)}</b></td>
          <td className="num">{item.baseTotal === null ? <small>Not reported</small> : formatUsd(item.baseTotal)}</td>
          <td className="num">{item.latestTotal === null ? <small>Not reported</small> : formatUsd(item.latestTotal)}</td>
          <td className="num">{item.latestTotal === null || item.baseTotal === null ? "—" : item.baseTotal < 1e6 ? (item.latestTotal >= 1e6 ? <small>From under $1M</small> : "—") : times(item.latestTotal, item.baseTotal)}</td>
          <td className="num">{item.latestTotal === null ? "—" : smallShare(item.latestTotal, routeSum)}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="visual-footnote">Countries chosen as the main suppliers and transit routes named in public sanctions analyses. China and Hong Kong mostly ship their own or regional production, so a large total there is not by itself re-export. In {latest.year}, {hub.label}’s largest of the three codes was {codeNames[topCode].toLowerCase()} ({topCode}).</p>
    </article>

    {chips && chips.sources.reduce((sum, source) => sum + source.value, 0) < 5e6 && <p className="intel-empty">{hub.label} recorded under $5M of chip imports from its top suppliers in {chips.year}, too little for a mirror check.</p>}
    {chips && chips.sources.reduce((sum, source) => sum + source.value, 0) >= 5e6 && <article className="visual-card analysis-card">
      <div className="visual-card-head"><div><p className="eyebrow">MIRROR CHECK <span>/</span> {chips.year} <span>/</span> INTEGRATED CIRCUITS</p><h2>Where {hub.label}’s chips come from</h2></div></div>
      <div className="table-scroll analysis-table"><table>
        <thead><tr><th>Supplier country</th><th>{hub.label} recorded imports</th><th>Supplier-reported exports to {hub.label}</th><th>Gap</th></tr></thead>
        <tbody>{chips.sources.map((source) => { const gap = source.partnerReported ? Math.round(((source.value - source.partnerReported) / source.partnerReported) * 1000) / 10 : null; const almostNone = source.partnerReported !== null && source.partnerReported < source.value * 0.1;
          return <tr key={source.code}><td><b>{shortName(source.name)}</b></td><td className="num">{formatUsd(source.value)}</td><td className="num">{source.partnerReported === null ? <small>Not reported</small> : formatUsd(source.partnerReported)}</td><td className={`num ${almostNone || (gap !== null && Math.abs(gap) > 25) ? "over" : ""}`}>{almostNone ? <small>Supplier reports almost none</small> : formatGap(gap)}</td></tr>; })}</tbody>
      </table></div>
      <p className="visual-footnote">Gap = recorded imports ÷ supplier-reported exports − 1; beyond ±25% is highlighted; “almost none” means the supplier reports under a tenth. Chips are often recorded under the country where they were packaged, and Taiwan does not report to UN Comtrade (it appears as “Other Asia, nes”), so gaps here are common and mostly attribution effects.</p>
    </article>}

    <article className="visual-card analysis-card">
      <div className="visual-card-head"><div><p className="eyebrow">SAYARI <span>/</span> RUSSIAN IMPORT RECORDS <span>/</span> SNAPSHOT {formatDate(sayari.generatedAt)}</p><h2>Who buys chips routed through {hub.label}</h2></div><span className="data-chip">AGGREGATES · NO COMPANY NAMED</span></div>
      {route.buyers >= 5 ? <>
        <p className="analysis-legend"><span className="hub-key"><i style={{ background: SERIES_COLORS.reported }} />Russian buyers of chips shipped from {hub.label} ({formatCount(route.buyers)})</span><span className="hub-key"><i style={{ background: SERIES_COLORS.mirror }} />All Russian chip buyers in Sayari ({formatCount(russiaAll.buyers)})</span></p>
        <div className="risk-bars" role="list">{FLAGS.map(([label, key]) => <CompareRow key={key} label={label} route={route.buyerFlags[key]} all={russiaAll.buyerFlags[key]} routeTotal={route.buyers} allTotal={russiaAll.buyers} widest={widest} />)}</div>
      </> : <p className="intel-empty">Sayari shows {route.buyers} Russian buyer{route.buyers === 1 ? "" : "s"} on this route, too few to compare. Trade within the Eurasian customs union mostly carries no import declaration.</p>}
      {route.suppliers >= 5 && <><h3 className="hub-subhead">Supplier warning signs</h3>
        <div className="risk-bars" role="list">{([["Sanctioned (any list)", "sanctioned"], ["On the U.S. OFAC SDN list", "ofacSdn"], ["On the U.S. Entity List", "entityList"], ["Address shared by many companies", "massAddress"], ["Address on the U.S. high-diversion-risk list", "diversionAddress"]] as const).map(([label, key]) => { const count = route.supplierWarnings[key];
          return <div className="risk-bar-row" role="listitem" key={key}><span className="risk-bar-label">{label}</span><span className="risk-bar-track">{count !== null && <i style={{ width: `${Math.min(100, Math.max(1, (count / route.suppliers) * 100 * 4))}%` }} />}</span><span className="risk-bar-value">{count === null ? <small>Not in top flags</small> : <>{formatCount(count)} <small>({smallShare(count, route.suppliers)})</small></>}</span></div>; })}</div>
        <p className="analysis-legend">Counts are of the {formatCount(route.suppliers)} supplier companies on this route; bars are drawn at four times scale so small shares stay visible. “Not in top flags” means the flag was not among the 30 most common Sayari returned for this route, so it is rare but uncounted.</p></>}
      <div className="hub-sayari">
        <div><h3>Chip shipments arriving in Russia, by departure country</h3><CountBars rows={listed ? departure : [...departure, [hub.iso, route.records]]} total={russiaAll.records} /><small className="hub-sub">{formatCount(russiaAll.records)} records across all years Sayari holds{listed ? "" : `; ${countryNames[hub.iso] ?? hub.label} added as the last row`}</small></div>
        <div className="intel-stats hub-company hub-stack">
          <div><span className="metric-label">ROUTE RECORDS</span><strong>{formatCount(route.records)}</strong><small>{formatDate(route.earliest)} – {formatDate(route.latest)}, from Russian import declarations</small></div>
          <div><span className="metric-label">SUPPLIERS · BUYERS</span><strong>{formatCount(route.suppliers)} · {formatCount(route.buyers)}</strong><small>{route.supplierFlags.chplCritical} supplier{route.supplierFlags.chplCritical === 1 ? "" : "s"} flagged for shipping CHPL critical components; {route.supplierFlags.sanctioned} are themselves sanctioned</small></div>
        </div>
      </div>
      <p className="visual-footnote">Flag counts are distinct companies, not shipments. Sanctions flags reflect current listings, which include designations made after the trade took place. “State procurement contractor” means the company appears in Russian government procurement records. Russia-wide figures cover every year Sayari holds, while most routes appear only from 2021 or 2022, so the comparison is indicative.</p>
    </article>

    <div className="observation-grid">
      {originTop && route.records >= 20 && <article className="provider-card"><h3>Mostly Asian-made</h3><p>The most common declared origin of chips shipped from {hub.label} to Russia is {countryNames[originTop[0]] ?? originTop[0]} ({formatShare(originTop[1], route.records)} of records). Western-designed parts usually appear under the country where they were packaged, so origin alone does not show whose technology it is.</p></article>}
      {(() => { const a = shown.find((year) => year.year === 2023), b = shown.find((year) => year.year === 2024);
        if (!a || !b) return null; const before = total(own(a).toRussia), after = total(own(b).toRussia);
        return before > 1e6 && after < before * 0.7 ? <article className="provider-card"><h3>Down in 2024</h3><p>{hub.label}’s reported exports of these goods to Russia fell from {formatUsd(before)} in 2023 to {formatUsd(after)} in 2024. In December 2023 the U.S. authorized sanctions on foreign banks that facilitate trade with Russia’s military industry, and several routes fell at the same time. A fall in reported trade can also mean it moved off the books.</p></article> : null; })()}
      {hub.cards.map((card) => <article key={card.title} className="provider-card"><h3>{card.title}</h3><p>{card.body}</p></article>)}
    </div>

    <div className="coverage-note hub-disclosure"><Globe2 size={19} /><div><b>About this data</b>
      <p><b>Trade values:</b> UN Comtrade annual statistics for HS 8542, 8517.62 and 8526.91 as reported by each route and supplier country, pulled {formatDate(hubElectronics.generatedAt.slice(0, 10))} from the public preview API, under Comtrade’s terms of use. Russia does not report. <b>Company data:</b> Sayari Graph aggregates pulled {formatDate(sayari.generatedAt)} through the Sayari connector, licensed for this workspace; only counts are shown and no company is named. <b>Product codes:</b> chosen from Tiers 1 and 2 of the Common High Priority List published by the U.S. Bureau of Industry and Security with the EU, UK and Japan.</p>
      <p><b>Checked against:</b> {[...hub.sources, { label: "Morrison Foerster: U.S. authorizes secondary sanctions on banks supporting Russia’s military-industrial base (EO 14114, Dec 2023)", url: "https://www.mofo.com/resources/insights/240103-us-authorizes-secondary-sanctions-on-banks" }].map((source, index) => <span key={source.url}>{index > 0 && "; "}<a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></span>)}.</p>
      <p><b>What this cannot show:</b> whether any shipment broke a law. {hub.label} has not adopted U.S. or EU sanctions, CHPL items have civilian uses, and a license or exemption may apply. Records cannot show the end user. Nothing here is an allegation about any country or company.</p></div></div>
    <p className="data-provenance"><Database size={12} /> Refresh trade values with <code>npm run data:hub-electronics</code>. <ShieldAlert size={12} /> Sayari figures are a dated snapshot. <Search size={12} /> Notes are leads to check.</p>
  </>;
}
