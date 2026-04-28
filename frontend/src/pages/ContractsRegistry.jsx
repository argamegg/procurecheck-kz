import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FileCheck, FileClock, FileX2, ReceiptText } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { DataTable } from '@/components/shared/DataTable';
import { ContractStatusBadge } from '@/components/shared/Badges';
import { InfoCard, MetricCard } from '@/components/shared/Cards';
import { PrimaryButton, SecondaryButton } from '@/components/shared/Buttons';
import { contractsAPI } from '@/utils/api';
import { formatCurrency, formatDate } from '@/utils/ows';
import { toast } from 'sonner';

const PAGE_SIZE = 10;
const API_FETCH_LIMIT = 100;

const getErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.msg) return item.msg;
        return JSON.stringify(item);
      })
      .join('; ');
  }

  return fallback;
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'in_progress', label: 'В процессе' },
  { value: 'completed', label: 'Исполнен' },
  { value: 'terminated', label: 'Расторгнут' },
];

export default function ContractsRegistry() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountFrom, setAmountFrom] = useState('');
  const [amountTo, setAmountTo] = useState('');
  const [sortKey, setSortKey] = useState('contract_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await contractsAPI.list({ page: 1, page_size: API_FETCH_LIMIT });
      setContracts(response.data.items || []);
    } catch (error) {
      console.error('Contracts registry load failed', error);
      setError(getErrorMessage(error, 'Не удалось загрузить реестр договоров'));
      toast.error('Не удалось загрузить реестр договоров');
    } finally {
      setLoading(false);
    }
  };

  const filteredContracts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const parsedAmountFrom = amountFrom ? Number(amountFrom) : null;
    const parsedAmountTo = amountTo ? Number(amountTo) : null;

    return contracts.filter((contract) => {
      const matchesQuery =
        !normalizedQuery ||
        contract.contract_number.toLowerCase().includes(normalizedQuery) ||
        contract.contract_number_sys.toLowerCase().includes(normalizedQuery) ||
        contract.supplier_name.toLowerCase().includes(normalizedQuery) ||
        contract.customer_name.toLowerCase().includes(normalizedQuery) ||
        (contract.tender_number || '').toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) return false;

      if (statusFilter !== 'all' && contract.status_bucket !== statusFilter) return false;

      if (dateFrom) {
        const contractDate = contract.contract_date ? new Date(contract.contract_date) : null;
        const fromDate = new Date(dateFrom);
        if (contractDate && contractDate < fromDate) return false;
      }

      if (dateTo) {
        const contractDate = contract.contract_date ? new Date(contract.contract_date) : null;
        const toDate = new Date(`${dateTo}T23:59:59`);
        if (contractDate && contractDate > toDate) return false;
      }

      if (parsedAmountFrom !== null && Number(contract.amount) < parsedAmountFrom) return false;
      if (parsedAmountTo !== null && Number(contract.amount) > parsedAmountTo) return false;

      return true;
    });
  }, [contracts, searchQuery, statusFilter, dateFrom, dateTo, amountFrom, amountTo]);

  const sortedContracts = useMemo(() => {
    const items = [...filteredContracts];
    const direction = sortDirection === 'asc' ? 1 : -1;

    items.sort((a, b) => {
      let left = a[sortKey];
      let right = b[sortKey];

      if (sortKey === 'contract_date') {
        left = left ? new Date(left).getTime() : 0;
        right = right ? new Date(right).getTime() : 0;
      }

      if (sortKey === 'amount') {
        left = Number(left || 0);
        right = Number(right || 0);
      }

      if (typeof left === 'string') left = left.toLowerCase();
      if (typeof right === 'string') right = right.toLowerCase();

      if (left < right) return -1 * direction;
      if (left > right) return 1 * direction;
      return 0;
    });

    return items;
  }, [filteredContracts, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedContracts.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedContracts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedContracts.slice(start, start + PAGE_SIZE);
  }, [page, sortedContracts]);

  const stats = useMemo(() => {
    const inProgress = filteredContracts.filter((item) => item.status_bucket === 'in_progress').length;
    const completed = filteredContracts.filter((item) => item.status_bucket === 'completed').length;
    const terminated = filteredContracts.filter((item) => item.status_bucket === 'terminated').length;
    const totalAmount = filteredContracts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { inProgress, completed, terminated, totalAmount };
  }, [filteredContracts]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'contract_date' || key === 'amount' ? 'desc' : 'asc');
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setAmountFrom('');
    setAmountTo('');
    setSortKey('contract_date');
    setSortDirection('desc');
    setPage(1);
  };

  const columns = [
    { header: 'Номер договора', key: 'contract_number', sortable: true, render: (row) => (
      <div>
        <p className="font-medium text-slate-900">{row.contract_number}</p>
        <p className="text-xs text-slate-500">{row.contract_number_sys}</p>
      </div>
    ) },
    { header: 'Дата заключения', key: 'contract_date', sortable: true, render: (row) => formatDate(row.contract_date) },
    { header: 'Поставщик', key: 'supplier_name', sortable: true, render: (row) => (
      <div>
        <p className="font-medium text-slate-900">{row.supplier_name}</p>
        <p className="text-xs font-mono text-slate-500">{row.supplier_biin}</p>
      </div>
    ) },
    { header: 'Заказчик', key: 'customer_name', sortable: true, render: (row) => (
      <div>
        <p className="font-medium text-slate-900">{row.customer_name}</p>
        <p className="text-xs font-mono text-slate-500">{row.customer_bin}</p>
      </div>
    ) },
    { header: 'Сумма', key: 'amount', sortable: true, render: (row) => formatCurrency(row.amount) },
    { header: 'Статус', key: 'status', sortable: true, render: (row) => <ContractStatusBadge status={row.status} bucket={row.status_bucket} /> },
    { header: 'Способ закупки', key: 'procurement_method', sortable: true },
    {
      header: 'Ссылка на тендер',
      key: 'tender_number',
      sortable: true,
      render: (row) => row.tender_number ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/supplier/${row.supplier_biin}?tab=announcements`);
          }}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          {row.tender_number}
          <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      ) : (
        <span className="text-slate-400">Нет связи</span>
      ),
    },
  ];

  const startRow = sortedContracts.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(page * PAGE_SIZE, sortedContracts.length);

  return (
    <PageContainer>
      <div data-testid="contracts-registry-page" className="space-y-8">
        <PageHeader
          title="Реестр договоров"
          subtitle={`Всего записей в локальной базе: ${contracts.length}`}
          actions={
            <SecondaryButton onClick={() => navigate('/')} data-testid="contracts-back-btn">
              <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Назад
            </SecondaryButton>
          }
        />

        <div className="bento-grid">
          <MetricCard label="Найдено договоров" value={filteredContracts.length} icon={<ReceiptText className="w-5 h-5" strokeWidth={1.5} />} trend="По текущим фильтрам" />
          <MetricCard label="На исполнении" value={stats.inProgress} icon={<FileClock className="w-5 h-5" strokeWidth={1.5} />} trend="Требуют контроля исполнения" />
          <MetricCard label="Исполнено" value={stats.completed} icon={<FileCheck className="w-5 h-5" strokeWidth={1.5} />} trend="Закрытые договоры" />
          <MetricCard label="Расторгнуто" value={stats.terminated} icon={<FileX2 className="w-5 h-5" strokeWidth={1.5} />} trend={formatCurrency(stats.totalAmount)} />
        </div>

        <InfoCard title="Поиск и фильтры">
          <div className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-[2fr_repeat(5,minmax(0,1fr))] gap-3">
              <SearchInput
                placeholder="Поиск по номеру договора, поставщику, заказчику или тендеру..."
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(1);
                }}
              />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
              />
              <input
                type="number"
                min="0"
                placeholder="Сумма от"
                value={amountFrom}
                onChange={(event) => {
                  setAmountFrom(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
              />
              <input
                type="number"
                min="0"
                placeholder="Сумма до"
                value={amountTo}
                onChange={(event) => {
                  setAmountTo(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <PrimaryButton onClick={loadContracts} disabled={loading}>
                {loading ? 'Загрузка...' : 'Обновить данные'}
              </PrimaryButton>
              <SecondaryButton onClick={resetFilters}>Сбросить фильтры</SecondaryButton>
              <p className="text-sm text-slate-500">Показано {startRow}-{endRow} из {sortedContracts.length}</p>
            </div>
          </div>
        </InfoCard>

        <InfoCard title="Таблица договоров">
          {loading ? (
            <div className="py-16 text-center text-slate-500">Загрузка реестра договоров...</div>
          ) : error ? (
            <div className="py-16 text-center">
              <p className="text-slate-900 font-medium">Ошибка загрузки реестра договоров</p>
              <p className="text-sm text-slate-500 mt-2">{error}</p>
            </div>
          ) : sortedContracts.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-slate-900 font-medium">Договоры не найдены</p>
              <p className="text-sm text-slate-500 mt-2">Попробуй изменить параметры поиска или сбросить фильтры.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <DataTable
                columns={columns}
                data={pagedContracts}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                onRowClick={(row) => navigate(`/contracts/${row.id}`)}
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Страница {page} из {totalPages}
                </p>
                <div className="flex flex-wrap gap-2">
                  <SecondaryButton onClick={() => setPage(1)} disabled={page === 1}>Первая</SecondaryButton>
                  <SecondaryButton onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Назад</SecondaryButton>
                  <SecondaryButton onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>Вперед</SecondaryButton>
                  <SecondaryButton onClick={() => setPage(totalPages)} disabled={page === totalPages}>Последняя</SecondaryButton>
                </div>
              </div>
            </div>
          )}
        </InfoCard>
      </div>
    </PageContainer>
  );
}
