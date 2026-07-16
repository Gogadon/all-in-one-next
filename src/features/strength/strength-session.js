import{todayIso}from'../../core/date.js';
import{activityById,sessionVolume}from'../../core/model.js';
import{formatDistance,formatDuration,formatNumber}from'../../ui/format.js';
import{
  strengthActivityIds,
  strengthUnitById,
  todayStrengthModel
}from'./strength-model.js';

const MODUL='kraft';

export function newId(){
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  return`id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
}

export function strengthSessionsToday(state,date=todayIso()){
  return(state.sessions??[]).filter(session=>
    session.modul===MODUL
    &&session.datum===date
    &&!session.uebersprungen
  );
}

export function openStrengthSession(state,date=todayIso()){
  return strengthSessionsToday(state,date).find(session=>session.abgeschlossen!==true)??null;
}

export function completedStrengthSessionToday(state,date=todayIso()){
  return strengthSessionsToday(state,date).find(session=>session.abgeschlossen===true)??null;
}

export function strengthSessionById(state,id){
  return(state.sessions??[]).find(session=>session.id===id&&session.modul===MODUL)??null;
}

export function strengthSegmentById(session,id){
  return(session?.segmente??[]).find(segment=>segment.id===id)??null;
}

export function strengthEntryById(segment,id){
  return(segment?.eintraege??[]).find(entry=>entry.id===id)??null;
}

export function resolvedStrengthActivity(state,segment){
  return activityById(state,segment?.altOf??segment?.aktivitaetId);
}

export function baseStrengthActivity(state,segment){
  return activityById(state,segment?.aktivitaetId);
}

export function isStrengthActivity(activity){
  return activity?.kategorie==='kraft';
}

export function isAssistActivity(activity){
  return Boolean(activity?.einstellungen?.assist);
}

export function isUnilateralActivity(activity){
  return Boolean(activity?.einstellungen?.einarmig);
}

export function parseNumberInput(raw){
  const text=String(raw??'').trim().replace(',','.');
  if(!text)return null;
  const value=Number(text);
  return Number.isFinite(value)?value:null;
}

export function parseDurationInput(raw){
  const text=String(raw??'').trim();
  if(!text)return null;

  if(text.includes(':')){
    const parts=text.split(':').map(part=>Number(part.replace(',','.')));
    if(parts.length!==2||parts.some(part=>!Number.isFinite(part)||part<0))return null;
    return Math.round((parts[0]*60+parts[1])*60);
  }

  const minutes=parseNumberInput(text);
  return minutes==null?null:Math.round(minutes*60);
}

export function parseMetricInput(type,raw,activity){
  if(type==='dauer')return parseDurationInput(raw);

  const value=parseNumberInput(raw);
  if(value==null)return null;

  if(type==='distanz'){
    return activity?.kategorie==='schwimmen'
      ?Math.round(value)
      :Math.round(value*1000);
  }

  return value;
}

export function metricInputValue(type,value,activity){
  if(value==null)return'';

  if(type==='dauer'){
    const hours=Math.floor(value/3600);
    const minutes=Math.round((value%3600)/60);
    return hours?`${hours}:${String(minutes).padStart(2,'0')}`:String(minutes);
  }

  if(type==='distanz'){
    const converted=activity?.kategorie==='schwimmen'?value:value/1000;
    return formatNumber(converted,Number.isInteger(converted)?0:2);
  }

  return formatNumber(value,Number.isInteger(value)?0:2);
}

function newEntry(metrics={},source='manual'){
  return{
    id:newId(),
    messwerte:{...metrics},
    flags:[],
    quelle:source
  };
}

function latestCompletedSegment(state,identity,date=todayIso()){
  const sessions=[...(state.sessions??[])]
    .filter(session=>
      session.modul===MODUL
      &&session.datum<date
      &&session.abgeschlossen===true
      &&!session.uebersprungen
    )
    .sort((a,b)=>b.datum.localeCompare(a.datum)||(b.erstelltAm??'').localeCompare(a.erstelltAm??''));

  for(const session of sessions){
    const segment=(session.segmente??[]).find(item=>
      item.erledigt===true
      &&(item.altOf??item.aktivitaetId)===identity
      &&(item.eintraege??[]).length
    );
    if(segment)return segment;
  }

  return null;
}

function prefillEntry(state,activityId,date=todayIso()){
  const previous=latestCompletedSegment(state,activityId,date);
  if(!previous)return newEntry();

  const source=(previous.eintraege??[]).find(entry=>
    !entry.flags?.includes('aufwaermsatz')
    &&typeof entry.messwerte?.gewicht==='number'
  );

  if(!source)return newEntry();

  const metrics={};
  for(const type of['gewicht','wdh','wdh_l','wdh_r']){
    if(source.messwerte[type]!=null)metrics[type]=source.messwerte[type];
  }

  const entry=newEntry(metrics,'prefill');
  if(source._plus===true)entry._plus=true;
  return entry;
}

function newSegmentForActivity(state,activityId,date=todayIso()){
  const activity=activityById(state,activityId);
  if(!activity)throw Error('Übung wurde nicht gefunden.');

  return{
    id:newId(),
    aktivitaetId:activity.id,
    altOf:null,
    erledigt:false,
    eintraege:[
      isStrengthActivity(activity)
        ?prefillEntry(state,activity.id,date)
        :newEntry()
    ]
  };
}

function assertNoTodaySession(state,date=todayIso()){
  if(strengthSessionsToday(state,date).length){
    throw Error('Für heute existiert bereits eine Kraftsession.');
  }
}

export function startPlannedStrengthSession(state,unitId,date=todayIso()){
  assertNoTodaySession(state,date);

  const unit=strengthUnitById(state,unitId);
  if(!unit)throw Error('Die geplante Einheit wurde nicht gefunden.');

  const session={
    id:newId(),
    datum:date,
    erstelltAm:new Date().toISOString(),
    modul:MODUL,
    ausPlan:unit.id,
    notiz:'',
    abgeschlossen:false,
    uebersprungen:false,
    segmente:(unit.segmente??[]).map(template=>
      newSegmentForActivity(state,template.aktivitaetId,date)
    )
  };

  state.sessions??=[];
  state.sessions.push(session);
  return session;
}

export function startFreeStrengthSession(state,date=todayIso()){
  assertNoTodaySession(state,date);

  const session={
    id:newId(),
    datum:date,
    erstelltAm:new Date().toISOString(),
    modul:MODUL,
    ausPlan:null,
    notiz:'',
    abgeschlossen:false,
    uebersprungen:false,
    segmente:[]
  };

  state.sessions??=[];
  state.sessions.push(session);
  return session;
}

export function skipCurrentStrengthUnit(state,date=todayIso()){
  assertNoTodaySession(state,date);

  const model=todayStrengthModel(state,date);
  if(!model.unit)throw Error('Es gibt keine Einheit zum Überspringen.');

  const session={
    id:newId(),
    datum:date,
    erstelltAm:new Date().toISOString(),
    modul:MODUL,
    ausPlan:model.unit.id,
    uebersprungen:true,
    uebersprungenName:model.unit.name,
    imVerlauf:false,
    abgeschlossen:true,
    notiz:'',
    segmente:[]
  };

  state.sessions??=[];
  state.sessions.push(session);
  return session;
}

export function addStrengthActivityToSession(state,sessionId,activityId){
  const session=strengthSessionById(state,sessionId);
  if(!session||session.abgeschlossen)throw Error('Die Session kann nicht bearbeitet werden.');

  if(!strengthActivityIds(state).has(activityId)){
    throw Error('Diese Aktivität gehört nicht zur Kraftbibliothek.');
  }

  const segment=newSegmentForActivity(state,activityId,session.datum);
  session.segmente.push(segment);
  return segment;
}

export function removeStrengthSegment(state,sessionId,segmentId){
  const session=strengthSessionById(state,sessionId);
  if(!session||session.abgeschlossen)throw Error('Die Session kann nicht bearbeitet werden.');

  session.segmente=session.segmente.filter(segment=>segment.id!==segmentId);
}

export function setStrengthAlternative(state,sessionId,segmentId,alternativeId){
  const session=strengthSessionById(state,sessionId);
  const segment=strengthSegmentById(session,segmentId);
  if(!session||!segment||session.abgeschlossen)throw Error('Übung kann nicht geändert werden.');

  const base=baseStrengthActivity(state,segment);
  const allowed=new Set(base?.alternativen??[]);

  if(alternativeId&&!allowed.has(alternativeId)){
    throw Error('Diese Alternative ist nicht mit der Übung verknüpft.');
  }

  segment.altOf=alternativeId||null;
  segment.erledigt=false;

  const activity=resolvedStrengthActivity(state,segment);
  segment.eintraege=[
    isStrengthActivity(activity)
      ?prefillEntry(state,activity.id,session.datum)
      :newEntry()
  ];
}

export function addStrengthSet(state,sessionId,segmentId){
  const session=strengthSessionById(state,sessionId);
  const segment=strengthSegmentById(session,segmentId);
  const activity=resolvedStrengthActivity(state,segment);

  if(!session||!segment||session.abgeschlossen||!isStrengthActivity(activity)){
    throw Error('Satz kann nicht hinzugefügt werden.');
  }

  const previous=segment.eintraege.at(-1);
  const entry=newEntry(previous?.messwerte??{},previous?'prefill':'manual');
  if(previous?._plus===true)entry._plus=true;
  segment.eintraege.push(entry);
  return entry;
}

export function removeStrengthSet(state,sessionId,segmentId,entryId){
  const session=strengthSessionById(state,sessionId);
  const segment=strengthSegmentById(session,segmentId);

  if(!session||!segment||session.abgeschlossen)throw Error('Satz kann nicht entfernt werden.');

  segment.eintraege=segment.eintraege.filter(entry=>entry.id!==entryId);
  if(!segment.eintraege.length)segment.eintraege.push(newEntry());
}

export function toggleStrengthWarmup(state,sessionId,segmentId,entryId){
  const session=strengthSessionById(state,sessionId);
  const segment=strengthSegmentById(session,segmentId);
  const entry=strengthEntryById(segment,entryId);

  if(!session||!segment||!entry||session.abgeschlossen)throw Error('Satz kann nicht geändert werden.');

  entry.flags??=[];
  entry.flags.includes('aufwaermsatz')
    ?entry.flags=entry.flags.filter(flag=>flag!=='aufwaermsatz')
    :entry.flags.push('aufwaermsatz');
}

export function toggleStrengthAssistSign(state,sessionId,segmentId,entryId){
  const session=strengthSessionById(state,sessionId);
  const segment=strengthSegmentById(session,segmentId);
  const entry=strengthEntryById(segment,entryId);
  const activity=resolvedStrengthActivity(state,segment);

  if(!session||!segment||!entry||session.abgeschlossen||!isAssistActivity(activity)){
    throw Error('Vorzeichen kann nicht geändert werden.');
  }

  const current=entry.messwerte.gewicht;
  const isHelp=current!=null?current<0:entry._plus!==true;
  entry._plus=isHelp;

  if(current!=null){
    entry.messwerte.gewicht=isHelp?Math.abs(current):-Math.abs(current);
  }
}

export function setStrengthMetric(state,sessionId,segmentId,entryId,type,raw){
  const session=strengthSessionById(state,sessionId);
  const segment=strengthSegmentById(session,segmentId);
  const entry=strengthEntryById(segment,entryId);
  const activity=resolvedStrengthActivity(state,segment);

  if(!session||!segment||!entry||!activity||session.abgeschlossen){
    throw Error('Wert kann nicht gespeichert werden.');
  }

  const value=parseMetricInput(type,raw,activity);

  if(value==null){
    delete entry.messwerte[type];
    return;
  }

  if(type==='gewicht'&&isAssistActivity(activity)){
    const help=entry.messwerte.gewicht!=null
      ?entry.messwerte.gewicht<0
      :entry._plus!==true;
    entry.messwerte[type]=help?-Math.abs(value):Math.abs(value);
  }else{
    entry.messwerte[type]=value;
  }
}

export function setStrengthSessionNote(state,sessionId,value){
  const session=strengthSessionById(state,sessionId);
  if(!session||session.abgeschlossen)throw Error('Notiz kann nicht geändert werden.');
  session.notiz=value;
}

export function toggleStrengthSegmentDone(state,sessionId,segmentId){
  const session=strengthSessionById(state,sessionId);
  const segment=strengthSegmentById(session,segmentId);

  if(!session||!segment||session.abgeschlossen)throw Error('Übung kann nicht geändert werden.');

  segment.erledigt=segment.erledigt!==true;
  return segment.erledigt;
}

export function completeStrengthSession(state,sessionId){
  const session=strengthSessionById(state,sessionId);
  if(!session)throw Error('Session wurde nicht gefunden.');

  session.abgeschlossen=true;
  return session;
}

export function reopenStrengthSession(state,sessionId){
  const session=strengthSessionById(state,sessionId);
  if(!session)throw Error('Session wurde nicht gefunden.');

  session.abgeschlossen=false;
  return session;
}

function cardioTotals(state,session){
  let duration=0;
  let distance=0;

  for(const segment of session?.segmente??[]){
    if(segment.erledigt!==true)continue;

    const activity=resolvedStrengthActivity(state,segment);
    if(isStrengthActivity(activity))continue;

    for(const entry of segment.eintraege??[]){
      duration+=Number(entry.messwerte?.dauer)||0;
      distance+=Number(entry.messwerte?.distanz)||0;
    }
  }

  return{duration,distance};
}

export function strengthSessionSummaryText(state,session){
  if(!session)return'Noch keine Werte';

  const volume=sessionVolume(session);
  const cardio=cardioTotals(state,session);
  const parts=[];

  if(volume>0)parts.push(`${formatNumber(volume,0)} kg bewegt`);
  if(cardio.duration>0)parts.push(formatDuration(cardio.duration));
  if(cardio.distance>0)parts.push(formatDistance(cardio.distance));

  return parts.length?parts.join(' · '):'Noch keine Werte';
}
