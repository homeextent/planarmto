import React, { createContext, useContext, useState, useCallback } from 'react';

interface SnapSetting {
  enabled: boolean;
  size: number;
}

interface ProjectContextType {
  previousSnapSetting: SnapSetting | null;
  saveSnapSetting: (snap: SnapSetting) => void;
  clearSnapSetting: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [previousSnapSetting, setPreviousSnapSetting] = useState<SnapSetting | null>(null);

  const saveSnapSetting = useCallback((snap: SnapSetting) => {
    setPreviousSnapSetting(snap);
  }, []);

  const clearSnapSetting = useCallback(() => {
    setPreviousSnapSetting(null);
  }, []);

  return (
    <ProjectContext.Provider value={{ previousSnapSetting, saveSnapSetting, clearSnapSetting }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
