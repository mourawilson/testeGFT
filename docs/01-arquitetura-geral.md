# 01 — Arquitetura Geral do SuperApp Financeiro

## 1. Visão de Negócio e Princípios Arquiteturais

A modernização de ecossistemas bancários móveis de alta escala (com mais de 80 milhões de contas e dezenas de milhões de transações diárias) exige uma arquitetura que equilibre duas forças tradicionalmente antagônicas:
1. **Velocidade de experimentação e personalização** nos canais de atendimento e vendas móveis.
2. **Determinismo, consistência estrita e latência ultra-baixa** no core transacional de autorização (picos de 5.000 TPS com SLA &lt; 80ms).

Para resolver esse dilema, a arquitetura é estruturada em torno de quatro pilares fundamentais:
* **Domain-Driven Design (DDD):** Isolamento estrito de contextos delimitados (*Bounded Contexts*), garantindo que a complexidade de regras de crédito e limites não contamine a camada de renderização do aplicativo nem a velocidade do motor de autorização.
* **Clean Architecture & Arquitetura Hexagonal (Ports & Adapters):** O núcleo de regras de negócio é agnóstico a bancos de dados, mensageria e frameworks, viabilizando testes unitários sem mocks pesados de infraestrutura e migrações transparentes na nuvem AWS.
* **Micro-frontends Mobile com Server-Driven UI (SDUI):** As jornadas do cliente são compostas dinamicamente a partir do backend. As squads de produto entregam valor e alteram interfaces em tempo real, sem necessidade de submissão e aprovação nas lojas de aplicativos.
* **BFF (Backend for Frontend) Federado com GraphQL:** Uma camada de agregação otimizada para a rede móvel, eliminando problemas crônicos de *over-fetching* e *under-fetching*, além de orquestrar a montagem de layouts SDUI contextuais.

---

## 2. Bounded Contexts e Modelagem de Domínio (DDD)

A decomposição do ecossistema foi orientada pela separação de responsabilidades e pelo perfil de carga de cada capacidade de negócio:

```mermaid
flowchart LR
    subgraph CoreContext["Contexto Transacional (Crítico / Ultra-Baixa Latência)"]
        direction TB
        BC_Auth["Bounded Context:\nAutorização de Transações\n• Idempotência e Validação\n• Decisão Síncrona\n• 5.000 TPS"]
        BC_Limit["Bounded Context:\nGestão de Limites e Contratos\n• Invariante de Saldo Disponível\n• Concorrência Otimista\n• Single-Table DynamoDB"]
        BC_Auth <-->|Reserva Atômica| BC_Limit
    end

    subgraph ChannelContext["Contexto de Canal & Experiência"]
        direction TB
        BC_BFF["Bounded Context:\nOrquestração de Experiência (BFF)\n• Composição SDUI\n• Agregação de Contratos\n• Resolução de Contexto"]
        BC_AI["Bounded Context:\nAssistência Agêntica Inteligente\n• RAG Corporativo\n• Execução de Ações\n• Guardrails de Segurança"]
        BC_BFF <--> BC_AI
    end

    subgraph AsyncContext["Contexto Assíncrono & Retaguarda"]
        direction TB
        BC_Ledger["Contabilidade e Core Banking\n(Anti-Corruption Layer - ACL)"]
        BC_Fraud["Motor de Risco & Antifraude"]
        BC_Notif["Engajamento & Notificações Push"]
    end

    BC_Auth -- "Evento: TransacaoAutorizada\n(EventBridge / Kafka)" --> AsyncContext
    BC_BFF --> BC_Auth
    BC_BFF --> BC_Limit

    classDef core fill:#0F172A,stroke:#6366F1,stroke-width:2px,color:#F8FAFC;
    classDef chan fill:#0F172A,stroke:#10B981,stroke-width:2px,color:#F8FAFC;
    classDef asy fill:#1E293B,stroke:#94A3B8,stroke-width:1px,color:#F8FAFC;

    class BC_Auth,BC_Limit core;
    class BC_BFF,BC_AI chan;
    class BC_Ledger,BC_Fraud,BC_Notif asy;
```

### Principais Agregados e Entidades do Domínio Transacional

