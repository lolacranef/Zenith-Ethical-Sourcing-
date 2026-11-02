import { Globe2 } from "lucide-react";
import ftz from "./data/ftz-exporters.json";
import { formatCount, formatDate } from "./data";

// Indonesian solar exporters to the U.S. whose registered addresses sit in a free trade zone.
// Hand-entered from Sayari entity summaries; see "About this data" for how the list was built.
const ZONE_NOTE: Record<string, string> = {
  Batam: "The whole of Batam island is a free trade and free port zone (Government Regulation 46/2007).",
  Bintan: "Bintan Industrial Estate sits inside the Bintan free trade zone enclaves (Government Regulation 47/2007).",
};

export default function FreeZoneExporters() {
  const rows = ftz.exporters;
  const inZone = rows.length;
  const flagged = rows.filter((row) => row.flags.length > 0).length;
  return <div className="ftz-exporters">
    <p className="flow-trend-summary"><b>{inZone} of the {ftz.checked}</b> Indonesian solar exporters to the U.S. checked are registered in the Batam or Bintan free trade zones; {flagged} show at least one address or network pattern from the free-zone method. Being in a zone is normal for exporters. These rows are screening leads to check, not findings.</p>
    <div className="table-scroll analysis-table"><table>
      <thead><tr><th>Exporter</th><th>Zone</th><th>U.S. shipments</th><th>What to check</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.name}>
        <td><b>{row.name}</b>{row.area}</td>
        <td title={ZONE_NOTE[row.zone]}>{row.zone} FTZ</td>
        <td>{formatCount(row.shipments)}</td>
        <td>{row.flags.length ? <ul className="ftz-flags">{row.flags.map((flag) => <li key={flag}>{flag}</li>)}</ul> : <span className="ftz-none">No pattern found</span>}</td>
      </tr>)}</tbody>
    </table></div>
    <div className="coverage-note hub-disclosure"><Globe2 size={19} /><div><b>About this data</b>
      <p><b>Companies and addresses:</b> Sayari Graph, pulled {formatDate(ftz.generatedAt)} through the Sayari connector. The {ftz.largestChecked} exporters with the most U.S.-bound shipments of HS 8541.43 from Indonesia were checked, plus one found by its Bintan name ({ftz.checked} of {ftz.suppliersOnRoute} on the route); {ftz.outsideZone} had no free-zone address. Shipment counts are Sayari&rsquo;s all-time totals for this route. <b>Zones:</b> {ZONE_NOTE.Batam} {ZONE_NOTE.Bintan}</p>
      <p><b>Network links:</b> sanctions links are two trade steps away (a supplier or customer of the exporter trades with a listed party); none of these exporters is sanctioned itself. <b>What this cannot show:</b> where any shipment&rsquo;s cells were made, who controls the companies, or whether any trade was illicit. Nothing here is an allegation about any company.</p></div></div>
  </div>;
}
