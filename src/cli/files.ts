import fs from 'node:fs/promises';
import path from 'node:path';
import { Catalog } from '../shared/model';
export const empty=():Catalog=>({products:[],avatars:[],bodies:[],compatibility:[],runs:[],overrides:[]});
export async function readJson<T>(file:string,fallback?:T):Promise<T> {
  try{return JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));}catch(e:any){if(e.code==='ENOENT' && fallback!==undefined)return fallback;throw e;}
}
export async function writeJson(file:string,value:unknown) {
  await fs.mkdir(path.dirname(file),{recursive:true});
  const temp=file+'.'+process.pid+'.tmp';await fs.writeFile(temp,JSON.stringify(value,null,2)+'\n');
  // Windowsの読み取り中・ウイルス検査中の短い共有違反でも、元ファイルを残して再試行する。
  for(let attempt=0;;attempt++){
    try{await fs.rename(temp,file);break;}
    catch(e:any){if(!['EPERM','EACCES','EBUSY'].includes(e.code)||attempt>=9)throw e;await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)));}
  }
}
export async function withLock<T>(fn:()=>Promise<T>):Promise<T> {
  await fs.mkdir('data',{recursive:true});
  let handle;
  try {handle=await fs.open('data/crawler.lock','wx');}catch(e:any){if(e.code==='EEXIST')throw new Error('crawler lock exists; confirm no running process before recovering');throw e;}
  try {await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));return await fn();}
  finally {await handle.close();await fs.unlink('data/crawler.lock');}
}
