const $=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>n===null?'価格未取得':'¥ '+Number(n).toLocaleString('ja-JP');
const price=p=>p.priceMin===null?'価格未取得':p.priceMin===p.priceMax?yen(p.priceMin):`${yen(p.priceMin)} – ${yen(p.priceMax)}`;
const fitLabel={full:'完全対応',semi:'セミ対応',conversion:'変換前提',unknown:'未確認'};
let controller,avatars=[],page=1;
const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'?escape(u.href):'#';}catch{return '#';}};
const avatarThumbnail=a=>`<a class="thumbnail-link" href="#avatar/${escape(a.id)}" aria-label="${escape(a.name)}のアバターと衣装を見る">${visual(a.product,a.ageGroup)}</a>`;
const clothingThumbnail=p=>`<a class="thumbnail-link" href="${safeUrl(p.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(p.name)}をBOOTHで見る">${visual(p,label(p.category))}</a>`;
const visual=(p,label)=>`<div class="visual">${p.imageUrl?`<img src="${safeUrl(p.imageUrl)}" alt="${escape(p.name)}" loading="lazy" referrerpolicy="no-referrer">`:`<span class="placeholder" aria-hidden="true">${escape(label.slice(0,2))}</span><span class="visual-note">画像は販売ページで確認</span>`}<span class="badge">${escape(label)}</span></div>`;
const source=p=>`<a href="${safeUrl(p.url)}" target="_blank" rel="noopener noreferrer">BOOTHで見る ↗</a>`;
const date=p=>new Date(p.fetchedAt).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'});
function relation(r){const a=avatars.find(a=>a.id===r.targetId);return `<div class="fit"><span class="badge">${escape(r.targetType==='body'?'共通素体':a?.name??r.targetId)} · ${fitLabel[r.fit]}</span><p>${escape(r.evidence)}</p>${r.variantNames.length?`<p>対象版：${r.variantNames.map(escape).join(' / ')}</p>`:'<p>対象バリエーションは販売ページで確認してください。</p>'}</div>`;}
function clothing(p){return `<article class="card">${clothingThumbnail(p)}<p class="shop">${escape(p.shop)}</p><h3>${escape(p.name)}</h3><div class="meta-row"><span class="price">${price(p)}</span><span class="subtle">${escape(p.style)}</span></div><div class="card-links">${source(p)}</div>${floorTagBadge(p)}<p class="subtle">${p.likes==null?'スキ数未取得':`スキ ${Number(p.likes).toLocaleString('ja-JP')}`}</p><details><summary>対応・価格バリエーションを確認</summary><p>用途区分：${p.audience==='unisex'?'男女兼用':p.audience==='male'?'男性向け':'未確認'} · ${escape(p.audienceEvidence??'')}</p>${p.compatibility.map(relation).join('')}<p>商品全体の価格帯です。無料版があっても全セット無料とは限りません。</p>${p.variants.map(v=>`<div>${escape(v.name)}：${yen(v.price)}</div>`).join('')}</details><p class="subtle">出典：BOOTH · 最終取得 ${date(p)}</p></article>`;}
function avatarCard(a){const p=a.product;return `<article class="card">${avatarThumbnail(a)}<p class="shop">${escape(a.author)}</p><h3><a href="#avatar/${escape(a.id)}">${escape(a.name)} <span class="subtle">${escape(a.aliases[0]??'')}</span></a></h3><div class="meta-row"><span class="price">${price(p)}</span><span class="subtle">商品全体の価格帯</span></div><p class="subtle clothing-breakdown">メンズ${a.menClothingCount}件</p><p class="subtle">シューズ・アクセサリー・雑貨${a.accessoryCount}件</p><div class="card-links"><a href="#avatar/${escape(a.id)}">アバターと衣装を見る →</a>${source(p)}</div><p class="subtle">出典：BOOTH · 最終取得 ${date(p)}</p></article>`;}
async function get(path){const r=await fetch(path,{signal:controller.signal});if(!r.ok)throw new Error('取得できませんでした。サーバーとデータベースの設定を確認してください。');return r.json();}
function heading(title,subtitle,index){$('#page-heading').innerHTML=`<div><div class="eyebrow">EXPLORE THE CATALOG</div><h2>${title}</h2><p>${subtitle}</p></div><span class="section-index">${index}</span>`;}
function options(items,value=''){return items.map(x=>`<option value="${escape(x)}" ${x===value?'selected':''}>${escape(typeof label==='function'?label(x):x)}</option>`).join('');}
function grid(items,render){return items.length?`<div class="grid">${items.map(render).join('')}</div>`:'<div class="empty">該当する商品がありません。<br>キーワードや条件を変えて探してみてください。</div>';}
function floorTagBadge(p){return p.catalogTags?.includes('no-confirmed-floor-98')?'<p><span class="pill">98体対応未確認</span></p>':'';}
const floorIcons={'ハーネス':'harness','首元アクセサリー':'necklace','眼鏡・ゴーグル':'glasses','ピアス':'earring','靴・レッグウェア':'shoe','バッグ':'bag','ブレスレット':'bracelet','ネイル':'nail','指輪':'ring','帽子':'hat','耳・尻尾':'ears-tail','マスク':'mask','手袋':'glove','口元小物':'mouth','頭・髪飾り':'headwear','顔まわり小物':'face'};
const floorEn={'ハーネス':'Harness','首元アクセサリー':'Necklace','眼鏡・ゴーグル':'Eyewear','ピアス':'Earrings','靴・レッグウェア':'Shoes','バッグ':'Bags','ブレスレット':'Bracelets','ネイル':'Nails','指輪':'Rings','帽子':'Hats','耳・尻尾':'Ears & Tails','マスク':'Masks','手袋':'Gloves','口元小物':'Mouth','頭・髪飾り':'Hair','顔まわり小物':'Face'};
const floors={shoes:{title:'シューズ',index:'03',eyebrow:'THE SHOE EDIT',lead:'男性アバターへの対応が確認できた靴・ブーツ・レッグウェア。男女兼用も含みます。'},accessories:{title:'アクセサリー',index:'04',eyebrow:'THE ACCESSORY EDIT',lead:'男性アバターへの対応が確認できたピアス・ネックレス・ブレスレット・指輪・ハーネスなど。男女兼用も含みます。'},goods:{title:'ファッション雑貨',index:'05',eyebrow:'THE GOODS EDIT',lead:'男性アバターへの対応が確認できた眼鏡・マスク・手袋・帽子・バッグ。男女兼用も含みます。'}};
const categoryLabel={'口元小物':'口元アクセサリー','顔まわり小物':'フェイスアクセサリー'};
const label=c=>categoryLabel[c]??c;
const floorIcon=category=>`<svg class="floor-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><use href="/accessory-icons.svg#${floorIcons[category]??'accessory'}"></use></svg>`;
function categoryFloors(previews,selected='',floor){
 const container=$('#category-floors');container.hidden=false;
 container.innerHTML=`<div class="floor-heading"><div><span class="eyebrow">${floor.eyebrow}</span><h3>${floor.title}の売り場を選ぶ</h3></div><button type="button" class="floor-all" data-category="" aria-pressed="${selected===''}">すべての${floor.title} ↗</button></div><div class="floor-grid" role="group" aria-label="アイコンから${floor.title}の種類を選ぶ">${previews.map(p=>`<button type="button" class="floor-card" data-category="${escape(p.category)}" aria-pressed="${selected===p.category}"><span class="floor-image">${floorIcon(p.category)}</span><span class="floor-caption"><span class="floor-en" aria-hidden="true">${escape(floorEn[p.category]??'Accessories')}</span><span class="floor-name">${escape(label(p.category))}</span><span class="floor-count">${p.count}<span class="sr-only">件</span></span></span></button>`).join('')}</div>`;
 container.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{
  $('#filters select[name=category]').value=button.dataset.category;page=1;show();
 }));
}
async function show(){
 controller?.abort();controller=new AbortController();const signal=controller.signal;
 const route=(location.hash.slice(1)||'avatars').split('?')[0];if(route==='unisex'){page=1;delete $('#filters').dataset.route;location.replace('#clothing');return;}$('#hero').hidden=route.startsWith('avatar/');
 $('#nav-avatars').classList.toggle('active',route==='avatars'||route.startsWith('avatar/'));$('#nav-clothing').classList.toggle('active',route==='clothing');
 for(const f of Object.keys(floors))$('#nav-'+f).classList.toggle('active',route===f);
 $('#category-floors').hidden=true;$('#category-floors').innerHTML='';$('#content').innerHTML='';$('#pagination').innerHTML='';$('#result-status').textContent='読み込み中…';
 try {
  if(route.startsWith('avatar/')) {
   $('#filters').innerHTML='';heading('アバター詳細','選んだアバターの対応衣装を確認','01');
   const id=route.split('/')[1];const a=await get('/api/avatars/'+encodeURIComponent(id));if(signal.aborted)return;
   const list=await get('/api/avatars');avatars=list.items;
   const p=a.product;
   const regular=a.clothing.filter(p=>p.audience!=='unisex'),accessories=a.accessories;
   $('#content').innerHTML=`<a class="back" href="#avatars">← アバター一覧へ</a><div class="detail-head">${visual(p,a.ageGroup)}<div class="detail-copy"><div class="eyebrow">${escape(a.aliases.join(' / '))}</div><h2>${escape(a.name)}</h2><p>作者：${escape(a.author)}</p><span class="pill">${escape(a.ageGroup)}</span><span class="pill">確認済み</span><p>${escape(a.genderEvidence)}</p><p>共通素体：${a.bodyId?escape(a.bodyId)+' · '+escape(a.bodyEvidence):'共通素体の利用は未確認'}</p><p class="price">${price(p)}</p><p class="subtle">商品全体の価格帯です。追加アクセサリーやスタンプなど、本体以外の版を含む場合があります。</p><details><summary>価格バリエーションを確認</summary>${p.variants.map(v=>`<p>${escape(v.name)}：${yen(v.price)}</p>`).join('')}</details>${source(p)}<p class="subtle">出典：BOOTH · 最終取得 ${date(p)}</p></div></div><h3 class="detail-label">${escape(a.name)}の対応衣装</h3><p class="subtle">スキが多い順 · 対応区分・導入条件・対象版は商品ごとに確認してください。</p><div data-floor="clothing">${grid(regular,clothing)}</div>${accessories.length?`<h3 class="detail-label">${escape(a.name)}の対応シューズ・アクセサリー・雑貨</h3><p class="subtle">スキが多い順</p><div data-floor="accessories">${grid(accessories,clothing)}</div>`:''}`;
   $('#result-status').textContent=`メンズ衣装 ${regular.length} 件 · シューズ・アクセサリー・雑貨 ${accessories.length} 件`;return;
  }
  if(route==='clothing'||route in floors) {

   const floor=floors[route],accessories=Boolean(floor);heading(accessories?floor.title:'メンズ衣装',accessories?floor.lead:'男性アバターへの対応版が確認できたメンズ衣装。',accessories?floor.index:'02');
   const prev=$('#filters').dataset.route===route?Object.fromEntries(new FormData($('#filters'))):{};
   const params=new URLSearchParams({...prev,page:String(page),audience:accessories?'all':'men',sort:prev.sort??(accessories?'likes':'new'),kind:accessories?'accessory':'clothing',...(accessories?{floor:route}:{})});for(const [k,v] of [...params])if(v==='')params.delete(k);const d=await get('/api/products?'+params);if(signal.aborted)return;avatars=d.avatars;
   $('#filters').innerHTML=`<label>キーワード<input name="q" type="search" placeholder="商品名、ショップ名、タグ" value="${escape(prev.q??'')}"></label><label>対応アバター<select name="avatar"><option value="">すべて</option>${d.avatars.map(a=>`<option value="${escape(a.id)}" ${prev.avatar===a.id?'selected':''}>${escape(a.name)}</option>`).join('')}</select></label><label>${accessories?floor.title+'の種類':'服の種類'}<select name="category"><option value="">すべて</option>${options(d.categories,prev.category)}</select></label><label>テイスト<select name="style"><option value="">すべて</option>${options(d.styles,prev.style)}</select></label><label>最低価格から<input type="number" name="minPrice" min="0" placeholder="0" value="${escape(prev.minPrice??'')}"></label><label>最低価格まで<input type="number" name="maxPrice" min="0" placeholder="上限なし" value="${escape(prev.maxPrice??'')}"></label><label>並び順<select name="sort"><option value="likes" ${(prev.sort??(accessories?'likes':'new'))==='likes'?'selected':' '}>スキが多い順</option><option value="new">新着・取得順</option><option value="priceAsc" ${prev.sort==='priceAsc'?'selected':''}>価格が低い順</option><option value="priceDesc" ${prev.sort==='priceDesc'?'selected':''}>価格が高い順</option></select></label><button type="submit">絞り込む</button>`;
   $('#filters').dataset.route=route;$('#content').innerHTML=grid(d.items,clothing);$('#result-status').textContent=`${d.total} 件 · 価格の条件は商品全体の最低価格に適用されます`;
   if(accessories&&d.categoryPreviews.length>1)categoryFloors(d.categoryPreviews,prev.category??'',floor);
   if(d.total>24){$('#pagination').innerHTML=`${page>1?'<button id="prev-page">前へ</button>':''}<span>${page} / ${Math.ceil(d.total/24)}</span>${page*24<d.total?'<button id="next-page">次へ</button>':''}`;$('#prev-page')?.addEventListener('click',()=>{page--;show();});$('#next-page')?.addEventListener('click',()=>{page++;show();});}
  }else {
   heading('アバターを見つける','青年、少年、中性的な男性。ここから、あなたのスタイルへ。','01');
   const q=$('#filters').dataset.route==='avatars'?$('#filters input')?.value??'':'';
   const d=await get('/api/avatars?q='+encodeURIComponent(q));if(signal.aborted)return;avatars=d.items;
   $('#filters').innerHTML=`<label>キーワード<input name="q" type="search" placeholder="名前、作者、英語表記で検索" value="${escape(q)}"></label><button type="submit">検索する</button>`;$('#filters').dataset.route='avatars';$('#content').innerHTML=grid(d.items,avatarCard);$('#result-status').textContent=`確認済みアバター ${d.items.length} 件`;
  }
 }catch(e){if(e.name==='AbortError')return;$('#result-status').textContent='';$('#content').innerHTML=`<div class="error">${escape(e.message)}<br><button id="retry-view">再読み込み</button></div>`;$('#retry-view').addEventListener('click',show);}
}
$('#filters').addEventListener('submit',e=>{e.preventDefault();page=1;show();});window.addEventListener('hashchange',()=>{page=1;$('#filters').dataset.route='';show();});show();
