import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accessoryCategory,accessorySearchTerms} from '../src/cli/full-accessory-review';
test('全取得用の分類でも衣装セット・素材・髪型を小物に混ぜない',()=>{
 assert.equal(accessoryCategory({kind:'clothing',name:'ジャケット衣装＋チョーカー'},''),null);
 assert.equal(accessoryCategory({kind:'accessory',name:'眉毛色変更マスク テクスチャ'},''),null);
 assert.equal(accessoryCategory({kind:'accessory',name:'Beanie Hair'},''),null);
 assert.equal(accessoryCategory({kind:'avatar',name:'帽子付き3Dアバター'},''),null);
 assert.equal(accessoryCategory({kind:'accessory',name:'DOGTAG_necklace'},''),'首元アクセサリー');
 assert.equal(accessoryCategory({kind:'clothing',name:'Gloves Pack'},''),'手袋');
 assert.equal(accessoryCategory({kind:'accessory',name:'Vein Bangle'},''),'ブレスレット');
 assert.ok(accessorySearchTerms.includes('bracelet')&&accessorySearchTerms.includes('リュック'));
});
