import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Receipt, ShieldAlert } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { InfoCard, MetricCard } from '@/components/shared/Cards';
import { SecondaryButton } from '@/components/shared/Buttons';
import { DataTable } from '@/components/shared/DataTable';
import { announcementsAPI } from '@/utils/api';
import { formatCurrency, formatDate, formatDateTime, getBuyStatusLabel, getTradeMethodLabel } from '@/utils/ows';
import { toast } from 'sonner';

export default function AnnouncementDetail() {
  const { announcementId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await announcementsAPI.getById(announcementId);
        setDetail(response.data);
      } catch (error) {
        console.error('Announcement detail load failed', error);
        toast.error('Не удалось загрузить объявление');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [announcementId]);

  if (loading) return <PageContainer><div className="flex items-center justify-center h-64 text-slate-500">Загрузка объявления...</div></PageContainer>;
  if (!detail) return <PageContainer><div className="flex items-center justify-center h-64 text-slate-500">Объявление не найдено</div></PageContainer>;

  const { announcement, lots, bids } = detail;

  return (
    <PageContainer>
      <div className="space-y-8">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900">Объявление № {announcement.number_anno}</h1>
              <p className="text-sm text-slate-500">{announcement.name_ru}</p>
            </div>
            <SecondaryButton onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Назад
            </SecondaryButton>
          </div>
        </div>

        <div className="bento-grid">
          <MetricCard label="Сумма" value={formatCurrency(announcement.total_sum)} icon={<FileText className="w-5 h-5" strokeWidth={1.5} />} />
          <MetricCard label="Лоты" value={lots.length} icon={<Receipt className="w-5 h-5" strokeWidth={1.5} />} />
          <MetricCard label="Заявки" value={bids.length} icon={<ShieldAlert className="w-5 h-5" strokeWidth={1.5} />} />
        </div>

        <InfoCard title="Общая информация">
          <dl className="grid md:grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-slate-500">Номер объявления</dt><dd className="mt-1 text-slate-900">{announcement.number_anno}</dd></div>
            <div><dt className="text-xs text-slate-500">Статус</dt><dd className="mt-1 text-slate-900">{getBuyStatusLabel(announcement.ref_buy_status_id)}</dd></div>
            <div><dt className="text-xs text-slate-500">Заказчик</dt><dd className="mt-1 text-slate-900">{announcement.customer_name_ru}</dd></div>
            <div><dt className="text-xs text-slate-500">Способ закупки</dt><dd className="mt-1 text-slate-900">{getTradeMethodLabel(announcement.ref_trade_methods_id)}</dd></div>
            <div><dt className="text-xs text-slate-500">Дата публикации</dt><dd className="mt-1 text-slate-900">{formatDate(announcement.publish_date)}</dd></div>
            <div><dt className="text-xs text-slate-500">Срок подачи заявок</dt><dd className="mt-1 text-slate-900">{formatDate(announcement.end_date)}</dd></div>
          </dl>
        </InfoCard>

        <InfoCard title={`Список лотов (${lots.length})`}>
          <DataTable
            columns={[
              { header: 'Лот', key: 'lot_number' },
              { header: 'Наименование', key: 'name_ru' },
              { header: 'Количество', key: 'quantity' },
              { header: 'Сумма', key: 'amount', render: (row) => formatCurrency(row.amount) },
              { header: 'Статус', key: 'status' },
              { header: 'Договор', key: 'contract_number', render: (row) => row.contract_number || 'Нет договора' },
            ]}
            data={lots}
            onRowClick={(row) => navigate(`/lots/${row.lot_id}`)}
          />
        </InfoCard>

        <InfoCard title={`Список заявок (${bids.length})`}>
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
