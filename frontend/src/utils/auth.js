const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const SEARCH_HISTORY_KEY = 'company_search_history';
const MAX_SEARCH_HISTORY_ITEMS = 5;

export const setAuthToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const getAuthToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const removeAuthToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const setAuthUser = (user) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getAuthUser = () => {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
};

const getSearchHistoryKey = () => {
  const user = getAuthUser();
  return `${SEARCH_HISTORY_KEY}:${user?.email || 'guest'}`;
};

export const getSearchHistory = () => {
  const rawHistory = localStorage.getItem(getSearchHistoryKey());

  if (!rawHistory) {
    return [];
  }

  try {
    const parsedHistory = JSON.parse(rawHistory);
    return Array.isArray(parsedHistory) ? parsedHistory : [];
  } catch (error) {
    localStorage.removeItem(getSearchHistoryKey());
    return [];
  }
};

export const addSearchHistoryEntry = (company) => {
  if (!company?.bin || !company?.name_ru) {
    return getSearchHistory();
  }

  const nextEntry = {
    bin: company.bin,
    name_ru: company.name_ru,
    risk_level: company.risk_level,
    trust_score: company.trust_score,
    is_blacklisted: company.is_blacklisted,
    viewed_at: new Date().toISOString(),
  };

  const updatedHistory = [
    nextEntry,
    ...getSearchHistory().filter((entry) => entry.bin !== company.bin),
  ].slice(0, MAX_SEARCH_HISTORY_ITEMS);

  localStorage.setItem(getSearchHistoryKey(), JSON.stringify(updatedHistory));

  return updatedHistory;
};

export const removeAuthUser = () => {
  localStorage.removeItem(USER_KEY);
};

export const isAuthenticated = () => {
  return !!getAuthToken();
};

export const logout = () => {
  removeAuthToken();
  removeAuthUser();
};
