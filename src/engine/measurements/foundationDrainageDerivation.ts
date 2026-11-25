import type {FoundationEntity,FoundationDrainageSource,Point} from './measurementTypes';
import {foundationRectangle,extendedStrip} from './foundationGeometry';
const near=(a:number,b:number)=>Math.abs(a-b)<1e-8;
const same=(a:Point,b:Point)=>near(a.x,b.x)&&near(a.y,b.y);
export function rectangularExteriorRoute(entities:FoundationEntity[],ids:string[],offset:number):Point[]{
 if(ids.length!==4||new Set(ids).size!==4||!Number.isFinite(offset)||offset<0)throw Error('Select four distinct rectangular walls and specify nonnegative exterior offset');
 const walls=ids.map(id=>{const e=entities.find(q=>q.id===id);if(!e||e.kind!=='foundationWall'||!e.foundation?.centrelineConfirmed||e.widthFt===null||e.foundation.material!=='poured concrete')throw Error('Confirm all four source wall centrelines and widths');return e});
 const w=walls[0].widthFt!;
 if(walls.some(e=>e.assemblyId!==walls[0].assemblyId||!near(e.widthFt!,w)||!near(e.foundation!.joinStartFt??0,w/2)||!near(e.foundation!.joinEndFt??0,w/2)))throw Error('Require one complete uniform rectangular wall assembly with reconciled corners');
 if(entities.filter(e=>e.kind==='foundationWall'&&e.assemblyId===walls[0].assemblyId).length!==4)throw Error('Select complete four-wall assembly');
 const b=walls.map(e=>extendedStrip(e.start,e.end,w,e.foundation!.joinStartFt,e.foundation!.joinEndFt));
 const outer={xmin:Math.min(...b.map(q=>q.xmin)),xmax:Math.max(...b.map(q=>q.xmax)),ymin:Math.min(...b.map(q=>q.ymin)),ymax:Math.max(...b.map(q=>q.ymax))};
 const expected=foundationRectangle(outer,w,'exterior').segments;
 if(!expected.every(s=>walls.filter(e=>same(e.start,s.start)&&same(e.end,s.end)||same(e.start,s.end)&&same(e.end,s.start)).length===1))throw Error('Source walls do not form a verified rectangle');
 const {xmin,xmax,ymin,ymax}=outer;
 const p=[{x:xmin-offset,y:ymin-offset},{x:xmax+offset,y:ymin-offset},{x:xmax+offset,y:ymax+offset},{x:xmin-offset,y:ymax+offset}];
 if(p.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y)))throw Error('Invalid drainage route extent');
 return p;
}
export function derivePerimeterDrainage(entities:FoundationEntity[],ids:string[],offsetFt:number,material:string,layerId:string,id:()=>string):FoundationEntity[]{
 if(!material.trim()||!layerId.trim())throw Error('Specify drainage material and layer identity');
 const wallIds=[...ids].sort(),p=rectangularExteriorRoute(entities,wallIds,offsetFt);
 if(entities.some(e=>e.foundation?.drainageSource?.wallIds.some(v=>wallIds.includes(v))))throw Error('Remove existing derived perimeter drainage before regenerating');
 const groupId=id(),assemblyId=id();
 return p.map((start,edge)=>{const entityId=id(),drainageSource:FoundationDrainageSource={version:1,wallIds,groupId,edge,offsetFt,material,layerId};return {id:entityId,physicalId:entityId,assemblyId,source:{reference:'Derived rectangular exterior drainage'},kind:'foundationLine',purpose:'drainage',start,end:p[(edge+1)%4],foundation:{version:1,material,coverage:{confirmed:true,layerId},drainageSource}}});
}
export function validateDrainageSources(entities:FoundationEntity[]):void{
 const groups=new Map<string,FoundationEntity[]>(),owners=new Map<string,string>();
 for(const e of entities){const s=e.foundation?.drainageSource;if(!s)continue;for(const id of s.wallIds){if(owners.has(id)&&owners.get(id)!==s.groupId)throw Error('Duplicate derived perimeter drainage source');owners.set(id,s.groupId)}const g=groups.get(s.groupId)??[];g.push(e);groups.set(s.groupId,g)}
 for(const g of groups.values()){
 const first=g[0],s=first.foundation!.drainageSource!,p=route(entities,s.wallIds,s.offsetFt);
 if(g.length!==4||new Set(g.map(e=>e.foundation!.drainageSource!.edge)).size!==4)throw Error('Incomplete derived drainage group');
 for(const e of g){const d=e.foundation!.drainageSource!;
 if(e.kind!=='foundationLine'||e.purpose!=='drainage'||e.assemblyId!==first.assemblyId||JSON.stringify([...d.wallIds].sort())!==JSON.stringify([...s.wallIds].sort())||d.offsetFt!==s.offsetFt||d.material!==s.material||d.layerId!==s.layerId||!same(e.start,p[d.edge])||!same(e.end,p[(d.edge+1)%4])||e.foundation?.material!==s.material||e.foundation.coverage?.layerId!==s.layerId||!e.foundation.coverage.confirmed)throw Error('Derived drainage is stale; remove or regenerate the group before editing its source');
 }
 }
}
