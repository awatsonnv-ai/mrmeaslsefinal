// <x-justify> — force-justified wood-type line: distributes letters (or words with mode="words") edge-to-edge
if (!customElements.get('x-justify')) {
  class XJustify extends HTMLElement {
    connectedCallback(){
      this._apply();
      this._mo = new MutationObserver(()=>{
        const cur = this._norm(this.textContent);
        if(cur !== this._plain) this._apply();
      });
      this._mo.observe(this,{childList:true,characterData:true,subtree:true});
    }
    _norm(s){ return s.replace(/[\s\u00a0]+/g,' ').trim(); }
    _apply(){
      if(this._mo) this._mo.disconnect();
      const words = this.getAttribute('mode')==='words';
      const t = this._norm(this.textContent);
      this.innerHTML='';
      this.style.display='flex';
      this.style.justifyContent='space-between';
      // a justified line is display:flex/nowrap, so its min-content width is the
      // whole line; without this it drags every flex ancestor wider than the viewport
      this.style.minWidth='0';
      if(words){ this.style.gap='0.45em'; this.style.flexWrap='wrap'; }
      const units = words ? t.split(' ') : Array.from(t);
      for(const u of units){
        const s = document.createElement('span');
        s.textContent = u===' ' ? '\u00a0' : u;
        this.appendChild(s);
      }
      this._plain = this._norm(this.textContent);
      if(this._mo) this._mo.observe(this,{childList:true,characterData:true,subtree:true});
    }
  }
  customElements.define('x-justify', XJustify);
}
