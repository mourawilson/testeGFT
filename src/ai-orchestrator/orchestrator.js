/**
 * @file orchestrator.js
 * Orquestrador Principal do Agente de IA (Bedrock / LangChain pattern)
 */

import { GuardrailEngine } from './guardrails.js';
import { VectorKnowledgeStore } from './knowledge-base.js';
import { AgentToolsRegistry } from './agent-tools.js';

export class AgentOrchestrator {
  constructor() {
    this.guardrail = new GuardrailEngine();
    this.knowledgeStore = new VectorKnowledgeStore();
    this.toolsRegistry = new AgentToolsRegistry();
  }

  /**
   * Processa uma consulta do usuário ponta a ponta
   * @param {Object} request - { text, user_id, context, edge_telemetry }
   */
  async processQuery({ text, user_id = 'USER-8821', context = {}, edge_telemetry = {} }) {
    const startTime = Date.now();

    // 1. Camada de Guardrail (Segurança e LGPD)
    const guardrailResult = this.guardrail.inspect(text);
    if (!guardrailResult.allowed) {
      return {
        status: 'BLOCKED_BY_GUARDRAIL',
        response_text: guardrailResult.rejection_reason,
        security_violation: guardrailResult.security.violation_type,
        tools_executed: [],
        sdui_components: [
          {
            type: 'SecurityWarningBanner',
            props: {
              severity: 'CRITICAL',
              headline: 'Alerta de Segurança Bancária',
              body: guardrailResult.rejection_reason
            }
          }
        ],
        latency_ms: Date.now() - startTime
      };
    }

    const sanitizedPrompt = guardrailResult.sanitized_prompt;

    // 2. Camada de RAG (Recuperação de Políticas Corporativas)
    const retrievedDocs = this.knowledgeStore.search(sanitizedPrompt, 2);

    // 3. Raciocínio Agêntico e Execução de Ferramentas (Tool Calling)
    const executedTools = [];
    let finalSummary = '';
    const sduiComponents = [];
    const lowerPrompt = sanitizedPrompt.toLowerCase();

    // Cenário A: Consulta sobre suficiência de limite / fatura (Ex: "vai dar pra pagar fatura de 4 mil?")
    if (lowerPrompt.includes('pagar') || lowerPrompt.includes('fatura') || lowerPrompt.includes('limite')) {
      const limitData = await this.toolsRegistry.consultar_limites_e_saldo();
      executedTools.push(limitData);

      const valorMencionadoMatch = lowerPrompt.match(/(\d+(?:\.\d+)?)\s*(?:mil|k)?/i);
      let valorDesejado = 4000.0;
      if (valorMencionadoMatch) {
        let v = parseFloat(valorMencionadoMatch[1]);
        if (lowerPrompt.includes('mil') || lowerPrompt.includes('k')) v *= 1000;
        if (v > 0) valorDesejado = v;
      }

      const disponivel = limitData.data.limite_credito_disponivel;
      const deficit = valorDesejado - disponivel;

      if (deficit > 0) {
        finalSummary = `Seu limite disponível atual é de R$ ${disponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, o que é insuficiente para quitar a despesa de R$ ${valorDesejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (faltam R$ ${deficit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Identifiquei na política de crédito a possibilidade de solicitar um Ajuste Emergencial Provisório de até R$ 2.000,00 para aprovar a operação imediatamente.`;

        sduiComponents.push({
          type: 'SmartInsightBanner',
          props: {
            severity: 'ALERT',
            headline: `Déficit de Limite Detectado: Faltam R$ ${deficit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            body: `Você possui R$ ${disponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} disponível. Deseja efetuar um ajuste emergencial de limite de R$ 1.500,00?`,
            primary_button_text: 'Ajustar Limite Agora',
            secondary_button_text: 'Ver Outras Opções'
          },
          actions: {
            on_primary_action: 'agent://trigger_tool?name=solicitar_ajuste_emergencial&valor=1500'
          }
        });
      } else {
        finalSummary = `Você possui R$ ${disponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de limite disponível, valor suficiente para cobrir a transação de R$ ${valorDesejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} com tranquilidade.`;
      }
    }
    // Cenário B: Bloqueio Preventivo de Cartão
    else if (lowerPrompt.includes('bloquear') || lowerPrompt.includes('travar')) {
      const blockResult = await this.toolsRegistry.bloqueio_preventivo_cartao({ last4: '4111', motivo: 'SOLICITACAO_PREVENTIVA' });
      executedTools.push(blockResult);
      finalSummary = 'Seu cartão virtual com final 4111 foi bloqueado preventivamente com sucesso para proteger suas finanças. Nenhum novo débito será autorizado.';

      sduiComponents.push({
        type: 'SecurityStatusCard',
        props: {
          status: 'BLOCKED',
          headline: 'Cartão Bloqueado Preventivamente',
          details: 'Final 4111 • Desbloqueio disponível via biometria a qualquer momento.'
        }
      });
    }
    // Cenário C: Análise de Gastos e Economia
    else if (lowerPrompt.includes('gastos') || lowerPrompt.includes('despesas') || lowerPrompt.includes('categoria')) {
      const spendResult = await this.toolsRegistry.analisar_gastos_categoria();
      executedTools.push(spendResult);
      finalSummary = `Neste mês você acumulou R$ ${spendResult.data.total_despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em despesas. A categoria mais representativa foi Supermercado (R$ 1.840,50), seguida por Restaurantes (R$ 1.450,00).`;

      sduiComponents.push({
        type: 'ExpenseAnalysisWidget',
        props: {
          total: spendResult.data.total_despesas,
          categories: spendResult.data.detalhamento
        }
      });
    }
    // Cenário D: FAQ Geral com base no RAG
    else {
      const topDoc = retrievedDocs[0];
      finalSummary = topDoc
        ? `De acordo com a norma corporativa (${topDoc.title}): ${topDoc.content}`
        : 'Como assistente financeiro do SuperApp, posso ajudar você a consultar limites, simular pagamentos de fatura, ajustar margens emergenciais ou bloquear cartões.';
    }

    const latencyMs = Date.now() - startTime;

    return {
      status: 'SUCCESS',
      prompt_sanitized: sanitizedPrompt,
      pii_masked: guardrailResult.pii.has_pii,
      rag_retrieved_documents: retrievedDocs.map((d) => ({ id: d.id, title: d.title, score: d.similarity_score })),
      tools_executed: executedTools.map((t) => t.tool_name),
      response_text: finalSummary,
      sdui_components: sduiComponents,
      latency_ms: latencyMs,
      audit: {
        model: 'AWS Bedrock / Claude 3.5 Sonnet (Simulado)',
        guardrail_version: 'v1.4-lgpd',
        timestamp: new Date().toISOString()
      }
    };
  }
}
