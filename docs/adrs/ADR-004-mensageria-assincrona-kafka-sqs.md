# ADR-004: Estratégia de Mensageria Assíncrona — Amazon MSK (Kafka) vs. EventBridge / SQS

* **Status:** Aprovado
* **Data:** 2026-11-20
* **Decisores:** Principal Solutions Architect, Lead Event-Driven Architect, Head of Data Platform
* **Contexto de Negócio:** Publicação de eventos transacionais de alta volumetria (picos de 5.000 TPS) com garantia de entrega, ordenação por contrato e desacoplamento de múltiplos consumidores (contabilidade, antifraude, auditoria, notificações)

---

## 1. Contexto e Declaração do Problema

Quando uma transação financeira é autorizada síncronamente pelo serviço de autorização (com SLA estrito &lt; 80ms), dezenas de sistemas de retaguarda precisam tomar conhecimento do fato ocorrido:
* O sistema contábil precisa registrar os lançamentos de débito e crédito no Razão (*General Ledger*).
* O motor antifraude precisa atualizar os perfis de velocidade de transação do portador.
* O serviço de mensageria móvel precisa enviar uma notificação push imediata para o smartphone do cliente.
* A plataforma de analytics precisa alimentar os data lakes para dashboards executivos.

Executar essas chamadas de forma síncrona dentro da transação HTTP de autorização violaria os requisitos não-funcionais: aumentaria a latência para além do limite aceitável e causaria falhas em cascata caso qualquer sistema secundário estivesse fora do ar.

---

## 2. Decisão Arquitetural

Decidimos adotar um **Modelo Híbrido de Eventos em Duas Vias**:
1. **Espinha Dorsal de Alta Volumetria (Stream Transacional) via Amazon MSK (Apache Kafka):**
   * Utilizado para o tráfego crítico de eventos de domínio gerados no core de autorização (evento `TransacaoAutorizada`).
   * **Garantia de Ordenação:** Particionamento rigoroso por `id_contrato` como chave de partição (*partition key*), garantindo que todos os débitos, estornos e créditos do mesmo contrato sejam consumidos na exata ordem cronológica.
   * **Semântica de Entrega:** Produção com `acks=all` e consumo idempotente por parte dos microserviços.
2. **Roteamento de Eventos de Domínio e Integração Serverless via Amazon EventBridge & SQS:**
   * Utilizado para eventos de integração corporativa, alertas de limites e notificações push.
   * Filtros declarativos baseados em regras (*Rule-based Content Filtering*), permitindo que consumidores (como o Serviço de Notificações) recebam apenas eventos que atendam a critérios específicos (ex.: transações de valor superior a R$ 100,00 ou tentativas de transação negadas por falta de limite).
   * Uso de **Amazon SQS com Dead Letter Queue (DLQ)** para isolar mensagens venenosas (*poison pills*) e garantir retry exponencial com jitter.

---

## 3. Alternativas Consideradas

### Alternativa A: Apenas Amazon SQS Puro com SNS (Fan-out Clássico)
* *Prós:* Simplicidade operacional total; modelo serverless sem custos fixos de cluster.
* *Contras:* Não suporta streaming distribuído de alta retenção; não garante ordenação cronológica estrita por partição sob escala de 5.000 TPS simultâneos (SQS FIFO possui teto de 3.000 TPS com batching e custo superior); impossibilidade de reprocessamento histórico (*event replay*).
* *Motivo de Rejeição:* Incapacidade de atender à necessidade de replay contábil e auditoria estrita de ordenação por contrato.

### Alternativa B: Apenas Amazon EventBridge para Todos os 5.000 TPS
* *Prós:* Recursos avançados de schema discovery e roteamento inteligente.
* *Contras:* O custo por milhão de eventos em volumetria extrema contínua é sensivelmente mais oneroso do que um cluster provisionado/serverless de MSK, além de ter latências de ingestão levemente superiores (p99 em torno de 20ms a 50ms vs &lt; 5ms no Kafka).
* *Motivo de Rejeição:* Custo e latência para o stream primário de autorizações.

---

## 4. Trade-offs e Implicações

* **Sobrecarga de Gestão (Operação de Kafka):** Clusters Kafka exigem monitoramento de balanceamento de partições, lag de consumidores e capacidade de disco dos brokers. Mitigado através do uso de **Amazon MSK Serverless** ou provisionado com auto-expand storage.
* **Complexidade de Schema Registry:** Adotamos o **AWS Glue Schema Registry** com formato **CloudEvents 1.0** para governança de schemas e garantia de compatibilidade retroativa (*backward compatibility*).

---

## 5. Riscos e Mitigações

| Risco Identificado | Severidade | Estratégia de Mitigação |
| :--- | :--- | :--- |
| **Desbalanceamento de partição (*hot partition*) gerado por conta muito ativa** | Média | Uso de hash hashing uniforme (`MurmurHash3`) sobre `id_contrato` e dimensionamento com número elevado de partições (ex.: 64 a 128 partições por tópico transacional). |
| **Consumidor lento causar acúmulo excessivo de lag** | Alta | Auto-scaling de pods consumidores em Kubernetes (EKS) via KEDA orientado ao lag de partição do Kafka. |
| **Duplicação de mensagens em caso de retentativas de rede** | Alta | Todo consumidor de eventos implementa verificação de idempotência no banco de dados local armazenando o `event_id` (UUID único do CloudEvent). |
