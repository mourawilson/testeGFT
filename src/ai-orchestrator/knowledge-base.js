/**
 * @file knowledge-base.js
 * Base de Conhecimento Vetorial em Memória (RAG Corporativo)
 * Simula OpenSearch Serverless com embeddings semânticos para políticas bancárias.
 */

const CORPORATE_DOCUMENTS = [
  {
    id: 'DOC-POL-001',
    category: 'POLITICA_CREDITO',
    title: 'Política Institucional de Limite de Crédito e Tolerância Emergencial',
    content: 'O banco concede tolerância emergencial de até 15% além do limite total contratado para clientes de bom relacionamento com score interno acima de 700. Transações que ultrapassem essa margem são recusadas com código HTTP 402 ou motivo LIMITE_INSUFICIENTE.',
    tags: ['limite', 'credito', 'emergencial', 'fatura', 'tolerancia']
  },
  {
    id: 'DOC-POL-002',
    category: 'AJUSTE_LIMITE',
    title: 'Regulamento de Ajuste Emergencial via SuperApp e Assistente de IA',
    content: 'Clientes com faturas vincendas podem solicitar aumento provisório de até R$ 2.000,00 ou 20% do limite atual diretamente pelo chat com o assistente agêntico, com taxa reduzida de 1.2% a.m., mediante confirmação biométrica no dispositivo.',
    tags: ['ajuste', 'aumento limite', 'fatura', 'assistente', 'emergencial']
  },
  {
    id: 'DOC-POL-003',
    category: 'SEGURANCA_FRAUDE',
    title: 'Procedimento Operacional de Bloqueio Preventivo de Cartões',
    content: 'Ao identificar movimentações atípicas, desvio de padrão geográfico ou pontuação de anomalia comportamental (device_risk_score > 0.80), o titular ou o assistente pode acionar o bloqueio temporário imediato do cartão físico e virtual, mantendo funções de Pix ativas.',
    tags: ['bloqueio', 'fraude', 'cartao', 'seguranca', 'anomalia']
  },
  {
    id: 'DOC-POL-004',
    category: 'TARIFAS_E_TAXAS',
    title: 'Tabela de Tarifas e Juros do Crédito Rotativo e Parcelamento',
    content: 'O crédito rotativo possui taxa de juros nominal de 11.5% ao mês. Recomendamos sempre o parcelamento da fatura com taxas fixadas em 3.8% ao mês ou quitação integral com saldo em conta.',
    tags: ['rotativo', 'juros', 'tarifas', 'parcelamento', 'fatura']
  }
];

export class VectorKnowledgeStore {
  constructor() {
    this.documents = CORPORATE_DOCUMENTS;
  }

  /**
   * Busca semântica simplificada baseada em sobreposição de termos chave e relevância TF-IDF em memória.
   * Em produção, integra via AWS SDK com Amazon OpenSearch Serverless / Bedrock Knowledge Bases.
   * @param {string} query - Pergunta ou termos da busca
   * @param {number} topK - Número de documentos mais relevantes
   */
  search(query, topK = 2) {
    const tokens = (query || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const scoredDocs = this.documents.map((doc) => {
      let score = 0;
      const docText = `${doc.title} ${doc.content} ${doc.tags.join(' ')}`.toLowerCase();

      for (const token of tokens) {
        if (docText.includes(token)) score += 2;
        for (const tag of doc.tags) {
          if (tag.includes(token) || token.includes(tag)) score += 3;
        }
      }

      return {
        id: doc.id,
        title: doc.title,
        category: doc.category,
        content: doc.content,
        similarity_score: Number((score / (tokens.length * 5 || 1)).toFixed(3))
      };
    });

    return scoredDocs
      .filter((doc) => doc.similarity_score > 0.1)
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, topK);
  }
}
