import{
  activityById,
  cyclePositionToday,
  isCompleted,
  isRestUnit,
  sessionModule,
  sessionValue,
  sessionVolume
}from'../../core/model.js';
import{todayIso}from'../../core/date.js';

export const strengthPlan=state=>state.plaene?.kraft??null;
export const strengthUnits=state=>strengthPlan(state)?.einheiten??[];
export const strengthCycle=state=>strengthPlan(state)?.zyklus??[];

export const strengthUnitById=(state,id)=>
  strengthUnits(state).find(unit=>unit.id===id)??null;

export function strengthActivityIds(state){
  const ids=new Set();

  for(const activity of state.bibliothek??[]){
    if(activity.kategorie==='kraft'||activity.kategorie==='sonstiges')ids.add(activity.id);
    for(const alternativeId of activity.alternativen??[])ids.add(alternativeId);
  }

  for(const unit of strengthUnits(state)){
    for(const segment of unit.segmente??[])ids.add(segment.aktivitaetId);
  }

  return ids;
}

export function strengthActivities(state){
  const ids=strengthActivityIds(state);
  return(state.bibliothek??[])
    .filter(activity=>ids.has(activity.id))
    .toSorted((a,b)=>a.name.localeCompare(b.name,'de'));
}

export function unitActivities(state,unit){
  return(unit?.segmente??[]).map((segment,index)=>({
    index,
    segment,
    activity:activityById(state,segment.aktivitaetId)
  }));
}

export function alternativeActivities(state,activity){
  return(activity?.alternativen??[])
    .map(id=>activityById(state,id))
    .filter(Boolean);
}

export function activityUsage(state,activityId){
  return strengthUnits(state).reduce(
    (count,unit)=>count+(unit.segmente??[]).filter(segment=>segment.aktivitaetId===activityId).length,
    0
  );
}

export function unitUsage(state,unitId){
  return strengthCycle(state).filter(id=>id===unitId).length;
}

export function restDayInfo(state,unit){
  if(!unit)return{isRestDay:false,source:null};
  if(unit.restDay===true||unit.typ==='rest')return{isRestDay:true,source:'explicit'};
  return{
    isRestDay:isRestUnit(state,unit),
    source:isRestUnit(state,unit)?'detected':null
  };
}

export function cycleRows(state,date=todayIso()){
  const cycle=strengthCycle(state);
  const currentIndex=cycle.length?cyclePositionToday(state,'kraft',date):0;

  return cycle.map((unitId,index)=>{
    const unit=strengthUnitById(state,unitId);
    return{
      index,
      unitId,
      unit,
      isCurrent:index===currentIndex,
      restDay:restDayInfo(state,unit)
    };
  });
}

export function todayStrengthSessions(state,date=todayIso()){
  return(state.sessions??[])
    .filter(session=>sessionModule(session)==='kraft'&&session.datum===date)
    .toSorted((a,b)=>(b.erstelltAm??'').localeCompare(a.erstelltAm??''));
}

export function todayStrengthModel(state,date=todayIso()){
  const plan=strengthPlan(state);
  const cycle=strengthCycle(state);
  const position=cycle.length?cyclePositionToday(state,'kraft',date):0;
  const unit=cycle.length?strengthUnitById(state,cycle[position]):null;
  const sessions=todayStrengthSessions(state,date);
  const completed=sessions.find(session=>isCompleted(session))??null;
  const open=sessions.find(session=>!session.abgeschlossen&&!session.uebersprungen)??null;
  const skipped=sessions.filter(session=>session.uebersprungen).length;

  return{
    plan,
    cycle,
    position,
    unit,
    unitActivities:unitActivities(state,unit),
    restDay:restDayInfo(state,unit),
    sessions,
    completed,
    open,
    skipped,
    status:completed?'completed':open?'open':'ready'
  };
}

export function completedStrengthSessions(state){
  return(state.sessions??[])
    .filter(session=>sessionModule(session)==='kraft'&&isCompleted(session))
    .toSorted((a,b)=>{
      const date=b.datum.localeCompare(a.datum);
      return date||String(b.erstelltAm??'').localeCompare(String(a.erstelltAm??''));
    });
}

export function sessionUnit(state,session){
  return session?.ausPlan?strengthUnitById(state,session.ausPlan):null;
}

export function sessionTitle(state,session){
  return sessionUnit(state,session)?.name??session?.name??'Freie Session';
}

export function cardioSessionSummary(session){
  const duration=sessionValue(session,'dauer')??0;
  const distance=sessionValue(session,'distanz')??0;
  return{duration,distance};
}

export function strengthSessionSummary(state,session){
  const volume=sessionVolume(session);
  const cardio=cardioSessionSummary(session);
  const segments=(session.segmente??[]).filter(segment=>segment.erledigt===true);

  return{
    title:sessionTitle(state,session),
    volume,
    duration:cardio.duration,
    distance:cardio.distance,
    segmentCount:segments.length,
    segments
  };
}

export function strengthDataAudit(state,date=todayIso()){
  const plan=strengthPlan(state);
  const units=strengthUnits(state);
  const cycle=strengthCycle(state);
  const activities=strengthActivities(state);
  const missingActivityIds=new Set();
  const missingUnitIds=new Set();

  for(const unitId of cycle){
    if(!strengthUnitById(state,unitId))missingUnitIds.add(unitId);
  }

  for(const unit of units){
    for(const segment of unit.segmente??[]){
      if(!activityById(state,segment.aktivitaetId))missingActivityIds.add(segment.aktivitaetId);
    }
  }

  return{
    hasPlan:Boolean(plan),
    units:units.length,
    cycle:cycle.length,
    activities:activities.length,
    alternatives:activities.reduce((sum,activity)=>sum+(activity.alternativen?.length??0),0),
    sessions:completedStrengthSessions(state).length,
    current:todayStrengthModel(state,date),
    missingActivityIds:[...missingActivityIds],
    missingUnitIds:[...missingUnitIds]
  };
}
