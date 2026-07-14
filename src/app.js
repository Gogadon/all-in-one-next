import{MODULES,getModule}from'./modules.js';import{todayIso,formatMetric,completedSessions,statistics,esc,shiftPeriod,emptyState,parseNumber,METRICS}from'./core.js';import{loadStore,getState,subscribe,updateState,replaceState}from'./store.js';import{overview,editorView,detail,newTour,editTour,cancelEdit,setTitle,setMetric,saveTour,deleteTour}from'./tours.js';import{view as challengeView,addChallenge,removeChallenge}from'./challenges.js';import{exportJson,importJson}from'./storage.js';

const app=document.querySelector('#app'),file=document.querySelector('#importFile');
let statType='month',statAnchor=todayIso();

const route=()=>{const p=(location.hash.slice(1)||'/dashboard').split('/').filter(Boolean);return{section:p[0]||'dashboard',moduleId:p[0]==='module'?p[1]:null,view:p[0]==='module'?(p[2]||'overview'):null,id:p[3]||null}};
const nav=p=>location.hash=p.startsWith('/')?p:'/'+p;
const toast=m=>{document.querySelector('.toast')?.remove();const e=document.createElement('div');e.className='toast';e.textContent=m;document.body.append(e);setTimeout(()=>e.remove(),3200)};
const safe=async f=>{try{await f()}catch(e){console.error(e);toast(e.message||String(e))}};

function shell(title,content,{module=null,back=false,bottom='',dashboard=false}={}){
  const accent=module?.color||'#F6F8FA';
  const left=dashboard?'':back
    ?'<button class="icon" data-action="back" aria-label="Zurück">←</button>'
    :'<button class="icon home-icon" data-action="home" aria-label="Zum Dashboard">⌂</button>';
  return`<div class="shell ${module?`module-${module.id}`:''}" style="--accent:${accent}">
    <header class="topbar">
      <div class="topbar-side">${left}</div>
      <strong>${esc(title)}</strong>
      <div class="topbar-side right"><button class="icon" data-action="settings" aria-label="Einstellungen">⚙</button></div>
    </header>
    <main class="content">${content}</main>${bottom}
  </div>`
}

function dashboard(){
  const cards=MODULES.map(m=>{
    const sessions=m.type==='tour'?completedSessions(getState(),m.id):[];
    let value='',meta='';
    if(m.type==='tour'){
      const distance=sessions.reduce((sum,s)=>sum+(s.segments?.[0]?.entries?.[0]?.metrics?.distance||0),0);
      value=sessions.length?`${sessions.length}`:'–';
      meta=sessions.length?`${m.plural} · ${formatMetric('distance',distance)}`:`Noch keine ${m.plural}`;
    }else if(m.type==='challenge'){
      value=String(getState().challenges.length||'–');
      meta=getState().challenges.length?'aktive Ziele':'Noch keine Ziele';
    }else{
      value='•';
      meta='Engine vorbereitet';
    }
    return`<button class="module-tile" style="--m:${m.color}" data-action="module" data-module="${m.id}">
      <span class="module-tile__icon">${m.icon}</span>
      <span class="module-tile__copy"><b>${esc(m.label)}</b><small>${esc(meta)}</small></span>
      <span class="module-tile__value">${esc(value)}</span>
    </button>`
  }).join('');
  const d=new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
  const total=completedSessions(getState()).length;
  return`<section class="dashboard-head">
    <div>
      <span class="eyebrow">All-in-One Next</span>
      <h1>Deine Aktivitäten.</h1>
      <p>${esc(d)}</p>
    </div>
    <div class="dashboard-orbit"><span>${total}</span><small>gesamt</small></div>
  </section>
  <section class="dashboard-summary">
    <span>Heute</span><strong>Was möchtest du öffnen?</strong>
  </section>
  <div class="module-grid">${cards}</div>`
}

function statsView(m){
  const r=statistics(getState(),m.id,statType,statAnchor);
  const items=Object.entries(r.metrics).length
    ?Object.entries(r.metrics).map(([t,v])=>`<div class="stat-card"><small>${esc(METRICS[t]?.label||t)}</small><div class="big">${esc(formatMetric(t,v))}</div></div>`).join('')
    :'<div class="card empty stat-empty">Keine Daten in diesem Zeitraum.</div>';
  return`<section class="module-hero">
    <div class="module-hero__icon">${m.icon}</div>
    <div><span class="eyebrow">${esc(m.label)}</span><h1>Statistik</h1><p>${esc(statAnchor)}</p></div>
  </section>
  <div class="periods">${[['week','Woche'],['month','Monat'],['year','Jahr']].map(([x,l])=>`<button class="${x===statType?'active':''}" data-action="stat.type" data-type="${x}">${l}</button>`).join('')}</div>
  <div class="period-nav top"><button class="button compact" data-action="stat.shift" data-step="-1">←</button><span>Zeitraum wechseln</span><button class="button compact" data-action="stat.shift" data-step="1">→</button></div>
  <div class="stats top">${items}</div>`
}

