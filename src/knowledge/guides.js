// Guias de compra: fonte única da página guias.html (gerada a partir daqui) e do assistente.
// Cada guia termina com atalhos para o catálogo filtrado pela ficha técnica.
export const guides = [
  {
    id: "primeira-guitarra",
    titulo: "Como escolher sua primeira guitarra",
    resumo: "Conforto, captação e o que mais entra no orçamento além da guitarra.",
    secoes: [
      ["Comece pelo conforto", "Braço fino, corpo leve e cordas baixas fazem você tocar mais e desistir menos. Formatos Strat e Tele são confortáveis e versáteis; single cut é mais pesada e encorpada."],
      ["Escolha a captação pelo som que você ouve", "Single-coil soa brilhante e definido (blues, funk, pop, country). Humbucker soa encorpado e sem chiado com distorção (rock pesado, metal, jazz). Na dúvida, uma Strat atende a maioria dos estilos."],
      ["Reserve parte do orçamento", "A guitarra precisa de um amplificador (ou pedaleira com saída de fone), cabo, correia, palhetas e afinador. Os kits de primeira guitarra trazem tudo com desconto."],
      ["Regulagem faz diferença", "Uma guitarra regulada por luthier fica mais fácil de tocar e afinada em todas as casas. O serviço pode ser incluído no carrinho."],
    ],
    links: [
      ["Guitarras para iniciantes", "/catalogo.html?categoria=Guitarras&nivel=Iniciante"],
      ["Kit primeira guitarra", "/kits.html#kit-primeira-guitarra"],
    ],
    termos: "primeira guitarra iniciante começar comprar escolher aprender",
  },
  {
    id: "captacao",
    titulo: "Single-coil, humbucker ou P90?",
    resumo: "O que cada captador faz com o timbre e para quais estilos ele combina.",
    secoes: [
      ["Single-coil", "Uma bobina: som brilhante, ataque definido e clareza nos acordes. Pode ter um leve ruído com muito ganho. É o som clássico de Strat e Tele."],
      ["Humbucker", "Duas bobinas em sentidos opostos que cancelam o ruído: som mais forte, grave e encorpado. Ótimo para distorção, rock pesado e jazz."],
      ["P90", "Um single-coil largo: mais encorpado que o single comum e mais aberto que o humbucker. Bom para rock cru, punk e blues."],
      ["Ativo ou passivo", "Captadores ativos usam bateria de 9V e têm saída alta e silêncio total, comuns no metal. Os passivos, mais comuns, respondem mais à dinâmica da palhetada."],
    ],
    links: [
      ["Guitarras single-coil", "/catalogo.html?categoria=Guitarras&captacao=Single-coil"],
      ["Guitarras com humbucker", "/catalogo.html?categoria=Guitarras&captacao=Humbucker"],
      ["Captadores ativos", "/catalogo.html?categoria=Guitarras&captadores=Ativos"],
    ],
    termos: "captação captador single coil humbucker p90 ativo passivo timbre",
  },
  {
    id: "amplificador",
    titulo: "Valvulado, transistor ou modelagem digital?",
    resumo: "Como escolher o amplificador pelo lugar onde você toca e pelo som que procura.",
    secoes: [
      ["Valvulado", "Responde à palhetada, comprime de um jeito natural e tem o drive mais orgânico. Soa melhor com volume, então modelos de 5 a 20 W são os mais práticos para casa."],
      ["Transistor", "Leve, resistente e acessível. Mantém o timbre em qualquer volume e não precisa de manutenção de válvulas."],
      ["Modelagem digital", "Reproduz vários amplificadores e efeitos em um só, com saída de fone e conexão USB. Ideal para estudar em casa e para quem quer variedade."],
      ["Potência e falante", "Para estudar em casa, 10 a 20 W bastam. Para ensaio com bateria, 30 W ou mais (valvulado) ou 50 W ou mais (transistor). Falante de 12 polegadas soa mais cheio que o de 8 ou 10."],
    ],
    links: [
      ["Valvulados", "/catalogo.html?categoria=Amplificadores&tecnologia=Valvulado"],
      ["Modelagem digital", "/catalogo.html?categoria=Amplificadores&tecnologia=Modelagem+digital"],
    ],
    termos: "amplificador amp valvulado válvula transistor modelagem digital potência watts falante",
  },
  {
    id: "ordem-dos-pedais",
    titulo: "Em que ordem ligar os pedais",
    resumo: "A sequência que funciona na maioria dos pedalboards, e quando quebrar a regra.",
    secoes: [
      ["A ordem clássica", "Afinador → wah e compressor → overdrive, distorção e fuzz → modulação (chorus, tremolo) → delay → reverb → looper. Cada efeito trata o sinal já moldado pelo anterior."],
      ["Por quê", "Drives soam melhores recebendo o sinal limpo; delay e reverb no fim deixam as repetições e a ambiência naturais, sem serem distorcidos."],
      ["Experimente", "Fuzz antigo costuma preferir ficar antes do wah e direto na guitarra. Não existe regra fixa: o que importa é o som que você quer."],
      ["Ligações", "Entre os pedais use cabos curtos (patch). Da guitarra ao primeiro pedal e do último ao amplificador, cabos de instrumento."],
    ],
    links: [
      ["Pedais", "/catalogo.html?categoria=Pedais"],
      ["Kit pedalboard essencial", "/kits.html#kit-pedalboard-essencial"],
    ],
    termos: "ordem pedais pedalboard sequência cadeia ligar efeitos",
  },
  {
    id: "alimentacao",
    titulo: "Como alimentar os pedais",
    resumo: "Fonte de 9V, bateria e por que uma fonte isolada evita chiado.",
    secoes: [
      ["9V centro negativo", "A maioria dos pedais compactos usa fonte de 9V com o pino central negativo. A fonte normalmente não vem na caixa."],
      ["Bateria", "Muitos pedais aceitam bateria de 9V, mas ela acaba rápido no uso diário e perde força aos poucos, mudando o timbre."],
      ["Fonte isolada", "Cada saída é independente, o que evita ruídos entre os pedais e protege se um deles tiver problema. É a melhor escolha para três pedais ou mais."],
      ["Pedaleiras", "Multiefeitos e pedaleiras costumam vir com a própria fonte, de voltagem diferente: não use a fonte de 9V nelas."],
    ],
    links: [["Fontes para pedais", "/catalogo.html?categoria=Acess%C3%B3rios&tipo=Fonte"]],
    termos: "fonte alimentação 9v bateria isolada chiado ruído energia pedal",
  },
  {
    id: "cordas",
    titulo: "Calibre das cordas: 0.09, 0.10 ou 0.11?",
    resumo: "Como o calibre muda o conforto, o timbre e a afinação.",
    secoes: [
      ["0.09", "Mais leves: fáceis de apertar e de fazer vibrato e bends. Timbre um pouco mais fino."],
      ["0.10", "O equilíbrio entre conforto e timbre, padrão de fábrica na maioria das guitarras."],
      ["0.11 ou mais", "Mais grossas: som mais cheio e estável em afinações baixas, mas pedem mais força na mão esquerda."],
      ["Quando trocar", "Quando as cordas perdem o brilho, ficam ásperas ou não seguram a afinação. Mudar o calibre pode pedir uma nova regulagem."],
    ],
    links: [["Encordoamentos", "/catalogo.html?categoria=Acess%C3%B3rios&tipo=Encordoamento"]],
    termos: "corda cordas calibre encordoamento 009 010 011 trocar grossura",
  },
];
export const guideById = (id) => guides.find((g) => g.id === id) || null;
