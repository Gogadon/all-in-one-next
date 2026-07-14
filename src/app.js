import{MODULES,getModule}from'./modules.js';import{todayIso,formatMetric,completedSessions,statistics,esc,shiftPeriod,emptyState,parseNumber,METRICS,weeklyOverview,weekStrip,monthGrid,sessionMetrics}from'./core.js';import{loadStore,getState,subscribe,updateState,replaceState}from'./store.js';import{overview,editorView,detail,newTour,editTour,cancelEdit,setTitle,setNote,setMetric,addOptionalMetric,removeOptionalMetric,saveTour,deleteTour}from'./tours.js';import{view as challengeView,addChallenge,removeChallenge}from'./challenges.js';import{exportJson,importJson}from'./storage.js';import{shareCard,tourShareData,strengthShareData}from'./share.js';import{todayView,planView,historyView,startPlannedSession,newStrength,editStrength,cancelStrength,setStrengthTitle,setStrengthNote,addExercise,removeExercise,addSet,removeSet,toggleWarmup,toggleAssistMode,setSetMetric,saveStrength,deleteStrength,skipCurrentUnit,moveCycle,removeCycleItem,correctToday,openCorrectTodayPicker,closeCorrectTodayPicker,toggleUnitRestDay,completeRestDay,setHistoryMode,setProgressMetric}from'./strength.js';

const app=document.querySelector('#app'),file=document.querySelector('#importFile');
let statType='month',statAnchor=todayIso(),calendarAnchor=todayIso(),selectedDay=null;const openDaySessions=new Set();

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
  </div>${daySheetView()}`
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
      const count=completedSessions(state,'strength').length;meta=count?`${count} ${count===1?'Training':'Trainings'}`:'Noch kein Training';
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

function longDate(iso){
  return new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE',{
    weekday:'long',day:'numeric',month:'long',year:'numeric'
  });
}

function strengthVolume(session){
  let total=0;
  for(const segment of session.segments||[]){
    for(const entry of segment.entries||[]){
      const metrics=entry.metrics||{};
      const weight=Number(metrics.weight??metrics.gewicht??0);
      const reps=Number(metrics.repetitions??metrics.wiederholungen??0);
      if(Number.isFinite(weight)&&Number.isFinite(reps))total+=weight*reps;
    }
  }
  return total;
}

function sessionTitle(session,module){
  return session.title||session.name||
    (session.moduleId==='strength'?'Krafttraining':module?.singular||'Aktivität');
}

function sessionSummary(session,module){
  if(session.moduleId==='strength'){
    const volume=strengthVolume(session);
    const exercises=(session.segments||[]).length;
    const parts=[];
    if(exercises)parts.push(`${exercises} ${exercises===1?'Übung':'Übungen'}`);
    if(volume>0)parts.push(`${Math.round(volume).toLocaleString('de-DE')} kg`);
    return parts.join(' · ');
  }
  const metrics=sessionMetrics(session);
  const preferred=module?.listMetrics||['distance','duration','elevation'];
  return preferred.filter(type=>metrics[type]!=null)
    .map(type=>formatMetric(type,metrics[type])).join(' · ');
}

function metricLabel(type){
  return METRICS[type]?.label||({
    gewicht:'Gewicht',wiederholungen:'Wiederholungen',saetze:'Sätze',
    distanz:'Distanz',dauer:'Dauer',hoehenmeter:'Höhenmeter'
  }[type]||type);
}

function genericMetricValue(type,value){
  if(METRICS[type])return formatMetric(type,value);
  if(type==='gewicht')return `${Number(value).toLocaleString('de-DE')} kg`;
  return Number.isFinite(value)?Number(value).toLocaleString('de-DE'):String(value);
}

function daySessionDetails(session,module){
  if(session.moduleId!=='strength'){
    const metrics=sessionMetrics(session);
    const rows=Object.entries(metrics).map(([type,value])=>`
      <div class="day-detail-row">
        <span>${esc(metricLabel(type))}</span>
        <strong>${esc(genericMetricValue(type,value))}</strong>
      </div>`).join('');
    return `<div class="day-session-details">${rows||'<p class="day-empty-small">Keine Messwerte gespeichert.</p>'}${session.note?`<p class="day-note">${esc(session.note)}</p>`:''}</div>`;
  }

  const segments=(session.segments||[]).map((segment,index)=>{
    const name=segment.name||segment.title||segment.activityName||`Übung ${index+1}`;
    const entries=segment.entries||[];
    const completed=entries.filter(entry=>entry.status!=='skipped');
    const lines=completed.map((entry,entryIndex)=>{
      const metrics=entry.metrics||{};
      const shown=Object.entries(metrics).map(([type,value])=>`${metricLabel(type)}: ${genericMetricValue(type,value)}`).join(' · ');
      return `<div class="day-set"><span>Satz ${entryIndex+1}</span><strong>${esc(shown||'erledigt')}</strong></div>`;
    }).join('');
    return `<div class="day-exercise">
      <div class="day-exercise-title"><span class="calendar-dot" style="--dot:${module?.color||'var(--strength)'}"></span><strong>${esc(name)}</strong></div>
      ${lines||'<small>Keine Satzwerte gespeichert.</small>'}
    </div>`;
  }).join('');

  return `<div class="day-session-details">${segments||'<p class="day-empty-small">Keine Übungen gespeichert.</p>'}${session.note?`<p class="day-note">${esc(session.note)}</p>`:''}</div>`;
}

function daySheetView(){
  if(!selectedDay)return'';
  const state=getState();
  const today=todayIso();
  const sessions=state.sessions
    .filter(session=>session.status==='completed'&&session.date===selectedDay)
    .toSorted((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));

  const face=selectedDay===today?'today':selectedDay>today?'future':'past';
  let badge='';
  if(face==='today')badge='<span class="day-badge today">Heute</span>';
  if(face==='future')badge='<span class="day-badge future">Vorschau</span>';

  const body=sessions.length?sessions.map(session=>{
    const module=getModule(session.moduleId);
    const open=openDaySessions.has(session.id);
    return `<article class="day-session" style="--session-color:${module?.color||'#929BA8'}">
      <button class="day-session-head" data-action="calendar.session" data-id="${session.id}">
        <span class="day-session-title">
          <span class="calendar-dot large" style="--dot:${module?.color||'#929BA8'}"></span>
          <span><strong>${esc(sessionTitle(session,module))}</strong><small>${esc(module?.label||session.moduleId||'Aktivität')}</small></span>
        </span>
        <span class="day-session-right">
          <small>${esc(sessionSummary(session,module))}</small>
          <b class="${open?'open':''}">›</b>
        </span>
      </button>
      ${open?daySessionDetails(session,module):''}
    </article>`;
  }).join(''):`<div class="day-empty">
    <span>${face==='future'?'○':'·'}</span>
    <p>${face==='today'?'Heute noch nichts eingetragen.':face==='future'?'Für diesen Tag ist noch nichts geplant.':'An diesem Tag war nichts eingetragen.'}</p>
  </div>`;

  return `<div class="sheet-backdrop open" data-action="calendar.close"></div>
    <section class="day-sheet open" role="dialog" aria-modal="true">
      <button class="day-sheet-handle" data-action="calendar.close" aria-label="Tagesansicht schließen"><span></span></button>
      <header class="day-sheet-header">
        <div><h2>${esc(longDate(selectedDay))}</h2>${badge}</div>
        <button class="icon" data-action="calendar.close" aria-label="Schließen">×</button>
      </header>
      <div class="day-sheet-body">${body}</div>
    </section>`;
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
 if(m.type==='strength')return`<nav class="bottom">
