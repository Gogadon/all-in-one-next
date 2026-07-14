import{id,todayIso,completedSessions,formatDate,formatNumber,parseNumber,esc,sessionMetrics,METRICS}from'./core.js';
import{lineChart,barChart,trend}from'./charts.js';

let editor=null;
let historyMode='history';
let progressMetric='top';
const expandedProgress=new Set();

const clone=value=>structuredClone(value);
export const currentStrengthEditor=()=>editor;

const strengthPlan=state=>state.plans.find(plan=>plan.moduleId==='strength')??null;
const strengthActivities=state=>state.activities.filter(activity=>activity.moduleId==='strength'&&!activity.archived);
const activityFor=(state,id)=>state.activities.find(activity=>activity.id===id)??null;
const planUnitById=(plan,id)=>plan?.legacyData?.einheiten?.find(unit=>unit.id===id)??null;
const cycle=(plan)=>plan?.legacyData?.zyklus??[];
const anchor=(plan)=>plan?.legacyData?.anker??null;

function normalizeLegacyPlan(plan){
  if(!plan)return null;
  plan.legacyData??={};
  plan.legacyData.einheiten??=[];
  plan.legacyData.zyklus??=[];
  plan.legacyData.position??=0;
  return plan;
}

function isRestUnit(unit){
  const text=`${unit?.name??''}`.toLowerCase();
  return text.includes('rest')||text.includes('ruhe')||text.includes('regeneration');
}

function cycleIndexForDate(plan,date=todayIso()){
  const items=cycle(plan);
  if(!items.length)return 0;
  const a=anchor(plan);
  if(a?.datum&&Number.isInteger(a.index)){
    const start=new Date(`${a.datum}T12:00:00Z`);
    const target=new Date(`${date}T12:00:00Z`);
    const days=Math.floor((target-start)/86400000);
    return((a.index+days)%items.length+items.length)%items.length;
  }
  return Math.max(0,Math.min(items.length-1,plan.legacyData.position??0));
}

function nextExecutableIndex(plan,startIndex,{skipCurrentRest=true}={}){
  const items=cycle(plan);
  if(!items.length)return null;
  for(let offset=0;offset<items.length;offset++){
    const index=(startIndex+offset)%items.length;
    const unit=planUnitById(plan,items[index]?.einheitId??items[index]?.unitId??items[index]);
    if(!unit)continue;
    if(skipCurrentRest&&isRestUnit(unit))continue;
    return index;
  }
  return null;
}

export function currentCycleUnit(state,date=todayIso()){
  const plan=normalizeLegacyPlan(strengthPlan(state));
  if(!plan)return null;
  const index=cycleIndexForDate(plan,date);
  const item=cycle(plan)[index];
  const unit=planUnitById(plan,item?.einheitId??item?.unitId??item);
  return unit?{plan,index,item,unit}:null;
}

export function nextTrainingUnit(state,date=todayIso()){
  const current=currentCycleUnit(state,date);
  if(!current)return null;
  if(!isRestUnit(current.unit))return current;
  const index=nextExecutableIndex(current.plan,current.index+1);
  if(index==null)return null;
  const item=cycle(current.plan)[index];
  const unit=planUnitById(current.plan,item?.einheitId??item?.unitId??item);
  return{plan:current.plan,index,item,unit,autoSkippedRest:true};
}

function advanceAnchor(plan,index,date=todayIso()){
  plan.legacyData.anker={datum:date,index};
  plan.legacyData.position=index;
}

export function skipCurrentUnit(state){
  const current=currentCycleUnit(state);
  if(!current)throw Error('Keine Einheit im Zyklus.');
  const items=cycle(current.plan);
  let index=(current.index+1)%items.length;
  const visited=new Set();
  while(!visited.has(index)){
    visited.add(index);
    const unit=planUnitById(current.plan,items[index]?.einheitId??items[index]?.unitId??items[index]);
    if(unit&&!isRestUnit(unit))break;
    index=(index+1)%items.length;
  }
  advanceAnchor(current.plan,index);
  return index;
}

