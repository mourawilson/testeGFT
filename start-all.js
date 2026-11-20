/**
 * @file start-all.js
 * Script de inicialização integrada dos serviços para demonstração local em 1 comando.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const services = [
  { name: 'AI-Orchestrator', script: 'src/ai-orchestrator/server.js', port: 3002 },
  { name: 'BFF-SDUI-Service', script: 'src/bff-sdui-service/server.js', port: 3001 },
  { name: 'Mobile-Preview', script: 'src/mobile-sdui-preview/server.js', port: 3000 }
];

console.log('='.repeat(75));
console.log('  INICIALIZANDO PLATAFORMA DE SUPERAPP FINANCEIRO MODULAR & IA');
console.log('='.repeat(75));

const processes = [];

for (const svc of services) {
  const fullPath = path.join(__dirname, svc.script);
  const child = spawn(process.execPath, [fullPath], {
    stdio: 'inherit',
    env: { ...process.env, PORT: svc.port }
  });

  processes.push(child);
  console.log(`[OK] ${svc.name} iniciado na porta :${svc.port}`);
}

console.log('\n' + '-'.repeat(75));
console.log('  AMBIENTE PRONTO PARA APRESENTAÇÃO EXECUTIVA:');
console.log('  • Mobile SuperApp Shell Preview: http://localhost:3000');
console.log('  • BFF Server-Driven UI API:      http://localhost:3001/api/sdui/screen/home_dashboard');
console.log('  • Core Transacional Endpoint:    http://localhost:3001/v1/contratos/CTR-CRED-2026-9981/autorizacoes');
console.log('  • AI Orchestrator API & Guard:   http://localhost:3002/api/agent/query');
console.log('-'.repeat(75));
console.log('Pressione Ctrl+C para encerrar todos os serviços.\n');

process.on('SIGINT', () => {
  console.log('\nEncerrando serviços...');
  for (const p of processes) {
    p.kill('SIGINT');
  }
  process.exit(0);
});
