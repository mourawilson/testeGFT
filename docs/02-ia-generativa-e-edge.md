# 02 — Inteligência Artificial Generativa e Arquitetura Híbrida (Cloud + Edge AI)

## 1. Visão Arquitetural de IA para o Ecossistema Móvel

A introdução de recursos agênticos e modelos de linguagem no canal mobile de um banco com mais de 80 milhões de clientes impõe restrições severas de custo, latência, disponibilidade e privacidade:
* Se cada toque na tela ou pesquisa no app disparar uma requisição para um modelo fundacional em nuvem (ex.: Claude 3.5 Sonnet ou GPT-4o), o custo operacional de inferência explodiria, e a latência de rede (300ms a 2.000ms) degradaria a percepção de agilidade do SuperApp.
* Se dados pessoais não forem sanitizados rigorosamente na ponta, a instituição incorre em risco de descumprimento da LGPD e vazamento de segredo bancário.
* Se a conexão com a internet oscilar no metrô ou em áreas remotas, o cliente não pode ficar sem assistência para operações rotineiras e seguras.

Para atender a esses requisitos, projetamos uma **Arquitetura de IA Híbrida em Duas Camadas**:
1. **Camada On-Device (Edge AI):** Modelos ultra-leves quantizados executando diretamente no hardware do smartphone (via NPU/GPU local com ONNX Runtime, Apple CoreML ou Google TensorFlow Lite).
2. **Camada de Nuvem (Cloud AI Orchestrator):** Pipeline de RAG corporativo e agentes autônomos orquestrados no Amazon Bedrock e Amazon SageMaker, com guardrails estritos de conformidade e *tool calling* transacional determinístico.

---

## 2. Matriz de Decisão: Edge AI vs. Cloud AI

A tabela abaixo resume os critérios objetivos adotados para direcionar cada carga de trabalho de IA no SuperApp:

| Critério Arquitetural | Camada On-Device (Edge AI) | Camada Cloud (AWS Bedrock / SageMaker) |
| :--- | :--- | :--- |
| **Latência de Inferência** | **Ultra-baixa (5ms a 30ms)** — sem overhead de rede (HTTP handshake, SSL, round-trip). | **Média a Alta (400ms a 2.500ms)** — dependente de rede e geração de tokens. |
| **Custo Computacional** | **Zero custo de nuvem por inferência** — utiliza o hardware do dispositivo do cliente. | **Custo por token/minuto** de GPU na nuvem. |
| **Disponibilidade / Modo Offline** | **100% autônomo** — opera mesmo sem sinal de rede ou em modo avião. | Requer conexão estável com a internet. |
| **Privacidade e Proteção de PII** | **Máxima** — dados biométricos e telemetria de digitação nunca saem do aparelho. | Requer mascaramento prévio (*PII de-identification*) antes do envio. |
| **Capacidade Cognitiva** | **Especializada e compacta** (classificação de intenção, regressão de risco, NER leve). | **Raciocínio complexo multi-step**, síntese de contexto amplo e RAG corporativo. |
| **Atualização de Modelo** | Ciclo de atualização de artefatos via CDN (*Over-the-Air*) ou atualização de app. | Atualização instantânea no backend, sem fricção no cliente. |

### Modelos Práticos Rodando no Dispositivo (Edge AI)
1. **Mobile Intent Classifier (ONNX / TFLite ~15MB):**
   * Classifica a intenção primária do usuário a partir do texto digitado ou comando de voz.
   * Roteia imediatamente intenções estáticas (ex.: "ver saldo", "chave pix", "bloquear cartão temporário") para controladores nativos do app sem gastar chamadas de LLM.
2. **Biometric & Behavioral Anomaly Engine (CoreML / TFLite ~5MB):**
   * Analisa a dinâmica de digitação (*keystroke dynamics*), cadência, ângulo do giroscópio e velocidade de navegação na tela.
   * Gera um `device_risk_score` (0.0 a 1.0) localmente, anexado de forma criptografada nos cabeçalhos das requisições para alimentar o motor antifraude e os guardrails de autorização.
3. **Local Privacy Gatekeeper:**
   * Executa varredura de expressões regulares e modelos de NER locais para identificar e alertar o usuário caso ele esteja digitando senhas, CVVs ou dados ultrassensíveis no prompt.

---

## 3. Arquitetura da Camada Cloud: RAG e Orquestração Agêntica

