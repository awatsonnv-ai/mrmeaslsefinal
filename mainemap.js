// <maine-tracker-map> — zoomed-in, Maine-only map for the /maine landing page,
// which only ever looks up Maine ZIP codes. Same idea as floridamap.js, with one
// upgrade: Florida drops its dot on the centroid of the ZIP's congressional
// district, because no per-ZIP coordinates were available when that page was
// built. Maine has them (data/me-zip-points.json, built from the ZIP database in
// Downloads/Maine zip_code_database.csv), so the dot lands on the ZIP itself.
//
// The `point` attribute carries "lon,lat" — the page sets it from the ZIP the
// visitor submitted. Empty or unparseable means no dot, which is the correct
// state before anyone has looked anything up.
//
// Requires d3 + topojson loaded globally (already loaded for the outbreak map).
customElements.define('maine-tracker-map', class extends HTMLElement {
  static get observedAttributes(){ return ['point']; }
  attributeChangedCallback(){ this._applyDot(); }
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
    const states = topojson.feature(topo, topo.objects.states);
    const maine = states.features.find(d => String(d.properties.name) === 'Maine');
    if (!maine) return; // the topology always includes Maine; nothing to draw if it somehow doesn't

    // Maine is taller than it is wide. The box is kept close to square rather
    // than matching that shape exactly: a true-aspect portrait box would render
    // roughly 1.4x the column width in height and tower over the cards beside
    // it. Mercator still fits without distortion — Maine just gets side margin.
    const W = 640, H = 620, pad = 24;
    const proj = d3.geoMercator().fitExtent([[pad, pad], [W - pad, H - pad]], maine);
    this._proj = proj;
    const path = d3.geoPath(proj);
    const svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${H}`)
      .attr('aria-hidden', 'true').attr('focusable', 'false')
      .style('width', '100%').style('height', 'auto').style('display', 'block');

    svg.append('path')
      .datum(maine)
      .attr('d', path)
      .attr('fill', '#E8232F')
      .attr('stroke', '#F2C338')
      .attr('stroke-width', 2);

    this._dotLayer = svg.append('g');
    this.appendChild(svg.node());
    this._applyDot();
  }
});
