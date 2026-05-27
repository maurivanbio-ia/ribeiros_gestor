import { useLocation } from "wouter";
import Logo from "@/components/layout/logo";
import { ArrowRight, BarChart3, Layers } from "lucide-react";

const products = [
  {
    variant: "360" as const,
    href: "/login",
    tagline: "Gestão Ambiental Inteligente",
    description:
      "Plataforma completa para gestão de licenciamento ambiental, condicionantes, monitoramento de campo, equipes e conformidade legal — tudo em um único ambiente integrado com inteligência artificial.",
    features: ["Licenciamento & Condicionantes", "GIS 3D Interativo", "Assistente IA", "Relatórios Automáticos"],
    accent: "from-cyan-500/20 to-emerald-600/10",
    border: "border-cyan-500/30",
    glow: "shadow-[0_0_60px_rgba(45,212,191,0.15)]",
    badge: "Principal",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    icon: Layers,
  },
  {
    variant: "stats" as const,
    href: "/stats/login",
    tagline: "Análise de Dados Ambientais",
    description:
      "Ferramenta especializada em análise estatística e visualização de dados ambientais. Transforme conjuntos de dados complexos em insights precisos para laudos, relatórios e tomada de decisão.",
    features: ["Análise Estatística Avançada", "Visualização de Dados", "Exportação para Laudos", "Integração com AmbientIA 360°"],
    accent: "from-slate-500/20 to-cyan-900/10",
    border: "border-white/20",
    glow: "shadow-[0_0_60px_rgba(255,255,255,0.05)]",
    badge: "Em breve",
    badgeColor: "bg-white/10 text-white/60 border-white/20",
    icon: BarChart3,
  },
];

export default function SolucoesTecnologicas() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#060D0B] text-white relative overflow-hidden">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[20%] blur-[120px] opacity-40"
        style={{
          background:
            "radial-gradient(40% 50% at 20% 30%, rgba(45,212,191,0.12), transparent 60%), radial-gradient(30% 40% at 80% 70%, rgba(30,97,70,0.12), transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-[10px] font-bold tracking-[0.25em] uppercase text-white/50 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Ecossistema de Tecnologia Ambiental
          </div>
          <h1 className="text-4xl md:text-5xl font-bold font-condensed tracking-tight text-white">
            Soluções <span className="text-cyan-400">Tecnológicas</span>
          </h1>
          <p className="text-white/50 text-sm max-w-xl mx-auto leading-relaxed font-light">
            Um ecossistema integrado de plataformas para gestão ambiental, análise de dados e conformidade legal — desenvolvido para consultorias e empresas do setor ambiental.
          </p>
        </div>

        {/* Product cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {products.map((product) => {
            const ProductIcon = product.icon;
            return (
              <button
                key={product.variant}
                onClick={() => setLocation(product.href)}
                className={`
                  group relative text-left rounded-[2rem] border ${product.border}
                  bg-gradient-to-br ${product.accent}
                  backdrop-blur-xl p-8 md:p-10
                  ${product.glow}
                  hover:scale-[1.02] hover:brightness-110
                  transition-all duration-400 cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-cyan-400/50
                `}
              >
                {/* Glass overlay */}
                <div className="absolute inset-0 rounded-[2rem] bg-black/30 backdrop-blur-sm" />

                {/* Badge */}
                <div className="relative z-10 flex items-start justify-between mb-8">
                  <span className={`text-[9px] font-bold uppercase tracking-[0.2em] border rounded-full px-3 py-1 ${product.badgeColor}`}>
                    {product.badge}
                  </span>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 group-hover:border-cyan-400/30 transition-colors`}>
                    <ProductIcon className="h-5 w-5 text-white/40 group-hover:text-cyan-400 transition-colors" />
                  </div>
                </div>

                {/* Logo */}
                <div className="relative z-10 mb-6">
                  <Logo variant={product.variant} size="lg" showSubtitle={false} />
                </div>

                {/* Tagline */}
                <p className="relative z-10 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/70 mb-4">
                  {product.tagline}
                </p>

                {/* Description */}
                <p className="relative z-10 text-white/60 text-sm leading-relaxed font-light mb-8">
                  {product.description}
                </p>

                {/* Features */}
                <ul className="relative z-10 space-y-2 mb-8">
                  {product.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-xs text-white/50">
                      <span className="w-1 h-1 rounded-full bg-cyan-400/60 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="relative z-10 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/40 group-hover:text-cyan-400 transition-colors">
                  <span>Acessar plataforma</span>
                  <ArrowRight className="h-3.5 w-3.5 translate-x-0 group-hover:translate-x-1 transition-transform" />
                </div>

                {/* Hover line accent */}
                <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
              </button>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-[10px] text-white/25 mt-12 tracking-wider uppercase font-light">
          Desenvolvido por Maurivan Vaz Ribeiro · Ribeiro Tecnologia Ambiental
        </p>
      </div>
    </div>
  );
}
