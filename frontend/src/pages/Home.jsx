import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { InfoCard, MetricCard } from '@/components/shared/Cards';
import { PrimaryButton, SecondaryButton } from '@/components/shared/Buttons';
import { RoleBadge, RiskBadge } from '@/components/shared/Badges';
import { companiesAPI, dashboardAPI } from '@/utils/api';
import { getSearchHistory } from '@/utils/auth';
import { Building2, FileText, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogPreview, setCatalogPreview] = useState([]);
  const [rnuPreview, setRnuPreview] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    total_companies: 0,
    total_announcements: 0,
    blacklisted_companies: 0,
    total_contract_value: 0,
    average_trust_score: 0,
  });

  useEffect(() => {
    loadRecentSearches();
    loadCompaniesPreview();
    loadRnuPreview();
    loadDashboardStats();
  }, []);

  const formatCurrencyCompact = (value) => {
    const formatter = new Intl.NumberFormat('ru-RU', {
      notation: 'compact',
      maximumFractionDigits: 1,
    });

    return `${formatter.format(value)} ₸`;
  };

  const loadDashboardStats = async () => {
    try {
      const response = await dashboardAPI.getStats();
      setDashboardStats(response.data);
    } catch (error) {
      setDashboardStats({
        total_companies: 0,
        total_announcements: 0,
        blacklisted_companies: 0,
        total_contract_value: 0,
        average_trust_score: 0,
      });
    }
  };

  const loadCompaniesPreview = async () => {
    try {
      const response = await companiesAPI.list();
      setCatalogPreview((response.data.companies || []).slice(0, 5));
    } catch (error) {
      setCatalogPreview([]);
    }
  };

  const loadRnuPreview = async () => {
    try {
      const response = await companiesAPI.list({ is_blacklisted: true });
      setRnuPreview((response.data.companies || []).slice(0, 5));
    } catch (error) {
      setRnuPreview([]);
    }
  };

  const loadRecentSearches = () => {
    setRecentSearches(getSearchHistory());
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.error('Введите БИН или название компании');
      return;
    }
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <PageContainer>
      <div data-testid="home-page" className="space-y-8">
        <PageHeader
          title="Поиск поставщиков"
          subtitle="Проверка компаний, участвующих в государственных закупках Казахстана"
        />

        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Поиск по БИН или названию</h2>
            <div className="flex gap-3">
              <SearchInput
                data-testid="home-search-input"
                large
                placeholder="Введите БИН (12 цифр) или название компании..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <PrimaryButton
                data-testid="home-search-button"
                onClick={handleSearch}
                className="h-12 px-8 text-base"
              >
                Найти
              </PrimaryButton>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Пример: 010540000001 или "Казахстанская Строительная"
            </p>
          </div>
        </div>

        <div className="bento-grid">
          <MetricCard
            data-testid="metric-total-companies"
            label="Всего участников"
            value={new Intl.NumberFormat('ru-RU').format(dashboardStats.total_companies)}
            icon={<Building2 className="w-5 h-5" strokeWidth={1.5} />}
            trend="Карточки по структуре OWS v3"
          />
          <MetricCard
            data-testid="metric-active-tenders"
            label="Объявлений в профилях"
            value={new Intl.NumberFormat('ru-RU').format(dashboardStats.total_announcements)}
            icon={<FileText className="w-5 h-5" strokeWidth={1.5} />}
            trend="Реестр объявлений в локальной базе"
          />
          <MetricCard
            data-testid="metric-blacklisted"
            label="В реестре недобросовестных"
            value={new Intl.NumberFormat('ru-RU').format(dashboardStats.blacklisted_companies)}
            icon={<AlertTriangle className="w-5 h-5" strokeWidth={1.5} />}
            trend={`Средний уровень доверия: ${dashboardStats.average_trust_score}/100`}
          />
          <MetricCard
            data-testid="metric-total-value"
            label="Сумма договоров в базе"
            value={formatCurrencyCompact(dashboardStats.total_contract_value)}
            icon={<TrendingUp className="w-5 h-5" strokeWidth={1.5} />}
            trend="Подсчитано по всем сохраненным контрактам"
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">История поиска</h3>
          <p className="text-sm text-slate-500 mb-4">
            Последние реально открытые карточки компаний в этом аккаунте.
          </p>

          {recentSearches.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">История пока пуста</p>
              <p className="text-sm text-slate-500 mt-1">
                Найдите компанию и откройте её карточку. После этого она появится здесь.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSearches.map((item, idx) => (
                <div
                  key={item.bin}
                  data-testid={`recent-check-${idx}`}
                  onClick={() => navigate(`/supplier/${item.bin}`)}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-lg border border-slate-100 cursor-pointer transition-colors"
                >
                  <div>
                    <p className="font-medium text-slate-900">{item.name_ru}</p>
                    <p className="text-xs text-slate-500 font-mono">БИН: {item.bin}</p>
                  </div>
                  <div
                    className={`px-3 py-1 rounded text-xs font-medium ${
                      item.risk_level === 'low'
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.risk_level === 'medium'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {item.risk_level === 'low' ? 'Низкий риск' : item.risk_level === 'medium' ? 'Средний риск' : 'Высокий риск'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <InfoCard
          title="Все участники"
          actions={
            <SecondaryButton onClick={() => navigate('/companies')} data-testid="home-open-companies-btn">
              Открыть каталог
              <ArrowRight className="w-4 h-4 ml-2" strokeWidth={1.5} />
            </SecondaryButton>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Отдельный раздел со всеми участниками локальной базы в формате, приближенном к OWS v3: поиск по БИН, статус РНУ и быстрый переход в карточку участника.
            </p>

            <div className="grid gap-3">
              {catalogPreview.map((company) => (
                <button
                  key={company.bin}
                  type="button"
                  onClick={() => navigate(`/supplier/${company.bin}`)}
                  className="text-left p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium text-slate-900">{company.name_ru}</p>
                        <p className="text-xs text-slate-500 font-mono">БИН: {company.bin}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {company.roles.map((role, idx) => (
                          <RoleBadge key={idx} role={role} />
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <RiskBadge level={company.risk_level} />
                      <span className="text-xs text-slate-500">Доверие: {company.trust_score}/100</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </InfoCard>

        <InfoCard
          title="РНУ"
          actions={
            <SecondaryButton onClick={() => navigate('/rnu')} data-testid="home-open-rnu-btn">
              Открыть реестр
              <ArrowRight className="w-4 h-4 ml-2" strokeWidth={1.5} />
            </SecondaryButton>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Компании с активной записью в реестре недобросовестных поставщиков по локальной OWS-подобной модели.
            </p>

            {rnuPreview.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">Активных записей РНУ не найдено</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {rnuPreview.map((company) => (
                  <button
                    key={company.bin}
                    type="button"
                    onClick={() => navigate(`/supplier/${company.bin}`)}
                    className="text-left p-4 rounded-lg border border-red-200 bg-red-50/40 hover:bg-red-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900">{company.name_ru}</p>
                        <p className="text-xs text-slate-500 font-mono mt-1">БИН: {company.bin}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <RiskBadge level={company.risk_level} />
                        <span className="text-xs text-slate-500">Доверие: {company.trust_score}/100</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </InfoCard>
      </div>
    </PageContainer>
  );
}
