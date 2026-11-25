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
test('cross-assembly partially overlapping concrete cannot silently double count',()=>{const a=wall('a'),b={...wall('b',{x:20,y:0},{x:60,y:0}),assemblyId:'other'};const rows=measureFoundation('f',[a,b]).rows;assert.equal(rows.length,2);assert.ok(rows.every(r=>r.status==='unquantified'))});
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

test('isolated signed offset footing preserves volume and source datum in either direction',()=>{
 const w=wall('offset-wall');let i=0;
 for(const offset of [-.5,.5]){
 const f=deriveStripFootings([w],[w.id],2,1,()=> 'offset'+(++i),offset)[0];
 if(f.kind!=='stripFooting')throw Error('Expected footing');
 near(f.start.y,offset);near(f.end.y,offset);assert.equal(f.elevationFt,-1);
 const row=qty([w,f]).find(r=>r.code==='foundation.footing.strip.concrete')!;
 assert.equal(row.status,'measured');if(row.status==='measured')near(row.quantity,80/27);
 assert.throws(()=>qty([w,{...f,start:{...f.start,y:offset+.1}}]),/stale/);
 }
});
test('offset footing refuses joined walls and insufficient footprint',()=>{
 const w=wall('offset-wall');let i=0;const id=()=> 'offset'+(++i);
 assert.throws(()=>deriveStripFootings([w],[w.id],2,1,id,1),/contain the source wall/);
 const q=wall('connected',{x:40,y:0},{x:40,y:10});q.assemblyId='other';
 assert.throws(()=>deriveStripFootings([w,q],[w.id],2,1,id,.5),/isolated unjoined wall/);
 w.foundation!.joinStartFt=.5;assert.throws(()=>deriveStripFootings([w],[w.id],2,1,id,.5),/isolated unjoined wall/);
 assert.throws(()=>deriveStripFootings([w],[w.id],2,1,id,0),/Unsupported source junction extension/);
});

test('pad reference footprint separate from concrete and count ledger',()=>{
 const e:FoundationEntity={id:'pad',physicalId:'pad',assemblyId:'pad',source:{reference:'fixture'},kind:'padFooting',polygon:box(0,0,4,4),depthFt:1,purpose:'concrete',elevationFt:0,foundation:{version:1,material:'poured concrete',baseElevationConfirmed:true}};
 const m=measureFoundation('f',[e]);assert.equal(m.rows.length,2);assert.equal(m.footprintReferences.length,1);
 const a=m.footprintReferences[0];assert.equal(a.code,'foundation.footing.pad.area');assert.equal(a.role,'reference');near(a.netSF!,16);
 assert.ok(m.rows.every(r=>r.unit!=='SF'));
});
test('net slab reference excludes openings but not thickening and is independent of missing depth',()=>{
 const e=region('slab',box(0,0,40,30));if(e.kind!=='slab')throw Error('Expected slab');
 e.foundation!.slabOpenings=[{id:'o',polygon:box(2,2,6,10)}];e.foundation!.slabThickenings=[{id:'t',polygon:box(20,10,10,10),depthFt:1.5,basis:'total'}];
 const m=measureFoundation('f',[e]),a=m.footprintReferences[0];near(a.grossSF!,1200);near(a.exclusionSF!,60);near(a.netSF!,1140);assert.equal(m.rows.length,1);
 e.depthFt=null;const pending=measureFoundation('f',[e]);assert.equal(pending.rows[0].status,'unquantified');near(pending.footprintReferences[0].netSF!,1140);
});
test('concave slab reference uses actual polygon and unresolved overlaps withhold net area',()=>{
 const e=region('l',lshape);near(measureFoundation('f',[e]).footprintReferences[0].netSF!,64);
 const q=region('q',box(2,2,4,4));const result=measureFoundation('f',[e,q]);assert.ok(result.footprintReferences.every(r=>r.netSF===null&&r.reason));
});

