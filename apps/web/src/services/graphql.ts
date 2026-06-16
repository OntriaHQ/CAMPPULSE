const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

function getToken(): string | null {
  return localStorage.getItem('cp_admin_token');
}

interface GqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string; locations?: Array<{ line: number; column: number }>; path?: string[] }>;
}

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const body: GqlResponse<T> = await res.json();

  if (body.errors?.length) {
    throw Object.assign(new Error(body.errors[0].message), { errors: body.errors });
  }

  return body.data as T;
}
