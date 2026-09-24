import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {ManagedRouter} from '../src/managed-router.js';
test('display and access edits preserve the router connection; connection changes replace only the client',()=>{
 const clients=[];const router=new ManagedRouter(opts=>{const client=new EventEmitter();client.opts=opts;client.start=()=>client.started=true;client.stop=()=>client.stopped=true;clients.push(client);return client;});
 const c={router:{host:'fixture.invalid',port:2000,allowRouting:true},levels:[{name:'Video'}],sources:{},destinations:{}};
 assert(router.configure(c));assert.equal(clients.length,1);assert.equal(router.configure({...c,title:'New name',levels:[{name:'Renamed'}]}),false);assert.equal(clients.length,1);
 assert.equal(router.configure({...c,router:{...c.router,allowRouting:false}}),false);assert.equal(clients[0].opts.allowRouting,false);
 assert(router.configure({...c,router:{...c.router,port:2001}}));assert.equal(clients.length,2);assert(clients[0].stopped);assert(clients[1].started);router.stop();assert(clients[1].stopped);
});
