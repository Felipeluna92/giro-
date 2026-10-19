import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryStage,liveLocation,merchantTotals} from '../lib/merchant.ts';
test('Delivery stages distinguish pickup, route, completion and cancellation',()=>{
 assert.equal(deliveryStage({status:'pending',departedAt:null}),'Aguardando retirada');
 assert.equal(deliveryStage({status:'pending',departedAt:'2026-10-19T00:00:00Z'}),'Em rota');
 assert.equal(deliveryStage({status:'delivered',departedAt:'2026-10-19T00:00:00Z'}),'Entregue');
 assert.equal(deliveryStage({status:'cancelled',departedAt:null}),'Cancelada');
});
test('Expired GPS never remains live when polling fails',()=>{
 const now=Date.parse('2026-10-19T00:00:00Z'),point={lat:-22,lon:-47,accuracy:10,capturedAt:new Date(now-10000).toISOString(),updatedAt:new Date(now).toISOString(),expiresAt:new Date(now+90000).toISOString()};
 assert.equal(liveLocation(point,now),point);
 assert.equal(liveLocation(point,now+90001),null);
 assert.equal(liveLocation({...point,capturedAt:'invalid'},now),null);
 assert.equal(liveLocation({...point,capturedAt:new Date(now-160000).toISOString()},now),null);
});
test('Merchant totals keep customer cash separate and do not offset one rider with another advance',()=>{
 assert.deepEqual(merchantTotals([{pending:2,completedToday:3,feesToday:2400,due:500,cashDue:3800},{pending:1,completedToday:2,feesToday:1600,due:-300,cashDue:0}]),{pending:3,completed:5,fees:4000,due:500,cash:3800});
});
