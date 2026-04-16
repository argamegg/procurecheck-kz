import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const InfoCard = ({ title, children, className, actions }) => {
  return (
    <Card
      data-testid="info-card"
      className={cn('bg-white border border-slate-200 shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200', className)}
    >
      {title && (
        <CardHeader className="px-5 py-4 border-b border-slate-100 flex flex-row justify-between items-center">
          <CardTitle className="text-lg font-medium text-slate-900">{title}</CardTitle>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
};

export const MetricCard = ({ label, value, icon, trend, className }) => {
  return (
    <Card
      data-testid="metric-card"
      className={cn('bg-white border border-slate-200 shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200', className)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
            <p className="text-2xl font-semibold text-slate-900">{value}</p>
            {trend && <p className="text-xs text-slate-600 mt-1">{trend}</p>}
          </div>
          {icon && <div className="text-slate-400">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
};

export const SectionCard = ({ children, className }) => {
  return (
    <div
      data-testid="section-card"
      className={cn('bg-white border border-slate-200 shadow-sm rounded-lg p-5', className)}
    >
      {children}
    </div>
  );
};
