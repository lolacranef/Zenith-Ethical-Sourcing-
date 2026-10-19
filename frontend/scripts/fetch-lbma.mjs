// Builds src/data/lbma-good-delivery.json from the LBMA's public gold Good Delivery lists.
// The list pages embed each refiner as a script object literal; this reads the named fields out of them.
// Bar-mark descriptions are left out; transfer dates are kept, including earlier delistings noted on re-listed refiners.
// Run with `npm run data:lbma`.
import { writeFile } from "node:fs/promises";

const PAGES = {
  current: "https://www.lbma.org.uk/good-delivery/gold-current-list",
  former: "https://www.lbma.org.uk/good-delivery/gold-former-list",
};
const OUT = new URL("../src/data/lbma-good-delivery.json", import.meta.url);

const decode = (text) => text.replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const field = (block, name) => {
  const match = block.match(new RegExp(`"${name}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|null)`));
  const value = match && match[1] !== "null" ? decode(JSON.parse(match[1]).trim()) : null;
  return value && value !== "null" ? value : null;
};
const toIso = (ddmmyyyy) => { const m = ddmmyyyy?.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

async function readList(url) {
  const html = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Zenith data refresh)" } })).text();
  const blocks = html.split(/"refinery"\s*:/).slice(1).map((chunk) => `"refinery":${chunk.split(/\n\s*},/)[0]}`);
  if (!blocks.length) throw new Error(`No refiner entries found on ${url}; the page layout may have changed`);
  return blocks.map((block) => {
    const rawNotes = field(block, "notes") ?? "";
    const noteTransfers = [...rawNotes.matchAll(/Transfer to Former List:\s*(\d{2}\/\d{2}\/\d{4})/g)].map((m) => toIso(m[1]));
    const transfer = toIso(field(block, "dateOfTransferToFormerList"));
    return {
      company: field(block, "company"),
      refinery: field(block, "refinery"),
      location: field(block, "location"),
      country: field(block, "country"),
      listedFrom: field(block, "listingFrom"),
      firstListing: field(block, "firstListing"),
      transfersToFormer: [...new Set([transfer, ...noteTransfers].filter(Boolean))].sort().reverse(),
      reasonForTransfer: field(block, "reasonForTransfer") || null,
    };
  });
}

const current = await readList(PAGES.current);
const former = await readList(PAGES.former);
await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: "LBMA Good Delivery List (gold), lbma.org.uk", pages: PAGES, current, former }, null, 2) + "\n");
console.log(`Current: ${current.length} refiners · Former: ${former.length} entries`);
