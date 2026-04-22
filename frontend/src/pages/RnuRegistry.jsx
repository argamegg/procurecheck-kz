import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { DataTable } from '@/components/shared/DataTable';
import { MetricCard, InfoCard } from '@/components/shared/Cards';
import { PrimaryButton, SecondaryButton } from '@/components/shared/Buttons';
import { RegistryBadge, RiskBadge } from '@/components/shared/Badges';
import { companiesAPI } from '@/utils/api';
import { getTypeSupplierLabel } from '@/utils/ows';
import { toast } from 'sonner';
import { ArrowLeft, AlertTriangle, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react';

const FILTER_OPTIONS = [
  { value: 'all', label: 'Все записи' },
  { value: 'medium', label: 'Средний риск' },
  { value: 'high', label: 'Высокий риск' },
];

export default function RnuRegistry() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    loadRegistryCompanies();
  }, []);

  const loadRegistryCompanies = async () => {
    setLoading(true);
    try {
      const response = await companiesAPI.list({ is_blacklisted: true });
      setCompanies(response.data.companies || []);
    } catch (error) {
      toast.error('Не удалось загрузить РНУ');
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const matchesQuery =
        !searchQuery.trim() ||
        company.name_ru.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.full_name_ru?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.bin.includes(searchQuery);

      if (!matchesQuery) return false;
      if (activeFilter === 'all') return true;
      return company.risk_level === activeFilter;
    });
  }, [companies, searchQuery, activeFilter]);

  const stats = useMemo(() => {
    const highRisk = companies.filter((company) => company.risk_level === 'high').length;
    const mediumRisk = companies.filter((company) => company.risk_level === 'medium').length;
    const avgTrust = companies.length
      ? Math.round(companies.reduce((sum, company) => sum + company.trust_score, 0) / companies.length)
      : 0;

    return { highRisk, mediumRisk, avgTrust };
  }, [companies]);

  return (
    <PageContainer>
      <div data-testid="rnu-registry-page" className="space-y-8">
        <PageHeader
          title="Реестр недобросовестных поставщиков"
          subtitle={`Активные записи РНУ в локальной OWS-подобной базе: ${companies.length}`}
          actions={
            <SecondaryButton onClick={() => navigate('/')} data-testid="rnu-back-btn">
              <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Назад
            </SecondaryButton>
          }
        />

        <div className="bento-grid">
          <MetricCard label="Всего в РНУ" value={companies.length} icon={<ShieldAlert className="w-5 h-5" strokeWidth={1.5} />} trend="Компании с активной записью" />
          <MetricCard label="Высокий риск" value={stats.highRisk} icon={<AlertTriangle className="w-5 h-5" strokeWidth={1.5} />} trend="Критичные сигналы по профилю" />
          <MetricCard label="Средний риск" value={stats.mediumRisk} icon={<TrendingDown className="w-5 h-5" strokeWidth={1.5} />} trend="Нужна дополнительная проверка" />
          <MetricCard label="Среднее доверие" value={`${stats.avgTrust}/100`} icon={<TrendingUp className="w-5 h-5" strokeWidth={1.5} />} trend="Автоматический расчет по OWS-модели" />
        </div>

        <InfoCard title="Записи РНУ">
          <div className="space-y-5">
            <div className="flex flex-col md:flex-row gap-3">
              <SearchInput
                data-testid="rnu-search"
                placeholder="Поиск по БИН или наименованию..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <PrimaryButton onClick={loadRegistryCompanies} disabled={loading} data-testid="rnu-refresh-btn">
                {loading ? 'Обновление...' : 'Обновить'}
              </PrimaryButton>
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
                  className={
                    activeFilter === filter.value
                      ? 'px-3 py-2 rounded-md text-sm font-medium bg-red-600 text-white'
                      : 'px-3 py-2 rounded-md text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors'
                  }
                  data-testid={`rnu-filter-${filter.value}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <DataTable
              columns={[
                {
                  header: 'Поставщик',
                  key: 'name_ru',
                  render: (row) => (
                    <div>
                      <p className="font-medium text-slate-900">{row.name_ru}</p>
                      <p className="text-xs text-slate-500 font-mono mt-1">БИН: {row.bin}</p>
                    </div>
                  ),
                },
                {
                  header: 'PID / Тип',
                  key: 'pid',
                  render: (row) => (
                    <div>
                      <p className="text-sm text-slate-900">{row.pid || '—'}</p>
                      <p className="text-xs text-slate-500">{getTypeSupplierLabel(row.type_supplier)}</p>
                    </div>
                  ),
                },
                {
                  header: 'Статус',
                  key: 'is_blacklisted',
                  render: () => <RegistryBadge isBlacklisted />,
                },
                {
                  header: 'Доверие',
                  key: 'trust_score',
                  render: (row) => <span className="text-sm font-medium text-slate-700">{row.trust_score}/100</span>,
                },
                {
                  header: 'Риск',
                  key: 'risk_level',
                  render: (row) => <RiskBadge level={row.risk_level} />,
                },
              ]}
              data={filteredCompanies}
              onRowClick={(row) => navigate(`/supplier/${row.bin}`)}
            />
          </div>
        </InfoCard>
      </div>
    </PageContainer>
  );
}
