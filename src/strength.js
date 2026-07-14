import{id,todayIso,completedSessions,formatDate,formatNumber,parseNumber,esc}from'./core.js';
import{lineChart,barChart,trend}from'./charts.js';

let editor=null,progressMetric='top',expandedProgress=new Set();
const clone=value=>structuredClone(value);
export const currentStrengthEditor=()=>editor;

const activityFor=(state,segment)=>state.activities.find(activity=>activity.id===segment.activityId)||null;
const settingsFor=(state,segment)=>activityFor(state,segment)?.settings??{};
const isUnilateral=(state,segment)=>Boolean(settingsFor(state,segment).einarmig);
const isAssistConfigured=(state,segment)=>Boolean(settingsFor(state,segment).assist);

export function effectiveReps(entry){
  const m=entry?.metrics??{};
  if(m.repetitionsLeft!=null||m.repetitionsRight!=null){
    if(m.repetitionsLeft==null)return m.repetitionsRight??null;
    if(m.repetitionsRight==null)return m.repetitionsLeft;
    return Math.min(m.repetitionsLeft,m.repetitionsRight);
  }
  return m.repetitions??null;
}

function totalReps(entry){
  const m=entry?.metrics??{};
  return m.repetitionsLeft!=null||m.repetitionsRight!=null
    ?(Number(m.repetitionsLeft)||0)+(Number(m.repetitionsRight)||0)
    :(Number(m.repetitions)||0);
}

export function setVolume(entry){
  const weight=entry?.metrics?.weight;
  if(!Number.isFinite(weight)||weight<=0||entry.flags?.includes('warmup'))return 0;
  return weight*totalReps(entry);
}

export function strengthVolume(session){
  return(session.segments??[]).filter(segment=>segment.status!=='draft')
    .flatMap(segment=>segment.entries??[]).reduce((sum,entry)=>sum+setVolume(entry),0);
}

function completedSegmentsBefore(state,activityId,date){
  const rows=[];
  for(const session of state.sessions){
    if(session.moduleId!=='strength'||session.status!=='completed'||session.date>=date)continue;
    for(const segment of session.segments??[]){
      if(segment.activityId===activityId&&segment.status!=='draft'&&segment.entries?.length)rows.push({date:session.date,segment});
    }
  }
  return rows.toSorted((a,b)=>b.date.localeCompare(a.date));
}

export function lastWorkingSets(state,activityId,date=todayIso()){
  const found=completedSegmentsBefore(state,activityId,date)[0];
  if(!found)return null;
  const entries=found.segment.entries.filter(entry=>!entry.flags?.includes('warmup')&&Number.isFinite(entry.metrics?.weight));
  return entries.length?{date:found.date,entries}:null;
}

export function prefillEntry(state,activity,date=todayIso()){
  const last=lastWorkingSets(state,activity.id,date);
  if(!last)return{id:id('entry'),metrics:{},flags:[],source:'manual',status:'completed'};
  const first=last.entries[0],m=first.metrics??{},metrics={};
  if(m.weight!=null)metrics.weight=m.weight;
  if(activity.settings?.einarmig){
    if(m.repetitionsLeft!=null)metrics.repetitionsLeft=m.repetitionsLeft;
    if(m.repetitionsRight!=null)metrics.repetitionsRight=m.repetitionsRight;
  }else if(m.repetitions!=null)metrics.repetitions=m.repetitions;
  return{id:id('entry'),metrics,flags:[],source:'prefill',status:'completed'};
}

function workingSets(segment){
  return(segment.entries??[]).filter(entry=>!entry.flags?.includes('warmup')&&Number.isFinite(entry.metrics?.weight));
}

