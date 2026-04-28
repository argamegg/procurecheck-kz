import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FileText, Landmark, ShieldAlert, Users } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { ContentSwitcher } from '@/components/shared/ContentSwitcher';
import { DataTable } from '@/components/shared/DataTable';
import { ContractStatusBadge } from '@/components/shared/Badges';
import { InfoCard, MetricCard, SectionCard } from '@/components/shared/Cards';
import { SecondaryButton } from '@/components/shared/Buttons';
import { contractsAPI } from '@/utils/api';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/ows';
import { toast } from 'sonner';

export default function ContractDetail() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContractDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  const loadContractDetail = async () => {
    setLoading(true);
    try {
      const response = await contractsAPI.getById(contractId);
      setDetail(response.data);
    } catch (error) {
      console.error('Contract detail load failed', error);
      toast.error('Не удалось загрузить карточку договора');
    } finally {
      setLoading(false);
    }
  };

  const contractFacts = useMemo(() => {
    if (!detail) {
      return { totalFactPayment: 0, averageKs: null, riskFlags: [] };
    }

    const { units = [], execution_status: executionStatus = {}, item } = detail;
    const totalFactPayment = units.reduce((sum, unit) => sum + Number(unit.fact_sum_wnds || unit.fact_sum || 0), 0);
    const totalContractAmount = Number(item?.amount || 0);
    const averageKs = units.length
      ? Math.round(units.reduce((sum, unit) => sum + Number(unit.ks_proc || 0), 0) / units.length)
      : null;

    const riskFlags = [];
    if (item?.status_bucket === 'terminated') {
      riskFlags.push('Договор расторгнут — это повышенный риск исполнения.');
    }
    if (totalContractAmount > 0 && totalFactPayment > 0 && totalFactPayment < totalContractAmount * 0.5) {
      riskFlags.push('Факт оплаты ниже 50% от суммы договора — нужен дополнительный контроль.');
    }
    if ((executionStatus?.overdue_acts || 0) > 0) {
      riskFlags.push(`Есть акты с просрочкой: ${executionStatus.overdue_acts}.`);
    }
    if (riskFlags.length === 0) {
      riskFlags.push('Существенных риск-сигналов по договору не найдено.');
    }

    return { totalFactPayment, averageKs, riskFlags };
  }, [detail]);

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64 text-slate-500">Загрузка договора...</div>
      </PageContainer>
    );
  }

  if (!detail) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64 text-slate-500">Договор не найден</div>
      </PageContainer>
    );
  }

  const {
    item,
    contract,
    tender,
    units,
    acts,
    history,
    execution_status: executionStatus,
    supplier_party: supplierParty,
    customer_party: customerParty,
  } = detail;

  const GeneralTab = () => (
    <div data-testid="contract-general-tab" className="space-y-6">
      <div className="bento-grid">
        <MetricCard
          label="Сумма договора"
          value={formatCurrency(item.amount)}
          icon={<Landmark className="w-5 h-5" strokeWidth={1.5} />}
        />
        <MetricCard
          label="Факт оплаты"
          value={formatCurrency(contractFacts.totalFactPayment)}
          icon={<FileText className="w-5 h-5" strokeWidth={1.5} />}
        />
        <MetricCard
          label="Электронные акты"
          value={acts.length}
          icon={<ShieldAlert className="w-5 h-5" strokeWidth={1.5} />}
          trend={`Просроченных актов: ${executionStatus.overdue_acts || 0}`}
        />
        <MetricCard
          label="Казсодержание"
          value={contractFacts.averageKs !== null ? `${contractFacts.averageKs}%` : 'Не указано'}
          icon={<Users className="w-5 h-5" strokeWidth={1.5} />}
        />
      </div>

      <InfoCard title="Общее">
        <dl className="grid gap-x-6 gap-y-4 md:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500">Системный номер</dt>
            <dd className="mt-1 text-slate-900">{contract.contract_number_sys || 'Не указан'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Номер договора</dt>
            <dd className="mt-1 text-slate-900">{contract.contract_number || 'Не указан'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Дата заключения</dt>
            <dd className="mt-1 text-slate-900">{formatDate(contract.crdate)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Статус</dt>
            <dd className="mt-1">
              <ContractStatusBadge status={item.status} bucket={item.status_bucket} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Сумма</dt>
            <dd className="mt-1 text-slate-900">{formatCurrency(item.amount)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Способ закупки</dt>
            <dd className="mt-1 text-slate-900">{item.procurement_method || 'Не указан'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Связанное объявление</dt>
            <dd className="mt-1">
              {item.tender_number ? (
                <button
                  type="button"
                  onClick={() => navigate(`/supplier/${item.supplier_biin}?tab=announcements`)}
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  {item.tender_number}
                  <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                </button>
              ) : (
                <span className="text-slate-500">Не указано</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Факт оплаты</dt>
            <dd className="mt-1 text-slate-900">{formatCurrency(contractFacts.totalFactPayment)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Казсодержание</dt>
            <dd className="mt-1 text-slate-900">
              {contractFacts.averageKs !== null ? `${contractFacts.averageKs}%` : 'Не указано'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Дата итогов закупки</dt>
            <dd className="mt-1 text-slate-900">{formatDate(contract.trd_buy_itogi_date_public)}</dd>
          </div>
        </dl>
      </InfoCard>

      <InfoCard title="Риск-анализ">
        <div className="space-y-3">
          {contractFacts.riskFlags.map((flag, index) => (
            <SectionCard
              key={index}
              className={`border-l-4 ${
                flag.toLowerCase().includes('не найдено')
                  ? 'border-emerald-500'
                  : flag.toLowerCase().includes('расторгнут')
                  ? 'border-red-500'
                  : 'border-amber-500'
              }`}
            >
              <p className="text-sm text-slate-700">{flag}</p>
            </SectionCard>
          ))}
        </div>
      </InfoCard>

      <InfoCard title="История изменений">
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">История изменений по договору не найдена.</p>
          ) : (
            history.map((event, index) => (
              <SectionCard key={`${event.event_type}-${index}`} className="border-l-4 border-slate-300">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{event.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{event.description}</p>
                  </div>
                  <p className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(event.date)}</p>
                </div>
              </SectionCard>
            ))
          )}
        </div>
      </InfoCard>
    </div>
  );

  const ItemsTab = () => (
    <div data-testid="contract-items-tab" className="space-y-6">
      <InfoCard title={`Предметы договора (${units.length})`}>
        {units.length === 0 ? (
          <div className="py-10 text-center text-slate-500">Нет данных</div>
        ) : (
          <DataTable
            columns={[
              { header: 'ID', key: 'id', render: (row) => <span className="text-xs text-slate-500">{row.id}</span> },
              { header: 'Предмет', key: 'name_ru', render: (row) => row.name_ru || 'Не указано' },
              { header: 'Количество', key: 'quantity' },
              { header: 'Сумма', key: 'total_sum_wnds', render: (row) => formatCurrency(row.total_sum_wnds || row.total_sum) },
              { header: 'Факт оплаты', key: 'fact_sum_wnds', render: (row) => formatCurrency(row.fact_sum_wnds || row.fact_sum) },
              { header: 'Казсодержание', key: 'ks_proc', render: (row) => `${row.ks_proc}%` },
            ]}
            data={units}
          />
        )}
      </InfoCard>
    </div>
  );

  const PartiesTab = () => (
    <div data-testid="contract-parties-tab" className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <InfoCard title="Заказчик">
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500">Название</dt>
              <dd className="mt-1 text-slate-900">{customerParty?.name || item.customer_name || 'Не указано'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">БИН</dt>
              <dd className="mt-1 text-slate-900">{customerParty?.bin || contract.customer_bin || 'Не указан'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Регион / адрес</dt>
              <dd className="mt-1 text-slate-900">
                {customerParty?.region || customerParty?.address ? [customerParty?.region, customerParty?.address].filter(Boolean).join(', ') : 'Не указано'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Статус</dt>
              <dd className="mt-1 text-slate-900">{customerParty?.status || 'Не указан'}</dd>
            </div>
          </dl>
        </InfoCard>

        <InfoCard title="Поставщик">
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500">Название</dt>
              <dd className="mt-1 text-slate-900">{supplierParty?.name || item.supplier_name || 'Не указано'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">БИН</dt>
              <dd className="mt-1 text-slate-900">{supplierParty?.bin || item.supplier_biin || 'Не указан'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Регион</dt>
              <dd className="mt-1 text-slate-900">{supplierParty?.region || 'Не указано'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Адрес</dt>
              <dd className="mt-1 text-slate-900">{supplierParty?.address || 'Не указан'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Статус</dt>
              <dd className="mt-1 text-slate-900">{supplierParty?.status || 'Активный'}</dd>
            </div>
          </dl>
        </InfoCard>
      </div>

      <InfoCard title={`Электронные акты (${acts.length})`}>
        <DataTable
          columns={[
            { header: 'Номер акта', key: 'number_act' },
            { header: 'Дата', key: 'akt_date', render: (row) => formatDate(row.akt_date) },
            { header: 'Статус', key: 'status_name_ru', render: (row) => row.status_name_ru || `Статус #${row.status_id}` },
            { header: 'Просрочка', key: 'day_overdue', render: (row) => `${row.day_overdue || 0} дн.` },
            { header: 'К перечислению', key: 'sum_transfer', render: (row) => formatCurrency(row.sum_transfer || 0) },
          ]}
          data={acts}
        />
      </InfoCard>
    </div>
  );

  const tabs = [
    { value: 'general', label: 'Общее', icon: <FileText className="w-4 h-4" strokeWidth={1.5} />, content: <GeneralTab /> },
    { value: 'items', label: 'Предметы договора', icon: <Landmark className="w-4 h-4" strokeWidth={1.5} />, content: <ItemsTab /> },
    { value: 'parties', label: 'Заказчик и поставщик', icon: <Users className="w-4 h-4" strokeWidth={1.5} />, content: <PartiesTab /> },
  ];

  return (
    <PageContainer>
      <div data-testid="contract-detail-page" className="space-y-8">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold text-slate-900">Договор № {item.contract_number}</h1>
                <ContractStatusBadge status={item.status} bucket={item.status_bucket} />
              </div>
              <p className="text-sm text-slate-500">Системный номер: {item.contract_number_sys}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <SecondaryButton onClick={() => navigate('/contracts')}>
                <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.5} />
                Назад
              </SecondaryButton>
              {item.supplier_biin && (
                <SecondaryButton onClick={() => navigate(`/supplier/${item.supplier_biin}?tab=contracts`)}>
                  Назад к профилю
                </SecondaryButton>
              )}
            </div>
          </div>
        </div>

        <ContentSwitcher tabs={tabs} defaultTab="general" />
      </div>
    </PageContainer>
  );
}
