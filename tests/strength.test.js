import test from'node:test';
import assert from'node:assert/strict';
import{
  activityUsage,
  alternativeActivities,
  cycleRows,
  restDayInfo,
  strengthActivities,
  strengthDataAudit,
  todayStrengthModel,
  unitUsage
}from'../src/features/strength/strength-model.js';

const state=()=>({
  schema:2,
  bibliothek:[
    {id:'run',name:'Laufband',kategorie:'sonstiges',messwerte:['dauer'],einstellungen:{},alternativen:['bike']},
    {id:'bike',name:'Fahrrad',kategorie:'sonstiges',messwerte:['dauer'],einstellungen:{},alternativen:[]},
    {id:'press',name:'Beinpresse',kategorie:'kraft',messwerte:['gewicht','wdh'],einstellungen:{prog:{art:'double',saetze:4,wdhMin:8,wdhMax:12}},alternativen:['alt']},
    {id:'alt',name:'Hackenschmidt',kategorie:'kraft',messwerte:['gewicht','wdh'],einstellungen:{},alternativen:[]}
  ],
  sessions:[],
  plaene:{kraft:{
    einheiten:[
      {id:'rest',name:'Active Rest',segmente:[{aktivitaetId:'run'},{aktivitaetId:'bike'}]},
      {id:'legs',name:'Beine',segmente:[{aktivitaetId:'run'},{aktivitaetId:'press'}]}
    ],
    zyklus:['rest','legs','legs'],
    position:0,
    anker:{iso:'2026-07-15',index:0}
  }},
  challenges:[],termine:[],einstellungen:{}
});

test('Rest Day bleibt am Ankertag die aktuelle Einheit',()=>{
  const model=todayStrengthModel(state(),'2026-07-15');
  assert.equal(model.unit.id,'rest');
  assert.equal(model.restDay.isRestDay,true);
});

test('Nicht erledigter Rest Day rückt am Folgetag automatisch weiter',()=>{
  const model=todayStrengthModel(state(),'2026-07-16');
  assert.equal(model.unit.id,'legs');
});

test('Nicht erledigte Kraft-Einheit bleibt am Folgetag stehen',()=>{
  const data=state();
  data.plaene.kraft.anker={iso:'2026-07-15',index:1};
  const model=todayStrengthModel(data,'2026-07-16');
  assert.equal(model.unit.id,'legs');
  assert.equal(model.position,1);
});

test('Abgeschlossene Kraft-Einheit rückt am Folgetag weiter',()=>{
  const data=state();
  data.plaene.kraft.anker={iso:'2026-07-15',index:1};
  data.sessions.push({id:'done',datum:'2026-07-15',modul:'kraft',abgeschlossen:true,uebersprungen:false,segmente:[]});
  const model=todayStrengthModel(data,'2026-07-16');
  assert.equal(model.position,2);
});

test('Überspringen am aktuellen Tag verschiebt exakt eine Zyklusposition',()=>{
  const data=state();
  data.sessions.push({id:'skip',datum:'2026-07-15',modul:'kraft',abgeschlossen:true,uebersprungen:true,segmente:[]});
  const model=todayStrengthModel(data,'2026-07-15');
  assert.equal(model.position,1);
  assert.equal(model.unit.id,'legs');
});

test('Einheiten- und Aktivitätsnutzung werden getrennt gezählt',()=>{
  const data=state();
  assert.equal(unitUsage(data,'legs'),2);
  assert.equal(activityUsage(data,'run'),2);
  assert.equal(activityUsage(data,'press'),1);
});

test('Alternativen bleiben Referenzen auf Bibliotheksübungen',()=>{
  const data=state();
  const press=data.bibliothek.find(activity=>activity.id==='press');
  assert.deepEqual(alternativeActivities(data,press).map(activity=>activity.id),['alt']);
});

test('Datenprüfung findet vollständige Bibliothek und Planstruktur',()=>{
  const audit=strengthDataAudit(state(),'2026-07-15');
  assert.equal(audit.units,2);
  assert.equal(audit.cycle,3);
  assert.equal(audit.activities,4);
  assert.deepEqual(audit.missingActivityIds,[]);
  assert.deepEqual(audit.missingUnitIds,[]);
  assert.equal(cycleRows(state(),'2026-07-15')[0].isCurrent,true);
  assert.equal(strengthActivities(state()).length,4);
  assert.equal(restDayInfo(state(),state().plaene.kraft.einheiten[0]).source,'detected');
});
