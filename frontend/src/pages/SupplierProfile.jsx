import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { ContentSwitcher } from '@/components/shared/ContentSwitcher';
import { InfoCard, MetricCard, SectionCard } from '@/components/shared/Cards';
import { RegistryBadge, RiskBadge, RoleBadge } from '@/components/shared/Badges';
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
  getEmployeeRoleLabel,
  getTradeMethodLabel,
  getTypeSupplierLabel,
} from '@/utils/ows';
import { toast } from 'sonner';
import { ArrowLeft, Building2, MapPin, Users, FileText, Receipt, ShieldAlert, TrendingUp, FileCheck } from 'lucide-react';

const TengeIcon = ({ className = '' }) => (
  <span className={`inline-flex items-center justify-center text-lg font-semibold leading-none ${className}`}>
    ₸
  </span>
);

export default function SupplierProfile() {
  const { bin } = useParams();
  const navigate = useNavigate();
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
    rnu_entries,
    risk_indicators,
  } = profile;

  const riskAssessment = summary?.risk_assessment || {};

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
            договоров: <strong>{contracts.length}</strong>, электронных актов: <strong>{acts.length}</strong>.
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
      </InfoCard>
    </div>
  );

  const AddressesTab = () => (
    <div data-testid="addresses-tab" className="space-y-6">
      <InfoCard title={`Адреса участника (${subject_addresses.length})`}>
        <div className="space-y-4">
          {subject_addresses.map((address) => (
            <SectionCard key={address.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="font-medium text-slate-900">{getAddressTypeLabel(address.address_type)}</p>
                  <p className="text-sm text-slate-700">{address.address}</p>
                  <p className="text-xs text-slate-500">КАТО: {address.kato_code || 'Не указано'}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{address.phone || 'Телефон не указан'}</p>
                  <p className="mt-1">Обновлено: {formatDate(address.edit_date)}</p>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      </InfoCard>
    </div>
  );

  const EmployeesTab = () => (
    <div data-testid="employees-tab" className="space-y-6">
      <InfoCard title={`Сотрудники (${subject_employees.length})`}>
        <DataTable
          columns={[
            { header: 'ФИО', key: 'fio' },
            { header: 'ИИН', key: 'iin', render: (row) => <span className="font-mono text-xs">{row.iin}</span> },
            { header: 'Роль', key: 'role', render: (row) => getEmployeeRoleLabel(row.role) },
            { header: 'Sys Role', key: 'sys_role_id' },
            { header: 'Дата начала', key: 'start_date', render: (row) => formatDate(row.start_date) },
            { header: 'Статус', key: 'disabled', render: (row) => (row.disabled ? 'Заблокирован' : 'Активен') },
          ]}
          data={subject_employees}
        />
      </InfoCard>
    </div>
  );

  const AnnouncementsTab = () => (
    <div data-testid="announcements-tab" className="space-y-6">
      <InfoCard title={`Объявления (${trd_buys.length})`}>
        <DataTable
          columns={[
            { header: '№ объявления', key: 'number_anno' },
            { header: 'Наименование', key: 'name_ru' },
            { header: 'Заказчик', key: 'customer_name_ru' },
            { header: 'Способ', key: 'ref_trade_methods_id', render: (row) => getTradeMethodLabel(row.ref_trade_methods_id) },
            { header: 'Сумма', key: 'total_sum', render: (row) => formatCurrency(row.total_sum) },
            { header: 'Статус', key: 'ref_buy_status_id', render: (row) => getBuyStatusLabel(row.ref_buy_status_id) },
          ]}
          data={trd_buys}
        />
      </InfoCard>
    </div>
  );

  const ApplicationsTab = () => (
    <div data-testid="applications-tab" className="space-y-6">
      <InfoCard title={`Заявки поставщика (${trd_apps.length})`}>
        <DataTable
          columns={[
            { header: 'ID заявки', key: 'id' },
            { header: 'ID закупки', key: 'buy_id' },
            { header: 'Протокол итогов', key: 'prot_number', render: (row) => row.prot_number || 'Не определен' },
            { header: 'Дата подачи', key: 'date_apply', render: (row) => formatDateTime(row.date_apply) },
            { header: 'Лотов', key: 'app_lots', render: (row) => row.app_lots.length },
            { header: 'Сумма предложения', key: 'offered_sum', render: (row) => formatCurrency(getApplicationAmount(row)) },
          ]}
          data={trd_apps}
        />
      </InfoCard>
    </div>
  );

  const ContractsTab = () => (
    <div data-testid="contracts-tab" className="space-y-6">
      <InfoCard title={`Договоры (${contracts.length})`}>
        <DataTable
          columns={[
            { header: 'Системный №', key: 'contract_number_sys' },
            { header: 'Номер договора', key: 'contract_number' },
            { header: 'Объявление', key: 'trd_buy_number_anno' },
            { header: 'Заказчик', key: 'customer_name_ru' },
            { header: 'Сумма', key: 'contract_sum_wnds', render: (row) => formatCurrency(row.contract_sum_wnds || row.contract_sum) },
            { header: 'Статус', key: 'ref_contract_status_id', render: (row) => getContractStatusLabel(row.ref_contract_status_id) },
          ]}
          data={contracts}
        />
      </InfoCard>

      <InfoCard title={`Предметы договора (${contract_units.length})`}>
        <DataTable
          columns={[
            { header: 'ID договора', key: 'contract_id' },
            { header: 'Предмет', key: 'name_ru', render: (row) => row.name_ru || 'Не указано' },
            { header: 'Количество', key: 'quantity' },
            { header: 'Сумма', key: 'total_sum_wnds', render: (row) => formatCurrency(row.total_sum_wnds) },
            { header: 'Факт оплаты', key: 'fact_sum_wnds', render: (row) => formatCurrency(row.fact_sum_wnds) },
            { header: 'Казсодержание', key: 'ks_proc', render: (row) => `${row.ks_proc}%` },
          ]}
          data={contract_units}
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

  const RiskTab = () => (
    <div data-testid="risk-tab" className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <InfoCard title="Уровень доверия">
          <div className="flex items-center justify-center py-8">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="96" cy="96" r="80" stroke="#E5E7EB" strokeWidth="16" fill="none" />
                <circle
                  cx="96"
                  cy="96"
                  r="80"
                  stroke={company.trust_score >= 70 ? '#10B981' : company.trust_score >= 40 ? '#F59E0B' : '#EF4444'}
                  strokeWidth="16"
                  fill="none"
                  strokeDasharray={`${(company.trust_score / 100) * 502} 502`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-slate-900">{company.trust_score}</span>
                <span className="text-xs text-slate-500">из 100</span>
              </div>
            </div>
          </div>
        </InfoCard>

        <InfoCard title="Уровень риска">
          <div className="flex items-center justify-center py-8">
            <RiskBadge level={company.risk_level} className="text-lg px-6 py-3" />
          </div>
        </InfoCard>
      </div>

      <InfoCard title="Как рассчитана оценка">
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            {riskAssessment.headline || 'Оценка сформирована по данным РНУ, договоров, актов и истории участия.'}
          </p>

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

      <InfoCard title="Риск-индикаторы">
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
  );

  const tabs = [
    { value: 'overview', label: 'Обзор', icon: <Building2 className="w-4 h-4" strokeWidth={1.5} />, content: <OverviewTab /> },
    { value: 'subject', label: 'Участник', icon: <Building2 className="w-4 h-4" strokeWidth={1.5} />, content: <SubjectTab /> },
    { value: 'addresses', label: 'Адреса', icon: <MapPin className="w-4 h-4" strokeWidth={1.5} />, content: <AddressesTab /> },
    { value: 'employees', label: 'Сотрудники', icon: <Users className="w-4 h-4" strokeWidth={1.5} />, content: <EmployeesTab /> },
    { value: 'announcements', label: 'Объявления', icon: <FileText className="w-4 h-4" strokeWidth={1.5} />, content: <AnnouncementsTab /> },
    { value: 'applications', label: 'Заявки', icon: <Receipt className="w-4 h-4" strokeWidth={1.5} />, content: <ApplicationsTab /> },
    { value: 'contracts', label: 'Договоры', icon: <FileCheck className="w-4 h-4" strokeWidth={1.5} />, content: <ContractsTab /> },
    { value: 'acts', label: 'Акты', icon: <FileCheck className="w-4 h-4" strokeWidth={1.5} />, content: <ActsTab /> },
    { value: 'rnu', label: 'РНУ', icon: <ShieldAlert className="w-4 h-4" strokeWidth={1.5} />, content: <RnuTab /> },
    { value: 'risk', label: 'Риск-анализ', icon: <TrendingUp className="w-4 h-4" strokeWidth={1.5} />, content: <RiskTab /> },
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
              <p className="text-xs text-slate-500 mb-1">Уровень доверия</p>
              <p className="text-lg font-semibold text-slate-900">{company.trust_score}/100</p>
            </div>
            <div className="text-center border-l border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Тип участника</p>
              <p className="text-sm font-medium text-slate-900">{getTypeSupplierLabel(subject.type_supplier)}</p>
            </div>
            <div className="text-center border-l border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Статус риска</p>
              <RiskBadge level={company.risk_level} />
            </div>
          </div>
        </div>

        <ContentSwitcher tabs={tabs} defaultTab="overview" />
      </div>
    </PageContainer>
  );
}
