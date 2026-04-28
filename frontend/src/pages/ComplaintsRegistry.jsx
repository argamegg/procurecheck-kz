import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, FileSearch, Scale, ShieldAlert } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { DataTable } from '@/components/shared/DataTable';
import { ComplaintStatusBadge } from '@/components/shared/Badges';
import { InfoCard, MetricCard, SectionCard } from '@/components/shared/Cards';
import { PrimaryButton, SecondaryButton } from '@/components/shared/Buttons';
import { complaintsAPI } from '@/utils/api';
import { formatDate } from '@/utils/ows';
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

export default function ComplaintsRegistry() {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadComplaints();
  }, []);

  const loadComplaints = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await complaintsAPI.list({ page: 1, page_size: API_FETCH_LIMIT });
      setComplaints(response.data.items || []);
    } catch (error) {
      console.error('Complaints registry load failed', error);
      setError(getErrorMessage(error, 'Не удалось загрузить реестр жалоб'));
      toast.error('Не удалось загрузить реестр жалоб');
    } finally {
      setLoading(false);
    }
  };

  const availableStatuses = useMemo(() => {
    const statuses = Array.from(new Set(complaints.map((item) => item.status).filter(Boolean)));
    return ['all', ...statuses];
  }, [complaints]);

  const filteredComplaints = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return complaints.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        item.complaint_number.toLowerCase().includes(normalizedQuery) ||
        item.applicant_name.toLowerCase().includes(normalizedQuery) ||
        item.object_name.toLowerCase().includes(normalizedQuery) ||
        item.short_description.toLowerCase().includes(normalizedQuery) ||
        (item.tender_number || '').toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      if (dateFrom) {
        const submitted = item.date_submitted ? new Date(item.date_submitted) : null;
        const fromDate = new Date(dateFrom);
        if (submitted && submitted < fromDate) return false;
      }

      if (dateTo) {
        const submitted = item.date_submitted ? new Date(item.date_submitted) : null;
        const toDate = new Date(`${dateTo}T23:59:59`);
        if (submitted && submitted > toDate) return false;
      }

      return true;
    });
  }, [complaints, searchQuery, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredComplaints.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedComplaints = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredComplaints.slice(start, start + PAGE_SIZE);
  }, [filteredComplaints, page]);

  const stats = useMemo(() => {
    const pending = filteredComplaints.filter((item) => {
      const status = item.status.toLowerCase();
      return status.includes('подан') || status.includes('рассмотр');
    }).length;
    const resolved = filteredComplaints.filter((item) => item.status.toLowerCase().includes('удовлетвор')).length;
    const rejected = filteredComplaints.filter((item) => {
      const status = item.status.toLowerCase();
      return status.includes('отклон') || status.includes('отказ');
    }).length;
    return { pending, resolved, rejected };
  }, [filteredComplaints]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <PageContainer>
      <div data-testid="complaints-registry-page" className="space-y-8">
        <PageHeader
          title="Реестр жалоб"
          subtitle={`Записей в текущей локальной базе: ${complaints.length}`}
          actions={
            <SecondaryButton onClick={() => navigate('/')} data-testid="complaints-back-btn">
              <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Назад
            </SecondaryButton>
          }
        />

        <div className="bento-grid">
          <MetricCard label="Всего жалоб" value={filteredComplaints.length} icon={<FileSearch className="w-5 h-5" strokeWidth={1.5} />} trend="По текущим фильтрам" />
          <MetricCard label="На рассмотрении" value={stats.pending} icon={<Scale className="w-5 h-5" strokeWidth={1.5} />} trend="Поданы или рассматриваются" />
          <MetricCard label="Решены" value={stats.resolved} icon={<ShieldAlert className="w-5 h-5" strokeWidth={1.5} />} trend="Есть итоговое решение" />
          <MetricCard label="Отклонены" value={stats.rejected} icon={<AlertTriangle className="w-5 h-5" strokeWidth={1.5} />} trend="Отказано или отклонено" />
        </div>

        <InfoCard title="Поиск и фильтры">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_repeat(3,minmax(0,1fr))] gap-3">
              <SearchInput
                placeholder="Поиск по номеру жалобы, заявителю, объекту или тендеру..."
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
                {availableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status === 'all' ? 'Все статусы' : status}
                  </option>
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
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <PrimaryButton onClick={loadComplaints} disabled={loading}>
                {loading ? 'Загрузка...' : 'Обновить данные'}
              </PrimaryButton>
              <SecondaryButton onClick={resetFilters}>Сбросить фильтры</SecondaryButton>
              <p className="text-sm text-slate-500">Показано {filteredComplaints.length} записей</p>
            </div>
          </div>
        </InfoCard>

        <InfoCard title="Таблица жалоб">
          {loading ? (
            <div className="py-16 text-center text-slate-500">Загрузка реестра жалоб...</div>
          ) : error ? (
            <div className="py-16 text-center">
              <p className="text-slate-900 font-medium">Ошибка загрузки реестра жалоб</p>
              <p className="text-sm text-slate-500 mt-2">{error}</p>
            </div>
          ) : complaints.length === 0 ? (
            <div className="space-y-4 py-8">
              <SectionCard className="border-l-4 border-amber-400">
                <p className="font-medium text-slate-900">В текущей локальной базе жалобы отсутствуют</p>
                <p className="text-sm text-slate-600 mt-2">
                  Реестр уже подключен к существующей структуре проекта и покажет записи, как только жалобы появятся
                  в локальном источнике данных. Сейчас такие записи в базе отсутствуют.
                </p>
              </SectionCard>
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-slate-900 font-medium">Жалобы не найдены</p>
              <p className="text-sm text-slate-500 mt-2">По текущим фильтрам и строке поиска записей нет.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <DataTable
                columns={[
                  { header: 'Номер жалобы', key: 'complaint_number', render: (row) => <span className="font-medium text-slate-900">{row.complaint_number}</span> },
                  { header: 'Дата подачи', key: 'date_submitted', render: (row) => formatDate(row.date_submitted) },
                  { header: 'Заявитель', key: 'applicant_name', render: (row) => (
                    <div>
                      <p className="font-medium text-slate-900">{row.applicant_name}</p>
                      <p className="text-xs font-mono text-slate-500">{row.applicant_identifier || 'Без БИН/ИИН'}</p>
                    </div>
                  ) },
                  { header: 'Поставщик', key: 'supplier_name', render: (row) => row.supplier_name || 'Не указан' },
                  { header: 'Заказчик', key: 'customer_name', render: (row) => row.customer_name || 'Не указан' },
                  { header: 'Объект жалобы', key: 'object_name', render: (row) => (
                    <div>
                      <p className="font-medium text-slate-900">{row.object_name}</p>
                      <p className="text-xs text-slate-500">{row.object_type}</p>
                    </div>
                  ) },
                  { header: 'Статус', key: 'status', render: (row) => <ComplaintStatusBadge status={row.status} /> },
                  { header: 'Решение', key: 'decision', render: (row) => row.decision || 'Без решения' },
                ]}
                data={pagedComplaints}
                onRowClick={(row) => navigate(`/complaints/${row.id}`)}
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">Страница {page} из {totalPages}</p>
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
