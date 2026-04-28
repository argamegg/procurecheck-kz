import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Receipt, Trophy } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { InfoCard, MetricCard } from '@/components/shared/Cards';
import { SecondaryButton } from '@/components/shared/Buttons';
import { DataTable } from '@/components/shared/DataTable';
import { bidsAPI } from '@/utils/api';
import { formatCurrency, formatDateTime } from '@/utils/ows';
import { toast } from 'sonner';

export default function BidDetail() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await bidsAPI.getById(applicationId);
        setDetail(response.data);
      } catch (error) {
        console.error('Bid detail load failed', error);
        toast.error('Не удалось загрузить заявку');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [applicationId]);

  if (loading) return <PageContainer><div className="flex items-center justify-center h-64 text-slate-500">Загрузка заявки...</div></PageContainer>;
  if (!detail) return <PageContainer><div className="flex items-center justify-center h-64 text-slate-500">Заявка не найдена</div></PageContainer>;

  const { bid, announcement, supplier, lots } = detail;

  return (
    <PageContainer>
      <div className="space-y-8">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{bid.bid_number}</h1>
            <p className="text-sm text-slate-500">Поставщик: {bid.supplier_name}</p>
          </div>
          <SecondaryButton onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.5} />
            Назад
          </SecondaryButton>
        </div>

        <div className="bento-grid">
          <MetricCard label="Цена предложения" value={formatCurrency(bid.offered_amount)} icon={<FileText className="w-5 h-5" strokeWidth={1.5} />} />
          <MetricCard label="Статус" value={bid.status} icon={<Receipt className="w-5 h-5" strokeWidth={1.5} />} />
          <MetricCard label="Итог" value={bid.result || 'Не указан'} icon={<Trophy className="w-5 h-5" strokeWidth={1.5} />} />
        </div>

        <InfoCard title="Детали заявки">
          <dl className="grid md:grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-slate-500">Номер заявки</dt><dd className="mt-1 text-slate-900">{bid.bid_number}</dd></div>
            <div><dt className="text-xs text-slate-500">Объявление</dt><dd className="mt-1 text-slate-900">{announcement?.number_anno || 'Не указано'}</dd></div>
            <div><dt className="text-xs text-slate-500">Поставщик</dt><dd className="mt-1 text-slate-900">{bid.supplier_name}</dd></div>
            <div><dt className="text-xs text-slate-500">БИН поставщика</dt><dd className="mt-1 text-slate-900">{bid.supplier_bin}</dd></div>
            <div><dt className="text-xs text-slate-500">Цена</dt><dd className="mt-1 text-slate-900">{formatCurrency(bid.offered_amount)}</dd></div>
            <div><dt className="text-xs text-slate-500">Дата подачи</dt><dd className="mt-1 text-slate-900">{formatDateTime(bid.date_apply)}</dd></div>
            <div><dt className="text-xs text-slate-500">Статус</dt><dd className="mt-1 text-slate-900">{bid.status}</dd></div>
            <div><dt className="text-xs text-slate-500">Итог</dt><dd className="mt-1 text-slate-900">{bid.result || 'Не указан'}</dd></div>
            <div><dt className="text-xs text-slate-500">Место</dt><dd className="mt-1 text-slate-900">{bid.place || 'Не указано'}</dd></div>
            <div><dt className="text-xs text-slate-500">Документы</dt><dd className="mt-1 text-slate-900">Нет данных</dd></div>
          </dl>
        </InfoCard>

        <InfoCard title={`Лоты заявки (${lots.length})`}>
          <DataTable
            columns={[
              { header: 'Лот', key: 'lot_number' },
              { header: 'Наименование', key: 'name_ru' },
              { header: 'Количество', key: 'quantity' },
              { header: 'Сумма', key: 'amount', render: (row) => formatCurrency(row.amount) },
              { header: 'Статус', key: 'status' },
            ]}
            data={lots}
            onRowClick={(row) => navigate(`/lots/${row.lot_id}`)}
          />
        </InfoCard>
      </div>
    </PageContainer>
  );
}
