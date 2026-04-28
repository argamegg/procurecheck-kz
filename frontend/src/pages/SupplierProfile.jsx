import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { ContentSwitcher } from '@/components/shared/ContentSwitcher';
import { InfoCard, MetricCard, SectionCard } from '@/components/shared/Cards';
import { ComplaintStatusBadge, RegistryBadge, RiskBadge, RoleBadge } from '@/components/shared/Badges';
import { SecondaryButton } from '@/components/shared/Buttons';
import { DataTable } from '@/components/shared/DataTable';
import { companiesAPI } from '@/utils/api';
import { addSearchHistoryEntry } from '@/utils/auth';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getAddressTypeLabel,
  getApplicationAmount,
  getBuyStatusLabel,
  getContractStatusLabel,
  getLotStatusLabel,
  getTradeMethodLabel,
  getTypeSupplierLabel,
} from '@/utils/ows';
import { toast } from 'sonner';
import { ArrowLeft, Building2, FileText, Receipt, ShieldAlert, TrendingUp, FileCheck, MessageSquareWarning } from 'lucide-react';
import { SearchInput } from '@/components/shared/SearchInput';
import { PrimaryButton } from '@/components/shared/Buttons';

const TengeIcon = ({ className = '' }) => (
  <span className={`inline-flex items-center justify-center text-lg font-semibold leading-none ${className}`}>
    ₸
  </span>
);

