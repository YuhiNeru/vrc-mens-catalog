import fs from 'node:fs';
import readline from 'node:readline';
import {parseProduct,assertPublicHtml} from '../../src/shared/parser';
import {reviewedAccessory} from '../../src/cli/full-accessory-review';
import {importSchema,type Compatibility} from '../../src/shared/model';
import {robotsAllows} from '../../src/shared/fetcher';
import {parseLikes} from '../../src/shared/likes';
const seed=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const protectedIds=new Set(seed.protectedIds);
for await(const line of readline.createInterface({input:process.stdin,crlfDelay:Infinity})){
 if(!line.trim())continue;
 let stage='json',action='unknown',rpc:number|undefined;
 const respond=(value:unknown)=>console.log(Buffer.from(JSON.stringify({...value as object,rpc}),'utf8').toString('base64'));
 try{
  const request=JSON.parse(Buffer.from(line,'base64').toString('utf8'));
  rpc=request.rpc;
  action=request.action??'product';stage=action;
  if(request.action==='robots')respond({allowed:robotsAllows(request.text,request.path)});
  else if(request.action==='likes')respond({counts:Object.fromEntries(parseLikes(request.text,request.ids))});
  else{
   assertPublicHtml(request.html);
   const parsed=request.existing?{product:request.existing,compatibility:request.compatibility}:parseProduct(request.html,request.url,seed.avatars,request.fetchedAt);
   const data=importSchema.parse({products:[parsed.product],compatibility:parsed.compatibility.filter((r:Compatibility)=>r.targetType==='body'||seed.avatars.some((a:any)=>a.id===r.targetId))});
   const review=protectedIds.has(parsed.product.id)?null:reviewedAccessory(request.html,parsed.product,seed.avatars,seed.bodies);
   respond({product:data.products[0],compatibility:data.compatibility,review});
  }
 }catch(e){respond({error:e instanceof Error&&/challenge/.test(e.message)?'challenge':'parse_error',stage,action,kind:e instanceof Error?e.name:'unknown',bytes:line.length});}
}
