import { useState } from "react";
import { Database, Globe2, Search, ShieldAlert } from "lucide-react";
import hubGold from "./data/hub-gold.json";
import sayariGold from "./data/sayari-hub-gold.json";
import lbma from "./data/lbma-good-delivery.json";
import { HowToRead, Term } from "./Glossary";
import { SERIES_COLORS, linePath, useElementWidth } from "./ProductWatch";
import { formatCount, formatDate, formatGap, formatShare } from "./data";
import { CountBars, formatUsd, labelPositions, times } from "./HubShared";
import { ElectronicsHub, electronicsHubs } from "./HubElectronics";

type Source = { code: number; name: string; value: number; partnerReported: number | null };
type Year = { year: number; imports: number; exports: number; sources: Source[]; destinations: { code: number; name: string; value: number }[] };
type SayariGold = { inbound: { records: number; earliest: string; latest: string; suppliers: number; departure: [string, number][]; supplierRisk: [string, number][] }; outbound: { records: number; earliest: string; latest: string; arrival: [string, number][]; declaredOrigin: [string, number][] }; buyers?: { total: number; sampled: number; sampledRecords: number; freeZoneEntries: number; freeZoneFirms: number; freeZoneRecords: number; mainlandProfile: string; freeZoneProfile: string; flagged: string }; exporters?: { total: number; caveat: string }; buyerMix?: { sampled: number; sampledRecords: number; groups: { label: string; firms: number; records: number }[]; flags: string } };
// The newest year is reported by only some countries, and partly; see the fetch script.
const goldYears = (code: number) => ((hubGold.hubs as unknown as Record<string, { years: Year[] }>)[String(code)]?.years ?? []).filter((year) => year.year <= new Date().getUTCFullYear() - 2);
const sayariGoldHub = (code: number) => (sayariGold.hubs as unknown as Record<string, SayariGold>)[String(code)];

// Approximate LBMA PM annual average gold prices (USD/oz), used only to separate price from volume.
const GOLD_PRICE: Record<number, number> = { 2018: 1268, 2019: 1393, 2020: 1770, 2021: 1799, 2022: 1800, 2023: 1941, 2024: 2386 };
const atPriceOf = (base: number) => (year: Year) => GOLD_PRICE[year.year] && GOLD_PRICE[base] ? year.imports * (GOLD_PRICE[base] / GOLD_PRICE[year.year]) : null;
const PRICE_COLOR = "#8a7d6e";

const riskNames: Record<string, string> = { forced_labor: "Forced or child labor exposure", regulatory_action: "Regulatory action", sanctions_and_export_control_lists: "Sanctions or export-control list links", export_controls: "Export controls", shell_company_risk: "Shell-company indicators", sanctions: "Sanctions", political_exposure: "Political exposure", environmental_risk: "Environmental risk", adverse_media: "Adverse media" };

// LBMA and Comtrade spell some countries differently; both sides are reduced to one key.
const countryAliases: Record<string, string> = { "türkiye": "turkey", "russian federation": "russia", "china, hong kong sar": "hong kong", "hong kong (special administrative region of china)": "hong kong", "usa": "united states", "united states of america": "united states", "united rep. of tanzania": "tanzania", "kyrgyz republic": "kyrgyzstan", "rep. of korea": "korea, republic of", "the netherlands": "netherlands", "uae": "united arab emirates" };
const countryKey = (name: string | null) => { const key = (name ?? "").toLowerCase().trim(); return countryAliases[key] ?? key; };
type Refiner = { country: string | null; transfersToFormer: string[]; reasonForTransfer: string | null };
const lbmaCurrent = lbma.current as Refiner[], lbmaFormer = lbma.former as Refiner[];
const lbmaCount = (name: string) => lbmaCurrent.filter((refiner) => countryKey(refiner.country) === countryKey(name)).length;
const lbmaFormerCount = (name: string) => lbmaFormer.filter((refiner) => countryKey(refiner.country) === countryKey(name)).length;
const lbmaRemovedSince = (name: string, year: string) => lbmaFormer.filter((refiner) => countryKey(refiner.country) === countryKey(name) && (refiner.transfersToFormer[0] ?? "") >= year).length;
const lbmaCountries = Object.entries(lbmaCurrent.reduce<Record<string, number>>((counts, refiner) => { const key = countryKey(refiner.country); counts[key] = (counts[key] ?? 0) + 1; return counts; }, {})).sort((a, b) => b[1] - a[1]);
const titleCase = (key: string) => key.replace(/\b\w/g, (letter) => letter.toUpperCase());
const russiaRemoved2022 = lbmaFormer.filter((refiner) => countryKey(refiner.country) === "russia" && refiner.transfersToFormer[0]?.startsWith("2022")).length;
const sourcingRemovals = lbmaFormer.filter((refiner) => /Responsible Sourcing/i.test(refiner.reasonForTransfer ?? ""));

