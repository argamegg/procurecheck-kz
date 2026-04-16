import React from 'react';
import { cn } from '@/lib/utils';

export const DataTable = ({ columns, data, onRowClick, className }) => {
  return (
    <div data-testid="data-table" className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              onClick={() => onRowClick && onRowClick(row)}
              className={cn(
                'border-b border-slate-100 hover:bg-slate-50 transition-colors',
                onRowClick && 'cursor-pointer'
              )}
              data-testid={`table-row-${rowIdx}`}
            >
              {columns.map((col, colIdx) => (
                <td key={colIdx} className="px-4 py-3 text-sm text-slate-700">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-sm">
          Нет данных
        </div>
      )}
    </div>
  );
};
