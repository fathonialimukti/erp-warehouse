let csrfToken: string | null = null;

export const getCsrfToken = () => csrfToken;

export const fetchCsrfToken = async () => {
  const res = await fetch('/api/csrf', { credentials: 'include' });
  const data = (await res.json()) as { token: string };
  csrfToken = data.token;
  return csrfToken;
};

export const initCsrf = async () => {
  await fetchCsrfToken();
  // Refresh every hour
  setInterval(fetchCsrfToken, 60 * 60 * 1000);
};
