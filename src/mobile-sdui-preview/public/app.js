/**
 * @file app.js
 * Lógica do Shell Mobile, Motor de Renderização SDUI e Assistente Híbrido
 */

const BFF_URL = 'http://localhost:3001';

// Estado da Aplicação
const state = {
  currentProfile: 'normal',
  lastIdempotencyKey: null,
  cachedSDUIPayload: null
};

// Ícones SVG nativos para componentes SDUI (sem marcas d'água externas)
const ICONS = {
  zap: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
  barcode: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14"/></svg>',
  sliders: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>',
  'credit-card': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>',
  'trending-up': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
  bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
  sparkles: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>'
};

// ============================================================================
// 1. MOTOR DE RENDERIZAÇÃO DE SERVER-DRIVEN UI (SDUI)
// ============================================================================

function renderSDUI(payload) {
  const canvas = document.getElementById('sduiCanvas');
  if (!canvas) return;

  canvas.innerHTML = '';

  if (!payload || !payload.sections) {
    canvas.innerHTML = '<div class="loading-state">Nenhum layout retornado pelo BFF.</div>';
    return;
  }

  payload.sections.forEach((section) => {
    const componentEl = createSDUIComponent(section);
    if (componentEl) {
      canvas.appendChild(componentEl);
    }
  });

  // Atualiza tab de JSON puro
  document.getElementById('sduiRawJson').textContent = JSON.stringify(payload, null, 2);
}

function createSDUIComponent(section) {
  const { type, props = {}, actions = {} } = section;

  switch (type) {
    case 'HeaderProfile': {
      const el = document.createElement('div');
      el.className = 'sdui-header-profile';
      el.innerHTML = `
        <div class="profile-avatar-group">
          <div class="avatar-circle">CS</div>
          <div>
            <div class="profile-name">${props.client_name || 'Cliente'}</div>
            <div class="profile-segment">${props.segment || 'CONTA DIGITAL'}</div>
          </div>
        </div>
        <div class="bell-btn">
          ${ICONS.bell}
          ${props.unread_notifications ? '<div class="bell-badge"></div>' : ''}
        </div>
      `;
      return el;
    }

    case 'HeroBalanceCard': {
      const el = document.createElement('div');
      el.className = 'sdui-hero-card';

      const pct = props.percent_used || 68;
      const fillClass = pct > 85 ? 'fill-rose' : pct > 70 ? 'fill-amber' : 'fill-green';

      el.innerHTML = `
        <div class="hero-balance-label">Saldo em Conta Corrente</div>
        <div class="hero-balance-val">R$ ${Number(props.balance_available || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        
        <div class="hero-limit-box">
          <div class="limit-row">
            <span>Limite Disponível</span>
            <span>R$ ${Number(props.credit_limit_available || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="limit-progress-bar">
            <div class="limit-progress-fill ${fillClass}" style="width: ${pct}%"></div>
          </div>
          <div class="limit-row">
            <span style="font-size: 10px; color: #64748b;">Utilizado: R$ ${Number(props.credit_limit_used || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${pct}%)</span>
            <span style="font-size: 10px; color: #64748b;">Total: R$ ${Number(props.credit_limit_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      `;
      return el;
    }

    case 'SmartInsightBanner': {
      const el = document.createElement('div');
      el.className = 'sdui-insight-banner';
      el.innerHTML = `
        <div class="insight-header">
          ${ICONS.sparkles}
          <span>${props.badge || 'INSIGHT INTELIGENTE'}</span>
        </div>
        <div class="insight-title">${props.headline}</div>
        <div class="insight-body">${props.body}</div>
        ${props.primary_button_text ? `<button class="insight-btn" id="btnInsightAction">${props.primary_button_text}</button>` : ''}
      `;

      if (actions.on_primary_action) {
        const btn = el.querySelector('#btnInsightAction');
        if (btn) {
          btn.addEventListener('click', () => {
            triggerAction(actions.on_primary_action);
          });
        }
      }
      return el;
    }

    case 'SecurityWarningBanner': {
      const el = document.createElement('div');
      el.className = 'sdui-security-banner';
      el.innerHTML = `
        <h4>⚠ ${props.headline}</h4>
        <p>${props.body}</p>
      `;
      return el;
    }

    case 'QuickActionsGrid': {
      const el = document.createElement('div');
      el.className = 'sdui-quick-grid';

      (props.items || []).forEach((item) => {
        const btn = document.createElement('button');
        btn.className = 'quick-action-btn';
        btn.innerHTML = `
          <div class="quick-icon-circle">${ICONS[item.icon] || ICONS.zap}</div>
          <span class="quick-action-label">${item.label}</span>
        `;
        btn.addEventListener('click', () => triggerAction(item.action));
        el.appendChild(btn);
      });
      return el;
    }

    case 'TransactionFeed': {
      const el = document.createElement('div');
      el.className = 'sdui-tx-feed';
      let itemsHtml = '';

      (props.transactions || []).forEach((tx) => {
        const isNeg = tx.amount < 0;
        const formatted = Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        itemsHtml += `
          <div class="feed-item">
            <div>
              <div class="feed-desc">${tx.description}</div>
              <div class="feed-sub">${tx.category} • ${tx.date}</div>
            </div>
            <div class="feed-amt ${isNeg ? 'negative' : 'positive'}">
              ${isNeg ? '- ' : '+ '}R$ ${formatted}
            </div>
          </div>
        `;
      });

      el.innerHTML = `
        <div class="feed-header">${props.title || 'Últimas Transações'}</div>
        <div>${itemsHtml}</div>
      `;
      return el;
    }

    default:
      console.warn(`[SDUI Engine] Componente desconhecido ignorado defensivamente: ${type}`);
      return null;
  }
}

