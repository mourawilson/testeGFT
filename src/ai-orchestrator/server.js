/**
 * @file server.js
 * Servidor HTTP do AI Orchestrator (Porta 3002)
 */

import http from 'node:http';
import { AgentOrchestrator } from './orchestrator.js';

const PORT = process.env.PORT || 3002;
const orchestrator = new AgentOrchestrator();

const server = http.createServer(async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-correlation-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Healthcheck
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'HEALTHY', service: 'ai-orchestrator', timestamp: new Date().toISOString() }));
    return;
  }

  // Endpoint de Processamento Agêntico
  if (url.pathname === '/api/agent/query' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const text = payload.text || '';
        const user_id = payload.user_id || 'USER-8821';
        const edge_telemetry = payload.edge_telemetry || {};

        const result = await orchestrator.processQuery({ text, user_id, edge_telemetry });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR', message: err.message }));
      }
    });
    return;
  }

  // Rota não encontrada
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'NOT_FOUND', path: url.pathname }));
});

server.listen(PORT, () => {
  console.log(`[AI Orchestrator] Serviço ativo em http://localhost:${PORT}`);
});
