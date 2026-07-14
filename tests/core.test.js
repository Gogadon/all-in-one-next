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