test('manual variable-width stepped T junction reconciles actual shared vertical interval',()=>{
 const a=wall('horizontal',{x:0,y:0},{x:20,y:0}),b=wall('branch',{x:10,y:0},{x:10,y:10});
 if(a.kind!=='foundationWall'||b.kind!=='foundationWall')throw Error('Expected walls');
 a.assemblyId='a';b.assemblyId='b';a.widthFt=2;b.widthFt=1;
 a.heightFt=8;a.elevationFt=-8;b.heightFt=6;b.elevationFt=-4;
 const next=assignFoundationAssembly([a,b],[a.id,b.id],'stepped');
 const rows=qty(next);assert.equal(rows.length,2);assert.ok(rows.every(r=>r.status==='measured'));
 // 20*2*8 + 10*1*6 - 1*1*4 shared plan and vertical intersection.
 near(rows.reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0),376/27);
 assert.deepEqual(qty([...next].reverse()).sort((a,b)=>a.elementId.localeCompare(b.elementId)),[...rows].sort((a,b)=>a.elementId.localeCompare(b.elementId)));
});
test('manual variable-width crossing walls reconcile only common vertical interval',()=>{
 const a=wall('a',{x:0,y:0},{x:20,y:0}),b=wall('b',{x:10,y:-10},{x:10,y:10});
 if(a.kind!=='foundationWall'||b.kind!=='foundationWall')throw Error('Expected walls');
 a.assemblyId='a';b.assemblyId='b';a.widthFt=2;b.widthFt=1;a.heightFt=8;a.elevationFt=-8;b.heightFt=4;b.elevationFt=-2;
 const next=assignFoundationAssembly([a,b],[a.id,b.id],'cross');
 near(qty(next).reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0),(320+80-4)/27);
 b.elevationFt=null;assert.throws(()=>assignFoundationAssembly([a,b],[a.id,b.id],'unknown'),/Confirm compatible/);
});
test('multi-offset orthogonal perimeter retains exact ring and centred strip footing reconciliation',()=>{
 const points=[{x:0,y:0},{x:40,y:0},{x:40,y:10},{x:50,y:10},{x:50,y:30},{x:30,y:30},{x:30,y:40},{x:10,y:40},{x:10,y:30},{x:0,y:30}];
 let i=0;const id=()=> 'multi'+(++i),w=generateOrthogonalFoundationPerimeter(points,'exterior',1,8,0,id);
 // Exterior length 180; centreline length 176; 1ft wall and 2ft footing.
 const rows=qty(w);assert.ok(rows.every(r=>r.status==='measured'));near(rows.reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0),176*8/27);
 const f=deriveStripFootings(w,w.map(e=>e.id),2,1,id);
 const footing=qty([...w,...f]).filter(r=>r.code==='foundation.footing.strip.concrete');assert.equal(footing.length,10);assert.ok(footing.every(r=>r.status==='measured'));near(footing.reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0),352/27);
});

import {setFoundationApplicability} from '../src/engine/measurements/foundationApplicability';
test('excluded scope removes material contribution but preserves geometry and explicit reason',()=>{
 const a=wall('a'),b=wall('b',{x:80,y:0},{x:120,y:0});
 const next=setFoundationApplicability([a,b],[a.id],{status:'excluded',reason:'Existing wall retained'});
 const m=measureFoundation('f',next);assert.equal(next.length,2);assert.equal(m.rows.length,1);assert.equal(m.rows[0].elementId,b.id);
 assert.equal(m.scopeDiagnostics[0].status,'excluded');assert.equal(m.scopeDiagnostics[0].reason,'Existing wall retained');
 assert.equal(a.scopeApplicability,undefined);assert.equal(m.scopeDiagnostics[1].status,'legacy');
 assert.throws(()=>setFoundationApplicability(next,[a.id],{status:'excluded',reason:' '}),/reason/);
});
test('pending scope retains unquantified rows and blocks intersecting quantities',()=>{
 const a=wall('a'),b=wall('b',{x:20,y:0},{x:60,y:0});
 const next=setFoundationApplicability([a,b],[a.id],{status:'pending',reason:'Verify demolition'});
 const m=measureFoundation('f',next);assert.equal(m.rows.length,2);assert.ok(m.rows.every(r=>r.status==='unquantified'));
 assert.equal(m.scopeDiagnostics[0].status,'pending');
 const restored=setFoundationApplicability(next,[a.id],{status:'included'});assert.ok(qty(restored).every(r=>r.status==='measured'));
});
test('source-linked applicability refuses orphaned contributing derivations',()=>{
 const w=wall('w');let i=0;const f=deriveStripFootings([w],[w.id],2,1,()=> 'scope'+(++i));
 assert.throws(()=>setFoundationApplicability([w,...f],[w.id],{status:'excluded',reason:'Existing'}),/source-linked/);
 const next=setFoundationApplicability([w,...f],[w.id,...f.map(e=>e.id)],{status:'excluded',reason:'Existing'});
 assert.equal(measureFoundation('f',next).rows.length,0);
});

