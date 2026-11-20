# Event Bus Contracts & Governança de Schemas

Este diretório contém os contratos formais dos eventos assíncronos que trafegam pelo ecossistema transacional e analítico da instituição financeira.

## 1. Princípios de Governança
* **Padrão CloudEvents 1.0:** Todos os eventos adotam a especificação da CNCF (Cloud Native Computing Foundation), assegurando metadados consistentes para roteamento, correlação e observabilidade.
* **Compatibilidade Retroativa Obrigatória (Backward Compatibility):** Nenhum campo obrigatório existente pode ser removido ou ter seu tipo alterado. Novos atributos devem ser adicionados como opcionais (`nullable: true`).
* **Validação em Tempo de Deploy:** Schemas são versionados e registrados no **AWS Glue Schema Registry**. Pipelines de CI/CD reprovam pull requests que introduzam alterações não retrocompatíveis.
* **Garantia de Deduplicação:** O cabeçalho `id` (UUID único) deve ser persistido pelos serviços consumidores durante a janela de retenção para garantir idempotência frente à semântica *at-least-once* do Amazon MSK (Kafka) e Amazon EventBridge.

## 2. Catálogo de Eventos Disponíveis
* `TransacaoAutorizada.v1.json`: Fato de autorização de débito, crédito ou reserva no core banking.
* `LimiteAlterado.v1.json`: Modificação de limites por decisão de risco ou ajuste assistido por IA.
* `AnomaliaEdgeDetectada.v1.json`: Sinalização de telemetria e biometria comportamental anormal gerada no Edge AI.
* `InsightAgenteGerado.v1.json`: Notificação de recomendação e personalização para renderização via SDUI.
