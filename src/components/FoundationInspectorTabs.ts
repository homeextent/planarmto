import {createContext} from 'react';

export type FoundationInspectorTab = 'Construction' | 'Geometry' | 'Quantities';
export const foundationInspectorTabs = ['Construction','Geometry','Quantities'] as const;
export const FoundationInspectorContext=createContext<{
  tab:FoundationInspectorTab;
  selectTab:(tab:FoundationInspectorTab)=>void;
}>({tab:'Construction',selectTab:()=>{}});
