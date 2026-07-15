import{load,save,reset,importBackup,exportBackup}from'./core/storage.js';
import{route,go,subscribe}from'./core/router.js';
import{todayIso,shiftMonth}from'./core/date.js';
import{dashboardView}from'./features/dashboard/dashboard.js';
import{calendarView,daySheetView}from'./features/calendar/calendar.js';
import{
  setStrengthLibraryFilter,
  strengthView,
  toggleStrengthExercise,
  toggleStrengthHistory,
  toggleStrengthUnit
}from'./features/strength/strength.js';
import{icons}from'./ui/icons.js';
import{escapeHtml,moduleName}from'./ui/format.js';

const main=document.querySelector('#main');
const topbar=document.querySelector('#topbar');
const overlay=document.querySelector('#overlay-root');
const toastRoot=document.querySelector('#toast-root');
const pullRefresh=document.querySelector('#pull-refresh');
const fileInput=document.querySelector('#backup-file');

let state=load();
let calendarAnchor=todayIso();
let selectedDay=null;
let dialog=null;
let toastTimer=null;
const openDaySessions=new Set();

const pullState={
  tracking:false,
  startY:0,
  distance:0,
  armed:false,
  reloading:false
};

function setAppHeight(){
  const height=window.visualViewport?.height??window.innerHeight;
  document.documentElement.style.setProperty('--app-height',`${height}px`);
}

function showDialog({
  eyebrow='All-in-One',
  title,
  text,
  confirmText='Bestätigen',
  cancelText='Abbrechen',
  danger=false,
  onConfirm=null,
  onCancel=null
}){
  dialog={eyebrow,title,text,confirmText,cancelText,danger,onConfirm,onCancel};
  render();
}

function closeDialog(runCancel=false){
  const callback=runCancel?dialog?.onCancel:null;
  dialog=null;
  render();
  callback?.();
}

function showToast(message){
  clearTimeout(toastTimer);
  toastRoot.innerHTML=`<div class="app-toast">${escapeHtml(message)}</div>`;

  requestAnimationFrame(()=>{
    toastRoot.firstElementChild?.classList.add('visible');
  });

  toastTimer=setTimeout(()=>{
    const element=toastRoot.firstElementChild;
    element?.classList.remove('visible');

    setTimeout(()=>{
      if(toastRoot.firstElementChild===element)toastRoot.innerHTML='';
    },220);
  },2600);
}

function dialogView(){
  if(!dialog)return'';

  const cancelButton=dialog.cancelText
    ?`<button class="dialog-button" data-action="dialog.cancel">${escapeHtml(dialog.cancelText)}</button>`
    :'';

  return`<div class="dialog-backdrop open" data-action="dialog.cancel"></div>
    <section class="app-dialog open" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <span class="eyebrow"><i></i>${escapeHtml(dialog.eyebrow)}</span>
      <h2 id="dialog-title">${escapeHtml(dialog.title)}</h2>
      <p>${escapeHtml(dialog.text)}</p>
      <div class="dialog-actions ${dialog.cancelText?'':'single'}">
        ${cancelButton}
        <button class="dialog-button primary ${dialog.danger?'danger':''}" data-action="dialog.confirm">${escapeHtml(dialog.confirmText)}</button>
      </div>
    </section>`;
}

function updatePullRefresh(distance=0,armed=false){
  pullState.distance=distance;
  pullState.armed=armed;

  if(!pullRefresh)return;

  const progress=Math.min(distance/76,1);
  pullRefresh.style.setProperty('--pull-distance',`${distance}px`);
  pullRefresh.style.setProperty('--pull-progress',String(progress));
  pullRefresh.classList.toggle('visible',distance>3);
  pullRefresh.classList.toggle('armed',armed);

  const label=pullRefresh.querySelector('small');
  if(label&&!pullState.reloading){
    label.textContent=armed?'Loslassen zum Aktualisieren':'Zum Aktualisieren ziehen';
  }
}

function resetPullRefresh(){
  pullState.tracking=false;
  pullState.startY=0;
  pullState.reloading=false;
  updatePullRefresh(0,false);
}

function beginReload(){
  if(!pullRefresh||pullState.reloading)return;

  pullState.reloading=true;
  pullRefresh.classList.add('visible','loading');
  pullRefresh.classList.remove('armed');

  const label=pullRefresh.querySelector('small');
  if(label)label.textContent='Aktualisieren …';

  setTimeout(()=>location.reload(),180);
}

function canStartPullRefresh(event){
  return(
    event.touches?.length===1
    &&main.scrollTop<=0
    &&!selectedDay
    &&!dialog
    &&!pullState.reloading
  );
}

