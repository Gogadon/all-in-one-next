import test from'node:test';
import assert from'node:assert/strict';
import{resolveViewportMetrics}from'../src/core/viewport.js';

test('Ohne Tastatur wird die volle Layout-Höhe verwendet',()=>{
  const result=resolveViewportMetrics({innerHeight:900,visualHeight:850,offsetTop:0,focused:false});
  assert.equal(result.height,900);
  assert.equal(result.keyboardOpen,false);
  assert.equal(result.keyboardHeight,0);
});

test('Mit fokussiertem Feld und großem Viewportverlust wird die Tastatur erkannt',()=>{
  const result=resolveViewportMetrics({innerHeight:900,visualHeight:510,offsetTop:0,focused:true});
  assert.equal(result.height,510);
  assert.equal(result.keyboardOpen,true);
  assert.equal(result.keyboardHeight,390);
});

test('Kleine Browserleisten-Differenz gilt nicht als Tastatur',()=>{
  const result=resolveViewportMetrics({innerHeight:900,visualHeight:840,offsetTop:0,focused:true});
  assert.equal(result.height,900);
  assert.equal(result.keyboardOpen,false);
});
