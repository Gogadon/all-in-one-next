import{emptyState}from'./model.js';
const KEY='all_in_one_rebuild_v0_1';
function validate(data){if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Ungültige Datenstruktur.');const state={...emptyState(),...data};if(!Array.isArray(state.sessions)||!Array.isArray(state.bibliothek))throw Error('Backup enthält keine gültigen Sitzungsdaten.');state.plaene??={};state.challenges??=[];state.termine??=[];state.einstellungen??={};return state}
export function load(){const raw=localStorage.getItem(KEY);if(!raw)return emptyState();try{return validate(JSON.parse(raw))}catch(error){localStorage.setItem(`${KEY}_defekt_${Date.now()}`,raw);console.warn(error);return emptyState()}}
export const save=state=>localStorage.setItem(KEY,JSON.stringify(validate(state)));
export function reset(){localStorage.removeItem(KEY);return emptyState()}
export function importBackup(text){let parsed;try{parsed=JSON.parse(text)}catch{throw Error('Die Datei enthält kein gültiges JSON.')}if(parsed?.daten&&Array.isArray(parsed.daten.sessions))return validate(parsed.daten);if(parsed?.data&&Array.isArray(parsed.data.sessions))return validate(parsed.data);return validate(parsed)}
export function exportBackup(state){return JSON.stringify({app:'all-in-one-rebuild',version:'0.2.1.1',exportedAt:new Date().toISOString(),data:validate(state)},null,2)}
