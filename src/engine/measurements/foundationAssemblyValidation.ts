import { foundationMaterialCatalogue } from './foundationMaterialCatalogue';
import { regenerateFoundationAssembly } from './foundationAssemblyRegeneration';
import type { FoundationAssemblyRecord, FoundationPreset } from './foundationAssemblyModel';
import type { FoundationEntity, Point } from './measurementTypes';
import { offsetOrthogonalPerimeter } from './foundationPerimeterGeometry';
import { simplePolygon } from './roofMeasurements';

type RecordValue = Record<string, unknown>;
type Rule = (value: unknown, path: string) => void;
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
function requireValid(ok: unknown, path: string): asserts ok {
  if (!ok) throw new Error('Invalid foundation assembly: ' + path);
}
const record = (v: unknown): v is RecordValue => !!v && typeof v === 'object' && !Array.isArray(v);
const text: Rule = (v, p) => requireValid(typeof v === 'string' && v.trim().length > 0, p);
const finite: Rule = (v, p) => requireValid(typeof v === 'number' && Number.isFinite(v), p);
const positive: Rule = (v,p) => requireValid(typeof v === 'number' && Number.isFinite(v) && v > 0,p);
const nonnegative: Rule = (v,p) => requireValid(typeof v === 'number' && Number.isFinite(v) && v >= 0,p);
const integer: Rule = (v,p) => requireValid(Number.isSafeInteger(v) && Number(v)>0,p);
const choice = (...values: unknown[]): Rule => (v,p) => requireValid(values.includes(v),p);
const array = (rule: Rule, max = Infinity): Rule => (v,p) => {
  requireValid(Array.isArray(v) && v.length<=max,p);
  v.forEach((x,i)=>rule(x,p+'['+i+']'));
};
const object = (required: Record<string,Rule>, optional: Record<string,Rule> = {}): Rule => (v,p) => {
  requireValid(record(v),p);
  for (const [key,rule] of Object.entries(required)) {
    requireValid(own(v,key),p+'.'+key);
    rule(v[key],p+'.'+key);
  }
  for (const [key,value] of Object.entries(v)) {
    if (own(required,key)) continue;
    requireValid(own(optional,key),p+'.'+key);
    optional[key](value,p+'.'+key);
  }
};
const variants = (tag: string, choices: Record<string,Rule>): Rule => (v,p) => {
  requireValid(record(v) && typeof v[tag]==='string' && own(choices,v[tag]),p+'.'+tag);
  choices[v[tag]](v,p);
};

const sourceRules = Object.fromEntries(['plan','estimatingAssumption','manualOverride'].map(kind=>[kind,object({kind:choice(kind),reference:text})]));
const source = variants('kind',sourceRules);
const confirmation = variants('kind',{...sourceRules,presetSnapshot:object({kind:choice('presetSnapshot'),presetId:text,version:integer,reference:text})});
const confirmed = (rule: Rule) => object({value:rule,confirmation});
const scope = (fields: Record<string,Rule>): Rule => {
  const specification=object({},Object.fromEntries(Object.entries(fields).map(([key,rule])=>[key,confirmed(rule)])));
  return variants('status',{
    included:object({status:choice('included'),specification}),
    pending:object({status:choice('pending'),reason:text},{retainedSpecification:specification}),
    excluded:object({status:choice('excluded'),reason:text},{retainedSpecification:specification}),
  });
};

