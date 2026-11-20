/**
 * @file index.js
 * @description Edge AI On-Device Engine Simulator (ONNX / CoreML / TFLite emulação)
 * Executa classificação de intenções em sub-25ms e pontuação de risco comportamental no dispositivo.
 */

import { performance } from 'node:perf_hooks';

// Dicionário de vetores léxico-semânticos pré-compilados (emulação de pesos de modelo INT8 destilado)
const LOCAL_INTENT_PATTERNS = [
  {
    intent: 'CONSULTAR_SALDO_LOCAL',
    patterns: [/\bsaldo\b/i, /\bquanto tenho\b/i, /\bextrato rapido\b/i],
    confidence: 0.96,
    localAction: {
      actionType: 'NAVIGATE_NATIVE',
      target: 'navigate://wallet/balance_reveal',
      message: 'Consultando seu saldo localmente via cache seguro do dispositivo.'
    }
  },
  {
    intent: 'BLOQUEIO_TEMPORARIO_CARTAO',
    patterns: [/\bbloquear cart[aã]o\b/i, /\btravar cart[aã]o\b/i, /\bcongelar cart[aã]o\b/i],
    confidence: 0.94,
    localAction: {
      actionType: 'TRIGGER_LOCAL_SECURITY',
      target: 'action://security/temporary_card_lock',
      message: 'Iniciando bloqueio preventivo direto no enclave seguro do aparelho.'
    }
  },
  {
    intent: 'PIX_RAPIDO',
    patterns: [/\bcopia e cola\b/i, /\bchave pix\b/i, /\bpagar com pix\b/i],
    confidence: 0.92,
    localAction: {
      actionType: 'NAVIGATE_NATIVE',
      target: 'navigate://pix/quick_transfer',
      message: 'Abrindo módulo Pix nativo.'
    }
  },
  {
    intent: 'VER_FATURA_ATUAL',
    patterns: [/\bfatura atual\b/i, /\bfechamento da fatura\b/i, /\bcodigo de barra fatura\b/i],
    confidence: 0.91,
    localAction: {
      actionType: 'NAVIGATE_NATIVE',
      target: 'navigate://cards/invoice_current',
      message: 'Exibindo dados da fatura em cache offline criptografado.'
    }
  }
];

// Padrões indicativos de raciocínio complexo que demandam Cloud Orchestrator + RAG
const COMPLEX_INTENT_TRIGGERS = [
  /\bposso pagar\b/i,
  /\bvai dar pra pagar\b/i,
  /\bcomparar gastos\b/i,
  /\brenegociar\b/i,
  /\bjuros\b/i,
  /\baumentar limite\b/i,
  /\bpor que recusou\b/i,
  /\brecomenda/i,
  /\binvestir\b/i,
  /\bcr[eé]dito emergencial\b/i
];

export class EdgeAIEngine {
  constructor(options = {}) {
    this.modelName = options.modelName || 'edge-intent-risk-int8.onnx';
    this.version = options.version || '2.1.0';
    this.quantization = 'INT8';
  }

