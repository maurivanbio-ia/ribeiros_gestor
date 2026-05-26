import { CheckCircle, Target, Layers, AlertTriangle, TrendingUp, ArrowUpRight } from "lucide-react";

const cards = [
  {
    label: "Licenças Ativas",
    value: 24,
    sub: "de 31 no total",
    icon: CheckCircle,
    accent: "#22c55e",
    glow: "rgba(34,197,94,0.25)",
    bg: "linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(16,185,129,0.06) 100%)",
    border: "rgba(34,197,94,0.3)",
  },
  {
    label: "Campanhas de Campo",
    value: 7,
    sub: "3 em andamento",
    icon: Target,
    accent: "#3b82f6",
    glow: "rgba(59,130,246,0.25)",
    bg: "linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(37,99,235,0.06) 100%)",
    border: "rgba(59,130,246,0.3)",
  },
  {
    label: "Projetos Ativos",
    value: 12,
    sub: "de 18 projetos",
    icon: Layers,
    accent: "#06b6d4",
    glow: "rgba(6,182,212,0.25)",
    bg: "linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(8,145,178,0.06) 100%)",
    border: "rgba(6,182,212,0.3)",
  },
  {
    label: "Cond. Pendentes",
    value: 5,
    sub: "2 vencidas!",
    icon: AlertTriangle,
    accent: "#f59e0b",
    glow: "rgba(245,158,11,0.25)",
    bg: "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.06) 100%)",
    border: "rgba(245,158,11,0.3)",
  },
];

function GlassCard({ card }: { card: typeof cards[0] }) {
  const Icon = card.icon;
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: "rgba(15, 20, 35, 0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${card.border}`,
        boxShadow: `0 0 32px ${card.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      {/* Glow orb */}
      <div
        className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-20 blur-2xl"
        style={{ background: card.accent }}
      />

      {/* Top row */}
      <div className="relative flex items-center justify-between">
        <div
          className="p-2 rounded-xl flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${card.accent}30, ${card.accent}15)`,
            border: `1px solid ${card.accent}40`,
          }}
        >
          <Icon className="w-4 h-4" style={{ color: card.accent }} />
        </div>
        <div
          className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ color: card.accent, background: `${card.accent}18`, border: `1px solid ${card.accent}30` }}
        >
          <ArrowUpRight className="w-3 h-3" />
          ativo
        </div>
      </div>

      {/* Value */}
      <div className="relative">
        <p className="text-4xl font-black tracking-tight" style={{ color: "#f8fafc" }}>
          {card.value}
        </p>
        <p
          className="text-xs font-semibold uppercase tracking-widest mt-0.5"
          style={{ color: `${card.accent}cc` }}
        >
          {card.label}
        </p>
        {card.sub && (
          <p className="text-xs mt-1" style={{ color: "rgba(248,250,252,0.45)" }}>
            {card.sub}
          </p>
        )}
      </div>

      {/* Shimmer bar */}
      <div className="relative h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${(card.value / (card.value * 1.5)) * 100}%`,
            background: `linear-gradient(90deg, ${card.accent}80, ${card.accent})`,
          }}
        />
      </div>
    </div>
  );
}

export function GlassDark() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{
        background: "linear-gradient(135deg, #0a0f1e 0%, #0d1830 40%, #0a1628 100%)",
      }}
    >
      {/* Header */}
      <div className="w-full max-w-3xl mb-6 flex items-center gap-3">
        <div className="p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <TrendingUp className="w-5 h-5 text-white/60" />
        </div>
        <div>
          <h2 className="text-white font-bold text-sm uppercase tracking-widest opacity-60">Resumo Executivo</h2>
          <p className="text-white/30 text-xs">Visão geral do sistema</p>
        </div>
      </div>

      {/* Cards grid */}
      <div className="w-full max-w-3xl grid grid-cols-2 gap-4">
        {cards.map((card) => (
          <GlassCard key={card.label} card={card} />
        ))}
      </div>

      <p className="mt-6 text-white/20 text-xs uppercase tracking-widest">Variante: Glassmorphism Escuro</p>
    </div>
  );
}
