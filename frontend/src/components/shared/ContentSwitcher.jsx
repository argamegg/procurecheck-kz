import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export const ContentSwitcher = ({ tabs, defaultTab, className }) => {
  return (
    <Tabs data-testid="content-switcher" defaultValue={defaultTab || tabs[0]?.value} className={cn('w-full', className)}>
      <TabsList className="mb-6 h-auto w-full flex-wrap items-center justify-start gap-2 rounded-xl border border-slate-200 bg-slate-100 p-2">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            data-testid={`tab-trigger-${tab.value}`}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-white/80 hover:text-slate-900 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
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
