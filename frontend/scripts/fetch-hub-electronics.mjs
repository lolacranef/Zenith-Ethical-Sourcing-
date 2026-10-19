// Builds src/data/hub-electronics.json from the keyless UN Comtrade preview API.
// Covers Common High Priority List (CHPL) electronics: integrated circuits (8542), network equipment (851762)
// and satellite-navigation receivers (852691). For each year: what each route country reports exporting to
// Russia and to the world (one call for all of them), and for the latest year each hub's chip imports by
// supplier with the supplier's own reported exports (mirror). Russia has not published trade data since 2022.
// Run with `npm run data:hub-electronics`.
import { writeFile } from "node:fs/promises";

const API = "https://comtradeapi.un.org/public/v1/preview/C";
const NAMES_URL = "https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json";
const RUSSIA = 643;
const HUBS = [784, 344, 792, 398, 51, 417];
const CODES = ["8542", "851762", "852691"];
const ROUTES = [156, 344, 398, 51, 417, 792, 784, 699, 860, 268];
// The latest calendar year is usually reported by only some countries, and partly, so stop two years back.
const LAST_YEAR = new Date().getUTCFullYear() - 2;
const FIRST_YEAR = 2019;
const TOP_SOURCES = 10;
const PAUSE_MS = 2500;
const OUT = new URL("../src/data/hub-electronics.json", import.meta.url);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function query(params) {
  const url = `${API}/A/HS?${new URLSearchParams(params)}`;
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
const byCode = (rows, pick = () => true) => Object.fromEntries(CODES.map((code) => [code, rows.filter((row) => row.cmdCode === code && pick(row)).reduce((sum, row) => sum + row.primaryValue, 0)]));

const years = [];
for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
  const period = String(year);
  const toRussia = await query({ reporterCode: ROUTES.join(","), partnerCode: RUSSIA, period, cmdCode: CODES.join(","), flowCode: "X" });
  if (!toRussia.length) { console.log(`${year}: not reported yet`); continue; }
  const world = await query({ reporterCode: HUBS.join(","), partnerCode: 0, period, cmdCode: CODES.join(","), flowCode: "X" });
  years.push({
    year,
    routes: ROUTES.map((code) => { const rows = toRussia.filter((row) => row.reporterCode === code); return { code, name: names[code] ?? String(code), reported: rows.length > 0, toRussia: byCode(rows), toWorld: byCode(world.filter((row) => row.reporterCode === code)) }; }),
  });
  console.log(`${year}: ${new Set(toRussia.map((row) => row.reporterCode)).size}/${ROUTES.length} route countries reported`);
}

// Chip suppliers for the latest year each hub has reported.
const chipSources = {};
for (const hub of HUBS) {
  const year = [...years].reverse().find((entry) => entry.routes.find((route) => route.code === hub)?.reported)?.year;
  if (!year) continue;
  const imports = (await query({ reporterCode: hub, period: String(year), cmdCode: "8542", flowCode: "M" })).filter((row) => row.partnerCode !== 0).sort((a, b) => b.primaryValue - a.primaryValue).slice(0, TOP_SOURCES);
  const mirror = imports.length ? await query({ reporterCode: imports.map((row) => row.partnerCode).join(","), partnerCode: hub, period: String(year), cmdCode: "8542", flowCode: "X" }) : [];
  chipSources[hub] = { year, sources: imports.map((row) => ({ code: row.partnerCode, name: names[row.partnerCode] ?? String(row.partnerCode), value: row.primaryValue, partnerReported: mirror.find((m) => m.reporterCode === row.partnerCode)?.primaryValue ?? null })) };
  console.log(`${names[hub]}: ${imports.length} chip suppliers for ${year}`);
}

await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: "UN Comtrade (comtradeapi.un.org, public preview)", codes: { "8542": "Integrated circuits", "851762": "Network and communication equipment", "852691": "Satellite-navigation (GNSS) receivers" }, hubs: HUBS, years, chipSources }, null, 2) + "\n");
console.log(`Wrote ${years.length} years to ${OUT.pathname}`);