1. **Agregado `Contrato` & `Limite` (Contexto de Limites):**
   * **Invariante:** O `saldo_utilizado + saldo_reservado` nunca pode exceder o `limite_total_concedido`.
   * **Controle de Concorrência:** Para suportar milhares de operações concorrentes no mesmo contrato sem deadlocks em bancos relacionais, adotamos *Conditional Writes* no Amazon DynamoDB utilizando número de versão (`version_id`).
   * **Operações do Domínio:** `reservarLimite()`, `confirmarDebito()`, `estornarReserva()`, `ajustarLimiteMaximo()`.

2. **Agregado `Autorizacao` (Contexto de Autorização):**
   * **Invariante:** Uma chave de idempotência (`Idempotency-Key`) processada com sucesso sempre retorna exatamente o mesmo payload de resposta original, impedindo duplicidade de débitos mesmo em caso de retentativas de rede pelo cliente.
   * **Máquina de Estados:** `INICIADA` → `LIMITE_RESERVADO` → `AUTORIZADA` ou `RECUSADA` (por limite insuficiente, regra de negócio ou suspeita de fraude).

---

## 3. Arquitetura Hexagonal (Ports & Adapters)

Cada microsserviço isola rigidamente sua lógica de domínio de qualquer dependência externa de infraestrutura, conforme demonstrado no diagrama estrutural abaixo:

```mermaid
flowchart TD
    subgraph DrivingAdapters["Adapters Primários (Driving / Entrada)"]
        APIGatewayAdapter["API Gateway REST / GraphQL Controller\n(Tratamento RFC 7807)"]
        EventConsumerAdapter["Kafka / SQS Event Consumer\n(Deduplicação de Mensagens)"]
    end

    subgraph ApplicationCore["Núcleo da Aplicação (Application Layer)"]
        subgraph InboundPorts["Ports de Entrada"]
        InPortAuth["IAutorizarTransacaoUseCase"]
        InPortLimit["IConsultarLimitesUseCase"]
    end

    subgraph UseCases["Casos de Uso (Application Services)"]
        UseCaseAuth["AutorizarTransacaoUseCase\n• Valida Idempotência\n• Orquestra Reserva\n• Dispara Eventos de Domínio"]
    end

    subgraph DomainModel["Modelo de Domínio Puro (Domain Layer)"]
        EntityAuth["Entidade: Autorizacao\n(Regras e Estados)"]
        EntityLimit["Entidade: LimiteContrato\n(Invariantes de Saldo)"]
        ValueObjects["Value Objects:\nDinheiro, Moeda, IdempotencyKey"]
    end

    subgraph OutboundPorts["Ports de Saída"]
        OutPortRepo["ILimiteRepositoryPort"]
        OutPortIdemp["IIdempotencyStorePort"]
        OutPortEvent["IDomainEventPublisherPort"]
    end
    end

    subgraph DrivenAdapters["Adapters Secundários (Driven / Saída)"]
        DynamoAdapter["DynamoDB Limite Repository Adapter\n(Conditional Put / Update)"]
        RedisAdapter["Redis Cluster Idempotency Adapter\n(TTL + SETNX atômico)"]
        EventBridgeAdapter["Amazon EventBridge / Kafka Adapter\n(CloudEvents 1.0 Publisher)"]
    end

    APIGatewayAdapter --> InPortAuth
    EventConsumerAdapter --> InPortLimit
    InPortAuth --> UseCaseAuth
    UseCaseAuth --> EntityAuth
    UseCaseAuth --> EntityLimit
    UseCaseAuth --> OutPortRepo
    UseCaseAuth --> OutPortIdemp
    UseCaseAuth --> OutPortEvent

    OutPortRepo --> DynamoAdapter
    OutPortIdemp --> RedisAdapter
    OutPortEvent --> EventBridgeAdapter

    classDef adapter fill:#1E293B,stroke:#64748B,stroke-width:1px,color:#F8FAFC;
    classDef ports fill:#0F172A,stroke:#10B981,stroke-width:1px,color:#F8FAFC;
    classDef domain fill:#0F172A,stroke:#6366F1,stroke-width:2px,color:#F8FAFC;

    class APIGatewayAdapter,EventConsumerAdapter,DynamoAdapter,RedisAdapter,EventBridgeAdapter adapter;
    class InPortAuth,InPortLimit,OutPortRepo,OutPortIdemp,OutPortEvent ports;
    class UseCaseAuth,EntityAuth,EntityLimit,ValueObjects domain;
```

