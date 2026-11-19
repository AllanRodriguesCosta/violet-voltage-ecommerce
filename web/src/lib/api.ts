// Chamadas à API da loja (/api/...): JSON com cookie da sessão e mensagens de erro em português.
export type ApiError = Error & { status?: number; field?: string };

// Leituras (GET) tentam de novo quando a conexão cai ou o servidor responde 502/503/504 — o
// plano gratuito do Render "acorda" o servidor na primeira visita. Envios (POST, PUT...) nunca
// repetem sozinhos, para não duplicar pedido ou pagamento.
const RETRY_STATUS = new Set([502, 503, 504]);
export const retryDelays = [600, 1800];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url: string, init: RequestInit): Promise<Response> {
  const idempotent = !init.method || init.method.toUpperCase() === "GET";
  for (let attempt = 0; ; attempt++) {
    const last = !idempotent || attempt >= retryDelays.length || init.signal?.aborted;
    try {
      const response = await fetch(url, init);
      if (last || !RETRY_STATUS.has(response.status)) return response;
    } catch (error) {
      if (last || (error as Error)?.name === "AbortError") throw error;
    }
    await wait(retryDelays[attempt]);
  }
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = options.body instanceof FormData ? {} : { "Content-Type": "application/json" };
  let response: Response;
  try {
    response = await request(`/api${path}`, { ...options, headers: { ...headers, ...(options.headers as Record<string, string>) }, credentials: "same-origin" });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new Error("Não foi possível conectar. Verifique sua conexão e tente novamente.");
  }
  let result: { data?: T; error?: { message?: string; field?: string } } | null;
  try {
    result = await response.json();
  } catch {
    const error: ApiError = new Error("O serviço não respondeu como esperado. Tente novamente em instantes.");
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const error: ApiError = new Error(result?.error?.message || "Não foi possível concluir.");
    error.field = result?.error?.field;
    error.status = response.status;
    throw error;
  }
  if (!result || typeof result !== "object" || !Object.hasOwn(result, "data")) throw new Error("O serviço retornou dados incompletos. Tente novamente em instantes.");
  return result.data as T;
}
export const send = <T = unknown>(path: string, body: unknown, method = "POST") => api<T>(path, { method, body: JSON.stringify(body) });