test('explicit under-slab insulation and granular stack uses distinct physical intervals',()=>{
 const s=region('slab-stack',box(0,0,40,30));let i=0;const id=()=> 'stack'+(++i);
 const f=deriveFoundationEnvelope([s],[s.id],{purpose:'horizontalInsulation',material:'foam',layerId:'foam',depthFt:.25,foam:true,offsetBelowSlabFt:0},id);
 const g=deriveFoundationEnvelope([s,...f],[s.id],{purpose:'granular',material:'stone',layerId:'stone',depthFt:.5,offsetBelowSlabFt:.25},id);
 assert.equal('elevationFt' in f[0]&&f[0].elevationFt,-.25);assert.equal('elevationFt' in g[0]&&g[0].elevationFt,-.75);
 const rows=qty([s,...f,...g]);for(const [code,value] of [['foundation.insulation.area',1200],['foundation.insulation.foam',3600],['foundation.granular.volume',600/27]] as const){const row=rows.find(r=>r.code===code)!;assert.equal(row.status,'measured');if(row.status==='measured')near(row.quantity,value)}
});
test('overlapping granular and insulation layers withhold both quantities even with distinct layer names',()=>{
 const s=region('slab-stack',box(0,0,40,30));let i=0;const id=()=> 'stack'+(++i);
 for(const offset of [undefined,0]){
 const f=deriveFoundationEnvelope([s],[s.id],{purpose:'horizontalInsulation',material:'foam',layerId:'foam',depthFt:.25,foam:true,offsetBelowSlabFt:offset},id);
 const g=deriveFoundationEnvelope([s],[s.id],{purpose:'granular',material:'stone',layerId:'stone',depthFt:.5,offsetBelowSlabFt:offset},id);
 const rows=qty([s,...f,...g]).filter(r=>r.elementId!==s.id);assert.equal(rows.length,3);assert.ok(rows.every(r=>r.status==='unquantified'));
 }
});
test('explicit below-slab placement requires confirmed datum and nonnegative offset',()=>{
 const s=region('slab-stack',box(0,0,40,30));let i=0;const id=()=> 'stack'+(++i),config={purpose:'granular' as const,material:'stone',layerId:'stone',depthFt:.5};
 assert.throws(()=>deriveFoundationEnvelope([s],[s.id],{...config,offsetBelowSlabFt:-1},id),/nonnegative/);
 delete s.foundation!.baseElevationConfirmed;assert.throws(()=>deriveFoundationEnvelope([s],[s.id],{...config,offsetBelowSlabFt:0},id),/Confirm slab base/);
});

