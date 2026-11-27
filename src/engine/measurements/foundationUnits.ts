import { parseDimension } from '../precisionDrafting';

export type FoundationUnit = 'ft' | 'in' | 'm' | 'mm';

const perFoot: Record<FoundationUnit, number> = { ft: 1, in: 12, m: 0.3048, mm: 304.8 };

export function parseFoundationDimension(input: string, unit: FoundationUnit): number | null {
  const text = input.trim().toLowerCase().replace(/[′’]/g, "'").replace(/[″”]/g, '"');
  const sign = text.startsWith('-') ? -1 : 1;
  const unsigned = text.replace(/^[+-]/, '');
  const decimal = /^(\d+(?:\.\d+)?|\.\d+)\s*(ft|feet|in|m|cm|mm|'|")?$/.exec(unsigned);
  if (decimal) {
    const suffix = decimal[2];
    const value = suffix ? parseDimension(unsigned) ?? (Number(decimal[1]) === 0 ? 0 : null) : Number(decimal[1]) / perFoot[unit];
    return value !== null && Number.isFinite(value) ? sign * value : null;
  }
  const fraction = /^(?:(\d+)\s+)?(\d+)\/(\d+)\s*(ft|feet|in|'|")?$/.exec(unsigned);
  if (fraction) {
    const denominator = Number(fraction[3]);
    if (!denominator) return null;
    const fractionUnit = fraction[4] === 'in' || fraction[4] === '"' ? 'in' : fraction[4] ? 'ft' : unit;
    const value = (Number(fraction[1] ?? 0) + Number(fraction[2]) / denominator) / perFoot[fractionUnit];
    return Number.isFinite(value) ? sign * value : null;
  }
  const compound = /^(\d+)\s*'\s*(?:-\s*)?(\d+)(?:\s+(\d+)\/(\d+))?\s*"?$/.exec(unsigned);
  if (compound) {
    const inch = Number(compound[2]) + (compound[3] ? Number(compound[3])/Number(compound[4]) : 0);
    const value = sign * (Number(compound[1])+inch/12);
    return inch<12 && Number.isFinite(value) ? value : null;
  }
  const legacy = parseDimension(unsigned);
  return legacy === null ? null : sign * legacy;
}

export function displayFoundationDimension(feet: number, unit: FoundationUnit): string {
  return String(Number((feet * perFoot[unit]).toPrecision(14)));
}

export function formatFoundationQuantity(quantity:number,unit:string,metric:boolean):string{
  const conversion:Record<string,[number,string]>={CY:[27*.3048**3,'m³'],SF:[.3048**2,'m²'],LF:[.3048,'m']};
  const basis=metric&&Object.prototype.hasOwnProperty.call(conversion,unit)?conversion[unit]:undefined;
  return (quantity*(basis?.[0]??1)).toFixed(unit==='EA'?0:2)+' '+(basis?.[1]??unit);
}

export function formatCompoundFeet(feet:number):string {
  const total=Math.round(Math.abs(feet)*12*16);
  const whole=Math.floor(total/(12*16));
  const inches=Math.floor(total/16)%12;
  const fraction=total%16;
  let divisor=16;
  while(divisor>1&&fraction%(16/divisor*2)===0)divisor/=2;
  const fractionalInch=fraction?(' '+(fraction*divisor/16)+'/'+divisor):'';
  return (feet<0?'-':'')+whole+"' "+inches+fractionalInch+'"';
}
