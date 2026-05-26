import { CheckCircle, Target, Layers, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";

const cards = [
  {
    label: "Licenças",
    labelFull: "Licenças Ativas",
    value: 24,
    total: 31,
    sub: "de 31 no total",
    icon: CheckCircle,
    gradient: "linear-gradient(160deg, #064e3b 0%, #059669 55%, #10b981 100%)",
    pct: 77,
    accent: "#10b981",
    tag: "✓",
  },
  {
    label: "Campanhas",
    labelFull: "Campanhas de Campo",
    value: 7,
    total: 10,
    sub: "3 em andamento",
    icon: Target,
    gradient: "linear-gradient(160deg, #1e3a5f 0%, #1d4ed8 55%, #3b82f6 100%)",
    pct: 70,
    accent: "#60a5fa",
    tag: "↗",
  },
  {
    label: "Projetos",
    labelFull: "Projetos Ativos",
    value: 12,
    total: 18,
    sub: "de 18 projetos",
    icon: Layers,
    gradient: "linear-gradient(160deg, #0c4a6e 0%, #0284c7 55%, #38bdf8 100%)",
    pct: 67,
    accent: "#7dd3fc",
    tag: "⚡",
  },
  {
    label: "Condic.",
    labelFull: "Cond. Pendentes",
    value: 5,
    total: 20,
    sub: "2 vencidas",
    icon: AlertTriangle,
    gradient: "linear-gradient(160deg, #7c2d12 0%, #dc2626 55%, #f87171 100%)",
    pct: 25,
    accent: "#fca5a5",
    tag: "⚠",
  },
];

function TallCard({ card }: { card: typeof cards[0] }) {
  const Icon = card.icon;
  return (
    <div
      className="relative overflow-hidden rounded-2xl flex flex-col"
      style={{
        background: card.gradient,
        boxShadow: "0 16px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
        flex: "1 1 0",
      }}
    >
      {/* Top glow orb */}
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-15"
        style={{ background: "white", filter: "blur(16px)" }} />
      <div className="absolute bottom-0 left-0 right-0 h-16 opacity-10"
        style={{ background: "linear-gradient(to top, black, transparent)" }} />

      {/* Top section: icon + tag */}
      <div className="relative flex items-start justify-between p-4 pb-2">
        <div className="p-2 rounded-xl" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.15)" }}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span
          className="text-xs font-black px-1.5 py-0.5 rounded-md"
          style={{ background: "rgba(0,0,0,0.25)", color: "rgba(255,255,255,0.9)" }}
        >
          {card.tag}
        </span>
      </div>

      {/* Big number — center weighted */}
      <div className="relative flex-1 flex flex-col items-start justify-center px-4 py-2">
        <div className="flex items-baseline gap-0.5">
          <span className="text-5xl font-black text-white leading-none tracking-tighter">{card.value}</span>
          <span className="text-white/35 text-base font-semibold ml-1">/{card.total}</span>
        </div>
      </div>

      {/* Bottom: label + progress */}
      <div className="relative px-4 pb-4 pt-1">
        <p className="text-white/55 text-[9px] font-bold uppercase tracking-widest truncate mb-2">{card.labelFull}</p>
        {/* Circular-ish progress ring alternative — arc bar */}
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.25)" }}>
          <div className="h-full rounded-full" style={{ width: `${card.pct}%`, background: "rgba(255,255,255,0.55)" }} />
        </div>
        <p className="text-white/35 text-[9px] mt-1.5">{card.sub}</p>
      </div>
    </div>
  );
}

export function CompactFourCol() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
    >
      {/* Header */}
      <div className="w-full max-w-3xl mb-5 flex items-center justify-between">
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

      {/* 4-column single-row layout */}
      <div className="w-full max-w-3xl flex gap-3" style={{ height: 280 }}>
        {cards.map((card) => (
          <TallCard key={card.label} card={card} />
        ))}
      </div>

      <p className="mt-5 text-white/20 text-xs uppercase tracking-widest">Layout: Compact 4-Col</p>
    </div>
  );
}