### Benefícios Práticos da Separação Hexagonal
1. **Testabilidade Absoluta:** O caso de uso de autorização e o Aggregate de Limites são testados com 100% de cobertura em memória sem depender de conexões com AWS, Redis ou DynamoDB.
2. **Substituição de Infraestrutura:** Se a política de cache transacional migrar de Redis para DynamoDB DAX ou MemoryDB for Redis, apenas o adaptador secundário é alterado; nenhuma linha da regra de domínio é modificada.

---

## 4. Estratégia de Micro-frontends Mobile & Server-Driven UI (SDUI)

### 4.1 O Desafio do Monólito Mobile
Em organizações com dezenas de squads distribuídas (ex.: Conta Corrente, Pix, Empréstimos, Seguros, Cartões), manter um aplicativo móvel monolítico gera gargalos insustentáveis:
* Conflitos de mesclagem de código (*merge hell*) a cada ciclo quinzenal.
* Tempo excessivo de testes de regressão antes de cada submissão.
* Risco sistêmico: um bug introduzido no fluxo de empréstimo pode derrubar a inicialização do app para todos os 80 milhões de usuários.

### 4.2 Arquitetura Modular do SuperApp Shell
A solução adota uma arquitetura de **Micro-frontends Mobile** baseada em um **Container Shell** leve e **Feature Modules independentes**:

```mermaid
flowchart TB
    subgraph SuperAppShell["SuperApp Container Shell"]
        CoreSDK["Core SDK Foundation\n• Design System Tokens\n• Segurança (Crypto / Keystore)\n• Network & Auth Interceptors\n• Telemetria & Observabilidade"]
        NavRouter["Dynamic Navigation Router\n• Deep Linking Declarativo\n• State & Session Manager"]
        SDUIEngine["SDUI Core Engine\n• Component Registry\n• Dynamic Layout Parser\n• Event Binding & Analytics"]
    end

    subgraph FeatureModules["Micro-frontends Independentes (Módulos Dinâmicos)"]
        ModAccount["Módulo: Conta & Pagamentos"]
        ModCredit["Módulo: Crédito & Limites"]
        ModInvest["Módulo: Investimentos"]
        ModAIAssistant["Módulo: Assistente IA Híbrido\n(Edge AI + Cloud Streaming)"]
    end

    subgraph BackendOrch["BFF Orchestration Layer"]
        BFF_SDUI["SDUI Engine Service (BFF)\nRetorna Árvore de Componentes Tipados JSON"]
    end

    SuperAppShell --> ModAccount
    SuperAppShell --> ModCredit
    SuperAppShell --> ModInvest
    SuperAppShell --> ModAIAssistant

    SDUIEngine <-->|Requisição de Layout Contextual| BFF_SDUI
```

### 4.3 Mecânica do Server-Driven UI (SDUI)
No modelo SDUI, o backend não devolve apenas dados brutos (ex.: números de saldo ou listas de transações), mas sim **a descrição declarativa da interface**:
* Quais componentes renderizar (ex.: `HeroBalanceCard`, `QuickActionsCarousel`, `SecurityWarningBanner`).
* A ordem hierárquica e regras de estilo corporativo padronizadas no Design System do app.
* As ações interativas associadas (ex.: abrir modal, executar deep-link, chamar comando de voz ou rota nativa).

#### Schema Tipado de Componente SDUI (Exemplo de Contrato JSON)
```json
{
  "screen_id": "home_dashboard",
  "version": "1.4.0",
  "theme": "corporate_dark",
  "metadata": {
    "user_tier": "PRIVATE",
    "context_risk": "LOW"
  },
  "sections": [
    {
      "id": "sec_hero",
      "type": "HeroBalanceCard",
      "props": {
        "account_id": "0001-98765-4",
        "balance_available": "R$ 45.280,50",
        "credit_limit_available": "R$ 18.500,00",
        "is_hidden_by_default": false
      },
      "actions": {
        "on_click": "navigate://wallet/details",
        "on_long_press": "action://agent/summarize_finances"
      }
    },
    {
      "id": "sec_agent_insight",
      "type": "SmartInsightBanner",
      "props": {
        "severity": "ALERT",
        "headline": "Limite de Crédito Próximo do Teto (92% utilizado)",
        "body": "Identificamos 3 cobranças recorrentes agendadas para amanhã. Deseja efetuar ajuste emergencial?",
        "primary_button_text": "Ajustar Limite",
        "secondary_button_text": "Ignorar"
      },
      "actions": {
        "on_primary_action": "agent://trigger_tool?name=solicitar_ajuste_emergencial"
      }
    }
  ]
}
```

