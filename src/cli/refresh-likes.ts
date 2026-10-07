import {publicCatalog,type Catalog} from '../shared/model';
import {PoliteFetcher,StopCrawl,robotsAllows} from '../shared/fetcher';
import {parseLikes} from '../shared/likes';
import {readJson,writeJson} from './files';

export async function refreshLikes(kind?:string){
 const store=await readJson<Catalog>('data/catalog.json');
 const products=publicCatalog(store).products.filter(p=>kind==='accessory'?p.kind==='accessory':['clothing','accessory'].includes(p.kind)&&p.audience!=='unisex');
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
 const budgetPath=`data/budget-${day}.json`,budget=await readJson(budgetPath,{used:0});
 const fetcher=new PoliteFetcher({intervalMs:1000,maxRequests:Math.max(0,12000-budget.used),retries:1,timeoutMs:20000});
 let updated=0,unknown=0;
 try{
  const robots=await fetcher.get('https://accounts.booth.pm/robots.txt');
  if(!robotsAllows(robots,'/wish_lists.json'))throw new StopCrawl('robots disallow wish_lists');
  for(let start=0;start<products.length;start+=24){
   const ids=products.slice(start,start+24).map(p=>p.id);
   const url=new URL('https://accounts.booth.pm/wish_lists.json');for(const id of ids)url.searchParams.append('item_ids[]',id);
   const counts=parseLikes(await fetcher.get(url.href),ids),checkedAt=new Date().toISOString();
   for(const [id,count]of counts){const p=store.products.find(p=>p.id===id)!;p.likes=count;p.likesFetchedAt=checkedAt;count===null?unknown++:updated++;}
   await writeJson('data/catalog.json',store);
   console.log(`likes ${Math.min(start+24,products.length)}/${products.length}`);
  }
 }finally{budget.used+=fetcher.requests;await writeJson(budgetPath,budget);}
 const quote=(s:string)=>"'"+s.replace(/'/g,"''")+"'";
 const sql=products.map(item=>{const p=store.products.find(p=>p.id===item.id)!;return `UPDATE products SET payload=json_set(payload,'$.likes',${p.likes??'NULL'},'$.likesFetchedAt',${p.likesFetchedAt?quote(p.likesFetchedAt):'NULL'}) WHERE id=${quote(p.id)};`;}).join('\n');
 await (await import('node:fs/promises')).writeFile('data/likes-update.sql',sql);
 console.log(JSON.stringify({updated,unknown,requests:fetcher.requests}));
}
