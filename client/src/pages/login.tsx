import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";


import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Loader2, Eye, EyeOff, ArrowLeft, ArrowRight, BarChart3, Layers, Construction } from "lucide-react";
import loginBackground from "@assets/restinga_drone_bg.png";
import logoImg from "@assets/ambientia_logo.png";
import Logo from "@/components/layout/logo";

/**
 * AmbientIA — Tela de Login Split-Screen Responsiva Premium (Rimberio Theme)
 */
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const login = useLogin();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"inicio" | "sobre" | "contato" | "ambientia-tech">("inicio");

  useEffect(() => {
    const savedEmail = localStorage.getItem("savedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login.mutateAsync({ email, password });

      toast({
        title: "Login realizado",
        description: "Bem-vindo ao sistema SGAI.",
      });

      rememberMe
        ? localStorage.setItem("savedEmail", email)
        : localStorage.removeItem("savedEmail");

      setLocation("/dashboard");
    } catch (err: any) {
      setError(
        err?.message?.includes?.("401")
          ? "Usuário ou senha inválidos."
          : "Erro ao fazer login. Tente novamente."
      );
    }
  };

  const handleSendResetLink = async () => {
    if (!forgotEmail.trim()) return;
    setIsSending(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      toast({
        title: "E-mail enviado",
        description: "Verifique sua caixa de entrada.",
      });
      setIsForgotOpen(false);
      setForgotEmail("");
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível enviar o e-mail.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex bg-[#060D0B] text-white font-sans overflow-hidden">
      {/* Imagem de Fundo (Sempre presente, cobrindo a tela inteira) */}
      <div
        className="absolute inset-0 z-0 animate-[bgZoom_15s_cubic-bezier(0.1,1,0.1,1)_forwards]"
        style={{
          backgroundImage: `url(${loginBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "contrast(1.15) brightness(0.65) saturate(1.1)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-[#060D0B] via-[#060D0B]/85 to-transparent" />
      </div>

      {/* Luz ambiental dinâmica */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[20%] blur-[80px] opacity-60 z-10"
        style={{
          background:
            "radial-gradient(40% 60% at 20% 30%, rgba(45,212,191,0.15), transparent 60%), radial-gradient(40% 60% at 80% 70%, rgba(30,97,70,0.15), transparent 60%)",
          animation: "ecoLightSweep 45s ease-in-out infinite alternate",
        }}
      />

      <style>
        {`
          @keyframes ecoLightSweep {
            0% { transform: translateX(-6%) translateY(-4%); }
            100% { transform: translateX(8%) translateY(6%); }
          }
          @keyframes ecoFadeUp {
            0% { opacity: 0; transform: translateY(36px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes bgZoom {
            0% { transform: scale(1.08); }
            100% { transform: scale(1); }
          }
        `}
      </style>

      {/* Estrutura Split-Screen Responsiva */}
      <div className="relative z-20 min-h-screen w-full flex flex-col lg:flex-row">
        
        {/* PAINEL ESQUERDO: Apresentação da Marca (Oculto se o form estiver ativo) */}
        <div className={`w-full flex-col justify-between p-8 sm:p-12 xl:p-16 min-h-screen ${showForm ? "hidden" : "flex"}`}>
          {/* Header da Apresentação */}
          <div className="flex items-center justify-between w-full z-20">
            {/* Logo e Nome */}
            {/* Logo e Nome */}
            <div className="cursor-pointer" onClick={() => { setActiveTab("inicio"); setShowForm(false); }}>
              <Logo size="sm" variant="360" />
            </div>

            {/* Links da Apresentação */}
            <nav className="flex items-center gap-6 text-[11px] font-bold text-white/50 tracking-[0.2em] uppercase font-condensed">
              <button type="button" onClick={() => { setActiveTab("inicio"); setShowForm(false); }} className={`hover:text-white transition uppercase ${activeTab === "inicio" ? "text-primary font-bold" : ""}`}>Início</button>
              <button type="button" onClick={() => { setActiveTab("sobre"); setShowForm(false); }} className={`hover:text-white transition uppercase ${activeTab === "sobre" ? "text-primary font-bold" : ""}`}>Sobre</button>
              <button type="button" onClick={() => { setActiveTab("contato"); setShowForm(false); }} className={`hover:text-white transition uppercase ${activeTab === "contato" ? "text-primary font-bold" : ""}`}>Contato</button>
              <button type="button" onClick={() => setLocation("/funcionalidades")} className="hover:text-white transition uppercase">Funcionalidades</button>
              {/* Aba AmbientIA Tech — destacada */}
              <button
                type="button"
                onClick={() => { setActiveTab("ambientia-tech"); setShowForm(false); }}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300
                  ${
                    activeTab === "ambientia-tech"
                      ? "bg-gradient-to-r from-cyan-500/30 to-emerald-500/20 border border-cyan-400/40 text-cyan-300"
                      : "hover:text-cyan-300 border border-transparent hover:border-cyan-400/20 hover:bg-cyan-500/10"
                  }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                AmbientIA Tech
              </button>
            </nav>

            {/* Hamburger Icon */}
            <button className="text-white/50 hover:text-white transition" aria-label="Menu">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Destaque Central / Conteúdo das Abas */}
          {activeTab === "inicio" && (
            <div className="flex flex-col items-center justify-center my-auto text-center select-none z-20 animate-[ecoFadeUp_1s_cubic-bezier(0.16,1,0.3,1)]">
              <Logo size="xl" variant="360" />
            </div>
          )}

          {activeTab === "sobre" && (
            <div className="flex flex-col my-auto max-w-xl space-y-6 z-20 animate-[ecoFadeUp_0.4s_ease-out]">
              <h2 className="text-4xl font-bold font-display text-primary">Sobre a AmbientIA</h2>
              <div className="space-y-4 text-white/80 text-sm leading-relaxed font-light">
                <p>
                  A <strong>AmbientIA</strong> é uma plataforma pioneira projetada para simplificar e automatizar a gestão de conformidade, licenciamento e monitoramento de consultorias e empresas.
                </p>
                <p>
                  Nosso sistema consolida o gerenciamento de licenças, condicionantes, relatórios técnicos, dados geográficos (GIS 2D/3D), equipes de campo, auditorias de segurança (SST) e controle financeiro em um único ambiente integrado.
                </p>
                <p>
                  Unindo inteligência artificial a uma navegação fluida, mitigamos riscos de multas e aceleramos a conformidade legal para manter seus projetos em dia.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setActiveTab("inicio")} 
                className="w-fit text-xs text-primary font-semibold border border-primary/20 bg-primary/10 rounded-full px-4 py-2 hover:bg-primary/20 transition-all"
              >
                ← Voltar para Início
              </button>
            </div>
          )}

          {activeTab === "contato" && (
            <div className="flex flex-col my-auto max-w-xl space-y-6 z-20 animate-[ecoFadeUp_0.4s_ease-out]">
              <h2 className="text-4xl font-bold font-display text-primary">Fale Conosco</h2>
              <div className="space-y-4 text-white/80 text-sm font-light">
                <p className="leading-relaxed">
                  Para dúvidas comerciais, suporte técnico ou demonstrações do sistema, entre em contato através dos nossos canais de comunicação:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[10px] uppercase text-primary font-bold mb-1">E-mail Comercial</p>
                    <p className="text-xs text-white/90">comercial@ambientia.com.br</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[10px] uppercase text-primary font-bold mb-1">Suporte Técnico</p>
                    <p className="text-xs text-white/90">suporte@ambientia.com.br</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[10px] uppercase text-primary font-bold mb-1">Telefone / WhatsApp</p>
                    <p className="text-xs text-white/90">(71) 3003-8080</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[10px] uppercase text-primary font-bold mb-1">Localização</p>
                    <p className="text-xs text-white/90">Salvador, BA - Corporate Center</p>
                  </div>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setActiveTab("inicio")} 
                className="w-fit text-xs text-primary font-semibold border border-primary/20 bg-primary/10 rounded-full px-4 py-2 hover:bg-primary/20 transition-all"
              >
                ← Voltar para Início
              </button>
            </div>
          )}

          {activeTab === "ambientia-tech" && (
            <div className="flex flex-col my-auto max-w-3xl w-full space-y-6 z-20 animate-[ecoFadeUp_0.4s_ease-out]">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-400/20 rounded-full px-4 py-1.5 text-[10px] font-bold tracking-[0.25em] uppercase text-cyan-300 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Ecossistema de Tecnologia
                </div>
                <h2 className="text-4xl font-bold font-display text-white">AmbientIA <span className="text-cyan-400">Tech</span></h2>
                <p className="text-white/50 text-sm leading-relaxed font-light max-w-lg">
                  Um ecossistema integrado de plataformas para gestão ambiental inteligente, análise de dados e conformidade legal.
                </p>
              </div>

              {/* Cards de Produtos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Card AmbientIA 360 */}
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="group relative text-left rounded-[1.5rem] border border-cyan-500/30
                             bg-gradient-to-br from-cyan-500/15 to-emerald-600/8
                             backdrop-blur-xl p-7
                             shadow-[0_0_40px_rgba(45,212,191,0.12)]
                             hover:scale-[1.03] hover:brightness-110 hover:shadow-[0_0_60px_rgba(45,212,191,0.25)]
                             transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                >
                  <div className="absolute inset-0 rounded-[1.5rem] bg-black/25 backdrop-blur-sm" />
                  {/* Badge */}
                  <div className="relative z-10 flex items-start justify-between mb-6">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] border rounded-full px-3 py-1 bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                      Principal
                    </span>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 group-hover:border-cyan-400/40 transition-colors">
                      <Layers className="h-4.5 w-4.5 text-white/40 group-hover:text-cyan-400 transition-colors" />
                    </div>
                  </div>
                  {/* Logo text */}
                  <div className="relative z-10 mb-3">
                    <span className="text-white font-condensed font-bold text-3xl leading-none">
                      Ambient<span className="text-cyan-400">IA</span> 360
                      <span className="text-cyan-400 font-sans align-super text-[0.55em] leading-none ml-0.5">°</span>
                      <sup className="font-normal text-white/80 text-[0.35em] -top-2 relative">TM</sup>
                    </span>
                  </div>
                  <p className="relative z-10 text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-400/70 mb-3">
                    Gestão Ambiental Inteligente
                  </p>
                  <p className="relative z-10 text-white/55 text-xs leading-relaxed font-light mb-5">
                    Plataforma completa para gestão de licenciamento ambiental, condicionantes, monitoramento e conformidade legal com inteligência artificial.
                  </p>
                  <ul className="relative z-10 space-y-1.5 mb-5">
                    {["Licenciamento & Condicionantes", "GIS 3D Interativo", "Assistente IA", "Relatórios Automáticos"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-[11px] text-white/45">
                        <span className="w-1 h-1 rounded-full bg-cyan-400/60 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="relative z-10 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/35 group-hover:text-cyan-400 transition-colors">
                    <span>Acessar plataforma</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                </button>

                {/* Card AmbientIA Stats */}
                <button
                  type="button"
                  onClick={() => setLocation("/stats/login")}
                  className="group relative text-left rounded-[1.5rem] border border-white/15
                             bg-gradient-to-br from-slate-500/15 to-cyan-900/8
                             backdrop-blur-xl p-7
                             shadow-[0_0_40px_rgba(255,255,255,0.04)]
                             hover:scale-[1.03] hover:brightness-105 hover:shadow-[0_0_50px_rgba(255,255,255,0.08)]
                             transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/20"
                >
                  <div className="absolute inset-0 rounded-[1.5rem] bg-black/25 backdrop-blur-sm" />
                  {/* Badge */}
                  <div className="relative z-10 flex items-start justify-between mb-6">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] border rounded-full px-3 py-1 bg-white/8 text-white/50 border-white/15">
                      Em breve
                    </span>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 group-hover:border-white/25 transition-colors">
                      <BarChart3 className="h-4.5 w-4.5 text-white/30 group-hover:text-white/60 transition-colors" />
                    </div>
                  </div>
                  {/* Logo text */}
                  <div className="relative z-10 mb-3">
                    <span className="text-white font-condensed font-bold text-3xl leading-none">
                      Ambient<span className="text-cyan-400">IA</span> Stats
                      <sup className="font-normal text-white/70 text-[0.35em] -top-2 relative">TM</sup>
                    </span>
                  </div>
                  <p className="relative z-10 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35 mb-3">
                    Análise de Dados Ambientais
                  </p>
                  <p className="relative z-10 text-white/40 text-xs leading-relaxed font-light mb-5">
                    Ferramenta especializada em análise estatística e visualização de dados ambientais para laudos e tomada de decisão.
                  </p>
                  <ul className="relative z-10 space-y-1.5 mb-5">
                    {["Análise Estatística Avançada", "Visualização de Dados", "Exportação para Laudos", "Integração com AmbientIA 360°"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-[11px] text-white/30">
                        <span className="w-1 h-1 rounded-full bg-white/25 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="relative z-10 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/25 group-hover:text-white/50 transition-colors">
                    <Construction className="h-3.5 w-3.5" />
                    <span>Em desenvolvimento</span>
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab("inicio")}
                className="w-fit text-xs text-primary font-semibold border border-primary/20 bg-primary/10 rounded-full px-4 py-2 hover:bg-primary/20 transition-all"
              >
                ← Voltar para Início
              </button>
            </div>
          )}

          {/* Rodapé do painel esquerdo: Descrição e Botão "ENTRAR" no estilo "NEXT >>" */}
          <div className="flex items-end justify-between gap-8 mt-auto z-20">
            <div className="flex items-start gap-4 max-w-sm">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center border border-white/10 shadow-sm">
                  <svg className="w-4 h-4 text-[#06100E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-white/10 shadow-sm">
                  <svg className="w-4 h-4 text-[#06100E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                  </svg>
                </div>
              </div>
              <p className="text-[11px] text-white/40 leading-relaxed font-light">
                Plataforma corporativa de conformidade ambiental, auditorias e gestão automatizada de licenciamento.
              </p>
            </div>

            {/* Botão de Slide Estilo NEXT >> que rola ou foca no form */}
            {/* Botão de Slide Estilo NEXT >> que rola ou foca no form */}
            <button 
              onClick={() => {
                setShowForm(true);
                setTimeout(() => {
                  const el = document.getElementById("email");
                  el?.focus();
                }, 100);
              }}
              className="flex items-center gap-3 bg-white text-[#06100E] rounded-full pl-6 pr-2.5 py-2.5 hover:bg-primary hover:scale-105 transition-all duration-300 shadow-lg group"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider font-condensed">Entrar</span>
              <div className="w-7 h-7 rounded-full bg-primary group-hover:bg-[#06100E] flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-[#06100E] group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        </div>

        {/* PAINEL DIREITO: Área do Formulário */}
        <div className={`w-full flex-col items-center justify-center p-6 sm:p-12 min-h-screen ${showForm ? "flex" : "hidden"}`}>
          
          <Card
            className="w-full max-w-md rounded-[2rem] border border-white/15
                       bg-black/40 backdrop-blur-[20px] backdrop-saturate-[180%]
                       shadow-[0_20px_50px_rgba(0,0,0,0.5)]
                       p-8 sm:p-10 animate-[ecoFadeUp_900ms_cubic-bezier(0.16,1,0.3,1)]"
          >
            <CardContent className="p-0 space-y-8 relative z-10">
              
              {/* Botão de Voltar */}
              {showForm && (
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition mb-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>
              )}
              
              {/* Header do Form */}
              <div className="space-y-4">
                <div className="flex justify-center mb-6">
                  <Logo size="md" variant="360" />
                </div>

                <div className="text-center space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight text-white font-display">
                    Acesse o Sistema
                  </h2>
                  <p className="text-xs text-white/50">
                    Insira suas credenciais para gerenciar seus empreendimentos.
                  </p>
                </div>
              </div>

              {/* Formulário */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-xs uppercase tracking-wider font-semibold text-white/60 mb-1 block"
                  >
                    E-mail corporativo
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com.br"
                    className="bg-black/40 border-white/10 hover:border-white/20 text-white placeholder:text-neutral-400/60
                               rounded-xl py-6 px-4
                               focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary
                               transition-all duration-200 shadow-inner"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-xs uppercase tracking-wider font-semibold text-white/60 mb-1 block"
                  >
                    Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pr-11 bg-black/40 border-white/10 hover:border-white/20 text-white placeholder:text-neutral-400/60
                                 rounded-xl py-6 px-4
                                 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary
                                 transition-all duration-200 shadow-inner"
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-3.5 text-white/50 hover:text-white transition"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Opções */}
                <div className="flex items-center justify-between text-white">
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none text-white/80 hover:text-white transition">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-md border transition-all duration-200 flex items-center justify-center
                                      ${rememberMe 
                                        ? 'bg-gradient-to-r from-accent to-primary border-transparent shadow-[0_0_10px_rgba(45,212,191,0.35)]' 
                                        : 'border-white/20 bg-black/45 hover:border-white/30'}`}
                      >
                        {rememberMe && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="font-medium text-xs tracking-wide">Lembrar login</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotOpen(true)}
                    className="text-xs font-semibold underline underline-offset-4 text-white/70 hover:text-white transition"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                {error && (
                  <div className="text-red-200 bg-red-950/40 border border-red-800/40 px-4 py-3 rounded-xl text-xs font-medium tracking-wide">
                    {error}
                  </div>
                )}

                {/* Botão principal com hover premium */}
                <Button
                  type="submit"
                  disabled={login.isPending}
                  className="w-full py-7 text-sm uppercase tracking-wider font-bold text-white rounded-xl
                             bg-gradient-to-r from-accent to-primary
                             hover:brightness-110 hover:scale-[1.01] active:scale-[0.99]
                             transition-all duration-300
                             shadow-[0_4px_25px_rgba(45,212,191,0.25),0_0_0_1px_rgba(255,255,255,0.05)]"
                >
                  {login.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar no Sistema"
                  )}
                </Button>
              </form>

              <div className="mt-8">
                {/* Separador decorativo sutil */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>

                {/* Assinatura do desenvolvedor */}
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[9px] tracking-[0.3em] uppercase text-white/30 font-semibold">
                    Desenvolvido por
                  </p>

                  <div className="flex items-center gap-2 bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/15 hover:scale-[1.03] rounded-full px-4 py-2 backdrop-blur-sm transition-all duration-300 cursor-default shadow-sm group">
                    <span className="text-[12px] font-bold tracking-wider text-white/60 group-hover:text-white/90 transition-colors duration-300">
                      Maurivan Vaz Ribeiro
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de recuperação */}
      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="bg-[#0E1B17]/90 text-white border border-white/10 backdrop-blur-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-semibold text-primary">
              Recuperar senha
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm mb-4 text-neutral-300">
            Digite seu e-mail corporativo para receber o link de redefinição.
          </p>
          <Input
            type="email"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            placeholder="seu@email.com.br"
            className="bg-white/5 border-white/10 text-neutral-50 placeholder:text-neutral-400
                       focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary"
          />
          <Button
            onClick={handleSendResetLink}
            disabled={isSending}
            className="w-full mt-4 text-white
                       [background-image:linear-gradient(90deg,#00599C,#1E6146)]
                       hover:brightness-110 transition-all duration-300"
          >
            {isSending ? "Enviando..." : "Enviar link de recuperação"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