  /**
   * Classifica a intenção do usuário simulando inferência NPU on-device em sub-25ms.
   * @param {string} text - Entrada de texto do usuário
   * @returns {Object} Resultado da inferência
   */
  classifyIntent(text) {
    const startTime = performance.now();
    const cleanText = (text || '').trim();

    // 1. Verifica se dispara gatilhos de raciocínio complexo (necessita de RAG / Nuvem)
    for (const trigger of COMPLEX_INTENT_TRIGGERS) {
      if (trigger.test(cleanText)) {
        const inferenceTimeMs = Number((performance.now() - startTime).toFixed(2));
        return {
          delegate_to_cloud: true,
          intent: 'FINANCIAL_REASONING_COMPLEX',
          confidence: 0.95,
          inference_time_ms: Math.max(inferenceTimeMs, 8.5), // simula tempo real de NPU
          model_version: this.version,
          reason: 'A consulta exige projeção de fluxo, regras regulatórias ou cálculo de limite dinâmico.'
        };
      }
    }

    // 2. Busca padrões de intenções locais de alta confiança
    for (const item of LOCAL_INTENT_PATTERNS) {
      for (const pattern of item.patterns) {
        if (pattern.test(cleanText)) {
          const inferenceTimeMs = Number((performance.now() - startTime).toFixed(2));
          return {
            delegate_to_cloud: false,
            intent: item.intent,
            confidence: item.confidence,
            inference_time_ms: Math.max(inferenceTimeMs, 11.2),
            model_version: this.version,
            localAction: item.localAction
          };
        }
      }
    }

    // 3. Fallback: Se não casou com nenhum atalho local, encaminha para a nuvem
    const inferenceTimeMs = Number((performance.now() - startTime).toFixed(2));
    return {
      delegate_to_cloud: true,
      intent: 'GENERAL_KNOWLEDGE_OR_UNSTRUCTURED',
      confidence: 0.70,
      inference_time_ms: Math.max(inferenceTimeMs, 9.8),
      model_version: this.version,
      reason: 'Intenção não mapeada no modelo local; acionando modelo fundacional via Cloud BFF.'
    };
  }

  /**
   * Avalia a telemetria comportamental de digitação no dispositivo para gerar um score de anomalia.
   * @param {Object} telemetry - Dados de cadência de teclas, giroscópio e velocidade
   * @returns {Object} Score de risco e fatores detectados
   */
  evaluateBehavioralRisk(telemetry = {}) {
    const startTime = performance.now();
    const {
      typing_cadence_variance = 0.15, // variância normal: 0.10 a 0.35
      gyro_stability_index = 0.88,    // 1.0 = mão humana com micro-tremores naturais
      rapid_paste = false,
      jailbreak_detected = false
    } = telemetry;

    let riskScore = 0.05; // Risco base normal
    const riskFactors = [];

    if (jailbreak_detected) {
      riskScore += 0.75;
      riskFactors.push('ROOT_JAILBREAK_SUSPECTED');
    }

    if (rapid_paste) {
      riskScore += 0.30;
      riskFactors.push('RAPID_PASTE_DETECTED');
    }

    // Dispositivos automatizados ou emuladores costumam ter variância zero de digitação
    if (typing_cadence_variance < 0.02) {
      riskScore += 0.45;
      riskFactors.push('SYNTHETIC_BOT_CADENCE_DETECTED');
    }

    if (gyro_stability_index > 0.99) {
      riskScore += 0.20;
      riskFactors.push('DEVICE_STATIONARY_RIG_SUSPECTED');
    }

    riskScore = Math.min(Number(riskScore.toFixed(2)), 1.0);
    const evalTimeMs = Number((performance.now() - startTime).toFixed(2));

    return {
      device_risk_score: riskScore,
      risk_level: riskScore > 0.7 ? 'HIGH' : riskScore > 0.3 ? 'MEDIUM' : 'LOW',
      factors: riskFactors,
      evaluation_time_ms: Math.max(evalTimeMs, 4.2)
    };
  }

  /**
   * Pipeline completo de borda: avalia risco + intenção e decide a rota.
   */
  processInteraction(text, telemetry = {}) {
    const intentResult = this.classifyIntent(text);
    const riskResult = this.evaluateBehavioralRisk(telemetry);

    return {
      timestamp: new Date().toISOString(),
      engine: 'SuperApp Edge AI Engine',
      runtime: 'ONNX Runtime Mobile (quantized INT8)',
      intent: intentResult,
      risk: riskResult,
      decision: {
        should_route_cloud: intentResult.delegate_to_cloud || riskResult.risk_level === 'HIGH',
        requires_biometric_challenge: riskResult.risk_level === 'HIGH',
        total_edge_latency_ms: Number((intentResult.inference_time_ms + riskResult.evaluation_time_ms).toFixed(2))
      }
    };
  }
}
