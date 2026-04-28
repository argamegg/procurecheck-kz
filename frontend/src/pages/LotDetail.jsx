import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Receipt, Trophy } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { InfoCard, MetricCard } from '@/components/shared/Cards';
import { SecondaryButton } from '@/components/shared/Buttons';
import { DataTable } from '@/components/shared/DataTable';
import { lotsAPI } from '@/utils/api';
import { formatCurrency, formatDateTime, getTradeMethodLabel } from '@/utils/ows';
import { toast } from 'sonner';

export default function LotDetail() {
  const { lotId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await lotsAPI.getById(lotId);
        setDetail(response.data);
      } catch (error) {
        console.error('Lot detail load failed', error);
        toast.error('Не удалось загрузить лот');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [lotId]);

  if (loading) return <PageContainer><div className="flex items-center justify-center h-64 text-slate-500">Загрузка лота...</div></PageContainer>;
  if (!detail) return <PageContainer><div className="flex items-center justify-center h-64 text-slate-500">Лот не найден</div></PageContainer>;

  const { lot, announcement, bids } = detail;

  return (
    <PageContainer>
      <div className="space-y-8">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Лот {lot.lot_number}</h1>
            <p className="text-sm text-slate-500">{lot.name_ru}</p>
          </div>
          <SecondaryButton onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Назад
          </SecondaryButton>
        </div>

        <div className="bento-grid">
          <MetricCard label="Сумма" value={formatCurrency(lot.amount)} icon={<FileText className="w-5 h-5" strokeWidth={1.5} />} />
          <MetricCard label="Заявки" value={bids.length} icon={<Receipt className="w-5 h-5" strokeWidth={1.5} />} />
          <MetricCard label="Победитель" value={lot.winner_name || 'Не определен'} icon={<Trophy className="w-5 h-5" strokeWidth={1.5} />} />
        </div>

        <InfoCard title="Информация о лоте">
          <dl className="grid md:grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-slate-500">Лот</dt><dd className="mt-1 text-slate-900">{lot.lot_number}</dd></div>
            <div><dt className="text-xs text-slate-500">Объявление</dt><dd className="mt-1 text-slate-900">{announcement?.number_anno || 'Не указано'}</dd></div>
            <div><dt className="text-xs text-slate-500">Наименование</dt><dd className="mt-1 text-slate-900">{lot.name_ru}</dd></div>
            <div><dt className="text-xs text-slate-500">Статус</dt><dd className="mt-1 text-slate-900">{lot.status}</dd></div>
            <div><dt className="text-xs text-slate-500">Сумма</dt><dd className="mt-1 text-slate-900">{formatCurrency(lot.amount)}</dd></div>
            <div><dt className="text-xs text-slate-500">Количество</dt><dd className="mt-1 text-slate-900">{lot.quantity}</dd></div>
            <div><dt className="text-xs text-slate-500">Победитель</dt><dd className="mt-1 text-slate-900">{lot.winner_name || 'Не определен'}</dd></div>
            <div><dt className="text-xs text-slate-500">Связанный договор</dt><dd className="mt-1 text-slate-900">{lot.contract_number || 'Нет договора'}</dd></div>
            <div><dt className="text-xs text-slate-500">Способ закупки</dt><dd className="mt-1 text-slate-900">{announcement ? getTradeMethodLabel(announcement.ref_trade_methods_id) : 'Не указано'}</dd></div>
            <div><dt className="text-xs text-slate-500">Срок подачи</dt><dd className="mt-1 text-slate-900">{formatDateTime(announcement?.end_date)}</dd></div>
          </dl>
        </InfoCard>

        <InfoCard title={`Заявки по лоту (${bids.length})`}>
          <DataTable
            columns={[
              { header: 'Номер заявки', key: 'bid_number' },
              { header: 'Поставщик', key: 'supplier_name' },
              { header: 'Цена предложения', key: 'offered_amount', render: (row) => formatCurrency(row.offered_amount) },
              { header: 'Дата подачи', key: 'date_apply', render: (row) => formatDateTime(row.date_apply) },
              { header: 'Статус', key: 'status' },
              { header: 'Итог', key: 'result' },
            ]}
            data={bids}
            onRowClick={(row) => navigate(`/bids/${encodeURIComponent(row.application_id)}`)}
          />
        </InfoCard>
      </div>
    </PageContainer>
  );
}
