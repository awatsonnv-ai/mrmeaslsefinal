// <state-tracker-map> — one zoomed-in single-state map for every state landing
// page, replacing the per-state copies this started as (floridamap.js, then
// mainemap.js). Six near-identical files was the direction of travel; this is
// the same component with the state as an attribute instead of a hard-coded name.
//
//   state — full state name as it appears in data/states-10m.json ("Maine")
//   point — "lon,lat" for the looked-up ZIP, or empty for no dot
//
// The dot marks the ZIP itself, using the per-ZIP coordinates in
// data/<st>-zip-points.json. (floridamap.js predates those tables and falls back
// to congressional-district centroids; it is left alone because /florida is live.)
//
// Requires d3 + topojson loaded globally (already loaded for the outbreak map).
customElements.define('state-tracker-map', class extends HTMLElement {
  static get observedAttributes(){ return ['state', 'point']; }
  attributeChangedCallback(name){
    if (name === 'state') this._draw();
    else this._applyDot();
  }
  _applyDot(){
    if(!this._proj || !this._dotLayer) return;
    var raw = (this.getAttribute('point') || '').split(',');
    var lon = parseFloat(raw[0]), lat = parseFloat(raw[1]);
    var xy = (isFinite(lon) && isFinite(lat)) ? this._proj([lon, lat]) : null;
    this._dotLayer.selectAll('circle').data(xy ? [xy] : []).join('circle')
      .attr('cx', function(d){ return d[0]; })
      .attr('cy', function(d){ return d[1]; })
      .attr('r', 9)
      .attr('fill', '#F2C338')
      .attr('stroke', '#111111')
      .attr('stroke-width', 1.5);
  }
  async connectedCallback(){
    if(this._did) return; this._did = true;
    await new Promise(r=>{ const t=setInterval(()=>{ if(window.d3 && window.topojson){ clearInterval(t); r(); } }, 40); });
    const topo = await fetch('data/states-10m.json').then(r=>r.json());
    this._states = topojson.feature(topo, topo.objects.states);
    this._draw();
  }
  _draw(){
    if(!this._states) return; // attribute set before the topology landed; connectedCallback draws
    const want = (this.getAttribute('state') || '').trim();
    const feature = this._states.features.find(d => String(d.properties.name) === want);
    if(!feature) return;

    // A near-square box rather than each state's true bounding aspect. Tall states
    // (Maine) would otherwise render far taller than the cards beside them, and
    // wide ones (Texas) far shorter, so the column height would lurch between
    // pages. Mercator still fits without distortion — the state just gets margin
    // on whichever axis it does not fill.
    const W = 640, H = 620, pad = 24;
    const proj = d3.geoMercator().fitExtent([[pad, pad], [W - pad, H - pad]], feature);
    this._proj = proj;
    const svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${H}`)
      .attr('aria-hidden', 'true').attr('focusable', 'false')
      .style('width', '100%').style('height', 'auto').style('display', 'block');
    svg.append('path')
      .datum(feature)
      .attr('d', d3.geoPath(proj))
      .attr('fill', '#E8232F')
      .attr('stroke', '#F2C338')
      .attr('stroke-width', 2);
    this._dotLayer = svg.append('g');
    this.innerHTML = '';
    this.appendChild(svg.node());
    this._applyDot();
  }
});