---

## 5. BFF e GraphQL Federation: Racional de Escolha

### 5.1 Por que não conectar o Mobile diretamente aos microsserviços?
1. **Latência de Redes Móveis:** Uma tela inicial rica em um SuperApp precisa de dados de saldo, limites de múltiplos contratos, cotações de investimentos e notificações de segurança. Fazer 6 a 8 chamadas HTTP sequenciais em conexões 4G/5G com flutuações de sinal degrada a experiência do usuário e consome bateria.
2. **Payload Over-the-Air:** APIs de backend transacional retornam dezenas de campos para atender sistemas de auditoria e contabilidade que o app não precisa exibir.
3. **Resiliência a Falhas Parciais:** Se o serviço de investimentos estiver instável, a tela inicial do SuperApp não deve quebrar: o BFF atua com *graceful degradation*, servindo saldo e limites e ocultando o card de investimentos sem lançar exceção fatal para o usuário.

### 5.2 GraphQL vs. REST no BFF
Adotamos uma abordagem híbrida inteligente:
* **Endpoints REST com Cache de Borda (CloudFront)** para entrega ultra-rápida de layouts estáticos de SDUI e inicialização de sessão (*App Bootstrapping*).
* **GraphQL Federation** para consultas dinâmicas de composição de tela e enriquecimento do assistente de IA, permitindo que o cliente solicite exatamente a fatia de dados necessária em uma única requisição multiplexada por HTTP/2 ou HTTP/3.

---

## 6. Diagramas Arquiteturais C4 Model

### 6.1 Nível 1: Diagrama de Contexto de Sistema (C1)

```mermaid
flowchart TB
    User["Cliente do Banco\n(Mais de 80 milhões de usuários)"]
    
    subgraph SystemBoundary["Ecossistema do SuperApp Financeiro"]
        SuperApp["Plataforma SuperApp Financeiro\n(Mobile App + BFF + Core de Autorização e Limites + IA Agêntica)"]
    end

    LegacyCore["Core Banking Legado\n(Mainframe / Contabilidade)"]
    CardNetwork["Rede Adquirente / Bandeiras de Cartão\n(Mastercard, Visa, Elo, Pix BACEN)"]
    PushServices["Serviços de Notificação Push\n(Apple APNs & Google FCM)"]

    User <-->|Visualiza saldos, efetua pagamentos,\nconversa com assistente inteligente| SuperApp
    CardNetwork <-->|Solicitações de Autorização síncronas\n(pico de 5.000 TPS)| SuperApp
    SuperApp -- "Publica eventos contábeis (assíncrono)" --> LegacyCore
    SuperApp -- "Dispara notificações de segurança e limites" --> PushServices

    classDef actor fill:#0F172A,stroke:#38BDF8,stroke-width:2px,color:#F8FAFC;
    classDef system fill:#1E293B,stroke:#10B981,stroke-width:3px,color:#F8FAFC;
    classDef ext fill:#0F172A,stroke:#64748B,stroke-width:1px,color:#F8FAFC;

    class User actor;
    class SuperApp system;
    class LegacyCore,CardNetwork,PushServices ext;
```

---

### 6.2 Nível 2: Diagrama de Contêineres (C2)

