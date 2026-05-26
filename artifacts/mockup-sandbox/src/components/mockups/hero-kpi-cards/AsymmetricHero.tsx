import { CheckCircle, Target, Layers, AlertTriangle, TrendingUp, Sparkles, ArrowUpRight } from "lucide-react";

const heroCard = {
  label: "Licenças Ativas",
  value: 24,
  total: 31,
  sub: "de 31 no total",
  icon: CheckCircle,
  gradient: "linear-gradient(135deg, #022c22 0%, #064e3b 30%, #059669 75%, #10b981 100%)",
  pct: 77,
  accent: "#10b981",
  detail: "Nenhuma vencendo em 7 dias",
  change: "+2 desde semana passada",
};

const smallCards = [
  {
    label: "Campanhas de Campo",
    value: 7,
    total: 10,
    sub: "3 ativas",
    icon: Target,
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 60%, #3b82f6 100%)",
    pct: 70,
    tag: "↗ Ativas",
  },
  {
    label: "Projetos Ativos",
    value: 12,
    total: 18,
    sub: "em andamento",
    icon: Layers,
    gradient: "linear-gradient(135deg, #0c4a6e 0%, #0284c7 60%, #38bdf8 100%)",
    pct: 67,
    tag: "⚡ Curso",
  },
  {
    label: "Cond. Pendentes",
    value: 5,
    total: 20,
    sub: "2 vencidas!",
    icon: AlertTriangle,
    gradient: "linear-gradient(135deg, #7c2d12 0%, #dc2626 60%, #f87171 100%)",
    pct: 25,
    tag: "⚠ Atenção",
  },
];

function SmallCard({ card }: { card: typeof smallCards[0] }) {
  const Icon = card.icon;
  return (
    <div
      className="relative overflow-hidden rounded-2xl flex-1 flex flex-col p-4 gap-3"
      style={{
        background: card.gradient,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
      }}
    >
      <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-10"
        style={{ background: "white", filter: "blur(12px)" }} />

      <div className="flex items-start justify-between">
        <div className="p-1.5 rounded-lg" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.15)" }}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
          style={{ background: "rgba(0,0,0,0.25)", color: "rgba(255,255,255,0.85)" }}>
          {card.tag}
        </span>
      </div>

      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black text-white leading-none tracking-tight">{card.value}</span>
          <span className="text-white/35 text-xs">/{card.total}</span>
        </div>
        <p className="text-white/50 text-[9px] font-bold uppercase tracking-widest mt-1.5 truncate">{card.label}</p>
      </div>

      <div className="h-0.5 rounded-full overflow-hidden mt-auto" style={{ background: "rgba(0,0,0,0.2)" }}>
        <div className="h-full rounded-full" style={{ width: `${card.pct}%`, background: "rgba(255,255,255,0.5)" }} />
      </div>
    </div>
  );
}

export function AsymmetricHero() {
  const HeroIcon = heroCard.icon;

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

      <div className="w-full max-w-2xl flex flex-col gap-3">
        {/* Hero card — full width, taller, more detail */}
        <div
          className="relative overflow-hidden rounded-3xl p-6"
          style={{
            background: heroCard.gradient,
            boxShadow: "0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.15)",
            minHeight: 168,
          }}
        >
          {/* Decorations */}
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-10"
            style={{ background: "white", filter: "blur(24px)" }} />
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)" }} />

          {/* Inner layout: left metric + right detail */}
          <div className="relative flex items-center gap-8">
            {/* Left: big number block */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <HeroIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Indicador Principal</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-7xl font-black text-white leading-none tracking-tighter">{heroCard.value}</span>
                <span className="text-white/35 text-xl font-semibold">/{heroCard.total}</span>
              </div>
              <p className="text-white/55 text-xs font-bold uppercase tracking-widest">{heroCard.label}</p>
            </div>

            {/* Divider */}
            <div className="self-stretch w-px" style={{ background: "rgba(255,255,255,0.12)" }} />

            {/* Right: detail block */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-white">{heroCard.pct}%</span>
                <span className="text-white/45 text-xs">do total em dia</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.2)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${heroCard.pct}%`, background: "rgba(255,255,255,0.6)" }} />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-white/55">
                  <CheckCircle className="w-3 h-3" style={{ color: "#10b981" }} />
                  {heroCard.detail}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/55">
                  <ArrowUpRight className="w-3 h-3" style={{ color: "#10b981" }} />
                  {heroCard.change}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3 smaller cards in a row */}
        <div className="flex gap-3">
          {smallCards.map((card) => (
            <SmallCard key={card.label} card={card} />
          ))}
        </div>
      </div>

      <p className="mt-5 text-white/20 text-xs uppercase tracking-widest">Layout: Asymmetric Hero</p>
    </div>
  );
}
