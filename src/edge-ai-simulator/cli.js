#!/usr/bin/env node
/**
 * @file cli.js
 * CLI para demonstração de inferência do Edge AI no terminal
 */
import { EdgeAIEngine } from './index.js';

const engine = new EdgeAIEngine();

console.log('='.repeat(70));
console.log('  SUPERAPP FINANCIAL — EDGE AI ON-DEVICE ENGINE SIMULATOR (INT8)');
console.log('='.repeat(70));

const testCases = [
  {
    title: 'Cenário 1: Comando Local Rápido (Saldo)',
    text: 'Qual o meu saldo disponível?',
    telemetry: { typing_cadence_variance: 0.22, rapid_paste: false }
  },
  {
    title: 'Cenário 2: Intenção Complexa (Previsão de Fatura & Limite)',
    text: 'Meu limite vai dar pra pagar a fatura de 4 mil?',
    telemetry: { typing_cadence_variance: 0.18, rapid_paste: false }
  },
  {
    title: 'Cenário 3: Ação Local Crítica (Bloquear Cartão)',
    text: 'Preciso bloquear cartão agora',
    telemetry: { typing_cadence_variance: 0.14, rapid_paste: false }
  },
  {
    title: 'Cenário 4: Telemetria com Anomalia (Ataque Automatizado / Bot)',
    text: 'Transferir pix para terceiro',
    telemetry: { typing_cadence_variance: 0.001, rapid_paste: true, jailbreak_detected: true }
  }
];

for (const c of testCases) {
  console.log(`\n▶ ${c.title}`);
  console.log(`  Entrada: "${c.text}"`);
  const result = engine.processInteraction(c.text, c.telemetry);
  console.log(`  Intenção: ${result.intent.intent} (Confiança: ${(result.intent.confidence * 100).toFixed(0)}%)`);
  console.log(`  Risco Local: Score ${result.risk.device_risk_score} [Nível: ${result.risk.risk_level}]`);
  console.log(`  Decisão: ${result.decision.should_route_cloud ? 'DELEGAR PARA CLOUD (BFF + Bedrock)' : 'RESOLVER LOCAL NO DISPOSITIVO'}`);
  console.log(`  Latência Total Edge: ${result.decision.total_edge_latency_ms} ms`);
}

console.log('\n' + '='.repeat(70));
