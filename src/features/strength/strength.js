import{formatDate}from'../../core/date.js';
import{activityById}from'../../core/model.js';
import{escapeHtml,formatDistance,formatDuration,formatMetric,formatNumber}from'../../ui/format.js';
import{icons}from'../../ui/icons.js';
import{
  activityUsage,
  alternativeActivities,
  completedStrengthSessions,
  cycleRows,
  restDayInfo,
  sessionTitle,
  strengthActivities,
  strengthDataAudit,
  strengthPlan,
  strengthSessionSummary,
  strengthUnits,
  todayStrengthModel,
  unitActivities,
  unitUsage
}from'./strength-model.js';

const expandedUnits=new Set();
const expandedExercises=new Set();
const expandedHistory=new Set();
let libraryFilter='all';

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
  return`<section class="strength-page">${content}</section>${strengthBottomNav(view)}`;
}

function readOnlyBanner(){
  return`<div class="strength-readonly">${icons.info}<span><strong>Prüfstand 0.2.0</strong> Daten und Zyklus sind lesbar. Starten, Ändern und Speichern folgen in 0.2.1.</span></div>`;
}

function activityType(activity){
  return activity?.kategorie==='kraft'?'Kraft':'Cardio';
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

function todayView(state){
  const model=todayStrengthModel(state);
  const audit=strengthDataAudit(state);

  if(!model.plan){
    return pageShell('today',`
      <div class="strength-title"><span class="eyebrow"><i></i>Kraft</span><h1>Heute</h1></div>
      ${readOnlyBanner()}
      <section class="panel strength-empty"><h2>Kein Kraftplan importiert</h2><p>Importiere dein Backup der alten App. Danach werden Zyklus, Einheiten und Bibliothek hier angezeigt.</p></section>
    `);
  }

  const unit=model.unit;
  const rest=model.restDay.isRestDay;
  const count=model.unitActivities.length;
  const summary=model.completed?strengthSessionSummary(state,model.completed):null;

  let hero;

  if(model.status==='completed'){
    hero=`<section class="strength-today-card completed">
      <span class="strength-kicker">✓ Heute abgeschlossen</span>
      <h1>${escapeHtml(summary.title)}</h1>
      <p>${summary.volume>0?`${formatNumber(summary.volume,0)} kg bewegt`:summary.duration>0?formatDuration(summary.duration):'Einheit gespeichert'}${summary.distance>0?` · ${formatDistance(summary.distance)}`:''}</p>
      <div class="strength-status-line"><span>${summary.segmentCount} Aktivitäten</span><span>Zyklustag ${model.position+1} von ${model.cycle.length}</span></div>
    </section>`;
  }else if(model.status==='open'){
    hero=`<section class="strength-today-card open-session">
      <span class="strength-kicker">● Offene Session gefunden</span>
      <h1>${escapeHtml(sessionTitle(state,model.open))}</h1>
      <p>Die bestehende Session wurde aus dem alten Datenstand erkannt.</p>
      <div class="strength-status-line"><span>${model.open.segmente?.length??0} Segmente</span><span>Zyklustag ${model.position+1} von ${model.cycle.length}</span></div>
    </section>`;
  }else{
    hero=`<section class="strength-today-card ${rest?'rest':''}">
      <span class="strength-kicker">${rest?'☾ Rest Day':'● Nächste Einheit'}</span>
      <h1>${escapeHtml(unit?.name??'Unbekannte Einheit')}</h1>
      <p>${count} ${count===1?'Aktivität':'Aktivitäten'} im Plan</p>
      <div class="strength-status-line"><span>Zyklustag ${model.position+1} von ${model.cycle.length}</span>${rest?`<span>${model.restDay.source==='explicit'?'explizit markiert':'aus Cardio-Inhalt erkannt'}</span>`:''}</div>
    </section>`;
  }

  const activityList=unit?`<section class="panel today-unit-preview">
    <div class="strength-section-head"><div><span class="section-label inline">Einheit</span><h2>${escapeHtml(unit.name)}</h2></div><span>${count}</span></div>
    <div class="unit-activities">${model.unitActivities.map(row=>compactActivityRow(state,row)).join('')}</div>
  </section>`:'';

  return pageShell('today',`
    <div class="strength-title"><span class="eyebrow"><i></i>Kraft</span><h1>Heute</h1></div>
    ${readOnlyBanner()}
    ${hero}
    ${activityList}
    <section class="strength-audit">
      <span>${audit.units} Einheiten</span><span>${audit.activities} Übungen</span><span>${audit.sessions} Trainings</span>
    </section>
  `);
}

function cycleSection(state){
  const rows=cycleRows(state);

  return`<p class="section-label">Zyklus · Ablauf</p>
    <section class="panel strength-cycle">
      ${rows.length?rows.map(row=>`<div class="strength-cycle-row ${row.isCurrent?'current':''}">
        <span class="cycle-index">${row.index+1}</span>
        <div><strong>${escapeHtml(row.unit?.name??'Fehlende Einheit')}</strong><small>${row.restDay.isRestDay?'Rest Day · ':''}${row.isCurrent?'heute':'Zyklusposition'}</small></div>
        ${row.isCurrent?'<b>Heute</b>':''}
      </div>`).join(''):'<p class="strength-empty-copy">Der Zyklus ist leer.</p>'}
    </section>`;
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
        <button class="strength-unit-head" data-action="strength.unit.toggle" data-id="${unit.id}">
          <span><strong>${escapeHtml(unit.name)}</strong><small>${activities.length} Übungen · ${unitUsage(state,unit.id)}× im Zyklus${rest.isRestDay?' · Rest Day':''}</small></span>
          <i class="${expanded?'open':''}">${icons.chevron}</i>
        </button>
        ${expanded?`<div class="strength-unit-body">${activities.map(row=>compactActivityRow(state,row)).join('')}</div>`:''}
      </section>`;
    }).join('')}</div>`;
}

function planView(state){
  const plan=strengthPlan(state);

  return pageShell('plan',`
    <div class="strength-title"><span class="eyebrow"><i></i>Kraft</span><h1>Plan</h1><p>Zyklus und Einheitenbibliothek</p></div>
    ${readOnlyBanner()}
    ${plan?cycleSection(state):'<section class="panel strength-empty"><h2>Kein Plan vorhanden</h2><p>Im importierten Backup wurde kein Kraftplan gefunden.</p></section>'}
    ${plan?unitsSection(state):''}
  `);
}

function libraryView(state){
  const all=strengthActivities(state);
  const activities=all.filter(activity=>
    libraryFilter==='all'
    ||(libraryFilter==='strength'&&activity.kategorie==='kraft')
    ||(libraryFilter==='cardio'&&activity.kategorie!=='kraft')
  );

  return pageShell('library',`
    <div class="strength-title library-title"><span class="eyebrow"><i></i>Kraft</span><h1>Übungsbibliothek</h1><p>Wiederverwendbare Übungen und ihre Alternativen</p></div>
    ${readOnlyBanner()}
    <div class="strength-filters">
      ${[['all','Alle'],['strength','Kraft'],['cardio','Cardio']].map(([id,label])=>`<button class="${libraryFilter===id?'active':''}" data-action="strength.library.filter" data-filter="${id}">${label}</button>`).join('')}
    </div>
    <div class="library-count">${activities.length} von ${all.length} Aktivitäten</div>
    <div class="strength-exercise-list">${activities.map(activity=>{
      const expanded=expandedExercises.has(activity.id);
      const alternatives=alternativeActivities(state,activity);
      const flags=activityFlags(activity);

      return`<section class="panel strength-exercise-card ${expanded?'expanded':''}">
        <button class="strength-exercise-head" data-action="strength.exercise.toggle" data-id="${activity.id}">
          <span class="exercise-kind ${activity.kategorie==='kraft'?'strength':'cardio'}">${activity.kategorie==='kraft'?icons.strength:icons.cardio}</span>
          <span><strong>${escapeHtml(activity.name)}</strong><small>${escapeHtml(activityType(activity))} · ${activityUsage(state,activity.id)}× in Einheiten · ${alternatives.length} Alternativen</small></span>
          <i class="${expanded?'open':''}">${icons.chevron}</i>
        </button>
        ${expanded?`<div class="strength-exercise-body">
          <div class="exercise-meta"><span>Messwerte</span><p>${(activity.messwerte??[]).map(metric=>`<b>${escapeHtml(metricLabels[metric]??metric)}</b>`).join('')||'<em>Keine</em>'}</p></div>
          ${flags.length?`<div class="exercise-meta"><span>Einstellungen</span><p>${flags.map(flag=>`<b>${escapeHtml(flag)}</b>`).join('')}</p></div>`:''}
          ${activity.notiz?`<div class="exercise-note">${escapeHtml(activity.notiz)}</div>`:''}
          <div class="exercise-alternatives"><span>Alternativen</span>${alternatives.length?alternatives.map(item=>`<div>${icons.swap}<strong>${escapeHtml(item.name)}</strong></div>`).join(''):'<p>Keine Alternativen verknüpft.</p>'}</div>
        </div>`:''}
      </section>`;
    }).join('')}</div>
  `);
}

function historySegmentRow(state,segment){
  const activity=activityById(state,segment.aktivitaetId);
  if(!activity)return`<div class="history-segment missing">Fehlende Aktivität · ${escapeHtml(segment.aktivitaetId)}</div>`;

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
    ${readOnlyBanner()}
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
  if(['all','strength','cardio'].includes(filter))libraryFilter=filter;
}
