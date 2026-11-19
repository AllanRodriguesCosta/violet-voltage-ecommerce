// Indicadores do painel: KPIs, vendas dos últimos 14 dias, pedidos por status, estoque baixo,
// vendas por categoria, mais vendidos, serviços e kits, interesse dos clientes e (etapa 35) o que
// os clientes procuram, carrinhos esquecidos e frases que o assistente não entendeu.
// Gráficos em SVG simples (sem biblioteca), com texto equivalente para leitor de tela.
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "../lib/icons";
import { money } from "../../../shared/catalog.js";
import { statuses, statusClass } from "../../../shared/orders.js";

type Day = { dia: string; totalCents: number; pedidos: number };
type Term = { termo: string; vezes: number; resultados?: number; corrigido?: string };
export type Summary = {
  totalCents: number;
  pedidos: number;
  ticketMedioCents: number;
  clientes: number;
  produtos: number;
  perguntasPendentes?: number;
  encomendasAbertas?: number;
  parceriasNovas?: number;
  vendasPorDia: Day[];
  porStatus: Record<string, number>;
  estoqueBaixo: { id: string; nome: string; estoque: number }[];
  procura?: { id: string; avisos: number }[];
  porCategoria?: { categoria: string; totalCents: number }[];
  cancelamentoPct?: number;
  maisVendidos?: { id: string; nome: string; unidades: number; totalCents: number }[];
  servicos?: { nome: string; quantidade: number; totalCents: number }[];
  kits?: { nome: string; quantidade: number; descontoCents: number }[];
  precoAvisos?: { id: string; nome: string; avisos: number }[];
  buscas?: { total: number; maisBuscados: Term[]; semResultado: Term[]; corrigidos?: Term[] };
  carrinhos?: { carrinhosSalvos: number; abandonados: number; itensAbandonados: number; lembretes: number };
  assistente?: { frasesNaoEntendidas: number; exemplos: { texto: string; vezes: number }[] };
};

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const productLink = (id: string) => `/produto.html?id=${encodeURIComponent(id)}`;

