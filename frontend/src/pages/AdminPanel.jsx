import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Building2,
  FileText,
  Receipt,
  Boxes,
  FileCheck,
  ClipboardList,
  ScrollText,
  MessageSquareWarning,
  ShieldAlert,
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/PageContainer';
import { ContentSwitcher } from '@/components/shared/ContentSwitcher';
import { InfoCard, SectionCard } from '@/components/shared/Cards';
import { PrimaryButton, SecondaryButton, DangerButton } from '@/components/shared/Buttons';
import { SearchInput } from '@/components/shared/SearchInput';
import { DataTable } from '@/components/shared/DataTable';
import { adminAPI } from '@/utils/api';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getBuyStatusLabel,
  getContractStatusLabel,
  getLotStatusLabel,
  getTradeMethodLabel,
} from '@/utils/ows';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 8;

const STATUS_TONE = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  danger: 'bg-red-100 text-red-700 border-red-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

const StatusBadge = ({ label, tone = 'neutral' }) => (
  <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${STATUS_TONE[tone] || STATUS_TONE.neutral}`}>
    {label}
  </span>
);

const compareValues = (left, right, direction = 'asc') => {
  const leftValue = left ?? '';
  const rightValue = right ?? '';
  const leftDate = Date.parse(leftValue);
  const rightDate = Date.parse(rightValue);

  let result = 0;
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
    result = leftDate - rightDate;
  } else if (!Number.isNaN(Number(leftValue)) && !Number.isNaN(Number(rightValue))) {
    result = Number(leftValue) - Number(rightValue);
  } else {
    result = String(leftValue).localeCompare(String(rightValue), 'ru', { numeric: true, sensitivity: 'base' });
  }

  return direction === 'asc' ? result : -result;
};

const normalizeIntegerInputValue = (rawValue) => {
  if (rawValue === '') {
    return '';
  }

  const stringValue = String(rawValue).trim();
  if (stringValue === '') {
    return '';
  }

  if (/^-/.test(stringValue)) {
    return `-${stringValue.replace(/[^\d]/g, '')}`;
  }

  const digits = stringValue.replace(/[^\d]/g, '');
  if (!digits) {
    return '';
  }

  return String(Number(digits));
};

const validateAdminRecord = (section, payload) => {
  const errors = {};

  section.fields.forEach((field) => {
    const value = payload[field.name];

    if (field.required && (value == null || value === '' || (Array.isArray(value) && value.length === 0))) {
      errors[field.name] = 'Поле обязательно для заполнения';
      return;
    }

    if (field.type === 'number' && value != null && value !== '') {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) {
        errors[field.name] = 'Введите корректное число';
        return;
      }
      if (numericValue < 0) {
        errors[field.name] = 'Значение не может быть отрицательным';
        return;
      }
    }

    if ((field.type === 'date' || field.type === 'datetime-local') && value) {
      if (Number.isNaN(Date.parse(value))) {
        errors[field.name] = 'Введите корректную дату';
      }
    }
  });

  return errors;
};

const validateTrustSettingsPayload = (settings) => {
  const errors = {};
  const weights = settings?.weights || {};
  const thresholds = settings?.thresholds || {};
  const riskLevels = settings?.risk_levels || {};

  const weightValues = {};
  ['participation', 'competition', 'win_rate', 'execution', 'quality', 'risk_penalty'].forEach((key) => {
    const rawValue = weights[key];
    if (rawValue === '' || rawValue == null) {
      errors[`weight:${key}`] = 'Поле обязательно';
      return;
    }
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) {
      errors[`weight:${key}`] = 'Введите корректное число';
      return;
    }
    if (numericValue < 0 || numericValue > 100) {
      errors[`weight:${key}`] = 'Допустимый диапазон: 0–100';
      return;
    }
    weightValues[key] = numericValue;
  });

  const weightSum = Object.values(weightValues).reduce((sum, value) => sum + value, 0);
  if (!Object.keys(errors).length && weightSum !== 100) {
    errors['weight:sum'] = `Сумма весов должна быть 100%, сейчас ${weightSum}%`;
  }

  ['high_trust', 'reliable', 'medium_risk', 'high_risk', 'critical_risk'].forEach((key) => {
    const rawValue = thresholds[key];
    if (rawValue === '' || rawValue == null) {
      errors[`threshold:${key}`] = 'Поле обязательно';
      return;
    }
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
      errors[`threshold:${key}`] = 'Допустимый диапазон: 0–100';
    }
  });

  const lowMin = Number(riskLevels.low_min);
  const mediumMin = Number(riskLevels.medium_min);
  if (!Number.isFinite(lowMin) || lowMin < 0 || lowMin > 100) {
    errors['risk:low_min'] = 'Допустимый диапазон: 0–100';
  }
  if (!Number.isFinite(mediumMin) || mediumMin < 0 || mediumMin > 100) {
    errors['risk:medium_min'] = 'Допустимый диапазон: 0–100';
  }
  if (!errors['risk:low_min'] && !errors['risk:medium_min'] && mediumMin > lowMin) {
    errors['risk:medium_min'] = 'Порог среднего риска не может быть выше порога низкого риска';
  }

  ['low_label', 'medium_label', 'high_label'].forEach((key) => {
    if (!String(riskLevels[key] || '').trim()) {
      errors[`risk:${key}`] = 'Название уровня риска обязательно';
    }
  });

  return { errors, weightSum };
};

const normalizeRecordForSubmit = (sectionKey, data) => {
  const payload = { ...data };
  Object.keys(payload).forEach((key) => {
    if (payload[key] === '') {
      payload[key] = null;
    }
  });

  if (sectionKey === 'participants' && payload.oked_list && typeof payload.oked_list === 'string') {
    payload.oked_list = payload.oked_list
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return payload;
};

const PaginationControls = ({ page, totalPages, onPageChange }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-slate-500">Страница {page} из {totalPages}</p>
    <div className="flex flex-wrap gap-2">
      <SecondaryButton onClick={() => onPageChange(1)} disabled={page === 1}>Первая</SecondaryButton>
      <SecondaryButton onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>Назад</SecondaryButton>
      <SecondaryButton onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Вперед</SecondaryButton>
      <SecondaryButton onClick={() => onPageChange(totalPages)} disabled={page === totalPages}>Последняя</SecondaryButton>
    </div>
  </div>
);

const SearchableSelect = ({ field, value, onChange, options, error }) => {
  const [open, setOpen] = useState(false);
  const normalizedValue = value == null ? '' : String(value);
  const selectedOption = options.find((option) => String(option.value ?? option) === normalizedValue);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`h-10 w-full justify-between bg-white px-3 text-sm font-normal text-slate-700 hover:bg-slate-50 ${error ? 'border-red-300 focus-visible:ring-red-400' : 'border-slate-300'}`}
        >
          <span className="truncate text-left">
            {selectedOption ? (selectedOption.label ?? selectedOption) : (field.emptyLabel || 'Начните вводить название или БИН')}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" strokeWidth={1.5} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder={field.searchPlaceholder || 'Поиск по названию или БИН...'} />
          <CommandList>
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__empty__"
                onSelect={() => {
                  onChange(field.name, '');
                  setOpen(false);
                }}
              >
                <Check className={`mr-2 h-4 w-4 ${!selectedOption ? 'opacity-100' : 'opacity-0'}`} strokeWidth={1.5} />
                {field.emptyLabel || 'Очистить выбор'}
              </CommandItem>
              {options.map((option) => {
                const optionValue = String(option.value ?? option);
                const isSelected = optionValue === normalizedValue;
                const label = option.label ?? option;
                const searchValue = `${label} ${option.bin || ''} ${option.name_ru || ''} ${option.pid || ''}`.trim();
                return (
                  <CommandItem
                    key={optionValue}
                    value={searchValue}
                    onSelect={() => {
                      onChange(field.name, option.value ?? option);
                      setOpen(false);
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${isSelected ? 'opacity-100' : 'opacity-0'}`} strokeWidth={1.5} />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const FieldControl = ({ field, value, onChange, options, error }) => {
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(field.name, event.target.checked)} />
        <span>{field.label}</span>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value ?? ''}
        onChange={(event) => onChange(field.name, event.target.value)}
        rows={4}
        className={`w-full rounded-md border px-3 py-2 text-sm text-slate-700 ${error ? 'border-red-300 focus:border-red-400' : 'border-slate-300'}`}
        placeholder={field.placeholder}
      />
    );
  }

  if (field.type === 'select') {
    const selectOptions = field.optionsKey ? (options[field.optionsKey] || []) : (field.options || []);

    if (field.searchable || field.optionsKey) {
      return <SearchableSelect field={field} value={value} onChange={onChange} options={selectOptions} error={error} />;
    }

    return (
      <select
        value={value ?? ''}
        onChange={(event) => onChange(field.name, event.target.value)}
        className={`h-10 w-full rounded-md border bg-white px-3 text-sm text-slate-700 ${error ? 'border-red-300 focus:border-red-400' : 'border-slate-300'}`}
      >
        <option value="">{field.emptyLabel || 'Выберите значение'}</option>
        {selectOptions.map((option) => (
          <option key={option.value ?? option} value={option.value ?? option}>
            {option.label ?? option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={field.type || 'text'}
      value={value ?? ''}
      onChange={(event) => onChange(field.name, event.target.value)}
      className={`h-10 w-full rounded-md border px-3 text-sm text-slate-700 ${error ? 'border-red-300 focus:border-red-400' : 'border-slate-300'}`}
      placeholder={field.placeholder}
    />
  );
};

const AdminRecordDialog = ({ open, onOpenChange, section, options, initialData, onSubmit, saving }) => {
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    setFormData(initialData || {});
    setFormErrors({});
  }, [initialData]);

  const handleChange = (name, value) => {
    setFormData((current) => ({ ...current, [name]: value }));
    setFormErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalized = normalizeRecordForSubmit(section.key, formData);
    const nextErrors = validateAdminRecord(section, normalized);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error('Проверьте форму: есть обязательные или некорректные поля');
      return;
    }
    await onSubmit(normalized);
  };

  if (!section) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{initialData?.id ? `Редактировать: ${section.label}` : `Создать: ${section.label}`}</DialogTitle>
          <DialogDescription>Изменения сохраняются в локальную базу и сразу влияют на витрины сайта.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            {section.fields.map((field) => (
              <div key={field.name} className={field.fullWidth ? 'md:col-span-2' : ''}>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {field.label}
                </label>
                <FieldControl field={field} value={formData[field.name]} onChange={handleChange} options={options} error={formErrors[field.name]} />
                {formErrors[field.name] && <p className="mt-1 text-xs text-red-600">{formErrors[field.name]}</p>}
              </div>
            ))}
          </div>

          <DialogFooter>
            <SecondaryButton type="button" onClick={() => onOpenChange(false)}>Отмена</SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</PrimaryButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ENTITY_SECTIONS = [
  {
    key: 'participants',
    label: 'Участники',
    icon: <Building2 className="w-4 h-4" strokeWidth={1.5} />,
    searchKeys: ['bin', 'name_ru', 'director_name'],
    statusField: 'participant_status',
    columns: [
      { header: 'БИН/ИИН', key: 'bin', sortable: true },
      { header: 'Наименование', key: 'name_ru', sortable: true },
      { header: 'Руководитель', key: 'director_name', sortable: true },
      { header: 'Статус', key: 'participant_status', sortable: true, render: (row) => <StatusBadge label={row.participant_status || 'Активен'} tone="info" /> },
      { header: 'Договоры', key: 'contracts_count', sortable: true },
      { header: 'Объявления', key: 'announcements_count', sortable: true },
    ],
    fields: [
      { name: 'system_number', label: 'Системный номер', type: 'text' },
      { name: 'bin', label: 'БИН / ИИН', type: 'text', required: true },
      { name: 'name_ru', label: 'Наименование (РУ)', type: 'text', required: true },
      { name: 'name_kz', label: 'Наименование (КЗ)', type: 'text' },
      { name: 'full_name_ru', label: 'Полное наименование (РУ)', type: 'text' },
      { name: 'country_code', label: 'Код страны', type: 'number' },
      { name: 'regdate', label: 'Дата регистрации', type: 'date' },
      { name: 'participant_status', label: 'Статус', type: 'select', options: [{ value: 'Активен', label: 'Активен' }, { value: 'Неактивен', label: 'Неактивен' }] },
      { name: 'director_name', label: 'Руководитель', type: 'text' },
      { name: 'phone', label: 'Телефон', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'website', label: 'Сайт', type: 'url' },
      { name: 'legal_address', label: 'Юридический адрес', type: 'text', fullWidth: true },
      { name: 'actual_address', label: 'Фактический адрес', type: 'text', fullWidth: true },
      { name: 'legal_kato_code', label: 'КАТО (юридический)', type: 'text' },
      { name: 'actual_kato_code', label: 'КАТО (фактический)', type: 'text' },
      { name: 'legal_phone', label: 'Телефон (юридический)', type: 'text' },
      { name: 'actual_phone', label: 'Телефон (фактический)', type: 'text' },
      { name: 'oked_list', label: 'ОКЭД (через запятую)', type: 'text', fullWidth: true },
      { name: 'is_resident', label: 'Резидент', type: 'checkbox' },
      { name: 'supplier', label: 'Поставщик', type: 'checkbox' },
      { name: 'customer', label: 'Заказчик', type: 'checkbox' },
      { name: 'organizer', label: 'Организатор', type: 'checkbox' },
      { name: 'mark_national_company', label: 'Национальная организация', type: 'checkbox' },
      { name: 'mark_assoc_with_disab', label: 'Субъект с особыми признаками', type: 'checkbox' },
    ],
  },
  {
    key: 'announcements',
    label: 'Объявления',
    icon: <FileText className="w-4 h-4" strokeWidth={1.5} />,
    searchKeys: ['number_anno', 'name_ru', 'customer_name_ru'],
    statusField: 'status_label',
    columns: [
      { header: 'Номер', key: 'number_anno', sortable: true },
      { header: 'Наименование', key: 'name_ru', sortable: true },
      { header: 'Заказчик', key: 'customer_name_ru', sortable: true },
      { header: 'Способ', key: 'procurement_method', sortable: true },
      { header: 'Публикация', key: 'publish_date', sortable: true, render: (row) => formatDate(row.publish_date) },
      { header: 'Сумма', key: 'total_sum', sortable: true, render: (row) => formatCurrency(row.total_sum) },
      { header: 'Статус', key: 'status_label', sortable: true, render: (row) => <StatusBadge label={row.status_label} tone={row.ref_buy_status_id === 340 ? 'success' : row.ref_buy_status_id === 320 ? 'warning' : 'info'} /> },
    ],
    fields: [
      { name: 'participant_bin', label: 'Владелец записи', type: 'select', optionsKey: 'participants', searchable: true, searchPlaceholder: 'Поиск участника по БИН или названию...', required: true },
      { name: 'customer_bin', label: 'Заказчик', type: 'select', optionsKey: 'customers', searchable: true, searchPlaceholder: 'Поиск заказчика по БИН или названию...' },
      { name: 'number_anno', label: 'Номер объявления', type: 'text', required: true },
      { name: 'name_ru', label: 'Наименование закупки', type: 'text', fullWidth: true, required: true },
      { name: 'ref_trade_methods_id', label: 'Способ закупки', type: 'select', options: [{ value: 1, label: 'Открытый конкурс' }, { value: 2, label: 'Из одного источника' }, { value: 7, label: 'Аукцион' }, { value: 31, label: 'Запрос ценовых предложений' }] },
      { name: 'publish_date', label: 'Дата публикации', type: 'date' },
      { name: 'end_date', label: 'Срок подачи заявок', type: 'date' },
      { name: 'total_sum', label: 'Сумма', type: 'number', required: true },
      { name: 'ref_buy_status_id', label: 'Статус', type: 'select', options: [{ value: 310, label: 'Опубликовано' }, { value: 320, label: 'Прием заявок' }, { value: 340, label: 'Итоги подведены' }] },
      { name: 'count_lots', label: 'Количество лотов', type: 'number' },
    ],
  },
  {
    key: 'bids',
    label: 'Заявки',
    icon: <Receipt className="w-4 h-4" strokeWidth={1.5} />,
    searchKeys: ['bid_number', 'announcement_number', 'supplier_name'],
    statusField: 'status',
    columns: [
      { header: 'Номер заявки', key: 'bid_number', sortable: true },
      { header: 'Объявление', key: 'announcement_number', sortable: true },
      { header: 'Поставщик', key: 'supplier_name', sortable: true },
      { header: 'Цена', key: 'offered_amount', sortable: true, render: (row) => formatCurrency(row.offered_amount) },
      { header: 'Дата подачи', key: 'date_apply', sortable: true, render: (row) => formatDateTime(row.date_apply) },
      { header: 'Статус', key: 'status', sortable: true, render: (row) => <StatusBadge label={row.status} tone={row.status === 'Победила' ? 'success' : row.status === 'Подана' ? 'warning' : 'danger'} /> },
    ],
    fields: [
      { name: 'participant_bin', label: 'Поставщик', type: 'select', optionsKey: 'participants', searchable: true, searchPlaceholder: 'Поиск поставщика по БИН или названию...', required: true },
      { name: 'buy_id', label: 'Объявление', type: 'select', optionsKey: 'announcements', searchable: true, searchPlaceholder: 'Поиск объявления по номеру или названию...', required: true },
      { name: 'prot_number', label: 'Номер заявки', type: 'text', required: true },
      { name: 'date_apply', label: 'Дата подачи', type: 'datetime-local' },
      { name: 'status', label: 'Статус', type: 'select', options: [{ value: 'Подана', label: 'Подана' }, { value: 'Отклонена', label: 'Отклонена' }, { value: 'Победила', label: 'Победила' }] },
      { name: 'result', label: 'Итог', type: 'text' },
      { name: 'place', label: 'Место', type: 'number' },
    ],
  },
  {
    key: 'lots',
    label: 'Лоты',
    icon: <Boxes className="w-4 h-4" strokeWidth={1.5} />,
    searchKeys: ['lot_number', 'announcement_number', 'name_ru'],
    statusField: 'status_label',
    columns: [
      { header: 'Номер лота', key: 'lot_number', sortable: true },
      { header: 'Объявление', key: 'announcement_number', sortable: true },
      { header: 'Наименование', key: 'name_ru', sortable: true },
      { header: 'Категория', key: 'category', sortable: true },
      { header: 'Сумма', key: 'amount', sortable: true, render: (row) => formatCurrency(row.amount) },
      { header: 'Статус', key: 'status_label', sortable: true, render: (row) => <StatusBadge label={row.status_label} tone={row.status === 320 ? 'success' : 'warning'} /> },
    ],
    fields: [
      { name: 'participant_bin', label: 'Поставщик', type: 'select', optionsKey: 'participants', searchable: true, searchPlaceholder: 'Поиск поставщика по БИН или названию...', required: true },
      { name: 'application_id', label: 'Заявка', type: 'select', optionsKey: 'bids', searchable: true, searchPlaceholder: 'Поиск заявки по номеру...', required: true },
      { name: 'lot_number', label: 'Номер лота', type: 'text', required: true },
      { name: 'name_ru', label: 'Наименование', type: 'text', fullWidth: true, required: true },
      { name: 'category', label: 'Категория', type: 'text' },
      { name: 'quantity', label: 'Количество', type: 'number' },
      { name: 'price', label: 'Цена', type: 'number' },
      { name: 'price_offer', label: 'Цена предложения', type: 'number' },
      { name: 'amount', label: 'Сумма', type: 'number', required: true },
      { name: 'ref_lot_status_id', label: 'Статус', type: 'select', options: [{ value: 310, label: 'Прием заявок' }, { value: 320, label: 'Итоги подведены' }] },
      { name: 'winner_name', label: 'Победитель', type: 'text' },
    ],
  },
  {
    key: 'contracts',
    label: 'Договоры',
    icon: <FileCheck className="w-4 h-4" strokeWidth={1.5} />,
    searchKeys: ['contract_number_sys', 'contract_number', 'customer_name_ru'],
    statusField: 'status_label',
    columns: [
      { header: 'Системный №', key: 'contract_number_sys', sortable: true },
      { header: 'Номер договора', key: 'contract_number', sortable: true },
      { header: 'Объявление', key: 'trd_buy_number_anno', sortable: true },
      { header: 'Заказчик', key: 'customer_name_ru', sortable: true },
      { header: 'Сумма', key: 'amount', sortable: true, render: (row) => formatCurrency(row.amount) },
      { header: 'Статус', key: 'status_label', sortable: true, render: (row) => <StatusBadge label={row.status_label} tone={row.ref_contract_status_id === 350 ? 'success' : row.ref_contract_status_id === 390 ? 'danger' : 'warning'} /> },
    ],
    fields: [
      { name: 'participant_bin', label: 'Поставщик', type: 'select', optionsKey: 'participants', searchable: true, searchPlaceholder: 'Поиск поставщика по БИН или названию...', required: true },
      { name: 'customer_bin', label: 'Заказчик', type: 'select', optionsKey: 'customers', searchable: true, searchPlaceholder: 'Поиск заказчика по БИН или названию...' },
      { name: 'trd_buy_id', label: 'Связанное объявление', type: 'select', optionsKey: 'announcements', searchable: true, searchPlaceholder: 'Поиск объявления по номеру или названию...', required: true },
      { name: 'contract_number_sys', label: 'Системный номер', type: 'text', required: true },
      { name: 'contract_number', label: 'Номер договора', type: 'text', required: true },
      { name: 'crdate', label: 'Дата заключения', type: 'date' },
      { name: 'amount', label: 'Сумма', type: 'number', required: true },
      { name: 'ref_contract_status_id', label: 'Статус', type: 'select', options: [{ value: 320, label: 'На исполнении' }, { value: 350, label: 'Исполнен' }, { value: 390, label: 'Расторгнут' }] },
      { name: 'fin_year', label: 'Финансовый год', type: 'number' },
    ],
  },
  {
    key: 'contract-items',
    label: 'Предметы договора',
    icon: <ClipboardList className="w-4 h-4" strokeWidth={1.5} />,
    searchKeys: ['contract_number', 'name_ru'],
    statusField: 'execution_status',
    columns: [
      { header: 'Договор', key: 'contract_number', sortable: true },
      { header: 'Предмет', key: 'name_ru', sortable: true },
      { header: 'Количество', key: 'quantity', sortable: true },
      { header: 'Сумма', key: 'total_sum_wnds', sortable: true, render: (row) => formatCurrency(row.total_sum_wnds) },
      { header: 'Факт оплаты', key: 'fact_sum_wnds', sortable: true, render: (row) => formatCurrency(row.fact_sum_wnds) },
      { header: 'Казсодержание', key: 'ks_proc', sortable: true, render: (row) => `${row.ks_proc || 0}%` },
    ],
    fields: [
      { name: 'participant_bin', label: 'Поставщик', type: 'select', optionsKey: 'participants', searchable: true, searchPlaceholder: 'Поиск поставщика по БИН или названию...', required: true },
      { name: 'contract_id', label: 'Договор', type: 'select', optionsKey: 'contracts', searchable: true, searchPlaceholder: 'Поиск договора по номеру...', required: true },
      { name: 'lot_id', label: 'Лот', type: 'select', optionsKey: 'lots', searchable: true, searchPlaceholder: 'Поиск лота по номеру...', required: true },
      { name: 'name_ru', label: 'Предмет', type: 'text', fullWidth: true, required: true },
      { name: 'quantity', label: 'Количество', type: 'number' },
      { name: 'total_sum_wnds', label: 'Сумма', type: 'number', required: true },
      { name: 'fact_sum_wnds', label: 'Факт оплаты', type: 'number' },
      { name: 'ks_proc', label: 'Казсодержание', type: 'number' },
      { name: 'execution_status', label: 'Статус исполнения', type: 'text' },
    ],
  },
  {
    key: 'acts',
    label: 'Акты',
    icon: <ScrollText className="w-4 h-4" strokeWidth={1.5} />,
    searchKeys: ['number_act', 'contract_number', 'supplier_name'],
    statusField: 'status_name_ru',
    columns: [
      { header: 'Номер акта', key: 'number_act', sortable: true },
      { header: 'Договор', key: 'contract_number', sortable: true },
      { header: 'Поставщик', key: 'supplier_name', sortable: true },
      { header: 'Дата', key: 'akt_date', sortable: true, render: (row) => formatDate(row.akt_date) },
      { header: 'Сумма', key: 'sum_transfer', sortable: true, render: (row) => formatCurrency(row.sum_transfer) },
      { header: 'Статус', key: 'status_name_ru', sortable: true, render: (row) => <StatusBadge label={row.status_name_ru || 'Не указано'} tone="info" /> },
    ],
    fields: [
      { name: 'participant_bin', label: 'Поставщик', type: 'select', optionsKey: 'participants', searchable: true, searchPlaceholder: 'Поиск поставщика по БИН или названию...', required: true },
      { name: 'contract_id', label: 'Договор', type: 'select', optionsKey: 'contracts', searchable: true, searchPlaceholder: 'Поиск договора по номеру...', required: true },
      { name: 'number_act', label: 'Номер акта', type: 'text', required: true },
      { name: 'akt_date', label: 'Дата акта', type: 'date' },
      { name: 'sum_transfer', label: 'Сумма', type: 'number', required: true },
      { name: 'status_id', label: 'Код статуса', type: 'number' },
      { name: 'status_name_ru', label: 'Статус', type: 'text' },
      { name: 'day_overdue', label: 'Просрочка (дн.)', type: 'number' },
      { name: 'sum_fine', label: 'Штраф', type: 'number' },
      { name: 'description', label: 'Описание работ / поставки', type: 'textarea', fullWidth: true },
    ],
  },
  {
    key: 'complaints',
    label: 'Жалобы',
    icon: <MessageSquareWarning className="w-4 h-4" strokeWidth={1.5} />,
    searchKeys: ['complaint_number', 'applicant_name', 'supplier_name', 'customer_name'],
    statusField: 'status',
    columns: [
      { header: 'Номер жалобы', key: 'complaint_number', sortable: true },
      { header: 'Дата', key: 'date', sortable: true, render: (row) => formatDate(row.date) },
      { header: 'Заявитель', key: 'applicant_name', sortable: true },
      { header: 'Поставщик', key: 'supplier_name', sortable: true },
      { header: 'Заказчик', key: 'customer_name', sortable: true },
      { header: 'Статус', key: 'status', sortable: true, render: (row) => <StatusBadge label={row.status} tone={row.status.includes('Отклон') ? 'danger' : row.status.includes('Рассматр') ? 'warning' : 'success'} /> },
    ],
    fields: [
      { name: 'participant_bin', label: 'Поставщик', type: 'select', optionsKey: 'participants', searchable: true, searchPlaceholder: 'Поиск поставщика по БИН или названию...', required: true },
      { name: 'complaint_number', label: 'Номер жалобы', type: 'text', required: true },
      { name: 'date', label: 'Дата подачи', type: 'date' },
      { name: 'applicant_name', label: 'Заявитель', type: 'text', required: true },
      { name: 'applicant_bin', label: 'БИН заявителя', type: 'text' },
      { name: 'customer_name', label: 'Заказчик', type: 'text' },
      { name: 'customer_bin', label: 'БИН заказчика', type: 'select', optionsKey: 'customers', searchable: true, searchPlaceholder: 'Поиск заказчика по БИН или названию...' },
      { name: 'related_tender_id', label: 'Связанный тендер', type: 'select', optionsKey: 'announcements', searchable: true, searchPlaceholder: 'Поиск тендера по номеру или названию...' },
      { name: 'related_contract_id', label: 'Связанный договор', type: 'select', optionsKey: 'contracts', searchable: true, searchPlaceholder: 'Поиск договора по номеру...' },
      { name: 'subject', label: 'Тема жалобы', type: 'text', fullWidth: true, required: true },
      { name: 'description', label: 'Описание', type: 'textarea', fullWidth: true, required: true },
      { name: 'status', label: 'Статус', type: 'select', options: [{ value: 'Рассматривается', label: 'Рассматривается' }, { value: 'Решена', label: 'Решена' }, { value: 'Отклонена', label: 'Отклонена' }], required: true },
      { name: 'decision', label: 'Решение', type: 'textarea', fullWidth: true },
    ],
  },
  {
    key: 'rnu',
    label: 'РНУ',
    icon: <ShieldAlert className="w-4 h-4" strokeWidth={1.5} />,
    searchKeys: ['supplier_name_ru', 'supplier_biin', 'customer_name_ru'],
    statusField: 'status',
    columns: [
      { header: 'Поставщик', key: 'supplier_name_ru', sortable: true },
      { header: 'БИН', key: 'supplier_biin', sortable: true },
      { header: 'Основание', key: 'ref_reason_id', sortable: true, render: (row) => row.ref_reason_id ? `Причина #${row.ref_reason_id}` : 'Не указано' },
      { header: 'Дата включения', key: 'start_date', sortable: true, render: (row) => formatDate(row.start_date) },
      { header: 'Дата окончания', key: 'end_date', sortable: true, render: (row) => formatDate(row.end_date) },
      { header: 'Статус', key: 'status', sortable: true, render: (row) => <StatusBadge label={row.status} tone={row.status === 'Активен' ? 'danger' : 'neutral'} /> },
    ],
    fields: [
      { name: 'participant_bin', label: 'Поставщик', type: 'select', optionsKey: 'participants', searchable: true, searchPlaceholder: 'Поиск поставщика по БИН или названию...', required: true },
      { name: 'customer_biin', label: 'Заказчик', type: 'select', optionsKey: 'customers', searchable: true, searchPlaceholder: 'Поиск заказчика по БИН или названию...' },
      { name: 'customer_name_ru', label: 'Заказчик (текст)', type: 'text' },
      { name: 'ref_reason_id', label: 'Код основания', type: 'number' },
      { name: 'court_decision', label: 'Основание / решение', type: 'textarea', fullWidth: true },
      { name: 'start_date', label: 'Дата включения', type: 'date', required: true },
      { name: 'end_date', label: 'Дата окончания', type: 'date' },
      { name: 'status', label: 'Статус', type: 'select', options: [{ value: 'Активен', label: 'Активен' }, { value: 'Завершен', label: 'Завершен' }] },
    ],
  },
];

const TrustScoreSettingsSection = ({ settings, validationErrors, onChange, onSave, onReset, saving }) => {
  const weights = settings?.weights || {};
  const thresholds = settings?.thresholds || {};
  const riskLevels = settings?.risk_levels || {};
  const weightSum = Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0);

  const setWeight = (key, value) => {
    onChange({
      ...settings,
      weights: {
        ...weights,
        [key]: normalizeIntegerInputValue(value),
      },
    });
  };

  const setThreshold = (key, value) => {
    onChange({
      ...settings,
      thresholds: {
        ...thresholds,
        [key]: normalizeIntegerInputValue(value),
      },
    });
  };

  const setRiskLevelValue = (key, value, isNumeric = false) => {
    onChange({
      ...settings,
      risk_levels: {
        ...riskLevels,
        [key]: isNumeric ? normalizeIntegerInputValue(value) : value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <InfoCard title="Настройки Trust Score">
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Веса индикаторов</h3>
            <div className="space-y-4">
              {[
                ['participation', 'Participation weight'],
                ['competition', 'Competition weight'],
                ['win_rate', 'Win Rate weight'],
                ['execution', 'Execution weight'],
                ['quality', 'Quality weight'],
                ['risk_penalty', 'Risk penalty weight'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={weights[key] ?? ''}
                    onChange={(event) => setWeight(key, event.target.value)}
                    className={`h-10 w-full rounded-md border px-3 text-sm text-slate-700 ${validationErrors[`weight:${key}`] ? 'border-red-300 focus:border-red-400' : 'border-slate-300'}`}
                  />
                  {validationErrors[`weight:${key}`] && <p className="mt-1 text-xs text-red-600">{validationErrors[`weight:${key}`]}</p>}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Пороги доверия и риска</h3>
            <div className="space-y-4">
              {[
                ['high_trust', 'Высокий уровень доверия'],
                ['reliable', 'Надежный'],
                ['medium_risk', 'Средний риск'],
                ['high_risk', 'Высокий риск'],
                ['critical_risk', 'Критический риск'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={thresholds[key] ?? ''}
                    onChange={(event) => setThreshold(key, event.target.value)}
                    className={`h-10 w-full rounded-md border px-3 text-sm text-slate-700 ${validationErrors[`threshold:${key}`] ? 'border-red-300 focus:border-red-400' : 'border-slate-300'}`}
                  />
                  {validationErrors[`threshold:${key}`] && <p className="mt-1 text-xs text-red-600">{validationErrors[`threshold:${key}`]}</p>}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          <SectionCard>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Пороги назначения уровня риска</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Низкий риск от</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={riskLevels.low_min ?? ''}
                  onChange={(event) => setRiskLevelValue('low_min', event.target.value, true)}
                  className={`h-10 w-full rounded-md border px-3 text-sm text-slate-700 ${validationErrors['risk:low_min'] ? 'border-red-300 focus:border-red-400' : 'border-slate-300'}`}
                />
                {validationErrors['risk:low_min'] && <p className="mt-1 text-xs text-red-600">{validationErrors['risk:low_min']}</p>}
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Средний риск от</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={riskLevels.medium_min ?? ''}
                  onChange={(event) => setRiskLevelValue('medium_min', event.target.value, true)}
                  className={`h-10 w-full rounded-md border px-3 text-sm text-slate-700 ${validationErrors['risk:medium_min'] ? 'border-red-300 focus:border-red-400' : 'border-slate-300'}`}
                />
                {validationErrors['risk:medium_min'] && <p className="mt-1 text-xs text-red-600">{validationErrors['risk:medium_min']}</p>}
              </div>
              <p className="text-xs text-slate-500">
                Значения ниже порога среднего риска автоматически попадают в высокий риск.
              </p>
            </div>
          </SectionCard>

          <SectionCard>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Названия уровней риска</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Название низкого риска</label>
                <input
                  type="text"
                  value={riskLevels.low_label ?? 'Низкий риск'}
                  onChange={(event) => setRiskLevelValue('low_label', event.target.value)}
                  className={`h-10 w-full rounded-md border px-3 text-sm text-slate-700 ${validationErrors['risk:low_label'] ? 'border-red-300 focus:border-red-400' : 'border-slate-300'}`}
                />
                {validationErrors['risk:low_label'] && <p className="mt-1 text-xs text-red-600">{validationErrors['risk:low_label']}</p>}
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Название среднего риска</label>
                <input
                  type="text"
                  value={riskLevels.medium_label ?? 'Средний риск'}
                  onChange={(event) => setRiskLevelValue('medium_label', event.target.value)}
                  className={`h-10 w-full rounded-md border px-3 text-sm text-slate-700 ${validationErrors['risk:medium_label'] ? 'border-red-300 focus:border-red-400' : 'border-slate-300'}`}
                />
                {validationErrors['risk:medium_label'] && <p className="mt-1 text-xs text-red-600">{validationErrors['risk:medium_label']}</p>}
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Название высокого риска</label>
                <input
                  type="text"
                  value={riskLevels.high_label ?? 'Высокий риск'}
                  onChange={(event) => setRiskLevelValue('high_label', event.target.value)}
                  className={`h-10 w-full rounded-md border px-3 text-sm text-slate-700 ${validationErrors['risk:high_label'] ? 'border-red-300 focus:border-red-400' : 'border-slate-300'}`}
                />
                {validationErrors['risk:high_label'] && <p className="mt-1 text-xs text-red-600">{validationErrors['risk:high_label']}</p>}
              </div>
            </div>
          </SectionCard>
        </div>

        <div className={`mt-6 rounded-lg border px-4 py-3 text-sm ${weightSum === 100 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          Сумма весов: {weightSum}%. {weightSum === 100 ? 'Настройка корректна.' : 'Сумма должна быть равна 100%.'}
        </div>
        {validationErrors['weight:sum'] && <p className="mt-2 text-sm text-red-600">{validationErrors['weight:sum']}</p>}

        <div className="mt-6 flex flex-wrap gap-3">
          <PrimaryButton onClick={onSave} disabled={saving || weightSum !== 100}>{saving ? 'Сохранение...' : 'Сохранить настройки'}</PrimaryButton>
          <SecondaryButton onClick={onReset} disabled={saving}>Сбросить по умолчанию</SecondaryButton>
        </div>
      </InfoCard>
    </div>
  );
};

const AdminEntitySection = ({ section, rows, options, loading, errorMessage, onCreate, onEdit, onDelete }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState(section.columns[0]?.key || 'id');
  const [sortDirection, setSortDirection] = useState('asc');

  const statusOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((row) => row[section.statusField]).filter(Boolean)));
    return values;
  }, [rows, section.statusField]);

  const filteredRows = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !needle || section.searchKeys.some((key) => String(row[key] ?? '').toLowerCase().includes(needle));
      const matchesStatus = statusFilter === 'all' || String(row[section.statusField] ?? '') === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, searchQuery, section.searchKeys, section.statusField, statusFilter]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((left, right) => compareValues(left[sortKey], right[sortKey], sortDirection));
  }, [filteredRows, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const pagedRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const columns = [
    ...section.columns,
    {
      header: 'Действия',
      key: 'actions',
      render: (row) => (
        <div className="flex gap-2">
          <SecondaryButton
            onClick={(event) => {
              event.stopPropagation();
              onEdit(row);
            }}
            className="px-3 py-1 text-xs"
          >
            <Pencil className="w-3.5 h-3.5 mr-1" strokeWidth={1.5} />
            Редактировать
          </SecondaryButton>
          <DangerButton
            onClick={(event) => {
              event.stopPropagation();
              onDelete(row);
            }}
            className="px-3 py-1 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" strokeWidth={1.5} />
            Удалить
          </DangerButton>
        </div>
      ),
    },
  ];

  return (
    <InfoCard
      title={section.label}
      actions={(
        <PrimaryButton onClick={onCreate}>
          <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
          Создать
        </PrimaryButton>
      )}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr_auto]">
          <SearchInput
            placeholder={`Поиск по разделу "${section.label}"...`}
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setPage(1);
            }}
          />
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
          >
            <option value="all">Все статусы</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <SecondaryButton
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setPage(1);
            }}
          >
            Сбросить
          </SecondaryButton>
        </div>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            Загрузка данных...
          </div>
        ) : errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-10 text-center text-sm text-red-600">
            {errorMessage}
          </div>
        ) : (
          <>
            <DataTable
              columns={columns.map((column) => ({ ...column, sortable: column.key !== 'actions' && column.sortable !== false }))}
              data={pagedRows}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={(key) => {
                setSortKey((currentKey) => {
                  if (currentKey === key) {
                    setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
                    return currentKey;
                  }
                  setSortDirection('asc');
                  return key;
                });
              }}
            />
            <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}

        <div className="text-sm text-slate-500">Всего записей: {rows.length}</div>
      </div>
    </InfoCard>
  );
};

export default function AdminPanel() {
  const location = useLocation();
  const defaultSection = location.pathname.includes('trust-score-settings') ? 'trust-settings' : 'participants';
  const [entityRows, setEntityRows] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [errorMap, setErrorMap] = useState({});
  const [options, setOptions] = useState({});
  const [dialogState, setDialogState] = useState({ open: false, section: null, record: null });
  const [deleteState, setDeleteState] = useState({ open: false, section: null, record: null });
  const [saving, setSaving] = useState(false);
  const [trustSettings, setTrustSettings] = useState(null);
  const trustSettingsValidation = useMemo(() => validateTrustSettingsPayload(trustSettings), [trustSettings]);

  const loadOptions = async () => {
    const response = await adminAPI.getOptions();
    setOptions(response.data);
  };

  const loadTrustSettings = async () => {
    const response = await adminAPI.getTrustScoreSettings();
    setTrustSettings(response.data);
  };

  const loadEntity = async (entity) => {
    setLoadingMap((current) => ({ ...current, [entity]: true }));
    try {
      const response = await adminAPI.listEntity(entity);
      setEntityRows((current) => ({ ...current, [entity]: response.data.items || [] }));
      setErrorMap((current) => ({ ...current, [entity]: null }));
    } catch (error) {
      console.error(`Admin load failed for ${entity}`, error);
      toast.error(`Не удалось загрузить раздел "${entity}"`);
      setErrorMap((current) => ({ ...current, [entity]: 'Не удалось загрузить данные раздела' }));
    } finally {
      setLoadingMap((current) => ({ ...current, [entity]: false }));
    }
  };

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadOptions(),
      loadTrustSettings(),
      ...ENTITY_SECTIONS.map((section) => loadEntity(section.key)),
    ]);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSaveRecord = async (payload) => {
    const { section, record } = dialogState;
    setSaving(true);
    try {
      if (record?.id) {
        await adminAPI.updateEntity(section.key, record.id, payload);
        toast.success('Запись обновлена');
      } else {
        await adminAPI.createEntity(section.key, payload);
        toast.success('Запись создана');
      }
      setDialogState({ open: false, section: null, record: null });
      await Promise.all([loadEntity(section.key), loadOptions()]);
    } catch (error) {
      console.error('Admin save failed', error);
      toast.error(error?.response?.data?.detail || 'Не удалось сохранить запись');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async () => {
    const { section, record } = deleteState;
    if (!section || !record) return;

    setSaving(true);
    try {
      await adminAPI.deleteEntity(section.key, record.id);
      toast.success('Запись удалена');
      setDeleteState({ open: false, section: null, record: null });
      await Promise.all([loadEntity(section.key), loadOptions()]);
    } catch (error) {
      console.error('Admin delete failed', error);
      toast.error(error?.response?.data?.detail || 'Не удалось удалить запись');
    } finally {
      setSaving(false);
    }
  };

  const saveTrustSettings = async () => {
    if (Object.keys(trustSettingsValidation.errors).length > 0) {
      toast.error(trustSettingsValidation.errors['weight:sum'] || 'Проверьте значения весов, порогов и названий риска');
      return;
    }
    setSaving(true);
    try {
      const response = await adminAPI.updateTrustScoreSettings(trustSettings);
      setTrustSettings(response.data);
      toast.success('Настройки Trust Score сохранены');
    } catch (error) {
      console.error('Trust score settings save failed', error);
      toast.error(error?.response?.data?.detail || 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  const resetTrustSettings = async () => {
    setSaving(true);
    try {
      const response = await adminAPI.resetTrustScoreSettings();
      setTrustSettings(response.data);
      toast.success('Настройки сброшены по умолчанию');
    } catch (error) {
      console.error('Trust score settings reset failed', error);
      toast.error('Не удалось сбросить настройки');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    ...ENTITY_SECTIONS.map((section) => ({
      value: section.key,
      label: section.label,
      icon: section.icon,
      content: (
        <AdminEntitySection
          section={section}
          rows={entityRows[section.key] || []}
          options={options}
          loading={loadingMap[section.key]}
          errorMessage={errorMap[section.key]}
          onCreate={() => setDialogState({ open: true, section, record: null })}
          onEdit={(record) => setDialogState({ open: true, section, record })}
          onDelete={(record) => setDeleteState({ open: true, section, record })}
        />
      ),
    })),
    {
      value: 'trust-settings',
      label: 'Trust Score',
      icon: <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />,
      content: (
        <TrustScoreSettingsSection
          settings={trustSettings}
          validationErrors={trustSettingsValidation.errors}
          onChange={setTrustSettings}
          onSave={saveTrustSettings}
          onReset={resetTrustSettings}
          saving={saving}
        />
      ),
    },
  ];

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold text-slate-900">Admin Panel</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Управление участниками, объявлениями, заявками, лотами, договорами, актами, жалобами, РНУ и параметрами
            расчета индикатора надежности. Изменения сохраняются в локальной базе и сразу отражаются в витринах сайта.
          </p>
        </div>

        <ContentSwitcher tabs={tabs} defaultTab={defaultSection} />
      </div>

      <AdminRecordDialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState((current) => ({ ...current, open }))}
        section={dialogState.section}
        options={options}
        initialData={dialogState.record}
        onSubmit={handleSaveRecord}
        saving={saving}
      />

      <AlertDialog open={deleteState.open} onOpenChange={(open) => setDeleteState((current) => ({ ...current, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить запись? Если она связана с договорами, заявками или жалобами, связанные
              витрины изменятся сразу после сохранения.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecord} className="bg-red-600 hover:bg-red-700">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
