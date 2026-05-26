import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Menu, X, MapPin, Mail, Phone,
  ArrowRight, ExternalLink, ChevronDown,
  Leaf, BarChart3, Shield,
} from "lucide-react";
import avatarPhoto from "@assets/1774402729934_1777054860670.jpeg";

const NAV_LINKS = [
  { label: "Início", href: "#inicio" },
  { label: "Sobre", href: "#sobre" },
  { label: "SGAI", href: "#sgai" },
  { label: "Contato", href: "#contato" },
];

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (href: string) => {
    setMenuOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white antialiased font-sans">

      {/* ── NAVBAR ── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#0d1117]/95 backdrop-blur border-b border-white/10 shadow-xl" : "bg-transparent"}`}>
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <button onClick={() => scrollTo("#inicio")} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-teal-500/40">
              <img src={avatarPhoto} alt="Maurivan Vaz Ribeiro" className="w-full h-full object-cover object-top" />
            </div>
            <span className="font-semibold text-sm text-white/80 group-hover:text-white transition-colors">
              Maurivan Vaz Ribeiro
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(l => (
              <button key={l.href} onClick={() => scrollTo(l.href)}
                className="px-3.5 py-2 rounded-lg text-sm text-white/55 hover:text-white hover:bg-white/8 transition-colors font-medium">
                {l.label}
              </button>
            ))}
            <div className="w-px h-5 bg-white/15 mx-2" />
            <Link href="/login">
              <Button size="sm"
                className="gap-1.5 text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-white border-none shadow-lg shadow-teal-500/20">
                Acessar SGAI <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </nav>

          <button className="md:hidden text-white/60 hover:text-white" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-[#161b22] border-t border-white/10 px-5 py-4 space-y-1">
            {NAV_LINKS.map(l => (
              <button key={l.href} onClick={() => scrollTo(l.href)}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-white/65 hover:text-white hover:bg-white/8 transition-colors font-medium">
                {l.label}
              </button>
            ))}
            <div className="pt-2">
              <Link href="/login">
                <Button className="w-full gap-2 bg-teal-500 hover:bg-teal-400 text-white border-none">
                  Acessar SGAI <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section id="inicio" className="min-h-screen flex flex-col items-center justify-center px-5 pt-20 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] rounded-full bg-teal-500/4 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-blue-500/4 blur-3xl" />
        </div>

        <div className="relative text-center max-w-2xl mx-auto">
          {/* Avatar */}
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-teal-400 via-blue-500 to-violet-500 p-0.5 mx-auto mb-8 shadow-2xl shadow-teal-500/20">
            <div className="w-full h-full rounded-full overflow-hidden">
              <img src={avatarPhoto} alt="Maurivan Vaz Ribeiro" className="w-full h-full object-cover object-top" />
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
            Maurivan Vaz Ribeiro
          </h1>

          <p className="text-base text-white/45 font-medium mb-6 flex items-center justify-center gap-2">
            <MapPin className="h-4 w-4 text-teal-500" />
            Salvador, Bahia — Brasil
          </p>

          <p className="text-white/60 leading-relaxed text-base max-w-xl mx-auto mb-10">
            Biólogo e especialista em gestão ambiental com atuação em projetos de
            infraestrutura, energia e licenciamento em todo o Brasil.
            Criador do SGAI — plataforma de gestão ambiental integrada.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={() => scrollTo("#contato")}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-teal-500/20">
              Entre em contato <ArrowRight className="h-4 w-4" />
            </button>
            <Link href="/login">
              <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/15 text-white/60 hover:text-white hover:border-white/30 text-sm font-semibold transition-colors">
                Acessar o SGAI <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </Link>
          </div>
        </div>

        <button onClick={() => scrollTo("#sobre")}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20 hover:text-white/50 transition-colors animate-bounce">
          <ChevronDown className="h-6 w-6" />
        </button>
      </section>

      {/* ── SOBRE ── */}
      <section id="sobre" className="py-24 border-t border-white/8">
        <div className="max-w-5xl mx-auto px-5">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-teal-400 mb-4">Sobre</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 leading-snug">
                Quem sou eu
              </h2>
              <div className="space-y-4 text-white/55 leading-relaxed text-sm">
                <p>
                  Sou biólogo com mais de 15 anos de atuação em projetos ambientais de grande
                  porte pelo Brasil — de parques eólicos no Nordeste a rodovias federais na Amazônia.
                  Trabalho na interface entre o técnico e o humano: equipes de campo, comunidades
                  locais, órgãos ambientais e empreendedores.
                </p>
                <p>
                  Ao longo dos anos, percebi a necessidade de uma ferramenta que centralizasse
                  a gestão de licenças, condicionantes e documentação técnica de projetos ambientais.
                  Foi assim que surgiu o SGAI — desenvolvido por mim para resolver um problema real
                  do meu dia a dia.
                </p>
                <p>
                  Acredito que tecnologia e meio ambiente caminham juntos. Que dados bem organizados
                  são tão importantes quanto trabalho de campo bem feito. E que um licenciamento
                  bem conduzido protege tanto o empreendimento quanto o ambiente ao seu redor.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              {[
                {
                  icon: Leaf,
                  title: "Gestão Ambiental",
                  desc: "Licenciamento, condicionantes, monitoramento e conformidade legal em projetos de infraestrutura e energia.",
                },
                {
                  icon: BarChart3,
                  title: "Gestão de Dados",
                  desc: "Controle de documentação técnica, prazos, relatórios e indicadores de desempenho ambiental.",
                },
                {
                  icon: Shield,
                  title: "Conformidade Legal",
                  desc: "Interface com IBAMA, INEMA e órgãos estaduais. Acompanhamento de legislação e normas técnicas.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4 rounded-2xl bg-white/3 border border-white/8 p-5 hover:bg-white/5 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-teal-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">{title}</div>
                    <div className="text-xs text-white/45 leading-relaxed">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SGAI ── */}
      <section id="sgai" className="py-24 border-t border-white/8">
        <div className="max-w-5xl mx-auto px-5">
          <div className="rounded-3xl border border-teal-500/20 bg-gradient-to-br from-teal-500/8 via-transparent to-blue-500/5 p-10 sm:p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center mx-auto mb-6">
              <BarChart3 className="h-7 w-7 text-teal-400" />
            </div>
            <p className="text-xs font-bold tracking-widest uppercase text-teal-400 mb-3">Meu projeto</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">SGAI</h2>
            <p className="text-white/45 text-sm mb-2">Sistema de Gestão Ambiental Integrada</p>
            <p className="text-white/60 text-sm leading-relaxed max-w-xl mx-auto mb-10">
              Desenvolvi o SGAI para centralizar e automatizar o controle de empreendimentos,
              licenças ambientais, condicionantes, prazos, equipes e documentação técnica em
              um único lugar — resolvendo na prática os problemas que vivi em campo por mais de
              uma década.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
              {["Empreendimentos", "Licenciamento", "Condicionantes", "Equipes", "Documentos", "Relatórios"].map(tag => (
                <span key={tag} className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-white/6 border border-white/10 text-white/50">
                  {tag}
                </span>
              ))}
            </div>
            <Link href="/login">
              <button className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-teal-500/20">
                Acessar o sistema <ExternalLink className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── CONTATO ── */}
      <section id="contato" className="py-24 border-t border-white/8">
        <div className="max-w-5xl mx-auto px-5 text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-teal-400 mb-4">Contato</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Fale comigo</h2>
          <p className="text-white/45 text-sm max-w-md mx-auto mb-12">
            Tem alguma dúvida, proposta ou quer saber mais sobre o SGAI?
            Estou disponível pelos canais abaixo.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto">
            {[
              { icon: Mail, label: "E-mail", value: "maurivan@ecobrasil.bio.br", href: "mailto:maurivan@ecobrasil.bio.br" },
              { icon: Phone, label: "WhatsApp", value: "+55 71 9 8209-0828", href: "https://wa.me/5571982090828" },
            ].map(c => (
              <a key={c.label} href={c.href} target="_blank" rel="noreferrer"
                className="flex-1 w-full flex items-center gap-4 rounded-2xl border border-white/10 bg-white/3 px-6 py-5 hover:bg-white/6 hover:border-white/20 transition-all group text-left">
                <div className="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-500/25 transition-colors">
                  <c.icon className="h-5 w-5 text-teal-400" />
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-widest uppercase text-white/25 mb-0.5">{c.label}</div>
                  <div className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">{c.value}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-8 border-t border-white/8">
        <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-white/20">
            © {new Date().getFullYear()} Maurivan Vaz Ribeiro
          </span>
          <Link href="/login">
            <span className="text-xs text-teal-500/60 hover:text-teal-400 cursor-pointer transition-colors font-medium">
              Acessar SGAI →
            </span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
