import { CheckCircle, Target, Layers, AlertTriangle, TrendingUp, ChevronRight } from "lucide-react";

const cards = [
  {
    label: "Licenças Ativas",
    value: 24,
    total: 31,
    sub: "de 31 no total",
    icon: CheckCircle,
    color: "#10b981",
    bg: "#f0fdf4",
    textColor: "#064e3b",
    trend: "+2 este mês",
    pct: 77,
  },
  {
    label: "Campanhas de Campo",
    value: 7,
    total: 10,
    sub: "3 em andamento",
    icon: Target,
    color: "#3b82f6",
    bg: "#eff6ff",
    textColor: "#1e3a8a",
    trend: "3 ativas",
    pct: 70,
  },
  {
    label: "Projetos Ativos",
    value: 12,
    total: 18,
    sub: "de 18 projetos",
    icon: Layers,
    color: "#0891b2",
    bg: "#ecfeff",
    textColor: "#164e63",
    trend: "↗ Em andamento",
    pct: 67,
  },
  {
    label: "Cond. Pendentes",
    value: 5,
    total: 20,
    sub: "2 vencidas",
    icon: AlertTriangle,
    color: "#f59e0b",
    bg: "#fffbeb",
    textColor: "#78350f",
    trend: "⚠ Requer atenção",
    pct: 25,
  },
];

function PremiumCard({ card }: { card: typeof cards[0] }) {
  const Icon = card.icon;
  return (
    <div
      className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "#ffffff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ background: card.color }}
      />

      <div className="p-5 pl-6">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="p-2 rounded-xl transition-transform duration-300 group-hover:scale-110"
            style={{ background: card.bg }}
          >
            <Icon className="w-4 h-4" style={{ color: card.color }} />
          </div>
          <button
            className="flex items-center gap-0.5 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ color: card.color }}
          >
            Ver mais <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Value */}
        <div className="mb-3">
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-4xl font-black tracking-tight leading-none"
              style={{ color: "#0f172a" }}
            >
              {card.value}
            </span>
            <span className="text-sm font-medium" style={{ color: "#94a3b8" }}>
              / {card.total}
            </span>
          </div>
          <p className="text-xs font-semibold mt-1.5 uppercase tracking-wide" style={{ color: "#64748b" }}>
            {card.label}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "#f1f5f9" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${card.pct}%`,
                background: `linear-gradient(90deg, ${card.color}90, ${card.color})`,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] mt-1" style={{ color: "#94a3b8" }}>
            <span>{card.pct}% do total</span>
            <span style={{ color: card.color }}>{card.trend}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MinimalPremium() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: "#f8fafc" }}
    >
      {/* Header */}
      <div className="w-full max-w-3xl mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl"
              style={{ background: "#ffffff", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <TrendingUp className="w-5 h-5" style={{ color: "#10b981" }} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Resumo Executivo</h2>
              <p className="text-slate-400 text-xs">Atualizado em tempo real · maio 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#10b981" }} />
            <span className="text-xs font-medium text-slate-500">Ao vivo</span>
          </div>
        </div>
        <div className="h-px mt-4" style={{ background: "linear-gradient(90deg, #10b981, transparent)" }} />
      </div>

      {/* Cards */}
      <div className="w-full max-w-3xl grid grid-cols-2 gap-4">
        {cards.map((card) => (
          <PremiumCard key={card.label} card={card} />
        ))}
      </div>

      <p className="mt-6 text-slate-400 text-xs uppercase tracking-widest">Variante: Minimal Premium</p>
    </div>
  );
}
