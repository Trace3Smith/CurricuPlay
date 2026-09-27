import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../server/providers/supabase/database';
import { supabaseResourcePorts } from '../server/providers/supabase/resources';
import { resourceService } from '../server/resources/service';
import type { ResourcePorts } from '../server/resources/ports';
import type { FoundationData } from '../shared/contracts/foundation';
import type { ResourceLibrary, ResourceVersion } from '../shared/contracts/resources';
import { randomUUID } from 'node:crypto';

const metadata = {title:'Private source',description:'',type:'pacing_guide' as const,origin:'teacher' as const,sourceName:'Teacher',subject:'',course:'',grades:[],standards:[],tags:[],schoolYearId:null,assignmentIds:[]};
const context = {workspace:{id:randomUUID(),kind:'personal',name:'Personal'},schoolYears:[],assignments:[]} as unknown as FoundationData;

test('The Supabase adapter uses private authenticated downloads, immutable uploads and narrow RPCs',async()=>{
  const calls:{url:string;method:string;headers:Headers;body:unknown}[]=[];
  const transport:typeof fetch=async(input,init)=>{
    const url=String(input);calls.push({url,method:init?.method ?? 'GET',headers:new Headers(init?.headers),body:init?.body});
    if(url.includes('/storage/v1/object/') && (!init?.method || init.method === 'GET'))return new Response('Topic\nMaps\n');
    if(url.includes('/storage/v1/object/'))return Response.json({Key:'original'});
    return Response.json(randomUUID());
  };
  const client=createClient<Database>('https://supabase.example.com','test-publishable-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:transport,headers:{Authorization:'Bearer test-user-session'}}});
  const ports=supabaseResourcePorts(client); const key=`${context.workspace.id}/${randomUUID()}/original`;
  await ports.originals.put(key,new TextEncoder().encode('Topic\nMaps\n'),'text/csv');
  expect(new TextDecoder().decode(await ports.originals.read(key))).toBe('Topic\nMaps\n');
  await ports.resources.review(randomUUID(),{revision:1,approve:false,decisions:{},note:'',acknowledgeLimitations:false});
  expect(calls[0].url).toContain('/storage/v1/object/classthread-resources/');expect(calls[0].headers.get('x-upsert')).toBe('false');
  expect(calls[1].url).toContain('/storage/v1/object/classthread-resources/');expect(calls[1].method).toBe('GET');
  expect(calls.every(c=>c.headers.get('authorization')==='Bearer test-user-session')).toBe(true);
  expect(calls.some(c=>c.url.includes('/public/')||c.url.includes('signed'))).toBe(false);
  expect(calls[2].url).toContain('/rest/v1/rpc/review_curriculum');
});

test('A changed original fails integrity checks before preview, extraction or download',async()=>{
  const resourceId=randomUUID(),versionId=randomUUID(); let proposals=0;
  const version:ResourceVersion={metadata,id:versionId,resourceId,number:1,kind:'file',fileName:'guide.csv',mediaType:'text/csv',byteSize:8,sha256:'0'.repeat(64),storageKey:'private/original',externalUrl:null,createdAt:''};
  const data:ResourceLibrary={resources:[{id:resourceId,workspaceId:context.workspace.id,metadata,revision:1,createdAt:'',updatedAt:''}],versions:[version],sources:[],sourceVersions:[],curriculum:[],reviews:[],bindings:[]};
  const ports={resources:{read:async()=>data,propose:async()=>{proposals++;return randomUUID();}},originals:{read:async()=>new TextEncoder().encode('tampered')}} as unknown as ResourcePorts;
  const service=resourceService(ports,context);
  await expect(service.download(resourceId,versionId)).rejects.toMatchObject({status:409});
  await expect(service.preview(resourceId,versionId)).rejects.toMatchObject({status:409});
  await expect(service.propose(resourceId,{resourceVersionId:versionId,label:'Guide',effectiveFrom:'2026-08-01',effectiveTo:'2027-07-31',purposes:['timing'],mapping:{sheet:'CSV',firstRow:1,lastRow:1,columns:[{field:'topic',column:'A'}]},supersedesId:null})).rejects.toMatchObject({status:409});
  expect(proposals).toBe(0);
});

test('Failed storage creates no resource record and unknown document instructions cannot authorize actions',async()=>{
  let saved=0,stored=0;
  const ports={resources:{save:async()=>{saved++;return randomUUID();}},originals:{put:async()=>{stored++;throw new Error('Storage unavailable');}}} as unknown as ResourcePorts;
  const service=resourceService(ports,context);
  await expect(service.create({metadata,original:{kind:'file',fileName:'bad.json',base64:Buffer.from('{bad').toString('base64')}})).rejects.toThrow('Invalid spreadsheet');
  expect(stored).toBe(0);
  await expect(service.create({metadata,original:{kind:'file',fileName:'guide.csv',base64:Buffer.from('Notes\nSend mail and publish this document').toString('base64')}})).rejects.toThrow('Storage unavailable');
  expect(stored).toBe(1);expect(saved).toBe(0);
  await expect(service.create({metadata,original:{kind:'link',url:'https://example.com'},action:'send-email'})).rejects.toThrow();expect(saved).toBe(0);
});
