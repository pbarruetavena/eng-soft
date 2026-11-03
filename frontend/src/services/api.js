// Cliente HTTP base da API. Os demais serviços (subscriptions, stats...) usam esta função.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Erro ${response.status} ao acessar a API`);
  }
  return data;
}

export function getHealth() {
  return request('/health');
}

export function listSubscriptions(status = 'ativo') {
  return request(`/subscriptions?status=${status}`);
}

export function createSubscription(dados) {
  return request('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

export function updateSubscription(id, dados) {
  return request(`/subscriptions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  });
}

export function deleteSubscription(id) {
  return request(`/subscriptions/${id}`, {
    method: 'DELETE',
  });
}

export function excluirSubscription(id) {
  return request(`/subscriptions/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ ativo: false })
  });
}

export async function getSubscriptionSummary() {
  return request(
    "/subscriptions/summary",
    {
      method: 'GET',
    },
  );
}

export function getMonthlyEvolution() {
  return request('/stats/monthly-evolution');
}
