// Builds src/data/hub-gold.json from the keyless UN Comtrade preview API.
// For each hub and year: hub-reported gold (HS 7108) imports and exports, the partner breakdown,
// and what the top source countries report exporting to the hub (mirror statistics).
// Run with `npm run data:hub-gold`. The preview API allows one period per call, so this makes 2 calls per hub-year.
import { writeFile } from "node:fs/promises";

const API = "https://comtradeapi.un.org/public/v1/preview/C";
const NAMES_URL = "https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json";
const HUBS = { 784: "United Arab Emirates", 757: "Switzerland", 792: "Türkiye", 344: "Hong Kong" };
// The latest calendar year is usually reported by only some countries, and partly, so stop two years back.
const LAST_YEAR = new Date().getUTCFullYear() - 2;
const FIRST_YEAR = 2018;
const TOP_SOURCES = 15;
const PAUSE_MS = 2500;
const OUT = new URL("../src/data/hub-gold.json", import.meta.url);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function query(params) {
  const url = `${API}/A/HS?${new URLSearchParams({ cmdCode: "7108", ...params })}`;
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

const names = Object.fromEntries((await (await fetch(NAMES_URL)).json()).results.map((area) => [area.id, area.text]));
const byPartner = (rows) => rows.filter((row) => row.partnerCode !== 0).sort((a, b) => b.primaryValue - a.primaryValue).map((row) => ({ code: row.partnerCode, name: names[row.partnerCode] ?? String(row.partnerCode), value: row.primaryValue }));

const hubs = {};
for (const [code, label] of Object.entries(HUBS)) {
  const years = [];
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    const rows = await query({ reporterCode: code, period: String(year), flowCode: "M,X" });
    const total = (flow) => rows.find((row) => row.flowCode === flow && row.partnerCode === 0)?.primaryValue ?? null;
    if (total("M") === null) { console.log(`${label} ${year}: not reported yet`); continue; }
    const imports = byPartner(rows.filter((row) => row.flowCode === "M"));
    const exports = byPartner(rows.filter((row) => row.flowCode === "X"));
    const top = imports.slice(0, TOP_SOURCES);
    const mirror = await query({ reporterCode: top.map((source) => source.code).join(","), partnerCode: code, period: String(year), flowCode: "X" });
    const sources = top.map((source) => ({ ...source, partnerReported: mirror.find((row) => row.reporterCode === source.code)?.primaryValue ?? null }));
    years.push({ year, imports: total("M"), exports: total("X"), sources, destinations: exports.slice(0, 10) });
    console.log(`${label} ${year}: imports $${(total("M") / 1e9).toFixed(1)}B, ${sources.filter((source) => source.partnerReported !== null).length}/${sources.length} sources report a mirror figure`);
  }
  hubs[code] = { name: label, years };
}

await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: "UN Comtrade (comtradeapi.un.org, public preview)", hs: "7108", hubs }, null, 2) + "\n");
console.log(`Wrote ${Object.keys(hubs).length} hubs to ${OUT.pathname}`);
