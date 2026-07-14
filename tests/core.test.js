import test from'node:test';import assert from'node:assert/strict';import{periodBounds,emptyState,weeklyOverview,weekStrip,completedSessions}from'../src/core.js';import{newTour,setMetric,saveTour,cancelEdit}from'../src/tours.js';import{getModule}from'../src/modules.js';test('Monatsgrenze exklusiv',()=>assert.deepEqual(periodBounds('month','2026-07-14'),{from:'2026-07-01',to:'2026-08-01'}));test('Tour wird erst beim Speichern übernommen',()=>{const s=emptyState(),m=getModule('cycling');newTour(m,'2026-07-14');setMetric(m,'distance','12,5');assert.equal(s.sessions.length,0);saveTour(s);assert.equal(s.sessions.length,1);assert.equal(s.sessions[0].status,'completed')});test('Abbrechen verändert State nicht',()=>{const s=emptyState(),m=getModule('hiking');newTour(m);setMetric(m,'distance','8');cancelEdit();assert.equal(s.sessions.length,0)});

test('Wochenübersicht zählt aktive Tage und Module',()=>{
  const s=emptyState();
  s.sessions.push(
    {id:'1',moduleId:'cycling',date:'2026-07-13',createdAt:'2026-07-13T10:00:00Z',status:'completed',segments:[{entries:[{metrics:{distance:10000}}]}]},
    {id:'2',moduleId:'hiking',date:'2026-07-13',createdAt:'2026-07-13T12:00:00Z',status:'completed',segments:[{entries:[{metrics:{distance:5000}}]}]},
    {id:'3',moduleId:'cycling',date:'2026-07-14',createdAt:'2026-07-14T10:00:00Z',status:'completed',segments:[{entries:[{metrics:{distance:20000}}]}]}
  );
  const result=weeklyOverview(s,'2026-07-14');
  assert.equal(result.activities,3);
  assert.equal(result.activeDays,2);
  assert.equal(result.moduleRows.length,2);
});

test('Wochenstreifen enthält sieben Tage',()=>{
  const result=weekStrip(emptyState(),'2026-07-14');
  assert.equal(result.length,7);
  assert.equal(result[0].label,'Mo');
});


test('Kalendertag enthält nur abgeschlossene Sessions in den Kernselektoren',()=>{
  const state=emptyState();
  state.sessions.push(
    {id:'done',moduleId:'cycling',date:'2026-07-14',createdAt:'2026-07-14T10:00:00Z',status:'completed',segments:[{entries:[{metrics:{distance:10000}}]}]},
    {id:'draft',moduleId:'cycling',date:'2026-07-14',createdAt:'2026-07-14T11:00:00Z',status:'draft',segments:[{entries:[{metrics:{distance:30000}}]}]}
  );
  assert.equal(completedSessions(state,'cycling').length,1);
  assert.equal(completedSessions(state,'cycling')[0].id,'done');
});

test('Altes Backup wird vom Importer konvertiert',async()=>{const legacy={app:'all-in-one',schema:2,daten:{bibliothek:[{id:'a1',name:'Radtour',kategorie:'rad',messwerte:['distanz']}],sessions:[{id:'s1',datum:'2026-07-14',modul:'rad',abgeschlossen:true,segmente:[{id:'g1',aktivitaetId:'a1',erledigt:true,eintraege:[{id:'e1',messwerte:{distanz:7500},flags:[],quelle:'import'}]}]}],plaene:{kraft:{einheiten:[]}},challenges:[],einstellungen:{}}};const{importJson}=await import('../src/storage.js');const state=importJson(JSON.stringify(legacy));assert.equal(state.sessions[0].moduleId,'cycling');assert.equal(state.sessions[0].segments[0].entries[0].metrics.distance,7500);assert.equal(state.sessions[0].status,'completed')});


test('Kraftvolumen ignoriert Aufwärmsätze',async()=>{const{strengthVolume}=await import('../src/strength.js');const s={segments:[{status:'completed',entries:[{metrics:{weight:50,repetitions:10},flags:[]},{metrics:{weight:30,repetitions:10},flags:['warmup']}]}]};assert.equal(strengthVolume(s),500)});


test('Einarmige Progression verwendet die schwächere Seite',async()=>{
  const{effectiveReps}=await import('../src/strength.js');
  assert.equal(effectiveReps({metrics:{repetitionsLeft:12,repetitionsRight:11}}),11);
});

test('Assistiertes Volumen zählt nicht als bewegtes Gewicht',async()=>{
  const{setVolume}=await import('../src/strength.js');
  assert.equal(setVolume({metrics:{weight:-15,repetitions:12},flags:[]}),0);
});



test('Manuelles Überspringen setzt den Anker auf die nächste Zyklusposition',async()=>{const{skipCurrentUnit}=await import('../src/strength.js');const state={activities:[],sessions:[],challenges:[],preferences:{},plans:[{moduleId:'strength',legacyData:{anker:{datum:'2026-07-14',index:0},position:0,zyklus:[{einheitId:'legs'},{einheitId:'rest'},{einheitId:'upper'}],einheiten:[{id:'legs',name:'Beine',segmente:[]},{id:'rest',name:'Rest Day',restDay:true,segmente:[]},{id:'upper',name:'Oberkörper',segmente:[]}]}}]};skipCurrentUnit(state);assert.equal(state.plans[0].legacyData.anker.index,1)});

test('Rest Day bleibt am aktuellen Tag sichtbar',async()=>{const{nextTrainingUnit}=await import('../src/strength.js');const state={activities:[],sessions:[],challenges:[],preferences:{},plans:[{moduleId:'strength',legacyData:{anker:{datum:'2026-07-14',index:0},zyklus:[{einheitId:'rest'},{einheitId:'upper'}],einheiten:[{id:'rest',name:'Active Rest',restDay:true,segmente:[]},{id:'upper',name:'Oberkörper',segmente:[]}]}}]};assert.equal(nextTrainingUnit(state,'2026-07-14').unit.id,'rest')});
test('Am Folgetag steht nach einem Rest Day automatisch die nächste Einheit an',async()=>{const{nextTrainingUnit}=await import('../src/strength.js');const state={activities:[],sessions:[],challenges:[],preferences:{},plans:[{moduleId:'strength',legacyData:{anker:{datum:'2026-07-14',index:0},zyklus:[{einheitId:'rest'},{einheitId:'upper'}],einheiten:[{id:'rest',name:'Active Rest',restDay:true,segmente:[]},{id:'upper',name:'Oberkörper',segmente:[]}]}}]};assert.equal(nextTrainingUnit(state,'2026-07-15').unit.id,'upper')});
test('Heute korrigieren setzt die ausgewählte Zyklusposition',async()=>{
  const mod=await import('../src/strength.js');
  const today=new Date().toISOString().slice(0,10);
  const state={activities:[],sessions:[],challenges:[],preferences:{},plans:[{moduleId:'strength',legacyData:{anker:{datum:today,index:0},position:0,zyklus:[{einheitId:'a'},{einheitId:'b'},{einheitId:'c'}],einheiten:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}]}}]};
  mod.requestCorrectToday(2);
  mod.confirmCorrectToday(state);
  assert.equal(state.plans[0].legacyData.anker.index,2);
});
