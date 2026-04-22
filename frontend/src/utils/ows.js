export const formatCurrency = (value) => {
  return `${new Intl.NumberFormat('ru-RU').format(Number(value || 0))} ₸`;
};

export const formatDate = (value) => {
  if (!value) return 'Не указано';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('ru-RU');
};

export const formatDateTime = (value) => {
  if (!value) return 'Не указано';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ru-RU');
};

export const getTypeSupplierLabel = (value) => {
  const labels = {
    1: 'Юридическое лицо',
    2: 'Физическое лицо',
    3: 'ИП',
  };

  return labels[value] || `Тип #${value || '-'}`;
};

export const getTradeMethodLabel = (value) => {
  const labels = {
    1: 'Открытый конкурс',
    2: 'Из одного источника',
    7: 'Аукцион',
    31: 'Запрос ценовых предложений',
  };

  return labels[value] || `Способ #${value || '-'}`;
};

export const getBuyStatusLabel = (value) => {
  const labels = {
    310: 'Опубликовано',
    320: 'Прием заявок',
    340: 'Итоги подведены',
  };

  return labels[value] || `Статус #${value || '-'}`;
};

export const getContractStatusLabel = (value) => {
  const labels = {
    320: 'На исполнении',
    350: 'Исполнен',
    390: 'Расторгнут',
  };

  return labels[value] || `Статус #${value || '-'}`;
};

export const getAddressTypeLabel = (value) => {
  const labels = {
    1: 'Юридический адрес',
    2: 'Фактический адрес',
    3: 'Почтовый адрес',
  };

  return labels[value] || `Тип адреса #${value || '-'}`;
};

export const getEmployeeRoleLabel = (value) => {
  const labels = {
    1: 'Руководитель',
    2: 'Сотрудник',
  };

  return labels[value] || `Роль #${value || '-'}`;
};

export const getApplicationAmount = (application) => {
  return (application.app_lots || []).reduce((sum, lot) => sum + Number(lot.amount || 0), 0);
};