function settings(){
  return`<section class="module-hero neutral"><div class="module-hero__icon">⚙</div><div><span class="eyebrow">App</span><h1>Einstellungen</h1><p>Daten und Sicherungen</p></div></section>
  <div class="settings">
    <button class="button" data-action="backup.export">Backup exportieren</button>
    <button class="button" data-action="backup.import">Backup importieren</button>
    <button class="button danger" data-action="reset">Alle Daten löschen</button>
  </div>`
}

function moduleBottom(m,view){
  if(m.type!=='tour')return`<nav class="bottom"><button data-action="home">⌂<span>Start</span></button><button class="active">${m.icon}<span>${esc(m.label)}</span></button></nav>`;
  return`<nav class="bottom">
    <button data-action="home">⌂<span>Start</span></button>
    <button class="${view==='overview'?'active':''}" data-action="mview" data-view="overview">${m.icon}<span>Touren</span></button>
    <button class="${view==='statistics'?'active':''}" data-action="mview" data-view="statistics">▥<span>Statistik</span></button>
  </nav>`
}

function render(){
  const r=route();
  if(r.section==='dashboard'){app.innerHTML=shell('All-in-One',dashboard(),{dashboard:true});return}
  if(r.section==='settings'){app.innerHTML=shell('Einstellungen',settings(),{back:true});return}
  const m=getModule(r.moduleId);if(!m){nav('/dashboard');return}
  let c='';
  if(m.type==='tour'){
    if(r.view==='edit')c=editorView(m);
    else if(r.view==='detail')c=detail(getState(),m,r.id);
    else if(r.view==='statistics')c=statsView(m);
    else c=overview(getState(),m);
  }else if(m.type==='challenge')c=challengeView(getState(),todayIso());
  else c=`<section class="module-hero"><div class="module-hero__icon">${m.icon}</div><div><span class="eyebrow">Kraft</span><h1>Kraftmodul</h1><p>Das nächste große Modul</p></div></section><div class="card feature-card"><span class="feature-card__mark">01</span><div><h2>Fundament steht</h2><p>Übungen, Sätze, Plan, Zyklus und Progression werden hier als eigene Engine ergänzt.</p></div></div>`;
  app.innerHTML=shell(m.label,c,{module:m,back:r.view==='edit'||r.view==='detail',bottom:moduleBottom(m,r.view)})
}

document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el)return;safe(async()=>{
  const a=el.dataset.action,r=route(),m=getModule(r.moduleId);
  if(a==='back')history.back();
  else if(a==='home')nav('/dashboard');
  else if(a==='settings')nav('/settings');
  else if(a==='module')nav(`/module/${el.dataset.module}/overview`);
  else if(a==='mview')nav(`/module/${r.moduleId}/${el.dataset.view}`);
  else if(a==='tour.new'){newTour(m);nav(`/module/${m.id}/edit`)}
  else if(a==='tour.open')nav(`/module/${m.id}/detail/${el.dataset.id}`);
  else if(a==='tour.edit'){const s=getState().sessions.find(x=>x.id===el.dataset.id);editTour(s);nav(`/module/${m.id}/edit`)}
  else if(a==='tour.cancel'){cancelEdit();history.back()}
  else if(a==='tour.save'){await updateState(s=>saveTour(s),{snapshot:true,reason:'before-tour-save'});toast('Gespeichert ✓');nav(`/module/${m.id}/overview`)}
  else if(a==='tour.delete'){if(confirm('Tour wirklich löschen?')){await updateState(s=>deleteTour(s,el.dataset.id),{snapshot:true,reason:'before-delete'});nav(`/module/${m.id}/overview`)}}
  else if(a==='stat.type'){statType=el.dataset.type;render()}
  else if(a==='stat.shift'){statAnchor=shiftPeriod(statType,statAnchor,Number(el.dataset.step));render()}
  else if(a==='challenge.add'){const type=document.querySelector('#challengeType').value,target=parseNumber(document.querySelector('#challengeTarget').value),period=document.querySelector('#challengePeriod').value;if(!target||target<=0)throw Error('Gültigen Zielwert eintragen.');await updateState(s=>addChallenge(s,{type,target,period}))}
  else if(a==='challenge.delete')await updateState(s=>removeChallenge(s,el.dataset.id));
  else if(a==='backup.export'){const blob=new Blob([exportJson(getState())],{type:'application/json'}),url=URL.createObjectURL(blob),x=document.createElement('a');x.href=url;x.download=`all-in-one-next-${todayIso()}.json`;x.click();URL.revokeObjectURL(url)}
  else if(a==='backup.import')file.click();
  else if(a==='reset'){if(confirm('Wirklich alle Daten löschen?')){await replaceState(emptyState());nav('/dashboard')}}
})});

document.addEventListener('change',e=>{const el=e.target.closest('[data-change]');if(!el)return;const m=getModule(route().moduleId);if(el.dataset.change==='tour.title')setTitle(el.value);if(el.dataset.change==='tour.metric')setMetric(m,el.dataset.type,el.value)});
file.addEventListener('change',()=>safe(async()=>{const f=file.files?.[0];if(!f)return;await replaceState(importJson(await f.text()));file.value='';toast('Backup importiert ✓');nav('/dashboard')}));
window.addEventListener('hashchange',render);subscribe(render);await loadStore();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(console.warn);render();
