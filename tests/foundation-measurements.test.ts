import test from 'node:test';
import assert from 'node:assert/strict';
import {rectangleBounds,orthogonalStrip,reconcileRectangularPrisms,type Prism} from '../src/engine/measurements/foundationGeometry';
const p=(id:string,xmin:number,xmax:number,ymin:number,ymax:number,bottomFt:number|null=0,heightFt:number|null=1):Prism=>({id,bounds:{xmin,xmax,ymin,ymax},bottomFt,heightFt});
const sum=(a:Prism[])=>reconcileRectangularPrisms(a).reduce((n,r)=>{assert.notEqual(r.volumeCF,null);return n+r.volumeCF!},0);
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);
test('isolated wall and strip analytical volumes',()=>{near(sum([p('w',0,40,0,8/12, null,8)])/27, 2560/324);near(sum([p('s',0,40,0,2)])/27,80/27)});
test('pad slab granular excavation and backfill fixtures',()=>{near(sum([p('pad',0,4,0,4)])/27,16/27);near(sum([p('slab',0,40,0,30,0,4/12)])/27,1200/81);near(sum([p('granular',0,40,0,30,0,.5)])/27,600/27);near(sum([p('excavation',0,40,0,30,-8,8)])/27,9600/27);near(sum([p('fill',0,20,0,10,0,6)])/27,1200/27)});
test('L junction counts shared footprint once',()=>near(sum([p('a',0,10,0,1,0,8),p('b',9,10,0,10,0,8)])/27,152/27));
test('crossing footings count intersection once',()=>near(sum([p('a',0,20,9,11),p('b',9,11,0,20)])/27,76/27));
test('T junction variable widths and order-independent attribution',()=>{const a=[p('a',0,20,0,2),p('b',9,10,1,10)];near(sum(a),48);assert.deepEqual(reconcileRectangularPrisms(a),reconcileRectangularPrisms(a.reverse()))});
test('explicit rectangular ring includes all corners',()=>{const t=8/12;const a=[p('north',0,40,0,t,0,8),p('south',0,40,30-t,30,0,8),p('west',0,t,0,30,0,8),p('east',40-t,40,0,30,0,8)];near(sum(a),(1200-(40-2*t)*(30-2*t))*8)});
test('vertical overlap and disjoint elevations',()=>{near(sum([p('a',0,4,0,4,0,2),p('b',0,4,0,4,1,2)]),48);near(sum([p('a',0,4,0,4,-1,1),p('b',0,4,0,4,0,1)]),32)});
test('ambiguous overlap leaves entire connected component pending, isolated known retained',()=>{const a=reconcileRectangularPrisms([p('a',0,4,0,4,null),p('b',2,6,0,4),p('c',20,24,0,4)]);assert.equal(a[0].volumeCF,null);assert.equal(a[1].volumeCF,null);assert.equal(a[2].volumeCF,16)});
test('missing depth is not zero; isolated missing elevation allowed',()=>{assert.equal(reconcileRectangularPrisms([p('a',0,4,0,4,0,null)])[0].volumeCF,null);near(sum([p('a',0,4,0,4,null,1)]),16)});
test('duplicate physical solids and invalid dimensions rejected',()=>{assert.throws(()=>sum([p('a',0,4,0,4),p('b',0,4,0,4)]),/Duplicate physical/);assert.throws(()=>sum([p('a',0,0,0,4)]),/degenerate/);assert.throws(()=>sum([p('a',0,4,0,4,0,0)]),/Invalid prism/)});
test('adjacent footprints with missing elevations remain measurable',()=>near(sum([p('a',0,4,0,4,null),p('b',4,8,0,4,null)]),32));
test('rectangle boundary order and reversed winding',()=>{const q=[{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}];assert.deepEqual(rectangleBounds(q),rectangleBounds([...q].reverse()));assert.throws(()=>rectangleBounds([q[0],q[2],q[1],q[3]]),/boundary order/)});
test('orthogonal strips preserve exact width and endpoint extent',()=>{assert.deepEqual(orthogonalStrip({x:10,y:2},{x:0,y:2},2),{xmin:0,xmax:10,ymin:1,ymax:3});assert.throws(()=>orthogonalStrip({x:0,y:0},{x:1,y:1},2),/orthogonal/)});

