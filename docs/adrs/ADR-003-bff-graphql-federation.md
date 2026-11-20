# ADR-003: Backend For Frontend (BFF) com GraphQL Federation

* **Status:** Aprovado
* **Data:** 2026-11-20
* **Decisores:** Principal Solutions Architect, Head of Core Banking Systems, Lead Backend Architect
* **Contexto de Negócio:** Agregação de dados para canal mobile em ecossistema com múltiplos bounded contexts (Autorizações, Limites, Cartões, Investimentos) e SLA de carregamento mobile &lt; 300ms

---

## 1. Contexto e Declaração do Problema

O ecossistema de microsserviços de retaguarda é altamente distribuído e otimizado para operações de domínio específicas:
* O **Serviço de Limites** é focado em consistência e escrita de alta performance (DynamoDB).
* O **Serviço de Autorização** é síncrono e validado contra Redis para garantia de idempotência.
* O **Serviço de Extrato e Contabilidade** lida com consultas históricas em bancos relacionais/colunares.

Se o aplicativo móvel do SuperApp conectar diretamente a esses dezenas de microsserviços:
1. **Proliferação de Conexões de Rede Móvel:** Cada requisição adicional em rede celular 4G/5G adiciona dezenas de milissegundos de latência devido ao handshake TLS, latência de torre de celular e perda de pacotes.
2. **Payload Over-the-Air Excessivo:** APIs de domínio expõem esquemas abrangentes para atender diversos canais corporativos (agências, internet banking, ATMs), gerando tráfego redundante no plano de dados do usuário.
3. **Alto Acoplamento entre Mobile e Modelos de Dados Internos:** Qualquer alteração no schema interno de um microsserviço quebra clientes mobile legados em produção.

---

## 2. Decisão Arquitetural

Decidimos implementar um **BFF (Backend for Frontend) dedicado ao canal Mobile**, operando como camada de orquestração e agregação, utilizando uma arquitetura híbrida de **GraphQL Schema Federation** e **endpoints REST otimizados para SDUI**:
1. **Ponto Único de Entrada para o App:** O SuperApp só se comunica com a camada de BFF (exposta via Amazon API Gateway e CloudFront).
2. **Agregação Concorrente e Resiliente:** O BFF consulta os microsserviços internos em paralelo (usando gRPC / HTTP/2 assíncrono). Caso um serviço secundário (ex.: Cotações de Investimento) falhe ou atinja o timeout, o BFF aplica *graceful degradation*, retornando os dados críticos (saldo e limites) e omitindo o bloco com falha.
3. **Resolução de Layout SDUI:** O BFF assume a responsabilidade de montar a árvore de componentes visuais JSON, cruzando regras de negócio com o perfil do cliente e recomendações do assistente de IA.

---

## 3. Alternativas Consideradas

### Alternativa A: Acesso Direto do Mobile aos Microsserviços via API Gateway Genérico
* *Prós:* Menos um serviço para manter; arquitetura aparentemente mais enxuta no diagrama.
* *Contras:* Transfere a complexidade de orquestração e tratamento de erros de rede para o dispositivo móvel; consumo excessivo de bateria e dados.
* *Motivo de Rejeição:* Inaceitável para uma experiência de SuperApp de classe mundial.

### Alternativa B: GraphQL Monolítico Central (Único Gateway para Toda a Empresa)
* *Prós:* Schema corporativo único e centralizado.
* *Contras:* Torna-se rapidamente um gargalo organizacional; conflitos constantes de governança entre times de canais web, mobile, agências e parceiros B2B.
* *Motivo de Rejeição:* Viola o princípio do padrão BFF de isolar as necessidades específicas de cada canal.

---

## 4. Trade-offs e Implicações

* **Custo Adicional de Infraestrutura:** Cria uma camada adicional de computação (executada em contêineres AWS ECS Fargate com auto-scaling veloz).
* **Disciplina de Governança:** O BFF deve atuar estritamente como adaptador e orquestrador de apresentação, sendo expressamente proibido de abrigar regras de domínio de negócio (que devem residir nos microsserviços de core).

---

## 5. Riscos e Mitigações

| Risco Identificado | Severidade | Estratégia de Mitigação |
| :--- | :--- | :--- |
| **BFF se tornar um Ponto Único de Falha (SPOF)** | Crítica | Deploy em modo Multi-AZ em contêineres ECS Fargate com provisionamento mínimo garantido e escalabilidade elástica orientada a CPU/Throughput. |
| **Latência acumulada nas chamadas de downstream** | Alta | Adoção de gRPC interno com conexões persistentes (*keep-alive pools*), timeouts agressivos (SLA &lt; 80ms) e circuit breakers locais (Resilience4j / opossum). |
| **Consultas GraphQL maliciosas com profundidade excessiva (N+1)** | Alta | Configuração de *Query Complexity Analysis* e limite máximo de profundidade de query no gateway GraphQL, além do uso de DataLoaders para batching em memória. |
