import{formatDate}from'../../core/date.js';
import{activityById}from'../../core/model.js';
import{escapeHtml,formatDuration,formatMetric,formatNumber}from'../../ui/format.js';
import{icons}from'../../ui/icons.js';
import{
  activityUsage,
  alternativeActivities,
  completedStrengthSessions,
  cycleRows,
  restDayInfo,
  sessionTitle,
  strengthActivities,
  strengthPlan,
  strengthSessionSummary,
  strengthUnits,
  todayStrengthModel,
  unitActivities,
  unitUsage
}from'./strength-model.js';
import{
  baseStrengthActivity,
  isAssistActivity,
  isStrengthActivity,
  isUnilateralActivity,
  metricInputValue,
  resolvedStrengthActivity,
  strengthSessionSummaryText
}from'./strength-session.js';
import{
  STRENGTH_METRICS,
  activeStrengthActivities
}from'./strength-plan.js';

const expandedUnits=new Set();
const expandedExercises=new Set();
const expandedHistory=new Set();
const collapsedSegments=new Set();
const openedCompletedSegments=new Set();

let libraryFilter='all';
let exercisePicker=null;
let strengthEditorOverlay=null;

const metricLabels={
  gewicht:'Gewicht',
  wdh:'Wiederholungen',
  dauer:'Dauer',
  distanz:'Distanz',
  puls_avg:'Ø Puls',
  puls_max:'Max. Puls',
  kalorien:'Kalorien',
  hoehenmeter:'Höhenmeter',
  tempo_avg:'Ø Tempo'
};

const progressionLabel=progression=>{
  if(!progression?.art)return null;
  if(progression.art==='double')return`Double Progression · ${progression.saetze??'–'} × ${progression.wdhMin??'–'}–${progression.wdhMax??'–'}`;
  if(progression.art==='strength')return`Feste Wiederholungen · ${progression.saetze??'–'} × ${progression.wdh??'–'}`;
  if(progression.art==='technik')return'Technik';
  return progression.art;
};

function strengthBottomNav(view){
  const planActive=view==='plan'||view==='library';

  return`<nav class="strength-bottom" aria-label="Kraft-Navigation">
    <button data-action="strength.nav" data-path="/" aria-label="Start">${icons.home}<span>Start</span></button>
    <button class="${view==='today'?'active':''}" data-action="strength.nav" data-path="/module/kraft/today">${icons.today}<span>Heute</span></button>
    <button class="${planActive?'active':''}" data-action="strength.nav" data-path="/module/kraft/plan">${icons.plan}<span>Plan</span></button>
    <button class="${view==='history'?'active':''}" data-action="strength.nav" data-path="/module/kraft/history">${icons.history}<span>Verlauf</span></button>
  </nav>`;
}

function pageShell(view,content){
  return`<section class="strength-page">${content}</section>${strengthBottomNav(view)}${exercisePickerView()}${strengthEditorOverlayView()}`;
}

function readOnlyBanner(text='Fortschrittscharts und Teilen folgen in 0.2.3.'){
  return`<div class="strength-readonly">${icons.info}<span><strong>Ausbaustufe 0.2.2</strong>${escapeHtml(text)}</span></div>`;
}

function activityType(activity){
  if(!activity)return'Unbekannt';
  return activity.kategorie==='kraft'?'Kraft':'Cardio';
}

function activityFlags(activity){
  const settings=activity?.einstellungen??{};

  return[
    settings.einarmig?'Einarmig':null,
    settings.assist?'Assistiert':null,
    progressionLabel(settings.prog)
  ].filter(Boolean);
}

function compactActivityRow(state,row){
  const activity=row.activity;

  if(!activity){
    return`<div class="unit-activity missing"><span>${row.index+1}</span><div><strong>Aktivität fehlt</strong><small>${escapeHtml(row.segment.aktivitaetId)}</small></div></div>`;
  }

  return`<div class="unit-activity ${activity.kategorie==='kraft'?'strength':'cardio'}">
    <span>${row.index+1}</span>
    <div><strong>${escapeHtml(activity.name)}</strong><small>${escapeHtml(activityType(activity))}${activityFlags(activity).length?` · ${escapeHtml(activityFlags(activity).join(' · '))}`:''}</small></div>
  </div>`;
}

function strengthSetSummary(segment){
  const entries=segment.eintraege??[];
  if(!entries.length)return'noch keine Sätze';

  const warmups=entries.filter(entry=>entry.flags?.includes('aufwaermsatz')).length;
  const weights=entries
    .filter(entry=>!entry.flags?.includes('aufwaermsatz'))
    .map(entry=>entry.messwerte?.gewicht)
    .filter(Number.isFinite);

  const parts=[`${entries.length} ${entries.length===1?'Satz':'Sätze'}`];
  if(warmups)parts.push(`${warmups} Aufw.`);

  if(weights.length){
    const min=Math.min(...weights);
    const max=Math.max(...weights);
    parts.push(min===max
      ?`${formatNumber(min,Number.isInteger(min)?0:2)} kg`
      :`${formatNumber(min,Number.isInteger(min)?0:2)}–${formatNumber(max,Number.isInteger(max)?0:2)} kg`);
  }

  return parts.join(' · ');
}

