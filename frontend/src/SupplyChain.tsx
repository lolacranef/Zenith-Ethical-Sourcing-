import { useState } from "react";
import { ArrowRight, Factory, Globe2, PackageOpen, Ship } from "lucide-react";
import { ComposableMap, Geographies, Geography, Marker, useMapContext } from "react-simple-maps";
import worldAtlasUrl from "world-atlas/countries-110m.json?url";
import chainsData from "./data/supply-chains.json";
import { corridorData, formatCount, formatDate, formatShare, indicationLabels, products, shortPartner, mirrorData } from "./data";
import { HowToRead, More } from "./Glossary";
import { CountBars } from "./HubShared";

// One step back from each Product watch corridor: where the maker's key input ships from, and the route on to the U.S.
type Counted = [string, number][];
type Chain = {
  maker: string; make: string; gist: string; check: string;
  input: { label: string; hs: string; records: number; from: Counted; suspect?: string } | null;
  domestic?: string;
  elsewhere?: { label: string; hs: string; records: number; to: Counted };
};
const places = chainsData.places as unknown as Record<string, { name: string; at: [number, number] }>;
const chains = chainsData.chains as unknown as Record<string, Chain>;
const nameOf = (code: string) => places[code]?.name ?? code;
// Line weight follows each source's share of records, so one dominant source reads at a glance.
const weight = (count: number, total: number) => 1.2 + 6 * Math.sqrt(count / total);
const lonGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
// Centers the map on the route so no line has to cross the map's edge.
function centerLongitude(lons: number[]) {
  let best = 0, bestSpread = Infinity;
  for (let center = -180; center < 180; center += 5) {
    const spread = Math.max(...lons.map((lon) => lonGap(lon, center)));
    if (spread < bestSpread) { best = center; bestSpread = spread; }
  }
  return best;
}

// A gentle arc drawn in map space; great circles bend over the poles on a flat map.
function Arc({ from, to, className, strokeWidth, delay }: { from: [number, number]; to: [number, number]; className: string; strokeWidth: number; delay: number }) {
  const { projection } = useMapContext();
  const a = projection(from), b = projection(to);
  if (!a || !b) return null;
  const [x1, y1] = a, [x2, y2] = b;
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  let nx = -(y2 - y1) / length, ny = (x2 - x1) / length;
  if (ny > 0) { nx = -nx; ny = -ny; }
  const bend = Math.min(90, length * 0.2);
  return <path className={className} d={`M${x1},${y1} Q${(x1 + x2) / 2 + nx * bend},${(y1 + y2) / 2 + ny * bend} ${x2},${y2}`} strokeWidth={strokeWidth} style={{ animationDelay: `${delay}ms` }} />;
}

function ChainMap({ chain }: { chain: Chain }) {
  const maker = places[chain.maker].at;
  const usa = places.USA.at;
  const inputs = chain.input?.from ?? [];
  const others = (chain.elsewhere?.to ?? []).filter(([code]) => code !== "USA");
  const lit = new Set([chain.maker, "USA", ...inputs.map(([code]) => code), ...others.map(([code]) => code)]);
  const center = centerLongitude([...lit].map((code) => places[code].at[0]));
  return <ComposableMap className="chain-map" projection="geoEqualEarth" projectionConfig={{ scale: 150, rotate: [-center, 0, 0], center: [0, 12] }} width={760} height={330} aria-label={`Map of the ${chain.make.toLowerCase()} route through ${nameOf(chain.maker)} to the United States`}>
    <Geographies geography={worldAtlasUrl}>{({ geographies }) => geographies.map((geo) => <Geography key={geo.rsmKey} geography={geo} className="chain-land" tabIndex={-1} />)}</Geographies>
    {inputs.map(([code, count], index) => <Arc key={code} className="chain-line chain-input" from={places[code].at} to={maker} strokeWidth={weight(count, chain.input!.records)} delay={index * 90} />)}
    {others.map(([code, count], index) => <Arc key={code} className="chain-line chain-other" from={maker} to={places[code].at} strokeWidth={weight(count, chain.elsewhere!.records)} delay={index * 90} />)}
    <Arc className="chain-line chain-export" from={maker} to={usa} strokeWidth={4} delay={500} />
    {inputs.map(([code]) => <Marker key={code} coordinates={places[code].at}><circle className="chain-node" r={3.5} /></Marker>)}
    {others.map(([code]) => <Marker key={code} coordinates={places[code].at}><circle className="chain-node chain-node-other" r={3.5} /></Marker>)}
    {[...inputs, ...others].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([code]) => <Marker key={`label-${code}`} coordinates={places[code].at}><text className="chain-label" y={-8} textAnchor="middle">{nameOf(code)}</text></Marker>)}
    <Marker coordinates={maker}><circle className="chain-node chain-maker" r={7} /><text className="chain-label chain-label-strong" y={-12} textAnchor="middle">{nameOf(chain.maker)}</text></Marker>
    <Marker coordinates={usa}><circle className="chain-node chain-us" r={7} /><text className="chain-label chain-label-strong" y={-12} textAnchor="middle">United States</text></Marker>
  </ComposableMap>;
}

