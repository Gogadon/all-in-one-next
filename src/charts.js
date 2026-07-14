const num=value=>Math.round(value*100)/100;
const valid=values=>values.filter(value=>Number.isFinite(value));

function emptySvg(width,height,label='Noch zu wenig Daten'){
  return `<svg viewBox="0 0 ${width} ${height}" class="progress-chart empty-chart" role="img" aria-label="${label}">
    <line x1="12" y1="${height/2}" x2="${width-12}" y2="${height/2}" stroke="currentColor" stroke-opacity=".18" stroke-dasharray="4 5"/>
    <text x="${width/2}" y="${height/2-7}" text-anchor="middle" fill="currentColor" opacity=".45" font-size="10">${label}</text>
  </svg>`;
}

export function lineChart(points,{width=320,height=112,pad=18,suffix='',lowerBetter=false}={}){
  const rows=points.filter(point=>Number.isFinite(point.value));
  if(!rows.length)return emptySvg(width,height);
  const values=rows.map(point=>point.value),min=Math.min(...values),max=Math.max(...values),range=max-min||1;
  const innerWidth=width-pad*2,innerHeight=height-pad*2-18;
  const coords=rows.map((point,index)=>{
    const x=pad+(rows.length===1?.5:index/(rows.length-1))*innerWidth;
    const y=pad+innerHeight-((point.value-min)/range)*innerHeight;
    return{x:num(x),y:num(y),...point};
  });
  const line=coords.map(point=>`${point.x},${point.y}`).join(' ');
  const area=`${pad},${pad+innerHeight} ${line} ${width-pad},${pad+innerHeight}`;
  const labels=coords.map((point,index)=>index===0||index===coords.length-1
    ?`<text x="${point.x}" y="${height-3}" text-anchor="${index===0?'start':'end'}" fill="currentColor" opacity=".48" font-size="9">${point.label??''}</text>`:'').join('');
  const last=coords.at(-1);
  return `<svg viewBox="0 0 ${width} ${height}" class="progress-chart" role="img" aria-label="Fortschrittsverlauf">
    <text x="${pad}" y="10" fill="currentColor" opacity=".5" font-size="9">${num(max)}${suffix}</text>
    <text x="${pad}" y="${pad+innerHeight}" fill="currentColor" opacity=".5" font-size="9">${num(min)}${suffix}</text>
    <polygon points="${area}" fill="var(--accent)" opacity=".08"/>
    <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    ${coords.map((point,index)=>`<circle cx="${point.x}" cy="${point.y}" r="${index===coords.length-1?4:2.4}" fill="var(--accent)" opacity="${index===coords.length-1?1:.55}"><title>${point.label??''}: ${num(point.value)}${suffix}</title></circle>`).join('')}
    ${labels}
  </svg>`;
}

export function barChart(points,{width=320,height=126,pad=16,suffix=' kg'}={}){
  const rows=points.filter(point=>Number.isFinite(point.value));
  if(!rows.length||rows.every(point=>point.value===0))return emptySvg(width,height);
  const max=Math.max(...rows.map(point=>point.value))||1,innerWidth=width-pad*2,innerHeight=height-pad*2-20;
  const slot=innerWidth/rows.length,barWidth=Math.min(slot*.58,35);
  return `<svg viewBox="0 0 ${width} ${height}" class="progress-chart" role="img" aria-label="Wochenvolumen">
    ${rows.map((point,index)=>{
      const h=point.value/max*innerHeight,x=pad+index*slot+(slot-barWidth)/2,y=pad+innerHeight-h;
      return `<rect x="${num(x)}" y="${num(y)}" width="${num(barWidth)}" height="${num(Math.max(h,1))}" rx="4" fill="var(--accent)" opacity="${index===rows.length-1?1:.34}"><title>${point.label}: ${Math.round(point.value).toLocaleString('de-DE')}${suffix}</title></rect>
      <text x="${num(x+barWidth/2)}" y="${height-5}" text-anchor="middle" fill="currentColor" opacity=".5" font-size="9">${point.label}</text>`;
    }).join('')}
  </svg>`;
}

export function trend(values,{suffix='',lowerBetter=false}={}){
  const rows=valid(values);
  if(rows.length<2)return{direction:'flat',text:'zu wenig Daten',percent:0};
  const first=rows[0],last=rows.at(-1),difference=last-first;
  const percent=first!==0?Math.round(difference/Math.abs(first)*100):0;
  const improved=lowerBetter?difference<0:difference>0;
  const direction=difference===0?'flat':improved?'up':'down';
  return{direction,percent,text:difference===0?'unverändert':`${difference>0?'+':''}${num(difference)}${suffix} ${difference>0?'↑':'↓'}`};
}