function cardioSegmentSummary(activity,segment){
  const entry=segment.eintraege?.[0];
  if(!entry)return'noch keine Werte';

  const values=(activity.messwerte??[])
    .filter(type=>entry.messwerte?.[type]!=null)
    .map(type=>{
      const formatted=formatMetric(type,entry.messwerte[type]);
      return type==='puls_avg'?`Ø ${formatted}`:type==='puls_max'?`max ${formatted}`:formatted;
    });

  return values.length?values.join(' · '):'noch keine Werte';
}

function segmentSummary(state,segment){
  const activity=resolvedStrengthActivity(state,segment);
  return isStrengthActivity(activity)
    ?strengthSetSummary(segment)
    :cardioSegmentSummary(activity,segment);
}

function segmentOpen(segment,readonly){
  if(readonly)return openedCompletedSegments.has(segment.id);
  if(segment.erledigt===true)return openedCompletedSegments.has(segment.id);
  return!collapsedSegments.has(segment.id);
}

function assistButton(entry,activity,sessionId,segmentId){
  if(!isAssistActivity(activity))return'';

  const help=entry.messwerte?.gewicht!=null
    ?entry.messwerte.gewicht<0
    :entry._plus!==true;

  return`<button class="assist-sign ${help?'help':'load'}" data-action="strength.assist.toggle"
    data-session="${sessionId}" data-segment="${segmentId}" data-entry="${entry.id}"
    aria-label="${help?'Hilfegewicht':'Zusatzgewicht'}">${help?'−':'+'}</button>`;
}

function strengthSetRow(activity,session,segment,entry,index){
  const unilateral=isUnilateralActivity(activity);
  const assist=isAssistActivity(activity);
  const weight=entry.messwerte?.gewicht;
  const shownWeight=weight==null?'':formatNumber(assist?Math.abs(weight):weight,Number.isInteger(weight)?0:2);
  const warmup=entry.flags?.includes('aufwaermsatz');

  return`<div class="training-set ${warmup?'warmup':''} ${unilateral?'unilateral':''}">
    <button class="training-set-number ${warmup?'warmup':''}" data-action="strength.warmup.toggle"
      data-session="${session.id}" data-segment="${segment.id}" data-entry="${entry.id}"
      aria-label="Aufwärmsatz umschalten">${warmup?'A':index+1}</button>
    ${assistButton(entry,activity,session.id,segment.id)}
    <label class="training-field weight">
      <input type="text" inputmode="decimal" value="${escapeHtml(shownWeight)}" placeholder="kg"
        data-strength-metric data-session="${session.id}" data-segment="${segment.id}" data-entry="${entry.id}" data-type="gewicht">
      <span>kg</span>
    </label>
    <span class="training-times">×</span>
    ${unilateral?`
      <label class="training-field narrow">
        <input type="text" inputmode="numeric" value="${entry.messwerte?.wdh_l??''}" placeholder="L"
          data-strength-metric data-session="${session.id}" data-segment="${segment.id}" data-entry="${entry.id}" data-type="wdh_l">
        <span>L</span>
      </label>
      <span class="training-times">/</span>
      <label class="training-field narrow">
        <input type="text" inputmode="numeric" value="${entry.messwerte?.wdh_r??''}" placeholder="R"
          data-strength-metric data-session="${session.id}" data-segment="${segment.id}" data-entry="${entry.id}" data-type="wdh_r">
        <span>R</span>
      </label>`
      :`<label class="training-field reps">
        <input type="text" inputmode="numeric" value="${entry.messwerte?.wdh??''}" placeholder="Wdh"
          data-strength-metric data-session="${session.id}" data-segment="${segment.id}" data-entry="${entry.id}" data-type="wdh">
        <span>Wdh</span>
      </label>`}
    <button class="training-set-remove" data-action="strength.set.remove"
      data-session="${session.id}" data-segment="${segment.id}" data-entry="${entry.id}" aria-label="Satz entfernen">×</button>
  </div>`;
}

const metricUnit=(type,activity)=>{
  if(type==='dauer')return'min';
  if(type==='distanz')return activity?.kategorie==='schwimmen'?'m':'km';
  return{
    puls_avg:'bpm',puls_max:'bpm',kalorien:'kcal',hoehenmeter:'hm',
    schritte:'Schritte',tempo_avg:'km/h',tempo_max:'km/h',
    watt_avg:'W',trittfrequenz:'rpm'
  }[type]??metricLabels[type]??type;
};

function cardioFields(activity,session,segment,entry){
  return`<div class="training-cardio-grid">${(activity.messwerte??[]).map(type=>`
    <label class="training-cardio-field">
      <span>${escapeHtml(metricLabels[type]??type)}</span>
      <div><input type="text" inputmode="${type==='dauer'?'text':'decimal'}"
        value="${escapeHtml(metricInputValue(type,entry.messwerte?.[type],activity))}"
        placeholder="${type==='dauer'?'45 oder 1:15':escapeHtml(metricUnit(type,activity))}"
        data-strength-metric data-session="${session.id}" data-segment="${segment.id}" data-entry="${entry.id}" data-type="${type}">
        <small>${escapeHtml(metricUnit(type,activity))}</small></div>
    </label>`).join('')}</div>`;
}

