export function todayIso(now=new Date()){
  const y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,'0'),d=String(now.getDate()).padStart(2,'0');
  return`${y}-${m}-${d}`;
}
export const isoDate=iso=>{const[y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d,12))};
export const nextDay=iso=>{const d=isoDate(iso);d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)};
export function weekStart(iso){const d=isoDate(iso),day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);return d.toISOString().slice(0,10)}
export function period(kind,anchor=todayIso()){
  const d=isoDate(anchor);
  if(kind==='week'){const from=weekStart(anchor),to=isoDate(from);to.setUTCDate(to.getUTCDate()+7);return{from,to:to.toISOString().slice(0,10)}}
  if(kind==='month'){const from=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1,12)),to=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1,12));return{from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10)}}
  const from=new Date(Date.UTC(d.getUTCFullYear(),0,1,12)),to=new Date(Date.UTC(d.getUTCFullYear()+1,0,1,12));return{from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10)};
}
export function shiftMonth(anchor,step){const d=isoDate(anchor);d.setUTCMonth(d.getUTCMonth()+step,1);return d.toISOString().slice(0,10)}
export function formatDate(iso,options={day:'2-digit',month:'2-digit',year:'numeric'}){return isoDate(iso).toLocaleDateString('de-DE',{...options,timeZone:'UTC'})}
export const longDate=iso=>formatDate(iso,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
export const monthLabel=iso=>formatDate(iso,{month:'long',year:'numeric'});
