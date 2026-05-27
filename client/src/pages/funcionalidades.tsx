import { useLocation } from "wouter";
import { ArrowLeft, Map, Layers, CheckSquare, Shield, DollarSign, Bot, Microscope, FolderOpen } from "lucide-react";
import loginBackground from "@assets/restinga_drone_bg.png";
import Logo from "@/components/layout/logo";

export default function Funcionalidades() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Layers,
      title: "Gestão de Empreendimentos",
      description: "Cadastro consolidado de empreendimentos com rastreamento detalhado de status ambiental (Ativo, Planejamento, Execução e Inativo) e responsáveis técnicos.",
    },
    {
      icon: CheckSquare,
      title: "Controle de Condicionantes",
      description: "Alertas automáticos, cronogramas de vigência e painéis de controle integrados para o cumprimento rigoroso de condicionantes e licenças ambientais.",
    },
    {
      icon: Map,
      title: "Cartografia Integrada 2D/3D",
      description: "Visualização espacial interativa contendo plotagem tridimensional de pontos, perímetros de empreendimentos e suporte a importação de camadas GeoJSON/KMZ/KML.",
    },
    {
      icon: Microscope,
      title: "Monitoramento de Campo & Amostras",
      description: "Rastreabilidade completa de campanhas em campo, controle laboratorial de amostras coletadas (água, solo, ruído) e registros fotográficos integrados.",
    },
    {
      icon: DollarSign,
      title: "Gestão Financeira e Propostas",
      description: "Fluxo de lançamentos financeiros, controle de despesas e receitas por projeto, além de geração automatizada de propostas comerciais de consultoria.",
    },
    {
      icon: Bot,
      title: "EcoAssistente IA",
      description: "Suporte cognitivo embarcado capaz de analisar documentos PDF, interpretar termos de referência, organizar condicionantes e responder a dúvidas legislativas.",
    },
    {
      icon: Shield,
      title: "Segurança do Trabalho (SST)",
      description: "Controle completo de exames de colaboradores (ASOs), entrega de EPIs, elaboração de programas como PGR e gestão de riscos ocupacionais (NRs).",
    },
    {
      icon: FolderOpen,
      title: "Base de Dados e Conhecimento",
      description: "Bibilioteca técnica para publicações científicas, links úteis de órgãos licenciadores e centralização de backups em nuvem de maneira segura.",
    },
  ];

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-[#060D0B] text-white font-sans overflow-y-auto">
      {/* Imagem de Fundo de Restinga */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${loginBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "contrast(1.15) brightness(0.2) saturate(1.1)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#060D0B] via-[#060D0B]/90 to-[#060D0B]/80" />
      </div>

      {/* Luz ambiental sutil */}
      <div
        aria-hidden
        className="pointer-events-none fixed -inset-[20%] blur-[120px] opacity-40 z-10"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(45,212,191,0.12), transparent 70%)",
        }}
      />

      {/* Cabeçalho */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/5">
        <Logo size="sm" />

        <button
          onClick={() => setLocation("/login")}
          className="flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white border border-white/10 hover:border-white/20 bg-white/5 rounded-full px-4 py-2 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Login</span>
        </button>
      </header>

      {/* Conteúdo Principal */}
      <main className="relative z-20 w-full max-w-7xl mx-auto px-6 py-12 md:py-16 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold font-display text-white tracking-wide">
            Funcionalidades do <span className="text-primary">Sistema</span>
          </h1>
          <p className="text-sm text-white/60 leading-relaxed font-light">
            Descubra as ferramentas integradas que tornam o SGAI da AmbientIA a solução definitiva para o gerenciamento de conformidade, licenciamento e operações ambientais.
          </p>
        </div>

        {/* Grid de Funcionalidades */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className="premium-card flex flex-col p-6 space-y-4 bg-card/45 backdrop-blur-md border border-white/15 rounded-[2rem] hover:scale-[1.02] transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(45,212,191,0.15)]">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold font-display text-white tracking-wide">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-white/50 leading-relaxed font-light">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
