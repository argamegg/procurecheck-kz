import React from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export const SearchInput = ({ placeholder, value, onChange, className, large, ...props }) => {
  return (
    <div className={cn('relative', className)}>
      <Search
        className={cn(
          'absolute text-slate-400',
          large ? 'left-4 top-1/2 -translate-y-1/2 w-5 h-5' : 'left-3 top-1/2 -translate-y-1/2 w-4 h-4'
        )}
        strokeWidth={1.5}
      />
      <Input
        data-testid="search-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={cn(
          'w-full bg-white border border-slate-300 rounded-md shadow-sm',
          'focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
          large ? 'h-12 text-lg pl-12 pr-4' : 'h-10 text-sm pl-10 pr-3',
          className
        )}
        {...props}
      />
    </div>
  );
};