function alternativePicker(state,session,segment){
  const base=baseStrengthActivity(state,segment);
  const alternatives=(base?.alternativen??[]).map(id=>activityById(state,id)).filter(Boolean);

  if(!alternatives.length)return'';

  return`<label class="training-alternative">
    <span>Übung für heute</span>
    <select data-strength-alternative data-session="${session.id}" data-segment="${segment.id}">
      <option value="">${escapeHtml(base.name)}</option>
      ${alternatives.map(activity=>`<option value="${activity.id}" ${segment.altOf===activity.id?'selected':''}>${escapeHtml(activity.name)}</option>`).join('')}
    </select>
  </label>`;
}

function trainingSegmentCard(state,session,segment,readonly=false){
  const activity=resolvedStrengthActivity(state,segment);
  if(!activity)return'';

  // Nach dem vollständigen Abschluss des Trainingstags sind sämtliche
  // Übungskarten fest geschlossen. Erst „Wieder öffnen“ macht sie wieder
  // interaktiv. Einzelne abgehakte Übungen dürfen während einer offenen
  // Session weiterhin erneut aufgeklappt und korrigiert werden.
  const open=readonly?false:segmentOpen(segment,false);
  const checked=segment.erledigt===true;
  const summary=segmentSummary(state,segment);
  const deviceNote=(activity.notiz??'').trim();
  const entry=segment.eintraege?.[0];

  const titleContent=`<strong><i class="activity-dot ${isStrengthActivity(activity)?'kraft':'rad'}"></i>${escapeHtml(activity.name)}</strong>
    <small>${escapeHtml(summary)}</small>`;

  return`<section class="training-segment ${checked?'done':''} ${readonly?'readonly locked':''}">
    <div class="training-segment-head">
      ${readonly
        ?`<span class="training-check ${checked?'checked':''}">${checked?'✓':'·'}</span>`
        :`<button class="training-check ${checked?'checked':''}" data-action="strength.segment.done"
          data-session="${session.id}" data-segment="${segment.id}" aria-label="Übung abschließen">${checked?'✓':''}</button>`}
      ${readonly
        ?`<div class="training-segment-title">${titleContent}</div>`
        :`<button class="training-segment-title" data-action="strength.segment.toggle" data-segment="${segment.id}">${titleContent}</button>`}
      ${readonly
        ?`<span class="training-fold locked" aria-hidden="true">${icons.lock}</span>`
        :`<button class="training-fold ${open?'open':''}" data-action="strength.segment.toggle" data-segment="${segment.id}" aria-label="Aufklappen">${icons.chevron}</button>`}
    </div>
    ${deviceNote?`<div class="training-device-note">${icons.info}<span>${escapeHtml(deviceNote)}</span></div>`:''}
    ${open?`<div class="training-segment-body">
      ${alternativePicker(state,session,segment)}
      ${isStrengthActivity(activity)
        ?`<div class="training-sets">${(segment.eintraege??[]).map((item,index)=>strengthSetRow(activity,session,segment,item,index)).join('')}</div>
          <button class="training-small-button" data-action="strength.set.add" data-session="${session.id}" data-segment="${segment.id}">+ Satz</button>`
        :entry?cardioFields(activity,session,segment,entry):''}
      <button class="training-remove-exercise" data-action="strength.segment.remove"
        data-session="${session.id}" data-segment="${segment.id}">Übung aus dieser Session entfernen</button>
    </div>`:''}
  </section>`;
}

function completedTodayView(state,session){
  return`<div class="training-session-heading completed">
      <div><span class="eyebrow"><i></i>Erledigt</span><h1>${escapeHtml(sessionTitle(state,session))}</h1><p>${escapeHtml(formatDate(session.datum))}</p></div>
      <strong id="strength-session-summary">${escapeHtml(strengthSessionSummaryText(state,session))}</strong>
    </div>
    <div class="training-segment-list">${(session.segmente??[]).map(segment=>trainingSegmentCard(state,session,segment,true)).join('')}</div>
    ${session.notiz?.trim()?`<section class="panel training-note readonly"><span>Notiz zum Tag</span><p>${escapeHtml(session.notiz.trim())}</p></section>`:''}
    <section class="training-finished">
      <strong>Einheit abgeschlossen ✓</strong>
      <button class="training-small-button" data-action="strength.session.reopen" data-session="${session.id}">Wieder öffnen</button>
    </section>`;
}

function openSessionView(state,session){
  return`<div class="training-session-heading">
      <div><span class="eyebrow"><i></i>Heute</span><h1>${escapeHtml(sessionTitle(state,session))}</h1><p>${escapeHtml(formatDate(session.datum))}</p></div>
      <strong id="strength-session-summary">${escapeHtml(strengthSessionSummaryText(state,session))}</strong>
    </div>
    <div class="training-segment-list">${(session.segmente??[]).map(segment=>trainingSegmentCard(state,session,segment,false)).join('')}</div>
    <button class="training-add-exercise" data-action="strength.picker.open" data-session="${session.id}">+ Übung hinzufügen</button>
    <label class="training-note">
      <span>Notiz zum Tag</span>
      <textarea rows="2" placeholder="z. B. Schulter links hat gezwickt …"
        data-strength-note data-session="${session.id}">${escapeHtml(session.notiz??'')}</textarea>
    </label>
    <button class="training-complete" data-action="strength.session.complete" data-session="${session.id}">Einheit abschließen ✓</button>`;
}

