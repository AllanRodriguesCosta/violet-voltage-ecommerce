// Regras de especulação (Chrome e Edge): quando o cursor para sobre um link da loja, o navegador
// baixa a página antes do clique e a navegação abre quase na hora. Só "prefetch" (nada roda antes
// do clique). Ficam de fora a API, o painel, o checkout, o pedido e links com data-no-prefetch.
// O servidor entrega estas regras em /speculation-rules.json pelo cabeçalho Speculation-Rules,
// o que não exige liberar script inline na política de segurança (CSP).
export const SPECULATION_RULES = {
  prefetch: [
    {
      where: {
        and: [
          { href_matches: "/*" },
          { not: { href_matches: ["/api/*", "/admin.html", "/checkout.html", "/pedido.html"] } },
          { not: { selector_matches: "[data-no-prefetch], [rel~=nofollow], [download]" } },
        ],
      },
      eagerness: "moderate",
    },
  ],
};