export function progressionSuggestion(state,segment,date=todayIso()){
  const activity=activityFor(state,segment),prog=activity?.settings?.prog;
  if(!prog||!prog.art||prog.art==='off')return null;
  if(prog.art==='technik')return{kind:'technique',text:'Gewicht halten · saubere Ausführung priorisieren'};
  const last=lastWorkingSets(state,segment.activityId,date);
  if(!last)return null;
  const topWeight=Math.max(...last.entries.map(entry=>entry.metrics.weight));
  const topSets=last.entries.filter(entry=>entry.metrics.weight===topWeight);
  const setCount=prog.saetze??4,step=prog.schritt??2.5;
  const assist=topWeight<0||activity.settings?.assist;
  const target=prog.art==='double'?(prog.wdhMax??12):(prog.wdh??12);
  const reached=topSets.length>=setCount&&topSets.every(entry=>(effectiveReps(entry)??-1)>=target);
  const shownWeight=Math.abs(topWeight);
  if(!reached){
    return{kind:'hold',text:assist
      ?`${formatNumber(shownWeight,1)} kg Hilfe halten · Ziel ${target} Wdh${activity.settings?.einarmig?' auf beiden Seiten':''} in allen Sätzen`
      :`${formatNumber(topWeight,1)} kg halten · Ziel ${target} Wdh${activity.settings?.einarmig?' auf beiden Seiten':''} in allen Sätzen`};
  }
  const next=assist?Math.min(0,topWeight+step):topWeight+step;
  const start=prog.art==='double'?(prog.wdhMin??8):target;
  return{kind:'increase',nextWeight:next,text:assist
    ?next<0?`↗ Hilfe auf ${formatNumber(Math.abs(next),1)} kg reduzieren · Ziel ${start} Wdh`
      :`↗ Auf Körpergewicht wechseln · Ziel ${start} Wdh`
    :`↗ Auf ${formatNumber(next,1)} kg steigern · Ziel ${start} Wdh`};
}

function bestBefore(state,activityId,date){
  let top=null,reps=null;
  for(const{segment}of completedSegmentsBefore(state,activityId,date)){
    for(const entry of workingSets(segment)){
      const weight=entry.metrics.weight,value=effectiveReps(entry);
      if(top==null||weight>top){top=weight;reps=value}
      else if(weight===top&&value!=null&&(reps==null||value>reps))reps=value;
    }
  }
  return{top,reps};
}

export function detectPR(state,segment,date){
  const previous=bestBefore(state,segment.activityId,date),sets=workingSets(segment);
  if(previous.top==null||!sets.length)return null;
  let currentTop=null,currentReps=null;
  for(const entry of sets){
    const weight=entry.metrics.weight,reps=effectiveReps(entry);
    if(currentTop==null||weight>currentTop){currentTop=weight;currentReps=reps}
    else if(weight===currentTop&&reps!=null&&(currentReps==null||reps>currentReps))currentReps=reps;
  }
  if(currentTop>previous.top)return{kind:'weight',text:currentTop<=0?'Weniger Hilfe als je zuvor':'Neues Top-Gewicht'};
  if(currentTop===previous.top&&currentReps!=null&&previous.reps!=null&&currentReps>previous.reps)return{kind:'reps',text:'Wiederholungsrekord'};
  return null;
}

function segmentStats(segment){
  const sets=workingSets(segment);
  let top=null,repsAtTop=null,volume=0,weighted=0,repsTotal=0;
  for(const entry of sets){
    const weight=entry.metrics.weight,reps=effectiveReps(entry),allReps=totalReps(entry);
    volume+=setVolume(entry);
    if(weight>0&&allReps>0){weighted+=weight*allReps;repsTotal+=allReps}
    if(top==null||weight>top){top=weight;repsAtTop=reps}
    else if(weight===top&&reps!=null&&(repsAtTop==null||reps>repsAtTop))repsAtTop=reps;
  }
  return{top,repsAtTop,volume,average:repsTotal?weighted/repsTotal:top};
}

export function exerciseSeries(state,activityId,limit=12){
  const points=[];
  for(const session of state.sessions.toSorted((a,b)=>a.date.localeCompare(b.date))){
    if(session.moduleId!=='strength'||session.status!=='completed')continue;
    for(const segment of session.segments??[]){
      if(segment.activityId===activityId&&segment.status!=='draft'){
        const stats=segmentStats(segment);
        if(stats.top!=null||stats.volume>0)points.push({date:session.date,...stats,sets:workingSets(segment).map(formatSet)});
      }
    }
  }
  return limit?points.slice(-limit):points;
}

