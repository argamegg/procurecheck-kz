import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const StatusBadge = ({ status, className }) => {
  const statusConfig = {
    'Завершен': { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Завершен' },
    'В процессе': { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'В процессе' },
    'Выполнен': { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Выполнен' },
    'Рассмотрена': { color: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Рассмотрена' },
    'Активен': { color: 'bg-red-100 text-red-700 border-red-200', label: 'Активен' },
  };

  const config = statusConfig[status] || { color: 'bg-slate-100 text-slate-700 border-slate-200', label: status };

  return (
    <Badge
      data-testid={`status-badge-${status}`}
      variant="outline"
      className={cn('text-xs font-medium border', config.color, className)}
    >
      {config.label}
    </Badge>
  );
};

export const RiskBadge = ({ level, label, className }) => {
  const riskConfig = {
    high: { color: 'bg-red-100 text-red-700 border-red-200', label: 'Высокий риск' },
    medium: { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Средний риск' },
    low: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Низкий риск' },
  };

  const config = riskConfig[level] || riskConfig.medium;

  return (
    <Badge
      data-testid={`risk-badge-${level}`}
      variant="outline"
      className={cn('text-xs font-medium border', config.color, className)}
    >
      {label || config.label}
    </Badge>
  );
};

export const RoleBadge = ({ role, className }) => {
  return (
    <Badge
      data-testid={`role-badge-${role}`}
      variant="outline"
      className={cn('text-xs font-medium bg-blue-50 text-blue-700 border-blue-200', className)}
    >
      {role}
    </Badge>
  );
};

export const RegistryBadge = ({ isBlacklisted, className }) => {
  if (!isBlacklisted) return null;

  return (
    <Badge
      data-testid="registry-badge-blacklisted"
      variant="outline"
      className={cn('text-xs font-medium bg-red-100 text-red-700 border-red-200', className)}
    >
      В реестре недобросовестных
    </Badge>
  );
};

export const ContractStatusBadge = ({ status, bucket, className }) => {
  const normalizedBucket =
    bucket ||
    (String(status || '').toLowerCase().includes('расторг')
      ? 'terminated'
      : String(status || '').toLowerCase().includes('исполн')
      ? 'completed'
      : 'in_progress');

  const config = {
    completed: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: status || 'Исполнен' },
    in_progress: { color: 'bg-amber-100 text-amber-700 border-amber-200', label: status || 'В процессе' },
    terminated: { color: 'bg-red-100 text-red-700 border-red-200', label: status || 'Расторгнут' },
  }[normalizedBucket] || {
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    label: status || 'Неизвестно',
  };

  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium border', config.color, className)}
    >
      {config.label}
    </Badge>
  );
};

export const ComplaintStatusBadge = ({ status, className }) => {
  const normalized = String(status || '').toLowerCase();
  const config =
    normalized.includes('удовлетвор')
      ? { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: status }
      : normalized.includes('отклон') || normalized.includes('отказ')
      ? { color: 'bg-red-100 text-red-700 border-red-200', label: status }
      : normalized.includes('рассмотр')
      ? { color: 'bg-amber-100 text-amber-700 border-amber-200', label: status }
      : normalized.includes('подан')
      ? { color: 'bg-blue-100 text-blue-700 border-blue-200', label: status }
      : { color: 'bg-slate-100 text-slate-700 border-slate-200', label: status || 'Статус не указан' };

  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium border', config.color, className)}
    >
      {config.label}
    </Badge>
  );
};
