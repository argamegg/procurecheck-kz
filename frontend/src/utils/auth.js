const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const SEARCH_HISTORY_KEY = 'company_search_history';
const MAX_SEARCH_HISTORY_ITEMS = 5;
const VALID_APP_ROLES = new Set(['admin', 'user']);
const VALID_DEMO_EMAILS = new Set(['admin@procurecheck.kz', 'user@procurecheck.kz']);

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
  if (!user) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(user);

    if (!VALID_APP_ROLES.has(parsedUser?.role) || !VALID_DEMO_EMAILS.has(parsedUser?.email)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }

    return parsedUser;
  } catch (error) {
    localStorage.removeItem(USER_KEY);
    return null;
  }
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
    risk_label: company.risk_label,
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

export const isAdmin = () => {
  return getAuthUser()?.role === 'admin';
};

export const logout = () => {
  removeAuthToken();
  removeAuthUser();
};