import {foundationRectangle,faceToCentreline,extendedStrip} from '../src/engine/measurements/foundationGeometry';
import {measureFoundation} from '../src/engine/measurements/foundationMeasurements';
import {validateSpecialistEntities,type FoundationEntity} from '../src/engine/measurements/measurementTypes';
test('same physical rectangle from all three reference conventions',()=>{
 const t=8/12,outer={xmin:0,xmax:40,ymin:0,ymax:30};
 const rects=[foundationRectangle(outer,t,'exterior'),foundationRectangle({xmin:t/2,xmax:40-t/2,ymin:t/2,ymax:30-t/2},t,'centreline'),foundationRectangle({xmin:t,xmax:40-t,ymin:t,ymax:30-t},t,'interior')];
 for(const rect of rects){const solids=rect.segments.map((s,i)=>({id:String(i),bounds:extendedStrip(s.start,s.end,t,s.joinStartFt,s.joinEndFt),bottomFt:0,heightFt:8}));near(sum(solids),(1200-(40-2*t)*(30-2*t))*8)}
});
test('face reference orientation and invalid collapsed rectangle',()=>{assert.deepEqual(faceToCentreline({x:0,y:0},{x:10,y:0},2,'left'),{start:{x:0,y:1},end:{x:10,y:1}});assert.throws(()=>foundationRectangle({xmin:0,xmax:1,ymin:0,ymax:1},1,'exterior'),/degenerate/)});
const wall=(id:string,start={x:0,y:0},end={x:40,y:0}):FoundationEntity=>({id,physicalId:id,assemblyId:'walls',source:{reference:'fixture'},kind:'foundationWall',start,end,widthFt:8/12,heightFt:8,elevationFt:0,foundation:{version:1,material:'poured concrete',centrelineConfirmed:true,baseElevationConfirmed:true}});
test('foundation contributions retain source identity and canonical CY',()=>{const e=wall('wall');const r=measureFoundation('f',[e]).rows[0];assert.equal(r.elementId,'wall');assert.equal(r.unit,'CY');assert.equal(r.status,'measured');if(r.status==='measured')near(r.quantity,2560/324)});
test('legacy unconfirmed foundation remains pending',()=>{const e=wall('old');delete e.foundation;assert.equal(measureFoundation('f',[e]).rows[0].status,'unquantified')});
test('unknown width cannot certify overlapping same-purpose contribution',()=>{const a=wall('a'),b=wall('b');if(b.kind==='foundationWall')b.widthFt=null;assert.ok(measureFoundation('f',[a,b]).rows.every(r=>r.status==='unquantified'))});
test('cross-assembly overlapping concrete cannot silently double count',()=>{const a=wall('a'),b={...wall('b'),assemblyId:'other'};assert.ok(measureFoundation('f',[a,b]).rows.every(r=>r.status==='unquantified'))});
test('explicit metadata validation rejects negative junction extension',()=>{const e=wall('a');e.foundation!.joinStartFt=-1;assert.throws(()=>validateSpecialistEntities('foundation',[e]),/junction extension/)});
test('confirmed compatible duplicate solid is rejected',()=>assert.throws(()=>measureFoundation('f',[wall('a'),wall('b')]),/Duplicate physical solid/));