const InlineStatusBadge = ({ label, tone = 'slate' }) => {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${tones[tone] || tones.slate}`}>
      {label}
    </span>
  );
};

const PaginationControls = ({ page, totalPages, onPageChange }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-slate-500">Страница {page} из {totalPages}</p>
    <div className="flex flex-wrap gap-2">
      <SecondaryButton onClick={() => onPageChange(1)} disabled={page === 1}>Первая</SecondaryButton>
      <SecondaryButton onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>Назад</SecondaryButton>
      <SecondaryButton onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Вперед</SecondaryButton>
      <SecondaryButton onClick={() => onPageChange(totalPages)} disabled={page === totalPages}>Последняя</SecondaryButton>
    </div>
  </div>
);

const compareTableValues = (left, right, direction = 'asc') => {
  const safeLeft = left ?? '';
  const safeRight = right ?? '';
  const leftDate = Date.parse(safeLeft);
  const rightDate = Date.parse(safeRight);

  let result = 0;

  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
    result = leftDate - rightDate;
  } else if (typeof safeLeft === 'number' || typeof safeRight === 'number') {
    result = Number(safeLeft || 0) - Number(safeRight || 0);
  } else {
    result = String(safeLeft).localeCompare(String(safeRight), 'ru', { numeric: true, sensitivity: 'base' });
  }

  return direction === 'asc' ? result : -result;
};

const getCircularScoreColor = (score) => {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
};

const getTransparencyTone = (level) => {
  if (level === 'high') return 'emerald';
  if (level === 'medium') return 'amber';
  return 'red';
};

export default function SupplierProfile() {
  const { bin } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bin]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await companiesAPI.getProfile(bin);
      setProfile(response.data);
      addSearchHistoryEntry(response.data.company);
    } catch (error) {
      toast.error('Ошибка загрузки профиля');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">Загрузка...</p>
        </div>
      </PageContainer>
    );
  }

  if (!profile) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">Профиль не найден</p>
        </div>
      </PageContainer>
    );
  }

  const {
    company,
    summary,
    subject,
    subject_addresses,
    subject_employees,
    trd_buys,
    trd_apps,
    contracts,
    contract_units,
    acts,
    complaints = [],
    rnu_entries,
    risk_indicators,
  } = profile;

  const riskAssessment = summary?.risk_assessment || {};
  const roleAnalytics = summary?.role_analytics || {};
  const supplierAnalytics = roleAnalytics?.supplier || null;
  const customerAnalytics = roleAnalytics?.customer || null;
  const organizerAnalytics = roleAnalytics?.organizer || null;
  const primaryRole = roleAnalytics?.primary_role || (company.supplier ? 'supplier' : company.customer ? 'customer' : company.organizer ? 'organizer' : 'participant');
  const primaryScoreLabel = roleAnalytics?.primary_score_label || 'Supplier Trust Score';
  const primaryScoreValue = roleAnalytics?.primary_score_value ?? company.trust_score;
  const primaryStatusLabel = roleAnalytics?.primary_status_label || company.risk_label || 'Не указано';
  const primaryScoreDisplay = primaryRole === 'organizer' ? String(primaryScoreValue ?? 0) : `${primaryScoreValue ?? 0}/100`;
  const requestedTab = searchParams.get('tab') || 'overview';
  const directorEmployee =
    subject_employees.find((employee) => {
      const roleValue = String(employee.role ?? '').toLowerCase();
      const sysRoleValue = String(employee.sys_role_id ?? '').toLowerCase();
      const roleLabel = `${roleValue} ${sysRoleValue}`.toLowerCase();
      return (
        roleLabel.includes('руковод') ||
        roleLabel.includes('директор') ||
        roleLabel.includes('первый руковод')
      );
    }) ||
    subject_employees.find((employee) => Number(employee.role) === 1) ||
    null;

  const OverviewTab = () => (
    <div data-testid="overview-tab" className="space-y-6">
      <div className="bento-grid">
        <MetricCard
          label="Объявления"
          value={summary.total_announcements}
          icon={<FileText className="w-5 h-5" strokeWidth={1.5} />}
        />
        <MetricCard
          label="Заявки поставщика"
          value={summary.total_applications}
          icon={<Receipt className="w-5 h-5" strokeWidth={1.5} />}
        />
        <MetricCard
          label="Договоры"
          value={summary.total_contracts}
          icon={<FileCheck className="w-5 h-5" strokeWidth={1.5} />}
        />
        <MetricCard
          label="Жалобы"
          value={summary.total_complaints || complaints.length}
          icon={<MessageSquareWarning className="w-5 h-5" strokeWidth={1.5} />}
        />
        <MetricCard
          label="Сумма договоров"
          value={formatCurrency(summary.total_value)}
          icon={<TengeIcon className="w-5 h-5 text-slate-400" />}
        />
      </div>

      <InfoCard title="Сводка по данным OWS v3">
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Участник <strong>{subject.full_name_ru || subject.name_ru}</strong> представлен в локальной базе в формате,
            приближенном к официальной структуре OWS v3: карточка участника, адреса, сотрудники, объявления,
            заявки поставщика, договоры, акты и РНУ.
          </p>
          <p>
            В профиле найдено объявлений: <strong>{trd_buys.length}</strong>, заявок: <strong>{trd_apps.length}</strong>,
            договоров: <strong>{contracts.length}</strong>, электронных актов: <strong>{acts.length}</strong>,
            жалоб: <strong>{complaints.length}</strong>.
          </p>
          <p>
            Источник данных: <strong>{summary.data_source}</strong>.
          </p>
        </div>
      </InfoCard>
    </div>
  );

  const SubjectTab = () => (
    <div data-testid="subject-tab" className="space-y-6">
      <InfoCard title="Карточка участника">
        <div className="space-y-6">
          <dl className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500">PID</dt>
              <dd className="mt-1 text-slate-900">{subject.pid}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">БИН</dt>
              <dd className="mt-1 font-mono text-slate-900">{subject.bin}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Краткое наименование (РУ)</dt>
              <dd className="mt-1 text-slate-900">{subject.name_ru}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Краткое наименование (КЗ)</dt>
              <dd className="mt-1 text-slate-900">{subject.name_kz || 'Не указано'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Полное наименование (РУ)</dt>
              <dd className="mt-1 text-slate-900">{subject.full_name_ru || 'Не указано'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Полное наименование (КЗ)</dt>
              <dd className="mt-1 text-slate-900">{subject.full_name_kz || 'Не указано'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Тип поставщика</dt>
              <dd className="mt-1 text-slate-900">{getTypeSupplierLabel(subject.type_supplier)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Дата регистрации</dt>
              <dd className="mt-1 text-slate-900">{formatDate(subject.crdate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Свидетельство</dt>
              <dd className="mt-1 text-slate-900">{subject.number_reg || 'Не указано'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">ОКЭД</dt>
              <dd className="mt-1 text-slate-900">{(subject.oked_list || []).join(', ') || 'Не указано'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Руководитель</dt>
              <dd className="mt-1 text-slate-900">{directorEmployee?.fio || 'Не указано'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Роли</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {company.roles.map((role, idx) => (
                  <RoleBadge key={idx} role={role} />
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Индекс обновления</dt>
              <dd className="mt-1 text-slate-900">{formatDateTime(subject.index_date)}</dd>
            </div>
          </dl>

          <div className="space-y-4 border-t border-slate-200 pt-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Адреса участника</h3>
            </div>

            {subject_addresses.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Нет данных
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {subject_addresses.map((address) => (
                  <SectionCard key={address.id}>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-900">{getAddressTypeLabel(address.address_type)}</h4>
                      <dl className="space-y-3 text-sm">
                        <div>
                          <dt className="text-xs font-medium text-slate-500">Полный адрес</dt>
                          <dd className="mt-1 text-slate-900">{address.address || 'Не указано'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-slate-500">КАТО</dt>
                          <dd className="mt-1 text-slate-900">{address.kato_code || 'Не указано'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-slate-500">Дата обновления</dt>
                          <dd className="mt-1 text-slate-900">{formatDate(address.edit_date)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-slate-500">Телефон</dt>
                          <dd className="mt-1 text-slate-900">{address.phone || 'Не указано'}</dd>
                        </div>
                      </dl>
                    </div>
                  </SectionCard>
                ))}
              </div>
            )}
          </div>
        </div>
      </InfoCard>
    </div>
  );

  const AnnouncementsTab = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [sortKey, setSortKey] = useState('publish_date');
    const [sortDirection, setSortDirection] = useState('desc');
    const PAGE_SIZE = 6;
    const rows = trd_buys.map((announcement) => ({
      ...announcement,
      participant_count: trd_apps.filter((application) => application.buy_id === announcement.id).length,
    }));

    const filteredRows = useMemo(() => {
      const needle = searchQuery.trim().toLowerCase();
      return rows.filter((row) => {
        const matchesSearch =
          !needle ||
          row.number_anno.toLowerCase().includes(needle) ||
          row.name_ru.toLowerCase().includes(needle);
        const matchesStatus = statusFilter === 'all' || String(row.ref_buy_status_id) === statusFilter;
        return matchesSearch && matchesStatus;
      });
    }, [rows, searchQuery, statusFilter]);

    const sortedRows = useMemo(() => {
      return [...filteredRows].sort((left, right) => compareTableValues(left[sortKey], right[sortKey], sortDirection));
    }, [filteredRows, sortDirection, sortKey]);

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
    const pagedRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSort = (key) => {
      setPage(1);
      setSortKey((currentKey) => {
        if (currentKey === key) {
          setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
          return currentKey;
        }
        setSortDirection('asc');
        return key;
      });
    };

    useEffect(() => {
      if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    return (
      <div data-testid="announcements-tab" className="space-y-6">
        <InfoCard title={`Объявления (${trd_buys.length})`}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_auto] gap-3">
              <SearchInput
                placeholder="Поиск по номеру и названию объявления..."
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
                <option value="all">Все статусы</option>
                <option value="310">Опубликовано</option>
                <option value="320">Прием заявок</option>
                <option value="340">Итоги подведены</option>
              </select>
              <PrimaryButton onClick={() => { setSearchQuery(''); setStatusFilter('all'); setPage(1); }}>Сбросить</PrimaryButton>
            </div>

            <DataTable
              columns={[
                { header: 'Номер объявления', key: 'number_anno', sortable: true },
                { header: 'Наименование закупки', key: 'name_ru', sortable: true },
                { header: 'Заказчик', key: 'customer_name_ru', sortable: true },
                { header: 'Способ закупки', key: 'ref_trade_methods_id', render: (row) => getTradeMethodLabel(row.ref_trade_methods_id) },
                { header: 'Дата публикации', key: 'publish_date', sortable: true, render: (row) => formatDate(row.publish_date) },
                { header: 'Срок подачи заявок', key: 'end_date', sortable: true, render: (row) => formatDate(row.end_date) },
                { header: 'Сумма', key: 'total_sum', sortable: true, render: (row) => formatCurrency(row.total_sum) },
                { header: 'Лоты', key: 'count_lots', sortable: true },
                { header: 'Участники', key: 'participant_count', sortable: true },
                {
                  header: 'Статус',
                  key: 'ref_buy_status_id',
                  sortable: true,
                  render: (row) => (
                    <InlineStatusBadge
                      label={getBuyStatusLabel(row.ref_buy_status_id)}
                      tone={row.ref_buy_status_id === 340 ? 'emerald' : row.ref_buy_status_id === 320 ? 'amber' : 'blue'}
                    />
                  ),
                },
              ]}
              data={pagedRows}
              onRowClick={(row) => navigate(`/announcements/${row.id}`)}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />

            <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </InfoCard>
      </div>
    );
  };

  const ApplicationsTab = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [page, setPage] = useState(1);
    const [sortKey, setSortKey] = useState('date_apply');
    const [sortDirection, setSortDirection] = useState('desc');
    const PAGE_SIZE = 6;
    const buyById = Object.fromEntries(trd_buys.map((announcement) => [announcement.id, announcement]));
    const contractBuyIds = new Set(contracts.map((contract) => contract.trd_buy_id));
    const rows = trd_apps.map((application) => {
      const announcement = buyById[application.buy_id];
      const isWinner = contractBuyIds.has(application.buy_id);
      const status = application.status || (isWinner ? 'Победила' : announcement?.ref_buy_status_id === 320 ? 'Подана' : 'Отклонена');
      return {
        ...application,
        bid_number: application.prot_number || `Заявка по объявлению ${announcement?.number_anno || application.buy_id}`,
        announcement_number: announcement?.number_anno || 'Не указано',
        supplier_name: company.name_ru,
        offered_amount: getApplicationAmount(application),
        status,
        place: application.place ?? (isWinner ? 1 : null),
        result: application.result || (isWinner ? 'Победитель' : status === 'Подана' ? 'На рассмотрении' : 'Проиграл'),
      };
    });

    const filteredRows = useMemo(() => {
      const needle = searchQuery.trim().toLowerCase();
      return rows.filter((row) => {
        const matchesSearch =
          !needle ||
          row.bid_number.toLowerCase().includes(needle) ||
          row.announcement_number.toLowerCase().includes(needle) ||
          row.supplier_name.toLowerCase().includes(needle);
        const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
        const matchesDate = !dateFrom || (row.date_apply && new Date(row.date_apply) >= new Date(dateFrom));
        return matchesSearch && matchesStatus && matchesDate;
      });
    }, [rows, searchQuery, statusFilter, dateFrom]);

    const sortedRows = useMemo(() => {
      return [...filteredRows].sort((left, right) => compareTableValues(left[sortKey], right[sortKey], sortDirection));
    }, [filteredRows, sortDirection, sortKey]);

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
    const pagedRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSort = (key) => {
      setPage(1);
      setSortKey((currentKey) => {
        if (currentKey === key) {
          setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
          return currentKey;
        }
        setSortDirection('asc');
        return key;
      });
    };

    useEffect(() => {
      if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    return (
      <div data-testid="applications-tab" className="space-y-6">
        <InfoCard title={`Заявки (${trd_apps.length})`}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_auto] gap-3">
              <SearchInput
                placeholder="Поиск по номеру заявки, объявлению или поставщику..."
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
                <option value="all">Все статусы</option>
                <option value="Подана">Подана</option>
                <option value="Отклонена">Отклонена</option>
                <option value="Победила">Победила</option>
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
              <PrimaryButton onClick={() => { setSearchQuery(''); setStatusFilter('all'); setDateFrom(''); setPage(1); }}>Сбросить</PrimaryButton>
            </div>

            <DataTable
              columns={[
                { header: 'Номер заявки', key: 'bid_number', sortable: true },
                { header: 'Объявление', key: 'announcement_number', sortable: true },
                { header: 'Поставщик', key: 'supplier_name', sortable: true },
                { header: 'Цена предложения', key: 'offered_amount', sortable: true, render: (row) => formatCurrency(row.offered_amount) },
                { header: 'Дата подачи', key: 'date_apply', sortable: true, render: (row) => formatDateTime(row.date_apply) },
                {
                  header: 'Статус',
                  key: 'status',
                  sortable: true,
                  render: (row) => (
                    <InlineStatusBadge
                      label={row.status}
                      tone={row.status === 'Победила' ? 'emerald' : row.status === 'Подана' ? 'amber' : 'red'}
                    />
                  ),
                },
                { header: 'Место', key: 'place', sortable: true, render: (row) => row.place || '—' },
                { header: 'Итог', key: 'result', sortable: true },
              ]}
              data={pagedRows}
              onRowClick={(row) => navigate(`/bids/${encodeURIComponent(row.id)}`)}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />

            <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </InfoCard>
      </div>
    );
  };

  const LotsTab = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [sortKey, setSortKey] = useState('amount_value');
    const [sortDirection, setSortDirection] = useState('desc');
    const PAGE_SIZE = 6;
    const buyById = Object.fromEntries(trd_buys.map((announcement) => [announcement.id, announcement]));
    const contractByBuyId = Object.fromEntries(contracts.map((contract) => [contract.trd_buy_id, contract]));
    const contractUnitByLotId = Object.fromEntries(contract_units.map((unit) => [unit.lot_id, unit]));
    const rows = trd_apps.flatMap((application) =>
      application.app_lots.map((lot) => {
        const announcement = buyById[application.buy_id];
        const contract = contractByBuyId[application.buy_id];
        const unit = contractUnitByLotId[lot.lot_id];
        return {
          ...lot,
          announcement_number: announcement?.number_anno || 'Не указано',
          category: lot.category || 'Не указано',
          amount_value: Number(unit?.total_sum_wnds || lot.amount || 0),
          winner_name: lot.winner_name || (contract ? company.name_ru : 'Не определен'),
          contract_number: contract?.contract_number || 'Нет договора',
          status_label: getLotStatusLabel(lot.ref_lot_status_id),
        };
      })
    );

    const filteredRows = useMemo(() => {
      const needle = searchQuery.trim().toLowerCase();
      return rows.filter((row) => {
        const matchesSearch =
          !needle ||
          row.lot_number.toLowerCase().includes(needle) ||
          row.name_ru.toLowerCase().includes(needle) ||
          row.announcement_number.toLowerCase().includes(needle);
        const matchesStatus = statusFilter === 'all' || String(row.ref_lot_status_id) === statusFilter;
        const matchesCategory = categoryFilter === 'all' || row.category === categoryFilter;
        return matchesSearch && matchesStatus && matchesCategory;
      });
    }, [rows, searchQuery, statusFilter, categoryFilter]);

    const sortedRows = useMemo(() => {
      return [...filteredRows].sort((left, right) => compareTableValues(left[sortKey], right[sortKey], sortDirection));
    }, [filteredRows, sortDirection, sortKey]);

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
    const pagedRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSort = (key) => {
      setPage(1);
      setSortKey((currentKey) => {
        if (currentKey === key) {
          setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
          return currentKey;
        }
        setSortDirection('asc');
        return key;
      });
    };

    useEffect(() => {
      if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    return (
      <div data-testid="lots-tab" className="space-y-6">
        <InfoCard title={`Лоты (${rows.length})`}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_auto] gap-3">
              <SearchInput
                placeholder="Поиск по номеру лота, объявлению или наименованию..."
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(1);
                }}
              />
              <select
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
              >
                <option value="all">Все категории</option>
                <option value="Не указано">Не указано</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
              >
                <option value="all">Все статусы</option>
                <option value="310">Прием заявок</option>
                <option value="320">Итоги подведены</option>
              </select>
              <PrimaryButton onClick={() => { setSearchQuery(''); setCategoryFilter('all'); setStatusFilter('all'); setPage(1); }}>Сбросить</PrimaryButton>
            </div>

            <DataTable
              columns={[
                { header: 'Номер лота', key: 'lot_number', sortable: true },
                { header: 'Объявление', key: 'announcement_number', sortable: true },
                { header: 'Наименование', key: 'name_ru', sortable: true },
                { header: 'Категория', key: 'category', sortable: true },
                { header: 'Сумма', key: 'amount_value', sortable: true, render: (row) => formatCurrency(row.amount_value) },
                { header: 'Количество', key: 'quantity', sortable: true },
                {
                  header: 'Статус',
                  key: 'status_label',
                  sortable: true,
                  render: (row) => (
                    <InlineStatusBadge
                      label={row.status_label}
                      tone={row.ref_lot_status_id === 320 ? 'emerald' : 'amber'}
                    />
                  ),
                },
                { header: 'Связанный договор', key: 'contract_number', sortable: true },
                { header: 'Победитель', key: 'winner_name', sortable: true },
              ]}
              data={pagedRows}
              onRowClick={(row) => navigate(`/lots/${row.lot_id}`)}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />

            <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </InfoCard>
      </div>
    );
  };

  const ContractsTab = () => (
    <div data-testid="contracts-tab" className="space-y-6">
      <InfoCard title={`Договоры (${contracts.length})`}>
        <DataTable
          columns={[
            { header: 'Системный №', key: 'contract_number_sys' },
            { header: 'Номер договора', key: 'contract_number' },
            { header: 'Объявление', key: 'trd_buy_number_anno' },
            { header: 'Заказчик', key: 'customer_name_ru' },
            { header: 'Дата заключения', key: 'crdate', render: (row) => formatDate(row.crdate) },
            { header: 'Сумма', key: 'contract_sum_wnds', render: (row) => formatCurrency(row.contract_sum_wnds || row.contract_sum) },
            { header: 'Статус', key: 'ref_contract_status_id', render: (row) => getContractStatusLabel(row.ref_contract_status_id) },
            {
              header: 'Подробнее',
              key: 'details',
              render: (row) => (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/contracts/${row.id}`);
                  }}
                  className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Подробнее
                </button>
              ),
            },
          ]}
          data={contracts}
          onRowClick={(row) => navigate(`/contracts/${row.id}`)}
        />
      </InfoCard>
    </div>
  );

  const ActsTab = () => (
    <div data-testid="acts-tab" className="space-y-6">
      <InfoCard title={`Электронные акты (${acts.length})`}>
        <DataTable
          columns={[
            { header: 'Номер акта', key: 'number_act' },
            { header: 'Дата акта', key: 'akt_date', render: (row) => formatDate(row.akt_date) },
            { header: 'Статус', key: 'status_name_ru', render: (row) => row.status_name_ru || `Статус #${row.status_id}` },
            { header: 'Просрочка', key: 'day_overdue', render: (row) => row.day_overdue || 0 },
            { header: 'Штраф', key: 'sum_fine', render: (row) => formatCurrency(row.sum_fine || 0) },
            { header: 'К перечислению', key: 'sum_transfer', render: (row) => formatCurrency(row.sum_transfer || 0) },
          ]}
          data={acts}
        />
      </InfoCard>
    </div>
  );

  const RnuTab = () => (
    <div data-testid="rnu-tab" className="space-y-6">
      <InfoCard title="Реестр недобросовестных поставщиков">
        {rnu_entries.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full mb-3">
              <ShieldAlert className="w-6 h-6 text-emerald-600" strokeWidth={1.5} />
            </div>
            <p className="text-slate-900 font-medium">Активных записей в РНУ не найдено</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rnu_entries.map((entry) => (
              <SectionCard key={entry.id} className="border-l-4 border-red-500">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-medium text-slate-900">{entry.supplier_name_ru}</p>
                    <p className="text-xs text-slate-500 font-mono">БИН: {entry.supplier_biin}</p>
                  </div>
                  <RegistryBadge isBlacklisted />
                </div>
                <div className="grid md:grid-cols-2 gap-3 text-sm text-slate-700">
                  <p>Дата включения: {formatDate(entry.start_date)}</p>
                  <p>Причина включения: {entry.ref_reason_id ? `Причина #${entry.ref_reason_id}` : 'Не указана'}</p>
                  <p>Заказчик: {entry.customer_name_ru || 'Не указан'}</p>
                  <p>Судебное основание: {entry.court_decision || 'Не указано'}</p>
                </div>
              </SectionCard>
            ))}
          </div>
        )}
      </InfoCard>
    </div>
  );

  const ComplaintsTab = () => (
    <div data-testid="complaints-tab" className="space-y-6">
      <InfoCard title={`Жалобы (${complaints.length})`}>
        {complaints.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full mb-3">
              <MessageSquareWarning className="w-6 h-6 text-emerald-600" strokeWidth={1.5} />
            </div>
            <p className="text-slate-900 font-medium">Связанных жалоб не найдено</p>
            <p className="text-sm text-slate-500 mt-2">По текущему участнику в локальной базе нет зарегистрированных обращений.</p>
          </div>
        ) : (
          <DataTable
            columns={[
              { header: 'Номер жалобы', key: 'complaint_number' },
              { header: 'Дата', key: 'date', render: (row) => formatDateTime(row.date) },
              { header: 'Статус', key: 'status', render: (row) => <ComplaintStatusBadge status={row.status} /> },
              { header: 'Предмет', key: 'subject' },
              { header: 'Решение', key: 'decision', render: (row) => row.decision || 'Решение не опубликовано' },
              {
                header: 'Связь',
                key: 'related_tender_id',
                render: (row) => (
                  <div className="text-xs text-slate-600 space-y-1">
                    <p>Тендер: {row.related_tender_id || '—'}</p>
                    <p>Договор: {row.related_contract_id || '—'}</p>
                  </div>
                ),
              },
            ]}
            data={complaints}
          />
        )}
      </InfoCard>
    </div>
  );

  const RiskTab = () => (
    <div data-testid="risk-tab" className="space-y-6">
      {supplierAnalytics && (
        <div className="space-y-6">
          <InfoCard title="Supplier Trust Score">
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                Оценка надежности поставщика на основе участия в закупках, побед, исполнения договоров, качества исполнения, жалоб и рисков.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <SectionCard className="p-6">
                  <div className="flex items-center justify-center py-4">
                    <div className="relative w-48 h-48">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="96" cy="96" r="80" stroke="#E5E7EB" strokeWidth="16" fill="none" />
                        <circle
                          cx="96"
                          cy="96"
                          r="80"
                          stroke={getCircularScoreColor(supplierAnalytics.score)}
                          strokeWidth="16"
                          fill="none"
                          strokeDasharray={`${(supplierAnalytics.score / 100) * 502} 502`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-bold text-slate-900">{supplierAnalytics.score}</span>
                        <span className="text-xs text-slate-500">из 100</span>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard className="p-6">
                  <div className="flex h-full flex-col items-center justify-center gap-4">
                    <RiskBadge level={supplierAnalytics.risk_level} label={supplierAnalytics.risk_label} className="text-lg px-6 py-3" />
                    <p className="text-sm text-center text-slate-600">
                      {supplierAnalytics.assessment?.headline || 'Оценка сформирована по данным договоров, актов, жалоб и РНУ.'}
                    </p>
                  </div>
                </SectionCard>
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Как рассчитана оценка поставщика">
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <SectionCard className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Активные записи РНУ</p>
                  <p className="text-lg font-semibold text-slate-900">{riskAssessment.active_rnu_entries ?? 0}</p>
                </SectionCard>
                <SectionCard className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Расторгнутые договоры</p>
                  <p className="text-lg font-semibold text-slate-900">{riskAssessment.terminated_contracts ?? 0}</p>
                </SectionCard>
                <SectionCard className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Акты с просрочкой/штрафом</p>
                  <p className="text-lg font-semibold text-slate-900">{riskAssessment.overdue_acts ?? 0}</p>
                </SectionCard>
                <SectionCard className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Исполненные договоры</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {riskAssessment.completed_contracts ?? 0}/{riskAssessment.total_contracts ?? 0}
                  </p>
                </SectionCard>
                <SectionCard className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Подтвержденные жалобы</p>
                  <p className="text-lg font-semibold text-slate-900">{riskAssessment.satisfied_complaints ?? 0}</p>
                </SectionCard>
                <SectionCard className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Жалобы по договору</p>
                  <p className="text-lg font-semibold text-slate-900">{riskAssessment.contract_related_complaints ?? 0}</p>
                </SectionCard>
                <SectionCard className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Суммарная просрочка</p>
                  <p className="text-lg font-semibold text-slate-900">{riskAssessment.overdue_days ?? 0} дн.</p>
                </SectionCard>
                <SectionCard className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Штрафы по актам</p>
                  <p className="text-lg font-semibold text-slate-900">{formatCurrency(riskAssessment.fine_sum ?? 0)}</p>
                </SectionCard>
                <SectionCard className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Сумма договоров</p>
                  <p className="text-lg font-semibold text-slate-900">{formatCurrency(riskAssessment.contract_value ?? 0)}</p>
                </SectionCard>
                <SectionCard className="p-4">
                  <p className="text-xs text-slate-500 mb-1">Стаж участника</p>
                  <p className="text-lg font-semibold text-slate-900">{riskAssessment.years_active ?? 0} лет</p>
                </SectionCard>
              </div>

              <div className="space-y-2">
                {(riskAssessment.factors || []).map((factor, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="w-2 h-2 rounded-full bg-slate-400 mt-2"></div>
                    <p className="text-sm text-slate-700">{factor}</p>
                  </div>
                ))}
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Риск-индикаторы поставщика">
            <div className="space-y-4">
              {risk_indicators.map((indicator, idx) => (
                <SectionCard
                  key={idx}
                  className={`border-l-4 ${
                    indicator.level === 'high'
                      ? 'border-red-500'
                      : indicator.level === 'medium'
                      ? 'border-amber-500'
                      : 'border-emerald-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-slate-900">{indicator.category}</h4>
                    <RiskBadge level={indicator.level} />
                  </div>
                  <p className="text-sm text-slate-700 mb-2">{indicator.description}</p>
                  <p className="text-xs text-slate-500">Влияние: {indicator.impact}</p>
                </SectionCard>
              ))}
            </div>
          </InfoCard>
        </div>
      )}

      {customerAnalytics && (
        <div className="space-y-6">
          <InfoCard title="Customer Transparency Score">
            <div className="space-y-4">
              <p className="text-sm text-slate-700">{customerAnalytics.explanation}</p>
              <div className="grid md:grid-cols-2 gap-6">
                <SectionCard className="p-6">
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <p className="text-sm font-medium text-slate-500">Customer Transparency Score: {customerAnalytics.score} / 100</p>
                    <p className="text-5xl font-bold text-slate-900">{customerAnalytics.score}</p>
                    <InlineStatusBadge label={customerAnalytics.bucket?.label || 'Не указано'} tone={getTransparencyTone(customerAnalytics.bucket?.level)} />
                  </div>
                </SectionCard>

                <SectionCard className="p-6">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">Закупочная активность</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                      <div>
                        <p className="text-xs text-slate-500">Объявления</p>
                        <p className="mt-1 font-semibold text-slate-900">{customerAnalytics.summary?.announcements ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Заявки участников</p>
                        <p className="mt-1 font-semibold text-slate-900">{customerAnalytics.summary?.applications ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Договоры</p>
                        <p className="mt-1 font-semibold text-slate-900">{customerAnalytics.summary?.contracts ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Жалобы</p>
                        <p className="mt-1 font-semibold text-slate-900">{customerAnalytics.summary?.complaints ?? 0}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600">{customerAnalytics.headline}</p>
                  </div>
                </SectionCard>
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Показатели закупочной деятельности">
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Object.values(customerAnalytics.metrics || {}).map((metric) => (
                <SectionCard key={metric.label} className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{metric.label}</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">{metric.display_value}</p>
                  {metric.suffix ? <p className="mt-1 text-sm text-slate-500">{metric.suffix}</p> : null}
                  <p className="mt-3 text-sm text-slate-600">{metric.description}</p>
                </SectionCard>
              ))}
            </div>
          </InfoCard>

          <InfoCard title="Аналитическая сводка заказчика">
            <div className="space-y-3">
              {(customerAnalytics.flags || []).map((flag, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="w-2 h-2 rounded-full bg-slate-400 mt-2"></div>
                  <p className="text-sm text-slate-700">{flag}</p>
                </div>
              ))}
            </div>
          </InfoCard>
        </div>
      )}

      {organizerAnalytics && (
        <InfoCard title={organizerAnalytics.title || 'Роль организатора'}>
          <div className="space-y-3">
            <p className="text-sm text-slate-700">{organizerAnalytics.description}</p>
            <SectionCard className="p-4">
              <p className="text-xs text-slate-500 mb-1">Организованные процедуры</p>
              <p className="text-lg font-semibold text-slate-900">{organizerAnalytics.organized_announcements ?? 0}</p>
            </SectionCard>
          </div>
        </InfoCard>
      )}

      {!supplierAnalytics && !customerAnalytics && !organizerAnalytics && (
        <InfoCard title="Аналитика участника">
          <p className="text-sm text-slate-600">Для участника не удалось определить роль или собрать достаточный объем данных для аналитики.</p>
        </InfoCard>
      )}
    </div>
  );

  const tabs = [
    { value: 'overview', label: 'Обзор', icon: <Building2 className="w-4 h-4" strokeWidth={1.5} />, content: <OverviewTab /> },
    { value: 'subject', label: 'Участник', icon: <Building2 className="w-4 h-4" strokeWidth={1.5} />, content: <SubjectTab /> },
    { value: 'announcements', label: 'Объявления', icon: <FileText className="w-4 h-4" strokeWidth={1.5} />, content: <AnnouncementsTab /> },
    { value: 'applications', label: 'Заявки', icon: <Receipt className="w-4 h-4" strokeWidth={1.5} />, content: <ApplicationsTab /> },
    { value: 'lots', label: 'Лоты', icon: <Receipt className="w-4 h-4" strokeWidth={1.5} />, content: <LotsTab /> },
    { value: 'contracts', label: 'Договоры', icon: <FileCheck className="w-4 h-4" strokeWidth={1.5} />, content: <ContractsTab /> },
    { value: 'acts', label: 'Акты', icon: <FileCheck className="w-4 h-4" strokeWidth={1.5} />, content: <ActsTab /> },
    { value: 'complaints', label: 'Жалобы', icon: <MessageSquareWarning className="w-4 h-4" strokeWidth={1.5} />, content: <ComplaintsTab /> },
    { value: 'rnu', label: 'РНУ', icon: <ShieldAlert className="w-4 h-4" strokeWidth={1.5} />, content: <RnuTab /> },
    { value: 'risk', label: 'Аналитика', icon: <TrendingUp className="w-4 h-4" strokeWidth={1.5} />, content: <RiskTab /> },
  ];

  return (
    <PageContainer>
      <div data-testid="supplier-profile-page" className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl font-semibold text-slate-900">{subject.name_ru}</h1>
                <RegistryBadge isBlacklisted={company.is_blacklisted} />
              </div>
              <p className="text-sm text-slate-500 mb-3">{subject.full_name_kz}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-slate-500">БИН: {subject.bin}</span>
                <span className="text-slate-300">|</span>
                <span className="text-xs text-slate-500">PID: {subject.pid}</span>
                <span className="text-slate-300">|</span>
                {company.roles.map((role, idx) => (
                  <RoleBadge key={idx} role={role} />
                ))}
              </div>
            </div>
            <SecondaryButton onClick={() => navigate(-1)} data-testid="back-button">
              <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Назад
            </SecondaryButton>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">{primaryScoreLabel}</p>
              <p className="text-lg font-semibold text-slate-900">{primaryScoreDisplay}</p>
            </div>
            <div className="text-center border-l border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Тип участника</p>
              <p className="text-sm font-medium text-slate-900">{getTypeSupplierLabel(subject.type_supplier)}</p>
            </div>
            <div className="text-center border-l border-slate-200">
              <p className="text-xs text-slate-500 mb-1">
                {primaryRole === 'customer' ? 'Уровень прозрачности' : primaryRole === 'organizer' ? 'Роль в системе' : 'Статус риска'}
              </p>
              {primaryRole === 'customer' ? (
                <InlineStatusBadge
                  label={primaryStatusLabel}
                  tone={getTransparencyTone(customerAnalytics?.bucket?.level)}
                />
              ) : primaryRole === 'organizer' ? (
                <InlineStatusBadge label={primaryStatusLabel} tone="blue" />
              ) : (
                <RiskBadge level={company.risk_level} label={company.risk_label} />
              )}
            </div>
          </div>
        </div>

        <ContentSwitcher tabs={tabs} defaultTab={requestedTab} />
      </div>
    </PageContainer>
  );
}
