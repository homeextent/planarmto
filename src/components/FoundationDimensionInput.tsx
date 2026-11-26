import React, { createContext, useContext, useId, useState } from 'react';
import { displayFoundationDimension, formatCompoundFeet, parseFoundationDimension, type FoundationUnit } from '../engine/measurements/foundationUnits';

export const FoundationMetricContext = createContext(false);

interface Props {
  key?: string;
  label: string;
  value: string;
  onChange: (feet: string) => void;
  className: string;
  section?: boolean;
  compound?: boolean;
  metric?: boolean;
  hint?: string;
  accessibleLabel?: string;
  suggestions?: number[];
}

/** The parent owns canonical feet. Unedited display rounding never feeds a save. */
export function FoundationDimensionInput({ label, value, onChange, className, section, compound, metric, hint, accessibleLabel, suggestions }: Props) {
  const listId=useId();
  const contextMetric = useContext(FoundationMetricContext);
  const useMetric = metric ?? contextMetric;
  const unit: FoundationUnit = section ? (useMetric ? 'mm' : 'in') : (useMetric ? 'm' : 'ft');
  const [edit, setEdit] = useState<{ text: string; canonical: string; unit: FoundationUnit }>();
  const text = edit?.canonical === value && edit.unit === unit
    ? edit.text
    : value && Number.isFinite(Number(value)) ? (unit==='ft'&&compound?formatCompoundFeet(Number(value)):displayFoundationDimension(Number(value), unit)) : '';
  const options=new Map(suggestions?.map(feet=>{
    const formatted=unit==='ft'&&compound?formatCompoundFeet(feet):displayFoundationDimension(feet,unit);
    const exact=parseFoundationDimension(formatted,unit)===feet?formatted:displayFoundationDimension(feet,'ft')+' ft';
    return [exact,feet];
  }));
  const suffix = ` (${unit}${hint ? '; ' + hint : ''})`;

  return <label className="block">
    {label}{suffix}
    <input aria-label={(accessibleLabel ?? label) + suffix} className={className} list={options.size?listId:undefined} inputMode="text" value={text} onChange={event => {
      const text = event.target.value;
      const feet = options.get(text)??parseFoundationDimension(text, unit);
      const canonical = text.trim() ? (feet === null ? 'invalid' : String(feet)) : '';
      setEdit({ text, canonical, unit });
      onChange(canonical);
    }}/>
    {options.size>0&&<datalist id={listId}>{[...options.keys()].map(value=><option key={value} value={value}/>)}</datalist>}
  </label>;
}