type Reading = "agree" | "less" | "more" | "none" | "unreported";
const readingLabel: Record<Reading, string> = { agree: "Records agree", less: "Source records less", more: "Source records more", none: "Source records almost none", unreported: "Source files no figure" };
function reading(source: Source): Reading {
  if (source.partnerReported === null) return "unreported";
  if (source.partnerReported < source.value * 0.1) return "none";
  const gap = ((source.value - source.partnerReported) / source.partnerReported) * 100;
  return Math.abs(gap) <= 25 ? "agree" : gap > 0 ? "less" : "more";
}
const gapOf = (source: Source) => source.partnerReported ? Math.round(((source.value - source.partnerReported) / source.partnerReported) * 1000) / 10 : null;

// Per-hub framing and notes on recurring source corridors. Written 2026-10-19; leads to check, not findings.
type GoldHubConfig = { code: number; label: string; iso: string; lbmaName: string; title: string; intro: string; refinerNote: string; notes: Record<number, string>; cards: { title: string; body: string }[]; sources: { label: string; url: string }[] };
export const goldHubs: GoldHubConfig[] = [
  { code: 784, label: "UAE", iso: "ARE", lbmaName: "United Arab Emirates", title: "How gold moves through the UAE’s free zones",
    intro: "The UAE is one of the world’s largest gold hubs: gold arrives from mines and refineries, much of it is traded by companies licensed in Dubai’s free zones, and most of it leaves again.",
    refinerNote: "UAE refiners are accredited instead under the UAE’s own UAE Good Delivery (UAEGD) standard, run by the Ministry of Economy.",
    notes: {
      466: "Mali’s recorded gold exports go mainly to refining centres such as Switzerland. Gold reaching the UAE from Mali with no export record is consistent with undeclared small-scale output, which NGO investigations have reported (not verified here).",
      562: "Like Mali, Niger reports a small fraction of what the UAE records receiving.",
      768: "Togo mines little gold of its own, so gold recorded as coming from Togo most likely originated in neighbouring countries.",
      894: "Zambia reports almost no gold exports to the UAE.",
      324: "Guinea files no gold export figure to the UAE in Comtrade, so this corridor can’t be mirrored.",
      643: "Russia stopped publishing trade statistics in 2022, the year the UK, U.S. and other G7 countries banned imports of Russian gold.",
      51: "Armenia mines modest amounts of gold. Its rise as a source in 2023, as gold recorded from Russia fell, fits a re-routing pattern worth checking.",
      757: "A control corridor: both sides report nearly the same value.",
      792: "Türkiye records far less than the UAE does. Check whether one side records the same gold as jewellery (HS 7113) or scrap (7112).",
      826: "The UK records more than the UAE does. Check whether one side counts London vault transfers as monetary gold, which falls outside this comparison.",
    },
    cards: [
      { title: "Russia out, Armenia in", body: "The UAE recorded $5.4B of gold from Russia in 2022, the year G7 countries banned Russian gold, then $2.5B in 2023, when Armenia appeared as a $2.6B source. Armenia reports sending half that. Check Armenia’s own gold imports from Russia and the refinery origin documents." },
      { title: "A persistent West African gap", body: "From 2019 to 2023 the UAE recorded about $24B of gold from Mali, while Mali reported under $0.1B in exports to the UAE. Niger, Togo and Zambia show the same pattern; Guinea files no figure at all. This is the pattern NGO investigations link to undeclared artisanal gold." },
      { title: "Switzerland as a control", body: "Gold between Swiss refiners and the UAE matches within a few percent (2022: $2.7B vs $2.75B; 2023: $7.0B vs $7.2B). A well-documented corridor looks like this, which makes the large gaps elsewhere stand out." },
      { title: "Free zone and souk", body: "Two kinds of company buy most of the gold: DMCC-licensed bullion traders, including subsidiaries of international brokers, and mainland gold-trading and jewellery firms in Dubai’s gold souk. Free-zone status alone is not a risk signal; who owns the firm and what it trades are." },
      { title: "Origin gets reset", body: "Over 40% of Sayari’s outbound UAE gold records declare the UAE as origin. India, the largest destination by records, sees “UAE gold,” not the mine. Checking origin means tracing back through UAE refiners." },
      { title: "Shipment data misses the biggest gaps", body: "The countries behind the largest gaps don’t publish shipment-level customs records, and gold usually travels by air or hand-carry. Sayari is strongest on routes like Peru, Uganda and Tanzania, so pair it with mirror statistics rather than relying on either alone." },
    ],
    sources: [
      { label: "DGCX: UAE Good Delivery standard for gold settlement (2023)", url: "https://dgcx.ae/news/2023/dccc-aligns-uae-good-delivery-standard-gold-and-silver-settlement" },
      { label: "LBMA gold Good Delivery current list", url: "https://www.lbma.org.uk/good-delivery/gold-current-list" },
    ] },
  { code: 757, label: "Switzerland", iso: "CHE", lbmaName: "Switzerland", title: "Switzerland: where much of the world’s gold is refined",
    intro: "Switzerland refines a large share of the world’s mined gold. Doré from mines arrives, mostly by air, is refined in a handful of large refineries, and leaves as bars for London, Asia and the Gulf.",
    refinerNote: "Switzerland hosts several of the largest LBMA-accredited refineries.",
    notes: {
      826: "The UK reports sending far more gold to Switzerland than Switzerland records. London vault bars sent for re-refining into smaller bars may be counted differently on each side; this gap is long-standing and mostly an accounting mismatch.",
      784: "The UAE has not reported its 2024 figures, so this year can’t be mirrored. In 2022 the two sides matched closely.",
      860: "Uzbekistan’s gold is largely sold by its central bank, and it files no export figure here. Central-bank sales can fall outside non-monetary gold statistics.",
      398: "Kazakhstan’s gold is largely sold through its central bank, and it files no export figure here.",
      710: "South Africa files no partner breakdown for gold exports.",
      643: "Russia stopped publishing trade statistics in 2022. Switzerland adopted the EU ban on Russian gold imports in August 2022; check the monthly timing of 2022 imports.",
      124: "Canada reports less than Switzerland records. Check for gold routed through a third country or recorded under another code.",
      36: "Australia reports less than Switzerland records. Check for gold routed through a third country or recorded under another code.",
      608: "The Philippines reports far less than Switzerland records. Check whether central-bank sales are recorded outside non-monetary gold.",
      288: "Ghana’s large industrial mines export mainly to Swiss refiners, and both sides match.",
      854: "Burkina Faso’s industrial mines export mainly to Swiss refiners, and both sides match.",
    },
    cards: [
      { title: "A refinery in the middle", body: "Switzerland imported $105B of gold in 2024 and exported $115B. Mine output arrives as unrefined doré and leaves as bars, mostly to China, India, the U.S. and the UK, so what goes in roughly equals what comes out." },
      { title: "Industrial mines match", body: "Gold from large industrial mines in Ghana, Burkina Faso, Peru and Côte d’Ivoire matches within a few percent on both sides. Documented mine-to-refinery trade looks like this." },
      { title: "State gold does not mirror", body: "Uzbekistan, Kazakhstan and South Africa file no figures for their gold exports to Switzerland. Much of their gold is sold by central banks or state companies, which national statistics can leave out." },
      { title: "London–Zurich accounting gap", body: "The UK reported $22.7B of gold sent to Switzerland in 2024 while Switzerland recorded $4.0B from the UK. Gold moving between vaults and refiners is counted inconsistently, so this gap says more about statistics than smuggling." },
      { title: "Russian gold in 2022", body: "Switzerland recorded $3.7B of gold from Russia in 2022. Its own ban, adopted on 3 August 2022, covers only gold exported from Russia after 4 August, so imports earlier in the year were legal. Monthly figures would show the timing." },
    ],
    sources: [
      { label: "SECO: Switzerland adopts new sanctions, including the Russian gold ban (3 Aug 2022)", url: "https://www.seco.admin.ch/seco/en/home/seco/nsb-news.msg-id-89874.html" },
      { label: "European Sanctions: Switzerland adopts EU’s Russian gold ban", url: "https://www.europeansanctions.com/2022/08/switzerland-adopts-eus-russian-gold-ban/" },
    ] },
  { code: 792, label: "Türkiye", iso: "TUR", lbmaName: "Turkey", title: "Türkiye: a gold market between Europe, Russia and the Gulf",
    intro: "Türkiye has heavy domestic demand for gold, a large jewellery industry and a refining sector, and sits between European, Russian, Middle Eastern and Gulf trade routes.",
    refinerNote: "One Turkish refiner was removed in 2016 for failing responsible-sourcing requirements.",
    notes: {
      784: "The UAE is Türkiye’s second source of gold. The UAE has not reported 2024; in 2022 the UAE reported sending more than Türkiye recorded.",
      757: "Swiss refiners are Türkiye’s largest source, and the two sides are reasonably close.",
      68: "Bolivia reports almost no gold exports to Türkiye. Bolivia’s central bank has reportedly sold part of its gold reserves; central-bank sales can fall outside non-monetary gold statistics.",
      368: "Iraq files no gold export figure here.",
      643: "Russia stopped publishing trade statistics in 2022.",
    },
    cards: [
      { title: "Demand-driven and volatile", body: "Türkiye’s gold imports swing with domestic demand and the lira: $25B in 2020, $5.5B in 2021, $30B in 2023 and $17B in 2024. Exports stay at $1–4B, so most of the gold stays in the country." },
      { title: "Imports fell, jewellery rose", body: "A monthly quota on unprocessed gold imports took effect on 7 August 2023, and 2024 gold imports were about 43% below 2023. Türkiye’s central bank reports that jewellery imports, outside the quota, almost quadrupled over the same period: the gold may have moved to another product code." },
      { title: "Bolivia’s sudden role", body: "In 2024 Türkiye recorded $1.3B of gold from Bolivia, which reports almost none. Bolivia’s central bank sold about $1B of gold reserves in 2023 under a new law. If this is central-bank gold, the gap is a statistical one; if not, it needs explaining." },
      { title: "The UAE link", body: "The UAE is a steady second source, and Türkiye is the UAE’s largest destination. Gold moves both ways between the two, which makes origin harder to trace." },
    ],
    sources: [
      { label: "Central Bank of Türkiye: gold import quota and consumption demand indicators", url: "https://www.tcmb.gov.tr/wps/wcm/connect/blog/en/main+menu/analyses/gold+import+quota+and+consumption+demand+indicators" },
      { label: "Global Trade Alert: Türkiye import quota on gold bullion (Aug 2023)", url: "https://globaltradealert.org/state-act/76980-turkiye-introduction-of-an-import-quota-on-gold-bullion" },
      { label: "Debtwire: Bolivia sells more gold reserves than expected (2023)", url: "https://ionanalytics.com/insights/debtwire/bolivia-sells-more-gold-reserves-than-expected-raising-financial-sustainability-concerns/" },
    ] },
  { code: 344, label: "Hong Kong", iso: "HKG", lbmaName: "Hong Kong", title: "Hong Kong: the gateway for gold into China",
    intro: "Hong Kong is the main channel for gold entering mainland China, which strictly controls gold imports, and a trading centre for Southeast Asian jewellery markets.",
    refinerNote: "Hong Kong’s listed refiners serve the Chinese and Southeast Asian markets.",
    notes: {
      643: "Russia stopped publishing trade statistics in 2022. Hong Kong has not adopted Western sanctions, and its recorded gold imports from Russia rose sharply after 2022.",
      51: "Armenia rose as a gold source for Hong Kong as well as the UAE. Armenia reports sending less than Hong Kong records.",
      784: "The UAE has not reported its 2024 figures. In 2022 the two sides matched closely.",
      826: "The UK reports sending more than Hong Kong records in some years. London vault flows are counted inconsistently.",
      156: "Gold moves both ways between Hong Kong and mainland China; China’s gold imports are tightly controlled.",
    },
    cards: [
      { title: "The gateway to China", body: "Hong Kong sent $34B of gold to mainland China in 2024, about 60% of its gold exports. China controls gold imports tightly, so Hong Kong is its main channel." },
      { title: "Russian gold rises", body: "Hong Kong recorded $4.6B of gold from Russia in 2024, up from $0.6B in 2022. Russia does not report, so there is no mirror, and Hong Kong has not adopted Western sanctions." },
      { title: "Armenia appears again", body: "Hong Kong recorded $1.7B from Armenia in 2024, which reports $1.1B. Armenia’s rise as a gold source for both Hong Kong and the UAE is a pattern worth tracing." },
      { title: "Imports more than quadrupled", body: "Hong Kong’s gold imports rose from $14B in 2019 to $65B in 2024, much faster than the gold price." },
      { title: "A sanctioned buyer at the top", body: "One of Hong Kong’s 25 largest gold buyers in Sayari is on the U.S. OFAC sanctions list, and another is flagged for buying from a sanctioned supplier while sharing an address with a third. Several large buyers are generic trading or holding companies with no visible gold business." },
    ],
    sources: [
      { label: "LBMA gold Good Delivery former list (Russian refiners removed March 2022)", url: "https://www.lbma.org.uk/good-delivery/gold-former-list" },
    ] },
];

