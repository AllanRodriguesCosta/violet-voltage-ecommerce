// Etapa 34: carrinho espelhado na conta. Ao entrar, junta o carrinho deste navegador com o salvo
// (uma vez por sessão da aba); depois, cada mudança é enviada com um pequeno atraso.
const validId = (id) => typeof id === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(id);
// Itens diferentes somam; no mesmo item vale a maior quantidade (outro aparelho não duplica).
export function mergeCarts(local, saved) {
  const out = new Map((saved || []).filter((i) => validId(i?.id)).map((i) => [i.id, i]));
  for (const i of local || []) {
    const prev = out.get(i.id);
    out.set(i.id, prev ? { ...prev, ...i, quantidade: Math.min(99, Math.max(prev.quantidade, i.quantidade)) } : i);
  }
  return [...out.values()].slice(0, 30);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function createCartSync({ request, read, write, wait = 800, store = globalThis.sessionStorage }) {
  let user = null;
  let timer = null;
  const push = (items) => request("/cart", { itens: items }, "PUT").catch(() => {});
  return {
    async start(current) {
      user = current || null;
      if (!user) return null;
      const key = `vv_cart_synced_${user.id || "conta"}`;
      try {
        if (store?.getItem(key)) return null;
        const saved = (await request("/cart")).itens || [];
        const merged = mergeCarts(read(), saved);
        if (!same(merged, read())) write(merged);
        if (!same(merged, saved)) await push(merged);
        store?.setItem(key, "1");
        return merged;
      } catch {
        return null;
      }
    },
    changed(items) {
      if (!user) return;
      clearTimeout(timer);
      timer = setTimeout(() => push(items), wait);
    },
    stop() {
      user = null;
      clearTimeout(timer);
    },
  };
}
