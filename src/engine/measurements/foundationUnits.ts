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
  const compound = parseDimension(unsigned);
  return compound === null ? null : sign * compound;
}

export function displayFoundationDimension(feet: number, unit: FoundationUnit): string {
  return String(Number((feet * perFoot[unit]).toPrecision(14)));
}
