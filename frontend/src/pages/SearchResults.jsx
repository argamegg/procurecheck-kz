import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { DataTable } from '@/components/shared/DataTable';
import { RoleBadge, RegistryBadge, RiskBadge } from '@/components/shared/Badges';
import { PrimaryButton, SecondaryButton } from '@/components/shared/Buttons';
import { companiesAPI } from '@/utils/api';
import { getTypeSupplierLabel } from '@/utils/ows';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

export default function SearchResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const performSearch = async (query) => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await companiesAPI.search(query);
      setCompanies(response.data.companies || []);
      if (response.data.companies.length === 0) {
        toast.info('Компании не найдены');
      }
    } catch (error) {
      toast.error('Ошибка поиска');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    performSearch(searchQuery);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleRowClick = (row) => {
    navigate(`/supplier/${row.bin}`);
  };

  const columns = [
    {
      header: 'БИН',
      key: 'bin',
      render: (row) => <span className="font-mono text-xs">{row.bin}</span>,
    },
    {
      header: 'Участник',
      key: 'name_ru',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.name_ru}</p>
          {row.full_name_ru && <p className="text-xs text-slate-500">{row.full_name_ru}</p>}
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
      render: (row) => (
        <div>
          {row.is_blacklisted ? (
            <RegistryBadge isBlacklisted={true} />
          ) : (
            <span className="text-xs text-slate-500">Чист</span>
          )}
        </div>
      ),
    },
    {
      header: 'Доверие',
      key: 'trust_score',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-12 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                row.trust_score >= 70
                  ? 'bg-emerald-500'
                  : row.trust_score >= 40
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
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
      <div data-testid="search-results-page" className="space-y-6">
        <PageHeader
          title="Результаты поиска по реестру участников"
          subtitle={`Найдено участников: ${companies.length}`}
          actions={
            <SecondaryButton
              data-testid="back-to-home-btn"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Назад
            </SecondaryButton>
          }
        />

        <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
          <div className="flex gap-3 mb-6">
            <SearchInput
              data-testid="search-results-input"
              placeholder="Введите БИН или название..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <PrimaryButton
              data-testid="search-results-search-btn"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? 'Поиск...' : 'Найти'}
            </PrimaryButton>
          </div>

          <DataTable
            data-testid="search-results-table"
            columns={columns}
            data={companies}
            onRowClick={handleRowClick}
          />
        </div>
      </div>
    </PageContainer>
  );
}
