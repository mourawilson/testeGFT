# ADR-001: Adoção de Server-Driven UI (SDUI) vs. Hardcoded UI no SuperApp

* **Status:** Aprovado
* **Data:** 2026-11-20
* **Decisores:** Principal Solutions Architect, Head of Mobile Engineering, Lead Tech Lead SDUI
* **Contexto de Negócio:** SuperApp Financeiro com mais de 80 milhões de usuários e múltiplas verticais (Conta, Crédito, Investimentos, Seguros)

---

## 1. Contexto e Declaração do Problema

O modelo convencional de desenvolvimento mobile — onde cada tela, card promocional, regra de ordenação e componente de layout é compilado diretamente no código nativo do aplicativo (iOS e Android) — impõe graves restrições para uma instituição financeira de grande porte:
1. **Lentidão no Time-to-Market:** O ciclo de revisão nas lojas (Apple App Store e Google Play Store) dura de 24 horas a vários dias. Em cenários de campanhas comerciais críticas (ex.: Black Friday, renegociação de dívidas ou lançamento de linhas de crédito), a equipe de produto não consegue reagir com agilidade.
2. **Fragmentação de Versões:** Em uma base de 80 milhões de usuários, sempre há entre 5% e 15% de clientes utilizando versões defasadas do aplicativo lançadas há meses. Isso impede a desativação de APIs legadas e força a manutenção de compatibilidade custosa no backend.
3. **Impossibilidade de Personalização em Tempo Real:** Diferentes perfis de clientes (ex.: Private, Varejo, Endividado com alerta de limite crítico) necessitam de experiências e hierarquias visuais completamente distintas na tela inicial. Compilar todos esses fluxos e árvores de decisão dentro do binário mobile incha o tamanho do download (*APK/IPA size*) e consome memória excessiva do aparelho.

---

## 2. Decisão Arquitetural

Decidimos adotar uma arquitetura de **Server-Driven UI (SDUI) Tipado e Declarativo** para as principais jornadas e telas de descoberta do SuperApp (incluindo Home Dashboard, Hub de Crédito e banners de ofertas do Assistente de IA).

### Diretrizes de Implementação:
1. **Design System Component Registry no Mobile:** O aplicativo móvel contém uma biblioteca fechada e altamente otimizada de componentes visuais nativos (ex.: `HeroBalanceCard`, `TransactionFeed`, `SmartInsightBanner`, `ActionGrid`, `CollapsibleAccordion`). O aplicativo é responsável apenas por desenhar o componente com fidelidade visual nativa e animações de 60fps.
2. **Payload Declarativo via Backend (BFF):** O BFF envia uma estrutura JSON padronizada especificando quais componentes devem ser exibidos, suas propriedades de conteúdo, ordem e gatilhos de ação (*action triggers*).
3. **Versionamento Semântico de Schema (Contract-First):** O contrato de componentes SDUI é versionado (`v1.4.0`). Componentes novos desconhecidos por versões antigas do app utilizam um mecanismo de *fallback silencioso* (ignorar o nó desconhecido ou renderizar um placeholder amigável), evitando que o app quebre.

---

## 3. Alternativas Consideradas

### Alternativa A: Hardcoded UI Nativo Tradicional
* *Prós:* Menor complexidade inicial de backend; tooling maduro das IDEs móveis (Xcode/Android Studio).
* *Contras:* Ciclo de release atrelado às lojas; impossibilidade de A/B testing dinâmico no layout; tempo de resposta lento a bugs de UX.
* *Motivo de Rejeição:* Incompatível com a meta de agilidade de negócio e experimentação contínua de um SuperApp corporativo.

### Alternativa B: WebViews / Micro-Apps Híbridos Embutidos
* *Prós:* Atualização instantânea via deploy web padrão.
* *Contras:* Baixa performance visual (taxa de quadros instável, sensação de "site encapsulado"); consumo excessivo de memória; suporte precário a animações fluidas e gestos nativos; risco de segurança por injeção em contextos de WebView.
* *Motivo de Rejeição:* Viola a exigência de experiência premium de banco e os padrões de segurança transacional.

---

## 4. Trade-offs e Implicações

* **Complexidade no Backend:** O BFF deixa de ser um mero repassador de dados brutos e passa a calcular regras de apresentação e montagem de árvore de nós. Requer testes rigorosos de serialização e esquema.
* **Volume de Payload de Rede:** O payload JSON com propriedades de SDUI é ligeiramente maior do que um JSON puramente transacional. Mitigamos isso aplicando compressão Brotli/Gzip e estratégias de cache HTTP (`Cache-Control: public, max-age=60, stale-while-revalidate=120`).
* **Complexidade de Depuração:** Depurar um bug visual exige analisar se o erro reside na montagem da árvore pelo backend ou no renderizador nativo do cliente.

---

## 5. Riscos e Mitigações

| Risco Identificado | Severidade | Estratégia de Mitigação |
| :--- | :--- | :--- |
| **Payload corrompido ou componente desconhecido derrubar o app (Crash)** | Alta | Renderizador defensivo no mobile com bloco `try-catch` em cada nó. Nós desconhecidos são logados como aviso em telemetria e descartados sem afetar os nós irmãos. |
| **Aumento de latência na montagem do JSON pelo BFF** | Média | Pré-computação de layouts base em cache Redis e uso de pipelines concorrentes e não-bloqueantes no Node.js/Fastify. |
| **Injeção de links ou ações maliciosas via backend comprometido** | Alta | Lista restrita (*allowlist*) de esquemas de URLs e comandos de deep linking aceitos pelo motor do app (`navigate://`, `action://`, `agent://`). Nenhuma execução de código JavaScript arbitrário é permitida. |
