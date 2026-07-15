const listeners=new Set();

export function route(){
  const raw=(location.hash||'#/').slice(1);
  const parts=raw.split('/').filter(Boolean);

  if(!parts.length)return{name:'dashboard',path:'/'};
  if(parts[0]==='calendar')return{name:'calendar',path:'/calendar'};
  if(parts[0]==='settings')return{name:'settings',path:'/settings'};

  if(parts[0]==='module'){
    return{
      name:'module',
      module:parts[1]??'',
      view:parts[2]??(parts[1]==='kraft'?'today':'overview'),
      path:`/${parts.join('/')}`
    };
  }

  return{name:'dashboard',path:'/'};
}

export function go(path){
  const hash=`#${path.startsWith('/')?path:`/${path}`}`;
  if(location.hash===hash){notify();return}
  location.hash=hash;
}

function notify(){
  for(const listener of listeners)listener(route());
}

export function subscribe(listener){
  listeners.add(listener);
  window.addEventListener('hashchange',notify);
  return()=>{
    listeners.delete(listener);
    window.removeEventListener('hashchange',notify);
  };
}
