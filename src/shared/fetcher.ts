import { boothUrl } from './model';
import { assertPublicHtml } from './parser';
export class StopCrawl extends Error {
  constructor(message:string,public retryAt?:number){super(message);}
}
export type FetchOptions={intervalMs:number,maxRequests:number,retries:number,timeoutMs:number};
export class PoliteFetcher {
  requests=0; last=0;
  constructor(public options:FetchOptions,private transport:typeof fetch=fetch,private sleep:(ms:number)=>Promise<void>=ms=>new Promise(r=>setTimeout(r,ms))){}
  async get(url:string):Promise<string> {
    boothUrl.parse(url);
    let rateLimited=false;
    for(let attempt=0;attempt<=this.options.retries;attempt++) {
      if(this.requests>=this.options.maxRequests)throw new StopCrawl('request limit reached');
      await this.sleep(Math.max(0,this.options.intervalMs-(Date.now()-this.last)));
      this.last=Date.now();this.requests++;
      let r:Response;
      try {r=await this.transport(url,{headers:{'User-Agent':'vrc-mens-catalog/0.1 (public metadata catalog)'},signal:AbortSignal.timeout(this.options.timeoutMs),redirect:'manual'});}
      catch(e) {if(e instanceof StopCrawl)throw e;if(attempt===this.options.retries)throw new Error('network/timeout');await this.sleep(1000*2**attempt);continue;}
      if([401,403].includes(r.status))throw new StopCrawl(`access restricted: HTTP ${r.status}`);
      if(r.status>=300 && r.status<400)throw new StopCrawl('redirect requires review');
      if(r.status===429) {
        const raw=r.headers.get('Retry-After');
        const ms=raw && /^\d+$/.test(raw)?Number(raw)*1000:raw?Math.max(0,Date.parse(raw)-Date.now()):60000;
        const retryAt=Date.now()+(Number.isFinite(ms)?ms:60000);
        if(rateLimited || attempt===this.options.retries)throw new StopCrawl('repeated HTTP 429',retryAt);
        rateLimited=true;
        // 長い待機は実行を止め、次回に委ねる。Retry-Afterより早く再試行しない。
        if(!Number.isFinite(ms)||ms>60000)throw new StopCrawl('HTTP 429: long Retry-After; resume later',retryAt);
        await this.sleep(ms);continue;
      }
      if(r.status>=500 && attempt<this.options.retries) {await this.sleep(1000*2**attempt);continue;}
      if(!r.ok)throw new Error(`HTTP ${r.status}; preserve previous record`);
      const html=await r.text();
      try {assertPublicHtml(html);}catch{throw new StopCrawl('access challenge; stopped');}
      return html;
    }
    throw new Error('retry exhausted');
  }
}
export function robotsAllows(text:string,path:string) {
  // BOOTHの現在の * グループと長い最長一致Allow/Disallow。未知の構文は保守的に停止。
  const groups:{agents:string[],rules:{allow:boolean,path:string}[]}[]=[];
  let group:typeof groups[number]|undefined;
  for(const raw of text.split(/\r?\n/)) {
    const line=raw.split('#')[0].trim();if(!line)continue;
    const match=line.match(/^([\w-]+)\s*:\s*(.*)$/);if(!match)throw new StopCrawl('unknown robots syntax');
    const [,field,value]=match;
    if(field.toLowerCase()==='user-agent') {if(!group || group.rules.length){group={agents:[],rules:[]};groups.push(group);}group.agents.push(value.toLowerCase());}
    else if(['allow','disallow'].includes(field.toLowerCase()) && group && value)group.rules.push({allow:field.toLowerCase()==='allow',path:value});
  }
  const specific=groups.filter(g=>g.agents.some(a=>a!=='*' && 'vrc-mens-catalog'.includes(a)));
  const rules=(specific.length?specific:groups.filter(g=>g.agents.includes('*'))).flatMap(g=>g.rules);
  const matched=rules.filter(r=>new RegExp('^'+r.path.split('*').map(s=>s.replace(/[.+?^{}()|[\]\\]/g,'\\$&')).join('.*').replace(/\\\$$/,'$')).test(path)).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));
  return !matched.length||matched[0].allow;
}
