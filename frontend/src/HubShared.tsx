import { formatCount, formatShare } from "./data";

// Shared pieces for the Hub watch views.
export const formatUsd = (value: number | null) => value === null ? "Not reported" : value >= 1e9 ? `$${(value / 1e9).toFixed(1)}B` : value < 5e5 ? "Under $1M" : `$${Math.round(value / 1e6)}M`;
// Shares under 1% keep one decimal so small routes do not read as zero.
export const smallShare = (part: number, whole: number) => { const share = whole ? part / whole : 0; return share > 0 && share < 0.001 ? "<0.1%" : share > 0 && share < 0.01 ? `${(share * 100).toFixed(1)}%` : `${Math.round(share * 100)}%`; };
export const times = (a: number, b: number) => `${(a / b).toFixed(1)}×`;

// ISO3 codes used by the Sayari facets.
export const countryNames: Record<string, string> = { KGZ: "Kyrgyzstan", UZB: "Uzbekistan", MEX: "Mexico", KOR: "South Korea", MAR: "Morocco", CHL: "Chile", ARG: "Argentina", GBR: "United Kingdom", ITA: "Italy", SGP: "Singapore", ROU: "Romania", GRC: "Greece", SWE: "Sweden", FRA: "France", UKR: "Ukraine", KAZ: "Kazakhstan", ARM: "Armenia", HKG: "Hong Kong", DEU: "Germany", FIN: "Finland", EST: "Estonia", NLD: "Netherlands", LTU: "Lithuania", BEL: "Belgium", CYP: "Cyprus", CRI: "Costa Rica", PHL: "Philippines", THA: "Thailand", JPN: "Japan", TWN: "Taiwan", USA: "United States", CHN: "China", PER: "Peru", UGA: "Uganda", COL: "Colombia", TZA: "Tanzania", TUR: "Türkiye", GHA: "Ghana", RUS: "Russia", ECU: "Ecuador", MYS: "Malaysia", CIV: "Côte d’Ivoire", IND: "India", CHE: "Switzerland", IDN: "Indonesia", PAK: "Pakistan", VNM: "Vietnam", ARE: "UAE", ZWE: "Zimbabwe", IRQ: "Iraq", LBY: "Libya" };

// Pushes end-of-line labels apart so lines that finish close together stay readable.
export function labelPositions(ys: number[], gap = 12) {
  const order = ys.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  order.forEach((item, rank) => { if (rank > 0) item.value = Math.max(item.value, order[rank - 1].value + gap); });
  return order.sort((a, b) => a.index - b.index).map((item) => item.value);
}

export function CountBars({ rows, total, format = formatCount, unit = "records" }: { rows: [string, number][]; total: number; format?: (value: number) => string; unit?: string }) {
  const max = Math.max(...rows.map(([, count]) => count));
  return <div className="risk-bars" role="list">{rows.map(([code, count]) => <div className="risk-bar-row" role="listitem" key={code} title={`${format(count)} of ${format(total)} ${unit}`}>
    <span className="risk-bar-label">{countryNames[code] ?? code}</span>
    <span className="risk-bar-track"><i style={{ width: `${Math.max(1, (count / max) * 100)}%` }} /></span>
    <span className="risk-bar-value">{format(count)} <small>({formatShare(count, total)})</small></span>
  </div>)}</div>;
}

