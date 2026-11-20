# Plataforma de SuperApp Financeiro Modular & Assistente Agêntico Híbrido

> **Arquitetura de Referência e Prova de Conceito Executiva**  
> **Perfil:** Principal Solutions Architect — Mobile Ecosystems, Cloud-Native (AWS) & Applied AI  
> **Domínio de Negócio:** Core Banking, Gestão de Limites, Autorização em Tempo Real (5.000 TPS) e IA Agêntica Híbrida  

---

## 1. Visão Executiva e Problema de Negócio

Grandes instituições financeiras com bases volumosas (mais de 80 milhões de contas ativas e centenas de milhões de contratos de crédito, investimento e meios de pagamento) enfrentam um dilema arquitetural clássico: **como acelerar o time-to-market de novos produtos digitais no canal mobile sem comprometer a extrema resiliência, latência e segurança exigidas pelo core transacional?**

O ciclo tradicional de release mobile — submissão às lojas (App Store e Google Play), aprovações lentas e fragmentação de versões instaladas nos dispositivos dos clientes — inviabiliza testes rápidos de jornadas, personalização em tempo real e resposta ágil a fraudes. Simultaneamente, a introdução de **Inteligência Artificial Generativa** no canal móvel introduz novos desafios críticos:
1. **Latência de rede e custo de inferência na nuvem** para interações rotineiras.
2. **Exposição inadvertida de PII (Personally Identifiable Information)** e violação à **LGPD**.
3. **Consistência e concorrência na reserva de limites de crédito** durante picos de até 5.000 TPS.
4. **Acoplamento entre canais mobile e múltiplos serviços de backend**.

### Objetivos Arquiteturais da Solução
* **Server-Driven UI (SDUI) Tipado:** Permite que squads de negócio alterem fluxos, layouts e ofertas no SuperApp instantaneamente via payload JSON versionado, sem necessidade de nova versão do aplicativo na loja.
* **Assistente Agêntico Híbrido (Edge AI + Cloud RAG):** Inferência local (*on-device*) sub-30ms para triagem de intenção, detecção de digitação anômala/risco e funcionamento offline básico; orquestração na nuvem (AWS Bedrock / LangChain) com RAG corporativo e *tool calling* transacional protegido para demandas complexas.
* **BFF com GraphQL Federation e Arquitetura Hexagonal:** Desacoplamento entre jornadas mobile e serviços de domínio, agregando autorizações, contratos e limites com isolamento de contexto (DDD).
* **Core Transacional Event-Driven:** Autorização síncrona com garantia de idempotência (RFC 7807) e propagação assíncrona de eventos de domínio via Amazon EventBridge / Kafka / SQS para contabilidade, antifraude e notificações.

---

## 2. Mapa Geral da Solução

