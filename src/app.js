import{MODULES,getModule}from'./modules.js';import{todayIso,formatMetric,completedSessions,statistics,esc,shiftPeriod,emptyState,parseNumber,METRICS,weeklyOverview,weekStrip,monthGrid,sessionMetrics}from'./core.js';import{loadStore,getState,subscribe,updateState,replaceState}from'./store.js';import{overview,editorView,detail,newTour,editTour,cancelEdit,setTitle,setMetric,saveTour,deleteTour}from'./tours.js';import{view as challengeView,addChallenge,removeChallenge}from'./challenges.js';import{exportJson,importJson}from'./storage.js';

const app=document.querySelector('#app'),file=document.querySelector('#importFile');
let statType='month',statAnchor=todayIso(),calendarAnchor=todayIso();

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

function moduleDot(moduleId){
  const module=getModule(moduleId);
  return module?`<span class="calendar-dot" style="--dot:${module.color}" title="${esc(module.label)}"></span>`:'';
}

function dashboard(){
  const state=getState();
  const cards=MODULES.map(m=>{
    const sessions=m.type==='tour'?completedSessions(state,m.id):[];
    let meta='';
    if(m.type==='tour'){
      const distance=sessions.reduce((sum,s)=>sum+(sessionMetrics(s).distance||0),0);
      meta=sessions.length?`${sessions.length} ${m.plural} · ${formatMetric('distance',distance)}`:`Noch keine ${m.singular}`;
    }else if(m.type==='challenge'){
      const open=state.challenges.length;
      meta=open?`${open} ${open===1?'Ziel':'Ziele'} aktiv`:'Keine Ziele';
    }else{
      meta='Kraft-Engine vorbereitet';
    }
    return`<button class="dashboard-module" style="--module:${m.color}" data-action="module" data-module="${m.id}">
      <span class="dashboard-module__top"><span>${m.icon}</span><b>${esc(m.label)}</b></span>
      <small>${esc(meta)}</small>
    </button>`
  }).join('');

  const week=weeklyOverview(state);
  const weekRows=week.moduleRows.map(row=>{
    const module=getModule(row.moduleId);
    if(!module)return'';
    let metric='';
    if(row.moduleId==='cycling'||row.moduleId==='hiking')metric=formatMetric('distance',row.metrics.distance||0);
    else metric=`${row.count} ${row.count===1?'Einheit':'Einheiten'}`;
    return`<div class="week-module" style="--module:${module.color}">
      <strong>${esc(module.label)}</strong>
      <span><b>${row.count}</b> ${module.type==='tour'?(row.count===1?'Tour':'Touren'):'Aktivitäten'} · <b>${esc(metric)}</b></span>
    </div>`
  }).join('');

  const days=weekStrip(state).map(day=>`<button class="week-day ${day.isToday?'today':''} ${day.isFuture?'future':''}" data-action="calendar.day" data-date="${day.iso}">
    <span>${day.label}</span><b>${day.day}</b><i>${day.modules.map(moduleDot).join('')}</i>
  </button>`).join('');

  return`<section class="dashboard-title">
    <div><span class="eyebrow"><span class="title-dot"></span>All-in-One</span><h1>Start</h1></div>
  </section>
  <section class="dashboard-modules">${cards}</section>
  <p class="section-label">Diese Woche</p>
  <section class="week-card">
    <div class="week-head">
      <div><b>${week.activities}</b><span>Aktivitäten</span></div>
      <div><b>${week.activeDays}</b><span>aktive Tage</span></div>
    </div>
    <div class="week-modules">${weekRows||'<p class="week-empty">Diese Woche noch nichts eingetragen.</p>'}</div>
  </section>
  <p class="section-label">Kalender</p>
  <section class="calendar-strip">
    <div class="calendar-week">${days}</div>
    <button class="calendar-open" data-action="calendar.open" aria-label="Monatskalender öffnen">›</button>
  </section>`
}

function calendarView(){
  const grid=monthGrid(getState(),calendarAnchor);
  const cells=grid.cells.map(day=>`<button class="month-cell ${day.inMonth?'':'outside'} ${day.isToday?'today':''} ${day.isFuture?'future':''}" data-action="calendar.day" data-date="${day.iso}">
    <b>${day.day}</b><i>${day.modules.map(moduleDot).join('')}</i>
  </button>`).join('');
  return`<section class="calendar-page">
    <div class="calendar-nav">
      <button class="icon" data-action="calendar.shift" data-step="-1">←</button>
      <h2>${esc(grid.label)}</h2>
      <button class="icon" data-action="calendar.shift" data-step="1">→</button>
    </div>
    <div class="month-weekdays">${['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="month-grid">${cells}</div>
    <div class="calendar-legend">
      ${MODULES.filter(m=>m.type!=='challenge').map(m=>`<span>${moduleDot(m.id)}${esc(m.label)}</span>`).join('')}
    </div>
  </section>`
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
  if(r.section==='calendar'){app.innerHTML=shell('Kalender',calendarView(),{back:true});return}
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
  else if(a==='calendar.open'){calendarAnchor=todayIso();nav('/calendar')}
  else if(a==='calendar.shift'){calendarAnchor=shiftPeriod('month',calendarAnchor,Number(el.dataset.step));render()}
  else if(a==='calendar.day'){toast(new Date(el.dataset.date+'T00:00:00').toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}
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
