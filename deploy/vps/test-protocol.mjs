import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const records=Array.from({length:100},(_,rpc)=>({action:'robots',rpc,text:'User-agent: *\nDisallow: /secret',path:rpc%2?'/secret':'/ja/items/123',extra:'日本語\r\n\u2028\u2029'+('長い文字列'.repeat(20000))}));
const child=spawnSync(process.execPath,['--max-old-space-size=160','data/vps-build/parser.mjs','data/vps-migration/seed.json'],{input:'\n'+records.map(r=>Buffer.from(JSON.stringify(r)).toString('base64')).join('\n\n')+'\n',encoding:'utf8',maxBuffer:4*1024*1024});
assert.equal(child.status,0,child.error?.code??child.stderr);
const replies=child.stdout.trim().split('\n').map(s=>JSON.parse(Buffer.from(s,'base64').toString('utf8')));
assert.equal(replies.length,records.length);
for(const [i,reply] of replies.entries()){assert.equal(reply.rpc,i);assert.equal(reply.allowed,i%2===0);}
console.log('100 large Unicode RPC frames and blank-line handling passed');
