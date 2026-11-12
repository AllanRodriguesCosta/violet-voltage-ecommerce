// Etapa 25: reforço opcional com o Gemini (plano gratuito do Google AI Studio). Só entra
// quando a PLN local não entendeu a frase; responde preso aos dados da loja (catálogo e
// regras) e, se falhar, demorar ou estourar o limite, a resposta local continua valendo.
// Sem SDK: fetch nativo. A chave vem só do ambiente (GEMINI_API_KEY) e nunca é registrada.
import { helpEntries } from "../knowledge/help.js";
import { specRows } from "../../public/js/specs.js";
import { anonymize } from "../services/assistant-log.js";

export const DEFAULT_MODEL = "gemini-flash-latest";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const brl = (cents) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

export function geminiConfig(env = process.env) {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = /^[\w.-]{3,60}$/.test(env.GEMINI_MODEL || "") ? env.GEMINI_MODEL : DEFAULT_MODEL;
  const timeoutMs = Math.min(15000, Math.max(1000, Number(env.GEMINI_TIMEOUT_MS) || 6000));
  const perMinute = Math.min(60, Math.max(1, Number(env.GEMINI_PER_MINUTE) || 8));
  return { apiKey, model, timeoutMs, perMinute };
}

// Limite próprio por minuto (abaixo do plano gratuito): acima dele, fica a resposta local.
export function limiter(perMinute, now = () => Date.now()) {
  let calls = [];
  return () => {
    const t = now();
    calls = calls.filter((x) => t - x < 60000);
    if (calls.length >= perMinute) return false;
    calls.push(t);
    return true;
  };
}

// Dados que o modelo pode usar: catálogo resumido e regras da Central de Ajuda.
export function grounding(products) {
  const catalog = products
    .filter((p) => p.ativo !== false)
    .map((p) => {
      const ficha = specRows(p)
        .map((r) => `${r.field.label}: ${r.text}`)
        .join("; ");
      return `${p.id} | ${p.marca} ${p.modelo} | ${p.categoria} | ${brl(p.priceCents)} | ${p.estoque > 0 ? "em estoque" : "esgotado"}${ficha ? ` | ${ficha}` : ""}`;
    })
    .join("\n");
  const rules = helpEntries.map((e) => `- ${e.pergunta} ${e.resposta}`).join("\n");
  return { catalog, rules };
}

export function instructions({ catalog, rules }) {
  return `Você é o assistente de compras da Violet Voltage, loja de guitarras, amplificadores, pedais e acessórios. Responda em português do Brasil, com no máximo 3 frases curtas e tom amigável.
Regras:
1. Use SOMENTE os dados abaixo. Nunca invente produto, preço, estoque, prazo, cupom ou regra.
2. Se a pergunta não for sobre música, equipamentos ou a loja, diga que só ajuda com a Violet Voltage.
3. Para indicar produtos, use os IDs do catálogo (até 3, só itens em estoque).
4. Não peça nem repita dados pessoais. Não prometa comprar, reservar ou alterar pedidos: o cliente faz isso no site.
5. Se não souber com estes dados, diga isso e sugira a Central de Ajuda.
Devolva só JSON: {"texto": "...", "produtos": ["demo-001"]}.

CATÁLOGO (id | produto | categoria | preço | estoque | ficha):
${catalog}

REGRAS DA LOJA:
${rules}`;
}

// Chama o Gemini e devolve { texto, produtos } validados, ou null em qualquer falha.
export async function askGemini(mensagem, products, config, { fetchImpl = fetch } = {}) {
  if (!config) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(config.model)}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions(grounding(products)) }] },
        contents: [{ role: "user", parts: [{ text: anonymize(mensagem) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400, responseMimeType: "application/json" },
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    const texto = typeof parsed.texto === "string" ? parsed.texto.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 600) : "";
    if (texto.length < 2) return null;
    const ids = new Set(products.filter((p) => p.estoque > 0).map((p) => p.id));
    const produtos = (Array.isArray(parsed.produtos) ? parsed.produtos : []).filter((id) => typeof id === "string" && ids.has(id)).slice(0, 3);
    return { texto, produtos };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
