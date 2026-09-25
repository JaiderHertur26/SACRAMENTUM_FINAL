import React, { createContext, useContext, useState } from 'react';
import { cn } from '@/lib/utils';

const TabsContext = createContext({});

const Tabs = ({ defaultValue, value, onValueChange, children, className }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  const currentTab = value !== undefined ? value : activeTab;
  
  const handleTabChange = (newValue) => {
      if (onValueChange) {
          onValueChange(newValue);
      }
      if (value === undefined) {
          setActiveTab(newValue);
      }
  };

  return (
    <TabsContext.Provider value={{ currentTab, handleTabChange }}>
      <div className={cn("w-full", className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

const TabsList = ({ children, className }) => {
  return (
    <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500", className)}>
      {children}
    </div>
  );
};

const TabsTrigger = ({ value, children, className }) => {
  const { currentTab, handleTabChange } = useContext(TabsContext);
  const isActive = currentTab === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => handleTabChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive && "bg-white text-slate-900 shadow-sm",
        className
      )}
    >
      {children}
    </button>
  );
};

const TabsContent = ({ value, children, className }) => {
  const { currentTab } = useContext(TabsContext);
  if (currentTab !== value) return null;

  return (
    <div
      role="tabpanel"
      className={cn(
        "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
        className
      )}
    >
      {children}
    </div>
  );
};

export { Tabs, TabsList, TabsTrigger, TabsContent };