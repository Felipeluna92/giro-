import test from 'node:test';
import assert from 'node:assert/strict';
import {attributionFromSearch,sanitizeAttribution,encodeAttribution,decodeAttribution,utmifyClientReference,ATTRIBUTION_TTL} from '../lib/attribution.ts';
test('Only bounded campaign labels survive; checkout identity and payment data cannot be injected',()=>{
 assert.deepEqual(sanitizeAttribution({utm_source:' fb\n',utm_content:'x'.repeat(500),email:'secret',app:'other',userId:'victim',price:1}),{utm_source:'fb',utm_content:'x'.repeat(120)});
 assert.deepEqual(sanitizeAttribution(null),{});
 assert.deepEqual(sanitizeAttribution([]),{});
});
test('Attribution expires and rejects malformed or future cookies',()=>{
 const now=Date.now(),data={utm_source:'FB',utm_content:'Vídeo 01 |123'};
 assert.deepEqual(decodeAttribution(encodeAttribution(data,now),now),data);
 assert.deepEqual(decodeAttribution(encodeAttribution(data,now),now+ATTRIBUTION_TTL*1000+1),{});
 assert.deepEqual(decodeAttribution(encodeAttribution(data,now+120000),now),{});
 assert.deepEqual(decodeAttribution('invalid',now),{});
 assert.deepEqual(decodeAttribution('x'.repeat(4000),now),{});
 const international=Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term','src','sck'].map(k=>[k,'界'.repeat(120)]));
 assert.ok(encodeAttribution(international).length<=3000);
});
test('A new campaign is one complete touch, never mixed with earlier campaign fields',()=>{
 assert.deepEqual(attributionFromSearch(new URLSearchParams('utm_source=instagram&plan=combo')),{utm_source:'instagram'});
 assert.deepEqual(attributionFromSearch(new URLSearchParams('plan=rider')),{});
});
test('Stripe reference matches official UTMify source / adset / campaign / ad / placement encoding',()=>{
 assert.equal(utmifyClientReference({utm_source:'FB',utm_medium:'Conjunto |456',utm_campaign:'Campanha |123',utm_content:'Vídeo |789::clickid::',utm_term:'Instagram_Feed'}),'FB__456__123__789__Instagram_Feed');
 assert.equal(utmifyClientReference({}),undefined);
 assert.equal(utmifyClientReference({src:'whatsapp'}),undefined);
 assert.equal(utmifyClientReference({utm_content:'id_01'}),'______id_01__');
 assert.ok(utmifyClientReference({utm_source:'x'.repeat(120),utm_campaign:'x'.repeat(120)}).length<=200);
});