function isoWeek(iso){
  const date=new Date(`${iso}T12:00:00Z`),day=(date.getUTCDay()+6)%7;
  date.setUTCDate(date.getUTCDate()-day+3);
  const first=new Date(Date.UTC(date.getUTCFullYear(),0,4));
  const week=1+Math.round(((date-first)/86400000-3+((first.getUTCDay()+6)%7))/7);
  return`${date.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

export function weeklyVolume(state,count=6){
  const map=new Map();
  for(const session of state.sessions){
    if(session.moduleId!=='strength'||session.status!=='completed')continue;
    const volume=strengthVolume(session);if(volume<=0)continue;
    const key=isoWeek(session.date);map.set(key,(map.get(key)??0)+volume);
  }
  return[...map.keys()].sort().slice(-count).map(key=>({label:key.slice(-3),value:Math.round(map.get(key))}));
}

function formatSet(entry){
  const m=entry.metrics??{},weight=m.weight;
  const weightText=Number.isFinite(weight)?weight<0?`${formatNumber(Math.abs(weight),1)} kg Hilfe`:weight===0?'Körpergewicht':`${formatNumber(weight,1)} kg`:'?';
  const reps=m.repetitionsLeft!=null||m.repetitionsRight!=null
    ?`${m.repetitionsLeft??'?'}/${m.repetitionsRight??'?'}`
    :m.repetitions??'?';
  return`${entry.flags?.includes('warmup')?'A ':''}${weightText} × ${reps}`;
}

export function strengthOverview(state){
  const sessions=completedSessions(state,'strength');
  const cards=sessions.slice(0,20).map(session=>`<button class="session" data-action="strength.open" data-id="${session.id}">
    <span class="session__accent"></span><span class="session__main"><strong>${esc(session.title||'Krafttraining')}</strong>
    <small>${esc(formatDate(session.date))} · ${session.segments?.length||0} Übungen · ${formatNumber(strengthVolume(session),0)} kg</small></span><span class="session__arrow">›</span></button>`).join('');
  return`<section class="module-hero"><div class="module-hero__icon">🏋️</div><div><span class="eyebrow">Kraft</span><h1>Training</h1><p>${sessions.length} abgeschlossene Einheiten</p></div></section>
    <button class="button primary create-button" data-action="strength.new"><span>+</span>Freies Training starten</button>
    <div class="section-title top"><span>Verlauf</span></div><div class="stack">${cards||'<div class="card empty">Noch keine Krafttrainings.</div>'}</div>`;
}

export function newStrength(){editor={mode:'create',draft:{id:id('session'),moduleId:'strength',date:todayIso(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'draft',title:'Freies Training',note:'',segments:[]}}}
export const editStrength=session=>editor={mode:'edit',draft:clone(session)};
export const cancelStrength=()=>editor=null;
export const setStrengthTitle=value=>{if(editor)editor.draft.title=value};
export const setStrengthNote=value=>{if(editor)editor.draft.note=value};

export function addExercise(state,activityId){
  const activity=state.activities.find(item=>item.id===activityId);
  if(!editor||!activity)throw Error('Übung nicht gefunden.');
  const entry=prefillEntry(state,activity,editor.draft.date);
  const assist=Boolean(activity.settings?.assist);
  editor.draft.segments.push({id:id('segment'),activityId:activity.id,name:activity.name,title:activity.name,status:'completed',
    mode:assist?(entry.metrics.weight!=null&&entry.metrics.weight>=0?'external':'assisted'):'external',entries:[entry]});
}

export const removeExercise=segmentId=>{if(editor)editor.draft.segments=editor.draft.segments.filter(segment=>segment.id!==segmentId)};

export function addSet(segmentId){
  const segment=editor?.draft.segments.find(item=>item.id===segmentId);if(!segment)return;
  segment.entries.push({id:id('entry'),metrics:{...(segment.entries.at(-1)?.metrics??{})},flags:[],source:'prefill',status:'completed'});
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
    const weight=entry.metrics?.weight;
    if(weight==null)continue;
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

export function saveStrength(state){
  if(!editor)throw Error('Kein Training geöffnet.');
  if(!editor.draft.segments.length)throw Error('Füge mindestens eine Übung hinzu.');
  if(!editor.draft.segments.some(segment=>segment.entries.some(entry=>Object.keys(entry.metrics).length)))throw Error('Trag mindestens einen Satzwert ein.');
  const draft=clone(editor.draft);draft.status='completed';draft.updatedAt=new Date().toISOString();
  if(editor.mode==='create')state.sessions.push(draft);else{const index=state.sessions.findIndex(session=>session.id===draft.id);if(index<0)throw Error('Training nicht gefunden.');state.sessions[index]=draft}
  editor=null;return draft;
}

export const deleteStrength=(state,id)=>state.sessions=state.sessions.filter(session=>session.id!==id);

function setRow(state,segment,entry,index){
  const m=entry.metrics??{},unilateral=isUnilateral(state,segment),assisted=segment.mode==='assisted';
  const shownWeight=m.weight==null?'':assisted?Math.abs(m.weight):m.weight;
  return`<div class="strength-set ${entry.flags?.includes('warmup')?'warm':''} ${unilateral?'unilateral':''}">
    <button class="set-number" data-action="strength.warmup" data-segment="${segment.id}" data-set="${entry.id}">${entry.flags?.includes('warmup')?'A':index+1}</button>
    <label><input value="${shownWeight}" inputmode="decimal" data-change="strength.metric" data-type="weight" data-segment="${segment.id}" data-set="${entry.id}"><span>${assisted?'Hilfe':'kg'}</span></label>
    ${unilateral?`<label><input value="${m.repetitionsLeft??''}" inputmode="numeric" data-change="strength.metric" data-type="repetitionsLeft" data-segment="${segment.id}" data-set="${entry.id}"><span>L</span></label>
    <label><input value="${m.repetitionsRight??''}" inputmode="numeric" data-change="strength.metric" data-type="repetitionsRight" data-segment="${segment.id}" data-set="${entry.id}"><span>R</span></label>`
    :`<label><input value="${m.repetitions??''}" inputmode="numeric" data-change="strength.metric" data-type="repetitions" data-segment="${segment.id}" data-set="${entry.id}"><span>Wdh</span></label>`}
    <button class="set-remove" data-action="strength.set.remove" data-segment="${segment.id}" data-set="${entry.id}">×</button>
  </div>`;
}

export function strengthEditorView(state){
  if(!editor)return'<div class="card empty">Kein Training geöffnet.</div>';
  const activities=state.activities.filter(activity=>activity.moduleId==='strength'&&!activity.archived);
  const options=activities.map(activity=>`<option value="${activity.id}">${esc(activity.name)}</option>`).join('');
  const segments=editor.draft.segments.map(segment=>{
    const activity=activityFor(state,segment),suggestion=progressionSuggestion(state,segment,editor.draft.date);
    const assist=isAssistConfigured(state,segment),unilateral=isUnilateral(state,segment);
    return`<section class="strength-exercise">
      <header><div><strong>${esc(segment.name)}</strong><small>${unilateral?'Einarmig · ':''}${segment.entries.length} Sätze</small></div>
      <button class="icon small" data-action="strength.exercise.remove" data-segment="${segment.id}">×</button></header>
      ${assist?`<button class="assist-toggle ${segment.mode==='assisted'?'active':''}" data-action="strength.assist.toggle" data-segment="${segment.id}">
        <span>${segment.mode==='assisted'?'Unterstützung':'Körpergewicht / Zusatzgewicht'}</span><b>${segment.mode==='assisted'?'Hilfe aktiv':'ohne Hilfe'}</b></button>`:''}
      ${suggestion?`<div class="progression-hint ${suggestion.kind}">${esc(suggestion.text)}</div>`:''}
      <div class="strength-sets">${segment.entries.map((entry,index)=>setRow(state,segment,entry,index)).join('')}</div>
      <button class="button subtle" data-action="strength.set.add" data-segment="${segment.id}">+ Satz hinzufügen</button>
    </section>`;
  }).join('');
  return`<section class="module-hero"><div class="module-hero__icon">🏋️</div><div><span class="eyebrow">Kraft</span><h1>${editor.mode==='create'?'Neues Training':'Training bearbeiten'}</h1><p>${formatNumber(strengthVolume(editor.draft),0)} kg aktuell</p></div></section>
    <div class="editor-card stack"><label class="metric-field"><span>Name</span><input data-change="strength.title" value="${esc(editor.draft.title)}"></label>
    <div class="exercise-picker"><select id="strengthExercise">${options||'<option value="">Keine Übungen importiert</option>'}</select><button class="button" data-action="strength.exercise.add">Übung hinzufügen</button></div></div>
    <div class="stack top">${segments||'<div class="card empty">Füge deine erste Übung hinzu.</div>'}</div>
    <label class="metric-field top"><span>Trainingsnotiz · optional</span><textarea data-change="strength.note">${esc(editor.draft.note||'')}</textarea></label>
    <div class="stack top"><button class="button primary" data-action="strength.save">Training abschließen ✓</button><button class="button" data-action="strength.cancel">Abbrechen</button></div>`;
}

export function strengthDetailView(state,id){
  const session=state.sessions.find(item=>item.id===id);if(!session)return'<div class="card empty">Training nicht gefunden.</div>';
  const segments=(session.segments??[]).map(segment=>{
    const pr=detectPR(state,segment,session.date);
    return`<section class="strength-detail-exercise"><div class="between"><strong>${esc(segment.name||'Übung')}</strong>${pr?`<span class="pr-badge">🏆 ${esc(pr.text)}</span>`:''}</div>
    ${(segment.entries??[]).map((entry,index)=>`<div class="strength-detail-set"><span>${entry.flags?.includes('warmup')?'Aufwärmen':`Satz ${index+1}`}</span><strong>${esc(formatSet(entry))}</strong></div>`).join('')}</section>`;
  }).join('');
  return`<section class="module-hero"><div class="module-hero__icon">🏋️</div><div><span class="eyebrow">Kraft</span><h1>${esc(session.title||'Krafttraining')}</h1><p>${esc(formatDate(session.date))} · ${formatNumber(strengthVolume(session),0)} kg</p></div></section>
    <div class="detail-card stack">${segments}${session.note?`<p class="tour-note">${esc(session.note)}</p>`:''}</div>
    <div class="action-grid top"><button class="button primary" data-action="strength.share" data-id="${session.id}">Teilen</button><button class="button" data-action="strength.edit" data-id="${session.id}">Bearbeiten</button></div>
    <button class="button danger top" data-action="strength.delete" data-id="${session.id}">Löschen</button>`;
}

export function setProgressMetric(metric){progressMetric=metric}
export function toggleProgress(activityId){expandedProgress.has(activityId)?expandedProgress.delete(activityId):expandedProgress.add(activityId)}

export function strengthProgressView(state){
  const activities=state.activities.filter(activity=>activity.moduleId==='strength'&&!activity.archived)
    .map(activity=>({activity,series:exerciseSeries(state,activity.id,0)})).filter(row=>row.series.length);
  const weekly=weeklyVolume(state);
  const cards=activities.map(({activity,series})=>{
    const expanded=expandedProgress.has(activity.id),visible=expanded?series:series.slice(-6);
    const data=visible.map(point=>({label:formatDate(point.date).slice(0,5),value:progressMetric==='top'?point.top:progressMetric==='average'?point.average:point.volume}));
    const values=data.map(point=>point.value),suffix=progressMetric==='volume'?' kg':' kg';
    const tr=trend(values,{suffix});
    const last=series.at(-1);
    return`<section class="progress-card">
      <button class="progress-card-head" data-action="strength.progress.toggle" data-id="${activity.id}">
        <span><strong>${esc(activity.name)}</strong><small>${series.length} Einheiten · ${tr.text}</small></span><b>${expanded?'⌃':'⌄'}</b>
      </button>
      <div class="progress-chart-wrap">${lineChart(data,{suffix})}</div>
      <div class="progress-last"><span>Letzte Einheit</span><strong>${progressMetric==='top'?`${formatNumber(last.top,1)} kg`:progressMetric==='average'?`${formatNumber(last.average,1)} kg`:`${formatNumber(last.volume,0)} kg`}</strong></div>
      ${expanded?`<div class="progress-history">${series.toReversed().map(point=>`<div><span>${esc(formatDate(point.date))}</span><strong>${esc(point.sets.join(' · '))}</strong></div>`).join('')}</div>`:''}
    </section>`;
  }).join('');
  return`<section class="module-hero"><div class="module-hero__icon">↗</div><div><span class="eyebrow">Kraft</span><h1>Fortschritt</h1><p>Gewicht, Volumen und Verlauf</p></div></section>
    <section class="progress-card weekly"><div class="progress-card-title"><span><strong>Wochenvolumen</strong><small>Letzte ${weekly.length||0} Trainingswochen</small></span></div>${barChart(weekly)}</section>
    <div class="periods top">${[['top','Top-Gewicht'],['average','Ø Gewicht'],['volume','Volumen']].map(([id,label])=>`<button class="${progressMetric===id?'active':''}" data-action="strength.progress.metric" data-metric="${id}">${label}</button>`).join('')}</div>
    <div class="stack top">${cards||'<div class="card empty">Für Charts sind noch keine Kraftdaten vorhanden.</div>'}</div>`;
}
