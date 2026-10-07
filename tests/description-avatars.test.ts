import test from 'node:test';import assert from 'node:assert/strict';
import {extractDescriptionTargets} from '../src/shared/description-avatars';
import {avatarSchema} from '../src/shared/model';
const html=(text:string)=>`<article class="market-item-detail-article"><section class="shop__text"><h2>対応アバター</h2><p class="js-autolink">${text}</p></section></article>`;
test('概要の男女別対応区分とBOOTH本体URLを抽出し、Lady区分と関連欄を混ぜない',()=>{
 const targets=extractDescriptionTargets(html(`◇Men'sAvatar◇\n獏\nhttps://example.booth.pm/items/123\n◇Lady'sAvatar◇\nしなの\nhttps://booth.pm/ja/items/456\nクレジット\n男性アバター\nhttps://booth.pm/ja/items/789`),[]);
 assert.equal(targets.find(t=>t.productId==='123')?.gender,'male');
 assert.equal(targets.find(t=>t.productId==='456')?.gender,'female');
 assert.ok(!targets.some(t=>t.productId==='789'));
});
test('メンズライクや少年の物語からアバターの性別を決めず、予定と共通素体を分ける',()=>{
 const a=extractDescriptionTargets(html('メンズライクな衣装です\n少年は大人の世界に踏み出す。\nモデルA\nhttps://booth.pm/ja/items/123'),[]);
 assert.equal(a[0].gender,'unknown');
 const b=extractDescriptionTargets(html('メンズ male Aカテゴリ\n+Head 共通素体\nhttps://booth.pm/ja/items/5153266\n追加対応予定アバター\nモデルB\nhttps://booth.pm/ja/items/456'),[]);
 assert.equal(b.find(t=>t.productId==='5153266')?.kind,'body');
 assert.equal(b.find(t=>t.productId==='456')?.planned,true);
 const materials=extractDescriptionTargets(html('男性向け\n宝石 MatCap\nhttps://booth.pm/ja/items/789'),[]);
 assert.equal(materials.length,0);
 const componentGender=extractDescriptionTargets(html('Mens\n衣装の構成\n対応アバター\nモデルA\nhttps://booth.pm/ja/items/123'),[]);
 assert.equal(componentGender[0].gender,'unknown');
});
test('既知アバターをURLと名称で照合し、女性版の記載は男性版と区別する',()=>{
 const a=avatarSchema.parse({id:'male-a',name:'モデルA',productId:'123',aliases:['ModelA'],author:'作者',bodyId:null,bodyEvidence:'',genderEvidence:'作者が男性と明記',ageGroup:'未分類',review:'verified'});
 const targets=extractDescriptionTargets(html('モデルA\nhttps://booth.pm/ja/items/123\nFemale Version\nモデルA\nhttps://booth.pm/ja/items/123'),[a]);
 assert.equal(targets.filter(t=>t.gender==='male').length,1);assert.equal(targets.filter(t=>t.gender==='female').length,1);
});