function readyTodayView(model){
  if(!model.plan){
    return`<section class="strength-start-empty panel">
      <h2>Noch kein Plan</h2>
      <p>Lege später im Plan-Tab Einheiten an oder starte eine freie Session.</p>
      <div class="training-start-actions single">
        <button class="training-primary" data-action="strength.free">Freie Session starten</button>
      </div>
    </section>`;
  }

  if(!model.unit){
    return`<section class="strength-start-empty panel"><h2>Keine Einheit gefunden</h2><p>Der Kraftzyklus enthält keine gültige Einheit.</p></section>`;
  }

  return`<section class="strength-start-card ${model.restDay.isRestDay?'rest':''}">
    <span class="strength-kicker">${model.restDay.isRestDay?'☾ Rest Day':'● Nächste Einheit'}</span>
    <h1>${escapeHtml(model.unit.name)}</h1>
    <p>${model.unitActivities.length} ${model.unitActivities.length===1?'Übung':'Übungen'} im Plan</p>
    <div class="training-start-actions">
      <button class="training-primary" data-action="strength.start" data-unit="${model.unit.id}">Jetzt starten</button>
      <button class="training-secondary" data-action="strength.skip" data-unit="${model.unit.id}" data-name="${escapeHtml(model.unit.name)}">Überspringen ›</button>
    </div>
    <button class="training-free" data-action="strength.free">Freie Session starten</button>
  </section>`;
}

function todayView(state){
  const model=todayStrengthModel(state);

  let content;
  if(model.open)content=openSessionView(state,model.open);
  else if(model.completed)content=completedTodayView(state,model.completed);
  else content=readyTodayView(model);

  return pageShell('today',`<div class="strength-today">${content}</div>`);
}

function exercisePickerView(){
  if(!exercisePicker)return'';

  const{state,sessionId}=exercisePicker;
  const activities=activeStrengthActivities(state);

  return`<div class="strength-picker-backdrop" data-action="strength.picker.close"></div>
    <section class="strength-picker" role="dialog" aria-modal="true">
      <header><div><span class="eyebrow"><i></i>Kraft</span><h2>Übung hinzufügen</h2></div>
        <button class="icon-button" data-action="strength.picker.close">×</button></header>
      <input class="strength-picker-search" type="search" placeholder="Übung suchen …" data-strength-picker-search>
      <div class="strength-picker-list">${activities.map(activity=>`
        <button class="strength-picker-choice" data-action="strength.picker.choose"
          data-session="${sessionId}" data-activity="${activity.id}" data-search="${escapeHtml(activity.name.toLowerCase())}">
          <span class="exercise-kind ${isStrengthActivity(activity)?'strength':'cardio'}">${isStrengthActivity(activity)?icons.strength:icons.cardio}</span>
          <span><strong>${escapeHtml(activity.name)}</strong><small>${escapeHtml(activityType(activity))}${activityFlags(activity).length?` · ${escapeHtml(activityFlags(activity).join(' · '))}`:''}</small></span>
          ${icons.chevron}
        </button>`).join('')}</div>
    </section>`;
}

export function resetStrengthSessionUi(session){
  collapsedSegments.clear();
  openedCompletedSegments.clear();
  for(const segment of session?.segmente??[]){
    if(segment.erledigt===true)collapsedSegments.add(segment.id);
  }
}

export function toggleStrengthTrainingSegment(id,done=false){
  if(done){
    openedCompletedSegments.has(id)
      ?openedCompletedSegments.delete(id)
      :openedCompletedSegments.add(id);
    return;
  }

  collapsedSegments.has(id)
    ?collapsedSegments.delete(id)
    :collapsedSegments.add(id);
}

export function syncStrengthSegmentDone(id,done){
  collapsedSegments.delete(id);
  openedCompletedSegments.delete(id);
  if(done)collapsedSegments.add(id);
}

export function openStrengthExercisePicker(state,sessionId){
  exercisePicker={state,sessionId};
}

export function closeStrengthExercisePicker(){
  exercisePicker=null;
}

export function strengthExerciseWasAdded(segment){
  exercisePicker=null;
  collapsedSegments.delete(segment.id);
}
function overlayShell(title,content,{wide=false}={}){
  return`<div class="strength-editor-backdrop" data-action="strength.editor.close"></div>
    <section class="strength-editor-sheet ${wide?'wide':''}" role="dialog" aria-modal="true">
      <header><div><span class="eyebrow"><i></i>Kraft</span><h2>${escapeHtml(title)}</h2></div>
        <button class="icon-button" data-action="strength.editor.close">×</button></header>
      <div class="strength-editor-content">${content}</div>
    </section>`;
}

function metricCheckboxes(selected=[]){
  const labels={
    gewicht:'Gewicht',wdh:'Wiederholungen',dauer:'Dauer',distanz:'Distanz',
    puls_avg:'Ø Puls',puls_max:'Max. Puls',kalorien:'Kalorien',hoehenmeter:'Höhenmeter',
    schritte:'Schritte',tempo_avg:'Ø Tempo',tempo_max:'Max. Tempo',watt_avg:'Ø Leistung',
    trittfrequenz:'Trittfrequenz'
  };
  return`<div class="editor-check-grid">${STRENGTH_METRICS.map(metric=>`<label>
    <input type="checkbox" name="metrics" value="${metric}" ${selected.includes(metric)?'checked':''}>
    <span>${escapeHtml(labels[metric]??metric)}</span></label>`).join('')}</div>`;
}

