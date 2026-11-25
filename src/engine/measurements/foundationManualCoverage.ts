import type {FoundationCoverage,FoundationEntity} from './measurementTypes';
export type CoverageInput={layer:string;confirmed:boolean;foam:boolean;thicknessFt:number|null;openingTreatment:''|'none'|'alreadyDeducted'};
/** Explicit coverage edits never infer an opening treatment or a foam thickness. */
export function manualFoundationCoverage(e:FoundationEntity,input:CoverageInput):FoundationCoverage|undefined{
 if(e.kind!=='foundationLine'&&!(e.kind==='foundationRegion'&&e.purpose==='insulation'))throw Error('Unsupported coverage component');
 if(!input.confirmed)return undefined;
 if(!input.layer.trim())throw Error('Specify layer identity for confirmed coverage');
 const c:FoundationCoverage={layerId:input.layer.trim(),confirmed:true};
 if(e.purpose==='insulation'){
  if(input.foam)c.foam=true;
  if(e.kind==='foundationLine'&&input.thicknessFt!==null){
   if(!Number.isFinite(input.thicknessFt)||input.thicknessFt<=0)throw Error('Specify positive insulation thickness');
   c.thicknessFt=input.thicknessFt;
  }else if(e.kind==='foundationRegion'&&e.foundation?.coverage?.thicknessFt!==undefined){
   // Preserve historical metadata; polygon depth remains the board-foot authority.
   c.thicknessFt=e.foundation.coverage.thicknessFt;
  }
 }
 if(e.kind==='foundationLine'&&e.purpose!=='drainage'&&input.openingTreatment)c.openingTreatment=input.openingTreatment;
 return c;
}