import {orthogonalPolygonPieces} from '../src/engine/measurements/foundationGeometry';
const region=(id:string,polygon:{x:number;y:number}[]):FoundationEntity=>({id,physicalId:id,assemblyId:'slabs',source:{reference:'fixture'},kind:'slab',polygon,depthFt:4/12,purpose:'concrete',elevationFt:0,foundation:{version:1,material:'poured concrete',baseElevationConfirmed:true}});
const lshape=[{x:0,y:0},{x:10,y:0},{x:10,y:4},{x:4,y:4},{x:4,y:10},{x:0,y:10}];
const qty=(e:FoundationEntity[])=>measureFoundation('f',e).rows;
test('concave orthogonal slab uses actual 64 SF footprint, not 100 SF envelope',()=>{const r=qty([region('l',lshape)])[0];assert.equal(r.status,'measured');if(r.status==='measured')near(r.quantity,64/81)});
test('orthogonal decomposition conserves area and winding',()=>{for(const poly of [lshape,[...lshape].reverse()])near(orthogonalPolygonPieces(poly).reduce((a,b)=>a+(b.xmax-b.xmin)*(b.ymax-b.ymin),0),64)});
test('isolated triangular slab uses true polygon area',()=>{const r=qty([region('t',[{x:0,y:0},{x:10,y:0},{x:0,y:6}])])[0];assert.equal(r.status,'measured');if(r.status==='measured')near(r.quantity,30/81)});
test('slab in concave notch is independent despite envelope overlap',()=>{const r=qty([region('l',lshape),region('n',[{x:5,y:5},{x:9,y:5},{x:9,y:9},{x:5,y:9}])]);assert.ok(r.every(x=>x.status==='measured'));near(r.reduce((n,x)=>n+(x.status==='measured'?x.quantity:0),0),80/81)});
test('overlapping irregular slabs remain pending instead of approximated',()=>{const r=qty([region('l',lshape),region('o',[{x:2,y:2},{x:6,y:2},{x:6,y:6},{x:2,y:6}])]);assert.ok(r.every(x=>x.status==='unquantified'))});
test('invalid polygon rejected by foundation measurement boundary',()=>assert.throws(()=>qty([region('bad',[{x:0,y:0},{x:10,y:10},{x:0,y:10},{x:8,y:0}])]),/Invalid foundation polygon/));
test('duplicate concave footprint rejected regardless of winding',()=>assert.throws(()=>qty([region('l',lshape),region('dup',[...lshape].reverse())]),/Duplicate physical solid/));

test('isolated wall opening reduces net concrete and exposes nonadditive breakdown',()=>{const e=wall('w');e.foundation!.wallOpenings=[{id:'o',offsetFt:5,widthFt:4,sillFt:2,heightFt:3}];const m=measureFoundation('f',[e]);near(m.detailBreakdown[0].netCY!,7.604938271604938);near(m.detailBreakdown[0].deductionCY!,8/27);assert.equal(m.rows.length,1)});
test('wall opening outside or at endpoint rejected',()=>{const e=wall('w');e.foundation!.wallOpenings=[{id:'o',offsetFt:0,widthFt:4,sillFt:2,heightFt:3}];assert.throws(()=>qty([e]),/junction\/end/);e.foundation!.wallOpenings[0].offsetFt=39;assert.throws(()=>qty([e]),/outside parent/)});
test('overlapping wall openings rejected',()=>{const e=wall('w');e.foundation!.wallOpenings=[{id:'a',offsetFt:5,widthFt:4,sillFt:2,heightFt:3},{id:'b',offsetFt:6,widthFt:2,sillFt:3,heightFt:2}];assert.throws(()=>qty([e]),/Overlapping wall/)});
const box=(x:number,y:number,w:number,h:number)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
test('slab opening deducts 60 SF and thickening adds only incremental depth',()=>{const e=region('s',box(0,0,40,30));e.foundation!.slabOpenings=[{id:'o',polygon:box(1,1,6,10)}];e.foundation!.slabThickenings=[{id:'t',polygon:box(20,10,10,10),depthFt:18/12,basis:'total'}];const d=measureFoundation('f',[e]).detailBreakdown[0];near(d.grossCY!,1200/81);near(d.deductionCY!,60/81);near(d.additionalCY!,100*14/12/27);near(d.netCY!,1140/81+100*14/12/27)});
test('additional thickness and total depth are equivalent',()=>{const e=region('s',box(0,0,40,30));e.foundation!.slabThickenings=[{id:'t',polygon:box(20,10,10,10),depthFt:14/12,basis:'additional'}];near(measureFoundation('f',[e]).detailBreakdown[0].additionalCY!,100*14/12/27)});
test('slab opening outside concave parent rejected',()=>{const e=region('s',lshape);e.foundation!.slabOpenings=[{id:'o',polygon:box(5,5,2,2)}];assert.throws(()=>qty([e]),/outside parent/)});
test('slab opening and thickening cannot overlap',()=>{const e=region('s',box(0,0,40,30));e.foundation!.slabOpenings=[{id:'o',polygon:box(2,2,6,10)}];e.foundation!.slabThickenings=[{id:'t',polygon:box(3,3,2,2),depthFt:1,basis:'total'}];assert.throws(()=>qty([e]),/Overlapping slab details/)});
test('wall opening in overlapping assembly with unresolved junction withheld',()=>{const e=wall('w');e.foundation!.wallOpenings=[{id:'o',offsetFt:5,widthFt:4,sillFt:2,heightFt:3}];assert.ok(qty([e,wall('cross',{x:7,y:-5},{x:7,y:5})]).every(r=>r.status==='unquantified'))});
test('total thickening less than base slab rejected',()=>{const e=region('s',box(0,0,40,30));e.foundation!.slabThickenings=[{id:'t',polygon:box(2,2,3,3),depthFt:.2,basis:'total'}];assert.throws(()=>qty([e]),/exceed base slab/)});
test('thickening possible vertical conflict conservatively pending',()=>{const e=region('s',box(0,0,40,30)),q=region('q',box(2,2,3,3));e.foundation!.slabThickenings=[{id:'t',polygon:box(2,2,3,3),depthFt:1,basis:'total'}];if('elevationFt' in q)q.elevationFt=-1;assert.ok(qty([e,q]).every(r=>r.status==='unquantified'))});