function strengthEditorOverlayView(){
  if(!strengthEditorOverlay)return'';
  const{type,state}=strengthEditorOverlay;

  if(type==='cycle-add'){
    const units=strengthUnits(state);
    return overlayShell('Einheit zum Zyklus hinzufügen',`
      <p class="editor-help">Eine Einheit darf mehrfach im Zyklus vorkommen.</p>
      <div class="editor-choice-list">${units.map(unit=>`<button data-action="strength.cycle.add.choose" data-unit="${unit.id}">
        <span><strong>${escapeHtml(unit.name)}</strong><small>${unitActivities(state,unit).length} Übungen · ${unitUsage(state,unit.id)}× im Zyklus</small></span>${icons.chevron}</button>`).join('')||'<p class="editor-empty">Lege zuerst eine Einheit an.</p>'}</div>`);
  }

  if(type==='correct-today'){
    const rows=cycleRows(state);
    return overlayShell('Zyklusposition wählen',`
      <p class="editor-help">Die heutige offene oder abgeschlossene Kraftsession wird beim Bestätigen vollständig verworfen.</p>
      <div class="editor-choice-list numbered">${rows.map(row=>`<button data-action="strength.correct.choose" data-index="${row.index}" data-name="${escapeHtml(row.unit?.name??'Einheit')}">
        <b>${row.index+1}</b><span><strong>${escapeHtml(row.unit?.name??'Fehlende Einheit')}</strong><small>${row.restDay.isRestDay?'Rest Day':'Krafteinheit'}${row.isCurrent?' · aktuell':''}</small></span>${icons.chevron}</button>`).join('')}</div>`);
  }

  if(type==='unit-form'){
    const unit=strengthEditorOverlay.unitId?strengthUnits(state).find(item=>item.id===strengthEditorOverlay.unitId):null;
    return overlayShell(unit?'Einheit bearbeiten':'Einheit anlegen',`
      <form id="strength-unit-form" class="editor-form" data-unit="${unit?.id??''}">
        <label><span>Name</span><input name="name" required value="${escapeHtml(unit?.name??'')}" placeholder="z. B. Rücken · Bizeps"></label>
        <label class="editor-switch"><input type="checkbox" name="restDay" ${unit&&(unit.restDay===true||unit.typ==='rest'||restDayInfo(state,unit).isRestDay)?'checked':''}>
          <span><strong>Als Rest Day markieren</strong><small>Wird beim Tageswechsel automatisch weitergeschaltet.</small></span></label>
        <button type="button" class="editor-primary" data-action="strength.unit.save">${unit?'Änderungen speichern':'Einheit anlegen'}</button>
      </form>`);
  }

  if(type==='unit-activity'){
    const unit=strengthUnits(state).find(item=>item.id===strengthEditorOverlay.unitId);
    const activities=activeStrengthActivities(state);
    return overlayShell(`Übung zu ${unit?.name??'Einheit'} hinzufügen`,`
      <input class="editor-search" type="search" placeholder="Übung suchen …" data-editor-search>
      <div class="editor-choice-list">${activities.map(activity=>`<button data-action="strength.unit.activity.choose" data-unit="${unit?.id??''}" data-activity="${activity.id}" data-search="${escapeHtml(activity.name.toLowerCase())}">
        <span><strong>${escapeHtml(activity.name)}</strong><small>${escapeHtml(activityType(activity))}${activity.archiviert?' · archiviert':''}</small></span>${icons.chevron}</button>`).join('')}</div>`);
  }

  if(type==='activity-form'){
    const activity=strengthEditorOverlay.activityId?state.bibliothek.find(item=>item.id===strengthEditorOverlay.activityId):null;
    const settings=activity?.einstellungen??{};
    const prog=settings.prog??{};
    return overlayShell(activity?'Übung bearbeiten':'Übung anlegen',`
      <form id="strength-activity-form" class="editor-form" data-activity="${activity?.id??''}">
        <label><span>Name</span><input name="name" required value="${escapeHtml(activity?.name??'')}" placeholder="z. B. Lat-Zug Dreiecksgriff"></label>
        <label><span>Typ</span><select name="category" data-activity-category>
          <option value="kraft" ${activity?.kategorie==='kraft'?'selected':''}>Kraft</option>
          <option value="sonstiges" ${activity&&activity.kategorie!=='kraft'?'selected':''}>Cardio / Sonstiges</option>
        </select></label>
        <div class="editor-section"><span>Messwerte</span>${metricCheckboxes(activity?.messwerte??(!activity||activity.kategorie==='kraft'?['gewicht','wdh']:['dauer','puls_avg','puls_max']))}</div>
        <div class="editor-strength-settings ${activity&&activity.kategorie!=='kraft'?'hidden':''}" data-strength-settings>
          <div class="editor-two-switches">
            <label class="editor-switch compact"><input type="checkbox" name="unilateral" ${settings.einarmig?'checked':''}><span><strong>Einarmig</strong><small>Linke und rechte Wiederholungen getrennt</small></span></label>
            <label class="editor-switch compact"><input type="checkbox" name="assisted" ${settings.assist?'checked':''}><span><strong>Assistiert</strong><small>Hilfegewicht als negativer Wert</small></span></label>
          </div>
          <label><span>Progression</span><select name="progression" data-progression-select>
            <option value="off" ${!prog.art||prog.art==='off'?'selected':''}>Aus</option>
            <option value="double" ${prog.art==='double'?'selected':''}>Double Progression</option>
            <option value="strength" ${prog.art==='strength'?'selected':''}>Feste Wiederholungen</option>
            <option value="technik" ${prog.art==='technik'?'selected':''}>Technik</option>
          </select></label>
          <div class="editor-progression-fields ${!prog.art||prog.art==='off'||prog.art==='technik'?'hidden':''}" data-progression-fields>
            <label data-progression-common><span>Sätze</span><input name="sets" inputmode="numeric" value="${prog.saetze??4}"></label>
            <label data-progression-common><span>Schritt · kg</span><input name="step" inputmode="decimal" value="${prog.schritt??2.5}"></label>
            <label data-progression-double class="${prog.art&&prog.art!=='double'?'hidden':''}"><span>Wdh. min</span><input name="repsMin" inputmode="numeric" value="${prog.wdhMin??8}"></label>
            <label data-progression-double class="${prog.art&&prog.art!=='double'?'hidden':''}"><span>Wdh. max</span><input name="repsMax" inputmode="numeric" value="${prog.wdhMax??12}"></label>
            <label data-progression-strength class="${prog.art!=='strength'?'hidden':''}"><span>Feste Wdh.</span><input name="reps" inputmode="numeric" value="${prog.wdh??12}"></label>
          </div>
        </div>
        <label><span>Notiz / Gerät</span><textarea name="note" rows="3" placeholder="z. B. Sitzposition oder Gerätehinweis">${escapeHtml(activity?.notiz??'')}</textarea></label>
        <button type="button" class="editor-primary" data-action="strength.activity.save">${activity?'Änderungen speichern':'Übung anlegen'}</button>
      </form>`,{wide:true});
  }

  if(type==='alternative-add'){
    const activity=state.bibliothek.find(item=>item.id===strengthEditorOverlay.activityId);
    const linked=new Set(activity?.alternativen??[]);
    const choices=activeStrengthActivities(state).filter(item=>item.id!==activity?.id&&!linked.has(item.id));
    return overlayShell(`Alternative für ${activity?.name??'Übung'}`,`
      <input class="editor-search" type="search" placeholder="Alternative suchen …" data-editor-search>
      <div class="editor-choice-list">${choices.map(item=>`<button data-action="strength.alternative.choose" data-activity="${activity?.id??''}" data-alternative="${item.id}" data-search="${escapeHtml(item.name.toLowerCase())}">
        <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(activityType(item))}</small></span>${icons.chevron}</button>`).join('')||'<p class="editor-empty">Keine weitere Übung verfügbar.</p>'}</div>`);
  }

  return'';
}

