import test from 'node:test';
import assert from 'node:assert/strict';
import {adminAccountAction,adminAccountQuery} from '../lib/admin-accounts-policy.ts';
test('admin trials only allow real email, one portal and a bounded integer duration',()=>{
 assert.deepEqual(adminAccountAction({action:'trial',email:'  Pessoa@Exemplo.com ',plan:'rider',days:7}),{action:'trial',email:'pessoa@exemplo.com',plan:'rider',days:7});
 for(const days of [0,-1,31,1.5,'7',null])assert.equal(adminAccountAction({action:'trial',email:'a@b.com',plan:'merchant',days}),null);
 for(const plan of ['combo','admin',null])assert.equal(adminAccountAction({action:'trial',email:'a@b.com',plan,days:7}),null);
 for(const email of ['user@giro.invalid','x','a@b.com\nattacker'])assert.equal(adminAccountAction({action:'trial',email,plan:'rider',days:7}),null);
});
test('admin account actions require a valid target ID and never accept arbitrary password or privilege changes',()=>{
 const userId='00000000-0000-0000-0000-000000000001';
 assert.deepEqual(adminAccountAction({action:'recovery',userId}),{action:'recovery',userId});
 assert.equal(adminAccountAction({action:'set_password',userId,password:'example'}),null);
 assert.equal(adminAccountAction({action:'make_admin',userId}),null);
 assert.equal(adminAccountAction({action:'revoke_trial',userId:'invalid'}),null);
});
test('admin list validates pagination and filters without truncating or coercing invalid input',()=>{
 assert.deepEqual(adminAccountQuery(new URLSearchParams()),{search:'',filter:'all',page:1});
 assert.equal(adminAccountQuery(new URLSearchParams({page:'-1'})),null);
 assert.equal(adminAccountQuery(new URLSearchParams({page:'1.5'})),null);
 assert.equal(adminAccountQuery(new URLSearchParams({filter:'everything'})),null);
 assert.equal(adminAccountQuery(new URLSearchParams({search:'x'.repeat(121)})),null);
});
