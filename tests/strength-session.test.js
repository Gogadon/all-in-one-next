import test from'node:test';
import assert from'node:assert/strict';
import{
  addStrengthSet,
  completeStrengthSession,
  metricInputValue,
  parseDurationInput,
  resolvedStrengthActivity,
  parseMetricInput,
  setStrengthMetric,
  skipCurrentStrengthUnit,
  startFreeStrengthSession,
  startPlannedStrengthSession,
  strengthSessionSummaryText,
  toggleStrengthAssistSign,
  toggleStrengthSegmentDone,
  toggleStrengthWarmup
}from'../src/features/strength/strength-session.js';

const baseState=()=>({
  schema:2,
  bibliothek:[
    {id:'run',name:'Laufband',kategorie:'sonstiges',messwerte:['dauer','distanz','puls_avg'],einstellungen:{},alternativen:[]},
    {id:'row',name:'Einarmiges Rudern',kategorie:'kraft',messwerte:['gewicht','wdh'],einstellungen:{einarmig:true},alternativen:[]},
    {id:'push',name:'Push-ups',kategorie:'kraft',messwerte:['gewicht','wdh'],einstellungen:{assist:true},alternativen:[]}
  ],
  sessions:[],
  plaene:{kraft:{
    einheiten:[{id:'upper',name:'Oberkörper',segmente:[{aktivitaetId:'run'},{aktivitaetId:'row'},{aktivitaetId:'push'}]}],
    zyklus:['upper'],
    position:0,
    anker:{iso:'2026-07-15',index:0}
  }},
  challenges:[],termine:[],einstellungen:{}
});

test('Geplante Session übernimmt alle Übungen und legt Eingabezeilen an',()=>{
  const state=baseState();
  const session=startPlannedStrengthSession(state,'upper','2026-07-15');

  assert.equal(session.ausPlan,'upper');
  assert.equal(session.segmente.length,3);
  assert.equal(session.segmente.every(segment=>segment.eintraege.length===1),true);
  assert.equal(session.abgeschlossen,false);
});

test('Freie Session startet leer',()=>{
  const state=baseState();
  const session=startFreeStrengthSession(state,'2026-07-15');

  assert.equal(session.ausPlan,null);
  assert.deepEqual(session.segmente,[]);
});

test('Eine zweite Kraftsession am selben Tag wird verhindert',()=>{
  const state=baseState();
  startFreeStrengthSession(state,'2026-07-15');

  assert.throws(()=>startPlannedStrengthSession(state,'upper','2026-07-15'));
});

test('Überspringen erzeugt eine übersprungene Session und rückt den Zyklus',()=>{
  const state=baseState();
  const skipped=skipCurrentStrengthUnit(state,'2026-07-15');

  assert.equal(skipped.uebersprungen,true);
  assert.equal(skipped.ausPlan,'upper');
});

test('Dauer und Distanz werden im alten Kraftformat geparst',()=>{
  const run=baseState().bibliothek[0];

  assert.equal(parseDurationInput('45'),2700);
  assert.equal(parseDurationInput('1:15'),4500);
  assert.equal(parseMetricInput('distanz','1,93',run),1930);
  assert.equal(metricInputValue('distanz',1930,run),'1,93');
});

test('Assistiertes Gewicht startet als negatives Hilfegewicht',()=>{
  const state=baseState();
  const session=startPlannedStrengthSession(state,'upper','2026-07-15');
  const segment=session.segmente[2];
  const entry=segment.eintraege[0];

  setStrengthMetric(state,session.id,segment.id,entry.id,'gewicht','15');
  assert.equal(entry.messwerte.gewicht,-15);

  toggleStrengthAssistSign(state,session.id,segment.id,entry.id);
  assert.equal(entry.messwerte.gewicht,15);
});

test('Einarmige Wiederholungen bleiben getrennt gespeichert',()=>{
  const state=baseState();
  const session=startPlannedStrengthSession(state,'upper','2026-07-15');
  const segment=session.segmente[1];
  const entry=segment.eintraege[0];

  setStrengthMetric(state,session.id,segment.id,entry.id,'wdh_l','12');
  setStrengthMetric(state,session.id,segment.id,entry.id,'wdh_r','11');

  assert.equal(entry.messwerte.wdh_l,12);
  assert.equal(entry.messwerte.wdh_r,11);
});

test('Sätze, Aufwärmen und Abhaken funktionieren',()=>{
  const state=baseState();
  const session=startPlannedStrengthSession(state,'upper','2026-07-15');
  const segment=session.segmente[1];

  const added=addStrengthSet(state,session.id,segment.id);
  toggleStrengthWarmup(state,session.id,segment.id,added.id);
  const done=toggleStrengthSegmentDone(state,session.id,segment.id);

  assert.equal(segment.eintraege.length,2);
  assert.equal(added.flags.includes('aufwaermsatz'),true);
  assert.equal(done,true);
});

test('Session-Zusammenfassung nutzt nur erledigte Segmente',()=>{
  const state=baseState();
  const session=startPlannedStrengthSession(state,'upper','2026-07-15');
  const row=session.segmente[1];
  const entry=row.eintraege[0];

  setStrengthMetric(state,session.id,row.id,entry.id,'gewicht','30');
  setStrengthMetric(state,session.id,row.id,entry.id,'wdh_l','10');
  setStrengthMetric(state,session.id,row.id,entry.id,'wdh_r','10');
  toggleStrengthSegmentDone(state,session.id,row.id);
  completeStrengthSession(state,session.id);

  assert.equal(strengthSessionSummaryText(state,session),'600 kg bewegt');
});


test('Eine gewählte Alternative wird als tatsächlich verwendete Aktivität aufgelöst',()=>{
  const state=baseState();
  state.bibliothek.push({
    id:'machine',
    name:'Rudergerät',
    kategorie:'sonstiges',
    messwerte:['dauer','distanz'],
    einstellungen:{},
    alternativen:[]
  });
  state.bibliothek[0].alternativen=['machine'];

  const session=startPlannedStrengthSession(state,'upper','2026-07-15');
  const segment=session.segmente[0];
  segment.altOf='machine';

  assert.equal(resolvedStrengthActivity(state,segment).name,'Rudergerät');
});

test('Werte einer vollständig abgeschlossenen Session können nicht geändert werden',()=>{
  const state=baseState();
  const session=startPlannedStrengthSession(state,'upper','2026-07-15');
  const segment=session.segmente[1];
  const entry=segment.eintraege[0];

  completeStrengthSession(state,session.id);

  assert.throws(()=>
    setStrengthMetric(state,session.id,segment.id,entry.id,'gewicht','40')
  );
});
