import{todayIso}from'../../core/date.js';
import{activityById,cyclePositionToday,sessionModule}from'../../core/model.js';
import{newId}from'./strength-session.js';

export const STRENGTH_METRICS=[
  'gewicht','wdh','dauer','distanz','puls_avg','puls_max','kalorien',
  'hoehenmeter','schritte','tempo_avg','tempo_max','watt_avg','trittfrequenz'
];

export function ensureStrengthPlan(state,date=todayIso()){
  state.plaene??={};
  state.plaene.kraft??={einheiten:[],zyklus:[],position:0,anker:{iso:date,index:0}};
  const plan=state.plaene.kraft;
  plan.einheiten??=[];
  plan.zyklus??=[];
  plan.position??=0;
  if(!plan.anker?.iso||!Number.isInteger(plan.anker.index)){
    plan.anker={iso:date,index:plan.zyklus.length?plan.position%plan.zyklus.length:0};
  }
  return plan;
}

export function strengthPlanUnit(state,id){
  return state.plaene?.kraft?.einheiten?.find(unit=>unit.id===id)??null;
}

function requireUnit(state,id){
  const unit=strengthPlanUnit(state,id);
  if(!unit)throw Error('Einheit wurde nicht gefunden.');
  return unit;
}

function requireActivity(state,id){
  const activity=activityById(state,id);
  if(!activity)throw Error('Übung wurde nicht gefunden.');
  return activity;
}

function reanchor(state,index,date=todayIso()){
  const plan=ensureStrengthPlan(state,date);
  if(!plan.zyklus.length){
    plan.position=0;
    plan.anker={iso:date,index:0};
    return;
  }
  const normalized=((index%plan.zyklus.length)+plan.zyklus.length)%plan.zyklus.length;
  plan.position=normalized;
  plan.anker={iso:date,index:normalized};
}

function currentCycleIndex(state,date=todayIso()){
  const plan=ensureStrengthPlan(state,date);
  return plan.zyklus.length?cyclePositionToday(state,'kraft',date):0;
}

export function createStrengthUnit(state,{name,restDay=false},date=todayIso()){
  const clean=String(name??'').trim();
  if(!clean)throw Error('Die Einheit braucht einen Namen.');
  const plan=ensureStrengthPlan(state,date);
  const unit={id:newId(),name:clean,kategorie:'kraft',segmente:[],restDay:Boolean(restDay)};
  if(restDay)unit.typ='rest';
  plan.einheiten.push(unit);
  return unit;
}

export function updateStrengthUnit(state,id,{name,restDay=false}){
  const unit=requireUnit(state,id);
  const clean=String(name??'').trim();
  if(!clean)throw Error('Der Name darf nicht leer sein.');
  unit.name=clean;
  unit.restDay=Boolean(restDay);
  if(restDay)unit.typ='rest';
  else delete unit.typ;
  return unit;
}

export function deleteStrengthUnit(state,id,date=todayIso()){
  const plan=ensureStrengthPlan(state,date);
  requireUnit(state,id);
  const before=currentCycleIndex(state,date);
  const removedBefore=plan.zyklus.slice(0,before).filter(unitId=>unitId===id).length;
  const currentRemoved=plan.zyklus[before]===id;

  plan.einheiten=plan.einheiten.filter(unit=>unit.id!==id);
  plan.zyklus=plan.zyklus.filter(unitId=>unitId!==id);

  if(!plan.zyklus.length){
    reanchor(state,0,date);
    return;
  }

  const next=currentRemoved
    ?Math.min(before-removedBefore,plan.zyklus.length-1)
    :Math.max(0,before-removedBefore);
  reanchor(state,next,date);
}

export function addUnitToCycle(state,id,date=todayIso()){
  const plan=ensureStrengthPlan(state,date);
  requireUnit(state,id);
  plan.zyklus.push(id);
  if(plan.zyklus.length===1)reanchor(state,0,date);
}

export function moveCycleEntry(state,index,direction,date=todayIso()){
  const plan=ensureStrengthPlan(state,date);
  const target=index+Math.sign(direction);
  if(index<0||index>=plan.zyklus.length||target<0||target>=plan.zyklus.length)return;
  const current=currentCycleIndex(state,date);
  [plan.zyklus[index],plan.zyklus[target]]=[plan.zyklus[target],plan.zyklus[index]];
  let next=current;
  if(current===index)next=target;
  else if(current===target)next=index;
  reanchor(state,next,date);
}

export function removeCycleEntry(state,index,date=todayIso()){
  const plan=ensureStrengthPlan(state,date);
  if(index<0||index>=plan.zyklus.length)return;
  const current=currentCycleIndex(state,date);
  plan.zyklus.splice(index,1);
  if(!plan.zyklus.length){reanchor(state,0,date);return}
  const next=index<current?current-1:index===current?Math.min(current,plan.zyklus.length-1):current;
  reanchor(state,next,date);
}

