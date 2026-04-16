import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContentSwitcher } from '@/components/shared/ContentSwitcher';
import { InfoCard, MetricCard, SectionCard } from '@/components/shared/Cards';
import { RoleBadge, RegistryBadge, RiskBadge, StatusBadge } from '@/components/shared/Badges';
import { SecondaryButton } from '@/components/shared/Buttons';
import { DataTable } from '@/components/shared/DataTable';
import { companiesAPI } from '@/utils/api';
import { addSearchHistoryEntry } from '@/utils/auth';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Building2,
  FileText,
  AlertTriangle,
  TrendingUp,
  Calendar,
  ShieldAlert,
  Network,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

  const { company, summary, tenders, contracts, complaints, registries, risk_indicators } = profile;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('ru-RU').format(value) + ' ₸';
  };

  const OverviewTab = () => (
    <div data-testid="overview-tab" className="space-y-6">
      <div className="bento-grid">
        <MetricCard
          label="Всего контрактов"
          value={summary.total_contracts}
          icon={<FileText className="w-5 h-5" strokeWidth={1.5} />}
        />
        <MetricCard
          label="Общая стоимость"
          value={formatCurrency(summary.total_value)}
          icon={<TengeIcon className="w-5 h-5 text-slate-400" />}
        />
        <MetricCard
          label="Активные контракты"
          value={summary.active_contracts}
          icon={<TrendingUp className="w-5 h-5" strokeWidth={1.5} />}
        />
        <MetricCard
          label="Лет на рынке"
          value={summary.years_active}
          icon={<Calendar className="w-5 h-5" strokeWidth={1.5} />}
        />
      </div>

      <InfoCard title="AI Анализ">
        <div className="prose prose-sm max-w-none text-slate-700">
          <p>
            Компания <strong>{company.name_ru}</strong> является {company.is_blacklisted ? 'недобросовестным' : 'надежным'} участником государственных закупок с {summary.years_active}-летним опытом работы.
          </p>
          <p>
            Общий объем выполненных контрактов составляет {formatCurrency(summary.total_value)}. Средняя стоимость контракта: {formatCurrency(summary.average_contract_value)}.
          </p>
          {company.is_blacklisted && (
            <p className="text-red-600 font-medium">
              ⚠️ Компания находится в реестре недобросовестных поставщиков. Рекомендуется провести дополнительную проверку перед сотрудничеством.
            </p>
          )}
        </div>
      </InfoCard>
    </div>
  );

  const CompanyInfoTab = () => (
    <div data-testid="company-info-tab" className="space-y-6">
      <InfoCard title="Основная информация">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs font-medium text-slate-500">БИН</dt>
            <dd className="mt-1 text-sm font-mono text-slate-900">{company.bin}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Название (РУ)</dt>
            <dd className="mt-1 text-sm text-slate-900">{company.name_ru}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Название (КЗ)</dt>
            <dd className="mt-1 text-sm text-slate-900">{company.name_kz || 'Не указано'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Роли</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {company.roles.map((role, idx) => (
                <RoleBadge key={idx} role={role} />
              ))}
            </dd>
          </div>
        </dl>
      </InfoCard>
    </div>
  );

  const TendersTab = () => (
    <div data-testid="tenders-tab" className="space-y-6">
      <InfoCard title={`История тендеров (${tenders.length})`}>
        <DataTable
          columns={[
            { header: '№', key: 'number' },
            { header: 'Название', key: 'name_ru' },
            { header: 'Заказчик', key: 'customer' },
            { header: 'Сумма', key: 'amount', render: (row) => formatCurrency(row.amount) },
            { header: 'Дата', key: 'date' },
            { header: 'Статус', key: 'status', render: (row) => <StatusBadge status={row.status} /> },
          ]}
          data={tenders}
        />
      </InfoCard>
    </div>
  );

  const ContractsTab = () => (
    <div data-testid="contracts-tab" className="space-y-6">
      <InfoCard title={`Контракты (${contracts.length})`}>
        <DataTable
          columns={[
            { header: '№', key: 'number' },
            { header: 'Название', key: 'name_ru' },
            { header: 'Заказчик', key: 'customer' },
            { header: 'Сумма', key: 'amount', render: (row) => formatCurrency(row.amount) },
            { header: 'Дата подписания', key: 'sign_date' },
            {
              header: 'Выполнение',
              key: 'execution_percent',
              render: (row) => (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${row.execution_percent}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium">{row.execution_percent}%</span>
                </div>
              ),
            },
          ]}
          data={contracts}
        />
      </InfoCard>
    </div>
  );

  const ComplaintsTab = () => (
    <div data-testid="complaints-tab" className="space-y-6">
      <InfoCard title={`Жалобы (${complaints.length})`}>
        {complaints.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Жалоб не найдено</p>
        ) : (
          <div className="space-y-4">
            {complaints.map((complaint) => (
              <SectionCard key={complaint.id} className="hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-slate-900">{complaint.number}</p>
                    <p className="text-xs text-slate-500">{complaint.date}</p>
                  </div>
                  <StatusBadge status={complaint.status} />
                </div>
                <p className="text-sm text-slate-700 mb-2">{complaint.description}</p>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">Заявитель:</span>
                    <span className="ml-2 text-slate-900">{complaint.complainant}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Решение:</span>
                    <span className="ml-2 text-slate-900">{complaint.decision}</span>
                  </div>
                </div>
              </SectionCard>
            ))}
          </div>
        )}
      </InfoCard>
    </div>
  );

  const RegistriesTab = () => (
    <div data-testid="registries-tab" className="space-y-6">
      <InfoCard title="Статус в реестрах">
        {registries.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full mb-3">
              <ShieldAlert className="w-6 h-6 text-emerald-600" strokeWidth={1.5} />
            </div>
            <p className="text-slate-900 font-medium">Компания не числится в реестре недобросовестных</p>
            <p className="text-xs text-slate-500 mt-1">Проверено: {new Date().toLocaleDateString('ru-RU')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {registries.map((registry, idx) => (
              <SectionCard key={idx} className="border-l-4 border-red-500">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-slate-900">{registry.registry_type}</p>
                    <StatusBadge status={registry.status} className="mt-1" />
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-500">Причина:</span>
                    <span className="ml-2 text-slate-900">{registry.reason}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Дата включения:</span>
                    <span className="ml-2 text-slate-900">{registry.inclusion_date}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Источник:</span>
                    <span className="ml-2 text-slate-900">{registry.source}</span>
                  </div>
                </div>
              </SectionCard>
            ))}
          </div>
        )}
      </InfoCard>
    </div>
  );

  const RiskTab = () => {
    const riskAssessment = summary?.risk_assessment || {};
    const riskFactors = riskAssessment?.factors || [];

    return (
      <div data-testid="risk-tab" className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <InfoCard title="Уровень доверия">
            <div className="flex items-center justify-center py-8">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="#E5E7EB"
                    strokeWidth="16"
                    fill="none"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke={
                      company.trust_score >= 70
                        ? '#10B981'
                        : company.trust_score >= 40
                        ? '#F59E0B'
                        : '#EF4444'
                    }
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
              <div>
                <RiskBadge level={company.risk_level} className="text-lg px-6 py-3" />
              </div>
            </div>
          </InfoCard>
        </div>

        <InfoCard title="Как рассчитана оценка">
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              {riskAssessment.headline || 'Оценка риска сформирована автоматически на основе истории компании.'}
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <SectionCard className="p-4">
                <p className="text-xs text-slate-500 mb-1">Жалобы</p>
                <p className="text-lg font-semibold text-slate-900">{riskAssessment.complaints ?? complaints.length}</p>
              </SectionCard>
              <SectionCard className="p-4">
                <p className="text-xs text-slate-500 mb-1">Удовлетворенные жалобы</p>
                <p className="text-lg font-semibold text-slate-900">{riskAssessment.upheld_complaints ?? 0}</p>
              </SectionCard>
              <SectionCard className="p-4">
                <p className="text-xs text-slate-500 mb-1">Расторгнутые договоры</p>
                <p className="text-lg font-semibold text-slate-900">{riskAssessment.terminated_contracts ?? 0}</p>
              </SectionCard>
              <SectionCard className="p-4">
                <p className="text-xs text-slate-500 mb-1">Активные записи в РНУ</p>
                <p className="text-lg font-semibold text-slate-900">{riskAssessment.active_registries ?? 0}</p>
              </SectionCard>
            </div>

            <div className="space-y-2">
              {riskFactors.map((factor, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200"
                >
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
  };

  const tabs = [
    { value: 'overview', label: 'Обзор', icon: <Building2 className="w-4 h-4" strokeWidth={1.5} />, content: <OverviewTab /> },
    { value: 'info', label: 'Информация', icon: <FileText className="w-4 h-4" strokeWidth={1.5} />, content: <CompanyInfoTab /> },
    { value: 'tenders', label: 'Тендеры', icon: <FileText className="w-4 h-4" strokeWidth={1.5} />, content: <TendersTab /> },
    { value: 'contracts', label: 'Контракты', icon: <FileText className="w-4 h-4" strokeWidth={1.5} />, content: <ContractsTab /> },
    { value: 'complaints', label: 'Жалобы', icon: <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />, content: <ComplaintsTab /> },
    { value: 'registries', label: 'Реестры', icon: <ShieldAlert className="w-4 h-4" strokeWidth={1.5} />, content: <RegistriesTab /> },
    { value: 'risk', label: 'Риск-анализ', icon: <TrendingUp className="w-4 h-4" strokeWidth={1.5} />, content: <RiskTab /> },
  ];

  return (
    <PageContainer>
      <div data-testid="supplier-profile-page" className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-semibold text-slate-900">{company.name_ru}</h1>
                <RegistryBadge isBlacklisted={company.is_blacklisted} />
              </div>
              <p className="text-sm text-slate-500 mb-3">{company.name_kz}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500">БИН: {company.bin}</span>
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
              <div className="flex items-center justify-center gap-2">
                <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      company.trust_score >= 70
                        ? 'bg-emerald-500'
                        : company.trust_score >= 40
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${company.trust_score}%` }}
                  />
                </div>
                <span className="text-lg font-semibold text-slate-900">{company.trust_score}</span>
              </div>
            </div>
            <div className="text-center border-l border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Уровень риска</p>
              <RiskBadge level={company.risk_level} />
            </div>
            <div className="text-center border-l border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Статус</p>
              <p className="text-sm font-medium text-slate-900">
                {company.is_blacklisted ? 'Недобросовестный' : 'Чист'}
              </p>
            </div>
          </div>
        </div>

        <ContentSwitcher tabs={tabs} defaultTab="overview" />
      </div>
    </PageContainer>
  );
}