function topbarView(current){
  if(current.name==='dashboard'){
    topbar.classList.add('hidden');
    return'';
  }

  topbar.classList.remove('hidden');

  const title=current.name==='calendar'
    ?'Kalender'
    :current.name==='settings'
      ?'Daten & Einstellungen'
      :moduleName(current.module);

  return`<button class="icon-button" data-action="nav.back" aria-label="Zurück">${icons.back}</button>
    <strong>${escapeHtml(title)}</strong>
    <span></span>`;
}

function settingsView(){
  return`<section class="settings-page">
    <span class="eyebrow"><i></i>All-in-One</span>
    <h1>Daten & Einstellungen</h1>

    <section class="panel settings-card">
      <div><strong>${state.sessions.length}</strong><span>Sessions</span></div>
      <div><strong>${state.bibliothek.length}</strong><span>Aktivitäten</span></div>
    </section>

    <div class="settings-actions">
      <button class="action-button" data-action="backup.export">
        ${icons.export}
        <span><strong>Backup exportieren</strong><small>Aktuellen Stand als JSON sichern</small></span>
      </button>

      <button class="action-button" data-action="backup.import">
        ${icons.import}
        <span><strong>Backup importieren</strong><small>Altes App-Backup wird direkt unterstützt</small></span>
      </button>

      <button class="action-button danger" data-action="backup.reset">
        ${icons.trash}
        <span><strong>Lokale Daten löschen</strong><small>Nur Daten dieses neuen Projekts</small></span>
      </button>
    </div>
  </section>`;
}

function modulePreview(module){
  const labels={
    kraft:'Als Nächstes portieren wir das vollständige Kraftmodul aus der alten App.',
    rad:'Das Radmodul folgt nach der Abnahme des Kraftmoduls.',
    wandern:'Das Wandermodul folgt nach dem Radmodul.',
    challenge:'Das Challenge-Modul wird zuletzt portiert.'
  };

  return`<section class="module-preview ${module}">
    <span class="eyebrow"><i></i>${escapeHtml(moduleName(module))}</span>
    <h1>${escapeHtml(moduleName(module))}</h1>

    <section class="panel preview-card">
      <h2>Dashboard-Phase</h2>
      <p>${escapeHtml(labels[module]??'Dieses Modul folgt später.')}</p>
    </section>
  </section>`;
}

function render(){
  const current=route();

  topbar.innerHTML=topbarView(current);
  document.body.classList.toggle('dashboard-route',current.name==='dashboard');
  document.body.classList.toggle('strength-route',current.name==='module'&&current.module==='kraft');

  if(current.name==='dashboard')main.innerHTML=dashboardView(state);
  else if(current.name==='calendar')main.innerHTML=calendarView(state,calendarAnchor);
  else if(current.name==='settings')main.innerHTML=settingsView();
  else if(current.name==='module'&&current.module==='kraft')main.innerHTML=strengthView(state,current.view);
  else if(current.name==='module')main.innerHTML=modulePreview(current.module);
  else main.innerHTML=dashboardView(state);

  overlay.innerHTML=
    (selectedDay?daySheetView(state,selectedDay,openDaySessions):'')
    +dialogView();
}

function backupFilename(now=new Date()){
  const date=[
    now.getFullYear(),
    String(now.getMonth()+1).padStart(2,'0'),
    String(now.getDate()).padStart(2,'0')
  ].join('-');

  const time=[
    String(now.getHours()).padStart(2,'0'),
    String(now.getMinutes()).padStart(2,'0'),
    String(now.getSeconds()).padStart(2,'0')
  ].join('');

  return`all-in-one-backup-${date}-${time}.json`;
}

