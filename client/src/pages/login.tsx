import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { useLogin } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import loginBackground from "@/assets/restinga_drone_bg.png";
import Logo from "@/components/layout/logo";

export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem("savedEmail") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem("savedEmail"));
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  
  // Controle de Abas e Formulário
  const [activeTab, setActiveTab] = useState("inicio");
  const [showForm, setShowForm] = useState(false);

  const [, setLocation] = useLocation();
  const login = useLogin();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login.mutateAsync({ email, password });
      toast({ title: "Login realizado", description: "Bem-vindo ao sistema SGAI." });
      rememberMe ? localStorage.setItem("savedEmail", email) : localStorage.removeItem("savedEmail");
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err?.message?.includes?.("401") ? "Usuário ou senha inválidos." : "Erro ao fazer login. Tente novamente.");
    }
  };

  const handleSendResetLink = async () => {
    if (!forgotEmail.trim()) return;
    setIsSending(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: forgotEmail }),
      });
      toast({ title: "E-mail enviado", description: "Verifique sua caixa de entrada." });
      setIsForgotOpen(false);
      setForgotEmail("");
    } catch {
      toast({ title: "Erro", description: "Não foi possível enviar o e-mail.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex bg-[#030605] text-white font-sans overflow-hidden">
      
      <style>
        {`
          @keyframes ecoFadeUp {
            0% { opacity: 0; transform: translateY(24px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes glowPulse {
            0% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.05); }
            100% { opacity: 0.3; transform: scale(1); }
          }
        `}
      </style>

      {/* PAINEL ESQUERDO: Conteúdo Principal e Formulário */}
      <div className="relative z-20 w-full lg:w-[45%] flex flex-col justify-between p-8 sm:p-12 xl:p-20 min-h-screen bg-[#030605] overflow-y-auto overflow-x-hidden custom-scrollbar shadow-[20px_0_50px_rgba(0,0,0,0.8)] border-r border-white/5">
        
        {/* Luzes de fundo sutis no painel esquerdo */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
           <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] bg-cyan-900/20 rounded-full blur-[120px] animate-[glowPulse_8s_ease-in-out_infinite]" />
           <div className="absolute bottom-[-10%] right-[-20%] w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[150px] animate-[glowPulse_12s_ease-in-out_infinite_reverse]" />
        </div>

        {/* Header Superior */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-8 sm:gap-0 relative z-10">
          <div className="cursor-pointer transition-transform hover:scale-105" onClick={() => { setActiveTab("inicio"); setShowForm(false); }}>
            <Logo size="sm" />
          </div>

          {!showForm ? (
            <nav className="flex flex-wrap items-center gap-6 sm:gap-8 text-[10px] font-bold text-white/50 tracking-[0.25em] uppercase font-condensed">
              <button type="button" onClick={() => { setActiveTab("inicio"); setShowForm(false); }} className={`relative hover:text-white transition-colors duration-300 ${activeTab === "inicio" ? "text-primary" : ""}`}>
                Início
                {activeTab === "inicio" && <span className="absolute -bottom-2 left-0 w-full h-px bg-primary shadow-[0_0_8px_rgba(45,212,191,0.8)]" />}
              </button>
              <button type="button" onClick={() => { setActiveTab("sobre"); setShowForm(false); }} className={`relative hover:text-white transition-colors duration-300 ${activeTab === "sobre" ? "text-primary" : ""}`}>
                Sobre
                {activeTab === "sobre" && <span className="absolute -bottom-2 left-0 w-full h-px bg-primary shadow-[0_0_8px_rgba(45,212,191,0.8)]" />}
              </button>
              <button type="button" onClick={() => { setActiveTab("contato"); setShowForm(false); }} className={`relative hover:text-white transition-colors duration-300 ${activeTab === "contato" ? "text-primary" : ""}`}>
                Contato
                {activeTab === "contato" && <span className="absolute -bottom-2 left-0 w-full h-px bg-primary shadow-[0_0_8px_rgba(45,212,191,0.8)]" />}
              </button>
            </nav>
          ) : (
            <button type="button" onClick={() => setShowForm(false)} className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-all hover:-translate-x-1">
              <ArrowLeft className="w-4 h-4" />
              <span className="uppercase tracking-[0.2em] font-bold text-[10px]">Voltar</span>
            </button>
          )}
        </div>

        {/* Conteúdo Central do Painel */}
        <div className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto my-12 relative z-10">
          {!showForm ? (
            <div className="w-full">
              {activeTab === "inicio" && (
                <div className="flex flex-col items-start animate-[ecoFadeUp_0.8s_ease-out]">
                  <div className="mb-8">
                     <Logo size="xl" />
                  </div>
                  <div className="space-y-6 pl-1 border-l-2 border-primary/30">
                    <p className="pl-5 text-white/70 text-[15px] font-light leading-relaxed tracking-wide">
                      A <span className="text-white font-medium">1ª Consultoria Ambiental do Brasil</span> exclusivamente dedicada a transformar a gestão, licenciamento e conformidade através de <strong className="text-primary font-semibold">Inteligência Artificial</strong>.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "sobre" && (
                <div className="animate-[ecoFadeUp_0.4s_ease-out] w-full space-y-8">
                  <h2 className="text-4xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">Sobre a AmbientIA</h2>
                  <div className="space-y-6 text-white/60 text-[15px] leading-relaxed font-light">
                    <p>
                      A <strong className="text-white/90">AmbientIA Inteligência Ambiental</strong> é uma empresa de tecnologia e inteligência de dados aplicada ao setor ambiental, dedicada ao desenvolvimento de soluções digitais para apoiar organizações que atuam com gestão, monitoramento e conformidade.
                    </p>
                    <p>
                      Mais do que uma fornecedora de tecnologia, posicionamo-nos como uma parceira estratégica para a evolução digital do setor ambiental, conectando <span className="text-primary/90">inovação, sustentabilidade e desempenho</span>.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "contato" && (
                <div className="animate-[ecoFadeUp_0.4s_ease-out] w-full space-y-8">
                  <h2 className="text-4xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">Fale Conosco</h2>
                  <div className="space-y-6 text-white/60 text-[15px] font-light">
                    <p className="leading-relaxed">Entre em contato através dos nossos canais oficiais:</p>
                    <div className="grid grid-cols-1 gap-4 mt-4">
                      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 hover:bg-white/[0.04] transition-colors">
                        <p className="text-[10px] uppercase text-primary font-bold mb-2 tracking-widest">E-mail Comercial</p>
                        <p className="text-sm text-white/90 font-medium">comercial@ambientia.com.br</p>
                      </div>
                      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 hover:bg-white/[0.04] transition-colors">
                        <p className="text-[10px] uppercase text-primary font-bold mb-2 tracking-widest">Telefone / WhatsApp</p>
                        <p className="text-sm text-white/90 font-medium">(71) 3003-8080</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full animate-[ecoFadeUp_0.5s_ease-out]">
              <div className="mb-10">
                <Logo size="lg" className="mb-8 justify-start items-start" />
                <h2 className="text-3xl font-bold tracking-tight text-white font-display mb-2">Acesso Restrito</h2>
                <p className="text-sm text-white/50 font-light">Insira suas credenciais corporativas para entrar na plataforma.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2.5">
                  <Label htmlFor="email" className="text-[10px] uppercase tracking-[0.15em] font-bold text-white/50 block">E-mail corporativo</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu.nome@empresa.com.br" className="bg-black/50 border-white/10 hover:border-white/20 text-white placeholder:text-white/20 rounded-xl py-6 px-5 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all shadow-inner text-[15px]" required />
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-[10px] uppercase tracking-[0.15em] font-bold text-white/50 block">Senha</Label>
                    <button type="button" onClick={() => setIsForgotOpen(true)} className="text-[10px] font-semibold text-primary/70 hover:text-primary transition-colors tracking-wide">
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pr-12 bg-black/50 border-white/10 hover:border-white/20 text-white placeholder:text-white/20 rounded-xl py-6 px-5 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all shadow-inner text-[15px] tracking-widest" required />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center text-white pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group text-white/50 hover:text-white transition">
                    <div className={`w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all ${rememberMe ? 'bg-primary border-primary shadow-[0_0_10px_rgba(45,212,191,0.3)]' : 'border-white/20 bg-black/40 group-hover:border-white/40'}`}>
                      {rememberMe && <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-[13px] font-medium tracking-wide select-none">Manter conectado</span>
                  </label>
                </div>

                {error && <div className="text-red-300 bg-red-950/40 border border-red-900/50 px-5 py-4 rounded-xl text-[13px] font-medium text-center shadow-inner">{error}</div>}

                <div className="pt-4">
                  <Button type="submit" disabled={login.isPending} className="w-full py-7 text-[13px] uppercase tracking-[0.2em] font-bold text-black rounded-xl bg-gradient-to-r from-primary to-[#1E6146] hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(45,212,191,0.25)] border border-primary/50">
                    {login.isPending ? <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Autenticando...</> : "Entrar no Sistema"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer Inferior */}
        <div className="flex flex-col sm:flex-row items-center justify-between w-full text-[10px] tracking-[0.2em] text-white/30 uppercase font-semibold relative z-10 gap-6 sm:gap-0 mt-8">
          <p>2026 © AmbientIA. Todos os direitos reservados.</p>
          
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-4 bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 text-white rounded-full pl-6 pr-2 py-2 transition-all duration-300 group shadow-lg">
              <span className="font-bold tracking-[0.15em]">Acessar Plataforma</span>
              <div className="w-8 h-8 rounded-full bg-primary text-black flex items-center justify-center group-hover:scale-110 group-hover:bg-white transition-all shadow-[0_0_15px_rgba(45,212,191,0.4)] group-hover:shadow-[0_0_20px_rgba(255,255,255,0.6)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* PAINEL DIREITO: Imagem de Fundo (Apenas Desktop) */}
      <div className="hidden lg:flex lg:w-[55%] relative min-h-screen bg-[#030605] z-0 overflow-hidden items-center justify-center">
        {/* Camada de Imagem com Zoom Sutil */}
        <div 
          className="absolute inset-0 transition-transform duration-[20s] ease-out hover:scale-105" 
          style={{ 
            backgroundImage: `url(${loginBackground})`, 
            backgroundSize: "cover", 
            backgroundPosition: "center", 
            filter: "contrast(1.15) brightness(0.85) saturate(1.1)" 
          }} 
        />
        
        {/* Overlay de gradiente super suave para integrar perfeitamente com o painel esquerdo */}
        <div className="absolute inset-y-0 left-0 w-48 bg-gradient-to-r from-[#030605] via-[#030605]/80 to-transparent z-10" />
        
        {/* Vignette escura nas bordas para dar aspecto premium */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-10 pointer-events-none" />
      </div>

      {/* Modal de Recuperação */}
      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="bg-[#030605] text-white border border-white/10 rounded-2xl shadow-2xl">
          <DialogHeader><DialogTitle className="text-primary font-display tracking-wide text-xl">Recuperar acesso</DialogTitle></DialogHeader>
          <p className="text-sm text-white/50 mb-4 font-light leading-relaxed">Digite seu e-mail corporativo cadastrado para receber as instruções de redefinição de senha.</p>
          <Input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="seu.nome@empresa.com.br" className="bg-black/50 border-white/10 text-white focus-visible:ring-1 focus-visible:ring-primary py-6 rounded-xl" />
          <Button onClick={handleSendResetLink} disabled={isSending} className="w-full mt-6 py-6 text-black font-bold uppercase tracking-widest bg-primary hover:bg-primary/90 rounded-xl">{isSending ? "Enviando instruções..." : "Enviar link de recuperação"}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