```mermaid
flowchart TB
    subgraph ClientLayer["Canal Mobile — SuperApp Modular"]
        App["SuperApp Shell (React Native / Flutter)"]
        EdgeEngine["Edge AI Engine (ONNX / CoreML / TFLite)\n• Triagem de Intenção (&lt;30ms)\n• Anomaly & Keystroke Risk Score\n• Cache e Offline Gate"]
        SDUIRenderer["Dynamic SDUI Engine\n• Component Registry\n• State & Analytics Hub"]
        App --> EdgeEngine
        App --> SDUIRenderer
    end

    subgraph EdgeSecurity["Borda e Proteção de API"]
        CF["Amazon CloudFront (Edge Caching + TLS 1.3)"]
        WAF["AWS WAF (Anti-Bot / DDoS / Token Bucket)"]
        APIGW["Amazon API Gateway (mTLS / OAuth2 / Authorizer)"]
        CF --> WAF --> APIGW
    end

    subgraph AggregationLayer["Camada de Agregação (BFF)"]
        BFF["BFF SuperApp Service (Node.js/Fastify - Hexagonal)\n• GraphQL / REST Engine\n• SDUI Layout Resolver\n• Context-Aware Offer Personalization"]
    end

    subgraph AIAssistant["Plataforma de IA Agêntica"]
        PIIGuard["PII Guardrail & Sanitizer\n• Anonimização de Dados\n• Anti-Prompt Injection"]
        AgentOrch["AI Agent Orchestrator (LangChain / LlamaIndex)\n• Semantic Intent Routing\n• Autonomous Tool Calling"]
        Bedrock["AWS Bedrock / Claude 3.5 Sonnet / SageMaker"]
        RAG["Vector Store (OpenSearch Serverless / FAISS)\n• Políticas de Crédito e Manuais de Produtos"]
    end

    subgraph CoreDomain["Core Transacional de Alta Escala (AWS Well-Architected)"]
        AuthSvc["Serviço de Autorização de Transações\n• Idempotency-Key Engine (Redis Cluster)\n• Picos de 5.000 TPS | SLA &lt; 80ms"]
        LimitSvc["Serviço de Gestão de Limites & Contratos\n• Amazon DynamoDB (Single-Table Design)\n• Concorrência Otimista (Conditional Writes)"]
        EventBus["Event Hub (Amazon EventBridge & Amazon MSK / Kafka)"]
    end

    subgraph DownstreamSvc["Consumidores Assíncronos"]
        Notif["Serviço de Notificações Push (SNS / Pinpoint)"]
        Fraud["Motor Antifraude Corporativo"]
        Ledger["Contabilidade & Core Banking Legado (via ACL)"]
    end

    App -- "Requisições com Certificate Pinning" --> CF
    APIGW --> BFF
    BFF -- "Orquestra Layout + Dados Transacionais" --> AuthSvc
    BFF -- "Consulta Limites Consolidados" --> LimitSvc
    BFF -- "Consulta Inteligente / Jornada Assistida" --> PIIGuard
    PIIGuard --> AgentOrch
    AgentOrch <--> Bedrock
    AgentOrch <--> RAG
    AgentOrch -- "Tool Calls (Bloqueio / Aumento Emergencial)" --> LimitSvc

    AuthSvc <--> LimitSvc
    AuthSvc -- "Publica TransacaoAutorizada (CloudEvents)" --> EventBus
    EventBus --> Notif
    EventBus --> Fraud
    EventBus --> Ledger

    classDef client fill:#1E293B,stroke:#0EA5E9,stroke-width:2px,color:#F8FAFC;
    classDef edge fill:#0F172A,stroke:#64748B,stroke-width:1px,color:#F8FAFC;
    classDef bff fill:#0F172A,stroke:#10B981,stroke-width:2px,color:#F8FAFC;
    classDef ai fill:#0F172A,stroke:#F59E0B,stroke-width:2px,color:#F8FAFC;
    classDef core fill:#0F172A,stroke:#6366F1,stroke-width:2px,color:#F8FAFC;
    classDef down fill:#1E293B,stroke:#94A3B8,stroke-width:1px,color:#F8FAFC;

    class App,EdgeEngine,SDUIRenderer client;
    class CF,WAF,APIGW edge;
    class BFF bff;
    class PIIGuard,AgentOrch,Bedrock,RAG ai;
    class AuthSvc,LimitSvc,EventBus core;
    class Notif,Fraud,Ledger down;
```

---

## 3. Estrutura do Repositório

