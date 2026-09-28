'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),net=require('node:net');
const {targets,suggestions,probe,scan}=require('../hub/hyperdeck-discovery.cjs');

function fakeDeck(onConnect){
 const received=[];
 const server=net.createServer(socket=>{socket.on('data',d=>received.push(d));socket.on('error',()=>{});onConnect(socket);});
 return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({port:server.address().port,received,close:()=>new Promise(r=>server.close(r))})));
}

test('targets accepts one private address or a /24 or /23 and rejects everything else',()=>{
 assert.deepEqual(targets('10.15.10.13'),['10.15.10.13']);
 const range=targets('10.15.11.71/23');
 assert.equal(range.length,510);assert.equal(range[0],'10.15.10.1');assert.equal(range.at(-1),'10.15.11.254');
 assert.equal(targets('192.168.1.0/24').length,254);
 for(const bad of ['8.8.8.8','10.0.0.0/22','10.0.0.0/16','10.0.0.256','hyperdeck.local',''])assert.throws(()=>targets(bad),bad);
});

test('suggestions offer the local private networks at /23 or /24',()=>{
 assert.deepEqual(suggestions({en10:[{family:'IPv4',address:'10.15.11.71',cidr:'10.15.11.71/23',internal:false}],en0:[{family:'IPv4',address:'192.168.4.20',cidr:'192.168.4.20/16',internal:false}],pub:[{family:'IPv4',address:'8.8.4.4',cidr:'8.8.4.4/24',internal:false}],lo0:[{family:'IPv4',address:'127.0.0.1',cidr:'127.0.0.1/8',internal:true}]}),['10.15.10.0/23','192.168.4.0/23']);
});

test('probe reads the greeting across chunks and never sends a command',async()=>{
 const deck=await fakeDeck(s=>{s.write('500 connection info:\r\nprotocol version: 1.11\r\n');setTimeout(()=>s.write('model: HyperDeck Studio HD Plus\r\nunique id: abc123\r\n\r\n'),20);});
 try{
  assert.deepEqual(await probe('127.0.0.1',{port:deck.port}),{host:'127.0.0.1',port:deck.port,model:'HyperDeck Studio HD Plus',protocolVersion:'1.11',uniqueId:'abc123',busy:false});
  await new Promise(r=>setTimeout(r,50));
  assert.equal(Buffer.concat(deck.received).length,0);
 }finally{await deck.close();}
});

test('probe reports a deck that rejects the connection as busy',async()=>{
 const deck=await fakeDeck(s=>s.end('120 connection rejected\r\n'));
 try{assert.deepEqual(await probe('127.0.0.1',{port:deck.port}),{host:'127.0.0.1',port:deck.port,busy:true});}finally{await deck.close();}
});

test('probe ignores other services, silent listeners and closed ports',async()=>{
 const http=await fakeDeck(s=>s.end('HTTP/1.1 400 Bad Request\r\n\r\n')),silent=await fakeDeck(()=>{});
 try{
  assert.equal(await probe('127.0.0.1',{port:http.port}),null);
  assert.equal(await probe('127.0.0.1',{port:silent.port,timeout:150}),null);
 }finally{await http.close();await silent.close();}
 assert.equal(await probe('127.0.0.1',{port:http.port,timeout:300}),null);
});

test('scan skips saved decks without connecting to them',async()=>{
 let connections=0;const deck=await fakeDeck(s=>{connections++;s.write('500 connection info:\r\nmodel: HyperDeck\r\n\r\n');});
 try{
  assert.deepEqual(await scan('127.0.0.1',{port:deck.port,skip:['127.0.0.1']}),{scanned:0,found:[],skipped:['127.0.0.1']});
  assert.equal(connections,0);
  const result=await scan('127.0.0.1',{port:deck.port});
  assert.equal(result.found.length,1);assert.equal(result.found[0].model,'HyperDeck');
 }finally{await deck.close();}
});