export function openStrengthCyclePicker(state){strengthEditorOverlay={type:'cycle-add',state}}
export function openStrengthCorrectToday(state){strengthEditorOverlay={type:'correct-today',state}}
export function openStrengthUnitEditor(state,unitId=null){strengthEditorOverlay={type:'unit-form',state,unitId}}
export function openStrengthUnitActivityPicker(state,unitId){strengthEditorOverlay={type:'unit-activity',state,unitId}}
export function openStrengthActivityEditor(state,activityId=null){strengthEditorOverlay={type:'activity-form',state,activityId}}
export function openStrengthAlternativePicker(state,activityId){strengthEditorOverlay={type:'alternative-add',state,activityId}}
export function closeStrengthEditor(){strengthEditorOverlay=null}

function cycleSection(state){
  const rows=cycleRows(state);

  return`<p class="section-label">Zyklus · Ablauf</p>
    <section class="panel strength-cycle editable">
      ${rows.length?rows.map(row=>`<div class="strength-cycle-row ${row.isCurrent?'current':''}">
        <span class="cycle-index">${row.index+1}</span>
        <div><strong>${escapeHtml(row.unit?.name??'Fehlende Einheit')}</strong><small>${row.restDay.isRestDay?'Rest Day · ':''}${row.isCurrent?'heute':'Zyklusposition'}</small></div>
        <div class="cycle-actions">
          <button data-action="strength.cycle.move" data-index="${row.index}" data-direction="-1" ${row.index===0?'disabled':''} aria-label="Hoch">↑</button>
          <button data-action="strength.cycle.move" data-index="${row.index}" data-direction="1" ${row.index===rows.length-1?'disabled':''} aria-label="Runter">↓</button>
          <button data-action="strength.cycle.remove" data-index="${row.index}" data-name="${escapeHtml(row.unit?.name??'Einheit')}" aria-label="Entfernen">×</button>
        </div>
      </div>`).join(''):'<p class="strength-empty-copy">Der Zyklus ist leer.</p>'}
    </section>
    <div class="plan-action-row"><button class="training-small-button" data-action="strength.cycle.add.open">+ Einheit in den Zyklus</button>
      ${rows.length?'<button class="training-small-button accent" data-action="strength.correct.open">Heute korrigieren</button>':''}</div>`;
}

function unitActivityEditorRows(state,unit){
  const rows=unitActivities(state,unit);
  return`<div class="unit-editor-rows">${rows.map(row=>`<div class="unit-editor-row">
    <span>${row.index+1}</span><div><strong>${escapeHtml(row.activity?.name??'Fehlende Übung')}</strong><small>${escapeHtml(activityType(row.activity))}</small></div>
    <div><button data-action="strength.unit.activity.move" data-unit="${unit.id}" data-index="${row.index}" data-direction="-1" ${row.index===0?'disabled':''}>↑</button>
      <button data-action="strength.unit.activity.move" data-unit="${unit.id}" data-index="${row.index}" data-direction="1" ${row.index===rows.length-1?'disabled':''}>↓</button>
      <button data-action="strength.unit.activity.remove" data-unit="${unit.id}" data-index="${row.index}" data-name="${escapeHtml(row.activity?.name??'Übung')}">×</button></div>
  </div>`).join('')}</div>`;
}