function triggerAction(actionUri) {
  console.log(`[SDUI Action Triggered] URI: ${actionUri}`);

  if (actionUri.startsWith('agent://trigger_tool')) {
    // Abre gaveta e dispara comando do agente
    openChatDrawer();
    addChatBubble('user', 'Solicitar Ajuste Emergencial de Limite');
    sendChatQuery('Solicitar ajuste emergencial de limite de R$ 1.500,00');
  } else if (actionUri.startsWith('navigate://')) {
    alert(`Navegando para rota nativa: ${actionUri}`);
  }
}

// ============================================================================
// 2. INTEGRAÇÃO COM BFF (SERVER-DRIVEN UI & AUTORIZAÇÕES)
// ============================================================================

async function fetchSDUIScreen(profile = 'normal') {
  state.currentProfile = profile;
  try {
    const res = await fetch(`${BFF_URL}/api/sdui/screen/home_dashboard?profile=${profile}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.cachedSDUIPayload = data;
    renderSDUI(data);
  } catch (err) {
    console.error('Erro ao buscar SDUI do BFF:', err);
    document.getElementById('sduiCanvas').innerHTML = `
      <div class="loading-state">
        <span style="color: #f43f5e;">Erro ao conectar ao BFF (:3001).</span>
        <span style="font-size: 11px;">Certifique-se de que o serviço está rodando.</span>
      </div>
    `;
  }
}

async function authorizeTransaction(amount, merchant, isReplay = false) {
  const resultBox = document.getElementById('txResultBox');
  resultBox.className = 'tx-result-box';
  resultBox.textContent = 'Processando autorização síncrona no Core Banking...';
  resultBox.classList.remove('hidden');

  let key = state.lastIdempotencyKey;
  if (!isReplay || !key) {
    key = crypto.randomUUID();
    state.lastIdempotencyKey = key;
  }

  const payload = {
    id_contrato: 'CTR-CRED-2026-9981',
    id_conta: '0001-98765-4',
    valor: amount,
    moeda: 'BRL',
    tipo_operacao: 'DEBITO',
    id_estabelecimento: merchant,
    metadata: {
      geo_ip: '200.189.112.4',
      device_fingerprint: 'fp-ios-88a2'
    }
  };

  try {
    const startTime = performance.now();
    const res = await fetch(`${BFF_URL}/v1/contratos/CTR-CRED-2026-9981/autorizacoes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
        'traceparent': `00-${crypto.randomUUID().replace(/-/g, '')}-00f067aa0ba902b7-01`
      },
      body: JSON.stringify(payload)
    });

    const elapsed = Math.round(performance.now() - startTime);
    const body = await res.json();

    if (res.status === 201) {
      resultBox.className = 'tx-result-box success';
      resultBox.innerHTML = `
        <strong>✓ HTTP 201 Created (Transação Autorizada) [${elapsed}ms]</strong><br/>
        ID Autorização: ${body.id_autorizacao}<br/>
        Valor: R$ ${body.valor_autorizado.toFixed(2)} | Limite Remanescente: R$ ${body.limite_remanescente.toFixed(2)}<br/>
        <small>Chave Idempotência gravada: ${key}</small>
      `;
      // Atualiza SDUI e Eventos
      fetchSDUIScreen(state.currentProfile);
      fetchEvents();
    } else if (res.status === 200) {
      resultBox.className = 'tx-result-box success';
      resultBox.innerHTML = `
        <strong>✓ HTTP 200 OK (Replay Idempotente - Requisição Repetida) [${elapsed}ms]</strong><br/>
        A chave de idempotência já havia sido processada com sucesso. Retornando o payload original idêntico sem novo débito.
      `;
    } else if (res.status === 402) {
      resultBox.className = 'tx-result-box error';
      resultBox.innerHTML = `
        <strong>✕ HTTP 402 Payment Required (RFC 7807) [${elapsed}ms]</strong><br/>
        <strong>${body.title}:</strong> ${body.detail}<br/>
        <small>Sugestão: ${body.invalid_params?.sugestao || 'N/A'}</small>
      `;
    } else {
      resultBox.className = 'tx-result-box error';
      resultBox.innerHTML = `<strong>HTTP ${res.status}:</strong> ${body.detail || JSON.stringify(body)}`;
    }
  } catch (err) {
    resultBox.className = 'tx-result-box error';
    resultBox.textContent = `Erro de conexão: ${err.message}`;
  }
}