function SalesChart({ days }: { days: Day[] }) {
  const width = 560;
  const height = 190;
  const gap = 6;
  const bar = (width - gap * (days.length - 1)) / days.length;
  const max = Math.max(...days.map((d) => d.totalCents), 1);
  const total = days.reduce((s, d) => s + d.totalCents, 0);
  const count = days.reduce((s, d) => s + d.pedidos, 0);
  return (
    <>
      <svg className="sales-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Vendas dos últimos 14 dias: ${money(total)} em ${count} pedidos`}>
        {days.map((d, i) => {
          const h = d.totalCents ? Math.max(6, Math.round((d.totalCents / max) * (height - 34))) : 3;
          const x = i * (bar + gap);
          const label = shortDate.format(new Date(`${d.dia}T00:00:00Z`));
          return (
            <g key={d.dia}>
              <rect x={x.toFixed(1)} y={height - 22 - h} width={bar.toFixed(1)} height={h} rx="5" className={d.totalCents ? "bar" : "bar empty"}>
                <title>{`${label}: ${money(d.totalCents)} em ${d.pedidos} ${plural(d.pedidos, "pedido", "pedidos")}`}</title>
              </rect>
              {i % 2 === 1 && (
                <text x={(x + bar / 2).toFixed(1)} y={height - 6} textAnchor="middle">
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="small muted">
        No período: <strong>{money(total)}</strong> em {count} {plural(count, "pedido", "pedidos")}, sem cancelados.
      </p>
    </>
  );
}

function RankList<T>({ items, render, empty }: { items: T[]; render: (item: T, i: number) => ReactNode; empty: string }) {
  return items.length ? <ol className="rank-list">{items.map(render)}</ol> : <p className="muted">{empty}</p>;
}

function Insights({ s, onQuestions }: { s: Summary; onQuestions: () => void }) {
  const cats = s.porCategoria || [];
  const top = Math.max(1, ...cats.map((c) => c.totalCents));
  const extras = [...(s.servicos || []).map((x) => ({ ...x, tipo: "servico" as const })), ...(s.kits || []).map((x) => ({ ...x, tipo: "kit" as const }))];
  return (
    <div className="dash-grid dash-insights">
      <section className="panel">
        <h2>
          <Icon name="chart" size={18} />
          Vendas por categoria
        </h2>
        {cats.length ? (
          <ul className="status-bars category-bars">
            {cats.map((c) => (
              <li key={c.categoria}>
                <span>{c.categoria}</span>
                <span className="status-track">
                  <span style={{ width: `${Math.round((c.totalCents / top) * 100)}%` } as CSSProperties} />
                </span>
                <strong>{money(c.totalCents)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Sem vendas registradas ainda.</p>
        )}
        <p className="small muted">Cancelamentos: {s.cancelamentoPct || 0}% dos pedidos.</p>
      </section>
      <section className="panel">
        <h2>Mais vendidos</h2>
        <RankList
          items={s.maisVendidos || []}
          empty="Sem vendas registradas ainda."
          render={(v) => (
            <li key={v.id}>
              <a href={productLink(v.id)}>{v.nome}</a>
              <span>
                {v.unidades} un. · {money(v.totalCents)}
              </span>
            </li>
          )}
        />
      </section>
      <section className="panel">
        <h2>Serviços e kits</h2>
        <RankList
          items={extras}
          empty="Nenhum serviço ou kit vendido ainda."
          render={(x, i) => (
            <li key={i}>
              <span>{x.nome}</span>
              <span>
                {x.quantidade}x · {x.tipo === "kit" ? `− ${money(x.descontoCents)} em desconto` : money(x.totalCents)}
              </span>
            </li>
          )}
        />
      </section>
      <section className="panel">
        <h2>Interesse dos clientes</h2>
        <RankList
          items={(s.precoAvisos || []).slice(0, 5)}
          empty="Nenhum aviso de queda de preço ativo."
          render={(x) => (
            <li key={x.id}>
              <a href={productLink(x.id)}>{x.nome}</a>
              <span className="badge badge-demand">
                <Icon name="tag" size={14} />
                {x.avisos} {plural(x.avisos, "aviso", "avisos")} de preço
              </span>
            </li>
          )}
        />
        {!!s.perguntasPendentes && (
          <button type="button" className="text-button" data-open-questions onClick={onQuestions}>
            <Icon name="question" size={16} />
            {s.perguntasPendentes} {plural(s.perguntasPendentes, "pergunta aguardando", "perguntas aguardando")} resposta
          </button>
        )}
      </section>
    </div>
  );
}

function SearchBars({ items, label }: { items: Term[]; label: string }) {
  if (!items.length) return null;
  const max = Math.max(...items.map((x) => x.vezes), 1);
  const row = 26;
  return (
    <svg className="search-chart" viewBox={`0 0 380 ${items.length * row}`} role="img" aria-label={`${label}: ${items.map((x) => `${x.termo} ${x.vezes}`).join(", ")}`}>
      {items.map((x, i) => {
        const w = Math.max(4, Math.round((x.vezes / max) * 190));
        return (
          <g key={x.termo} transform={`translate(0 ${i * row})`}>
            <text x="0" y="16" className="bar-label">
              {x.termo.slice(0, 22)}
            </text>
            <rect x="150" y="4" height="16" rx="4" width={w} className={x.resultados === 0 ? "bar bar-miss" : "bar"} />
            <text x={156 + w} y="16" className="bar-value">
              {x.vezes}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Etapa 35: demanda (buscas, carrinhos esquecidos e assistente).
export function Demand({ s, onAssistant }: { s: Summary; onAssistant?: () => void }) {
  const b = s.buscas || { total: 0, maisBuscados: [], semResultado: [], corrigidos: [] };
  const c = s.carrinhos || { carrinhosSalvos: 0, abandonados: 0, itensAbandonados: 0, lembretes: 0 };
  const a = s.assistente || { frasesNaoEntendidas: 0, exemplos: [] };
  return (
    <div className="dash-grid dash-insights dash-demand">
      <section className="panel">
        <h2>
          <Icon name="search" size={18} />O que mais procuram
        </h2>
        {b.maisBuscados.length ? <SearchBars items={b.maisBuscados} label="Buscas mais feitas" /> : <p className="muted">Nenhuma busca registrada ainda.</p>}
        <p className="small muted">
          {b.total} {plural(b.total, "busca", "buscas")} nos últimos 90 dias, sem identificar quem buscou.
        </p>
      </section>
      <section className="panel">
        <h2>
          <Icon name="alert" size={18} />
          Buscas sem resultado
        </h2>
        {b.semResultado.length ? (
          <>
            <ul className="rank-list miss-list">
              {b.semResultado.map((x) => (
                <li key={x.termo}>
                  <span>{`“${x.termo}”`}</span>
                  <span>{x.vezes}x · sem resultado</span>
                </li>
              ))}
            </ul>
            <p className="small muted">Itens procurados que o catálogo não tem: bons candidatos a encomenda ou a novos fornecedores.</p>
          </>
        ) : (
          <p className="muted">Nenhuma busca sem resultado.</p>
        )}
        {!!b.corrigidos?.length && (
          <p className="small muted">
            Corrigidas pela busca tolerante:{" "}
            {b.corrigidos
              .slice(0, 4)
              .map((x) => `“${x.termo}” → “${x.corrigido}”`)
              .join(", ")}
            .
          </p>
        )}
      </section>
      <section className="panel">
        <h2>
          <Icon name="bag" size={18} />
          Carrinhos esquecidos
        </h2>
        <ul className="funnel">
          <li>
            <strong>{c.carrinhosSalvos}</strong>
            <span>com itens salvos na conta</span>
          </li>
          <li>
            <strong>{c.abandonados}</strong>
            <span>
              parados há mais de 24 h ({c.itensAbandonados} {plural(c.itensAbandonados, "item", "itens")})
            </span>
          </li>
          <li>
            <strong>{c.lembretes}</strong>
            <span>já receberam o lembrete</span>
          </li>
        </ul>
      </section>
      <section className="panel">
        <h2>
          <Icon name="chat" size={18} />
          Assistente
        </h2>
        <p>
          <strong>{a.frasesNaoEntendidas}</strong> {plural(a.frasesNaoEntendidas, "frase não entendida", "frases não entendidas")} nos últimos 90 dias.
        </p>
        {a.exemplos.length > 0 && (
          <ul className="rank-list">
            {a.exemplos.map((x) => (
              <li key={x.texto}>
                <span>{`“${x.texto.slice(0, 60)}”`}</span>
                <span>{x.vezes}x</span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="text-button" data-open-assistant onClick={onAssistant}>
          <Icon name="arrowRight" size={16} />
          Ver todas
        </button>
      </section>
    </div>
  );
}

const KPIS: [IconName, string, (s: Summary) => ReactNode][] = [
  ["card", "Volume de vendas", (s) => money(s.totalCents)],
  ["package", "Pedidos", (s) => s.pedidos],
  ["tag", "Ticket médio", (s) => money(s.ticketMedioCents)],
  ["user", "Clientes ativos", (s) => s.clientes],
  ["grid", "Produtos ativos", (s) => s.produtos],
  ["question", "Perguntas aguardando", (s) => s.perguntasPendentes || 0],
  ["wrench", "Encomendas em aberto", (s) => s.encomendasAbertas || 0],
  ["store", "Parcerias novas", (s) => s.parceriasNovas || 0],
];

export function Stats({ s, onTab }: { s: Summary; onTab: (tab: string) => void }) {
  const totalStatus = Math.max(1, s.pedidos);
  return (
    <>
      <div className="kpis">
        {KPIS.map(([symbol, label, value]) => (
          <div className="stat" key={label}>
            <Icon name={symbol} size={20} />
            <span>{label}</span>
            <strong>{value(s)}</strong>
          </div>
        ))}
      </div>
      <div className="dash-grid">
        <section className="panel chart-panel">
          <h2>Vendas nos últimos 14 dias</h2>
          <SalesChart days={s.vendasPorDia} />
        </section>
        <section className="panel">
          <h2>Pedidos por status</h2>
          <ul className="status-bars">
            {statuses.map((st) => (
              <li key={st}>
                <span className={`status status-${statusClass(st)}`}>{st}</span>
                <span className="status-track">
                  <span style={{ width: `${Math.round(((s.porStatus[st] || 0) / totalStatus) * 100)}%` } as CSSProperties} />
                </span>
                <strong>{s.porStatus[st] || 0}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Estoque baixo</h2>
          {s.estoqueBaixo.length ? (
            <>
              <ul className="low-stock">
                {s.estoqueBaixo.map((p) => {
                  const wanted = (s.procura || []).find((x) => x.id === p.id)?.avisos || 0;
                  return (
                    <li key={p.id}>
                      <a href={productLink(p.id)}>{p.nome}</a>
                      {wanted > 0 && (
                        <span className="badge badge-demand">
                          <Icon name="bell" size={14} />
                          {wanted} {plural(wanted, "aviso", "avisos")}
                        </span>
                      )}
                      <span className={`badge ${p.estoque ? "badge-low" : "badge-out"}`}>{p.estoque ? `${p.estoque} un.` : "Esgotado"}</span>
                    </li>
                  );
                })}
              </ul>
              {!!s.procura?.length && <p className="small muted">Avisos: clientes esperando a reposição. Repor o estoque notifica todos de uma vez.</p>}
            </>
          ) : (
            <p className="muted">Nenhum produto com 5 unidades ou menos.</p>
          )}
        </section>
      </div>
      <Insights s={s} onQuestions={() => onTab("questions")} />
      <Demand s={s} onAssistant={() => onTab("assistant")} />
    </>
  );
}
