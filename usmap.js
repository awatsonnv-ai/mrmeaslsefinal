// <us-measles-map> — d3 choropleth of US states (requires d3 + topojson loaded globally)
customElements.define('us-measles-map', class extends HTMLElement {
  static get observedAttributes(){ return ['smiley']; }
  attributeChangedCallback(){ if(this._smiley) this._smiley.setAttribute('display', this.getAttribute('smiley')==='no' ? 'none' : ''); }
  async connectedCallback(){
    if(this._did) return; this._did = true;
    await new Promise(r=>{ const t=setInterval(()=>{ if(window.d3 && window.topojson){ clearInterval(t); r(); } }, 40); });
    const topo = await (await fetch('data/states-10m.json')).json();
    const states = topojson.feature(topo, topo.objects.states);
    const W=960, H=600;
    const proj = d3.geoAlbersUsa().fitSize([W,H], states);
    const path = d3.geoPath(proj);
    const RED = new Set(['North Dakota','Utah','Arizona','Texas','Florida']);
    const NONE = new Set(['Alaska','Nevada','Wyoming','Kansas','Iowa','Arkansas','Mississippi','Alabama','Indiana','West Virginia','New Hampshire','Vermont','Delaware']);
    const fill = n => n==='South Carolina' ? '#F2C338' : RED.has(n) ? '#E8232F' : NONE.has(n) ? '#141414' : '#E17E8D';
    const svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${H}`)
      .style('width','100%').style('height','auto').style('display','block');
    svg.selectAll('path').data(states.features).join('path')
      .attr('d', path).attr('fill', d=>fill(d.properties.name))
      .attr('stroke','#ffffff').attr('stroke-width',1);
    const sc = states.features.find(d=>d.properties.name==='South Carolina');
    if(sc){
      const [cx,cy] = path.centroid(sc);
      const g = svg.append('g').attr('transform',`translate(${cx},${cy})`);
      g.append('circle').attr('r',34).attr('fill','#F2C338').attr('stroke','#111').attr('stroke-width',2);
      for(let i=0;i<16;i++){
        const a = i*2.399, r = 10 + ((i*53)%20);
        g.append('circle').attr('cx', Math.cos(a)*r).attr('cy', Math.sin(a)*r)
          .attr('r', 1.6 + (i%3)).attr('fill','#D71F26');
      }
      g.append('circle').attr('cx',-11).attr('cy',-7).attr('r',5).attr('fill','#111');
      g.append('circle').attr('cx',11).attr('cy',-7).attr('r',5).attr('fill','#111');
      g.append('path').attr('d','M -15 9 Q 0 22 15 9').attr('stroke','#111').attr('stroke-width',4.5)
        .attr('fill','none').attr('stroke-linecap','round');
      this._smiley = g.node();
      if(this.getAttribute('smiley')==='no') this._smiley.setAttribute('display','none');
    }
    this.appendChild(svg.node());
  }
});
