import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, ArrowRight, FolderKanban, ClipboardCheck, BarChart3, Map, Database, FileText, Satellite, Brain, ScanEye, Wifi, LineChart, ShieldCheck, Layers, GraduationCap } from "lucide-react";
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
      toast({ title: "E-mail enviado", description: "Instruções enviadas para seu e-mail." });
      setIsForgotOpen(false);
      setForgotEmail("");
    } catch {
      toast({ title: "Erro", description: "Não foi possível enviar o e-mail.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex bg-black text-white font-sans overflow-hidden">
      
      <style>
        {`
          @keyframes ecoFadeUp {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>

      {/* PAINEL ESQUERDO: TOTALMENTE PRETO */}
      <div className="relative z-20 w-full lg:w-[45%] flex flex-col p-8 sm:p-12 xl:p-16 min-h-screen bg-black overflow-y-auto custom-scrollbar border-r border-white/[0.03]">
        
        {/* Header Superior */}
        <div className="flex items-center justify-between w-full">
          <div className="cursor-pointer" onClick={() => { setActiveTab("inicio"); setShowForm(false); }}>
            {/* Escondendo a logo top-left no mobile se não for necessário, mas mantendo para navegação */}
            <Logo size="sm" />
          </div>

          {!showForm && (
            <nav className="hidden sm:flex items-center gap-8 text-[11px] font-bold text-white/40 tracking-[0.25em] uppercase">
              <button onClick={() => setActiveTab("inicio")} className={`hover:text-white transition-colors duration-300 ${activeTab === "inicio" ? "text-primary" : ""}`}>Início</button>
              <button onClick={() => setActiveTab("sobre")} className={`hover:text-white transition-colors duration-300 ${activeTab === "sobre" ? "text-primary" : ""}`}>Sobre</button>
              <button onClick={() => setActiveTab("contato")} className={`hover:text-white transition-colors duration-300 ${activeTab === "contato" ? "text-primary" : ""}`}>Contato</button>
            </nav>
          )}
        </div>

        {/* Conteúdo Central */}
        <div className="flex-1 flex flex-col justify-center items-center w-full max-w-xl mx-auto relative z-10">
          {!showForm ? (
            <div className="w-full animate-[ecoFadeUp_0.8s_ease-out]">
              {activeTab === "inicio" && (
                <div className="flex flex-col items-center w-full">
                  <div className="mb-8 w-full flex justify-center">
                     <Logo size="xl" />
                  </div>
                  
                  {/* Serviços Grid */}
                  <div className="w-full text-left mt-4 mb-10">
                    <h3 className="text-sm uppercase tracking-widest font-bold text-primary mb-6 text-center">Nossos Serviços</h3>
                    <div className="grid grid-cols-1 gap-3 w-full">
                      
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start hover:bg-white/[0.05] hover:border-primary/30 transition-all group">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
                          <FolderKanban className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">Gestão digital de projetos</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-light">Plataforma para organizar empreendimentos, contratos, demandas, prazos, equipes, entregas e relatórios.</p>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start hover:bg-white/[0.05] hover:border-primary/30 transition-all group">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
                          <ClipboardCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">Gestão de condicionantes e licenças</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-light">Sistema para controlar condicionantes ambientais, vencimentos, evidências, protocolos, status e responsáveis.</p>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start hover:bg-white/[0.05] hover:border-primary/30 transition-all group">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
                          <BarChart3 className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">Dashboards ambientais</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-light">Painéis interativos para acompanhar fauna, flora, qualidade da água, PRAD, resíduos e desempenho.</p>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start hover:bg-white/[0.05] hover:border-primary/30 transition-all group">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
                          <Map className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">WebMaps e geoportais</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-light">Mapas online para visualizar áreas de influência, APP, Reserva Legal, CAR e áreas sensíveis.</p>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start hover:bg-white/[0.05] hover:border-primary/30 transition-all group">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
                          <Database className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">Banco de dados ambientais</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-light">Organização, padronização e validação de dados de fauna, flora, água, solo e socioeconomia.</p>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start hover:bg-white/[0.05] hover:border-primary/30 transition-all group">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">Automação de relatórios técnicos</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-light">Geração automatizada de tabelas, gráficos, mapas, anexos fotográficos e relatórios.</p>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start hover:bg-white/[0.05] hover:border-primary/30 transition-all group">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
                          <Satellite className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">Sensoriamento remoto</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-light">Mapeamento de desmatamento, regeneração, áreas degradadas e mudanças por imagens de satélite.</p>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start hover:bg-white/[0.05] hover:border-primary/30 transition-all group">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
                          <Brain className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">IA para consultoria ambiental</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-light">Modelos preditivos para risco ambiental, ocorrência de espécies e apoio à decisão.</p>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start hover:bg-white/[0.05] hover:border-primary/30 transition-all group">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
                          <ScanEye className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">Visão computacional</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-light">Análise automática de imagens de drones e câmeras trap para detectar fauna e vegetação.</p>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start hover:bg-white/[0.05] hover:border-primary/30 transition-all group">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
                          <Wifi className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">IoT e sensores ambientais</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-light">Integração de sensores de qualidade da água, clima e ruído com dashboards em tempo real.</p>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start hover:bg-white/[0.05] hover:border-primary/30 transition-all group">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
                          <LineChart className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">Bioestatística e modelagem</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-light">Análises estatísticas para biodiversidade, monitoramento e composição de espécies.</p>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start hover:bg-white/[0.05] hover:border-primary/30 transition-all group">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">ESG, compliance e auditoria</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-light">Indicadores ambientais, matriz de riscos e relatórios de desempenho socioambiental.</p>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start hover:bg-white/[0.05] hover:border-primary/30 transition-all group">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">Gêmeos digitais ambientais</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-light">Simulação de cenários ambientais em bacias, reservatórios e áreas de influência.</p>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start hover:bg-white/[0.05] hover:border-primary/30 transition-all group">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">Treinamentos corporativos</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-light">Cursos para equipes de consultoria em IA ambiental, dashboards, GIS e automação.</p>
                        </div>
                      </div>

                    </div>
                  </div>
                  
                  <button onClick={() => setShowForm(true)} className="flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full pl-8 pr-2 py-2 transition-all duration-300 group mt-4">
                    <span className="font-semibold tracking-[0.15em] text-xs uppercase">Acessar Sistema</span>
                    <div className="w-10 h-10 rounded-full bg-primary text-black flex items-center justify-center group-hover:bg-white transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>
                </div>
              )}

              {activeTab === "sobre" && (
                <div className="flex flex-col items-start w-full">
                  <h2 className="text-3xl font-bold font-display text-white mb-6">Sobre a AmbientIA</h2>
                  <div className="space-y-6 text-white/60 text-[15px] leading-relaxed font-light">
                    <p>A AmbientIA Inteligência Ambiental é uma empresa de tecnologia aplicada ao setor ambiental, dedicada a apoiar organizações que atuam com gestão e conformidade.</p>
                    <p>Conectamos inovação, sustentabilidade e alta performance, posicionando-nos como parceiros estratégicos para a transformação digital do setor ambiental.</p>
                  </div>
                  <button onClick={() => setActiveTab("inicio")} className="mt-10 text-xs text-primary font-semibold uppercase tracking-widest hover:text-white transition">← Voltar</button>
                </div>
              )}

              {activeTab === "contato" && (
                <div className="flex flex-col items-start w-full">
                  <h2 className="text-3xl font-bold font-display text-white mb-6">Fale Conosco</h2>
                  <div className="w-full space-y-4">
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                      <p className="text-[10px] uppercase text-primary font-bold mb-2 tracking-widest">Comercial</p>
                      <p className="text-sm text-white/90">comercial@ambientia.com.br</p>
                    </div>
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                      <p className="text-[10px] uppercase text-primary font-bold mb-2 tracking-widest">WhatsApp</p>
                      <p className="text-sm text-white/90">(71) 3003-8080</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("inicio")} className="mt-10 text-xs text-primary font-semibold uppercase tracking-widest hover:text-white transition">← Voltar</button>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full animate-[ecoFadeUp_0.5s_ease-out]">
              <div className="mb-10 text-center flex flex-col items-center">
                <Logo size="lg" className="mb-8" />
                <h2 className="text-2xl font-bold tracking-tight text-white font-display mb-2">Acesso Restrito</h2>
                <p className="text-xs text-white/50 font-light">Bem-vindo de volta. Insira suas credenciais.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 w-full">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] uppercase tracking-widest font-bold text-white/50">E-mail corporativo</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@empresa.com.br" className="bg-white/[0.03] border-white/10 hover:border-white/20 text-white rounded-xl py-6 px-5 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all text-sm" required />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-[10px] uppercase tracking-widest font-bold text-white/50">Senha</Label>
                    <button type="button" onClick={() => setIsForgotOpen(true)} className="text-[10px] font-semibold text-primary/70 hover:text-primary transition-colors">
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pr-12 bg-white/[0.03] border-white/10 hover:border-white/20 text-white rounded-xl py-6 px-5 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all text-sm tracking-widest" required />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group text-white/50 hover:text-white transition">
                    <div className={`w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all ${rememberMe ? 'bg-primary border-primary' : 'border-white/20 bg-transparent group-hover:border-white/40'}`}>
                      {rememberMe && <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-[12px] font-medium tracking-wide">Manter conectado</span>
                  </label>
                </div>

                {error && <div className="text-red-300 bg-red-950/40 border border-red-900/50 p-4 rounded-xl text-xs text-center">{error}</div>}

                <div className="pt-4">
                  <Button type="submit" disabled={login.isPending} className="w-full py-6 text-xs uppercase tracking-[0.2em] font-bold text-black rounded-xl bg-primary hover:bg-primary/90 transition-all">
                    {login.isPending ? <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Autenticando...</> : "Entrar"}
                  </Button>
                </div>
                
                <div className="text-center pt-4">
                  <button type="button" onClick={() => setShowForm(false)} className="text-[10px] text-white/30 uppercase tracking-widest font-bold hover:text-white transition">
                    ← Voltar à Apresentação
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer Inferior */}
        <div className="w-full text-center sm:text-left text-[10px] tracking-[0.2em] text-white/20 uppercase font-semibold relative z-10 mt-8">
          <p>2026 © AmbientIA. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* PAINEL DIREITO: Imagem com Gradiente Perfeito */}
      <div className="hidden lg:flex lg:w-[55%] relative min-h-screen bg-black z-0 overflow-hidden">
        {/* Camada de Imagem */}
        <div 
          className="absolute inset-0 transition-transform duration-[30s] ease-out hover:scale-105" 
          style={{ 
            backgroundImage: `url(${loginBackground})`, 
            backgroundSize: "cover", 
            backgroundPosition: "center", 
            filter: "contrast(1.1) brightness(0.8) saturate(1.1)" 
          }} 
        />
        
        {/* Gradiente Esquerdo Suave (Mistura a Imagem com o Fundo Preto do Painel Esquerdo) */}
        <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-black via-black/80 to-transparent z-10" />
        
        {/* Gradiente Inferior e Superior para Enquadramento (Vignette elegante) */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent z-10" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent z-10" />
      </div>

      {/* Modal de Recuperação */}
      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="bg-black text-white border border-white/10 rounded-2xl">
          <DialogHeader><DialogTitle className="text-primary font-display">Recuperar acesso</DialogTitle></DialogHeader>
          <p className="text-sm text-white/50 mb-4 font-light">Digite seu e-mail corporativo cadastrado.</p>
          <Input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="seu@empresa.com.br" className="bg-white/5 border-white/10 text-white focus-visible:ring-1 focus-visible:ring-primary py-6 rounded-xl" />
          <Button onClick={handleSendResetLink} disabled={isSending} className="w-full mt-6 py-6 text-black font-bold uppercase tracking-widest bg-primary hover:bg-primary/90 rounded-xl">{isSending ? "Enviando..." : "Enviar link"}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
