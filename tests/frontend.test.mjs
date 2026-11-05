import test from 'node:test';
import assert from 'node:assert/strict';
import { filterEvents, haversine, dateInCR, shiftDate, escapeHTML, canGroup, validateDraft } from '../app.js';

const base={search:'',zone:'all',category:'all',day:'all',savedOnly:false,saved:[],gps:null,radius:'all'};
const events=[
  {id:'a',title:'Atardecer acústico',venue:'Terraza',zone:'Escazú',category:'rooftop',date:'2026-11-05',time:'18:00',price:8000,description:'Una buena noche',lat:9.93,lng:-84.14,groupEligible:true},
  {id:'b',title:'Noche electrónica',venue:'Pista',zone:'San José',category:'electronica',date:'2026-11-06',time:'22:00',price:6000,description:'Bajos y beats',lat:9.93,lng:-84.08,groupEligible:true},
  {id:'c',title:'Café de domingo',venue:'Patio',zone:'Heredia',category:'gastro',date:'2026-11-08',time:'17:00',price:0,description:'Con tus compas',lat:10,lng:-84.12,groupEligible:false},
  {id:'past',title:'Pasado',venue:'Patio',zone:'Heredia',category:'gastro',date:'2026-11-04',time:'17:00',price:0,description:'Evento vencido',lat:10,lng:-84.12,groupEligible:false}
];
test('Costa Rica date handles the UTC midnight boundary and year rollover',()=>{
  assert.equal(dateInCR(new Date('2027-01-01T03:00:00Z')),'2026-12-31');
  assert.equal(shiftDate('2026-12-31',1),'2027-01-01');
});
test('date filters exclude expired events and include upcoming Friday through Sunday',()=>{
  assert.deepEqual(filterEvents(events,{...base,day:'today'},'2026-11-05').map(e=>e.id),['a']);
  assert.deepEqual(filterEvents(events,{...base,day:'tomorrow'},'2026-11-05').map(e=>e.id),['b']);
  assert.deepEqual(filterEvents(events,{...base,day:'weekend'},'2026-11-05').map(e=>e.id),['b','c']);
  assert.deepEqual(filterEvents(events,{...base,day:'weekend'},'2026-11-08').map(e=>e.id),['c']);
});
test('search is accent insensitive; filters compose and saved plans respect zone',()=>{
  assert.deepEqual(filterEvents(events,{...base,search:'ACUSTICO'},'2026-11-05').map(e=>e.id),['a']);
  assert.equal(filterEvents(events,{...base,search:'acustico',zone:'Heredia'},'2026-11-05').length,0);
  assert.deepEqual(filterEvents(events,{...base,savedOnly:true,saved:['b','c'],zone:'San José'},'2026-11-05').map(e=>e.id),['b']);
});
test('GPS distances sort nearest first and enforce radius; manual mode ignores radius',()=>{
  const gps={lat:9.93,lng:-84.08};
  assert.equal(haversine(gps,gps),0);
  assert.ok(haversine(gps,events[0])>6 && haversine(gps,events[0])<7);
  assert.deepEqual(filterEvents(events,{...base,gps,radius:'5'},'2026-11-05').map(e=>e.id),['b']);
  assert.equal(filterEvents(events,{...base,radius:'5'},'2026-11-05').length,3);
});
test('free and nonparticipating events cannot offer group benefit',()=>{
  assert.equal(canGroup(events[0]),true);
  assert.equal(canGroup({...events[0],price:0}),false);
  assert.equal(canGroup({...events[0],groupEligible:false}),false);
  assert.equal(canGroup(undefined),false);
});
test('user supplied markup is escaped in text and HTML attributes',()=>{
  assert.equal(escapeHTML('<img onerror="x" src=\'x\'>&'),'&lt;img onerror=&quot;x&quot; src=&#39;x&#39;&gt;&amp;');
});
test('event publishing rejects past times, impossible dates, missing coordinates and free-entry discount',()=>{
  const draft={...events[0],description:'Una descripción del evento',lat:9.93,lng:-84.14};
  const now=new Date('2026-11-05T23:00:00Z');
  assert.equal(validateDraft(draft,now),draft);
  assert.throws(()=>validateDraft({...draft,time:'16:00'},now),/ya pasó/);
  assert.throws(()=>validateDraft({...draft,date:'2026-02-30'},now),/fecha válida/);
  assert.throws(()=>validateDraft({...draft,lat:''},now),/coordenadas/);
  assert.throws(()=>validateDraft({...draft,price:0},now),/precio mayor/);
  assert.throws(()=>validateDraft({...draft,price:-1},now),/precio/);
});
