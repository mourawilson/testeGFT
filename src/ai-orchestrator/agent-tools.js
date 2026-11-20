/**
 * @file agent-tools.js
 * Ferramentas (Tools) Determinísticas e Fortemente Tipadas do Agente Financeiro
 */

// Estado simulado do cliente em memória (representando o Core Banking / DynamoDB)
const MOCK_CLIENT_DATABASE = {
  account_id: '0001-98765-4',
  client_name: 'Carlos Eduardo Silveira',
  contract_id: 'CTR-CRED-2026-9981',
  credit_limit_total: 10000.0,
  credit_limit_used: 6800.0,
  credit_limit_available: 3200.0,
  account_balance: 1450.20,
  cards: [
    { card_id: 'CARD-VISA-4111', last4: '4111', status: 'ACTIVE', type: 'VIRTUAL' },
    { card_id: 'CARD-ELO-8899', last4: '8899', status: 'ACTIVE', type: 'PHYSICAL' }
  ],
  recent_expenses: [
    { category: 'Supermercado', total: 1840.50, count: 8 },
    { category: 'Transporte/Combustivel', total: 920.00, count: 12 },
    { category: 'Restaurantes', total: 1450.00, count: 6 },
    { category: 'Assinaturas/Streaming', total: 280.00, count: 4 }
  ]
};

export class AgentToolsRegistry {
  constructor(db = MOCK_CLIENT_DATABASE) {
    this.db = db;
  }

  /**
   * Tool: Consulta consolidada de saldos e limites de contratos
   */
  async consultar_limites_e_saldo(params) {
    return {
      status: 'SUCCESS',
      tool_name: 'consultar_limites_e_saldo',
      data: {
        account_id: this.db.account_id,
        contract_id: this.db.contract_id,
        saldo_conta_corrente: this.db.account_balance,
        limite_credito_total: this.db.credit_limit_total,
        limite_credito_utilizado: this.db.credit_limit_used,
        limite_credito_disponivel: this.db.credit_limit_available,
        percentual_utilizado: Number(((this.db.credit_limit_used / this.db.credit_limit_total) * 100).toFixed(1))
      }
    };
  }

  /**
   * Tool: Análise discriminada de gastos por categoria
   */
  async analisar_gastos_categoria(params) {
    return {
      status: 'SUCCESS',
      tool_name: 'analisar_gastos_categoria',
      data: {
        periodo: 'MES_ATUAL',
        total_despesas: this.db.recent_expenses.reduce((acc, curr) => acc + curr.total, 0),
        detalhamento: this.db.recent_expenses
      }
    };
  }

  /**
   * Tool: Bloqueio preventivo de cartão por suspeita de fraude
   */
  async bloqueio_preventivo_cartao(params) {
    const card = this.db.cards.find((c) => c.last4 === params.last4 || c.card_id === params.card_id) || this.db.cards[0];
    card.status = 'BLOCKED_PREVENTIVE';

    return {
      status: 'SUCCESS',
      tool_name: 'bloqueio_preventivo_cartao',
      data: {
        card_id: card.card_id,
        last4: card.last4,
        novo_status: card.status,
        motivo: params.motivo || 'SOLICITACAO_PREVENTIVA_VIA_AGENTE',
        mensagem: `Cartão final ${card.last4} foi bloqueado preventivamente com sucesso.`
      }
    };
  }

  /**
   * Tool: Solicitação de ajuste emergencial de limite
   */
  async solicitar_ajuste_emergencial(params) {
    const valorAumento = Math.min(Number(params.valor_solicitado) || 1500.0, 2000.0); // teto de R$ 2.000
    this.db.credit_limit_total += valorAumento;
    this.db.credit_limit_available += valorAumento;

    return {
      status: 'SUCCESS',
      tool_name: 'solicitar_ajuste_emergencial',
      data: {
        contract_id: this.db.contract_id,
        valor_adicionado: valorAumento,
        novo_limite_total: this.db.credit_limit_total,
        novo_limite_disponivel: this.db.credit_limit_available,
        exige_confirmacao_biometrica: true,
        protocolo: `EMERG-${Date.now().toString(36).toUpperCase()}`
      }
    };
  }
}