```text
├── docs/                                 # Especificações Técnicas e Desenhos de Arquitetura
│   ├── 01-arquitetura-geral.md           # DDD, Micro-frontends, BFF, SDUI e Diagramas C4
│   ├── 02-ia-generativa-e-edge.md        # Edge AI vs Cloud, RAG, Bedrock e MLOps
│   ├── 03-seguranca-governanca-lgpd.md   # OAuth2/mTLS, Guardrails de PII, Prevenção Injection
│   └── adrs/                             # Architecture Decision Records fundamentados
│       ├── ADR-001-sdui-vs-hardcoded-ui.md
│       ├── ADR-002-estrategia-hibrida-edge-vs-cloud-ai.md
│       ├── ADR-003-bff-graphql-federation.md
│       └── ADR-004-mensageria-assincrona-kafka-sqs.md
├── src/                                  # Implementação de Referência / Prova de Conceito
│   ├── bff-sdui-service/                 # BFF em Node.js/TypeScript (Server-Driven UI e APIs)
│   ├── ai-orchestrator/                  # Agente Financeiro, RAG vetorial e Guardrails PII
│   ├── edge-ai-simulator/                # Simulador de inferência local ultra-rápida (sub-30ms)
│   ├── event-bus-contracts/              # Schemas CloudEvents/JSON Schema para Kafka e EventBridge
│   └── mobile-sdui-preview/              # Shell Mobile interativo para validação visual e testes
├── docker-compose.yml                    # Orquestração local unificada dos serviços
└── package.json                          # Scripts de execução rápida e automação
```

---

## 4. Guia de Execução Rápida

A Prova de Conceito foi projetada para execução imediata em ambiente local, sem depender de contas externas ou custos de nuvem durante a demonstração.

### Pré-requisitos
* **Node.js**: v18+ (testado na v24 LTS)
* **NPM**: v9+

### Inicialização em 1 Comando

Execute no terminal na raiz do projeto:

```bash
# 1. Instalar dependências dos serviços
npm run install:all

# 2. Inicializar o ecossistema integrado (BFF + AI Orchestrator + Mobile Preview)
npm start
```

Após a inicialização:
* **Mobile SuperApp Preview interativo:** acesse `http://localhost:3000` no seu navegador.
* **BFF Service API (Healthcheck & SDUI):** `http://localhost:3001/api/sdui/home`
* **AI Orchestrator API & Guardrail:** `http://localhost:3002/api/agent/query`
* **Simulador Edge AI CLI:** `npm run test:edge`

### O que você verá no Mobile Preview (`http://localhost:3000`):
1. **Emulação do SuperApp Shell** com renderizador de Server-Driven UI puro consumindo o BFF em tempo real.
2. **Alternador de Perfis Contextuais** (Perfil Normal, Alerta de Limite Crítico e Suspeita de Fraude) que provocam mudanças de layout instantâneas via backend, sem deploy no app.
3. **Assistente Financeiro Híbrido** em funcionamento:
   * Perguntas triviais e verificações de risco são resolvidas em **&lt; 30ms pelo Edge AI**.
   * Consultas complexas acionam o **Cloud AI Orchestrator**, disparando verificação de PII/LGPD, RAG e execução de ferramentas (*tool calling* para consulta de limites e bloqueio).
4. **Console de Telemetria e Eventos:** Exibição lateral em tempo real dos payloads JSON trafegados e eventos assíncronos publicados no Event Bus.

---

## 5. Racional Técnico e Defesa de Arquitetura

Este repositório foi construído para servir tanto como documentação de produção quanto como material para sessões de sabatina técnica executiva (*Technical Review Sessions*). Cada decisão foi tomada considerando:
* **Throughput:** Suporte a 5.000 TPS de pico com banco de dados chave-valor (*single-table design* em DynamoDB) e particionamento determinístico por `id_contrato`.
* **Disponibilidade & Resiliência:** Padrões *Circuit Breaker*, *Fallback* local via Edge AI, *Bulkhead* e *Dead Letter Queues (DLQ)* em múltiplos níveis.
* **Governança:** Contratos *Contract-First* (OpenAPI 3.1 e CloudEvents 1.0) validados em pipeline de CI/CD.
* **Conformidade Regulatória:** Proteção de PII por design (*Privacy by Design*), rastreabilidade ponta-a-ponta com Correlation ID / W3C Trace Context e idempotência garantida na camada de transporte e armazenamento.
