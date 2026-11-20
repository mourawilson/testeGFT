/**
 * @file server.js
 * Servidor do BFF (Backend for Frontend) & Server-Driven UI (Porta 3001)
 */

import http from 'node:http';
import { buildHomeScreenSDUI } from './sdui-templates.js';
import { TransactionCoreEngine } from './transaction-core.js';

const PORT = process.env.PORT || 3001;
const AI_ORCHESTRATOR_URL = process.env.AI_ORCHESTRATOR_URL || 'http://localhost:3002';

const transactionEngine = new TransactionCoreEngine();

// Helper para ler body da requisição
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Configuração Global de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, x-correlation-id, traceparent');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. Healthcheck
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'HEALTHY', service: 'bff-sdui-service', port: PORT }));
    return;
  }

  // 2. Endpoint SDUI: Resolução declarativa de tela
  // Ex: GET /api/sdui/screen/home_dashboard?profile=normal
  if (url.pathname.startsWith('/api/sdui/screen/') && req.method === 'GET') {
    const profile = url.searchParams.get('profile') || 'normal';
    const contract = transactionEngine.getContract('CTR-CRED-2026-9981');

    const sduiPayload = buildHomeScreenSDUI({
      profile,
      accountData: {
        account_id: contract.id_conta,
        client_name: contract.client_name,
        account_balance: 1450.20,
        credit_limit_total: contract.limite_total,
        credit_limit_used: contract.saldo_utilizado,
        credit_limit_available: contract.limite_total - (contract.saldo_utilizado + contract.saldo_reservado)
      }
    });

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
    });
    res.end(JSON.stringify(sduiPayload, null, 2));
    return;
  }

  // 3. Endpoint Transacional Síncrono de Autorização (Itaú/AWS POD99 Spec)
  // POST /v1/contratos/:id_contrato/autorizacoes
  const authMatch = url.pathname.match(/^\/(?:api\/)?v1\/contratos\/([^/]+)\/autorizacoes$/);
  if (authMatch && req.method === 'POST') {
    try {
      const idContrato = authMatch[1];
      const idempotencyKey = req.headers['idempotency-key'] || req.headers['Idempotency-Key'];
      const traceparent = req.headers['traceparent'];
      const payload = await readRequestBody(req);

      const authResult = transactionEngine.authorize({
        idContrato,
        idempotencyKey,
        payload,
        traceparent
      });

      const contentType = authResult.isProblemDetails ? 'application/problem+json' : 'application/json';
      res.writeHead(authResult.statusCode, { 'Content-Type': contentType });
      res.end(JSON.stringify(authResult.body, null, 2));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/problem+json' });
      res.end(JSON.stringify({
        type: 'https://api.banco.corp/errors/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: err.message
      }));
    }
    return;
  }

  // 4. Endpoint do Assistente de IA (Orquestração BFF -> AI Orchestrator)
  // POST /api/v1/agent/chat
  if (url.pathname === '/api/v1/agent/chat' && req.method === 'POST') {
    try {
      const payload = await readRequestBody(req);

      // Chamada HTTP para o microserviço AI Orchestrator
      const aiResponse = await fetch(`${AI_ORCHESTRATOR_URL}/api/agent/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const aiData = await aiResponse.json();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(aiData));
    } catch (err) {
      // Fallback gracioso se o AI Orchestrator estiver offline
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'FALLBACK_MODE',
        response_text: 'O assistente de IA em nuvem está momentaneamente indisponível. Utilize as rotas locais do SuperApp.',
        tools_executed: [],
        sdui_components: []
      }));
    }
    return;
  }

  // 5. Endpoint de Monitoramento do Event Bus em Tempo Real
  // GET /api/events
  if (url.pathname === '/api/events' && req.method === 'GET') {
    const events = transactionEngine.getRecentEvents();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count: events.length, events }, null, 2));
    return;
  }

  // Rota 404
  res.writeHead(404, { 'Content-Type': 'application/problem+json' });
  res.end(JSON.stringify({
    type: 'https://api.banco.corp/errors/not-found',
    title: 'Resource Not Found',
    status: 404,
    detail: `A rota ${url.pathname} não existe neste BFF.`
  }));
});

server.listen(PORT, () => {
  console.log(`[BFF SDUI Service] Ativo em http://localhost:${PORT}`);
});
