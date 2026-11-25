import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSpecialistEntities,validateContributionSet} from '../src/engine/measurements/measurementTypes';
import type {RoofEntity,QuantityContribution} from '../src/engine/measurements/measurementTypes';
import {createBlankProject} from '../src/engine/samplePlans';
import {createProjectDocument,readProjectDocument,serializeProjectDocument,deserializeProjectDocument} from '../src/engine/projectDocument';
import {addWorkspace,replaceSpecialistEntities,setScopeAssignment,selectWorkspace} from '../src/engine/workspaceController';
const plane:RoofEntity={id:'p',physicalId:'roof-p',assemblyId:'shingles',source:{reference:'R1'},kind:'roofPlane',polygon:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],pitchRise:6,slopeDegrees:90,elevationFt:10};
const fresh=()=>createProjectDocument(createBlankProject(),'floor');
test('specialist entities persist, retain missing values and reject wrong workspace types',()=>{
 const doc=addWorkspace(fresh(),'r','Roof','roof');
 const second={...plane,id:'p2',physicalId:'roof-p2',pitchRise:null,polygon:plane.polygon.map(p=>({...p,x:p.x+20}))};
 const next=replaceSpecialistEntities(doc,'r',[plane,second]);
 assert.throws(()=>replaceSpecialistEntities(doc,'r',[plane,{...second,polygon:plane.polygon}]),/Overlapping roof planes/);
 assert.deepEqual(deserializeProjectDocument(serializeProjectDocument(next)),next);
 assert.equal(doc.workspaces[1].measurements.length,0);
 assert.throws(()=>validateSpecialistEntities('foundation',[plane]),/incompatible/);
 assert.throws(()=>validateSpecialistEntities('floor',[plane]),/floor cannot/);
 assert.throws(()=>replaceSpecialistEntities(selectWorkspace(next,'floor'),'r',[plane]),/Inactive/);
});
test('invalid dimensions, duplicate IDs, degenerate polygons and missing references rejected',()=>{
 assert.throws(()=>validateSpecialistEntities('roof',[{...plane,pitchRise:-1}]),/roof plane/);
 assert.throws(()=>validateSpecialistEntities('roof',[{...plane,pitchRise:NaN}]),/roof plane/);
 assert.throws(()=>validateSpecialistEntities('roof',[plane,plane]),/duplicate entity/);
 assert.throws(()=>validateSpecialistEntities('roof',[plane,{...plane,id:'other'}]),/duplicate specialist physical/);
 assert.throws(()=>validateSpecialistEntities('roof',[{...plane,polygon:[{x:0,y:0},{x:1,y:1},{x:2,y:2}]}]),/roof plane/);
 assert.throws(()=>validateSpecialistEntities('roof',[{...plane,kind:'roofOpening',planeId:'missing'}]),/missing opening plane/);
});
test('foundation and site validate independently',()=>{
 const identity={id:'a',physicalId:'a',assemblyId:'concrete',source:{reference:'S1'}};
 const line={...identity,kind:'foundationWall',start:{x:0,y:0},end:{x:10,y:0},widthFt:1,heightFt:null,elevationFt:0};
 validateSpecialistEntities('foundation',[line]);
 assert.throws(()=>validateSpecialistEntities('foundation',[{...line,widthFt:0}]),/foundation line/);
 const count={...identity,kind:'siteCount',point:{x:1,y:2},purpose:'post',count:2};
 validateSpecialistEntities('site',[count]);
 assert.throws(()=>validateSpecialistEntities('site',[{...count,count:1.5}]),/site count/);
});
test('quantity contributions reject duplicates across workspaces and missing-as-zero',()=>{
 const row:QuantityContribution={workspaceId:'r',elementId:'p',physicalId:'roof-p',assemblyId:'shingles',source:{reference:'R1'},code:'roof.covering.area',unit:'SF',basis:'plane',status:'measured',quantity:100};
 validateContributionSet([row,{...row,assemblyId:'underlay'}]);
 assert.throws(()=>validateContributionSet([row,{...row,workspaceId:'other'}]),/duplicate physical/);
 assert.throws(()=>validateContributionSet([{...row,quantity:NaN}]),/invalid contribution/);
 assert.throws(()=>validateContributionSet([{...row,status:'unquantified',reason:'missing pitch'}] as any),/invalid contribution/);
});
test('bounded explicit v2 preview migration does not certify measurements or discard generic geometry',()=>{
 const doc=addWorkspace(fresh(),'r','Roof','roof');
 const v2={...doc,schemaVersion:2,workspaces:doc.workspaces.map(({measurements,...w})=>w),scope:{mode:'explicit',assignments:{roof:{status:'measured',workspaceIds:['r']},foundation:{status:'unquantified'},site:{status:'excluded'}}}};
 const next=readProjectDocument(v2);
 assert.equal(next.schemaVersion,3);
 assert.deepEqual(next.scope.assignments.roof,{status:'assigned',workspaceIds:['r']});
 assert.deepEqual(next.scope.assignments.site,{status:'unquantified'});
 assert.equal(v2.schemaVersion,2);
 v2.workspaces[1].geometry.nodes.push({id:'n',x:1,y:1});
 assert.throws(()=>readProjectDocument(v2),/manual recreation/);
});
