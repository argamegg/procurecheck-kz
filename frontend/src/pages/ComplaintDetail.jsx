import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Scale, ShieldAlert } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { InfoCard, MetricCard, SectionCard } from '@/components/shared/Cards';
import { SecondaryButton } from '@/components/shared/Buttons';
import { ComplaintStatusBadge } from '@/components/shared/Badges';
import { complaintsAPI } from '@/utils/api';
import { formatDateTime } from '@/utils/ows';
import { toast } from 'sonner';

export default function ComplaintDetail() {
  const { complaintId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComplaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaintId]);

  const loadComplaint = async () => {
    setLoading(true);
    try {
      const response = await complaintsAPI.getById(complaintId);
      setDetail(response.data);
    } catch (error) {
      toast.error('Не удалось загрузить карточку жалобы');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64 text-slate-500">Загрузка жалобы...</div>
      </PageContainer>
    );
  }

  if (!detail?.item) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64 text-slate-500">Жалоба не найдена</div>
      </PageContainer>
    );
  }

  const { item } = detail;

  return (
    <PageContainer>
      <div data-testid="complaint-detail-page" className="space-y-8">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold text-slate-900">Жалоба № {item.complaint_number}</h1>
                <ComplaintStatusBadge status={item.status} />
              </div>
              <p className="text-sm text-slate-500">Дата подачи: {formatDateTime(item.date_submitted)}</p>
            </div>
            <SecondaryButton onClick={() => navigate('/complaints')}>
              <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.5} />
              К реестру
            </SecondaryButton>
          </div>
        </div>

        <div className="bento-grid">
          <MetricCard label="Статус" value={item.status} icon={<Scale className="w-5 h-5" strokeWidth={1.5} />} />
          <MetricCard label="Объект" value={item.object_type} icon={<ShieldAlert className="w-5 h-5" strokeWidth={1.5} />} />
          <MetricCard label="Заявитель" value={item.applicant_name} icon={<FileText className="w-5 h-5" strokeWidth={1.5} />} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <InfoCard title="Карточка жалобы">
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">Номер жалобы</dt>
                <dd className="mt-1 text-slate-900">{item.complaint_number}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Заявитель</dt>
                <dd className="mt-1 text-slate-900">{item.applicant_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">БИН/ИИН заявителя</dt>
                <dd className="mt-1 text-slate-900">{item.applicant_identifier || 'Не указан'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Объект жалобы</dt>
                <dd className="mt-1 text-slate-900">{item.object_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Поставщик</dt>
                <dd className="mt-1 text-slate-900">{item.supplier_name || 'Не указан'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Заказчик</dt>
                <dd className="mt-1 text-slate-900">{item.customer_name || 'Не указан'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Тип объекта</dt>
                <dd className="mt-1 text-slate-900">{item.object_type}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Связанный тендер</dt>
                <dd className="mt-1 text-slate-900">{item.tender_number || 'Не указан'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">ID связанного договора</dt>
                <dd className="mt-1 text-slate-900">{item.related_contract_id || 'Не указан'}</dd>
              </div>
            </dl>
          </InfoCard>

          <InfoCard title="Полный текст жалобы">
            <SectionCard className="bg-slate-50">
              <p className="text-sm leading-6 text-slate-700">{item.full_text || item.short_description}</p>
            </SectionCard>
          </InfoCard>
        </div>

        <InfoCard title="Решение и результат">
          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard className="p-4">
              <p className="text-xs text-slate-500 mb-1">Статус</p>
              <ComplaintStatusBadge status={item.status} />
            </SectionCard>
            <SectionCard className="p-4">
              <p className="text-xs text-slate-500 mb-1">Решение</p>
              <p className="text-sm text-slate-900">{item.decision || 'Решение по жалобе отсутствует в текущих данных.'}</p>
            </SectionCard>
          </div>
        </InfoCard>
      </div>
    </PageContainer>
  );
}
