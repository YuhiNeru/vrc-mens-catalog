// 保存済みの実HTMLからメタデータと短い本文断片だけを抽出。テストは外部アクセスなし。
import fs from 'node:fs/promises';
import {load} from 'cheerio/slim';
for(const id of ['5260363','4897493','5213501','7475223','8434318']) {
 const html=await fs.readFile(`data/raw/${id}.html`,'utf8'),$=load(html);
 const ld=JSON.parse($('script[type="application/ld+json"]').first().text());
 ld.description=ld.description.slice(0,100);
 const root=$('[data-tracking="detail_item"]').first();
 const attrs=`data-product-id="${id}" data-product-category="${root.attr('data-product-category')}" data-tracking="detail_item"`;
 const image=$('meta[property="og:image"]').attr('content');
 const variants=$('#variations').clone();variants.find('form').remove();variants.find('.variation-cart').remove();
 const out=`<!doctype html><meta property="og:image" content="${image}"><script type="application/ld+json">${JSON.stringify(ld)}</script><div ${attrs}><div class="summary"><div class="description">${ld.description}</div></div>${variants.toString()}</div>`;
 await fs.writeFile(`tests/fixtures/${id}.html`,out);
}
const $=load(await fs.readFile('data/raw/search.html','utf8'));
const cards=$('[data-product-id][data-tracking="impression_item"]').slice(0,3).map((_,el)=>`<div class="item-card" data-product-id="${$(el).attr('data-product-id')}" data-tracking="impression_item"></div>`).get().join('');
await fs.writeFile('tests/fixtures/search.html','<h1>検索結果</h1>'+cards);
await fs.writeFile('tests/fixtures/provenance.json',JSON.stringify({checkedAt:'2026-10-07',note:'取得した実HTMLのメタデータ、価格DOM、短い本文断片を保存。本文全文・フォーム・画像は収録しない。',sources:['https://hyuuganatu.booth.pm/items/5260363','https://hotogiya.booth.pm/items/4897493','https://ki-necave.booth.pm/items/5213501','https://booth.pm/ja/items/7475223','https://studioyono.booth.pm/items/8434318']},null,2));
