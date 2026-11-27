import type { ProjectDocument } from '../projectDocument';
import { replaceFoundationAssemblyState } from '../workspaceController';
import type {
  AssemblyChange, AssemblyIntent, AssemblyPreview, ChildBinding, ComponentScopeRecord, FoundationAssemblyRecord, RetainedIdentity,
} from './foundationAssemblyModel';
import { planFoundationDeletion } from './foundationDerivation';
import { regenerateFoundationAssembly } from './foundationAssemblyRegeneration';
import { foundationReleaseGroup, foundationRoleKey, stableValue } from './foundationAssemblyValidation';
import { measureFoundation } from './foundationMeasurements';
import type { FoundationEntity } from './measurementTypes';

const validatedPreviews=new WeakMap<AssemblyPreview,string>();
const equal=(a:unknown,b:unknown)=>JSON.stringify(stableValue(a))===JSON.stringify(stableValue(b));
const retainedId=(identity:RetainedIdentity)=>identity.kind==='child'?identity.binding.entityId:identity.id;
const allBindings=(a:FoundationAssemblyRecord)=>[...a.children,...a.dormantChildren.map(x=>x.child)];
const design=(a:AssemblyIntent)=>({trace:a.trace,specifications:a.specifications,overrides:a.overrides,...(a.preset?{preset:a.preset}:{})});
const geometry=(e:FoundationEntity)=>'start' in e
  ? [e.kind,'purpose'in e?e.purpose:null,e.start,e.end,'widthFt'in e?e.widthFt:null,e.heightFt,'elevationFt'in e?e.elevationFt:null]
  : [e.kind,e.purpose,e.polygon,e.depthFt,e.elevationFt];

function routeIdentities(parent:FoundationAssemblyRecord){
  const scope=parent.specifications.drainage;
  const override=parent.overrides.find(o=>o.system==='drainage');
  const route=override?.route??(scope.status==='included'?scope.specification:scope.retainedSpecification)?.route?.value;
  if(route?.kind!=='manual')return new Map<string,RetainedIdentity>();
  return new Map<string,RetainedIdentity>([
    ...route.vertices.map(x=>[x.id,{kind:'routeVertex',id:x.id}] as const),
    ...route.segments.map(x=>[x.id,{kind:'routeSegment',id:x.id}] as const),
  ]);
}

