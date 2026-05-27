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
    <div className="relative min-h-screen w-full flex bg-[#000000] text-white font-sans overflow-hidden">
      
      <style>
        {`
          @keyframes ecoFadeUp {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes bgZoom {
            0% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
        `}
      </style>

      {/* PAINEL ESQUERDO: Conteúdo Principal e Formulário */}
      <div className="relative z-20 w-full lg:w-1/2 flex flex-col justify-between p-8 sm:p-12 xl:p-16 min-h-screen bg-[#000000] overflow-y-auto custom-scrollbar">
        
        {/* Header Superior */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-6 sm:gap-0">
          <div className="cursor-pointer transition-transform hover:scale-105" onClick={() => { setActiveTab("inicio"); setShowForm(false); }}>
            <Logo size="sm" />
          </div>

          {!showForm ? (
            <nav className="flex flex-wrap items-center gap-4 sm:gap-6 text-[11px] font-bold text-white/50 tracking-[0.2em] uppercase font-condensed">
              <button type="button" onClick={() => { setActiveTab("inicio"); setShowForm(false); }} className={`hover:text-white transition uppercase ${activeTab === "inicio" ? "text-primary font-bold" : ""}`}>Início</button>
              <button type="button" onClick={() => { setActiveTab("sobre"); setShowForm(false); }} className={`hover:text-white transition uppercase ${activeTab === "sobre" ? "text-primary font-bold" : ""}`}>Sobre</button>
              <button type="button" onClick={() => { setActiveTab("contato"); setShowForm(false); }} className={`hover:text-white transition uppercase ${activeTab === "contato" ? "text-primary font-bold" : ""}`}>Contato</button>
            </nav>
          ) : (
            <button type="button" onClick={() => setShowForm(false)} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="uppercase tracking-widest font-bold text-[10px]">Voltar</span>
            </button>
          )}
        </div>

        {/* Conteúdo Central do Painel */}
        <div className="flex-1 flex flex-col justify-center items-center w-full max-w-md mx-auto my-12">
          {!showForm ? (
            <>
              {activeTab === "inicio" && (
                <div className="flex flex-col items-center text-center animate-[ecoFadeUp_0.8s_ease-out]">
                  <Logo size="xl" />
                  <p className="mt-8 text-white/50 text-sm font-light leading-relaxed">
                    A 1ª Consultoria Ambiental do Brasil exclusivamente dedicada a soluções ambientais com Inteligência Artificial.
                  </p>
                </div>
              )}

              {activeTab === "sobre" && (
                <div className="animate-[ecoFadeUp_0.4s_ease-out] w-full space-y-6">
                  <h2 className="text-3xl font-bold font-display text-primary">Sobre a AmbientIA</h2>
                  <div className="space-y-4 text-white/70 text-sm leading-relaxed font-light">
                    <p>
                      A <strong>AmbientIA Inteligência Ambiental</strong> é uma empresa de tecnologia e inteligência de dados aplicada ao setor ambiental, dedicada ao desenvolvimento de soluções digitais para apoiar organizações que atuam com gestão, licenciamento, monitoramento e conformidade ambiental.
                    </p>
                    <p>
                      Mais do que uma fornecedora de tecnologia, a AmbientIA posiciona-se como uma parceira estratégica para a evolução digital do setor ambiental, conectando inovação, sustentabilidade e desempenho institucional.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "contato" && (
                <div className="animate-[ecoFadeUp_0.4s_ease-out] w-full space-y-6">
                  <h2 className="text-3xl font-bold font-display text-primary">Fale Conosco</h2>
                  <div className="space-y-4 text-white/70 text-sm font-light">
                    <p className="leading-relaxed">Entre em contato através dos nossos canais:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <p className="text-[10px] uppercase text-primary font-bold mb-1">E-mail Comercial</p>
                        <p className="text-xs text-white/90">comercial@ambientia.com.br</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <p className="text-[10px] uppercase text-primary font-bold mb-1">Telefone / WhatsApp</p>
                        <p className="text-xs text-white/90">(71) 3003-8080</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full animate-[ecoFadeUp_0.5s_ease-out]">
              <div className="text-center space-y-2 mb-8">
                <div className="flex justify-center mb-6">
                   <Logo size="lg" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white font-display">Acesse o Sistema</h2>
                <p className="text-xs text-white/50">Insira suas credenciais para gerenciar seus projetos.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] uppercase tracking-wider font-semibold text-white/50 mb-1 block">E-mail corporativo</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com.br" className="bg-white/5 border-white/10 hover:border-white/20 text-white placeholder:text-neutral-500 rounded-xl py-6 px-4 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all shadow-inner" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[10px] uppercase tracking-wider font-semibold text-white/50 mb-1 block">Senha</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pr-11 bg-white/5 border-white/10 hover:border-white/20 text-white placeholder:text-neutral-500 rounded-xl py-6 px-4 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all shadow-inner" required />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-3.5 text-white/40 hover:text-white transition">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-white">
                  <label className="flex items-center gap-2 cursor-pointer group text-white/60 hover:text-white transition">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${rememberMe ? 'bg-primary border-primary' : 'border-white/20 bg-transparent group-hover:border-white/40'}`}>
                      {rememberMe && <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-xs font-medium tracking-wide select-none">Lembrar de mim</span>
                  </label>
                  <button type="button" onClick={() => setIsForgotOpen(true)} className="text-[11px] font-semibold text-white/50 hover:text-white transition">
                    Esqueci minha senha
                  </button>
                </div>

                {error && <div className="text-red-300 bg-red-950/50 border border-red-900/50 px-4 py-3 rounded-lg text-xs font-medium text-center">{error}</div>}

                <Button type="submit" disabled={login.isPending} className="w-full py-6 text-xs uppercase tracking-widest font-bold text-black rounded-xl bg-primary hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(45,212,191,0.2)]">
                  {login.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</> : "Entrar no Sistema"}
                </Button>
              </form>
            </div>
          )}
        </div>

        {/* Footer Inferior */}
        <div className="flex flex-col sm:flex-row items-center justify-between w-full text-[10px] tracking-wider text-white/30 uppercase font-semibold">
          <p className="mb-4 sm:mb-0">2026 © AmbientIA. Todos os direitos.</p>
          
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-3 bg-white/10 hover:bg-white/20 text-white rounded-full pl-5 pr-1.5 py-1.5 transition-all group">
              <span>Acessar Plataforma</span>
              <div className="w-6 h-6 rounded-full bg-primary text-black flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* PAINEL DIREITO: Imagem de Fundo (Apenas Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative min-h-screen bg-[#060D0B] z-0 overflow-hidden">
        <div className="absolute inset-0 animate-[bgZoom_15s_cubic-bezier(0.1,1,0.1,1)_forwards]" style={{ backgroundImage: `url(${loginBackground})`, backgroundSize: "cover", backgroundPosition: "center", filter: "contrast(1.1) brightness(0.7) saturate(1.1)" }}>
          {/* Degrade suave na borda para mesclar com o preto da esquerda */}
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#000000] to-transparent z-10" />
        </div>
      </div>

      {/* Modal de Recuperação */}
      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="bg-[#0A0A0A] text-white border border-white/10 rounded-2xl">
          <DialogHeader><DialogTitle className="text-primary font-display tracking-wide">Recuperar senha</DialogTitle></DialogHeader>
          <p className="text-xs text-white/50 mb-2">Digite seu e-mail para receber o link de redefinição.</p>
          <Input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="seu@email.com.br" className="bg-white/5 border-white/10 text-white focus-visible:ring-1 focus-visible:ring-primary" />
          <Button onClick={handleSendResetLink} disabled={isSending} className="w-full mt-4 text-black bg-primary hover:bg-primary/90">{isSending ? "Enviando..." : "Enviar link"}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