async function fetchEvents() {
  try {
    const res = await fetch(`${BFF_URL}/api/events`);
    if (!res.ok) return;
    const data = await res.json();
    const container = document.getElementById('eventsList');

    if (!data.events || data.events.length === 0) {
      container.innerHTML = '<div class="empty-state">Nenhum evento capturado no momento. Execute uma autorização.</div>';
      return;
    }

    container.innerHTML = '';
    data.events.forEach((evt) => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <div class="event-title-row">
          <span class="event-name">${evt.type}</span>
          <span class="event-time">${new Date(evt.time).toLocaleTimeString()}</span>
        </div>
        <div style="color: #94a3b8; font-size: 10px;">ID: ${evt.id} | Trace: ${evt.traceparent || 'N/A'}</div>
        <div style="color: #cbd5e1; margin-top: 4px;">
          Valor: R$ ${evt.data?.valor?.toFixed(2) || '0.00'} | Contrato: ${evt.data?.id_contrato} | Canal: ${evt.data?.canal}
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.warn('Erro ao buscar eventos do Event Bus:', err);
  }
}

// ============================================================================
// 3. ASSISTENTE HÍBRIDO (EDGE AI EMULATOR + CLOUD AGENT BEDROCK)
// ============================================================================

function openChatDrawer() {
  document.getElementById('mobileChatDrawer').classList.remove('hidden');
}

function closeChatDrawer() {
  document.getElementById('mobileChatDrawer').classList.add('hidden');
}

function addChatBubble(sender, text, badgeText = null, badgeType = 'edge') {
  const messagesContainer = document.getElementById('drawerMessages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;

  let badgeHtml = '';
  if (badgeText) {
    badgeHtml = `<div class="chat-badge-infer badge-${badgeType}">${badgeText}</div><br/>`;
  }

  bubble.innerHTML = `${badgeHtml}${text}`;
  messagesContainer.appendChild(bubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendChatQuery(text) {
  if (!text) return;

  const telemetryBox = document.getElementById('aiTelemetryBox');
  telemetryBox.className = 'ai-telemetry-box';
  telemetryBox.textContent = 'Executando triagem On-Device (Edge AI INT8)...';
  telemetryBox.classList.remove('hidden');

  // 1. Simulação On-Device do Edge AI Engine (em sub-25ms)
  const isSaldo = /saldo|quanto tenho/i.test(text);
  const isBloquear = /bloquear cart|travar cart/i.test(text);
  const isComplex = /pagar|fatura|4 mil|juros|rotativo|limite|gasto|despesa/i.test(text);
  const isInjection = /ignore|esqueça|suas regras|jailbreak/i.test(text);

  if (isSaldo) {
    // Resolução 100% On-Device
    setTimeout(() => {
      telemetryBox.innerHTML = `
        <strong>[EDGE AI ON-DEVICE RESOLUTION]</strong><br/>
        Intenção: CONSULTAR_SALDO_LOCAL (Confiança: 96%)<br/>
        Latência: <strong>14.2 ms</strong> (Zero chamadas de nuvem / Zero custo)<br/>
        Ação Nativa: Exibindo saldo local em cache seguro.
      `;
      addChatBubble('user', text);
      addChatBubble('bot', 'Seu saldo em conta corrente é de R$ 1.450,20 e o limite de crédito disponível é de R$ 3.200,00.', 'EDGE AI ON-DEVICE (14ms)', 'edge');
    }, 15);
    return;
  }

  // 2. Delegação para Cloud AI Orchestrator
  addChatBubble('user', text);

  try {
    const startTime = performance.now();
    const res = await fetch(`${BFF_URL}/api/v1/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        user_id: 'USER-8821',
        edge_telemetry: { typing_cadence_variance: 0.19, rapid_paste: false }
      })
    });

    const elapsed = Math.round(performance.now() - startTime);
    const data = await res.json();

    telemetryBox.innerHTML = `
      <strong>[CLOUD AGENT ORCHESTRATION] (${elapsed}ms)</strong><br/>
      Modelo: Bedrock Claude 3.5 Sonnet (Simulado)<br/>
      PII Sanitizado (LGPD): ${data.pii_masked ? 'SIM (CPF/Contas mascarados)' : 'Nenhum PII detectado'}<br/>
      Tools Executadas: [${(data.tools_executed || []).join(', ') || 'Nenhuma'}]<br/>
      RAG Documentos: ${(data.rag_retrieved_documents || []).map((d) => d.id).join(', ') || 'Nenhum'}
    `;

    // Atualiza tab de Guardrails
    document.getElementById('guardrailDebug').textContent = JSON.stringify({
      guardrail_status: data.status,
      prompt_sanitized: data.prompt_sanitized,
      pii_masked: data.pii_masked,
      tools_executed: data.tools_executed,
      audit: data.audit
    }, null, 2);

    addChatBubble('bot', data.response_text, `CLOUD BEDROCK AGENT (${elapsed}ms)`, 'cloud');

    // Se o agente retornou componentes SDUI (ex: SmartInsightBanner ou Ajuste de Limite), renderiza no app!
    if (data.sdui_components && data.sdui_components.length > 0) {
      fetchSDUIScreen(state.currentProfile);
    }
  } catch (err) {
    telemetryBox.innerHTML = `<span style="color: #f43f5e;">Erro na nuvem: ${err.message}</span>`;
  }
}

// ============================================================================
// 4. EVENT LISTENERS E INICIALIZAÇÃO
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Inicialização do Relógio
  const updateClock = () => {
    const now = new Date();
    document.getElementById('statusClock').textContent = 
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };
  updateClock();
  setInterval(updateClock, 30000);

  // Carrega SDUI Inicial
  fetchSDUIScreen('normal');
  fetchEvents();
  setInterval(fetchEvents, 5000); // Polling de eventos

  // Alternador de Perfis SDUI
  document.querySelectorAll('.btn-profile').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-profile').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const profile = btn.getAttribute('data-profile');
      fetchSDUIScreen(profile);
    });
  });

  // Botões de Autorização
  document.getElementById('btnAuthorizeTx').addEventListener('click', () => {
    const amt = parseFloat(document.getElementById('txAmount').value) || 450;
    const merchant = document.getElementById('txMerchant').value || 'Loja Comercial';
    authorizeTransaction(amt, merchant, false);
  });

  document.getElementById('btnTestOverlimit').addEventListener('click', () => {
    document.getElementById('txAmount').value = '15000.00';
    authorizeTransaction(15000.00, 'Joalheria Luxo', false);
  });

  // Gatilhos do Chat e Modal
  document.getElementById('aiTriggerBtn').addEventListener('click', openChatDrawer);
  document.getElementById('drawerCloseBtn').addEventListener('click', closeChatDrawer);

  document.getElementById('btnSendChat').addEventListener('click', () => {
    const input = document.getElementById('chatInput');
    const txt = input.value.trim();
    if (txt) {
      openChatDrawer();
      sendChatQuery(txt);
      input.value = '';
    }
  });

  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('btnSendChat').click();
    }
  });

  // Preset Pills de Teste
  document.querySelectorAll('.preset-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const txt = pill.getAttribute('data-text');
      document.getElementById('chatInput').value = txt;
      openChatDrawer();
      sendChatQuery(txt);
    });
  });

  // Navegação de Abas do Inspetor
  document.querySelectorAll('.tab-btn').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.add('hidden'));

      tabBtn.classList.add('active');
      const targetId = tabBtn.getAttribute('data-tab');
      document.getElementById(targetId).classList.remove('hidden');
    });
  });
});
