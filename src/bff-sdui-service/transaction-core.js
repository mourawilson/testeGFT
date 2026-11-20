/**
 * @file transaction-core.js
 * Core Transacional de Autorização com Idempotência (RFC 7807) e Event Bus (CloudEvents 1.0)
 * Alinhado às especificações do caso de negócio de autorizações sob 5.000 TPS.
 */

import { randomUUID } from 'node:crypto';

export class TransactionCoreEngine {
  constructor() {
    // Tabela simulada de limites e contratos (DynamoDB Single Table emulation)
    this.contracts = new Map([
      [
        'CTR-CRED-2026-9981',
        {
          id_contrato: 'CTR-CRED-2026-9981',
          id_conta: '0001-98765-4',
          client_name: 'Carlos Eduardo Silveira',
          limite_total: 10000.0,
          saldo_utilizado: 6800.0,
          saldo_reservado: 0.0,
          version: 1
        }
      ]
    ]);

    // Cache de chaves de idempotência (Redis Cluster emulation com TTL)
    this.idempotencyStore = new Map();

    // Event Bus em memória (Amazon EventBridge & Kafka stream emulation)
    this.eventBus = [];
  }

  /**
   * Obtém os limites consolidados de um contrato
   */
  getContract(idContrato) {
    return this.contracts.get(idContrato) || this.contracts.get('CTR-CRED-2026-9981');
  }

  /**
   * Processa a autorização síncrona de transação com garantia de idempotência e RFC 7807
   */
  authorize({ idContrato, idempotencyKey, payload, traceparent }) {
    // 1. Validação de Idempotency-Key obrigatória (RFC 7807 se ausente)
    if (!idempotencyKey) {
      return {
        statusCode: 422,
        isProblemDetails: true,
        body: {
          type: 'https://api.banco.corp/errors/missing-idempotency-key',
          title: 'Unprocessable Entity - Cabeçalho Obrigatório Ausente',
          status: 422,
          detail: 'A operação de autorização mutante exige o cabeçalho Idempotency-Key (UUID v4) para prevenir duplicidade de débitos.',
          instance: `/v1/contratos/${idContrato}/autorizacoes`
        }
      };
    }

    // 2. Verificação de Chave de Idempotência já processada (Retorna 200 OK com payload original)
    if (this.idempotencyStore.has(idempotencyKey)) {
      const cachedResponse = this.idempotencyStore.get(idempotencyKey);
      return {
        statusCode: 200,
        isIdempotentReplay: true,
        body: cachedResponse
      };
    }

    // 3. Recuperação do Contrato no Core de Limites
    const contract = this.getContract(idContrato);
    if (!contract) {
      return {
        statusCode: 404,
        isProblemDetails: true,
        body: {
          type: 'https://api.banco.corp/errors/contract-not-found',
          title: 'Contrato Não Encontrado',
          status: 404,
          detail: `O contrato financeiro ${idContrato} não foi localizado na base ativa.`,
          instance: `/v1/contratos/${idContrato}/autorizacoes`
        }
      };
    }

    const valor = parseFloat(payload.valor);
    if (isNaN(valor) || valor <= 0) {
      return {
        statusCode: 422,
        isProblemDetails: true,
        body: {
          type: 'https://api.banco.corp/errors/invalid-amount',
          title: 'Valor Inválido para Autorização',
          status: 422,
          detail: 'O valor da transação deve ser um número decimal estritamente maior que zero.',
          instance: `/v1/contratos/${idContrato}/autorizacoes`
        }
      };
    }

    // 4. Verificação de Invariante de Limite Disponível
    const limiteDisponivel = contract.limite_total - (contract.saldo_utilizado + contract.saldo_reservado);

    if (valor > limiteDisponivel) {
      return {
        statusCode: 402,
        isProblemDetails: true,
        body: {
          type: 'https://api.banco.corp/errors/insufficient-limit',
          title: 'Payment Required - Limite de Crédito Insuficiente',
          status: 402,
          detail: `Operação recusada por regra de negócio. O valor de R$ ${valor.toFixed(2)} excede o limite disponível de R$ ${limiteDisponivel.toFixed(2)}.`,
          instance: `/v1/contratos/${idContrato}/autorizacoes`,
          invalid_params: {
            valor_solicitado: valor,
            limite_disponivel: limiteDisponivel,
            sugestao: 'Acione o Assistente de IA para avaliar concessão de ajuste emergencial provisório.'
          }
        }
      };
    }

    // 5. Reserva Atômica de Limite (Sucesso na Autorização)
    contract.saldo_reservado += valor;
    contract.version += 1;

    const idAutorizacao = randomUUID();
    const correlationId = randomUUID();
    const novoLimiteDisponivel = contract.limite_total - (contract.saldo_utilizado + contract.saldo_reservado);

    const successResponse = {
      id_autorizacao: idAutorizacao,
      id_contrato: contract.id_contrato,
      id_conta: contract.id_conta,
      status: 'AUTORIZADA',
      valor_autorizado: valor,
      moeda: payload.moeda || 'BRL',
      saldo_reservado: contract.saldo_reservado,
      limite_remanescente: novoLimiteDisponivel,
      autorizado_em: new Date().toISOString()
    };

    // Armazena no cache de Idempotência
    this.idempotencyStore.set(idempotencyKey, successResponse);

    // 6. Publicação de Evento de Domínio CloudEvents 1.0 no Event Bus
    const cloudEvent = {
      specversion: '1.0',
      id: randomUUID(),
      source: '/core/autorizacao/us-east-1/cluster-01',
      type: 'br.com.banco.transacao.autorizada.v1',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      correlation_id: correlationId,
      traceparent: traceparent || `00-${randomUUID().replace(/-/g, '')}-00f067aa0ba902b7-01`,
      data: {
        id_autorizacao: idAutorizacao,
        id_contrato: contract.id_contrato,
        id_conta: contract.id_conta,
        valor: valor,
        moeda: payload.moeda || 'BRL',
        tipo_operacao: payload.tipo_operacao || 'DEBITO',
        saldo_reservado: contract.saldo_reservado,
        limite_remanescente: novoLimiteDisponivel,
        id_estabelecimento: payload.id_estabelecimento || 'ESTABELECIMENTO_SUPERAPP',
        canal: 'SUPERAPP_MOBILE',
        metadata: payload.metadata || {}
      }
    };

    this.eventBus.unshift(cloudEvent);
    if (this.eventBus.length > 50) this.eventBus.pop(); // Mantém os 50 eventos mais recentes

    return {
      statusCode: 201,
      body: successResponse,
      publishedEvent: cloudEvent
    };
  }

  /**
   * Retorna os eventos recentes do Event Bus para visualização em tempo real
   */
  getRecentEvents() {
    return this.eventBus;
  }
}
