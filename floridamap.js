// <florida-tracker-map> — zoomed-in, Florida-only variant of senate-tracker-map
// (senatemap.js), used only on the /florida landing page, which only ever
// looks up Florida ZIP codes. Unlike senatemap.js there is nothing else on
// the map to compare against, so Florida is always drawn in the "selected"
// red/yellow treatment; the `districts` attribute instead drives a dot (or
// dots, for a ZIP that spans more than one district) marking where the
// looked-up ZIP's congressional district(s) sit within the state.
//
// District centroids in data/fl-district-centroids.json were computed with
// d3.geoCentroid from the Census Bureau's 119th Congress cartographic
// boundary file (cb_2024_us_cd119_500k) — real district shapes, not
// estimated points. A centroid marks the district's geographic center, not
// the ZIP itself, so two ZIPs in the same district show the same dot.
//
// Requires d3 + topojson loaded globally (already loaded for the outbreak map).
customElements.define('florida-tracker-map', class extends HTMLElement {
  static get observedAttributes(){ return ['districts']; }
  attributeChangedCallback(){ this._applyDots(); }
  _applyDots(){
    if(!this._proj || !this._dotLayer || !this._centroids) return;
    const codes = (this.getAttribute('districts') || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const points = codes
      .map(code => this._centroids[code])
      .filter(Boolean)
      .map(([lon, lat]) => this._proj([lon, lat]))
      .filter(Boolean);
    this._dotLayer.selectAll('circle').data(points).join('circle')
      .attr('cx', d => d[0]).attr('cy', d => d[1])
      .attr('r', 9)
      .attr('fill', '#F2C338')
      .attr('stroke', '#111111')
      .attr('stroke-width', 1.5);
  }
  async connectedCallback(){
    if(this._did) return; this._did = true;
    await new Promise(r=>{ const t=setInterval(()=>{ if(window.d3 && window.topojson){ clearInterval(t); r(); } }, 40); });

    const [topo, centroids] = await Promise.all([
      fetch('data/states-10m.json').then(r => r.json()),
      fetch('data/fl-district-centroids.json').then(r => r.json())
    ]);
    const states = topojson.feature(topo, topo.objects.states);
    const florida = states.features.find(d => String(d.properties.name) === 'Florida');
    if (!florida) return; // the topology always includes Florida; nothing to draw if it somehow doesn't
    this._centroids = centroids;

    // A single state, so a plain Mercator fit (not the composite geoAlbersUsa
    // senatemap.js uses for the whole country) — no Alaska/Hawaii insets to place.
    const W = 700, H = 540, pad = 24;
    const proj = d3.geoMercator().fitExtent([[pad, pad], [W - pad, H - pad]], florida);
    this._proj = proj;
    const path = d3.geoPath(proj);
    const svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${H}`)
      .attr('aria-hidden', 'true').attr('focusable', 'false')
      .style('width', '100%').style('height', 'auto').style('display', 'block');

    svg.append('path')
      .datum(florida)
      .attr('d', path)
      .attr('fill', '#E8232F')
      .attr('stroke', '#F2C338')
      .attr('stroke-width', 2);

    this._dotLayer = svg.append('g');
    this.appendChild(svg.node());
    this._applyDots();
  }
});
