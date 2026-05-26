import { CheckCircle, Target, Layers, AlertTriangle, TrendingUp, ArrowUpRight, Sparkles } from "lucide-react";

const cards = [
  {
    label: "Licenças Ativas",
    value: 24,
    total: 31,
    sub: "de 31 no total",
    icon: CheckCircle,
    gradient: "linear-gradient(135deg, #064e3b 0%, #059669 60%, #10b981 100%)",
    tag: "✓ Em dia",
    pct: 77,
    accent: "#10b981",
  },
  {
    label: "Campanhas de Campo",
    value: 7,
    total: 10,
    sub: "3 em andamento",
    icon: Target,
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 60%, #3b82f6 100%)",
    tag: "↗ Ativas",
    pct: 70,
    accent: "#3b82f6",
  },
  {
    label: "Projetos Ativos",
    value: 12,
    total: 18,
    sub: "de 18 projetos",
    icon: Layers,
    gradient: "linear-gradient(135deg, #0c4a6e 0%, #0284c7 60%, #38bdf8 100%)",
    tag: "⚡ Em curso",
    pct: 67,
    accent: "#38bdf8",
  },
  {
    label: "Cond. Pendentes",
    value: 5,
    total: 20,
    sub: "2 vencidas",
    icon: AlertTriangle,
    gradient: "linear-gradient(135deg, #7c2d12 0%, #dc2626 60%, #f87171 100%)",
    tag: "⚠ Atenção",
    pct: 25,
    accent: "#f87171",
  },
];

function HorizCard({ card, index }: { card: typeof cards[0]; index: number }) {
  const Icon = card.icon;
  return (
    <div
      className="relative overflow-hidden rounded-2xl flex items-center gap-0"
      style={{
        background: card.gradient,
        boxShadow: "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
        minHeight: "86px",
      }}
    >
      {/* Decorative circle */}
      <div className="absolute right-0 top-0 bottom-0 w-48 opacity-10"
        style={{ background: "radial-gradient(circle at right center, white 0%, transparent 70%)" }} />

      {/* Left: index number + icon */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center gap-1 px-5 py-4 border-r border-white/15" style={{ width: 72 }}>
        <span className="text-white/30 text-xs font-bold font-mono">0{index + 1}</span>
        <div className="p-1.5 rounded-lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.15)" }}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Center: label + sub */}
      <div className="flex-1 px-5 py-4">
        <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-0.5">{card.label}</p>
        <p className="text-white/40 text-xs">{card.sub}</p>
        {/* Progress bar */}
        <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.2)", width: "80%" }}>
          <div className="h-full rounded-full" style={{ width: `${card.pct}%`, background: "rgba(255,255,255,0.5)" }} />
        </div>
      </div>

      {/* Right: big number + tag */}
      <div className="flex-shrink-0 flex flex-col items-end justify-center px-6 py-4 gap-1.5">
        <div
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(0,0,0,0.25)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          {card.tag}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black text-white tracking-tight leading-none">{card.value}</span>
          <span className="text-white/40 text-sm font-medium">/{card.total}</span>
        </div>
      </div>
    </div>
  );
}

export function HorizontalStrip() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
    >
      {/* Header */}
      <div className="w-full max-w-2xl mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ background: "linear-gradient(135deg, #059669, #10b981)", boxShadow: "0 4px 16px rgba(16,185,129,0.35)" }}>
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">Resumo Executivo</h2>
            <p className="text-white/35 text-xs">maio 2026</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
          <Sparkles className="w-3 h-3" /> Atualizado agora
        </div>
      </div>

      {/* Horizontal strips — vertical stack */}
      <div className="w-full max-w-2xl flex flex-col gap-3">
        {cards.map((card, i) => (
          <HorizCard key={card.label} card={card} index={i} />
        ))}
      </div>

      <p className="mt-5 text-white/20 text-xs uppercase tracking-widest">Layout: Horizontal Strip</p>
    </div>
  );
}
