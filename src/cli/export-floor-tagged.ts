import{Catalog,effective,materializeCatalogTags}from'../shared/model';
import{NO_CONFIRMED_FLOOR_TAG}from'../shared/floor-tags';
import{readJson,writeJson}from'./files';

export async function exportFloorTagged(saveTags=false){
 const store=await readJson<Catalog>('data/catalog.json');
 if(saveTags){materializeCatalogTags(store);await writeJson('data/catalog.json',store);}
 const items=effective(store).products.filter(p=>p.review==='verified'&&p.availability==='public'&&p.catalogTags.includes(NO_CONFIRMED_FLOOR_TAG));
 const result={tag:NO_CONFIRMED_FLOOR_TAG,label:'98体対応未確認',meaning:'指定の98体への確認済み対応が未登録。非対応の断定ではない。',exportedAt:new Date().toISOString(),total:items.length,items:items.map(p=>({id:p.id,name:p.name,url:p.url,fetchedAt:p.fetchedAt,catalogTags:p.catalogTags,audienceEvidence:p.audienceEvidence}))};
 await writeJson('data/no-confirmed-floor-98.json',result);
 console.log(JSON.stringify({tag:result.tag,total:result.total,file:'data/no-confirmed-floor-98.json'}));
}
