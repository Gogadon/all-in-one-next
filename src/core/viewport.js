const EDITABLE_SELECTOR='input,textarea,select,[contenteditable="true"]';

export function resolveViewportMetrics({
  innerHeight,
  visualHeight,
  offsetTop=0,
  focused=false,
  keyboardThreshold=120
}){
  const layout=Math.max(1,Number(innerHeight)||1);
  const visual=Math.max(1,Number(visualHeight)||layout);
  const top=Math.max(0,Number(offsetTop)||0);
  const gap=Math.max(0,layout-visual-top);
  const keyboardOpen=Boolean(focused&&gap>=keyboardThreshold);

  return{
    height:Math.round(keyboardOpen?visual:Math.max(layout,visual+top)),
    visualHeight:Math.round(visual),
    offsetTop:Math.round(top),
    keyboardHeight:Math.round(keyboardOpen?gap:0),
    keyboardOpen
  };
}

export function installViewportStability({
  win=window,
  doc=document,
  root=doc.documentElement,
  scrollContainer=null
}={}){
  const timers=new Set();
  let frame=0;

  const editableFocused=()=>doc.activeElement?.matches?.(EDITABLE_SELECTOR)??false;

  function apply(){
    frame=0;
    if(doc.visibilityState==='hidden')return;

    const viewport=win.visualViewport;
    const metrics=resolveViewportMetrics({
      innerHeight:win.innerHeight,
      visualHeight:viewport?.height??win.innerHeight,
      offsetTop:viewport?.offsetTop??0,
      focused:editableFocused()
    });

    root.style.setProperty('--app-height',`${metrics.height}px`);
    root.style.setProperty('--visual-height',`${metrics.visualHeight}px`);
    root.style.setProperty('--viewport-offset-top',`${metrics.offsetTop}px`);
    root.style.setProperty('--keyboard-height',`${metrics.keyboardHeight}px`);
    doc.body?.classList.toggle('keyboard-open',metrics.keyboardOpen);

    if(metrics.keyboardOpen&&editableFocused()){
      const element=doc.activeElement;
      const rect=element?.getBoundingClientRect?.();
      const visibleBottom=metrics.visualHeight-18;
      if(rect&&rect.bottom>visibleBottom){
        element.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});
      }
    }
  }

  function schedule(delays=[0]){
    for(const delay of delays){
      if(delay===0){
        if(frame)cancelAnimationFrame(frame);
        frame=requestAnimationFrame(apply);
      }else{
        const timer=setTimeout(()=>{
          timers.delete(timer);
          apply();
        },delay);
        timers.add(timer);
      }
    }
  }

  const onViewportChange=()=>schedule([0,60,180]);
  const blurEditable=()=>{
    if(editableFocused())doc.activeElement?.blur?.();
  };
  const onVisibility=()=>{
    if(doc.visibilityState==='hidden'){
      // Android kann nach einem App-Wechsel einen alten, verkleinerten
      // VisualViewport behalten. Ein bewusstes Blur verhindert, dass dieser
      // Tastaturzustand beim nächsten Feld weitergeschleppt wird.
      blurEditable();
      return;
    }
    schedule([0,80,240,520]);
  };
  const onPageShow=()=>schedule([0,80,240]);
  const onFocusIn=event=>{
    if(event.target?.matches?.(EDITABLE_SELECTOR))schedule([0,80,180,360]);
  };
  const onFocusOut=()=>schedule([0,80,220,480]);
  const onOrientation=()=>schedule([0,120,360,700]);
  const onWindowBlur=()=>{
    blurEditable();
    schedule([0,120]);
  };

  win.addEventListener('resize',onViewportChange,{passive:true});
  win.addEventListener('orientationchange',onOrientation,{passive:true});
  win.addEventListener('pageshow',onPageShow,{passive:true});
  win.addEventListener('blur',onWindowBlur,{passive:true});
  win.visualViewport?.addEventListener('resize',onViewportChange,{passive:true});
  win.visualViewport?.addEventListener('scroll',onViewportChange,{passive:true});
  doc.addEventListener('visibilitychange',onVisibility,{passive:true});
  doc.addEventListener('focusin',onFocusIn,{passive:true});
  doc.addEventListener('focusout',onFocusOut,{passive:true});

  // Ein interner Scrollcontainer darf nach einem App-Wechsel nicht außerhalb
  // seiner neuen Viewportgrenzen hängen bleiben.
  const normalizeScroll=()=>{
    if(scrollContainer&&scrollContainer.scrollTop<0)scrollContainer.scrollTop=0;
    schedule([0,120]);
  };
  win.addEventListener('focus',normalizeScroll,{passive:true});

  schedule([0,100,300]);

  return()=>{
    if(frame)cancelAnimationFrame(frame);
    for(const timer of timers)clearTimeout(timer);
    win.removeEventListener('resize',onViewportChange);
    win.removeEventListener('orientationchange',onOrientation);
    win.removeEventListener('pageshow',onPageShow);
    win.removeEventListener('blur',onWindowBlur);
    win.removeEventListener('focus',normalizeScroll);
    win.visualViewport?.removeEventListener('resize',onViewportChange);
    win.visualViewport?.removeEventListener('scroll',onViewportChange);
    doc.removeEventListener('visibilitychange',onVisibility);
    doc.removeEventListener('focusin',onFocusIn);
    doc.removeEventListener('focusout',onFocusOut);
  };
}