import {manualFoundationCoverage} from '../src/engine/measurements/foundationManualCoverage';
test('manual vertical foam coverage explicitly measures SF and BF; missing thickness withholds BF only',()=>{
 const e=feature('manual-foam','insulation');const input={layer:'foam',confirmed:true,foam:true,thicknessFt:.25,openingTreatment:'none' as const};
 e.foundation!.coverage=manualFoundationCoverage(e,input);
 const rows=qty([e]);assert.equal(rows.length,2);assert.ok(rows.every(r=>r.status==='measured'));
 if(rows[0].status==='measured'&&rows[1].status==='measured'){near(rows[0].quantity,320);near(rows[1].quantity,960)}
 e.foundation!.coverage=manualFoundationCoverage(e,{...input,thicknessFt:null});assert.equal(qty([e])[0].status,'measured');assert.equal(qty([e])[1].status,'unquantified');
 assert.throws(()=>manualFoundationCoverage(e,{...input,thicknessFt:0}),/positive insulation thickness/);
});
test('manual coverage preserves legacy opening treatment and never implicitly confirms missing treatment',()=>{
 const e=feature('legacy-coverage','waterproofing');const input={layer:'wp',confirmed:true,foam:false,thicknessFt:null,openingTreatment:'alreadyDeducted' as const};
 e.foundation!.coverage=manualFoundationCoverage(e,input);assert.equal(e.foundation!.coverage!.openingTreatment,'alreadyDeducted');assert.equal(qty([e])[0].status,'unquantified');
 e.foundation!.coverage=manualFoundationCoverage(e,{...input,openingTreatment:''});assert.equal(e.foundation!.coverage!.openingTreatment,undefined);assert.equal(qty([e])[0].status,'unquantified');
 e.foundation!.coverage=manualFoundationCoverage(e,{...input,openingTreatment:'none'});assert.equal(qty([e])[0].status,'measured');
 assert.throws(()=>manualFoundationCoverage(e,{...input,layer:' '}),/layer identity/);
});
test('manual horizontal foam uses canonical region depth and does not invent opening metadata',()=>{
 const e:FoundationEntity={id:'manual-horizontal',physicalId:'manual-horizontal',assemblyId:'manual-horizontal',source:{reference:'fixture'},kind:'foundationRegion',polygon:box(0,0,40,30),purpose:'insulation',depthFt:.25,elevationFt:-.25,foundation:{version:1,material:'foam',baseElevationConfirmed:true}};
 e.foundation!.coverage=manualFoundationCoverage(e,{layer:'foam',confirmed:true,foam:true,thicknessFt:1,openingTreatment:'none'});
 assert.equal(e.foundation!.coverage!.openingTreatment,undefined);const rows=qty([e]);assert.ok(rows.every(r=>r.status==='measured'));if(rows[1].status==='measured')near(rows[1].quantity,3600);
});

import {orthogonalExteriorEdges} from '../src/engine/measurements/foundationExteriorRoute';
test('irregular L T U exterior envelope uses exact perimeter length and retains source mapping',()=>{
 const shapes=[
 [{x:0,y:0},{x:40,y:0},{x:40,y:20},{x:20,y:20},{x:20,y:40},{x:0,y:40}],
 [{x:0,y:0},{x:40,y:0},{x:40,y:10},{x:25,y:10},{x:25,y:40},{x:15,y:40},{x:15,y:10},{x:0,y:10}],
 [{x:0,y:0},{x:40,y:0},{x:40,y:40},{x:30,y:40},{x:30,y:10},{x:10,y:10},{x:10,y:40},{x:0,y:40}]
 ];
 let i=0;const id=()=> 'irrenv'+(++i);
 for(const original of shapes)for(const outline of [original,[...original].reverse()]){
 const walls=generateOrthogonalFoundationPerimeter(outline,'exterior',1,8,-8,id),ids=walls.map(e=>e.id);
 const perimeter=outline.reduce((n,a,j)=>n+Math.hypot(a.x-outline[(j+1)%outline.length].x,a.y-outline[(j+1)%outline.length].y),0);
 const edges=orthogonalExteriorEdges(walls,[...ids].reverse());assert.equal(edges.length,ids.length);
 const f=deriveRectangularEnvelope(walls,ids,{purpose:'verticalInsulation',material:'foam',layerId:'foam',heightFt:6,depthFt:.25,foam:true},id);
 const rows=qty([...walls,...f]);for(const [code,value] of [['foundation.insulation.area',perimeter*6],['foundation.insulation.foam',perimeter*18]] as const){const subset=rows.filter(r=>r.code===code);assert.equal(subset.length,ids.length);assert.ok(subset.every(r=>r.status==='measured'));near(subset.reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0),value)}
 assert.throws(()=>qty([...walls,...f.slice(1)]),/Incomplete/);
 assert.equal(planFoundationDeletion([...walls,...f],[walls[0].id]).remaining.length,walls.length-1);
 }
});
test('irregular envelope rejects partial loop and inconsistent confirmed elevations',()=>{
 let i=0;const id=()=> 'irrenv'+(++i),walls=generateOrthogonalFoundationPerimeter(lshape,'exterior',1,8,0,id),ids=walls.map(e=>e.id),config={purpose:'waterproofing' as const,material:'membrane',layerId:'wp',heightFt:6};
 assert.throws(()=>deriveRectangularEnvelope(walls,ids.slice(1),config,id));
 const changed=walls.map((e,i)=>i===0?{...e,elevationFt:-1}:e);assert.throws(()=>deriveRectangularEnvelope(changed,ids,config,id),/equal confirmed wall bases/);
});

