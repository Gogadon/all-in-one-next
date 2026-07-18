import test from'node:test';
import assert from'node:assert/strict';
import{
  addActivityToUnit,
  addUnitToCycle,
  archiveStrengthActivity,
  correctStrengthToday,
  createStrengthActivity,
  createStrengthUnit,
  deleteStrengthUnit,
  linkStrengthAlternative,
  moveActivityInUnit,
  moveCycleEntry,
  reactivateStrengthActivity,
  removeActivityFromUnit,
  removeCycleEntry,
  unlinkStrengthAlternative,
  updateStrengthActivity,
  updateStrengthUnit
}from'../src/features/strength/strength-plan.js';
import{currentUnit,isRestUnit}from'../src/core/model.js';

const base=()=>({
  schema:2,
  bibliothek:[
    {id:'run',name:'Laufband',kategorie:'sonstiges',cardio:true,messwerte:['dauer'],einstellungen:{},alternativen:[]},
    {id:'row',name:'Rudern',kategorie:'kraft',messwerte:['gewicht','wdh'],einstellungen:{},alternativen:[]},
    {id:'pull',name:'Lat-Zug',kategorie:'kraft',messwerte:['gewicht','wdh'],einstellungen:{},alternativen:[]}
  ],
  sessions:[],plaene:{kraft:{
    einheiten:[
      {id:'a',name:'A',segmente:[{aktivitaetId:'row'}]},
      {id:'b',name:'B',segmente:[{aktivitaetId:'pull'}]}
    ],
    zyklus:['a','b','a'],position:0,anker:{iso:'2026-07-18',index:0}
  }},challenges:[],termine:[],einstellungen:{}
});

test('Einheiten können angelegt, bearbeitet und explizit als Rest Day markiert werden',()=>{
  const state=base();
  const unit=createStrengthUnit(state,{name:'Active Rest',restDay:true},'2026-07-18');
  assert.equal(unit.restDay,true);
  assert.equal(isRestUnit(state,unit),true);

  updateStrengthUnit(state,unit.id,{name:'Recovery',restDay:false});
  assert.equal(unit.name,'Recovery');
  assert.equal(unit.restDay,false);
  assert.equal(isRestUnit(state,unit),false);
});

test('Eine Einheit darf mehrfach im Zyklus vorkommen',()=>{
  const state=base();
  addUnitToCycle(state,'b','2026-07-18');
  addUnitToCycle(state,'b','2026-07-18');
  assert.deepEqual(state.plaene.kraft.zyklus,['a','b','a','b','b']);
});

test('Zyklusverschiebung lässt den heutigen Eintrag mitwandern',()=>{
  const state=base();
  moveCycleEntry(state,0,1,'2026-07-18');
  assert.deepEqual(state.plaene.kraft.zyklus,['b','a','a']);
  assert.equal(state.plaene.kraft.anker.index,1);
  assert.equal(currentUnit(state,'kraft','2026-07-18').id,'a');
});

test('Entfernen einer Zyklusposition erhält einen gültigen Anker',()=>{
  const state=base();
  removeCycleEntry(state,0,'2026-07-18');
  assert.deepEqual(state.plaene.kraft.zyklus,['b','a']);
  assert.equal(state.plaene.kraft.anker.index,0);
  assert.equal(currentUnit(state,'kraft','2026-07-18').id,'b');
});

test('Heute korrigieren verwirft alle heutigen Kraftzustände und setzt den Anker',()=>{
  const state=base();
  state.sessions=[
    {id:'open',datum:'2026-07-18',modul:'kraft',abgeschlossen:false,segmente:[]},
    {id:'skip',datum:'2026-07-18',modul:'kraft',abgeschlossen:true,uebersprungen:true,segmente:[]},
    {id:'rad',datum:'2026-07-18',modul:'rad',abgeschlossen:true,segmente:[]},
    {id:'old',datum:'2026-07-17',modul:'kraft',abgeschlossen:true,segmente:[]}
  ];
  const unit=correctStrengthToday(state,1,'2026-07-18');
  assert.equal(unit.id,'b');
  assert.deepEqual(state.sessions.map(item=>item.id).sort(),['old','rad']);
  assert.deepEqual(state.plaene.kraft.anker,{iso:'2026-07-18',index:1});
});

test('Übungen in einer Einheit können hinzugefügt, verschoben und entfernt werden',()=>{
  const state=base();
  addActivityToUnit(state,'a','run');
  assert.deepEqual(state.plaene.kraft.einheiten[0].segmente.map(item=>item.aktivitaetId),['row','run']);
  moveActivityInUnit(state,'a',1,-1);
  assert.deepEqual(state.plaene.kraft.einheiten[0].segmente.map(item=>item.aktivitaetId),['run','row']);
  removeActivityFromUnit(state,'a',0);
  assert.deepEqual(state.plaene.kraft.einheiten[0].segmente.map(item=>item.aktivitaetId),['row']);
});

test('Übungen können angelegt, bearbeitet, archiviert und reaktiviert werden',()=>{
  const state=base();
  const activity=createStrengthActivity(state,{
    name:'Einarmiges Rudern',category:'kraft',metrics:['gewicht','wdh'],
    unilateral:true,assisted:false,progression:'double',sets:4,repsMin:8,repsMax:12,step:2.5,note:'Bank 4'
  });
  assert.equal(activity.einstellungen.einarmig,true);
  assert.equal(activity.einstellungen.prog.art,'double');

  updateStrengthActivity(state,activity.id,{...activity,name:'Rudern einarmig',category:'kraft',metrics:['gewicht','wdh'],progression:'technik'});
  assert.equal(activity.name,'Rudern einarmig');
  assert.equal(activity.einstellungen.prog.art,'technik');

  archiveStrengthActivity(state,activity.id);
  assert.equal(activity.archiviert,true);
  reactivateStrengthActivity(state,activity.id);
  assert.equal(activity.archiviert,undefined);
});

test('Alternativen sind einseitige Bibliotheksverweise',()=>{
  const state=base();
  linkStrengthAlternative(state,'row','pull');
  assert.deepEqual(state.bibliothek.find(item=>item.id==='row').alternativen,['pull']);
  assert.deepEqual(state.bibliothek.find(item=>item.id==='pull').alternativen,[]);
  unlinkStrengthAlternative(state,'row','pull');
  assert.deepEqual(state.bibliothek.find(item=>item.id==='row').alternativen,[]);
});

test('Verwendete Alternativen können nicht aus der Verknüpfung entfernt werden',()=>{
  const state=base();
  linkStrengthAlternative(state,'row','pull');
  state.sessions.push({id:'s',datum:'2026-07-17',modul:'kraft',segmente:[{aktivitaetId:'row',altOf:'pull'}]});
  assert.throws(()=>unlinkStrengthAlternative(state,'row','pull'));
});

test('Einheit löschen entfernt alle Zyklusvorkommen, nicht aber Sessions',()=>{
  const state=base();
  state.sessions.push({id:'history',datum:'2026-07-17',modul:'kraft',ausPlan:'a',abgeschlossen:true,segmente:[]});
  deleteStrengthUnit(state,'a','2026-07-18');
  assert.deepEqual(state.plaene.kraft.zyklus,['b']);
  assert.equal(state.sessions.length,1);
});