function unitsSection(state){
  const units=strengthUnits(state);

  return`<div class="strength-section-head plan-library-head">
      <div><p class="section-label inline">Einheiten · Bibliothek</p><h2>${units.length} Einheiten</h2></div>
      <button class="small-link" data-action="strength.nav" data-path="/module/kraft/library">Übungen ansehen ${icons.chevron}</button>
    </div>
    <div class="strength-unit-list">${units.map(unit=>{
      const expanded=expandedUnits.has(unit.id);
      const rest=restDayInfo(state,unit);
      const activities=unitActivities(state,unit);

      return`<section class="panel strength-unit-card ${expanded?'expanded':''}">
        <div class="strength-unit-head-wrap"><button class="strength-unit-head" data-action="strength.unit.toggle" data-id="${unit.id}">
          <span><strong>${escapeHtml(unit.name)}</strong><small>${activities.length} Übungen · ${unitUsage(state,unit.id)}× im Zyklus${rest.isRestDay?' · Rest Day':''}</small></span>
          <i class="${expanded?'open':''}">${icons.chevron}</i></button>
          <button class="unit-edit-button" data-action="strength.unit.edit" data-unit="${unit.id}" aria-label="Bearbeiten">${icons.edit}</button></div>
        ${expanded?`<div class="strength-unit-body">${unitActivityEditorRows(state,unit)}
          <button class="training-small-button" data-action="strength.unit.activity.open" data-unit="${unit.id}">+ Übung hinzufügen</button>
          <button class="unit-delete-button" data-action="strength.unit.delete" data-unit="${unit.id}" data-name="${escapeHtml(unit.name)}">Einheit löschen</button></div>`:''}
      </section>`;
    }).join('')}</div>
    <button class="editor-primary plan-create-button" data-action="strength.unit.create">+ Einheit anlegen</button>`;
}

function planView(state){
  const plan=strengthPlan(state);

  return pageShell('plan',`
    <div class="strength-title"><span class="eyebrow"><i></i>Kraft</span><h1>Plan</h1><p>Zyklus und Einheitenbibliothek</p></div>
    ${plan?cycleSection(state):'<section class="panel strength-empty"><h2>Noch kein Plan</h2><p>Lege deine erste Einheit an und füge sie anschließend in den Zyklus ein.</p></section>'}
    ${unitsSection(state)}
  `);
}

function libraryView(state){
  const all=strengthActivities(state);
  const activities=all.filter(activity=>
    libraryFilter==='archived'?activity.archiviert:
    !activity.archiviert&&(
      libraryFilter==='all'
      ||(libraryFilter==='strength'&&activity.kategorie==='kraft')
      ||(libraryFilter==='cardio'&&activity.kategorie!=='kraft')
    )
  );

  return pageShell('library',`
    <div class="strength-title library-title"><span class="eyebrow"><i></i>Kraft</span><h1>Übungsbibliothek</h1><p>Wiederverwendbare Übungen und ihre Alternativen</p></div>
    <div class="strength-filters four">
      ${[['all','Alle'],['strength','Kraft'],['cardio','Cardio'],['archived','Archiv']].map(([id,label])=>`<button class="${libraryFilter===id?'active':''}" data-action="strength.library.filter" data-filter="${id}">${label}</button>`).join('')}
    </div>
    <div class="library-count">${activities.length} von ${all.length} Aktivitäten</div>
    <div class="strength-exercise-list">${activities.map(activity=>{
      const expanded=expandedExercises.has(activity.id);
      const alternatives=alternativeActivities(state,activity);
      const flags=activityFlags(activity);

      return`<section class="panel strength-exercise-card ${expanded?'expanded':''} ${activity.archiviert?'archived':''}">
        <button class="strength-exercise-head" data-action="strength.exercise.toggle" data-id="${activity.id}">
          <span class="exercise-kind ${activity.kategorie==='kraft'?'strength':'cardio'}">${activity.kategorie==='kraft'?icons.strength:icons.cardio}</span>
          <span><strong>${escapeHtml(activity.name)}</strong><small>${escapeHtml(activityType(activity))} · ${activityUsage(state,activity.id)}× in Einheiten · ${alternatives.length} Alternativen${activity.archiviert?' · archiviert':''}</small></span>
          <i class="${expanded?'open':''}">${icons.chevron}</i>
        </button>
        ${expanded?`<div class="strength-exercise-body">
          <div class="exercise-meta"><span>Messwerte</span><p>${(activity.messwerte??[]).map(metric=>`<b>${escapeHtml(metricLabels[metric]??metric)}</b>`).join('')||'<em>Keine</em>'}</p></div>
          ${flags.length?`<div class="exercise-meta"><span>Einstellungen</span><p>${flags.map(flag=>`<b>${escapeHtml(flag)}</b>`).join('')}</p></div>`:''}
          ${activity.notiz?`<div class="exercise-note">${escapeHtml(activity.notiz)}</div>`:''}
          <div class="exercise-alternatives"><span>Alternativen</span>${alternatives.length?alternatives.map(item=>`<div>${icons.swap}<strong>${escapeHtml(item.name)}</strong><button data-action="strength.alternative.remove" data-activity="${activity.id}" data-alternative="${item.id}" data-name="${escapeHtml(item.name)}">×</button></div>`).join(''):'<p>Keine Alternativen verknüpft.</p>'}</div>
          <div class="exercise-edit-actions"><button data-action="strength.activity.edit" data-activity="${activity.id}">${icons.edit} Bearbeiten</button>
            <button data-action="strength.alternative.open" data-activity="${activity.id}">${icons.swap} Alternative</button>
            <button class="${activity.archiviert?'reactivate':'archive'}" data-action="strength.activity.${activity.archiviert?'reactivate':'archive'}" data-activity="${activity.id}" data-name="${escapeHtml(activity.name)}">${activity.archiviert?'Reaktivieren':'Archivieren'}</button></div>
        </div>`:''}
      </section>`;
    }).join('')||'<section class="panel strength-empty"><p>In diesem Filter sind keine Übungen vorhanden.</p></section>'}</div>
    <button class="editor-primary plan-create-button" data-action="strength.activity.create">+ Übung anlegen</button>
  `);
}

