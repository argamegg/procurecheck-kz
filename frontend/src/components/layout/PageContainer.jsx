import React from 'react';
import { Navbar } from './Navbar';
import { cn } from '@/lib/utils';

export const PageContainer = ({ children, className }) => {
  return (
    <div data-testid="page-container" className="min-h-screen bg-[#F8FAFC]">
      <Navbar />
      <main className={cn('pt-16', className)}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
};
