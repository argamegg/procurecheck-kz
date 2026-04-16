import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export const ContentSwitcher = ({ tabs, defaultTab, className }) => {
  return (
    <Tabs data-testid="content-switcher" defaultValue={defaultTab || tabs[0]?.value} className={cn('w-full', className)}>
      <TabsList className="bg-slate-100 p-1 rounded-lg mb-6">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            data-testid={`tab-trigger-${tab.value}`}
            className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm px-4 py-2 text-sm font-medium rounded-md transition-all"
          >
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} data-testid={`tab-content-${tab.value}`}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
};
