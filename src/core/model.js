import{todayIso,nextDay,period,isoDate}from'./date.js';
export const MODULES=['kraft','rad','wandern'];
export function emptyState(){return{schema:2,bibliothek:[],sessions:[],plaene:{},challenges:[],termine:[],einstellungen:{}}}
export const sessionModule=session=>session.modul??'kraft';
export const isCompleted=session=>session.abgeschlossen===true&&!session.uebersprungen;
export const activityById=(state,id)=>(state.bibliothek??[]).find(activity=>activity.id===id)??null;
function entryVolume(entry){if(entry?.flags?.includes('aufwaermsatz'))return 0;const m=entry?.messwerte??{},weight=m.gewicht;if(typeof weight!=='number'||weight<=0)return 0;const reps=(m.wdh_l!=null||m.wdh_r!=null)?(Number(m.wdh_l)||0)+(Number(m.wdh_r)||0):(Number(m.wdh)||0);return weight*reps}
export function sessionVolume(session){return(session.segmente??[]).filter(segment=>segment.erledigt===true).flatMap(segment=>segment.eintraege??[]).reduce((sum,entry)=>sum+entryVolume(entry),0)}
export function sessionValue(session,type){let total=0,found=false;for(const segment of session.segmente??[])for(const entry of segment.eintraege??[]){const value=entry.messwerte?.[type];if(typeof value==='number'){total+=value;found=true}}return found?total:null}
export function moduleStatistics(state,module){const sessions=(state.sessions??[]).filter(session=>isCompleted(session)&&sessionModule(session)===module);return{count:sessions.length,distance:sessions.reduce((sum,session)=>sum+(sessionValue(session,'distanz')??0),0)}}
const planFor=(state,module='kraft')=>state.plaene?.[module]??null;
const planUnit=(plan,id)=>plan?.einheiten?.find(unit=>unit.id===id)??null;
export function dayStatus(state,module,iso){const sessions=(state.sessions??[]).filter(session=>session.datum===iso&&sessionModule(session)===module);if(sessions.some(session=>session.abgeschlossen&&!session.uebersprungen))return'erledigt';if(sessions.some(session=>session.uebersprungen))return'uebersprungen';return'offen'}
export const skipsOnDay=(state,module,iso)=>(state.sessions??[]).filter(session=>session.datum===iso&&sessionModule(session)===module&&session.uebersprungen).length;
export function isRestUnit(state,unit){
  if(!unit)return false;
  if(unit.typ==='rest'||unit.restDay===true)return true;
  const segments=unit.segmente??[];
  if(!segments.length)return false;
  const activities=segments.map(segment=>activityById(state,segment.aktivitaetId)).filter(Boolean);
  return activities.length===segments.length
    &&activities.length>0
    &&activities.every(activity=>activity.cardio===true||activity.kategorie!=='kraft');
}
export function cyclePositionToday(state,module='kraft',today=todayIso()){
  const plan=planFor(state,module);if(!plan?.zyklus?.length)return 0;const length=plan.zyklus.length;
  const anchor=plan.anker?.iso&&Number.isInteger(plan.anker.index)?plan.anker:{iso:today,index:(plan.position??0)%length};
  let position=((anchor.index%length)+length)%length,day=anchor.iso;
  while(day<today){const skips=skipsOnDay(state,module,day);if(skips>0){position=(position+skips)%length;if(dayStatus(state,module,day)==='erledigt')position=(position+1)%length}else{const unit=planUnit(plan,plan.zyklus[position]);if(isRestUnit(state,unit)||dayStatus(state,module,day)==='erledigt')position=(position+1)%length}day=nextDay(day)}
  return(position+skipsOnDay(state,module,today))%length;
}
export function currentUnit(state,module='kraft',today=todayIso()){const plan=planFor(state,module);if(!plan?.zyklus?.length)return null;return planUnit(plan,plan.zyklus[cyclePositionToday(state,module,today)])}
export function weekOverview(state,anchor=todayIso()){
  const{from,to}=period('week',anchor),sessions=(state.sessions??[]).filter(session=>isCompleted(session)&&session.datum>=from&&session.datum<to),activeDays=new Set(sessions.map(session=>session.datum)).size;
  const rows=MODULES.map(module=>{const own=sessions.filter(session=>sessionModule(session)===module);return{module,count:own.length,volume:module==='kraft'?own.reduce((sum,session)=>sum+sessionVolume(session),0):0,distance:module!=='kraft'?own.reduce((sum,session)=>sum+(sessionValue(session,'distanz')??0),0):0}});
  return{activities:sessions.length,activeDays,rows,from,to};
}
function orderedModules(set){return[...MODULES.filter(module=>set.has(module)),...[...set].filter(module=>!MODULES.includes(module))]}
export function dayMarker(state,iso){const sessions=(state.sessions??[]).filter(session=>isCompleted(session)&&session.datum===iso),completed=new Set(sessions.map(sessionModule)),planned=new Set((state.termine??[]).filter(item=>item.datum===iso).map(item=>item.modul).filter(module=>!completed.has(module)));return{modules:orderedModules(completed),planned:orderedModules(planned),count:sessions.length}}
export function weekStrip(state,anchor=todayIso(),today=todayIso()){const{from,to}=period('week',anchor),labels=['Mo','Di','Mi','Do','Fr','Sa','So'],days=[];let iso=from,index=0;while(iso<to){days.push({iso,label:labels[index],day:Number(iso.slice(8)),isToday:iso===today,isFuture:iso>today,...dayMarker(state,iso)});iso=nextDay(iso);index++}return days}
export function monthGrid(state,anchor=todayIso(),today=todayIso()){const{from,to}=period('month',anchor),last=isoDate(to);last.setUTCDate(last.getUTCDate()-1);const gridFrom=period('week',from).from,gridTo=period('week',last.toISOString().slice(0,10)).to,cells=[];let iso=gridFrom;while(iso<gridTo){cells.push({iso,day:Number(iso.slice(8)),inMonth:iso>=from&&iso<to,isToday:iso===today,isFuture:iso>today,...dayMarker(state,iso)});iso=nextDay(iso)}return cells}
