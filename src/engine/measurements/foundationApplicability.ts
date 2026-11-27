import type {FoundationEntity,FoundationApplicability} from './measurementTypes';
import {validateFoundationTopology} from './foundationTopology';
export function setFoundationApplicability(entities:FoundationEntity[],ids:string[],value:FoundationApplicability):FoundationEntity[]{
 const selected=new Set(ids);
 if(!selected.size||selected.size!==ids.length||ids.some(id=>!entities.some(e=>e.id===id)))throw Error('Select existing foundation components');
 if(value.status!=='included'&&!value.reason.trim())throw Error('Document the scope decision reason');
 const next=entities.map(e=>selected.has(e.id)?{...e,scopeApplicability:value.status==='included'?{status:'included' as const}:{status:value.status,reason:value.reason.trim()}}:e);
 validateFoundationTopology(next);
 return next;
}
