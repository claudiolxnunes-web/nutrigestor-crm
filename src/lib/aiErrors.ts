// Classifica erros vindos da edge function de IA (gestor-insights-ia)
// e devolve um título + descrição amigáveis com ação recomendada.

export type AiErrorKind =
  | "rate_limit"
  | "no_credits"
  | "invalid_key"
  | "timeout"
  | "network"
  | "gateway"
  | "no_data"
  | "unknown";

export type FriendlyAiError = {
  kind: AiErrorKind;
  title: string;
  description: string;
  raw?: string;
};

export async function extractAiErrorMessage(error: unknown, data?: any): Promise<string> {
  if (data?.error) return String(data.error);
  const anyErr = error as any;
  if (!anyErr) return "";
  try {
    const ctx = anyErr.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } else if (ctx?.body?.error) {
      return String(ctx.body.error);
    }
  } catch {
    /* ignore */
  }
  return String(anyErr?.message ?? anyErr ?? "");
}

export function classifyAiError(message: string, provider?: string): FriendlyAiError {
  const raw = (message || "").trim();
  const m = raw.toLowerCase();
  const prov = provider ? provider.toUpperCase() : "o provedor";

  if (!raw) {
    return {
      kind: "unknown",
      title: "Falha ao gerar análise",
      description:
        "Não recebemos resposta do servidor. Tente novamente em alguns segundos ou troque o provedor de IA no seletor acima.",
    };
  }

  if (m.includes("timeout") || m.includes("timed out") || m.includes("etimedout") || m.includes("deadline")) {
    return {
      kind: "timeout",
      title: "Tempo esgotado ao consultar a IA",
      description: `${prov} demorou demais para responder. Tente novamente em instantes ou alterne para outro provedor (Gemini costuma ser mais rápido).`,
      raw,
    };
  }

  if (
    m.includes("limite atingido") ||
    m.includes("rate limit") ||
    m.includes("rate-limit") ||
    m.includes("too many requests") ||
    m.includes("429")
  ) {
    return {
      kind: "rate_limit",
      title: "Limite de uso atingido",
      description: `${prov} bloqueou temporariamente novas requisições (limite por minuto). Aguarde ~60s e clique em atualizar, ou troque de provedor.`,
      raw,
    };
  }

  if (
    m.includes("crédito") ||
    m.includes("credito") ||
    m.includes("credits") ||
    m.includes("insufficient") ||
    m.includes("quota") ||
    m.includes("billing") ||
    m.includes("payment required") ||
    m.includes("402")
  ) {
    return {
      kind: "no_credits",
      title: "Créditos insuficientes",
      description: `A conta de ${prov} está sem créditos disponíveis. Recarregue créditos no painel do provedor ou selecione outro no seletor acima.`,
      raw,
    };
  }

  if (
    m.includes("invalid api key") ||
    m.includes("chave") && (m.includes("inválida") || m.includes("invalida") || m.includes("revogada")) ||
    m.includes("unauthorized") ||
    m.includes("401") ||
    m.includes("forbidden") ||
    m.includes("403")
  ) {
    return {
      kind: "invalid_key",
      title: "Chave de IA inválida",
      description: `A chave de API de ${prov} foi rejeitada. Verifique a chave em Configurações → IA, ou selecione outro provedor.`,
      raw,
    };
  }

  if (
    m.includes("failed to fetch") ||
    m.includes("network") ||
    m.includes("fetcherror") ||
    m.includes("enotfound") ||
    m.includes("econnrefused") ||
    m.includes("econnreset")
  ) {
    return {
      kind: "network",
      title: "Falha de conexão com o servidor",
      description:
        "Não foi possível alcançar o serviço de IA. Verifique sua conexão e tente novamente em alguns segundos.",
      raw,
    };
  }

  if (
    m.includes("gateway") ||
    m.includes("bad gateway") ||
    m.includes("502") ||
    m.includes("503") ||
    m.includes("504") ||
    m.includes("upstream") ||
    m.includes("internal server error") ||
    m.includes("500")
  ) {
    return {
      kind: "gateway",
      title: "Erro no gateway de IA",
      description: `${prov} retornou erro temporário (gateway/upstream). Aguarde alguns segundos e clique em atualizar; se persistir, troque de provedor.`,
      raw,
    };
  }

  if (m.includes("sem dados") || m.includes("não há dados") || m.includes("no data")) {
    return {
      kind: "no_data",
      title: "Sem dados suficientes",
      description:
        "Ainda não há vendas, metas ou atividades suficientes neste mês para gerar uma análise. Importe vendas/atualize metas e tente novamente.",
      raw,
    };
  }

  return {
    kind: "unknown",
    title: "Falha ao gerar análise",
    description: raw.length > 220 ? raw.slice(0, 217) + "…" : raw,
    raw,
  };
}

export async function toFriendlyAiError(error: unknown, data?: any, provider?: string): Promise<FriendlyAiError> {
  const msg = await extractAiErrorMessage(error, data);
  return classifyAiError(msg, provider);
}