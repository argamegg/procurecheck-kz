import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { DataTable } from '@/components/shared/DataTable';
import { MetricCard, InfoCard } from '@/components/shared/Cards';
import { PrimaryButton, SecondaryButton } from '@/components/shared/Buttons';
import { RoleBadge, RegistryBadge, RiskBadge } from '@/components/shared/Badges';
import { companiesAPI } from '@/utils/api';
import { toast } from 'sonner';
import { ArrowLeft, Building2, AlertTriangle, ShieldCheck, TrendingUp } from 'lucide-react';

const FILTER_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'low', label: 'Низкий риск' },
  { value: 'medium', label: 'Средний риск' },
  { value: 'high', label: 'Высокий риск' },
  { value: 'blacklisted', label: 'РНУ' },
];

export default function CompaniesCatalog() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const response = await companiesAPI.list();
      setCompanies(response.data.companies || []);
    } catch (error) {
      toast.error('Не удалось загрузить каталог компаний');
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const matchesQuery =
        !searchQuery.trim() ||
        company.name_ru.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.name_kz?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.bin.includes(searchQuery);

      if (!matchesQuery) return false;

      if (activeFilter === 'blacklisted') return company.is_blacklisted;
      if (activeFilter === 'all') return true;

      return company.risk_level === activeFilter;
    });
  }, [companies, searchQuery, activeFilter]);

  const stats = useMemo(() => {
    const blacklisted = companies.filter((company) => company.is_blacklisted).length;
    const lowRisk = companies.filter((company) => company.risk_level === 'low').length;
    const mediumOrHigh = companies.filter((company) => company.risk_level !== 'low').length;
    const avgTrust = companies.length
      ? Math.round(companies.reduce((sum, company) => sum + company.trust_score, 0) / companies.length)
      : 0;

    return { blacklisted, lowRisk, mediumOrHigh, avgTrust };
  }, [companies]);

  const columns = [
    {
      header: 'Компания',
      key: 'name_ru',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.name_ru}</p>
          <p className="text-xs text-slate-500 font-mono mt-1">БИН: {row.bin}</p>
        </div>
      ),
    },
    {
      header: 'Роли',
      key: 'roles',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.map((role, idx) => (
            <RoleBadge key={idx} role={role} />
          ))}
        </div>
      ),
    },
    {
      header: 'Статус',
      key: 'is_blacklisted',
      render: (row) => row.is_blacklisted ? <RegistryBadge isBlacklisted /> : <span className="text-xs text-slate-500">Чист</span>,
    },
    {
      header: 'Доверие',
      key: 'trust_score',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={
                row.trust_score >= 70
                  ? 'h-full bg-emerald-500'
                  : row.trust_score >= 40
                  ? 'h-full bg-amber-500'
                  : 'h-full bg-red-500'
              }
              style={{ width: `${row.trust_score}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-700">{row.trust_score}</span>
        </div>
      ),
    },
    {
      header: 'Риск',
      key: 'risk_level',
      render: (row) => <RiskBadge level={row.risk_level} />,
    },
  ];

  return (
    <PageContainer>
      <div data-testid="companies-catalog-page" className="space-y-8">
        <PageHeader
          title="Все участники"
          subtitle={`Каталог компаний в локальной аналитической базе: ${companies.length}`}
          actions={
            <SecondaryButton onClick={() => navigate('/')} data-testid="companies-back-btn">
              <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Назад
            </SecondaryButton>
          }
        />

        <div className="bento-grid">
          <MetricCard
            label="Всего компаний"
            value={companies.length}
            icon={<Building2 className="w-5 h-5" strokeWidth={1.5} />}
            trend="Полный каталог участников"
          />
          <MetricCard
            label="Низкий риск"
            value={stats.lowRisk}
            icon={<ShieldCheck className="w-5 h-5" strokeWidth={1.5} />}
            trend="Компании со стабильным профилем"
          />
          <MetricCard
            label="Средний и высокий риск"
            value={stats.mediumOrHigh}
            icon={<AlertTriangle className="w-5 h-5" strokeWidth={1.5} />}
            trend="Требуют дополнительной проверки"
          />
          <MetricCard
            label="Средний уровень доверия"
            value={`${stats.avgTrust}/100`}
            icon={<TrendingUp className="w-5 h-5" strokeWidth={1.5} />}
            trend={`В РНУ: ${stats.blacklisted}`}
          />
        </div>

        <InfoCard title="Каталог участников">
          <div className="space-y-5">
            <div className="flex flex-col md:flex-row gap-3">
              <SearchInput
                data-testid="companies-catalog-search"
                placeholder="Поиск по БИН или названию компании..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <PrimaryButton onClick={loadCompanies} disabled={loading} data-testid="companies-refresh-btn">
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
                      ? 'px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white'
                      : 'px-3 py-2 rounded-md text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors'
                  }
                  data-testid={`companies-filter-${filter.value}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <DataTable
              columns={columns}
              data={filteredCompanies}
              onRowClick={(row) => navigate(`/supplier/${row.bin}`)}
            />
          </div>
        </InfoCard>
      </div>
    </PageContainer>
  );
}
