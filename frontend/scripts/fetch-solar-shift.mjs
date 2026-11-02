// Builds src/data/solar-shift.json from the keyless UN Comtrade preview API: monthly
// U.S.-reported imports of solar cells and modules (HS 854143), split by supplier country.
// The Trade flows case study groups these into the countries covered by the 2025 duty
// orders, the countries that grew afterwards, and the ones that grew after those faced
// duties in turn. Run with `npm run data:solar-shift`.
// The preview API takes one period per call, so this is one call per month.
import { writeFile, mkdir } from "node:fs/promises";

const API = "https://comtradeapi.un.org/public/v1/preview/C/M/HS";
const USA = 842;
const CMD = "854143";
const START = "202301";
const PAUSE_MS = 1300;
const OUT = new URL("../src/data/solar-shift.json", import.meta.url);

// Comtrade numeric partner codes for the countries named in the chart.
const partners = { 116: "KHM", 458: "MYS", 764: "THA", 704: "VNM", 360: "IDN", 418: "LAO", 699: "IND", 231: "ETH", 608: "PHL", 404: "KEN", 566: "NGA", 262: "DJI", 818: "EGY" };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function query(period) {
  const url = `${API}?${new URLSearchParams({ reporterCode: USA, period, cmdCode: CMD, flowCode: "M" })}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(PAUSE_MS * (attempt + 1));
    const response = await fetch(url).catch((error) => { console.log(`  network error (${error.cause?.code ?? error.message}), retrying`); return null; });
    if (!response) continue;
    if (response.status === 403 || response.status === 429) {
      const wait = Number(response.headers.get("retry-after") ?? 60) + 5;
      console.log(`  quota reached, waiting ${Math.ceil(wait / 60)} min`);
      await sleep(wait * 1000);
      continue;
    }
    if (response.status >= 500) continue;
    if (!response.ok) throw new Error(`HTTP ${response.status} (${url})`);
    const body = await response.json();
    if (body.error) throw new Error(`${body.error} (${url})`);
    // Keep only the all-customs-procedure, all-transport-mode totals.
    return (body.data ?? []).filter((row) => row.customsCode === "C00" && row.motCode === 0 && row.partner2Code === 0);
  }
  throw new Error(`Comtrade kept refusing ${url}`);
}

const now = new Date();
const periods = [];
for (let date = new Date(Date.UTC(Number(START.slice(0, 4)), Number(START.slice(4)) - 1, 1)); date <= now; date.setUTCMonth(date.getUTCMonth() + 1)) {
  periods.push(`${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
}

const kept = [];
const world = [];
const byPartner = Object.fromEntries(Object.values(partners).map((code) => [code, []]));
for (const period of periods) {
  const rows = await query(period);
  const total = rows.find((row) => row.partnerCode === 0)?.primaryValue;
  // Stop at the first month the United States has not reported yet.
  if (total === undefined) { console.log(`${period}: not reported yet, stopping`); break; }
  kept.push(`${period.slice(0, 4)}-${period.slice(4)}`);
  world.push(total);
  for (const [numeric, code] of Object.entries(partners)) byPartner[code].push(rows.find((row) => row.partnerCode === Number(numeric))?.primaryValue ?? 0);
  console.log(`${period}: $${Math.round(total / 1e6)}M from ${rows.length - 1} partners`);
}

const result = {
  generatedAt: now.toISOString(),
  source: "UN Comtrade (comtradeapi.un.org, public preview)",
  reporter: "United States",
  cmdCode: CMD,
  flow: "Imports (general), U.S. dollars, customs value",
  periods: kept,
  world,
  partners: byPartner,
};
await mkdir(new URL(".", OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Wrote ${decodeURIComponent(OUT.pathname)}`);
