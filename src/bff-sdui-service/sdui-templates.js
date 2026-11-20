/**
 * @file sdui-templates.js
 * Fábrica declarativa de Server-Driven UI (SDUI) adaptada ao contexto do cliente e IA.
 */

export function buildHomeScreenSDUI({ profile = 'normal', accountData = {} }) {
  const isCriticalLimit = profile === 'limit_warning';
  const isSecurityAlert = profile === 'security_alert';

  const sections = [
    // Seção 1: Header com Identidade e Notificações
    {
      id: 'sec_header',
      type: 'HeaderProfile',
      props: {
        client_name: accountData.client_name || 'Carlos Silveira',
        segment: 'ONE_PRIVATE',
        avatar_url: null,
        unread_notifications: isSecurityAlert ? 3 : 1
      }
    },

    // Seção 2: Hero Balance Card (Saldo e Limite de Crédito Dinâmico)
    {
      id: 'sec_hero_balance',
      type: 'HeroBalanceCard',
      props: {
        account_id: accountData.account_id || '0001-98765-4',
        balance_available: accountData.account_balance || 1450.20,
        credit_limit_total: accountData.credit_limit_total || 10000.0,
        credit_limit_used: isCriticalLimit ? 9200.0 : (accountData.credit_limit_used || 6800.0),
        credit_limit_available: isCriticalLimit ? 800.0 : (accountData.credit_limit_available || 3200.0),
        percent_used: isCriticalLimit ? 92 : 68,
        currency: 'BRL',
        status_badge: isCriticalLimit ? 'LIMITE_CRITICO' : 'REGULAR'
      },
      actions: {
        on_click: 'navigate://wallet/details',
        on_adjust_limit: 'agent://trigger_tool?name=solicitar_ajuste_emergencial'
      }
    }
  ];

  // Seção Condicional 3: Alerta de Segurança se houver anomalia
  if (isSecurityAlert) {
    sections.push({
      id: 'sec_security_alert',
      type: 'SecurityWarningBanner',
      props: {
        severity: 'HIGH',
        headline: 'Comportamento Atípico Detectado no Dispositivo',
        body: 'A telemetria on-device identificou variação anômala na cadência de digitação. Para sua proteção, operações acima de R$ 500,00 exigirão biometria facial.',
        action_label: 'Confirmar Dispositivo Seguro'
      },
      actions: {
        on_action: 'action://security/step_up_challenge'
      }
    });
  }

  // Seção Condicional 4: Alerta Inteligente de Limite gerado pela IA
  if (isCriticalLimit) {
    sections.push({
      id: 'sec_smart_insight_limit',
      type: 'SmartInsightBanner',
      props: {
        severity: 'ALERT',
        badge: 'ASSISTENTE IA',
        headline: 'Limite de Crédito Próximo do Esgotamento (92%)',
        body: 'Identificamos 2 compras recorrentes agendadas para amanhã que podem ser recusadas. Deseja efetuar um ajuste emergencial provisório de R$ 1.500,00?',
        primary_button_text: 'Ajustar Limite Provisório',
        secondary_button_text: 'Rever Gastos'
      },
      actions: {
        on_primary_action: 'agent://trigger_tool?name=solicitar_ajuste_emergencial&valor=1500',
        on_secondary_action: 'navigate://cards/expenses'
      }
    });
  }

  // Seção 5: Grid de Ações Rápidas (Navegação Nativa)
  sections.push({
    id: 'sec_quick_actions',
    type: 'QuickActionsGrid',
    props: {
      items: [
        { id: 'act_pix', label: 'Área Pix', icon: 'zap', action: 'navigate://pix/home' },
        { id: 'act_pay', label: 'Pagar Fatura', icon: 'barcode', action: 'navigate://cards/pay' },
        { id: 'act_limit', label: 'Ajustar Limite', icon: 'sliders', action: 'navigate://limits/manage' },
        { id: 'act_cards', label: 'Cartões', icon: 'credit-card', action: 'navigate://cards/list' },
        { id: 'act_invest', label: 'Investir', icon: 'trending-up', action: 'navigate://invest/home' }
      ]
    }
  });

  // Seção 6: Feed de Transações Recentes
  sections.push({
    id: 'sec_recent_transactions',
    type: 'TransactionFeed',
    props: {
      title: 'Últimas Transações',
      transactions: [
        {
          id: 'TX-901',
          description: 'Supermercado Pão de Açúcar',
          date: 'Hoje, 10:14',
          amount: -284.50,
          category: 'Supermercado',
          status: 'CONFIRMED'
        },
        {
          id: 'TX-902',
          description: 'Uber *Viagem',
          date: 'Hoje, 08:30',
          amount: -34.90,
          category: 'Transporte',
          status: 'CONFIRMED'
        },
        {
          id: 'TX-903',
          description: 'Transferência Pix Recebida',
          date: 'Ontem, 16:45',
          amount: 850.00,
          category: 'Transferência',
          status: 'CREDIT'
        }
      ]
    }
  });

  return {
    screen_id: 'home_dashboard',
    version: '1.4.0',
    generated_at: new Date().toISOString(),
    theme: 'corporate_dark_slate',
    context: {
      profile,
      device_security_status: isSecurityAlert ? 'WARNING' : 'SECURE',
      cache_ttl_seconds: 60
    },
    sections
  };
}