```mermaid
flowchart TB
    subgraph ClientDevice["Dispositivo Móvel do Usuário"]
        App["SuperApp Mobile\n(React Native / Flutter)\nRenderizador SDUI & Edge AI"]
    end

    subgraph AWSCloud["AWS Cloud Platform — Região us-east-1 (Multi-AZ)"]
        CF["Amazon CloudFront\n(Distribuição de borda, TLS 1.3)"]
        APIGW["Amazon API Gateway / ALB\n(Rate Limiting, Throttling, WAF)"]
        
        subgraph ComputeTier["Camada de Computação e Agregação"]
            BFF["BFF SuperApp Service\n(ECS Fargate / Node.js)\nOrquestra SDUI e Agregação"]
            AIOrch["AI Agent Orchestrator\n(ECS Fargate / Python LangChain)\nTools, RAG e Guardrails"]
        end

        subgraph CoreTier["Camada Transacional Crítica"]
            AuthSvc["Serviço de Autorização\n(ECS Fargate / Go ou Node.js)\nValida e autoriza em &lt; 50ms"]
            LimitSvc["Serviço de Limites e Contratos\n(ECS Fargate)\nControle de Invariantes e Reserva"]
        end

        subgraph StorageTier["Camada de Armazenamento & Cache"]
            RedisCluster["Amazon ElastiCache for Redis\n(Idempotency Keys, Lock Otimista)"]
            DynamoLimits["Amazon DynamoDB\n(Tabela de Limites e Contratos - Single Table)"]
            BedrockService["Amazon Bedrock & SageMaker\n(Modelos Foundation Claude 3.5 / Embeddings)"]
            VectorStore["Amazon OpenSearch Serverless\n(Base de Conhecimento RAG)"]
        end

        subgraph EventTier["Espinha Dorsal de Eventos"]
            EventBridge["Amazon EventBridge & Amazon MSK (Kafka)\n(Tópicos de Domínio: TransacaoAutorizada)"]
        end
    end

    App <-->|HTTPS / TLS Pinning| CF
    CF --> APIGW
    APIGW --> BFF
    BFF <--> AIOrch
    BFF --> AuthSvc
    BFF --> LimitSvc

    AuthSvc <--> RedisCluster
    AuthSvc <--> LimitSvc
    LimitSvc <--> DynamoLimits
    AuthSvc -- "Publica evento de negócio" --> EventBridge

    AIOrch <--> BedrockService
    AIOrch <--> VectorStore
    AIOrch -- "Executa Tool Calling de consulta/bloqueio" --> LimitSvc

    classDef client fill:#1E293B,stroke:#38BDF8,stroke-width:2px,color:#F8FAFC;
    classDef comp fill:#0F172A,stroke:#10B981,stroke-width:2px,color:#F8FAFC;
    classDef core fill:#0F172A,stroke:#6366F1,stroke-width:2px,color:#F8FAFC;
    classDef stor fill:#1E293B,stroke:#F59E0B,stroke-width:1px,color:#F8FAFC;
    classDef evt fill:#0F172A,stroke:#EC4899,stroke-width:2px,color:#F8FAFC;

    class App client;
    class CF,APIGW,BFF,AIOrch comp;
    class AuthSvc,LimitSvc core;
    class RedisCluster,DynamoLimits,BedrockService,VectorStore stor;
    class EventBridge evt;
```

---

### 6.3 Nível 3: Diagrama de Componentes do Serviço de Autorização (C3)

```mermaid
flowchart LR
    subgraph AuthContainer["Contêiner: Serviço de Autorização"]
        HttpIn["HTTP Controller\n(Validação de Contrato & RFC 7807)"]
        IdempFilter["Idempotency Interceptor\n(Verificação Atômica de UUID)"]
        AuthUseCase["AutorizarTransacaoUseCase\n(Coordenação de Regras)"]
        LimitAdapter["LimitServiceClientAdapter\n(Chamada gRPC / REST com Circuit Breaker)"]
        EventPub["EventBridgePublisherAdapter\n(Publicação CloudEvents 1.0)"]
    end

    Redis["Redis Cache Idempotência"]
    LimitMicroservice["Serviço de Limites"]
    EventBus["EventBridge"]

    HttpIn --> IdempFilter
    IdempFilter <-->|Verifica / Bloqueia Chave| Redis
    IdempFilter --> AuthUseCase
    AuthUseCase --> LimitAdapter
    LimitAdapter <-->|Reserva Limite Atômico| LimitMicroservice
    AuthUseCase --> EventPub
    EventPub --> EventBus

    classDef internal fill:#0F172A,stroke:#6366F1,stroke-width:2px,color:#F8FAFC;
    classDef external fill:#1E293B,stroke:#94A3B8,stroke-width:1px,color:#F8FAFC;

    class HttpIn,IdempFilter,AuthUseCase,LimitAdapter,EventPub internal;
    class Redis,LimitMicroservice,EventBus external;
```
