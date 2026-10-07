import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLikes,byLikes} from '../src/shared/likes';
test('公開スキ数を照合し、0と未取得を区別する',()=>{
 const counts=parseLikes(JSON.stringify({wishlists_counts:{'1':50,'2':0,'99':10}}),['1','2','3']);
 assert.deepEqual([...counts],[['1',50],['2',0],['3',null]]);
 assert.throws(()=>parseLikes('{"wishlists_counts":{"1":-1}}',['1']));
 assert.throws(()=>parseLikes('{}',['1']));
});
test('スキ数降順、同数は取得日時順、未取得は末尾にする',()=>{
 const rows=[{id:'1',likes:null,fetchedAt:'2026-10-08T01:00:00Z'},{id:'2',likes:0,fetchedAt:'2026-10-08T00:00:00Z'},{id:'3',likes:100,fetchedAt:'2026-10-08T00:00:00Z'},{id:'4',likes:100,fetchedAt:'2026-10-08T01:00:00Z'}];
 assert.deepEqual(rows.sort(byLikes).map(p=>p.id),['4','3','2','1']);
});
