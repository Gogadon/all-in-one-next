export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const formatNumber=(value,decimals=1)=>Number(value??0).toLocaleString('de-DE',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
export const formatDistance=meters=>`${formatNumber((meters??0)/1000,Number(meters??0)%1000===0?0:1)} km`;
export function formatDuration(seconds){const total=Math.round(Number(seconds??0)),hours=Math.floor(total/3600),minutes=Math.floor((total%3600)/60),secs=total%60;return hours?`${hours}:${String(minutes).padStart(2,'0')} Std.`:`${minutes}:${String(secs).padStart(2,'0')}`}
export function formatMetric(type,value){
  if(type==='dauer')return formatDuration(value);if(type==='distanz')return formatDistance(value);if(type==='hoehenmeter')return`${formatNumber(value,0)} hm`;if(type==='schritte')return`${formatNumber(value,0)} Schritte`;if(type==='kalorien')return`${formatNumber(value,0)} kcal`;if(type==='puls_avg'||type==='puls_max')return`${formatNumber(value,0)} bpm`;if(type==='tempo_avg'||type==='tempo_max')return`${formatNumber(value,1)} km/h`;if(type==='watt_avg')return`${formatNumber(value,0)} W`;if(type==='trittfrequenz')return`${formatNumber(value,0)} rpm`;if(type==='gewicht')return`${formatNumber(value,1)} kg`;return`${type}: ${formatNumber(value,1)}`;
}
export const moduleName=module=>({kraft:'Kraft',rad:'Rad',wandern:'Wandern',challenge:'Challenge'}[module]??module);
export const moduleColor=module=>({kraft:'#CDFD34',rad:'#37D7F4',wandern:'#FCB44B',challenge:'#FF6B9D'}[module]??'#868D88');