Quando a requisição exige raciocínio aprofundado, consolidação de múltiplos extratos ou consulta a regulamentações do banco, a solicitação é despachada para o **Cloud AI Orchestrator**.

```mermaid
flowchart TB
    subgraph EdgeDevice["Borda Mobile"]
        UserQuery["Entrada do Usuário\n(Texto / Comando)"]
        EdgeClassifier{"Edge Intent Classifier\n(&lt; 30ms)"}
        LocalAction["Executa Rota Local\n(Ex: abre extrato / Pix)"]
        UserQuery --> EdgeClassifier
        EdgeClassifier -- "Intenção Básica" --> LocalAction
    end

    subgraph CloudGate["Fronteira de Nuvem & Segurança"]
        BFF["BFF Gateway"]
        PIIFilter["PII Sanitizer & Guardrails\n(Anonimização de CPF, Nome, Cartão)"]
        PromptDefense["Anti-Prompt Injection Engine\n(Detecção de Jailbreak e Prompt Leaks)"]
    end

    subgraph Orchestrator["AI Agent Orchestrator (LangChain / Bedrock)"]
        AgentCore["Agent Reasoning Core\n(Claude 3.5 Sonnet / AWS Bedrock)"]
        SemanticRouter["Roteador Semântico de Ferramentas"]
        MemoryStore["Histórico da Sessão Criptografado\n(Amazon DynamoDB)"]
    end

    subgraph KnowledgeTier["RAG Corporativo"]
        Embedder["Amazon Titan Text Embeddings"]
        VectorDB["Amazon OpenSearch Serverless\n(Políticas de Crédito, Manuais BACEN, FAQ)"]
    end

    subgraph ToolEcosystem["Ferramentas Corporativas Determinísticas (Tools)"]
        ToolLimit["Tool: consultar_limites_contrato"]
        ToolSpend["Tool: analisar_gastos_recorrentes"]
        ToolLock["Tool: bloqueio_preventivo_cartao"]
        ToolAdjust["Tool: solicitar_ajuste_emergencial"]
    end

    subgraph CoreBackend["Backends Transacionais"]
        CoreLimitService["Serviço de Limites & Contratos"]
        CoreCardsService["Serviço de Gestão de Cartões"]
    end

    EdgeClassifier -- "Demanda Complexa / Consulta RAG" --> BFF
    BFF --> PIIFilter --> PromptDefense --> AgentCore
    AgentCore <--> MemoryStore
    AgentCore <--> SemanticRouter

    SemanticRouter -- "Dúvida Regulatória / Produto" --> Embedder --> VectorDB
    VectorDB -- "Contexto Semântico Recuperado" --> AgentCore

    SemanticRouter -- "Ação Transacional" --> ToolLimit & ToolSpend & ToolLock & ToolAdjust
    ToolLimit --> CoreLimitService
    ToolAdjust --> CoreLimitService
    ToolLock --> CoreCardsService

    classDef edge fill:#1E293B,stroke:#38BDF8,stroke-width:2px,color:#F8FAFC;
    classDef gate fill:#0F172A,stroke:#10B981,stroke-width:2px,color:#F8FAFC;
    classDef orch fill:#0F172A,stroke:#6366F1,stroke-width:2px,color:#F8FAFC;
    classDef rag fill:#1E293B,stroke:#F59E0B,stroke-width:1px,color:#F8FAFC;
    classDef tools fill:#0F172A,stroke:#EC4899,stroke-width:2px,color:#F8FAFC;

    class UserQuery,EdgeClassifier,LocalAction edge;
    class BFF,PIIFilter,PromptDefense gate;
    class AgentCore,SemanticRouter,MemoryStore orch;
    class Embedder,VectorDB rag;
    class ToolLimit,ToolSpend,ToolLock,ToolAdjust,CoreLimitService,CoreCardsService tools;
```

---

## 4. Práticas de MLOps e Ciclo de Vida de Modelos

Para sustentar a operação de modelos de linguagem e agentes em escala bancária, implementamos as seguintes práticas de MLOps:
1. **Prompt Versioning e Prompt Registry:**
   * Utilização do **Amazon Bedrock Prompt Management** e repositório Git centralizado para rastreamento de versões de templates de prompts.
   * Cada prompt possui metadados de versão semântica, modelo-alvo, temperatura e suite de testes de regressão associada.