const material = (category: keyof typeof foundationMaterialCatalogue) => variants('kind',{
  catalogue:object({kind:choice('catalogue'),category:choice(category),id:choice(...foundationMaterialCatalogue[category].map((entry:readonly [string,string])=>entry[0]))}),
  ...(category==='concrete'?{}:{custom:object({kind:choice('custom'),category:choice(category),id:text,description:text})}),
});
const point=object({x:finite,y:finite});
const polygon: Rule=(v,p)=>{
  array(point)(v,p);
  requireValid(simplePolygon(v as Point[]),p);
};
const vertex=object({id:text,point});
const segment=object({id:text,startVertexId:text,endVertexId:text});
const routeFields={vertices:array(vertex),segments:array(segment)};
function checkOrderedPath(v: {vertices:{id:string;point:Point}[];segments:{id:string;startVertexId:string;endVertexId:string}[]},closed:boolean,p:string){
  requireValid(v.vertices.length>=(closed?3:2) && v.segments.length===v.vertices.length-(closed?0:1),p);
  unique(v.vertices.map(x=>x.id),p+'.vertices');
  unique(v.segments.map(x=>x.id),p+'.segments');
  for(const [i,s] of v.segments.entries()){
    const a=v.vertices[i], b=v.vertices[(i+1)%v.vertices.length];
    requireValid(s.startVertexId===a.id && s.endVertexId===b.id && Math.hypot(a.point.x-b.point.x,a.point.y-b.point.y)>1e-8,p+'.segments['+i+']');
  }
}
const trace: Rule=(v,p)=>{
  object({...routeFields,kind:choice('rectangle','orthogonal'),reference:choice('exterior','centreline','interior'),source})(v,p);
  const t=v as FoundationAssemblyRecord['trace'];
  checkOrderedPath(t,true,p);
  requireValid(t.kind!=='rectangle'||t.vertices.length===4,p+'.vertices');
  offsetOrthogonalPerimeter(t.vertices.map(x=>x.point),0);
};
const elevationReference=variants('kind',{
  assembly:object({kind:choice('assembly'),id:text}),
  project:object({kind:choice('project')}),
  unresolved:object({kind:choice('unresolved')}),
  historical:object({kind:choice('historical')}),
});
const datum=object({basis:choice('base','top'),elevationFt:finite},{reference:elevationReference});
const wallOpening=object({id:text,offsetFt:nonnegative,sillFt:nonnegative,widthFt:positive,heightFt:positive});
const slabOpening=object({id:text,polygon});
const thickening=object({id:text,polygon,depthFt:positive,basis:choice('total','additional')});
const wallCore={material:material('concrete'),widthFt:positive,heightFt:positive};
const wall={...wallCore,datum,openings:array(object({sourceSegmentId:text,opening:wallOpening}))};
const alignment=variants('kind',{centred:object({kind:choice('centred')}),explicitOffset:object({kind:choice('explicitOffset'),offsetFt:finite})});
const wallBase=object({kind:choice('wallBase')});
const top=variants('kind',{wallBase,explicit:object({kind:choice('explicit'),elevationFt:finite})});
const footingCore={material:material('concrete'),widthFt:positive,depthFt:positive,alignment};
const coverageCore={
  specifiedHeight:object({kind:choice('specifiedHeight'),heightFt:positive}),
  confirmedFullHeight:object({kind:choice('confirmedFullHeight')}),
};
const coverage=variants('kind',{...coverageCore,manualNetSegments:object({kind:choice('manualNetSegments'),segments:array(object({id:text,start:point,end:point,heightFt:positive}))})});
const productAttributes=object({},{productReference:confirmed(text)});
const exteriorMaterial:Rule=(v,p)=>{requireValid(record(v)&&(v.category==='waterproofing'||v.category==='insulation'),p);material(v.category)(v,p);};
const layerCore={id:text,material:exteriorMaterial,thicknessFt:positive,attributes:productAttributes};
const layer={...layerCore,coverage};
const routes={
  footingEdgeOffset:object({kind:choice('footingEdgeOffset'),offsetFt:nonnegative}),
  wallFaceOffset:object({kind:choice('wallFaceOffset'),offsetFt:nonnegative}),
};
const route=variants('kind',{...routes,manual:(v,p)=>{
  object({...routeFields,kind:choice('manual'),closed:choice(true,false)})(v,p);
  const r=v as import('./foundationAssemblyModel').ManualDrainageRoute;
  checkOrderedPath(r,r.closed,p);
  if(r.closed) polygon(r.vertices.map(x=>x.point),p+'.vertices');
}});
const pipe={material:material('drainage'),attributes:object({},{
  nominalDiameterFt:confirmed(positive),pipeMaterial:confirmed(text),perforation:confirmed(choice('perforated','solid')),
})};
const insulation=scope({id:text,material:material('insulation'),thicknessFt:positive,attributes:productAttributes});
const granular=scope({id:text,material:material('granular'),thicknessFt:positive,attributes:productAttributes});
const exteriorSequence=variants('status',{
  confirmed:object({status:choice('confirmed'),confirmation}),
  unresolved:object({status:choice('unresolved')}),
});
const systems=object({
  walls:scope(wall),footing:scope({...footingCore,top}),exteriorLayers:array(object({id:text,scope:scope(layer)})),
  drainage:scope({...pipe,route}),
  slab:scope({material:material('concrete'),extent:variants('kind',{
    confirmedInterior:object({kind:choice('confirmedInterior')}),
    independent:object({kind:choice('independent'),points:polygon}),
  }), thicknessFt:positive,baseFt:finite,footingRelation:confirmation,bottomRelationship:choice('atWallBase'),elevationReference,openings:array(slabOpening),thickenings:array(thickening)}),
  insulation,granular,
},{exteriorSequence});
const presetVersion=object({version:integer,name:text,systems:object({
  walls:scope(wallCore),footing:scope({...footingCore,top:wallBase}),
  exteriorLayers:array(object({id:text,scope:scope({...layerCore,coverage:variants('kind',coverageCore)})})),
  drainage:scope({...pipe,route:variants('kind',routes)}),insulation,granular,
},{exteriorSequence})});
const presetShape=object({version:choice(1),id:text,versions:array(presetVersion)},{origin:object({presetId:text,version:integer})});
const role=variants('system',{
  wall:object({system:choice('wall'),sourceId:text}),footing:object({system:choice('footing'),sourceId:text}),
  drainage:object({system:choice('drainage'),sourceId:text}),
  exterior:object({system:choice('exterior'),sourceId:text,layerId:text}),
  slab:object({system:choice('slab')}),insulation:object({system:choice('insulation'),layerId:text}),
  granular:object({system:choice('granular'),layerId:text}),
});
const binding=object({role,entityId:text,physicalId:text});
const retired=variants('kind',{
  child:object({kind:choice('child'),binding}),
  routeVertex:object({kind:choice('routeVertex'),id:text}),
  routeSegment:object({kind:choice('routeSegment'),id:text}),
});
const scopeDecision=variants('status',{
  legacyAbsent:object({status:choice('legacyAbsent')}),included:object({status:choice('included')}),
  excluded:object({status:choice('excluded'),reason:text}),pending:object({status:choice('pending'),reason:text}),
});
const scopeRecord=object({entityId:text,decision:scopeDecision,source:variants('kind',{
  ...sourceRules,historicalRecord:object({kind:choice('historicalRecord'),entityId:text}),
}),inheritedFromEntityIds:array(text,2048)});
const override=variants('system',{
  walls:object({system:choice('walls'),sourceSegmentId:text,patch:object({},{...wallCore,datum}),source}),
  exterior:object({system:choice('exterior'),layerId:text,coverage,source}),
  footing:object({system:choice('footing'),alignment,source}),
  drainage:object({system:choice('drainage'),route,source}),
});
const assembly=object({
  version:choice(1),id:text,revisionId:text,trace,specifications:systems,overrides:array(override),children:array(binding),
  dormantChildren:array(object({child:binding,disabledAtRevisionId:text}),256),
  replacements:array(object({retired,successorIds:array(text,2048),revisionId:text}),512),
  componentScope:array(scopeRecord),priorScopeDecisions:array(object({revisionId:text,previous:scopeRecord}),512),
},{
  preset:object({presetId:text,version:presetVersion,confirmation:source}),
  adoption:object({entityIds:array(text),source}),
  detachments:array(object({former:binding,revisionId:text,reason:text,source,disposition:choice('released','readopted')},{readoptedAtRevisionId:text}),256),
  traceCorrections:array(object({previousRevisionId:text,revisionId:text,previousTrace:trace,source,
    segments:array(object({retiredId:text,successorIds:array(text,64)}),64),
  }),64),
});
function unique(ids:string[],p:string){
  requireValid(new Set(ids).size===ids.length,p+' has duplicate IDs');
}
export function validateFoundationPresets(value:unknown): asserts value is FoundationPreset[]{
  array(presetShape)(value,'presets');
  const presets=value as FoundationPreset[];
  unique(presets.map(p=>p.id),'presets');
  for(const p of presets)requireValid(p.versions.length>0&&p.versions.every((v,i)=>!i||v.version>p.versions[i-1].version),'preset versions must increase');
}