function historySegmentRow(state,segment){
  // Eine Tagesalternative besitzt weiterhin die ursprüngliche aktivitaetId,
  // während altOf auf die tatsächlich verwendete Bibliotheksübung zeigt.
  // Im Verlauf muss deshalb die aufgelöste Aktivität angezeigt werden.
  const activity=resolvedStrengthActivity(state,segment);
  if(!activity)return`<div class="history-segment missing">Fehlende Aktivität · ${escapeHtml(segment.altOf??segment.aktivitaetId)}</div>`;

  if(activity.kategorie==='kraft'){
    const entries=segment.eintraege??[];
    const weights=entries.map(entry=>entry.messwerte?.gewicht).filter(Number.isFinite);
    const top=weights.length?Math.max(...weights):null;
    return`<div class="history-segment strength"><i></i><span><strong>${escapeHtml(activity.name)}</strong><small>${entries.length} ${entries.length===1?'Satz':'Sätze'}${top!=null?` · ${top<0?`${formatNumber(Math.abs(top),1)} kg Hilfe`:`${formatNumber(top,1)} kg`}`:''}</small></span></div>`;
  }

  const metrics=segment.eintraege?.[0]?.messwerte??{};
  const text=(activity.messwerte??Object.keys(metrics)).filter(type=>metrics[type]!=null).map(type=>formatMetric(type,metrics[type])).join(' · ');
  return`<div class="history-segment cardio"><i></i><span><strong>${escapeHtml(activity.name)}</strong><small>${escapeHtml(text||'Keine Werte')}</small></span></div>`;
}

function historyView(state){
  const sessions=completedStrengthSessions(state);

  return pageShell('history',`
    <div class="strength-title"><span class="eyebrow"><i></i>Kraft</span><h1>Verlauf</h1><p>Importierte, abgeschlossene Einheiten</p></div>
    ${readOnlyBanner('Fortschrittscharts und Teilen folgen in 0.2.3.')}
    <div class="history-summary"><strong>${sessions.length}</strong><span>abgeschlossene Einheiten</span></div>
    <div class="strength-history-list">${sessions.map(session=>{
      const expanded=expandedHistory.has(session.id);
      const summary=strengthSessionSummary(state,session);

      return`<section class="panel strength-history-card ${expanded?'expanded':''}">
        <button class="strength-history-head" data-action="strength.history.toggle" data-id="${session.id}">
          <span><strong>${escapeHtml(summary.title)}</strong><small>${escapeHtml(formatDate(session.datum))} · ${summary.segmentCount} Aktivitäten</small></span>
          <span><b>${summary.volume>0?`${formatNumber(summary.volume,0)} kg`:summary.duration>0?formatDuration(summary.duration):'–'}</b><i class="${expanded?'open':''}">${icons.chevron}</i></span>
        </button>
        ${expanded?`<div class="strength-history-body">${summary.segments.map(segment=>historySegmentRow(state,segment)).join('')||'<p>Keine erledigten Segmente.</p>'}${session.notiz?`<div class="history-note">${escapeHtml(session.notiz)}</div>`:''}</div>`:''}
      </section>`;
    }).join('')||'<section class="panel strength-empty"><h2>Noch kein Verlauf</h2><p>Es wurden keine abgeschlossenen Kraftsessions gefunden.</p></section>'}</div>
  `);
}

export function strengthView(state,view='today'){
  if(view==='plan')return planView(state);
  if(view==='library')return libraryView(state);
  if(view==='history')return historyView(state);
  return todayView(state);
}

export function toggleStrengthUnit(id){
  expandedUnits.has(id)?expandedUnits.delete(id):expandedUnits.add(id);
}

export function toggleStrengthExercise(id){
  expandedExercises.has(id)?expandedExercises.delete(id):expandedExercises.add(id);
}

export function toggleStrengthHistory(id){
  expandedHistory.has(id)?expandedHistory.delete(id):expandedHistory.add(id);
}

export function setStrengthLibraryFilter(filter){
  if(['all','strength','cardio','archived'].includes(filter))libraryFilter=filter;
}