export function SupplyChain({ onOpenProduct }: { onOpenProduct: (productId: string) => void }) {
  const [activeId, setActiveId] = useState(products[0].id);
  const product = products.find((item) => item.id === activeId)!;
  const chain = chains[activeId];
  const corridor = corridorData[activeId];
  const partner = shortPartner(mirrorData[activeId]?.partner.name ?? nameOf(chain.maker));
  const forcedLabor = corridor?.supplierRisk?.forced_labor ?? 0;

  return <section className="tab-page chain-page">
    <div className="section-title-row"><div><p className="eyebrow">SUPPLY CHAIN <span>/</span> ONE STEP BACK</p><h2>Where each product comes from</h2></div><span className="data-chip">SAYARI · AGGREGATES ONLY</span></div>
    <HowToRead gist="Follow each product one step back: where its key input ships from, where it is made, and the route to the U.S.">
      <p>Each map starts at the country that makes the product for the U.S. market, then looks one step upstream at the input that country imports most for it. Line weight shows each source’s share of Sayari shipment records. Records count shipments, not tonnes or dollars, and the departure country is where a shipment left from, which is not always where the goods were made.</p>
    </HowToRead>

    <div className="view-switch chain-switch" role="tablist" aria-label="Product">{products.map((item) => <button type="button" role="tab" key={item.id} aria-selected={item.id === activeId} className={item.id === activeId ? "active" : ""} onClick={() => setActiveId(item.id)}>{item.name}</button>)}</div>

    <article className="visual-card chain-card">
      <div className="visual-card-head"><div><p className="eyebrow">{product.hs} <span>/</span> {chain.input ? `${chain.input.label.toUpperCase()} → ` : ""}{partner.toUpperCase()} → U.S.</p><h2>{product.name}</h2></div><span className="data-chip">{product.indications.map((key) => indicationLabels[key]).join(" · ").toUpperCase()}</span></div>
      <p className="chain-gist">{chain.gist}</p>
      <ChainMap key={activeId} chain={chain} />
      <div className="chain-legend" aria-hidden="true">
        {chain.input && <span><i className="chain-key chain-input" />{chain.input.label} into {partner}</span>}
        <span><i className="chain-key chain-export" />{partner} to the U.S.</span>
        {chain.elsewhere && <span><i className="chain-key chain-other" />Other buyers</span>}
      </div>

      <ol className="chain-stages">
        <li>
          <span className="chain-step"><PackageOpen size={16} /> 1 · Input</span>
          {chain.input ? <>
            <h3>{chain.input.label} <small>{chain.input.hs}</small></h3>
            <CountBars rows={chain.input.from.map(([code, count]) => [nameOf(code), count])} total={chain.input.records} />
            <small className="chain-note">{formatCount(chain.input.records)} records into {partner}; top departure countries shown.{chain.input.suspect ? ` ${chain.input.suspect}` : ""}</small>
          </> : <>
            <h3>Sourced at home</h3>
            <p>{chain.domestic}</p>
          </>}
        </li>
        <li>
          <span className="chain-step"><Factory size={16} /> 2 · {chain.make}</span>
          <h3>{partner}</h3>
          {corridor?.coverageGap ? <p>{corridor.coverageGap}</p> : corridor ? <dl className="chain-facts">
            <div><dt>Exporters to the U.S.</dt><dd>{formatCount(corridor.suppliers)}</dd></div>
            <div><dt>Shipments to the U.S.</dt><dd>{formatCount(corridor.shipments)}</dd></div>
            <div><dt>Carry a forced-labor flag</dt><dd>{formatShare(forcedLabor, corridor.suppliers)}</dd></div>
          </dl> : <p>No Sayari corridor snapshot for this route.</p>}
          {chain.elsewhere && <><h4>{chain.elsewhere.label}</h4><CountBars rows={chain.elsewhere.to.map(([code, count]) => [nameOf(code), count])} total={chain.elsewhere.records} /></>}
        </li>
        <li>
          <span className="chain-step"><Ship size={16} /> 3 · U.S. entry</span>
          <h3>What to check</h3>
          <p>{chain.check}</p>
          <button type="button" className="text-action" onClick={() => onOpenProduct(activeId)}>Open trend in Product watch <ArrowRight size={13} /></button>
        </li>
      </ol>
    </article>

    <div className="coverage-note hub-disclosure"><Globe2 size={19} /><div><b>About this data</b>
      <More gist="Sayari shipment-record counts by country. No company is named.">
        <p><b>Inputs and routes:</b> {chainsData.source}, pulled {formatDate(chainsData.generatedAt)}. Counts are shipment records across every year Sayari holds, grouped by departure country; only counts are shown and no company is named. For honey, shipments recorded as leaving India itself are left out.</p>
        <p><b>What this cannot show:</b> where goods were finally made, how much of an input went into U.S.-bound product, or air shipments that leave no bill of lading. Countries that publish detailed customs records appear more often. Nothing here is an allegation about any country or company.</p>
      </More></div></div>
  </section>;
}
