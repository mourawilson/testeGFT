# ADR-002: Estratégia Híbrida de Inteligência Artificial — Edge AI vs. Cloud AI

* **Status:** Aprovado
* **Data:** 2026-11-20
* **Decisores:** Principal Solutions Architect, Head of AI & Machine Learning, Lead Mobile Security Architect
* **Contexto de Negócio:** Assistente Financeiro Inteligente em SuperApp com picos de uso diário, restrições orçamentárias de inferência de LLM e conformidade estrita com LGPD

---

## 1. Contexto e Declaração do Problema

A integração de recursos de IA generativa em aplicativos financeiros corporativos tipicamente comete o erro de centralizar 100% da inteligência em modelos fundacionais gigantescos na nuvem. Em escala de 80 milhões de clientes:
1. **Custo Inviável:** Processar centenas de milhões de mensagens triviais (ex.: "qual meu saldo?", "como pedir segunda via de cartão?") em LLMs na nuvem consome milhões de dólares mensais em tokens e GPUs dedicadas.
2. **Latência Incompatível com Mobile:** O tempo de resposta de um LLM de grande porte varia de 800ms a 3.000ms. Para ações rápidas de navegação, essa latência gera atrito e percepção de lentidão.
3. **Privacidade e Proteção de PII:** Enviar dados biométricos de digitação e contexto bruto do teclado para servidores remotos viola o princípio de minimização da LGPD e amplia o vetor de vazamento de dados.

---

## 2. Decisão Arquitetural

Decidimos adotar uma **Arquitetura Híbrida e Hierárquica de Inteligência Artificial**:
1. **Inferência Primária no Dispositivo (Edge AI):**
   * Implementação de modelos leves quantizados em INT8 (via ONNX Runtime Mobile, Apple CoreML e Google TFLite).
   * Modelo de classificação de intenções de 15MB embarcado no binário móvel para resolução instantânea (&lt; 30ms) de comandos transacionais conhecidos e rotas nativas do SuperApp.
   * Modelo de análise comportamental (*keystroke dynamics*) operando exclusivamente na memória do aparelho para gerar um `device_risk_score` local sem exportação de dados brutos de digitação.
2. **Delegação Controlada para a Nuvem (Cloud AI Orchestrator):**
   * A nuvem só é acionada quando o modelo on-device classifica a intenção como `COMPLEX_REASONING`, `FINANCIAL_ADVICE` ou `UNSTRUCTURED_FAQ`.
   * A requisição passa por um filtro de sanitização e mascaramento de PII antes de atingir o Amazon Bedrock (Claude 3.5 Sonnet / SageMaker) e o pipeline de RAG (OpenSearch Serverless).

---

## 3. Alternativas Consideradas

### Alternativa A: Cloud-Only AI (LLM Centralizado para Tudo)
* *Prós:* Simplicidade de atualização de modelos; nenhum impacto no tamanho do instalador mobile.
* *Contras:* Custos estratosféricos em nuvem; latência inaceitável para interações rápidas; risco regulatório por tráfego massivo de dados de clientes na rede.
* *Motivo de Rejeição:* Inviável economicamente e técnica para 80 milhões de usuários.

### Alternativa B: Edge-Only AI (LLM Embarcado Totalmente no Celular)
* *Prós:* Privacidade absoluta; funcionamento 100% offline; custo zero de servidor por inferência.
* *Contras:* Modelos SLM (Small Language Models de 1B a 3B parâmetros) exigem aparelhos de ponta (iPhone 15 Pro+, Snapdragon 8 Gen 3) com pelo menos 8GB de RAM. Na realidade brasileira, onde grande parte da base utiliza smartphones intermediários ou de entrada, o app sofreria travamentos (*Out of Memory Crashes*) e esgotaria a bateria do usuário.
* *Motivo de Rejeição:* Exclusão digital de expressiva parcela da base de clientes.

---

## 4. Trade-offs e Implicações

* **Tamanho do Aplicativo (*App Binary Size*):** O modelo ONNX/TFLite quantizado adiciona aproximadamente 15MB ao download inicial. Este tamanho é mantido enxuto mediante técnicas de destilação de conhecimento (*knowledge distillation*) e quantização pós-treinamento.
* **Governança de Versões de Modelo:** Atualizações do modelo on-device precisam de um mecanismo de entrega contínua de artefatos (*Over-the-Air dynamic asset loading*) assinado criptograficamente.

---

## 5. Riscos e Mitigações

| Risco Identificado | Severidade | Estratégia de Mitigação |
| :--- | :--- | :--- |
| **Falso negativo na classificação local (Edge AI não entender comando e travar)** | Média | Mecanismo de *Threshold Confidence Score*: se a confiança da inferência local for inferior a 80%, a requisição é automaticamente promovida para a nuvem. |
| **Divergência entre regras de negócio da borda e da nuvem** | Média | A borda apenas classifica intenção semântica; a validação de regras de negócio e saldo permanece centralizada e determinística no backend transacional. |
| **Consumo anormal de bateria por inferência contínua no celular** | Alta | O motor on-device só é despertado quando o usuário toca na barra do assistente ou inicia digitação, operando em threads de background de prioridade controlada. |