const feature=(id:string,purpose:'drainage'|'waterproofing'|'insulation'):FoundationEntity=>({id,physicalId:id,assemblyId:'envelope',source:{reference:'fixture'},kind:'foundationLine',purpose,start:{x:0,y:0},end:{x:40,y:0},heightFt:8,foundation:{version:1,material:purpose,coverage:{layerId:'layer',confirmed:true,...(purpose==='drainage'?{}:{openingTreatment:'none' as const})}}});
test('explicit trench excavation reconciles crossing area with uniform depth',()=>{const trench:FoundationEntity={id:'t',physicalId:'t',assemblyId:'exc',source:{reference:'fixture'},kind:'foundationTrench',start:{x:0,y:0},end:{x:40,y:0},widthFt:2,heightFt:3,elevationFt:-3,foundation:{version:1,material:'soil',centrelineConfirmed:true,baseElevationConfirmed:true}};const r=qty([trench])[0];assert.equal(r.code,'foundation.excavation.volume');assert.equal(r.status,'measured');if(r.status==='measured')near(r.quantity,240/27);const other={...trench,id:'u',physicalId:'u',start:{x:20,y:-5},end:{x:20,y:5}};near(qty([trench,other]).reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0),288/27)});
test('explicit waterproofing and drainage benchmarks',()=>{const r=qty([feature('w','waterproofing'),feature('d','drainage')]);assert.equal(r[0].status,'measured');assert.equal(r[1].status,'measured');if(r[0].status==='measured')near(r[0].quantity,320);if(r[1].status==='measured')near(r[1].quantity,40)});
test('vertical insulation coverage and foam board feet',()=>{const e=feature('i','insulation');if(e.kind==='foundationLine')e.heightFt=6;e.foundation!.coverage!.foam=true;e.foundation!.coverage!.thicknessFt=.25;const r=qty([e]);assert.ok(r.every(x=>x.status==='measured'));if(r[0].status==='measured'&&r[1].status==='measured'){near(r[0].quantity,240);near(r[1].quantity,720)}});
test('horizontal insulation actual area and board feet',()=>{const e:FoundationEntity={id:'i',physicalId:'i',assemblyId:'ins',source:{reference:'fixture'},kind:'foundationRegion',polygon:box(0,0,40,25),depthFt:.25,elevationFt:0,purpose:'insulation',foundation:{version:1,material:'foam',coverage:{layerId:'under slab',confirmed:true,foam:true}}};const r=qty([e]);assert.ok(r.every(x=>x.status==='measured'));if(r[0].status==='measured'&&r[1].status==='measured'){near(r[0].quantity,1000);near(r[1].quantity,3000)}});
test('duplicate drainage even reversed cannot double count',()=>{const a=feature('a','drainage'),b=feature('b','drainage');if(b.kind==='foundationLine'){[b.start,b.end]=[b.end,b.start]}assert.ok(qty([a,b]).every(x=>x.status==='unquantified'))});
test('waterproofing missing coverage height or opening treatment pending',()=>{const e=feature('w','waterproofing');delete e.foundation!.coverage!.openingTreatment;assert.equal(qty([e])[0].status,'unquantified')});
test('historical route remains pending without explicit ownership',()=>{const e=feature('d','drainage');delete e.foundation;assert.equal(qty([e])[0].status,'unquantified')});
test('distinct explicit material layers may share same coverage',()=>{const a=feature('a','waterproofing'),b=feature('b','waterproofing');b.foundation!.material='protection membrane';b.foundation!.coverage!.layerId='second layer';assert.ok(qty([a,b]).every(x=>x.status==='measured'));b.foundation!.coverage!.layerId='layer';assert.ok(qty([a,b]).every(x=>x.status==='unquantified'))});

