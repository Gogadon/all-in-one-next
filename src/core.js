export const METRICS={duration:{label:'Dauer',unit:'',agg:'sum',display:'duration'},distance:{label:'Distanz',unit:'km',agg:'sum',display:'distance',decimals:1},elevation:{label:'Höhenmeter',unit:'hm',agg:'sum'},steps:{label:'Schritte',unit:'',agg:'sum'},calories:{label:'Kalorien',unit:'kcal',agg:'sum'},averageSpeed:{label:'Ø Geschwindigkeit',unit:'km/h',agg:'average',decimals:1},maxSpeed:{label:'Max. Geschwindigkeit',unit:'km/h',agg:'max',decimals:1},averageHeartRate:{label:'Ø Puls',unit:'bpm',agg:'average'},maxHeartRate:{label:'Max. Puls',unit:'bpm',agg:'max'}};
export const id=(p='id')=>globalThis.crypto?.randomUUID?`${p}_${crypto.randomUUID()}`:`${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
export const todayIso=(d=new Date())=>{const p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
export const isoDate=s=>{const[y,m,d]=String(s).slice(0,10).split('-').map(Number);return new Date(Date.UTC(y,m-1,d))};
export const formatDate=s=>isoDate(s).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'});
export const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
export const parseNumber=v=>{const n=Number(String(v??'').trim().replace(',','.'));return Number.isFinite(n)?n:null};
export const formatNumber=(v,d=0)=>v==null||!Number.isFinite(v)?'–':new Intl.NumberFormat('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d}).format(v);
export const parseDuration=(v,mode)=>{const s=String(v??'').trim();if(!s)return null;const p=s.split(':').map(Number);if(p.some(Number.isNaN))return null;if(p.length===3)return p[0]*3600+p[1]*60+p[2];if(p.length===2)return mode==='minutes-seconds'?p[0]*60+p[1]:p[0]*3600+p[1]*60;const n=parseNumber(s);return n==null?null:Math.round(n*(mode==='minutes-seconds'?60:3600))};
export const formatDuration=v=>{if(v==null)return'–';const h=Math.floor(v/3600),m=Math.floor((v%3600)/60),s=Math.round(v%60);return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`};
export const formatMetric=(t,v)=>{const d=METRICS[t];if(!d)return'–';if(t==='duration')return formatDuration(v);const x=t==='distance'?v/1000:v;return`${formatNumber(x,d.decimals??0)}${d.unit?' '+d.unit:''}`};
export const periodBounds=(type,anchor=todayIso())=>{const d=isoDate(anchor),y=d.getUTCFullYear(),m=d.getUTCMonth();if(type==='week'){const n=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-n);const from=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+7);return{from,to:d.toISOString().slice(0,10)}}if(type==='month')return{from:new Date(Date.UTC(y,m,1)).toISOString().slice(0,10),to:new Date(Date.UTC(y,m+1,1)).toISOString().slice(0,10)};if(type==='year')return{from:`${y}-01-01`,to:`${y+1}-01-01`};throw Error('Unbekannter Zeitraum')};
export const shiftPeriod=(type,anchor,step)=>{const{from}=periodBounds(type,anchor),d=isoDate(from);if(type==='week')d.setUTCDate(d.getUTCDate()+step*7);if(type==='month')d.setUTCMonth(d.getUTCMonth()+step);if(type==='year')d.setUTCFullYear(d.getUTCFullYear()+step);return d.toISOString().slice(0,10)};
export const emptyState=()=>{const now=new Date().toISOString();return{schemaVersion:1,activities:[],sessions:[],plans:[],challenges:[],preferences:{theme:'dark'},meta:{createdAt:now,updatedAt:now}}};
export const sessionMetrics=s=>s.segments?.[0]?.entries?.[0]?.metrics??{};
export const completedSessions=(state,moduleId)=>state.sessions.filter(s=>s.moduleId===moduleId&&s.status==='completed').toSorted((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
export const aggregate=(type,values)=>{const nums=values.filter(Number.isFinite);if(!nums.length)return null;const a=METRICS[type]?.agg;if(a==='sum')return nums.reduce((x,y)=>x+y,0);if(a==='max')return Math.max(...nums);return nums.reduce((x,y)=>x+y,0)/nums.length};
export const statistics=(state,moduleId,type,anchor)=>{const{from,to}=periodBounds(type,anchor),sessions=completedSessions(state,moduleId).filter(s=>s.date>=from&&s.date<to),types=new Set();sessions.forEach(s=>Object.keys(sessionMetrics(s)).forEach(t=>types.add(t)));const metrics={};types.forEach(t=>metrics[t]=aggregate(t,sessions.map(s=>sessionMetrics(s)[t])));return{sessions,metrics,count:sessions.length,from,to}};

export const allCompletedSessions=state=>state.sessions
  .filter(s=>s.status==='completed')
  .toSorted((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));

export function weeklyOverview(state,anchor=todayIso()){
  const{from,to}=periodBounds('week',anchor);
  const sessions=allCompletedSessions(state).filter(s=>s.date>=from&&s.date<to);
  const activeDays=new Set(sessions.map(s=>s.date)).size;
  const modules={};
  for(const s of sessions){
    const key=s.moduleId;
    const entry=modules[key]??={moduleId:key,count:0,metrics:{}};
    entry.count++;
    const metrics=sessionMetrics(s);
    for(const[type,value]of Object.entries(metrics)){
      if(!Number.isFinite(value))continue;
      (entry.metrics[type]??=[]).push(value);
    }
  }
  const moduleRows=Object.values(modules).map(row=>{
    const metrics={};
    for(const[type,values]of Object.entries(row.metrics))metrics[type]=aggregate(type,values);
    return{moduleId:row.moduleId,count:row.count,metrics};
  });
  return{activities:sessions.length,activeDays,moduleRows};
}

export function weekStrip(state,anchor=todayIso()){
  const{from}=periodBounds('week',anchor);
  const weekdays=['Mo','Di','Mi','Do','Fr','Sa','So'];
  const today=todayIso();
  const days=[];
  for(let i=0;i<7;i++){
    const date=isoDate(from);date.setUTCDate(date.getUTCDate()+i);
    const iso=date.toISOString().slice(0,10);
    const modules=[...new Set(allCompletedSessions(state).filter(s=>s.date===iso).map(s=>s.moduleId))];
    days.push({iso,label:weekdays[i],day:date.getUTCDate(),modules,isToday:iso===today,isFuture:iso>today});
  }
  return days;
}

export function monthGrid(state,anchor=todayIso()){
  const base=isoDate(anchor);
  const year=base.getUTCFullYear(),month=base.getUTCMonth();
  const first=new Date(Date.UTC(year,month,1));
  const offset=(first.getUTCDay()+6)%7;
  const start=new Date(Date.UTC(year,month,1-offset));
  const today=todayIso();
  const cells=[];
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setUTCDate(start.getUTCDate()+i);
    const iso=d.toISOString().slice(0,10);
    const modules=[...new Set(allCompletedSessions(state).filter(s=>s.date===iso).map(s=>s.moduleId))];
    cells.push({iso,day:d.getUTCDate(),inMonth:d.getUTCMonth()===month,modules,isToday:iso===today,isFuture:iso>today});
  }
  return{
    label:new Date(Date.UTC(year,month,1)).toLocaleDateString('de-DE',{month:'long',year:'numeric',timeZone:'UTC'}),
    cells
  };
}