export function foundationRoleKey(role: import('./foundationAssemblyModel').ChildRole):string{
  return JSON.stringify([role.system,'sourceId' in role?role.sourceId:null,'layerId' in role?role.layerId:null]);
}

export function foundationReleaseGroup(role:import('./foundationAssemblyModel').ChildRole):string{
  return JSON.stringify([role.system,role.system==='exterior'?role.layerId:null]);
}

export function validateFoundationAssemblies(value:unknown,entities:FoundationEntity[],presets:FoundationPreset[]): asserts value is FoundationAssemblyRecord[]{
  array(assembly)(value,'assemblies');
  const parents=value as FoundationAssemblyRecord[];
  const existing=new Map(entities.map(e=>[e.id,e]));
  const owningIds:string[]=[];
  const owningPhysicalIds:string[]=[];
  unique(parents.map(p=>p.id),'assemblies');
  for(const parent of parents){
    const active=parent.children;
    const dormant=parent.dormantChildren.map(x=>x.child);
    const historical=parent.replacements.flatMap(x=>x.retired.kind==='child'?[x.retired.binding]:[]);
    const ids=[...active,...dormant,...historical].map(b=>b.entityId);
    owningIds.push(...ids);
    owningPhysicalIds.push(...[...active,...dormant,...historical].map(b=>b.physicalId));
    unique([...active,...dormant].map(b=>foundationRoleKey(b.role)),'active or dormant role');
    const detachments=parent.detachments??[];
    const released=detachments.filter(a=>a.disposition==='released');
    unique(released.map(a=>foundationRoleKey(a.former.role)),'released role');
    for(const a of detachments)requireValid((a.disposition==='readopted')===(a.readoptedAtRevisionId!==undefined),'detachment disposition provenance');
    requireValid(![...active,...dormant].some(b=>released.some(a=>foundationReleaseGroup(a.former.role)===foundationReleaseGroup(b.role))),'released group is still owned');
    const childSet=new Set([...ids,...detachments.map(a=>a.former.entityId)]);
    const corrections=parent.traceCorrections??[];
    unique(corrections.map(c=>c.revisionId),'trace correction revision');
    const retiredTraceIds=new Set<string>();
    for(const [i,c] of corrections.entries()){
      const successor=corrections[i+1]?.previousTrace??parent.trace;
      const beforeIds=new Set(c.previousTrace.segments.map(s=>s.id));
      const afterIds=new Set(successor.segments.map(s=>s.id));
      const removed=[...beforeIds].filter(id=>!afterIds.has(id));
      unique(c.segments.map(s=>s.retiredId),'trace correction lineage');
      requireValid(c.previousRevisionId!==c.revisionId&&c.previousTrace.reference===successor.reference&&
        removed.length===c.segments.length&&c.segments.every(s=>removed.includes(s.retiredId)&&s.successorIds.length>0&&
          s.successorIds.every(id=>!beforeIds.has(id)&&afterIds.has(id)&&!retiredTraceIds.has(id))),
        'trace correction lineage references');
      for(const id of removed)retiredTraceIds.add(id);
      requireValid([...afterIds].every(id=>!retiredTraceIds.has(id)),'retired trace identity reused');
    }
    for(const child of active){
      const e=existing.get(child.entityId);
      requireValid(e?.physicalId===child.physicalId,'missing or mismatched owned measurement '+child.entityId);
      const role=child.role.system;
      requireValid(
        role==='wall'?e.kind==='foundationWall':
        role==='footing'?e.kind==='stripFooting':
        role==='drainage'?e.kind==='foundationLine'&&e.purpose==='drainage':
        role==='exterior'?e.kind==='foundationLine'&&(e.purpose==='waterproofing'||e.purpose==='insulation'):
        role==='slab'?e.kind==='slab':
        e.kind==='foundationRegion'&&e.purpose===role,
        'owned measurement kind does not match role '+child.entityId,
      );
    }
    for(const child of [...dormant,...historical])requireValid(!existing.has(child.entityId),'inactive identity is a live measurement');
    unique(parent.componentScope.map(s=>s.entityId),'component scope');
    const scopes=[...parent.componentScope,...parent.priorScopeDecisions.map(s=>s.previous)];
    requireValid(scopes.reduce((n,s)=>n+s.inheritedFromEntityIds.length,0)<=2048,'scope provenance reference limit');
    for(const s of scopes)requireValid(childSet.has(s.entityId)&&s.inheritedFromEntityIds.every(id=>childSet.has(id))&&(s.source.kind!=='historicalRecord'||childSet.has(s.source.entityId)),'orphaned component scope');
    const drainage=parent.specifications.drainage;
    const routeOverride=parent.overrides.find(o=>o.system==='drainage');
    const route=routeOverride?.route??(drainage.status==='included'?drainage.specification:drainage.retainedSpecification)?.route?.value;
    const identities=new Map<string,string>([...childSet].map(id=>[id,'child']));
    for(const [kind,items] of [['routeVertex',route?.kind==='manual'?route.vertices:[]],['routeSegment',route?.kind==='manual'?route.segments:[]]] as const)
      for(const {id} of items){requireValid(!identities.has(id),'duplicate route identity');identities.set(id,kind);}
    const graph=new Map<string,string[]>();
    requireValid(parent.replacements.reduce((n,r)=>n+r.successorIds.length,0)<=2048,'replacement successor limit');
    for(const r of parent.replacements){
      const id=r.retired.kind==='child'?r.retired.binding.entityId:r.retired.id;
      requireValid(!graph.has(id),'duplicate retired identity');
      if(r.retired.kind!=='child'){requireValid(!identities.has(id),'retired route identity reused');identities.set(id,r.retired.kind);}
      graph.set(id,r.successorIds);
    }
    for(const [id,successors] of graph){
      unique(successors,'replacement successors');
      requireValid(successors.every(next=>identities.get(next)===identities.get(id)),'dangling or incompatible replacement successor');
    }
    const visiting=new Set<string>(),seen=new Set<string>();
    function visit(id:string){
      requireValid(!visiting.has(id),'replacement cycle');
      if(seen.has(id))return;
      visiting.add(id);
      for(const next of graph.get(id)??[])visit(next);
      visiting.delete(id);seen.add(id);
    }
    for(const id of graph.keys())visit(id);
    const drainageSpec=drainage.status==='included'?drainage.specification:drainage.retainedSpecification;
    const pipe=drainageSpec?.material?.value;
    const attributes=drainageSpec?.attributes?.value;
    if(pipe?.kind==='catalogue'&&attributes?.perforation){
      const required=pipe.id.startsWith('perforated')?'perforated':'solid';
      requireValid(attributes.perforation.value===required,'pipe perforation conflicts with catalogue selection');
    }
    const independent=entities.filter(e=>!active.some(b=>b.entityId===e.id));
    const generated=regenerateFoundationAssembly(parent,independent);
    requireValid(generated.members.length===active.length,'owned measurement manifest does not match confirmed specifications');
    const adoptionIds=new Set(parent.adoption?.entityIds??[]);
    requireValid([...adoptionIds].every(id=>childSet.has(id)),'orphaned adopted component');
    for(const member of generated.members){
      const saved=existing.get(member.id);
      const expected=adoptionIds.has(member.id)&&saved?{...member,source:saved.source}:member;
      requireValid(JSON.stringify(stableValue(expected))===JSON.stringify(stableValue(saved)),'stale owned measurement '+member.id);
    }
    if(parent.preset){
      const snapshot=parent.preset;
      const local=presets.find(p=>p.id===snapshot.presetId)?.versions.find(v=>v.version===snapshot.version.version);
      if(local) requireValid(JSON.stringify(stableValue(local))===JSON.stringify(stableValue(snapshot.version)),'preset snapshot differs from local version');
    }
  }
  unique(owningIds,'measurement ownership');
  unique(owningPhysicalIds,'physical ownership');
}

export function stableValue(value:unknown):unknown{
  if(Array.isArray(value))return value.map(stableValue);
  if(!record(value))return value;
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])]));
}