function downloadBackup(){
  const blob=new Blob([exportBackup(state)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');

  anchor.href=url;
  anchor.download=backupFilename();
  anchor.click();

  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast('Backup-Download gestartet ✓');
}

document.addEventListener('click',event=>{
  const element=event.target.closest('[data-action]');
  if(!element)return;

  const action=element.dataset.action;

  if(action==='settings.open')go('/settings');
  else if(action==='calendar.open'){
    calendarAnchor=todayIso();
    go('/calendar');
  }
  else if(action==='calendar.shift'){
    calendarAnchor=shiftMonth(calendarAnchor,Number(element.dataset.step));
    render();
  }
  else if(action==='module.open'){
    go(element.dataset.module==='kraft'?'/module/kraft/today':`/module/${element.dataset.module}`);
  }
  else if(action==='strength.nav')go(element.dataset.path);
  else if(action==='strength.unit.toggle'){toggleStrengthUnit(element.dataset.id);render()}
  else if(action==='strength.exercise.toggle'){toggleStrengthExercise(element.dataset.id);render()}
  else if(action==='strength.history.toggle'){toggleStrengthHistory(element.dataset.id);render()}
  else if(action==='strength.library.filter'){setStrengthLibraryFilter(element.dataset.filter);render()}
  else if(action==='nav.back')history.back();
  else if(action==='day.open'){
    selectedDay=element.dataset.date;
    openDaySessions.clear();
    render();
  }
  else if(action==='sheet.close'){
    selectedDay=null;
    openDaySessions.clear();
    render();
  }
  else if(action==='day.session.toggle'){
    openDaySessions.has(element.dataset.id)
      ?openDaySessions.delete(element.dataset.id)
      :openDaySessions.add(element.dataset.id);
    render();
  }
  else if(action==='plan.add'){
    state.termine??=[];
    state.termine.push({
      id:`appointment_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      datum:selectedDay,
      modul:element.dataset.module,
      notiz:''
    });
    save(state);
    render();
  }
  else if(action==='plan.remove'){
    state.termine=(state.termine??[]).filter(item=>item.id!==element.dataset.id);
    save(state);
    render();
  }
  else if(action==='backup.export'){
    showDialog({
      eyebrow:'Backup & Daten',
      title:'Backup exportieren?',
      text:'Der aktuelle lokale Stand wird als neue JSON-Datei gespeichert. Vorhandene Daten in der App bleiben unverändert.',
      confirmText:'Backup herunterladen',
      onConfirm:downloadBackup
    });
  }
  else if(action==='backup.import'){
    showDialog({
      eyebrow:'Backup & Daten',
      title:'Backup importieren?',
      text:'Der aktuelle lokale Stand wird vollständig durch die ausgewählte Datei ersetzt. Exportiere vorher ein Backup, falls du ihn behalten möchtest.',
      confirmText:'Datei auswählen',
      onConfirm:()=>fileInput.click()
    });
  }
  else if(action==='backup.reset'){
    showDialog({
      eyebrow:'Backup & Daten',
      title:'Lokale Daten löschen?',
      text:'Alle Daten dieses neuen Projekts werden auf diesem Gerät entfernt. Ein zuvor exportiertes Backup kann später wieder importiert werden.',
      confirmText:'Daten löschen',
      danger:true,
      onConfirm:()=>{
        state=reset();
        selectedDay=null;
        openDaySessions.clear();
        go('/');
        render();
        showToast('Lokale Daten wurden gelöscht.');
      }
    });
  }
  else if(action==='dialog.cancel')closeDialog(true);
  else if(action==='dialog.confirm'){
    const callback=dialog?.onConfirm;
    dialog=null;
    render();
    callback?.();
  }
});

fileInput.addEventListener('change',async()=>{
  const file=fileInput.files?.[0];
  if(!file)return;

  try{
    state=importBackup(await file.text());
    save(state);

    selectedDay=null;
    openDaySessions.clear();

    go('/');
    render();
    showToast('Backup wurde importiert ✓');
  }catch(error){
    showDialog({
      eyebrow:'Import fehlgeschlagen',
      title:'Backup konnte nicht importiert werden',
      text:error.message,
      confirmText:'Schließen',
      cancelText:null
    });
  }finally{
    fileInput.value='';
  }
});

main.addEventListener('touchstart',event=>{
  if(!canStartPullRefresh(event))return;

  pullState.tracking=true;
  pullState.startY=event.touches[0].clientY;
  updatePullRefresh(0,false);
},{passive:true});

main.addEventListener('touchmove',event=>{
  if(!pullState.tracking||event.touches.length!==1)return;

  const delta=event.touches[0].clientY-pullState.startY;

  if(delta<=0){
    resetPullRefresh();
    return;
  }

  event.preventDefault();

  const distance=Math.min(delta*.52,104);
  updatePullRefresh(distance,distance>=76);
},{passive:false});

main.addEventListener('touchend',()=>{
  if(!pullState.tracking)return;

  if(pullState.armed)beginReload();
  else resetPullRefresh();
},{passive:true});

main.addEventListener('touchcancel',resetPullRefresh,{passive:true});

setAppHeight();
window.addEventListener('resize',setAppHeight);
window.visualViewport?.addEventListener('resize',setAppHeight);

subscribe(render);

if(!location.hash)history.replaceState(null,'','#/');

if('serviceWorker'in navigator){
  navigator.serviceWorker.register('./sw.js').catch(console.warn);
}

render();
