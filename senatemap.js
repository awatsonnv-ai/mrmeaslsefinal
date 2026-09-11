// <senate-tracker-map> — clickable d3 US map for the vaccine EO senate tracker.
// Neutral gray states, yellow on hover, red for the currently selected state
// (mirrors the state dropdown it sits in for — picking a state here fires the
// same "senate-map-pick" event the page listens for to update selectedState).
// Requires d3 + topojson loaded globally (already loaded for the outbreak map).
customElements.define('senate-tracker-map', class extends HTMLElement {
  static get observedAttributes(){ return ['selectedstate']; }
  attributeChangedCallback(){ this._applySelection(); }
  _applySelection(){
    if(!this._paths) return;
    const sel = (this.getAttribute('selectedstate') || '').toUpperCase();
    this._paths.attr('fill', d => this._nameUpper(d) === sel ? '#E8232F' : (this._hasSenators(d) ? '#3a3a3a' : '#1c1c1c'))
      .attr('stroke', d => this._nameUpper(d) === sel ? '#F2C338' : '#000000')
      .attr('stroke-width', d => this._nameUpper(d) === sel ? 2 : 1);
  }
  _nameUpper(d){ return String(d.properties.name).toUpperCase(); }
  _hasSenators(d){ return this._validNames.has(this._nameUpper(d)); }
  async connectedCallback(){
    if(this._did) return; this._did = true;
    await new Promise(r=>{ const t=setInterval(()=>{ if(window.d3 && window.topojson){ clearInterval(t); r(); } }, 40); });

    const [topo, senatorData] = await Promise.all([
      fetch('data/states-10m.json').then(r=>r.json()),
      fetch('data/eo-tracker-senators.json').then(r=>r.json()).catch(()=>null)
    ]);

    this._validNames = new Set();
    if(senatorData){
      for(const code of Object.keys(senatorData.states)){
        const st = senatorData.states[code];
        if(st.senators && st.senators.length) this._validNames.add(String(st.stateName).toUpperCase());
      }
    }

    const states = topojson.feature(topo, topo.objects.states);
    const W=960, H=600;
    const proj = d3.geoAlbersUsa().fitSize([W,H], states);
    const path = d3.geoPath(proj);
    const svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${H}`)
      .style('width','100%').style('height','auto').style('display','block');

    const host = this;
    this._paths = svg.selectAll('path').data(states.features).join('path')
      .attr('d', path)
      .attr('fill', '#3a3a3a')
      .attr('stroke', '#000000').attr('stroke-width', 1)
      .style('cursor', d => host._hasSenators(d) ? 'pointer' : 'default')
      .on('mouseenter', function(_ev, d){
        if(!host._hasSenators(d)) return;
        const sel = (host.getAttribute('selectedstate') || '').toUpperCase();
        if(host._nameUpper(d) === sel) return;
        d3.select(this).attr('fill', '#F2C338');
      })
      .on('mouseleave', function(_ev, d){
        const sel = (host.getAttribute('selectedstate') || '').toUpperCase();
        if(host._nameUpper(d) === sel) return;
        d3.select(this).attr('fill', host._hasSenators(d) ? '#3a3a3a' : '#1c1c1c');
      })
      .on('click', (_ev, d) => {
        if(!host._hasSenators(d)) return;
        host.dispatchEvent(new CustomEvent('senate-map-pick', {
          bubbles: true,
          detail: { state: host._nameUpper(d) }
        }));
      })
      .append('title').text(d => d.properties.name);

    this._paths = svg.selectAll('path');
    this._applySelection();
    this.appendChild(svg.node());
  }
});
