import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { InfoCard, MetricCard } from '@/components/shared/Cards';
import { PrimaryButton, SecondaryButton } from '@/components/shared/Buttons';
import { RoleBadge, RiskBadge } from '@/components/shared/Badges';
import { companiesAPI } from '@/utils/api';
import { Building2, FileText, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [companiesPreview, setCompaniesPreview] = useState([]);

  useEffect(() => {
    loadCompaniesPreview();
  }, []);

  const loadCompaniesPreview = async () => {
    try {
      const response = await companiesAPI.list();
      setCompaniesPreview((response.data.companies || []).slice(0, 5));
    } catch (error) {
      setCompaniesPreview([]);
    }
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
            label="Всего компаний в базе"
            value="18,542"
            icon={<Building2 className="w-5 h-5" strokeWidth={1.5} />}
            trend="+234 за последний месяц"
          />
          <MetricCard
            data-testid="metric-active-tenders"
            label="Активных тендеров"
            value="1,247"
            icon={<FileText className="w-5 h-5" strokeWidth={1.5} />}
            trend="89 новых сегодня"
          />
          <MetricCard
            data-testid="metric-blacklisted"
            label="В реестре недобросовестных"
            value="342"
            icon={<AlertTriangle className="w-5 h-5" strokeWidth={1.5} />}
            trend="12 добавлено за неделю"
          />
          <MetricCard
            data-testid="metric-total-value"
            label="Общая стоимость контрактов"
            value="2.4Т ₸"
            icon={<TrendingUp className="w-5 h-5" strokeWidth={1.5} />}
            trend="+15% к прошлому году"
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Последние проверки</h3>
          <div className="space-y-3">
            {[
              { bin: '010540000001', name: 'ТОО "Казахстанская Строительная Компания"', risk: 'low' },
              { bin: '010540000002', name: 'АО "Алматы Телеком"', risk: 'medium' },
              { bin: '010540000003', name: 'ТОО "МегаСнаб"', risk: 'high' },
            ].map((item, idx) => (
              <div
                key={idx}
                data-testid={`recent-check-${idx}`}
                onClick={() => navigate(`/supplier/${item.bin}`)}
                className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-lg border border-slate-100 cursor-pointer transition-colors"
              >
                <div>
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500 font-mono">БИН: {item.bin}</p>
                </div>
                <div
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    item.risk === 'low'
                      ? 'bg-emerald-100 text-emerald-700'
                      : item.risk === 'medium'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {item.risk === 'low' ? 'Низкий риск' : item.risk === 'medium' ? 'Средний риск' : 'Высокий риск'}
                </div>
              </div>
            ))}
          </div>
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
              Отдельный раздел со всеми компаниями локальной аналитической базы: поиск по названию, просмотр риска и быстрый переход в карточку участника.
            </p>

            <div className="grid gap-3">
              {companiesPreview.map((company) => (
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
      </div>
    </PageContainer>
  );
}