import {createFoundationDraft} from '../src/engine/measurements/foundationDrafting';
test('foundation draft geometry starts without assumed dimensions or material',()=>{const w=createFoundationDraft('foundation_wall',{x:0,y:0},{x:40,y:0},'draft');assert.equal(w.kind,'foundationWall');assert.equal(w.foundation,undefined);assert.equal(qty([w])[0].status,'unquantified');const s=createFoundationDraft('foundation_slab',{x:0,y:0},{x:40,y:30},'slab');assert.equal(s.kind,'slab');assert.equal(qty([s])[0].status,'unquantified')});

import {foundationFootprint} from '../src/engine/measurements/foundationDrafting';
test('confirmed wall footprint uses actual width and explicit junction extensions',()=>{const e=wall('f');e.foundation!.joinStartFt=1;e.foundation!.joinEndFt=2;const p=foundationFootprint(e)!;assert.equal(p.length,4);near(Math.min(...p.map(v=>v.x)),-1);near(Math.max(...p.map(v=>v.x)),42);near(Math.max(...p.map(v=>v.y))-Math.min(...p.map(v=>v.y)),8/12);delete e.foundation;assert.equal(foundationFootprint(e),null)});

import {generateFoundationPerimeter} from '../src/engine/measurements/foundationDrafting';
test('generated exterior perimeter reconciles corners as a single assembly',()=>{let i=0;const e=generateFoundationPerimeter({xmin:0,xmax:40,ymin:0,ymax:30},'exterior',8/12,8,0,()=>String(++i));assert.equal(e.length,4);assert.equal(new Set(e.map(q=>q.assemblyId)).size,1);near(qty(e).reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0),27.1275720164609)});
test('foundation polygon draft rejects self intersection before commit',()=>assert.throws(()=>createFoundationDraft('foundation_slab',{x:0,y:0},{x:10,y:10},'p',[{x:0,y:0},{x:10,y:10},{x:0,y:10},{x:8,y:0}]),/polygon|edge|cross/i));

import {deriveStripFootings,planFoundationDeletion,foundationAssemblyIds} from '../src/engine/measurements/foundationDerivation';
test('source-linked strip footing quantity and datum',()=>{const w=wall('source');let i=0;const f=deriveStripFootings([w],[w.id],2,1,()=> 'f'+(++i));assert.equal(f.length,1);assert.equal(f[0].kind,'stripFooting');const row=qty([w,...f]).find(r=>r.code==='foundation.footing.strip.concrete')!;assert.equal(row.status,'measured');if(row.status==='measured')near(row.quantity,80/27);if('elevationFt' in f[0])assert.equal(f[0].elevationFt,-1)});
test('derived strip stale source and orphan rejected',()=>{const w=wall('source');let i=0;const f=deriveStripFootings([w],[w.id],2,1,()=> 'f'+(++i));assert.throws(()=>qty(f),/Missing derived footing source/);const changed={...w,elevationFt:2};assert.throws(()=>qty([changed,...f]),/stale/);assert.throws(()=>deriveStripFootings([w,...f],[w.id],2,1,()=> 'again'),/Remove existing/);});
test('derived perimeter group deletion preserves independent source walls',()=>{let i=0;const walls=generateFoundationPerimeter({xmin:0,xmax:40,ymin:0,ymax:30},'exterior',8/12,8,0,()=> 'g'+(++i));const ids=foundationAssemblyIds(walls,walls[0].id);assert.equal(ids.length,4);const f=deriveStripFootings(walls,ids,2,1,()=> 'g'+(++i));const plan=planFoundationDeletion([...walls,...f],[walls[0].id]);assert.equal(plan.dependentCount,4);assert.equal(plan.remaining.length,3);assert.ok(plan.remaining.every(e=>e.kind==='foundationWall'));});