2. **Avaliação Contínua de Alucinação (Ragas & TruLens):**
   * Pipeline automatizado de testes que afere:
     * *Faithfulness:* Se a resposta do assistente baseou-se estritamente no contexto retornado pelo RAG.
     * *Answer Relevance:* Se a resposta atende à pergunta formulada.
     * *Context Recall:* Se todos os trechos regulatórios necessários foram recuperados do banco vetorial.
3. **Monitoramento e Detecção de Drift:**
   * **Amazon SageMaker Model Monitor** captura as distribuições de tokens, latência p99 e taxas de fallback de ferramentas.
   * Alarmes automáticos no CloudWatch são disparados caso a taxa de chamadas a ferramentas de fallback (*fallback tool rate*) aumente em mais de 2%.
4. **Human-in-the-Loop (HITL) para Operações de Risco:**
   * O agente tem autonomia para *consultar* saldos, faturas e políticas.
   * Ações que alterem o estado patrimonial do cliente (ex.: efetuar pagamentos, aumentar limite de crédito acima de R$ 5.000,00 ou cancelar produtos) **nunca são executadas diretamente pelo LLM**. O agente monta uma proposta declarativa em Server-Driven UI e exige autenticação biométrica nativa (FaceID/Fingerprint) antes de acionar o endpoint de efetivação.

---

## 5. Diagrama de Sequência: Fluxo Híbrido Ponta a Ponta

O diagrama abaixo detalha a interação síncrona e assíncrona entre o cliente, os modelos locais e os componentes em nuvem da AWS:

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Usuário no SuperApp
    participant Shell as SuperApp Shell
    participant Edge as Edge AI Engine (Local)
    participant BFF as BFF SDUI Gateway
    participant Guard as PII & Prompt Guardrail
    participant Agent as AI Agent Orchestrator
    participant RAG as Vector Store (OpenSearch)
    participant LLM as Amazon Bedrock (Claude 3.5)
    participant Core as Serviço de Limites (DynamoDB)

    Cliente->>Shell: Digita: "Meu limite vai dar pra pagar a fatura de 4 mil?"
    Shell->>Edge: Executa inferência local on-device (INT8)
    Note over Edge: Latência: 18ms.<br/>Intenção detectada: FINANCIAL_ANALYSIS_COMPLEX.<br/>Score de anomalia do teclado: 0.04 (Baixo).<br/>Decisão: Requer Cloud Orchestrator.
    Edge-->>Shell: Retorna: { delegate_to_cloud: true, intent: "CREDIT_LIMIT_FORECAST" }

    Shell->>BFF: POST /v1/ai/chat (com payload + Telemetria de Risco)
    BFF->>Guard: Submete prompt para sanitização
    Note over Guard: Mascara CPF, números de conta e verifica contra Jailbreaks.<br/>Substitui por tokens anônimos seguros.
    Guard-->>BFF: Prompt Sanitizado

    BFF->>Agent: Dispara execução do Agente
    Agent->>RAG: Busca semântica: Regras de tolerância e limite emergencial
    RAG-->>Agent: Fragmentos da política de crédito do contrato
    
    Agent->>LLM: Prompt enriquecido com política + intenção
    Note over LLM: LLM identifica necessidade de dados do cliente.<br/>Gera Tool Call: consultar_limites_contrato(id_contrato)
    LLM-->>Agent: Decisão de Tool Call: "consultar_limites_contrato"

    Agent->>Core: Executa Port de Limites: GET /v1/contratos/{id}/limites
    Core-->>Agent: Retorna: { limite_disponivel: 3200.00, limite_total: 10000.00 }

    Agent->>LLM: Devolve resultado da ferramenta para raciocínio final
    LLM-->>Agent: Síntese estruturada (Alerta de insuficiência de R$ 800 + Opção de Ajuste)

    Agent-->>BFF: Retorna resposta + recomendação de ação de crédito
    Note over BFF: BFF converte a recomendação em componentes SDUI:<br/>- TextBubble<br/>- SmartInsightBanner (Ajuste Emergencial de Limite)<br/>- ActionButton (Ajustar para R$ 4.500)
    BFF-->>Shell: Payload Server-Driven UI (JSON Tipado)
    Shell->>Cliente: Renderiza resposta inteligente + card dinâmico de ajuste de limite instantâneo
```
