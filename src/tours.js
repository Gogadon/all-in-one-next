import{id,todayIso,parseDuration,parseNumber,sessionMetrics,completedSessions,formatMetric,formatDate,esc,METRICS}from'./core.js';let editor=null;export const currentEditor=()=>editor;const clone=x=>structuredClone(x);export function newTour(module,date=todayIso()){editor={mode:'create',moduleId:module.id,draft:{id:id('session'),moduleId:module.id,date,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'draft',title:'',note:'',segments:[{id:id('segment'),activityId:`activity_${module.id}`,entries:[{id:id('entry'),metrics:{},flags:[],source:'manual'}]}]}}}export function editTour(session){editor={mode:'edit',moduleId:session.moduleId,draft:clone(session)}}export function cancelEdit(){editor=null}export function setTitle(v){if(editor)editor.draft.title=v}export function setMetric(module,type,raw){if(!editor)return;const m=sessionMetrics(editor.draft);let v;if(type==='duration')v=parseDuration(raw,module.durationMode);else if(type==='distance'){const n=parseNumber(raw);v=n==null?null:Math.round(n*1000)}else v=parseNumber(raw);if(v==null)delete m[type];else m[type]=v}export function saveTour(state){if(!editor)throw Error('Keine Tour geöffnet.');if(!Object.keys(sessionMetrics(editor.draft)).length)throw Error('Trag mindestens einen Wert ein.');const d=clone(editor.draft);d.status='completed';d.updatedAt=new Date().toISOString();if(editor.mode==='create')state.sessions.push(d);else{const i=state.sessions.findIndex(s=>s.id===d.id);if(i<0)throw Error('Tour nicht gefunden.');state.sessions[i]=d}editor=null;return d}export const deleteTour=(state,sid)=>{state.sessions=state.sessions.filter(s=>s.id!==sid)};

function moduleHero(module,title,subtitle=''){
  return`<section class="module-hero"><div class="module-hero__icon">${module.icon}</div><div><span class="eyebrow">${esc(module.label)}</span><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div></section>`
}

export function overview(state,module){
  const ss=completedSessions(state,module.id);
  const totalDistance=ss.reduce((sum,s)=>sum+(sessionMetrics(s).distance||0),0);
  const cards=ss.length?ss.map(s=>{const m=sessionMetrics(s),meta=module.listMetrics.filter(t=>m[t]!=null).map(t=>formatMetric(t,m[t])).join(' · ');return`<button class="session" data-action="tour.open" data-id="${s.id}"><span class="session__accent"></span><span class="session__main"><strong>${esc(s.title||module.singular)}</strong><small>${esc(formatDate(s.date))}${meta?' · '+esc(meta):''}</small></span><span class="session__arrow">›</span></button>`}).join(''):`<div class="card empty"><span class="empty__icon">${module.icon}</span><strong>Noch keine ${esc(module.plural)}</strong><p>Deine gespeicherten Einträge erscheinen später hier.</p></div>`;
  return`${moduleHero(module,module.plural,ss.length?`${ss.length} Einträge · ${formatMetric('distance',totalDistance)}`:'Bereit für deinen ersten Eintrag')}
  <button class="button primary create-button" data-action="tour.new"><span>+</span>${esc(module.singular)} eintragen</button>
  <div class="section-title top"><span>Zuletzt</span><small>${ss.length?`${ss.length} gesamt`:''}</small></div>
  <div class="stack">${cards}</div>`
}

export function editorView(module){
  if(!editor)return'<div class="card empty">Kein Entwurf geöffnet.</div>';
  const d=editor.draft,m=sessionMetrics(d);
  const fields=module.defaultMetrics.map(t=>{const def=METRICS[t];let v=m[t]!=null?(t==='duration'?formatMetric(t,m[t]):t==='distance'?String(m[t]/1000).replace('.',','):String(m[t]).replace('.',',')):'';return`<label class="metric-field"><span>${esc(def.label)}${def.unit?' · '+esc(def.unit):''}</span><input data-change="tour.metric" data-type="${t}" value="${esc(v)}" placeholder="${t==='duration'?(module.durationMode==='minutes-seconds'?'35:50':'2:30'):'0'}"></label>`}).join('');
  return`${moduleHero(module,editor.mode==='create'?`Neue ${module.singular}`:`${module.singular} bearbeiten`,'Werte werden erst beim Speichern übernommen')}
  <div class="editor-card stack"><label class="metric-field"><span>Name · optional</span><input data-change="tour.title" value="${esc(d.title)}" placeholder="${esc(module.singular)}"></label>${fields}</div>
  <div class="stack top"><button class="button primary" data-action="tour.save">Änderungen speichern</button><button class="button" data-action="tour.cancel">Abbrechen</button></div>`
}

export function detail(state,module,sid){
  const s=state.sessions.find(x=>x.id===sid);if(!s)return'<div class="card empty">Nicht gefunden.</div>';
  const m=sessionMetrics(s),rows=module.metrics.filter(t=>m[t]!=null).map(t=>`<div class="detail"><span>${esc(METRICS[t].label)}</span><strong>${esc(formatMetric(t,m[t]))}</strong></div>`).join('');
  return`${moduleHero(module,s.title||module.singular,formatDate(s.date))}
  <div class="detail-card stack">${rows||'<p class="empty">Keine Werte vorhanden.</p>'}</div>
  <div class="action-grid top"><button class="button primary" data-action="tour.edit" data-id="${s.id}">Bearbeiten</button><button class="button danger" data-action="tour.delete" data-id="${s.id}">Löschen</button></div>`
}