import {foundationWindowSelection} from '../src/engine/measurements/foundationSelection';
import {foundationDetailOutlines} from '../src/engine/measurements/foundationDrafting';
test('foundation window requires full physical footprint; crossing includes partial width',()=>{const w=wall('w');assert.deepEqual(foundationWindowSelection([w],{x:-1,y:-.1},{x:41,y:.1}),[]);assert.deepEqual(foundationWindowSelection([w],{x:41,y:.1},{x:-1,y:-.1}),['w']);assert.deepEqual(foundationWindowSelection([w],{x:-1,y:-1},{x:41,y:1}),['w'])});
test('wall opening plan overlay follows canonical source without altering wall footprint',()=>{const w=wall('w');w.foundation!.wallOpenings=[{id:'o',offsetFt:5,widthFt:4,sillFt:2,heightFt:3}];const p=foundationDetailOutlines(w)[0];assert.equal(p.kind,'opening');near(Math.min(...p.points.map(v=>v.x)),5);near(Math.max(...p.points.map(v=>v.x)),9);near(Math.max(...p.points.map(v=>v.y))-Math.min(...p.points.map(v=>v.y)),8/12);assert.equal(foundationFootprint(w)!.length,4)});

import {createReferencedWall} from '../src/engine/measurements/foundationDrafting';
test('explicit face reference preserves source length and offsets canonical centreline',()=>{for(const [mode,sign] of [['exterior-left',1],['interior-right',-1]] as const){const e=createReferencedWall({x:0,y:0},{x:40,y:0},mode,mode,8/12);if(e.kind!=='foundationWall')throw Error('Expected wall');near(e.start.y,sign/3);near(e.end.y,sign/3);near(e.end.x-e.start.x,40);assert.equal(e.foundation?.centrelineConfirmed,true);assert.equal(e.heightFt,null);const p=foundationFootprint(e)!;near(sign===1?Math.min(...p.map(v=>v.y)):Math.max(...p.map(v=>v.y)),0);}});
test('face reference rejects missing thickness and unsupported diagonal footprint',()=>{assert.throws(()=>createReferencedWall({x:0,y:0},{x:40,y:0},'w','exterior-left',null),/thickness/);assert.throws(()=>createReferencedWall({x:0,y:0},{x:40,y:10},'w','exterior-left',1));});

import {deriveFoundationEnvelope} from '../src/engine/measurements/foundationEnvelopeDerivation';
test('derived isolated wall waterproofing uses confirmed face and height',()=>{const w=wall('source');let i=0;const f=deriveFoundationEnvelope([w],[w.id],{purpose:'waterproofing',side:'left',heightFt:6,material:'membrane',layerId:'wp'},()=> 'env'+(++i));const row=qty([w,...f]).find(r=>r.code==='foundation.waterproofing.area')!;assert.equal(row.status,'measured');if(row.status==='measured')near(row.quantity,240);assert.throws(()=>qty(f),/Missing derived envelope source/);assert.equal(planFoundationDeletion([w,...f],[w.id]).remaining.length,0)});
test('derived wall coverage rejects openings and stale wall geometry',()=>{const w=wall('source');let i=0;const config={purpose:'waterproofing' as const,side:'right' as const,heightFt:6,material:'membrane',layerId:'wp'};const f=deriveFoundationEnvelope([w],[w.id],config,()=> 'env'+(++i));const changed={...w,widthFt:1};assert.throws(()=>qty([changed,...f]),/stale/);w.foundation!.wallOpenings=[{id:'o',offsetFt:5,widthFt:4,sillFt:2,heightFt:3}];assert.throws(()=>deriveFoundationEnvelope([w],[w.id],config,()=> 'other'),/openings/);});

