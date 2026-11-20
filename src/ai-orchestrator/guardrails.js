/**
 * @file guardrails.js
 * Camada de IA Responsável: Sanitização de PII (LGPD) e Defesa Anti-Prompt Injection
 */

const PII_PATTERNS = [
  {
    type: 'CPF',
    regex: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
    placeholder: '[CPF_MASCARADO]'
  },
  {
    type: 'CREDIT_CARD_PAN',
    regex: /\b(?:\d{4}[ -]?){3}\d{4}\b/g,
    placeholder: '[CARTAO_CREDITO_MASCARADO]'
  },
  {
    type: 'BANK_ACCOUNT',
    regex: /\bconta\s*(?:corrente)?\s*[:#]?\s*\d{4,8}-?[\dxX]\b/gi,
    placeholder: '[CONTA_CORRENTE_MASCARADA]'
  },
  {
    type: 'PHONE_NUMBER',
    regex: /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}-?\d{4}\b/g,
    placeholder: '[TELEFONE_MASCARADO]'
  }
];

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /esque[çc]a\s+(todas\s+as\s+)?(suas\s+)?(regras|instru[çc][õo]es)/i,
  /voc[êe]\s+agora\s+[ée]\s+(um\s+)?(dan|jailbreak|desenvolvedor)/i,
  /system\s*prompt\s*reveal/i,
  /mostre\s+(seu|o)\s+prompt\s+(de\s+sistema|inicial)/i,
  /bypass\s+limits/i,
  /altere\s+meu\s+saldo\s+para/i,
  /execute\s*shell|eval\(/i
];

export class GuardrailEngine {
  /**
   * Sanitiza o texto de entrada, substituindo dados pessoais por tokens anônimos (LGPD).
   */
  sanitizePII(input) {
    let sanitizedText = input;
    const detectedPII = [];

    for (const pii of PII_PATTERNS) {
      const matches = sanitizedText.match(pii.regex);
      if (matches) {
        for (const match of matches) {
          detectedPII.push({ type: pii.type, rawLength: match.length });
        }
        sanitizedText = sanitizedText.replace(pii.regex, pii.placeholder);
      }
    }

    return {
      original_text: input,
      sanitized_text: sanitizedText,
      has_pii: detectedPII.length > 0,
      detected_entities: detectedPII
    };
  }

  /**
   * Avalia o texto contra ataques conhecidos de Prompt Injection ou Jailbreak.
   */
  evaluateSecurity(input) {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        return {
          is_safe: false,
          violation_type: 'PROMPT_INJECTION_OR_JAILBREAK',
          pattern_matched: pattern.toString(),
          action: 'BLOCK_REQUEST'
        };
      }
    }

    return {
      is_safe: true,
      violation_type: null,
      action: 'ALLOW'
    };
  }

  /**
   * Executa pipeline completo de guardrail pré-LLM.
   */
  inspect(input) {
    const security = this.evaluateSecurity(input);
    if (!security.is_safe) {
      return {
        allowed: false,
        security,
        sanitized_prompt: null,
        rejection_reason: 'A consulta contém padrões não autorizados de segurança ou tentativa de subversão de regras do assistente bancário.'
      };
    }

    const pii = this.sanitizePII(input);
    return {
      allowed: true,
      security,
      pii,
      sanitized_prompt: pii.sanitized_text
    };
  }
}
