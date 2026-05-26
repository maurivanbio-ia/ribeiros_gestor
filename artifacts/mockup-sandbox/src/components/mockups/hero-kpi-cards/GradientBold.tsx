import { CheckCircle, Target, Layers, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";

const cards = [
  {
    label: "Licenças Ativas",
    value: 24,
    sub: "de 31 no total",
    icon: CheckCircle,
    gradient: "linear-gradient(135deg, #064e3b 0%, #059669 60%, #10b981 100%)",
    shimmer: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
    tag: "✓ Em dia",
    tagColor: "rgba(110,231,183,0.9)",
  },
  {
    label: "Campanhas de Campo",
    value: 7,
    sub: "3 em andamento",
    icon: Target,
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 60%, #3b82f6 100%)",
    shimmer: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
    tag: "↗ Ativas",
    tagColor: "rgba(147,197,253,0.9)",
  },
  {
    label: "Projetos Ativos",
    value: 12,
    sub: "de 18 projetos",
    icon: Layers,
    gradient: "linear-gradient(135deg, #0c4a6e 0%, #0284c7 60%, #38bdf8 100%)",
    shimmer: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
    tag: "⚡ Em curso",
    tagColor: "rgba(125,211,252,0.9)",
  },
  {
    label: "Cond. Pendentes",
    value: 5,
    sub: "2 vencidas!",
    icon: AlertTriangle,
    gradient: "linear-gradient(135deg, #7c2d12 0%, #dc2626 60%, #f87171 100%)",
    shimmer: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
    tag: "⚠ Atenção",
    tagColor: "rgba(252,165,165,0.9)",
  },
];

function BoldCard({ card }: { card: typeof cards[0] }) {
  const Icon = card.icon;
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 flex flex-col gap-4"
      style={{
        background: card.gradient,
        boxShadow: "0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
      }}
    >
      {/* Geometric decoration */}
      <div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full"
        style={{ background: "rgba(255,255,255,0.06)" }}
      />
      <div
        className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full"
        style={{ background: "rgba(0,0,0,0.15)" }}
      />
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)" }}
      />

      {/* Icon + Tag */}
      <div className="relative flex items-start justify-between">
        <div
          className="p-2.5 rounded-2xl"
          style={{
            background: "rgba(0,0,0,0.2)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full"
          style={{
            background: "rgba(0,0,0,0.25)",
            color: card.tagColor,
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(4px)",
          }}
        >
          {card.tag}
        </span>
      </div>

      {/* Number + Label */}
      <div className="relative">
        <div className="flex items-end gap-1">
          <span className="text-5xl font-black text-white leading-none tracking-tight">{card.value}</span>
          <span className="text-white/50 text-sm mb-1 font-medium">un.</span>
        </div>
        <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mt-2">{card.label}</p>
        {card.sub && (
          <p className="text-white/40 text-xs mt-1">{card.sub}</p>
        )}
      </div>

      {/* Bottom accent line */}
      <div
        className="relative h-1 rounded-full overflow-hidden"
        style={{ background: "rgba(0,0,0,0.2)" }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: "65%",
            background: "rgba(255,255,255,0.5)",
          }}
        />
      </div>
    </div>
  );
}

export function GradientBold() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      }}
    >
      {/* Header */}
      <div className="w-full max-w-3xl mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #059669, #10b981)",
              boxShadow: "0 4px 16px rgba(16,185,129,0.4)",
            }}
          >
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">Resumo Executivo</h2>
            <p className="text-white/40 text-xs">Visão geral · maio 2026</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          Atualizado agora
        </div>
      </div>

      {/* Cards */}
      <div className="w-full max-w-3xl grid grid-cols-2 gap-5">
        {cards.map((card) => (
          <BoldCard key={card.label} card={card} />
        ))}
      </div>

      <p className="mt-6 text-white/20 text-xs uppercase tracking-widest">Variante: Gradient Bold</p>
    </div>
  );
}