function AnnualChart({ years, label, hover, onHover, width }: { years: Year[]; label: string; hover: number | null; onHover: (index: number | null) => void; width: number }) {
  const first = years[0], latest = years.at(-1)!;
  const compact = width < 480, height = compact ? 190 : 230, left = 48, right = compact ? 10 : 132, top = 14, bottom = 26;
  const adjusted = years.map(atPriceOf(first.year));
  const peak = Math.max(...years.flatMap((year) => [year.imports, year.exports]));
  const stepSize = peak > 100e9 ? 50e9 : peak > 40e9 ? 20e9 : peak > 20e9 ? 10e9 : 5e9;
  const max = Math.ceil(peak * 1.05 / stepSize) * stepSize;
  const x = (index: number) => left + (index / (years.length - 1)) * (width - left - right);
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  const step = (width - left - right) / (years.length - 1);
  const pointerIndex = (clientX: number, rect: DOMRect) => Math.max(0, Math.min(years.length - 1, Math.round((((clientX - rect.left) / rect.width) * width - left) / step)));
  const last = years.length - 1;
  const series = [
    { key: "imports", label: `${label} imports`, color: SERIES_COLORS.reported, dash: undefined as string | undefined, values: years.map((year) => year.imports as number | null) },
    { key: "exports", label: `${label} exports`, color: SERIES_COLORS.mirror, dash: "6 4", values: years.map((year) => year.exports as number | null) },
    { key: "adjusted", label: `Imports at ${first.year} prices`, color: PRICE_COLOR, dash: "2 4", values: adjusted },
  ];
  return <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}-reported gold imports and exports by year, ${first.year} to ${latest.year}, with imports re-priced at ${first.year} gold prices`}
    onPointerMove={(event) => onHover(pointerIndex(event.clientX, event.currentTarget.getBoundingClientRect()))} onPointerLeave={() => onHover(null)}>
    {Array.from({ length: Math.round(max / stepSize) + 1 }, (_, index) => index * stepSize).map((tick) => <g key={tick}><line className="chart-gridline" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text className="axis-label" x={left - 7} y={y(tick) + 3} textAnchor="end">${tick / 1e9}B</text></g>)}
    {years.map((year, index) => <text key={year.year} className="axis-label" x={x(index)} y={height - 8} textAnchor="middle">{year.year}</text>)}
    {series.map((line) => <path key={line.key} className="trend-line" stroke={line.color} strokeDasharray={line.dash} d={linePath(line.values, x, y)} />)}
    {series.map((line) => line.values.map((value, index) => value !== null && <circle key={`${line.key}${index}`} cx={x(index)} cy={y(value)} r="4" fill={line.color} stroke="var(--paper)" strokeWidth="2" />))}
    {!compact && labelPositions(series.map((line) => y(line.values[last] ?? 0))).map((labelY, index) => series[index].values[last] !== null && <text key={series[index].key} className="direct-label" x={width - right + 10} y={labelY + 3}>{series[index].label}</text>)}
    {hover !== null && <g className="crosshair"><line x1={x(hover)} x2={x(hover)} y1={top} y2={height - bottom} /></g>}
    <rect x={left} y={top} width={width - left - right} height={height - top - bottom} fill="transparent" />
  </svg>;
}

export function GoldHub({ code }: { code: number }) {
  const hub = goldHubs.find((item) => item.code === code)!;
  const years = goldYears(code);
  const first = years[0], latest = years.at(-1)!;
  const atFirstYearPrice = atPriceOf(first.year);
  const [yearIndex, setYearIndex] = useState(years.length - 1);
  const [hover, setHover] = useState<number | null>(null);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const selected = years[Math.min(yearIndex, years.length - 1)];
  const hovered = hover === null ? null : years[hover];
  const unmatchedOf = (year: Year) => year.sources.reduce((sum, source) => sum + Math.max(0, source.value - (source.partnerReported ?? 0)), 0);
  const totalOf = (year: Year) => year.sources.reduce((sum, source) => sum + source.value, 0);
  const adjustedLatest = atFirstYearPrice(latest);
  const { inbound, outbound, buyers, exporters, buyerMix } = sayariGoldHub(code);
  const ownOrigin = outbound.declaredOrigin.find(([iso]) => iso === hub.iso)?.[1] ?? 0;
  const noRefiner = latest.sources.filter((source) => !lbmaCount(source.name)).length;

  const moveHover = (key: string) => {
    if (key === "ArrowRight") setHover((index) => index === null ? 0 : Math.min(years.length - 1, index + 1));
    if (key === "ArrowLeft") setHover((index) => index === null ? years.length - 1 : Math.max(0, index - 1));
  };

  return <>
    <div className="section-title-row"><div><p className="eyebrow">HUB WATCH <span>/</span> {hub.label.toUpperCase()} <span>/</span> GOLD (HS 7108)</p><h2>{hub.title}</h2></div><span className="data-chip">UN COMTRADE · SAYARI · LBMA</span></div>
    <HowToRead><p>{hub.intro} This page compares what {hub.label} records importing with what each source country records exporting to {hub.label} (<Term k="mirror statistics">mirror statistics</Term>), then adds Sayari shipment records for the routes and the kinds of companies involved. A gap is a question to check, not evidence of smuggling: gold carried by hand, gold recorded under another country as destination, and reporting gaps all produce one.</p></HowToRead>

    <section className="metric-ribbon hub-metrics" aria-label={`${hub.label} gold headline figures`}>
      <div className="metric-cell"><span className="metric-label">GOLD IMPORTS {latest.year}</span><strong>{formatUsd(latest.imports)}</strong><small>{times(latest.imports, first.imports)} {first.year}, as {hub.label} reports</small></div>
      <div className="metric-cell"><span className="metric-label">AT {first.year} GOLD PRICES</span><strong>{formatUsd(adjustedLatest)}</strong><small>{adjustedLatest ? `${times(adjustedLatest, first.imports)} ${first.year}${adjustedLatest > first.imports * 1.15 ? ": more gold, not just higher prices" : adjustedLatest < first.imports * 0.85 ? ": less gold than the dollar value suggests" : ": about the same amount of gold"}` : "Price not available"}</small></div>
      <div className="metric-cell"><span className="metric-label">GOLD EXPORTS {latest.year}</span><strong>{formatUsd(latest.exports)}</strong><small>{latest.exports > latest.imports * 0.6 ? "Much of the imported gold leaves again" : "Much of the gold stays for domestic use or storage"}</small></div>
      <div className="metric-cell"><span className="metric-label">NO MATCHING EXPORT RECORD</span><strong>{formatShare(unmatchedOf(latest), totalOf(latest))}</strong><small>Of {latest.year} imports from the top {latest.sources.length} sources, the share their own export records don’t account for</small></div>
    </section>

    <div className="hub-grid">
      <article className="visual-card">
        <div className="visual-card-head"><div><p className="eyebrow">TREND <span>/</span> {first.year}–{latest.year}</p><h2>{hub.label} gold trade by year</h2></div><span className="data-chip">UN COMTRADE</span></div>
        <div className="product-charts" ref={chartRef} tabIndex={0} aria-label="Annual chart. Use left and right arrow keys to step through years." onKeyDown={(event) => moveHover(event.key)} onBlur={() => setHover(null)}>
          <span className="series-legend"><span><i className="legend-line" style={{ background: SERIES_COLORS.reported }} />{hub.label} imports</span><span><i className="legend-line dashed" style={{ borderColor: SERIES_COLORS.mirror }} />{hub.label} exports</span><span><i className="legend-line dotted" style={{ borderColor: PRICE_COLOR }} />Imports at {first.year} gold prices</span></span>
          <div className="chart-shell">
            <AnnualChart years={years} label={hub.label} hover={hover} onHover={setHover} width={chartWidth} />
            {hovered && <div className="chart-tooltip" style={{ left: `${Math.min(76, Math.max(14, (hover! / Math.max(1, years.length - 1)) * 78 + 5))}%` }} role="status">
              <b>{hovered.year}</b>
              <span><i style={{ background: SERIES_COLORS.reported }} />Imports <em>{formatUsd(hovered.imports)}</em></span>
              <span><i style={{ background: SERIES_COLORS.mirror }} />Exports <em>{formatUsd(hovered.exports)}</em></span>
              <span><i style={{ background: PRICE_COLOR }} />Imports at {first.year} prices <em>{formatUsd(atFirstYearPrice(hovered))}</em></span>
            </div>}
          </div>
        </div>
        <p className="visual-footnote">Values as {hub.label} reports them to UN Comtrade, through {latest.year}. The dotted line re-prices each year’s imports at the {first.year} average gold price (approximate LBMA annual averages), so it tracks the amount of gold rather than its price. Reported weights are inconsistent, so tonnes are not shown.</p>
        <details className="data-table-toggle"><summary>View data as a table</summary><div className="table-scroll"><table><thead><tr><th>Year</th><th>Imports</th><th>Exports</th><th>Imports at {first.year} prices</th><th>Gold price (approx.)</th></tr></thead><tbody>{years.map((year) => <tr key={year.year}><td>{year.year}</td><td>{formatUsd(year.imports)}</td><td>{formatUsd(year.exports)}</td><td>{formatUsd(atFirstYearPrice(year))}</td><td>{GOLD_PRICE[year.year] ? `$${formatCount(GOLD_PRICE[year.year])}/oz` : "—"}</td></tr>)}</tbody></table></div></details>
      </article>

      <article className="visual-card">
        <div className="visual-card-head"><div><p className="eyebrow">WHERE IT GOES <span>/</span> {selected.year}</p><h2>Top destinations</h2></div></div>
        <CountBars rows={selected.destinations.slice(0, 8).map((row) => [row.name.replace("China, Hong Kong SAR", "Hong Kong"), row.value])} total={selected.exports} format={formatUsd} unit={`of ${hub.label} gold exports`} />
        <p className="visual-footnote">{hub.label}-reported gold exports, U.S. dollars; bar labels show value and share of all its gold exports that year. Values here are dollars, not shipment records.</p>
      </article>
    </div>

    <article className="visual-card analysis-card">
      <div className="visual-card-head"><div><p className="eyebrow">MIRROR CHECK <span>/</span> TOP {selected.sources.length} SOURCES</p><h2>Does each source country record sending this gold?</h2></div>
        <div className="view-switch" role="tablist" aria-label="Year">{years.map((year, index) => <button type="button" role="tab" key={year.year} aria-selected={year === selected} className={year === selected ? "active" : ""} onClick={() => setYearIndex(index)}>{year.year}</button>)}</div></div>
      <p className="analysis-legend">In {selected.year}, {hub.label} recorded {formatUsd(totalOf(selected))} of gold from these {selected.sources.length} countries. Their own export records account for all but {formatUsd(unmatchedOf(selected))} ({formatShare(unmatchedOf(selected), totalOf(selected))}).</p>
      <div className="table-scroll analysis-table"><table>
        <thead><tr><th>Source country</th><th>{hub.label} recorded imports</th><th>Source-reported exports to {hub.label}</th><th>Gap</th><th>Reading</th><th>LBMA refiners</th><th>Context</th></tr></thead>
        <tbody>{selected.sources.map((source) => { const read = reading(source); const gap = gapOf(source);
          return <tr key={source.code}>
            <td><b>{source.name.replace("China, Hong Kong SAR", "Hong Kong")}</b></td>
            <td className="num">{formatUsd(source.value)}</td>
            <td className="num">{source.partnerReported === null ? <small>Not reported</small> : formatUsd(source.partnerReported)}</td>
            <td className={`num ${read !== "agree" && read !== "unreported" ? "over" : ""}`}>{read === "none" ? <small>Not meaningful</small> : formatGap(gap)}</td>
            <td><span className={`hub-reading ${read}`}>{readingLabel[read]}</span></td>
            <td className="num">{lbmaCount(source.name) || "None"}{lbmaRemovedSince(source.name, "2015") > 0 && <small>{lbmaRemovedSince(source.name, "2015")} removed since 2015</small>}</td>
            <td><small>{hub.notes[source.code] ?? ""}</small></td>
          </tr>; })}</tbody>
      </table></div>
      <p className="visual-footnote">Gap = {hub.label}-recorded imports ÷ source-reported exports − 1; beyond ±25% is highlighted. LBMA refiners = refineries in that country currently on the LBMA gold Good Delivery List. “Almost none” means the source reports less than a tenth of what {hub.label} records, where a percentage stops being useful. Importers usually value goods including freight and insurance and exporters don’t, so small positive gaps are normal.</p>
    </article>

    <article className="visual-card analysis-card">
      <div className="visual-card-head"><div><p className="eyebrow">SAYARI <span>/</span> SHIPMENT RECORDS <span>/</span> SNAPSHOT {formatDate(sayariGold.generatedAt)}</p><h2>Routes and the companies that trade</h2></div><span className="data-chip">AGGREGATES · NO COMPANY NAMED</span></div>
      <div className="hub-sayari">
        <div><h3>Gold arriving in {hub.label}, by departure country</h3><CountBars rows={inbound.departure} total={inbound.records} /><small className="hub-sub">{formatCount(inbound.records)} records, {formatDate(inbound.earliest)} – {formatDate(inbound.latest)}</small></div>
        <div><h3>Gold leaving {hub.label}, by destination</h3><CountBars rows={outbound.arrival} total={outbound.records} /><small className="hub-sub">{formatCount(outbound.records)} records, {formatDate(outbound.earliest)} – {formatDate(outbound.latest)}</small></div>
      </div>
      <div className="intel-stats hub-company">
        {buyers ? <>
          <div><span className="metric-label">FREE-ZONE FIRMS IN TOP 25 BUYERS</span><strong>{buyers.freeZoneFirms} of {buyers.sampled}</strong><small>{formatShare(buyers.freeZoneRecords, buyers.sampledRecords)} of those buyers’ records. {buyers.freeZoneProfile}.</small></div>
          <div><span className="metric-label">MAINLAND BUYERS</span><strong>{buyers.sampled - buyers.freeZoneEntries} of {buyers.sampled}</strong><small>{buyers.mainlandProfile}.</small></div>
        </> : <>
          <div><span className="metric-label">SUPPLIERS OF GOLD TO {hub.label.toUpperCase()}</span><strong>{formatCount(inbound.suppliers)}</strong><small>Distinct exporting companies in Sayari’s records</small></div>
          <div><span className="metric-label">TOP DEPARTURE COUNTRY</span><strong>{formatShare(inbound.departure[0][1], inbound.records)}</strong><small>Of inbound records come from one country, reflecting which countries publish shipment-level customs data</small></div>
        </>}
        <div><span className="metric-label">EXPORTS DECLARED “{hub.label.toUpperCase()} ORIGIN”</span><strong>{formatShare(ownOrigin, outbound.records)}</strong><small>Of outbound records. Refining or re-melting can make {hub.label} the declared origin, so the mining country drops out of downstream records.</small></div>
        <div><span className="metric-label">TOP SOURCES WITH NO LBMA REFINER</span><strong>{noRefiner} of {latest.sources.length}</strong><small>In {latest.year}; gold from these countries most likely arrives unrefined{buyers && exporters ? `. ${formatCount(buyers.total)} buyers and ${formatCount(exporters.total)} exporters in Sayari; ${buyers.flagged.charAt(0).toLowerCase()}${buyers.flagged.slice(1)}` : ""}.</small></div>
      </div>
      {buyerMix && <><h3>Who buys: the 25 largest buyers in Sayari, by type</h3>
        <CountBars rows={buyerMix.groups.map((group) => [`${group.label} (${group.firms})`, group.records])} total={buyerMix.sampledRecords} />
        <p className="analysis-legend">{buyerMix.flags} Shares are of those buyers’ {formatCount(buyerMix.sampledRecords)} shipment records; the number in brackets is how many firms fall in each group. Types are assigned from company names and registrations.</p></>}
      <h3>Companies supplying gold to {hub.label} that carry a Sayari risk flag, by category</h3>
      <CountBars rows={inbound.supplierRisk.map(([key, count]) => [riskNames[key] ?? key, count])} total={inbound.suppliers} unit="suppliers" />
      <p className="visual-footnote">Shipment counts are records across every year Sayari holds, not dollars or tonnes. The risk bars count supplier companies (of {formatCount(inbound.suppliers)}) carrying each flag; most forced- and child-labor flags come from U.S. Labor Department listings of gold from Peru and other mining countries, and describe the country and product, not a finding about the company. Which countries appear depends on which publish shipment-level customs records, so Peru and Colombia, which publish detailed export declarations, often dominate.{buyers ? " Free-zone firms are identified by licence suffix (DMCC, FZE, FZCO, FZ-LLC)." : ""}{exporters ? ` ${exporters.caveat}.` : ""}</p>
    </article>

    <article className="visual-card analysis-card">
      <div className="visual-card-head"><div><p className="eyebrow">ACCREDITATION <span>/</span> LBMA GOOD DELIVERY LIST <span>/</span> {formatDate(lbma.generatedAt.slice(0, 10))}</p><h2>Which refiners London accepts</h2></div><span className="data-chip">LBMA · PUBLIC LIST</span></div>
      <p className="analysis-legend">The London Bullion Market Association accepts gold bars only from refiners on its Good Delivery List, which requires annual responsible-sourcing audits. A refiner that is removed moves to the Former List with a transfer date.</p>
      <div className="intel-stats hub-company">
        <div><span className="metric-label">ACCREDITED GOLD REFINERS</span><strong>{lbmaCurrent.length}</strong><small>In {lbmaCountries.length} countries and territories</small></div>
        <div><span className="metric-label">{hub.label.toUpperCase()} REFINERS LISTED</span><strong>{lbmaCount(hub.lbmaName)}</strong><small>Now, plus {lbmaFormerCount(hub.lbmaName)} on the Former List. {hub.refinerNote}</small></div>
        <div><span className="metric-label">RUSSIAN REFINERS REMOVED IN 2022</span><strong>{russiaRemoved2022}</strong><small>Transferred to the Former List in March 2022; no Russian refiner is listed now.</small></div>
        <div><span className="metric-label">REMOVED OVER RESPONSIBLE SOURCING</span><strong>{sourcingRemovals.length}</strong><small>Where the LBMA states this reason: refiners in {[...new Set(sourcingRemovals.map((refiner) => titleCase(countryKey(refiner.country))))].join(" and ")}, both in {[...new Set(sourcingRemovals.map((refiner) => refiner.transfersToFormer[0]?.slice(0, 4)))].join(" and ")}. Most removals give no reason or a historical one.</small></div>
      </div>
      <h3>Accredited refiners by country</h3>
      <CountBars rows={lbmaCountries.slice(0, 10).map(([key, count]) => [titleCase(key), count])} total={lbmaCurrent.length} unit="accredited refiners" />
      <p className="visual-footnote">Gold from a country with no accredited refiner reaches London only after refining elsewhere, often in Switzerland or the UAE. Not being listed says nothing about a refiner’s conduct; the UAE, for example, runs its own UAEGD accreditation, whose register was not machine-readable from here.</p>
    </article>

    {hub.cards.length > 0 && <div className="observation-grid">{hub.cards.map((card) => <article key={card.title} className="provider-card"><h3>{card.title}</h3><p>{card.body}</p></article>)}</div>}

    <div className="coverage-note hub-disclosure"><Globe2 size={19} /><div><b>About this data</b>
      <p><b>Trade values:</b> UN Comtrade annual statistics for HS 7108 (non-monetary gold), as reported by {hub.label} and by each source country, pulled {formatDate(hubGold.generatedAt.slice(0, 10))} from the public preview API. Comtrade publishes country statistics under its terms of use; figures are as reported and later revisions are not reflected. <b>Company and route data:</b> Sayari Graph aggregates pulled {formatDate(sayariGold.generatedAt)} through the Sayari connector, licensed for this workspace; only counts are shown and no company is named. <b>Gold prices:</b> approximate LBMA annual averages, used only to separate price from volume. <b>Refiner accreditation:</b> the LBMA’s public gold Good Delivery current and former lists, read from lbma.org.uk on {formatDate(lbma.generatedAt.slice(0, 10))}; only counts by country are shown.</p>
      {hub.sources.length > 0 && <p><b>Checked against:</b> {hub.sources.map((source, index) => <span key={source.url}>{index > 0 && "; "}<a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></span>)}.</p>}
      <p><b>What this cannot show:</b> individual shipments, which zone or vault a consignment entered, or whether any trade was illicit. Gaps also arise from gold carried by hand and not declared, refinery countries recorded in place of destinations, monetary gold excluded on one side, timing, and confidential reporting. Nothing here is an allegation about any country or company.</p></div></div>
    <p className="data-provenance"><Database size={12} /> Refresh trade values with <code>npm run data:hub-gold</code> and the LBMA lists with <code>npm run data:lbma</code>. <ShieldAlert size={12} /> Sayari figures are a dated snapshot. <Search size={12} /> Source notes are leads to check.</p>
  </>;
}

type Topic = "gold" | "electronics";
const topics: { id: Topic; label: string }[] = [{ id: "gold", label: "Gold" }, { id: "electronics", label: "Dual-use electronics → Russia" }];

export default function HubWatch() {
  const [topic, setTopic] = useState<Topic>("gold");
  const [goldCode, setGoldCode] = useState(goldHubs[0].code);
  const [electronicsCode, setElectronicsCode] = useState(electronicsHubs[0].code);
  const options = topic === "gold" ? goldHubs : electronicsHubs;
  const active = topic === "gold" ? goldCode : electronicsCode;
  const choose = topic === "gold" ? setGoldCode : setElectronicsCode;
  return <section className="tab-page hub-page">
    <div className="hub-switches">
      <div className="view-switch hub-switch" role="tablist" aria-label="Trade">{topics.map((item) => <button type="button" role="tab" key={item.id} aria-selected={topic === item.id} className={topic === item.id ? "active" : ""} onClick={() => setTopic(item.id)}>{item.label}</button>)}</div>
      <div className="view-switch hub-switch hub-country" role="tablist" aria-label="Hub country">{options.map((item) => <button type="button" role="tab" key={item.code} aria-selected={active === item.code} className={active === item.code ? "active" : ""} onClick={() => choose(item.code)}>{item.label}</button>)}</div>
    </div>
    {topic === "gold" ? <GoldHub key={goldCode} code={goldCode} /> : <ElectronicsHub key={electronicsCode} code={electronicsCode} />}
  </section>;
}
