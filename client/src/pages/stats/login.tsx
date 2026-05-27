import { useLocation } from "wouter";
import { ArrowLeft, BarChart3, Construction } from "lucide-react";
import Logo from "@/components/layout/logo";
import loginBackground from "@assets/restinga_drone_bg.png";

export default function StatsLogin() {
  const [, setLocation] = useLocation();

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#060D0B] text-white overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${loginBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "contrast(1.1) brightness(0.4) saturate(0.7)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-[#060D0B] via-[#060D0B]/90 to-transparent" />
      </div>

      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[20%] blur-[100px] opacity-40 z-10"
        style={{
          background:
            "radial-gradient(40% 60% at 30% 40%, rgba(100,180,255,0.10), transparent 60%), radial-gradient(30% 50% at 70% 60%, rgba(45,212,191,0.08), transparent 60%)",
        }}
      />

      {/* Back button */}
      <button
        onClick={() => setLocation("/solucoes-tecnologicas")}
        className="absolute top-6 left-6 z-30 flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar às Soluções</span>
      </button>

      {/* Card */}
      <div className="relative z-20 w-full max-w-md mx-auto px-6">
        <div
          className="rounded-[2rem] border border-white/10 bg-black/40 backdrop-blur-[24px] p-10
                     shadow-[0_20px_60px_rgba(0,0,0,0.5)]
                     animate-[fadeUp_0.6s_cubic-bezier(0.16,1,0.3,1)]"
        >
          <style>{`
            @keyframes fadeUp {
              0% { opacity: 0; transform: translateY(30px); }
              100% { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Logo variant="stats" size="md" showSubtitle={false} />
          </div>

          {/* Coming soon content */}
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Construction className="w-6 h-6 text-cyan-400/70" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-white font-condensed">
                Em breve disponível
              </h2>
              <p className="text-xs text-white/40 leading-relaxed font-light max-w-xs">
                O AmbientIA Stats está em desenvolvimento ativo. A plataforma de análise estatística ambiental será lançada em breve.
              </p>
            </div>

            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-cyan-400/60">
                O que está chegando
              </p>
              {[
                "Análise estatística descritiva e inferencial",
                "Visualizações interativas de séries temporais",
                "Exportação automática para laudos técnicos",
                "Integração nativa com AmbientIA 360°",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-xs text-white/50">
                  <BarChart3 className="w-3 h-3 text-cyan-400/50 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            <button
              onClick={() => setLocation("/solucoes-tecnologicas")}
              className="w-full py-4 rounded-xl text-xs font-bold uppercase tracking-wider
                         bg-white/5 border border-white/10 text-white/50
                         hover:bg-white/10 hover:border-white/20 hover:text-white
                         transition-all duration-200"
            >
              Voltar às Soluções
            </button>
          </div>
        </div>

        <p className="text-center text-[9px] text-white/20 mt-6 tracking-wider uppercase">
          Ribeiro Tecnologia Ambiental
        </p>
      </div>
    </div>
  );
}