import {derivePerimeterDrainage} from '../src/engine/measurements/foundationDrainageDerivation';
test('rectangular exterior drainage uses physical exterior offset and group lifecycle',()=>{let i=0;const id=()=> 'dr'+(++i),w=generateFoundationPerimeter({xmin:0,xmax:40,ymin:0,ymax:30},'exterior',8/12,8,0,id),ids=w.map(e=>e.id);const d=derivePerimeterDrainage(w,ids,2,'pipe','drain',id);const rows=qty([...w,...d]).filter(r=>r.code==='foundation.drainage.length');assert.equal(rows.length,4);assert.ok(rows.every(r=>r.status==='measured'));near(rows.reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0),156);assert.throws(()=>qty([...w,...d.slice(1)]),/Incomplete/);assert.throws(()=>derivePerimeterDrainage([...w,...d],ids,2,'pipe','drain',id),/Remove existing/);assert.equal(planFoundationDeletion([...w,...d],[w[0].id]).remaining.length,3);});
test('rectangular drainage rejects partial selection and stale source geometry',()=>{let i=0;const id=()=> 'dr'+(++i),w=generateFoundationPerimeter({xmin:0,xmax:40,ymin:0,ymax:30},'exterior',8/12,8,0,id),ids=w.map(e=>e.id);assert.throws(()=>derivePerimeterDrainage(w,ids.slice(1),2,'pipe','drain',id));const d=derivePerimeterDrainage(w,ids,2,'pipe','drain',id);const source=w[0];if(source.kind!=='foundationWall')throw Error('Expected generated foundation wall');assert.throws(()=>qty([{...source,widthFt:1},...w.slice(1),...d]));});
test('horizontal insulation and granular source derivations produce explicit quantities',()=>{const s=region('slab',[{x:0,y:0},{x:40,y:0},{x:40,y:30},{x:0,y:30}]);let i=0;const id=()=> 'lay'+(++i);const f=deriveFoundationEnvelope([s],[s.id],{purpose:'horizontalInsulation',material:'foam',layerId:'foam',depthFt:.25,foam:true},id);const g=deriveFoundationEnvelope([s],[s.id],{purpose:'granular',material:'stone',layerId:'stone',depthFt:.5},id);for(const [members,code,expected] of [[f,'foundation.insulation.area',1200],[f,'foundation.insulation.foam',3600],[g,'foundation.granular.volume',600/27]] as const){const row=qty([s,...members]).find(r=>r.code===code)!;assert.equal(row.status,'measured');if(row.status==='measured')near(row.quantity,expected)}});

import {deriveRectangularEnvelope} from '../src/engine/measurements/foundationEnvelopeDerivation';
test('rectangular exterior envelope reconciles actual outer corners and foam coverage',()=>{let i=0;const id=()=> 'envr'+(++i),w=generateFoundationPerimeter({xmin:0,xmax:40,ymin:0,ymax:30},'exterior',8/12,8,0,id),ids=w.map(e=>e.id);const f=deriveRectangularEnvelope(w,ids,{purpose:'verticalInsulation',heightFt:6,depthFt:.25,foam:true,material:'foam',layerId:'ins'},id);const rows=qty([...w,...f]);for(const [code,expected] of [['foundation.insulation.area',840],['foundation.insulation.foam',2520]] as const){const subset=rows.filter(r=>r.code===code);assert.equal(subset.length,4);assert.ok(subset.every(r=>r.status==='measured'));near(subset.reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0),expected)}assert.throws(()=>qty([...w,...f.slice(1)]),/Incomplete/);assert.equal(planFoundationDeletion([...w,...f],[w[0].id]).remaining.length,3)});
test('rectangular envelope rejects partial sources and unsupported wall openings',()=>{let i=0;const id=()=> 'envr'+(++i),w=generateFoundationPerimeter({xmin:0,xmax:40,ymin:0,ymax:30},'exterior',8/12,8,0,id),ids=w.map(e=>e.id),config={purpose:'waterproofing' as const,heightFt:6,material:'membrane',layerId:'wp'};assert.throws(()=>deriveRectangularEnvelope(w,ids.slice(1),config,id));w[0].foundation!.wallOpenings=[{id:'o',offsetFt:5,widthFt:4,sillFt:2,heightFt:3}];assert.throws(()=>deriveRectangularEnvelope(w,ids,config,id),/openings/)});

