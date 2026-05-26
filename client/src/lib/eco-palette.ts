// ── Paleta unificada EcoBrasil ────────────────────────────────────────────────
// Identidade visual profissional: Laranja + Teal + tons próximos.
// Aplicada em TODOS os gráficos do sistema (Campo, Financeiro, Dashboards, etc.)

export const ECO_PALETTE = [
  "#ea580c", // 0  laranja primário
  "#0099a8", // 1  teal primário
  "#c2410c", // 2  laranja queimado
  "#0e7490", // 3  teal profundo
  "#f97316", // 4  laranja vibrante
  "#06b6d4", // 5  ciano
  "#fb923c", // 6  laranja suave
  "#155e75", // 7  teal escuro
  "#9a3a0a", // 8  âmbar-marrom
  "#22d3ee", // 9  ciano claro
  "#fdba74", // 10 pêssego
  "#164e63", // 11 teal profundíssimo
] as const;

export const ECO_STROKE = [
  "#9a3a0a", "#006070", "#7c2d12", "#083344", "#c2410c", "#0e7490",
  "#c2410c", "#083344", "#451a03", "#0e7490", "#9a3a0a", "#082f49",
] as const;

export function ecoColor(i: number): string {
  const n = ECO_PALETTE.length;
  return ECO_PALETTE[((i % n) + n) % n];
}
export function ecoStroke(i: number): string {
  const n = ECO_STROKE.length;
  return ECO_STROKE[((i % n) + n) % n];
}
export function ecoAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, "0");
  return hex + a;
}

// ── Cores semânticas financeiras ────────────────────────────────────────────
export const FIN_COLORS = {
  receita:        "#0099a8",  // teal (positivo)
  receitaSoft:    "rgba(0,153,168,0.18)",
  receitaSolid:   "rgba(0,153,168,0.85)",
  despesa:        "#ea580c",  // laranja (saída)
  despesaSoft:    "rgba(234,88,12,0.18)",
  despesaSolid:   "rgba(234,88,12,0.85)",
  lucro:          "#0e7490",  // teal escuro (resultado)
  lucroSoft:      "rgba(14,116,144,0.18)",
  lucroSolid:     "rgba(14,116,144,0.85)",
} as const;

// ── Cores semânticas de status (mantendo legibilidade) ──────────────────────
// Para alertas críticos preservamos vermelho/âmbar tradicionais; demais usam ECO.
export const STATUS_COLORS = {
  // Positivos / OK → teal
  ok:           "#0099a8",
  active:       "#0099a8",
  concluida:    "#0e7490",
  // Atenção / em andamento → laranja claro / ciano
  emAndamento:  "#06b6d4",
  expiring:     "#f97316",
  atrasada:     "#ea580c",
  // Críticos / vencidos / cancelada → laranja muito escuro (separação clara de atenção)
  expired:      "#7c2d12",
  overdue:      "#7c2d12",
  vencido:      "#7c2d12",
  cancelada:    "#7c2d12",
  // Pausa / planejado → tons frios
  suspensa:     "#155e75",
  planejada:    "#0099a8",
  encerrada:    "#94a3b8",
} as const;

// Paleta para categorias/séries gerais (versão sólida com 85% de opacidade)
export const ECO_CHART_COLORS = ECO_PALETTE.map(c => ecoAlpha(c, 0.85));