test('irregular perimeter drainage follows exact exterior offset for L T U and multi-offset loops',()=>{
 const shapes=[
 [{x:0,y:0},{x:40,y:0},{x:40,y:20},{x:20,y:20},{x:20,y:40},{x:0,y:40}],
 [{x:0,y:0},{x:40,y:0},{x:40,y:10},{x:25,y:10},{x:25,y:40},{x:15,y:40},{x:15,y:10},{x:0,y:10}],
 [{x:0,y:0},{x:40,y:0},{x:40,y:40},{x:30,y:40},{x:30,y:10},{x:10,y:10},{x:10,y:40},{x:0,y:40}],
 [{x:0,y:0},{x:40,y:0},{x:40,y:10},{x:50,y:10},{x:50,y:30},{x:30,y:30},{x:30,y:40},{x:10,y:40},{x:10,y:30},{x:0,y:30}]
 ];
 let i=0;const id=()=> 'irrdr'+(++i);
 for(const original of shapes)for(const outline of [original,[...original].reverse()]){
  const walls=generateOrthogonalFoundationPerimeter(outline,'exterior',1,8,-8,id),ids=walls.map(e=>e.id);
  const perimeter=outline.reduce((n,a,j)=>n+Math.hypot(a.x-outline[(j+1)%outline.length].x,a.y-outline[(j+1)%outline.length].y),0);
  for(const offset of [0,2]){
   const d=derivePerimeterDrainage(walls,[...ids].reverse(),offset,'pipe','drain',id),rows=qty([...walls,...d]).filter(r=>r.code==='foundation.drainage.length');
   assert.equal(rows.length,ids.length);assert.ok(rows.every(r=>r.status==='measured'));near(rows.reduce((n,r)=>n+(r.status==='measured'?r.quantity:0),0),perimeter+8*offset);
   for(let j=0;j<d.length;j++){const a=d[j],b=d[(j+1)%d.length];if(a.kind!=='foundationLine'||b.kind!=='foundationLine')throw Error('Expected drainage line');assert.deepEqual(a.end,b.start)}
   assert.throws(()=>qty([...walls,...d.slice(1)]),/Incomplete/);
   assert.throws(()=>derivePerimeterDrainage([...walls,...d],ids,offset,'pipe','drain',id),/Remove existing/);
   assert.equal(planFoundationDeletion([...walls,...d],[walls[0].id]).remaining.length,walls.length-1);
  }
 }
});
test('irregular drainage rejects collapsed offsets, partial selection and stale route geometry',()=>{
 const outline=[{x:0,y:0},{x:40,y:0},{x:40,y:40},{x:30,y:40},{x:30,y:10},{x:10,y:10},{x:10,y:40},{x:0,y:40}];
 let i=0;const id=()=> 'irrdr'+(++i),walls=generateOrthogonalFoundationPerimeter(outline,'exterior',1,8,0,id),ids=walls.map(e=>e.id);
 assert.throws(()=>derivePerimeterDrainage(walls,ids,11,'pipe','drain',id));
 assert.throws(()=>derivePerimeterDrainage(walls,ids.slice(1),2,'pipe','drain',id));
 assert.throws(()=>derivePerimeterDrainage(walls,ids,-1,'pipe','drain',id));
 const d=derivePerimeterDrainage(walls,ids,2,'pipe','drain',id),first=d[0];
 if(first.kind!=='foundationLine')throw Error('Expected drainage line');
 assert.throws(()=>qty([...walls,{...first,start:{x:first.start.x+.1,y:first.start.y}},...d.slice(1)]),/stale/);
 const source=walls[0];if(source.kind!=='foundationWall')throw Error('Expected wall');
 assert.throws(()=>qty([{...source,widthFt:2},...walls.slice(1),...d]));
});
