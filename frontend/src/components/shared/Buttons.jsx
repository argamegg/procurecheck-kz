import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const PrimaryButton = ({ children, className, ...props }) => {
  return (
    <Button
      data-testid="primary-button"
      className={cn(
        'bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 text-sm font-medium shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
};

export const SecondaryButton = ({ children, className, ...props }) => {
  return (
    <Button
      data-testid="secondary-button"
      variant="outline"
      className={cn(
        'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md px-4 py-2 text-sm font-medium',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
};

export const DangerButton = ({ children, className, ...props }) => {
  return (
    <Button
      data-testid="danger-button"
      variant="destructive"
      className={cn(
        'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-md px-4 py-2 text-sm font-medium',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
};