export function correctStrengthToday(state,index,date=todayIso()){
  const plan=ensureStrengthPlan(state,date);
  if(index<0||index>=plan.zyklus.length)throw Error('Zyklusposition wurde nicht gefunden.');
  state.sessions=(state.sessions??[]).filter(session=>!(session.datum===date&&sessionModule(session)==='kraft'));
  reanchor(state,index,date);
  return requireUnit(state,plan.zyklus[index]);
}

export function addActivityToUnit(state,unitId,activityId){
  const unit=requireUnit(state,unitId);
  requireActivity(state,activityId);
  unit.segmente??=[];
  unit.segmente.push({aktivitaetId:activityId});
}

export function removeActivityFromUnit(state,unitId,index){
  const unit=requireUnit(state,unitId);
  if(index<0||index>=unit.segmente.length)return;
  unit.segmente.splice(index,1);
}

export function moveActivityInUnit(state,unitId,index,direction){
  const unit=requireUnit(state,unitId);
  const target=index+Math.sign(direction);
  if(index<0||index>=unit.segmente.length||target<0||target>=unit.segmente.length)return;
  [unit.segmente[index],unit.segmente[target]]=[unit.segmente[target],unit.segmente[index]];
}

function normalizeMetrics(category,metrics){
  const requested=[...new Set((metrics??[]).filter(type=>STRENGTH_METRICS.includes(type)))];
  if(category==='kraft'){
    return['gewicht','wdh',...requested.filter(type=>!['gewicht','wdh'].includes(type))];
  }
  return requested.length?requested:['dauer','puls_avg','puls_max'];
}

function progressionFromData(data){
  const art=data.progression??'off';
  if(art==='off')return null;
  if(art==='technik')return{art:'technik'};
  const prog={art,saetze:Number(data.sets)||4,schritt:Number(data.step)||2.5};
  if(art==='double'){
    prog.wdhMin=Number(data.repsMin)||8;
    prog.wdhMax=Number(data.repsMax)||12;
  }else if(art==='strength'){
    prog.wdh=Number(data.reps)||12;
  }
  return prog;
}

function settingsFromData(data,current={}){
  const settings={...current};
  settings.einarmig=Boolean(data.unilateral);
  settings.assist=Boolean(data.assisted);
  const prog=progressionFromData(data);
  if(prog)settings.prog=prog;
  else delete settings.prog;
  return settings;
}

export function createStrengthActivity(state,data){
  const name=String(data.name??'').trim();
  if(!name)throw Error('Die Übung braucht einen Namen.');
  const category=data.category==='kraft'?'kraft':'sonstiges';
  const activity={
    id:newId(),name,kategorie:category,cardio:category!=='kraft',
    messwerte:normalizeMetrics(category,data.metrics),
    einstellungen:settingsFromData(data),
    alternativen:[],notiz:String(data.note??'').trim()
  };
  state.bibliothek??=[];
  state.bibliothek.push(activity);
  return activity;
}

export function updateStrengthActivity(state,id,data){
  const activity=requireActivity(state,id);
  const name=String(data.name??'').trim();
  if(!name)throw Error('Der Name darf nicht leer sein.');
  const category=data.category==='kraft'?'kraft':'sonstiges';
  activity.name=name;
  activity.kategorie=category;
  activity.cardio=category!=='kraft';
  activity.messwerte=normalizeMetrics(category,data.metrics);
  activity.einstellungen=settingsFromData(data,activity.einstellungen);
  activity.notiz=String(data.note??'').trim();
  activity.alternativen??=[];
  return activity;
}

export function archiveStrengthActivity(state,id){requireActivity(state,id).archiviert=true}
export function reactivateStrengthActivity(state,id){delete requireActivity(state,id).archiviert}

export function linkStrengthAlternative(state,id,alternativeId){
  const activity=requireActivity(state,id);
  requireActivity(state,alternativeId);
  if(id===alternativeId)throw Error('Eine Übung kann nicht ihre eigene Alternative sein.');
  activity.alternativen??=[];
  if(!activity.alternativen.includes(alternativeId))activity.alternativen.push(alternativeId);
}

export function alternativeSessionUsage(state,alternativeId){
  return(state.sessions??[]).filter(session=>(session.segmente??[]).some(segment=>segment.altOf===alternativeId)).length;
}

export function unlinkStrengthAlternative(state,id,alternativeId){
  const activity=requireActivity(state,id);
  const usage=alternativeSessionUsage(state,alternativeId);
  if(usage>0)throw Error(`Die Alternative steckt in ${usage} Session(s) und bleibt deshalb verknüpft.`);
  activity.alternativen=(activity.alternativen??[]).filter(item=>item!==alternativeId);
}

export function activeStrengthActivities(state){
  return(state.bibliothek??[]).filter(activity=>
    !activity.archiviert&&(activity.kategorie==='kraft'||activity.kategorie==='sonstiges'||activity.cardio===true)
  ).sort((a,b)=>a.name.localeCompare(b.name,'de'));
}