import {orthogonalWallPerimeter,offsetOrthogonalPerimeter} from '../src/engine/measurements/foundationPerimeterGeometry';
import {generateOrthogonalFoundationPerimeter} from '../src/engine/measurements/foundationDrafting';
const irregularFixtures=[
 {name:'L',points:[{x:0,y:0},{x:40,y:0},{x:40,y:15},{x:24,y:15},{x:24,y:30},{x:0,y:30}],perimeter:140,area:960},
 {name:'T',points:[{x:0,y:0},{x:40,y:0},{x:40,y:12},{x:28,y:12},{x:28,y:30},{x:12,y:30},{x:12,y:12},{x:0,y:12}],perimeter:140,area:768},
 {name:'U',points:[{x:0,y:0},{x:40,y:0},{x:40,y:30},{x:28,y:30},{x:28,y:12},{x:12,y:12},{x:12,y:30},{x:0,y:30}],perimeter:176,area:912}
];
for(const f of irregularFixtures)test('orthogonal '+f.name+' perimeter exact ring, all references and winding',()=>{
 const width=1,expected=f.perimeter*width-4*width*width;
 for(const points of [f.points,[...f.points].reverse()]){
 const p=orthogonalWallPerimeter(points,width,'exterior');near(p.areaSF,expected);
 for(const [ref,vertices] of [['exterior',points],['centreline',p.centre],['interior',p.interior]] as const){
 let i=0;const e=generateOrthogonalFoundationPerimeter(vertices,ref,width,8,0,()=> 'ir'+(++i)),rows=qty(e);
 assert.equal(e.length,points.length);assert.ok(rows.every(r=>r.status==='measured'));near(rows.reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0),expected*8/27);
 }
 }
});
test('orthogonal perimeter refuses collapsed recess and nonorthogonal geometry',()=>{
 const u=irregularFixtures[2].points;assert.throws(()=>offsetOrthogonalPerimeter(u,9));
 assert.throws(()=>orthogonalWallPerimeter([{x:0,y:0},{x:10,y:0},{x:8,y:10},{x:0,y:10}],1,'exterior'));
});

import {assignFoundationAssembly,foundationBaseElevation} from '../src/engine/measurements/foundationAssembly';
test('manual L junction assignment reconciles physical overlap and preserves identity',()=>{
 const a=wall('manual-a',{x:0,y:0},{x:10,y:0}),b=wall('manual-b',{x:0,y:0},{x:0,y:10});
 if(a.kind!=='foundationWall'||b.kind!=='foundationWall')throw Error('Expected walls');a.assemblyId='a';b.assemblyId='b';a.widthFt=1;b.widthFt=1;
 a.foundation!.joinStartFt=.5;b.foundation!.joinStartFt=.5;
 assert.ok(qty([a,b]).every(r=>r.status==='unquantified'));
 const next=assignFoundationAssembly([a,b],[a.id,b.id],'joined');
 assert.deepEqual(next.map(e=>e.physicalId),[a.physicalId,b.physicalId]);
 assert.ok(qty(next).every(r=>r.status==='measured'));
 near(qty(next).reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0),20*8/27);
 assert.equal(a.assemblyId,'a');
});
test('confirmed duplicate solid rejected even across separate assemblies',()=>{
 const a=wall('duplicate-a'),b=wall('duplicate-b');a.assemblyId='a';b.assemblyId='b';
 assert.throws(()=>qty([a,b]),/Duplicate physical solid/);
});
test('top datum conversion preserves negative and zero bases and refuses unknown thickness',()=>{
 assert.equal(foundationBaseElevation(0,'top',8),-8);
 assert.equal(foundationBaseElevation(8,'top',8),0);
 assert.equal(foundationBaseElevation(0,'base',null),0);
 assert.equal(foundationBaseElevation(null,'top',null),null);
 assert.throws(()=>foundationBaseElevation(0,'top',null),/positive height/);
});
test('assembly reassignment refuses partial source assemblies and derived dependencies',()=>{
 const a=wall('a'),b=wall('b',{x:0,y:0},{x:0,y:10}),c=wall('c',{x:80,y:0},{x:90,y:0});c.assemblyId='c';
 assert.throws(()=>assignFoundationAssembly([a,b,c],[a.id,c.id],'new'),/complete existing assemblies/);
 let i=0;const f=deriveStripFootings([a,b],[a.id],2,1,()=> 'dep'+(++i));
 assert.throws(()=>assignFoundationAssembly([a,b,...f],[a.id,b.id],'new'),/dependent derived/);
});
