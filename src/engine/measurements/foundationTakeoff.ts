import {drainageCatalogueAttributes,foundationMaterialCatalogue} from './foundationMaterialCatalogue';
import type {FoundationAssemblyRecord} from './foundationAssemblyModel';
import type {FoundationEntity,QuantityContribution,QuantityUnit} from './measurementTypes';
import {formatFoundationQuantity} from './foundationUnits';

export type TakeoffCategory='Concrete'|'Granular materials'|'Insulation'|'Waterproofing'|'Drainage'|'Excavation'|'Backfill'|'Other materials'|'Informational';
export type FoundationTakeoffRow={
  key:string;category:TakeoffCategory;code:string;material:string;unit:QuantityUnit;
  thicknessFt?:number|null;diameterFt?:number|null;pipeMaterial?:string;perforation?:string;
  quantity:number;known:number;pending:number;contributions:QuantityContribution[];
};

function categoryOf(code:string,unit:QuantityUnit):TakeoffCategory{
  if(unit==='BF')return 'Informational';
  if(code.includes('.concrete')||code==='foundation.footing.pad.count')return 'Concrete';
  if(code.includes('.granular.'))return 'Granular materials';
  if(code.includes('.insulation.'))return 'Insulation';
  if(code.includes('.waterproofing.'))return 'Waterproofing';
  if(code.includes('.drainage.'))return 'Drainage';
  if(code.includes('.excavation.'))return 'Excavation';
  if(code.includes('.backfill.'))return 'Backfill';
  return 'Other materials';
}

/** Group canonical ledger contributions without changing eligibility or recalculating geometry. */
export function groupFoundationTakeoff(ledger:QuantityContribution[],entities:FoundationEntity[],parents:FoundationAssemblyRecord[]=[]):FoundationTakeoffRow[]{
  const byId=new Map(entities.map(entity=>[entity.id,entity]));
  const ownedDrainage=new Map<string,FoundationAssemblyRecord>();
  for(const parent of parents)for(const child of parent.children)if(child.role.system==='drainage')ownedDrainage.set(child.entityId,parent);
  const grouped=new Map<string,FoundationTakeoffRow>();
  for(const record of ledger){
    const entity=byId.get(record.elementId);
    if(!entity||entity.scopeApplicability?.status==='excluded')continue;
    const material=entity.foundation?.material.trim()||'Material unspecified';
    const category=categoryOf(record.code,record.unit);
    const insulation='purpose' in entity&&entity.purpose==='insulation';
    const thicknessFt=insulation?('polygon' in entity?entity.depthFt:entity.foundation?.coverage?.thicknessFt??null):undefined;
    const drainage=ownedDrainage.get(entity.id)?.specifications.drainage;
    const spec=drainage?.status==='included'?drainage.specification:undefined;
    const attrs=spec?.attributes?.value;
    const catalogue=drainageCatalogueAttributes(material);
    const diameterFt=category==='Drainage'?attrs?.nominalDiameterFt?.value??null:undefined;
    const pipeMaterial=category==='Drainage'?attrs?.pipeMaterial?.value??catalogue.pipeMaterial??'Pipe material unspecified':undefined;
    const perforation=category==='Drainage'?attrs?.perforation?.value??catalogue.perforation??'Perforation unspecified':undefined;
    const key=JSON.stringify([record.code,record.unit,material,thicknessFt,diameterFt,pipeMaterial,perforation]);
    const row=grouped.get(key)??{key,category,code:record.code,unit:record.unit,material,thicknessFt,diameterFt,pipeMaterial,perforation,quantity:0,known:0,pending:0,contributions:[]};
    row.contributions.push(record);
    if(record.status==='measured'){row.quantity+=record.quantity;row.known++;}
    else row.pending++;
    grouped.set(key,row);
  }
  return [...grouped.values()];
}

export function describeFoundationTakeoff(row:FoundationTakeoffRow,metric:boolean){
  const label=Object.values(foundationMaterialCatalogue).flat().find(([id])=>id===row.material)?.[1]??row.material;
  const section=(value:number|null,missing:string)=>value===null?missing:
    formatFoundationQuantity(value*(metric?304.8:12),metric?'mm':'in',false);
  const qualifications=[
    row.thicknessFt!==undefined?section(row.thicknessFt,'Thickness unspecified'):null,
    row.diameterFt!==undefined?section(row.diameterFt,'Diameter unspecified'):null,
    row.pipeMaterial,row.perforation,
  ].filter(Boolean);
  return [label,...qualifications].join(' · ');
}