<button data-action="home">⌂<span>Start</span></button>
<button class="${view==='today'||view==='edit'?'active':''}" data-action="mview" data-view="today">🏋️<span>Heute</span></button>
<button class="${view==='plan'?'active':''}" data-action="mview" data-view="plan">▤<span>Plan</span></button>
<button class="${view==='history'?'active':''}" data-action="mview" data-view="history">◷<span>Verlauf</span></button>
</nav>`;
 if(m.type!=='tour')return`<nav class="bottom"><button data-action="home">⌂<span>Start</span></button><button class="active">${m.icon}<span>${esc(m.label)}</span></button></nav>`;
 return`<nav class="bottom"><button data-action="home">⌂<span>Start</span></button><button class="${view==='overview'?'active':''}" data-action="mview" data-view="overview">${m.icon}<span>Touren</span></button><button class="${view==='statistics'?'active':''}" data-action="mview" data-view="statistics">▥<span>Statistik</span></button></nav>`
}

function render(){
  document.body.classList.toggle('sheet-open',Boolean(selectedDay));
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
  else if(m.type==='strength'){
    if(r.view==='edit'||r.view==='today')c=todayView(getState());
    else if(r.view==='plan')c=planView(getState());
    else if(r.view==='history')c=historyView(getState());
    else c=todayView(getState());
  }
  app.innerHTML=shell(m.label,c,{module:m,back:r.view==='edit'||r.view==='detail',bottom:moduleBottom(m,r.view)})
}

document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el)return;safe(async()=>{
  const a=el.dataset.action,r=route(),m=getModule(r.moduleId);
  if(a==='back')history.back();
  else if(a==='home')nav('/dashboard');
  else if(a==='settings')nav('/settings');
  else if(a==='calendar.open'){calendarAnchor=todayIso();nav('/calendar')}
  else if(a==='calendar.shift'){calendarAnchor=shiftPeriod('month',calendarAnchor,Number(el.dataset.step));render()}
  else if(a==='calendar.day'){selectedDay=el.dataset.date;openDaySessions.clear();render()}
  else if(a==='calendar.close'){selectedDay=null;openDaySessions.clear();render()}
  else if(a==='calendar.session'){openDaySessions.has(el.dataset.id)?openDaySessions.delete(el.dataset.id):openDaySessions.add(el.dataset.id);render()}
  else if(a==='module')nav(`/module/${el.dataset.module}/overview`);
  else if(a==='mview')nav(`/module/${r.moduleId}/${el.dataset.view}`);
  else if(a==='tour.new'){newTour(getState(),m);nav(`/module/${m.id}/edit`)}
  else if(a==='tour.open')nav(`/module/${m.id}/detail/${el.dataset.id}`);
  else if(a==='tour.edit'){const s=getState().sessions.find(x=>x.id===el.dataset.id);editTour(getState(),m,s);nav(`/module/${m.id}/edit`)}
  else if(a==='tour.cancel'){cancelEdit();history.back()}
  else if(a==='tour.save'){await updateState(s=>saveTour(s),{snapshot:true,reason:'before-tour-save'});toast('Gespeichert ✓');nav(`/module/${m.id}/overview`)}
  else if(a==='tour.delete'){if(confirm('Tour wirklich löschen?')){await updateState(s=>deleteTour(s,el.dataset.id),{snapshot:true,reason:'before-delete'});nav(`/module/${m.id}/overview`)}}
  else if(a==='stat.type'){statType=el.dataset.type;render()}
  else if(a==='stat.shift'){statAnchor=shiftPeriod(statType,statAnchor,Number(el.dataset.step));render()}
  else if(a==='tour.metric.add'){await updateState(s=>addOptionalMetric(s,m,el.dataset.type));render()}
  else if(a==='tour.metric.remove'){await updateState(s=>removeOptionalMetric(s,m,el.dataset.type));render()}
  else if(a==='tour.share'){const s=getState().sessions.find(x=>x.id===el.dataset.id);if(!s)throw Error('Tour nicht gefunden.');const r=await shareCard(tourShareData(s,m,m.color,formatDate,sessionMetrics(s)),`${m.share.filename}-${s.date}.png`);if(r==='heruntergeladen')toast('Bild gespeichert ✓')}
  else if(a==='strength.new'){newStrength();nav('/module/strength/edit')}
  else if(a==='strength.planned.start'){startPlannedSession(getState(),el.dataset.id);nav('/module/strength/edit')}
  else if(a==='strength.skip'){await updateState(state=>skipCurrentUnit(state),{snapshot:true,reason:'before-cycle-skip'});toast('Einheit übersprungen ✓');render()}
  else if(a==='strength.open')nav(`/module/strength/detail/${el.dataset.id}`)
  else if(a==='strength.edit'){const s=getState().sessions.find(x=>x.id===el.dataset.id);if(!s)throw Error('Training nicht gefunden.');editStrength(s);nav('/module/strength/edit')}
  else if(a==='strength.cancel'){cancelStrength();history.back()}
  else if(a==='strength.exercise.add'){const id=document.querySelector('#strengthExercise')?.value;if(!id)throw Error('Wähle eine Übung aus.');addExercise(getState(),id);render()}
  else if(a==='strength.exercise.remove'){removeExercise(el.dataset.segment);render()}
  else if(a==='strength.set.add'){addSet(el.dataset.segment);render()}
  else if(a==='strength.set.remove'){removeSet(el.dataset.segment,el.dataset.set);render()}
  else if(a==='strength.warmup'){toggleWarmup(el.dataset.segment,el.dataset.set);render()}
  else if(a==='strength.assist.toggle'){toggleAssistMode(el.dataset.segment);render()}
  else if(a==='strength.progress.metric'){setProgressMetric(el.dataset.metric);render()}
  else if(a==='strength.progress.toggle'){toggleProgress(el.dataset.id);render()}
  else if(a==='strength.save'){await updateState(s=>saveStrength(s),{snapshot:true,reason:'before-strength-save'});toast('Training gespeichert ✓');nav('/module/strength/overview')}
  else if(a==='strength.delete'){if(confirm('Training wirklich löschen?')){await updateState(s=>deleteStrength(s,el.dataset.id),{snapshot:true,reason:'before-strength-delete'});nav('/module/strength/overview')}}
  else if(a==='strength.share'){const s=getState().sessions.find(x=>x.id===el.dataset.id);if(!s)throw Error('Training nicht gefunden.');const r=await shareCard(strengthShareData(s,getModule('strength').color,formatDate),`all-in-one-training-${s.date}.png`);if(r==='heruntergeladen')toast('Bild gespeichert ✓')}
  else if(a==='history.mode'){setHistoryMode(el.dataset.mode);render()}
  else if(a==='progress.metric'){setProgressMetric(el.dataset.metric);render()}
  else if(a==='plan.up'){await updateState(state=>moveCycle(state,Number(el.dataset.index),-1));render()}
  else if(a==='plan.down'){await updateState(state=>moveCycle(state,Number(el.dataset.index),1));render()}
  else if(a==='plan.remove'){await updateState(state=>removeCycleItem(state,Number(el.dataset.index)),{snapshot:true,reason:'before-cycle-remove'});render()}
  else if(a==='plan.correct-today'){openCorrectTodayPicker();render()}
  else if(a==='plan.correct.close'){closeCorrectTodayPicker();render()}
  else if(a==='plan.correct.select'){await updateState(state=>correctToday(state,Number(el.dataset.index)),{snapshot:true,reason:'before-correct-today'});toast('Heutige Zyklusposition korrigiert ✓');render()}
  else if(a==='plan.unit.rest'){await updateState(state=>toggleUnitRestDay(state,el.dataset.id));render()}
  else if(a==='strength.rest.complete'){await updateState(state=>completeRestDay(state,el.dataset.id));toast('Rest Day als erledigt markiert ✓');render()}
  else if(a==='plan.add-cycle'||a==='plan.unit.new'||a==='plan.unit.edit'||a==='plan.unit.delete'||a==='library.open'){toast('Editor folgt in der nächsten Plan-Etappe.')}
  else if(a==='challenge.add'){const type=document.querySelector('#challengeType').value,target=parseNumber(document.querySelector('#challengeTarget').value),period=document.querySelector('#challengePeriod').value;if(!target||target<=0)throw Error('Gültigen Zielwert eintragen.');await updateState(s=>addChallenge(s,{type,target,period}))}
  else if(a==='challenge.delete')await updateState(s=>removeChallenge(s,el.dataset.id));
  else if(a==='backup.export'){const blob=new Blob([exportJson(getState())],{type:'application/json'}),url=URL.createObjectURL(blob),x=document.createElement('a');x.href=url;x.download=`all-in-one-next-${todayIso()}.json`;x.click();URL.revokeObjectURL(url)}
  else if(a==='backup.import')file.click();
  else if(a==='reset'){if(confirm('Wirklich alle Daten löschen?')){await replaceState(emptyState());nav('/dashboard')}}
})});

document.addEventListener('change',e=>{const el=e.target.closest('[data-change]');if(!el)return;const m=getModule(route().moduleId);if(el.dataset.change==='tour.title')setTitle(el.value);if(el.dataset.change==='tour.note')setNote(el.value);if(el.dataset.change==='tour.metric')setMetric(m,el.dataset.type,el.value);if(el.dataset.change==='strength.title')setStrengthTitle(el.value);if(el.dataset.change==='strength.note')setStrengthNote(el.value);if(el.dataset.change==='strength.metric')setSetMetric(el.dataset.segment,el.dataset.set,el.dataset.type,el.value)});
file.addEventListener('change',()=>safe(async()=>{const f=file.files?.[0];if(!f)return;await replaceState(importJson(await f.text()));file.value='';toast('Backup importiert ✓');nav('/dashboard')}));
window.addEventListener('hashchange',render);subscribe(render);await loadStore();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(console.warn);render();

let sheetDragStart=null,sheetDragDistance=0;
document.addEventListener('touchstart',event=>{const h=event.target.closest('.day-sheet-handle');if(!h)return;sheetDragStart=event.touches[0].clientY;sheetDragDistance=0},{passive:true});
document.addEventListener('touchmove',event=>{if(sheetDragStart==null)return;sheetDragDistance=Math.max(0,event.touches[0].clientY-sheetDragStart);const sheet=document.querySelector('.day-sheet');if(sheet)sheet.style.transform=`translate(-50%,${Math.min(sheetDragDistance,180)}px)`},{passive:true});
document.addEventListener('touchend',()=>{if(sheetDragStart==null)return;const sheet=document.querySelector('.day-sheet');if(sheetDragDistance>65){selectedDay=null;openDaySessions.clear();render()}else if(sheet){sheet.style.transform=''}sheetDragStart=null;sheetDragDistance=0},{passive:true});