export function previewAssemblyChange(document:ProjectDocument,workspaceId:string,assemblyId:string,revisionId:string|null,command:AssemblyChange,id:()=>string):AssemblyPreview{
  const workspace=document.workspaces.find(w=>w.id===workspaceId&&w.type==='foundation');
  const previous=workspace?.foundationAssemblies?.find(a=>a.id===assemblyId);
  const measurements=(workspace?.measurements??[]) as FoundationEntity[];
  const preview:AssemblyPreview={source:document,workspaceId,assemblyId,baseRevisionId:revisionId,changes:null,
    quantities:{before:[],after:[]},conflicts:[],unresolvedSpecifications:[]};
  try{
    if(!workspace||document.activeWorkspaceId!==workspaceId)throw Error('Select the foundation workspace before editing its assemblies');
    if((previous?.revisionId??null)!==revisionId)throw Error('Assembly changed. Start a new preview.');
    const creating=command.kind==='create'||command.kind==='adopt';
    const adoption=command.kind==='adopt'?{bindings:command.bindings,source:command.source}:command.kind==='replaceIntent'?command.adoption:undefined;
    if(creating===!!previous)throw Error('Assembly command does not match the saved parent');
    const before=measureFoundation(workspaceId,measurements).rows;
    preview.quantities={before,after:before};
    if(command.kind==='delete'){
      const parent=previous!;
      const plan=planFoundationDeletion(measurements,parent.children.map(child=>child.entityId));
      if(plan.dependentCount)throw Error('This assembly has dependent construction outside it. Resolve those dependencies before deletion.');
      const parents=workspace.foundationAssemblies!.filter(candidate=>candidate.id!==parent.id);
      replaceFoundationAssemblyState(document,workspaceId,plan.remaining,parents);
      const after=measureFoundation(workspaceId,plan.remaining).rows;
      preview.quantities.after=after;
      preview.changes={parents,measurements:plan.remaining,created:[],retained:[],retired:parent.children,detached:[]};
      validatedPreviews.set(preview,JSON.stringify(preview.changes));
      return preview;
    }
    if(command.kind==='replaceIntent'&&previous&&equal(design(command.input),design(previous))&&!command.adoption&&!command.identityReplacements?.length&&!command.scopeResolutions?.length){
      const known=new Set(previous.children.map(b=>b.entityId));
      preview.unresolvedSpecifications=regenerateFoundationAssembly(previous,measurements.filter(e=>!known.has(e.id))).gaps;
      return preview;
    }
    let next:FoundationAssemblyRecord=previous?structuredClone(previous):{
      ...((command.kind==='adopt'||command.kind==='create')?structuredClone(design(command.input)):undefined)!,
      id:assemblyId,version:1,revisionId:id(),children:[],dormantChildren:[],componentScope:[],priorScopeDecisions:[],replacements:[],
    };
    if(previous)next.revisionId=id();
    if(command.kind==='replaceIntent') {
      const {preset:_preset,...rest}=next;
      next={...rest,...structuredClone(design(command.input))};
    }
    const revision=next.revisionId;
    if(command.kind==='replaceIntent'&&!equal(command.input.trace,previous?.trace))
      throw Error('Use a separately confirmed trace correction to change the original trace.');
    if(command.kind==='correctTrace'){
      if(command.trace.reference!==next.trace.reference)throw Error('Trace correction must preserve the reference convention.');
      const old=next.trace;
      if(equal(old,command.trace))return preview;
      const removed=old.segments.filter(segment=>!command.trace.segments.some(s=>s.id===segment.id));
      if(removed.length!==command.segments.length||
        removed.some(segment=>!command.segments.some(s=>s.retiredId===segment.id&&s.successorIds.length>0)))
        throw Error('Map every replaced trace segment to its explicit successor segments.');
      const retainedIds=new Set(old.segments.map(s=>s.id));
      const newIds=new Set(command.trace.segments.map(s=>s.id));
      if(command.segments.some(s=>s.successorIds.some(id=>!newIds.has(id)||retainedIds.has(id))))
        throw Error('Trace replacements require new, valid successor identities.');
      if((next.detachments??[]).some(a=>a.disposition==='released'))throw Error('Resolve detached roles before correcting this parent trace.');
      if(old.kind==='slab'||command.trace.kind==='slab'){
        if(old.kind!=='slab'||command.trace.kind!=='slab'||removed.length)throw Error('A slab correction must retain its ordered footprint edges.');
        const slab=next.specifications.slab;
        const fields=slab.status==='included'?slab.specification:slab.retainedSpecification;
        if(fields?.extent)fields.extent={value:{kind:'independent',points:command.trace.vertices.map(v=>v.point)},confirmation:command.source};
      }
      next.trace=structuredClone(command.trace);
      next.traceCorrections=[...(next.traceCorrections??[]),{
        previousRevisionId:previous!.revisionId,revisionId:revision,previousTrace:old,source:command.source,
        segments:structuredClone(command.segments),
      }];
    }
    const byId=new Map(measurements.map(e=>[e.id,e]));
    if(adoption){
      const otherOwned=new Set((workspace.foundationAssemblies??[]).flatMap(a=>allBindings(a).map(b=>b.entityId)));
      const targetRoles=new Set(allBindings(next).map(b=>foundationRoleKey(b.role)));
      const adoptedScopes=adoption.bindings.map((binding):ComponentScopeRecord=>{
        const entity=byId.get(binding.entityId);
        if(!entity||entity.physicalId!==binding.physicalId||otherOwned.has(entity.id)||targetRoles.has(foundationRoleKey(binding.role)))
          throw Error('Adoption requires a distinct role and independent existing measurement');
        targetRoles.add(foundationRoleKey(binding.role));
        return {entityId:entity.id,decision:entity.scopeApplicability??{status:'legacyAbsent'},source:{kind:'historicalRecord',entityId:entity.id},inheritedFromEntityIds:[]};
      });
      const adoptees=new Map(adoption.bindings.map(b=>[foundationRoleKey(b.role),b]));
      const released=next.detachments?.filter(a=>a.disposition==='released')??[];
      const restoringGroups=new Set(adoption.bindings.map(b=>foundationReleaseGroup(b.role)));
      for(const audit of released){
        if(!restoringGroups.has(foundationReleaseGroup(audit.former.role)))continue;
        const target=adoptees.get(foundationRoleKey(audit.former.role));
        if(!target)throw Error('Re-adopt the complete released role group.');
        audit.disposition='readopted';
        audit.readoptedAtRevisionId=revision;
      }
      next.children.push(...structuredClone(adoption.bindings));
      const superseded=next.componentScope.filter(s=>adoptedScopes.some(a=>a.entityId===s.entityId));
      next.priorScopeDecisions.push(...superseded.map(previous=>({revisionId:revision,previous})));
      next.componentScope=next.componentScope.filter(s=>!adoptedScopes.some(a=>a.entityId===s.entityId)).concat(adoptedScopes);
      next.adoption={entityIds:[...new Set([...(next.adoption?.entityIds??[]),...adoption.bindings.map(c=>c.entityId)])],
        source:next.adoption?.source??adoption.source};
    }
    const originalBindings=allBindings(next);
    const ownedIds=new Set(originalBindings.map(b=>b.entityId));
    if(command.kind==='setComponentScope'){
      for(const target of new Set(command.entityIds)){
        if(!ownedIds.has(target))throw Error('Scope decisions require an owned component');
        const current=next.componentScope.find(s=>s.entityId===target);
        if(equal(current?.decision,command.decision))continue;
        if(current)next.priorScopeDecisions.push({revisionId:revision,previous:current});
        next.componentScope=next.componentScope.filter(s=>s.entityId!==target);
        next.componentScope.push({entityId:target,decision:command.decision,source:command.confirmation,inheritedFromEntityIds:current?.inheritedFromEntityIds??[]});
      }
      if(equal(next.componentScope,previous?.componentScope))return preview;
    }
    const detached=new Set<string>();
    if(command.kind==='detach'){
      const selected=new Set(command.roles.map(foundationRoleKey));
      if(!selected.size||!command.reason.trim())throw Error('Select owned roles and confirm a detachment reason.');
      const targets=next.children.filter(b=>selected.has(foundationRoleKey(b.role)));
      if(targets.length!==selected.size)throw Error('Detach only active, owned roles.');
      const groups=new Set(targets.map(b=>foundationReleaseGroup(b.role)));
      if(originalBindings.some(b=>groups.has(foundationReleaseGroup(b.role))&&!selected.has(foundationRoleKey(b.role))))
        throw Error('Detach the complete system or exterior layer together.');
      targets.forEach(b=>detached.add(b.entityId));
      for(const entity of measurements){
        if(detached.has(entity.id))continue;
        const f=entity.foundation;
        const sources=[...(f?.stripSource?[f.stripSource.wallId]:[]),
          ...(f?.envelopeSource?[f.envelopeSource.sourceId,...(f.envelopeSource.perimeterWallIds??[])]:[]),
          ...(f?.drainageSource?.wallIds??[])];
        if(sources.some(id=>detached.has(id)))throw Error('Dependent measurements still reference the released group. Reconcile them before detaching.');
      }
      next.detachments=[...(next.detachments??[]),...targets.map(former=>({
        former,revisionId:revision,reason:command.reason,source:command.source,disposition:'released' as const,
      }))];
      next.children=next.children.filter(b=>!detached.has(b.entityId));
      for(const id of detached)ownedIds.delete(id);
    }
    const replacements=command.kind==='replaceIntent'?[...command.identityReplacements??[]]:[];
    if(command.kind==='correctTrace'){
      for(const binding of originalBindings){
        const role=binding.role;
        if(!('sourceId' in role))continue;
        const source=command.segments.find(x=>x.retiredId===role.sourceId);
        if(!source)continue;
        if(next.dormantChildren.some(d=>d.child.entityId===binding.entityId))throw Error('Resolve a dormant role before replacing its trace segment.');
        const successorIds=source.successorIds.map(sourceId=>JSON.stringify(['foundation-child',next.id,foundationRoleKey({...role,sourceId})]));
        replacements.push({retired:{kind:'child',binding},successorIds});
      }
    }
    const retiredIds=new Set(replacements.map(x=>retainedId(x.retired)));
    if(retiredIds.size!==replacements.length)throw Error('Duplicate replacement intent');
    const oldRoute=previous?routeIdentities(previous):new Map<string,RetainedIdentity>();
    const newRoute=routeIdentities(next);
    const oldChildMap=new Map(originalBindings.map(b=>[b.entityId,b]));
    for(const r of replacements){
      const target=retainedId(r.retired);
      const expected=r.retired.kind==='child'?{kind:'child',binding:oldChildMap.get(target)}:oldRoute.get(target);
      if(!equal(expected,r.retired))throw Error('Replacement must identify an existing assembly identity');
      next.replacements.push({...structuredClone(r),revisionId:revision});
    }
    for(const [routeId] of oldRoute)if(!newRoute.has(routeId)&&!retiredIds.has(routeId))throw Error('Retiring a route identity requires explicit lineage');
    if(previous){
      const previousScope=previous.specifications.drainage;
      const currentScope=next.specifications.drainage;
      const path=(a:FoundationAssemblyRecord,s:typeof previousScope)=>{
        const override=a.overrides.find(o=>o.system==='drainage');
        return override?.route??(s.status==='included'?s.specification:s.retainedSpecification)?.route?.value;
      };
      const a=path(previous,previousScope),b=path(next,currentScope);
      if(a?.kind==='manual'&&b?.kind==='manual')for(const edge of a.segments){
        const candidate=b.segments.find(s=>s.id===edge.id);
        if(candidate&&!equal(edge,candidate))throw Error('A changed directed drainage edge needs a new segment identity and explicit lineage');
      }
    }
    if(previous){
      const segments=new Map(next.trace.segments.map(edge=>[edge.id,edge]));
      for(const old of previous.trace.segments){
        const edge=segments.get(old.id);
        if(edge&&!equal(old,edge))throw Error('Changing trace segment connectivity requires a new segment identity');
        if(!edge&&originalBindings.some(b=>'sourceId' in b.role&&b.role.sourceId===old.id&&!retiredIds.has(b.entityId)))
          throw Error('Retiring a trace segment requires explicit lineage for its owned components');
      }
      for(const [source,retired] of oldRoute)
        if(retired.kind==='routeSegment'&&!newRoute.has(source)&&originalBindings.some(b=>b.role.system==='drainage'&&b.role.sourceId===source&&!retiredIds.has(b.entityId)))
          throw Error('Replacing a route segment requires explicit child lineage and scope resolution');
    }
    next.children=next.children.filter(b=>!retiredIds.has(b.entityId));
    next.dormantChildren=next.dormantChildren.filter(b=>!retiredIds.has(b.child.entityId));
    const independent=measurements.filter(e=>!ownedIds.has(e.id)).map(e=>{
      if(!detached.has(e.id)||!e.foundation)return e;
      const {stripSource:_strip,envelopeSource:_envelope,drainageSource:_drainage,...foundation}=e.foundation;
      return {...e,foundation};
    });
    let result=regenerateFoundationAssembly(next,independent);
    if(adoption){
      if(command.kind==='adopt'&&(result.children.length!==next.children.length||result.children.some(b=>!ownedIds.has(b.entityId))))
        throw Error('Adopt a complete compatible role mapping; create new roles separately');
      for(const binding of adoption.bindings){
        const member=result.members.find(e=>e.id===binding.entityId),existing=byId.get(binding.entityId)!;
        if(!member||!equal(geometry(member),geometry(existing))||member.foundation?.material!==existing.foundation?.material||!equal(member.foundation?.elevationReference??{kind:'historical'},existing.foundation?.elevationReference??{kind:'historical'}))
          throw Error('Adoption would move or change an existing physical measurement');
      }
    }
    if(!replacements.length&&command.kind==='replaceIntent'&&command.scopeResolutions?.length)
      throw Error('Scope resolutions require explicit replacement lineage');
    const nextIds=new Set(result.children.map(b=>b.entityId));
    if(replacements.length){
      const scopes=new Map(next.componentScope.map(s=>[s.entityId,s]));
      let affected=false;
      const consumedResolutions=new Set<string>();
      for(const successor of result.children){
        const predecessors=replacements.filter(r=>r.retired.kind==='child'&&r.successorIds.includes(successor.entityId)).map(r=>retainedId(r.retired));
        if(!predecessors.length)continue;
        const inherited=predecessors.map(key=>scopes.get(key)?.decision??{status:'legacyAbsent' as const});
        const resolution=command.kind==='replaceIntent'?command.scopeResolutions?.find(s=>s.successorEntityId===successor.entityId):undefined;
        if(resolution)consumedResolutions.add(resolution.successorEntityId);
        if(resolution&&!equal([...resolution.predecessorEntityIds].sort(),[...predecessors].sort()))throw Error('Scope resolution must confirm every predecessor');
        if(!resolution&&!inherited.every(s=>equal(s,inherited[0])))throw Error('Confirm merged or ambiguous historical scope decisions');
        const record:ComponentScopeRecord={entityId:successor.entityId,decision:resolution?.decision??inherited[0],
          source:resolution?.confirmation??{kind:'historicalRecord',entityId:predecessors[0]},inheritedFromEntityIds:predecessors};
        next.componentScope=next.componentScope.filter(s=>s.entityId!==record.entityId).concat(record);
        affected=true;
      }
      if(command.kind==='replaceIntent'&&consumedResolutions.size!==(command.scopeResolutions?.length??0))
        throw Error('Scope resolution must identify a live successor with predecessor lineage');
      if(affected){
        next.children=result.children;
        result=regenerateFoundationAssembly(next,independent);
      }
    }
    const live=new Set(result.children.map(b=>b.entityId));
    const dormant=new Map(next.dormantChildren.map(b=>[b.child.entityId,b]));
    for(const b of originalBindings)if(!live.has(b.entityId)&&!retiredIds.has(b.entityId)&&!detached.has(b.entityId)&&!dormant.has(b.entityId))
      dormant.set(b.entityId,{child:b,disabledAtRevisionId:revision});
    next.dormantChildren=[...dormant.values()].filter(b=>!live.has(b.child.entityId));
    next.children=result.children;
    const parents=[...(workspace.foundationAssemblies??[]).filter(a=>a.id!==assemblyId),next];
    const originallyAdopted=new Set(next.adoption?.entityIds??[]);
    const updated=[...independent,...result.members.map(e=>originallyAdopted.has(e.id)&&byId.has(e.id)?{...e,source:byId.get(e.id)!.source}:e)];
    const after=measureFoundation(workspaceId,updated).rows;
    for(const row of before){
      if(command.kind==='detach'&&row.status==='unquantified'){
        if(!after.some(r=>r.elementId===row.elementId&&r.code===row.code&&r.unit===row.unit&&r.status==='unquantified'))
          throw Error('Detachment would change unresolved measurement eligibility.');
      }
      if(row.status!=='measured'||ownedIds.has(row.elementId)&&command.kind!=='detach')continue;
      const retained=after.find(r=>r.elementId===row.elementId&&r.code===row.code&&r.unit===row.unit);
      if(retained?.status!=='measured'||Math.abs(retained.quantity-row.quantity)>1e-8*Math.max(1,Math.abs(row.quantity)))
        throw Error('Apply would change an independent measured contribution: '+row.elementId);
    }
    if(command.kind==='detach'&&after.length!==before.length)throw Error('Detachment would alter the quantity ledger.');
    const unresolved=result.gaps;
    for(const row of after)if(row.status==='unquantified'&&live.has(row.elementId)){
      const binding=next.children.find(b=>b.entityId===row.elementId)!;
      const system=binding.role.system==='wall'?'walls':binding.role.system==='exterior'?'exteriorLayers':binding.role.system;
      unresolved.push({system,role:binding.role,path:row.code,reason:row.reason,blocks:['quantity']});
    }
    replaceFoundationAssemblyState(document,workspaceId,updated,parents);
    preview.changes={parents,measurements:updated,
      retained:result.children.filter(b=>ownedIds.has(b.entityId)),retired:originalBindings.filter(b=>!nextIds.has(b.entityId)&&!detached.has(b.entityId)),
      detached:originalBindings.filter(b=>detached.has(b.entityId)),
      created:result.children.filter(b=>!ownedIds.has(b.entityId))};
    preview.quantities.after=after;
    preview.unresolvedSpecifications=unresolved;
    validatedPreviews.set(preview,JSON.stringify(preview.changes));
  }catch(error){
    preview.conflicts.push({code:'assembly-conflict',message:error instanceof Error?error.message:String(error),entityIds:[]});
  }
  return preview;
}

export function applyAssemblyPreview(document:ProjectDocument,preview:AssemblyPreview):ProjectDocument{
  const active=document.workspaces.find(w=>w.id===document.activeWorkspaceId);
  const revision=active?.foundationAssemblies?.find(a=>a.id===preview.assemblyId)?.revisionId??null;
  if(preview.source!==document||active?.id!==preview.workspaceId||revision!==preview.baseRevisionId)throw Error('Stale assembly preview');
  if(preview.conflicts.length)throw Error(preview.conflicts[0].message);
  if(preview.changes&&validatedPreviews.get(preview)!==JSON.stringify(preview.changes))throw Error('Assembly preview changed. Preview the approved changes again.');
  return preview.changes?replaceFoundationAssemblyState(document,preview.workspaceId,preview.changes.measurements,preview.changes.parents):document;
}