function activitySettings(activity){return activity?.settings??{}}
const isStrengthActivity=activity=>activity?.legacyCategory==='kraft'||activity?.settings?.prog||activity?.metrics?.includes('weight')||activity?.metrics?.includes('repetitions');
const isCardioActivity=activity=>!isStrengthActivity(activity);

function entryTemplateForActivity(activity){
  return{id:id('entry'),metrics:{},flags:[],source:'manual',status:'completed'};
}

function segmentFromActivity(state,activityId){
  const activity=activityFor(state,activityId);
  if(!activity)throw Error('Übung nicht gefunden.');
  return{id:id('segment'),activityId:activity.id,name:activity.name,title:activity.name,status:'completed',
    mode:activity.settings?.assist?'assisted':'external',entries:[entryTemplateForActivity(activity)]};
}

function unitSegments(state,unit){
  return(unit.segmente??unit.uebungen??[]).map(ref=>{
    const activityId=ref.aktivitaetId??ref.activityId??ref.id??ref;
    const segment=segmentFromActivity(state,activityId);
    if(ref.altOf)segment.altOf=ref.altOf;
    return segment;
  });
}

export function startPlannedSession(state,unitId){
  const plan=normalizeLegacyPlan(strengthPlan(state));
  const unit=planUnitById(plan,unitId);
  if(!unit)throw Error('Einheit nicht gefunden.');
  editor={mode:'create',plannedUnitId:unit.id,draft:{
    id:id('session'),moduleId:'strength',date:todayIso(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    status:'draft',title:unit.name,note:'',segments:unitSegments(state,unit)
  }};
}

export function newStrength(){
  editor={mode:'create',plannedUnitId:null,draft:{
    id:id('session'),moduleId:'strength',date:todayIso(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    status:'draft',title:'Freie Session',note:'',segments:[]
  }};
}

export const editStrength=session=>editor={mode:'edit',plannedUnitId:session.legacy?.planUnitId??null,draft:clone(session)};
export const cancelStrength=()=>editor=null;
export const setStrengthTitle=value=>{if(editor)editor.draft.title=value};
export const setStrengthNote=value=>{if(editor)editor.draft.note=value};

function previousSegments(state,activityId,date){
  const rows=[];
  for(const session of state.sessions){
    if(session.moduleId!=='strength'||session.status!=='completed'||session.date>=date)continue;
    for(const segment of session.segments??[])if(segment.activityId===activityId)rows.push({date:session.date,segment});
  }
  return rows.toSorted((a,b)=>b.date.localeCompare(a.date));
}

function prefillEntry(state,activity,date=todayIso()){
  const previous=previousSegments(state,activity.id,date)[0]?.segment?.entries?.find(entry=>!entry.flags?.includes('warmup'));
  if(!previous)return entryTemplateForActivity(activity);
  return{id:id('entry'),metrics:{...(previous.metrics??{})},flags:[],source:'prefill',status:'completed'};
}

export function addExercise(state,activityId){
  const activity=activityFor(state,activityId);
  if(!editor||!activity)throw Error('Übung nicht gefunden.');
  const segment=segmentFromActivity(state,activityId);
  segment.entries=[prefillEntry(state,activity,editor.draft.date)];
  editor.draft.segments.push(segment);
}

export const removeExercise=segmentId=>{if(editor)editor.draft.segments=editor.draft.segments.filter(segment=>segment.id!==segmentId)};

export function addSet(segmentId){
  const segment=editor?.draft.segments.find(item=>item.id===segmentId);if(!segment)return;
  const activityType=segment.entries.length?segment.entries.at(-1):null;
  segment.entries.push({id:id('entry'),metrics:{...(activityType?.metrics??{})},flags:[],source:'prefill',status:'completed'});
}
export function removeSet(segmentId,setId){
  const segment=editor?.draft.segments.find(item=>item.id===segmentId);if(segment)segment.entries=segment.entries.filter(entry=>entry.id!==setId);
}
export function toggleWarmup(segmentId,setId){
  const entry=editor?.draft.segments.find(item=>item.id===segmentId)?.entries.find(item=>item.id===setId);if(!entry)return;
  entry.flags??=[];entry.flags.includes('warmup')?entry.flags=entry.flags.filter(flag=>flag!=='warmup'):entry.flags.push('warmup');
}
export function toggleAssistMode(segmentId){
  const segment=editor?.draft.segments.find(item=>item.id===segmentId);if(!segment)return;
  segment.mode=segment.mode==='assisted'?'external':'assisted';
  for(const entry of segment.entries){
    const weight=entry.metrics?.weight;if(weight==null)continue;
    entry.metrics.weight=segment.mode==='assisted'?-Math.abs(weight):Math.max(0,weight);
  }
}
export function setSetMetric(segmentId,setId,type,raw){
  const segment=editor?.draft.segments.find(item=>item.id===segmentId);
  const entry=segment?.entries.find(item=>item.id===setId);if(!entry)return;
  const value=parseNumber(raw);
  if(value==null){delete entry.metrics[type];return}
  entry.metrics[type]=type==='weight'&&segment.mode==='assisted'?-Math.abs(value):value;
}

function totalReps(entry){
  const m=entry.metrics??{};
  return m.repetitionsLeft!=null||m.repetitionsRight!=null
    ?(Number(m.repetitionsLeft)||0)+(Number(m.repetitionsRight)||0)
    :(Number(m.repetitions)||0);
}
export function effectiveReps(entry){
  const m=entry?.metrics??{};
  if(m.repetitionsLeft!=null||m.repetitionsRight!=null){
    if(m.repetitionsLeft==null)return m.repetitionsRight??null;
    if(m.repetitionsRight==null)return m.repetitionsLeft;
    return Math.min(m.repetitionsLeft,m.repetitionsRight);
  }
  return m.repetitions??null;
}
export function setVolume(entry){
  const weight=entry?.metrics?.weight;
  if(!Number.isFinite(weight)||weight<=0||entry.flags?.includes('warmup'))return 0;
  return weight*totalReps(entry);
}
export function strengthVolume(session){
  return(session.segments??[]).flatMap(segment=>segment.entries??[]).reduce((sum,entry)=>sum+setVolume(entry),0);
}

function formatSet(entry){
  const m=entry.metrics??{},weight=m.weight;
  const weightText=Number.isFinite(weight)?weight<0?`${formatNumber(Math.abs(weight),1)} kg Hilfe`:weight===0?'Körpergewicht':`${formatNumber(weight,1)} kg`:'?';
  const reps=m.repetitionsLeft!=null||m.repetitionsRight!=null?`${m.repetitionsLeft??'?'}/${m.repetitionsRight??'?'}`:m.repetitions??'?';
  return`${entry.flags?.includes('warmup')?'A ':''}${weightText} × ${reps}`;
}

function metricInput(type,value,segmentId,entryId){
  const def=METRICS[type]??{label:type,unit:''};
  let shown=value??'';
  if(type==='distance'&&value!=null)shown=String(value/1000).replace('.',',');
  if(type==='duration'&&value!=null){
    const hours=Math.floor(value/3600),minutes=Math.round((value%3600)/60);
    shown=hours?`${hours}:${String(minutes).padStart(2,'0')}`:String(minutes);
  }
  return`<label class="metric-field"><span>${esc(def.label)}${def.unit?' · '+esc(def.unit):''}</span>
    <input value="${esc(shown)}" inputmode="${type==='duration'?'text':'decimal'}" data-change="strength.metric" data-type="${type}" data-segment="${segmentId}" data-set="${entryId}"></label>`;
}

function cardioSegmentHtml(activity,segment){
  const entry=segment.entries[0]??entryTemplateForActivity(activity);
  const metrics=activity.metrics?.length?activity.metrics:['duration','distance','averageHeartRate','maxHeartRate','calories'];
  return`<section class="strength-exercise cardio-exercise">
    <header><div><strong>${esc(activity.name)}</strong><small>Cardio / Messwerte</small></div>
    <button class="icon small" data-action="strength.exercise.remove" data-segment="${segment.id}">×</button></header>
    <div class="cardio-grid">${metrics.map(type=>metricInput(type,entry.metrics?.[type],segment.id,entry.id)).join('')}</div>
  </section>`;
}

function strengthSetRow(activity,segment,entry,index){
  const settings=activitySettings(activity),unilateral=Boolean(settings.einarmig),assisted=segment.mode==='assisted';
  const shownWeight=entry.metrics?.weight==null?'':assisted?Math.abs(entry.metrics.weight):entry.metrics.weight;
  return`<div class="strength-set ${entry.flags?.includes('warmup')?'warm':''} ${unilateral?'unilateral':''}">
    <button class="set-number" data-action="strength.warmup" data-segment="${segment.id}" data-set="${entry.id}">${entry.flags?.includes('warmup')?'A':index+1}</button>
    <label><input value="${shownWeight}" inputmode="decimal" data-change="strength.metric" data-type="weight" data-segment="${segment.id}" data-set="${entry.id}"><span>${assisted?'Hilfe':'kg'}</span></label>
    ${unilateral?`<label><input value="${entry.metrics?.repetitionsLeft??''}" inputmode="numeric" data-change="strength.metric" data-type="repetitionsLeft" data-segment="${segment.id}" data-set="${entry.id}"><span>L</span></label>
    <label><input value="${entry.metrics?.repetitionsRight??''}" inputmode="numeric" data-change="strength.metric" data-type="repetitionsRight" data-segment="${segment.id}" data-set="${entry.id}"><span>R</span></label>`
    :`<label><input value="${entry.metrics?.repetitions??''}" inputmode="numeric" data-change="strength.metric" data-type="repetitions" data-segment="${segment.id}" data-set="${entry.id}"><span>Wdh</span></label>`}
    <button class="set-remove" data-action="strength.set.remove" data-segment="${segment.id}" data-set="${entry.id}">×</button>
  </div>`;
}

function strengthSegmentHtml(state,activity,segment){
  return`<section class="strength-exercise">
    <header><div><strong>${esc(activity.name)}</strong><small>${segment.entries.length} Sätze</small></div>
    <button class="icon small" data-action="strength.exercise.remove" data-segment="${segment.id}">×</button></header>
    ${activity.settings?.assist?`<button class="assist-toggle ${segment.mode==='assisted'?'active':''}" data-action="strength.assist.toggle" data-segment="${segment.id}">
      <span>${segment.mode==='assisted'?'Unterstützung':'Körpergewicht / Zusatzgewicht'}</span><b>${segment.mode==='assisted'?'Hilfe aktiv':'ohne Hilfe'}</b></button>`:''}
    <div class="strength-sets">${segment.entries.map((entry,index)=>strengthSetRow(activity,segment,entry,index)).join('')}</div>
    <button class="button subtle" data-action="strength.set.add" data-segment="${segment.id}">+ Satz hinzufügen</button>
  </section>`;
}

export function todayView(state){
  if(editor)return strengthEditorView(state);
  const current=nextTrainingUnit(state);
  if(!current){
    return`<section class="module-hero"><div class="module-hero__icon">🏋️</div><div><span class="eyebrow">Kraft</span><h1>Heute</h1><p>Noch kein aktiver Plan</p></div></section>
      <div class="card today-card"><h2>Noch kein Plan</h2><p class="muted">Lege im Plan-Tab deine Einheiten und den Zyklus an – oder starte spontan.</p>
      <button class="button primary top" data-action="strength.new">Freie Session starten</button></div>`;
  }
  return`<section class="today-hero">
    <span class="eyebrow">● Nächste Einheit</span>
    <h1>${esc(current.unit.name)}</h1>
    <p>${(current.unit.segmente??current.unit.uebungen??[]).length} Übungen im Plan${current.autoSkippedRest?' · Rest Day automatisch übersprungen':''}</p>
    <div class="today-actions"><button class="button primary" data-action="strength.planned.start" data-id="${current.unit.id}">Jetzt starten</button>
    <button class="button" data-action="strength.skip">Überspringen ›</button></div>
    <button class="button subtle top" data-action="strength.new">Freie Session starten</button>
  </section>`;
}

export function strengthEditorView(state){
  if(!editor)return'<div class="card empty">Kein Training geöffnet.</div>';
  const activities=strengthActivities(state),options=activities.map(activity=>`<option value="${activity.id}">${esc(activity.name)}</option>`).join('');
  const segments=editor.draft.segments.map(segment=>{
    const activity=activityFor(state,segment.activityId);
    return activity?(isCardioActivity(activity)?cardioSegmentHtml(activity,segment):strengthSegmentHtml(state,activity,segment)):'';
  }).join('');
  return`<section class="module-hero"><div class="module-hero__icon">🏋️</div><div><span class="eyebrow">Heute</span><h1>${esc(editor.draft.title)}</h1><p>${formatNumber(strengthVolume(editor.draft),0)} kg bewegt</p></div></section>
    <div class="editor-card stack"><div class="exercise-picker"><select id="strengthExercise">${options||'<option value="">Keine Übungen vorhanden</option>'}</select>
    <button class="button" data-action="strength.exercise.add">Übung hinzufügen</button></div></div>
    <div class="stack top">${segments||'<div class="card empty">Füge deine erste Übung hinzu.</div>'}</div>
    <label class="metric-field top"><span>Notiz zum Tag</span><textarea data-change="strength.note">${esc(editor.draft.note||'')}</textarea></label>
    <div class="stack top"><button class="button primary" data-action="strength.save">Einheit abschließen ✓</button><button class="button" data-action="strength.cancel">Abbrechen</button></div>`;
}

export function saveStrength(state){
  if(!editor)throw Error('Kein Training geöffnet.');
  if(!editor.draft.segments.length)throw Error('Füge mindestens eine Übung hinzu.');
  const draft=clone(editor.draft);draft.status='completed';draft.updatedAt=new Date().toISOString();
  draft.legacy={...(draft.legacy??{}),planUnitId:editor.plannedUnitId};
  if(editor.mode==='create')state.sessions.push(draft);else{
    const index=state.sessions.findIndex(session=>session.id===draft.id);if(index<0)throw Error('Training nicht gefunden.');state.sessions[index]=draft;
  }
  if(editor.plannedUnitId){
    const current=currentCycleUnit(state,draft.date);
    if(current){
      const next=(current.index+1)%cycle(current.plan).length;
      advanceAnchor(current.plan,next,draft.date);
    }
  }
  editor=null;return draft;
}
export const deleteStrength=(state,id)=>state.sessions=state.sessions.filter(session=>session.id!==id);

function unitUsage(plan,unitId){return cycle(plan).filter(item=>(item.einheitId??item.unitId??item)===unitId).length}

export function planView(state){
  const plan=normalizeLegacyPlan(strengthPlan(state));
  if(!plan)return`<section class="module-hero"><div class="module-hero__icon">▤</div><div><span class="eyebrow">Kraft</span><h1>Plan</h1><p>Noch kein Plan vorhanden</p></div></section>`;
  const currentIndex=cycleIndexForDate(plan);
  const cycleRows=cycle(plan).map((item,index)=>{
    const unit=planUnitById(plan,item.einheitId??item.unitId??item);
    return`<div class="cycle-row ${index===currentIndex?'current':''}">
      <span class="cycle-number">${index+1}</span><strong>${esc(unit?.name??'Unbekannte Einheit')}</strong>${index===currentIndex?'<small>heute</small>':''}
      <div class="cycle-actions"><button data-action="plan.up" data-index="${index}">▲</button><button data-action="plan.down" data-index="${index}">▼</button><button data-action="plan.remove" data-index="${index}">×</button></div>
    </div>`;
  }).join('');
  const units=plan.legacyData.einheiten.map(unit=>`<section class="unit-card">
    <div><strong>${esc(unit.name)}</strong><small>${(unit.segmente??unit.uebungen??[]).length} Übungen · ${unitUsage(plan,unit.id)}× im Zyklus</small></div>
    <div><button class="icon small" data-action="plan.unit.edit" data-id="${unit.id}">✎</button><button class="icon small" data-action="plan.unit.delete" data-id="${unit.id}">×</button></div>
  </section>`).join('');
  return`<section class="module-hero"><div class="module-hero__icon">▤</div><div><span class="eyebrow">Kraft</span><h1>Plan</h1><p>Zyklus und Einheitenbibliothek</p></div></section>
    <p class="section-label">Zyklus · Ablauf</p><section class="cycle-card">${cycleRows||'<p class="empty">Noch kein Zyklus.</p>'}</section>
    <button class="button top" data-action="plan.add-cycle">+ Einheit in den Zyklus</button>
    <button class="button subtle top" data-action="plan.correct-today">Heute korrigieren</button>
    <p class="section-label">Einheiten · Bibliothek</p><p class="muted small-copy">Jede Einheit existiert einmal. Änderungen wirken an allen Stellen im Zyklus.</p>
    <div class="stack">${units||'<div class="card empty">Noch keine Einheiten.</div>'}</div>
    <button class="button primary top" data-action="plan.unit.new">+ Einheit anlegen</button>
    <p class="section-label">Übungen · Bibliothek</p>
    <div class="library-summary"><span>${strengthActivities(state).length} Übungen verfügbar</span><button class="button compact" data-action="library.open">Öffnen</button></div>`;
}

export function moveCycle(state,index,direction){
  const plan=normalizeLegacyPlan(strengthPlan(state)),items=cycle(plan),target=index+direction;
  if(target<0||target>=items.length)return;
  [items[index],items[target]]=[items[target],items[index]];
  const a=anchor(plan);
  if(a?.index===index)a.index=target;else if(a?.index===target)a.index=index;
}
export function removeCycleItem(state,index){
  const plan=normalizeLegacyPlan(strengthPlan(state)),items=cycle(plan);
  if(index<0||index>=items.length)return;
  items.splice(index,1);
  if(!items.length){plan.legacyData.anker=null;plan.legacyData.position=0;return}
  const a=anchor(plan);if(a?.index>index)a.index--;else if(a?.index===index)a.index=Math.min(index,items.length-1);
}
export function correctToday(state,index=0){
  const plan=normalizeLegacyPlan(strengthPlan(state));
  if(!cycle(plan).length)return;
  advanceAnchor(plan,Math.max(0,Math.min(cycle(plan).length-1,index)));
}

export function historyView(state){
  const sessions=completedSessions(state,'strength');
  if(historyMode==='progress')return progressView(state);
  const cards=sessions.map(session=>`<section class="history-card">
    <button class="history-head" data-action="strength.open" data-id="${session.id}">
      <span><strong>${esc(session.title||'Krafttraining')}</strong><small>${esc(formatDate(session.date))}</small></span>
      <b>${formatNumber(strengthVolume(session),0)} kg</b>
    </button>
    <div class="history-exercises">${(session.segments??[]).map(segment=>{
      const activity=activityFor(state,segment.activityId);
      if(!activity)return'';
      if(isCardioActivity(activity)){
        const m=segment.entries?.[0]?.metrics??{};
        return`<div><span class="dot muted-dot"></span><span>${esc(activity.name)} ${Object.entries(m).slice(0,4).map(([type,value])=>`${METRICS[type]?.label??type}: ${value}`).join(' · ')}</span></div>`;
      }
      const sets=segment.entries??[],top=Math.max(...sets.map(entry=>entry.metrics?.weight??0));
      return`<div><span class="dot"></span><span>${esc(activity.name)} ${sets.length} Sätze · ${formatNumber(top,1)} kg</span></div>`;
    }).join('')}</div>
    <button class="share-row" data-action="strength.share" data-id="${session.id}">Teilen</button>
  </section>`).join('');
  return historyShell('Verlauf',cards||'<div class="card empty">Noch kein Verlauf.</div>');
}

function historyShell(title,content){
  return`<div class="segmented"><button class="${historyMode==='history'?'active':''}" data-action="history.mode" data-mode="history">Verlauf</button>
    <button class="${historyMode==='progress'?'active':''}" data-action="history.mode" data-mode="progress">Fortschritt</button></div>
    <section class="module-hero compact-hero"><div><span class="eyebrow">Kraft</span><h1>${title}</h1></div></section>${content}`;
}

function exerciseSeries(state,activityId){
  const points=[];
  for(const session of state.sessions.toSorted((a,b)=>a.date.localeCompare(b.date))){
    if(session.moduleId!=='strength'||session.status!=='completed')continue;
    for(const segment of session.segments??[])if(segment.activityId===activityId){
      const entries=segment.entries??[],weights=entries.map(entry=>entry.metrics?.weight).filter(Number.isFinite);
      if(!weights.length)continue;
      const positive=weights.filter(weight=>weight>0);
      const top=positive.length?Math.max(...positive):Math.max(...weights);
      const average=weights.reduce((a,b)=>a+b,0)/weights.length;
      const volume=entries.reduce((sum,entry)=>sum+setVolume(entry),0);
      points.push({date:session.date,top,average,volume,sets:entries.map(formatSet)});
    }
  }
  return points;
}
function weeklyVolume(state){
  const map=new Map();
  for(const session of completedSessions(state,'strength')){
    const d=new Date(`${session.date}T12:00:00Z`),day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day+3);
    const first=new Date(Date.UTC(d.getUTCFullYear(),0,4));
    const week=1+Math.round(((d-first)/86400000-3+((first.getUTCDay()+6)%7))/7);
    const key=`W${String(week).padStart(2,'0')}`;map.set(key,(map.get(key)??0)+strengthVolume(session));
  }
  return[...map.entries()].slice(-6).map(([label,value])=>({label,value}));
}
function progressView(state){
  const activities=strengthActivities(state).map(activity=>({activity,series:exerciseSeries(state,activity.id)})).filter(row=>row.series.length);
  const cards=activities.map(({activity,series})=>{
    const data=series.slice(-8).map(point=>({label:formatDate(point.date).slice(0,5),value:progressMetric==='top'?point.top:progressMetric==='average'?point.average:point.volume}));
    const last=series.at(-1),tr=trend(data.map(point=>point.value),{suffix:' kg'});
    return`<section class="progress-card"><button class="progress-card-head" data-action="progress.toggle" data-id="${activity.id}">
      <span><strong>${esc(activity.name)}</strong><small>${series.length} Einheiten · ${tr.text}</small></span><b>⌄</b></button>
      <div class="progress-chart-wrap">${lineChart(data,{suffix:' kg'})}</div>
      <div class="progress-last"><span>Letzte Einheit</span><strong>${formatNumber(progressMetric==='top'?last.top:progressMetric==='average'?last.average:last.volume,progressMetric==='volume'?0:1)} kg</strong></div></section>`;
  }).join('');
  return historyShell('Fortschritt',`<section class="progress-card weekly"><div class="progress-card-title"><span><strong>Wochenvolumen</strong><small>Letzte Trainingswochen</small></span></div>${barChart(weeklyVolume(state))}</section>
    <div class="periods top">${[['top','Top-Gewicht'],['average','Ø Gewicht'],['volume','Volumen']].map(([id,label])=>`<button class="${progressMetric===id?'active':''}" data-action="progress.metric" data-metric="${id}">${label}</button>`).join('')}</div>
    <div class="stack top">${cards||'<div class="card empty">Noch keine Fortschrittsdaten.</div>'}</div>`);
}
export function setHistoryMode(mode){historyMode=mode}
export function setProgressMetric(metric){progressMetric=metric}
