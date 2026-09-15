// <senate-tracker-map> — d3 US map for the vaccine EO lookup.
//
// Display only. The ZIP form drives the highlight, so there is no click, hover
// or cursor affordance here and nothing is focusable: the state is set through
// the `selectedstate` attribute (a full state name, e.g. "TEXAS") and the
// elected-official cards beside the map carry the same information as text.
// The svg is hidden from assistive tech for that reason.
//
// geoAlbersUsa covers the 50 states and DC. Puerto Rico and the territories are
// present in the topology but project to nothing, so a ZIP there simply leaves
// the map in its neutral state — which is the intended behaviour, not a bug.
//
// Requires d3 + topojson loaded globally (already loaded for the outbreak map).
customElements.define('senate-tracker-map', class extends HTMLElement {
  static get observedAttributes(){ return ['selectedstate']; }
  attributeChangedCallback(){ this._applySelection(); }
  _nameUpper(d){ return String(d.properties.name).toUpperCase(); }
  _applySelection(){
    if(!this._paths) return;
    const sel = (this.getAttribute('selectedstate') || '').trim().toUpperCase();
    const on = d => sel !== '' && this._nameUpper(d) === sel;
    this._paths
      .attr('fill', d => on(d) ? '#E8232F' : '#3a3a3a')
      .attr('stroke', d => on(d) ? '#F2C338' : '#000000')
      .attr('stroke-width', d => on(d) ? 2 : 1);
  }
  async connectedCallback(){
    if(this._did) return; this._did = true;
    await new Promise(r=>{ const t=setInterval(()=>{ if(window.d3 && window.topojson){ clearInterval(t); r(); } }, 40); });

    const topo = await fetch('data/states-10m.json').then(r=>r.json());
    const states = topojson.feature(topo, topo.objects.states);
    const W=960, H=600;
    const proj = d3.geoAlbersUsa().fitSize([W,H], states);
    const path = d3.geoPath(proj);
    const svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${H}`)
      .attr('aria-hidden', 'true').attr('focusable', 'false')
      .style('width','100%').style('height','auto').style('display','block');

    svg.selectAll('path').data(states.features).join('path')
      .attr('d', path)
      .attr('fill', '#3a3a3a')
      .attr('stroke', '#000000').attr('stroke-width', 1);

    this._paths = svg.selectAll('path');
    this._applySelection();
    this.appendChild(svg.node());
  }
});
