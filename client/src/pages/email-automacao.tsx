import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Mail, Plus, RefreshCw, Trash2, Settings, Eye, EyeOff, CheckCircle, CheckCircle2,
  AlertTriangle, AlertCircle, Wifi,
  Clock, Building2, User, FileText, Loader2, ChevronRight, BarChart3,
  Shield, Link2, Zap, Search, Filter, TrendingUp, Inbox, Send,
  Calendar, XCircle, Edit2, Save, ExternalLink, Bot, Tag,
} from "lucide-react";

interface EmailConta {
  id: number; nome: string; email: string; host: string; port: number;
  secure: boolean; ativo: boolean; ultimaSincEm?: string; totalEmails: number; criadoEm: string;
}

interface EmailCapturado {
  id: number; contaId?: number; messageId?: string; dataRecebimento?: string;
  remetente?: string; remetenteOrg?: string; destinatarios?: string[];
  assunto?: string; resumo?: string; corpo?: string;
  categoriaPrincipal?: string; subcategoria?: string;
  tipoDemanda?: string; descricaoDemanda?: string;
  prioridade?: string; nivelRisco?: string; statusDemanda?: string;
  empreendimentoId?: number; empreendimentoNome?: string;
  clienteVinculado?: string; contratoVinculado?: string;
  programaAmbiental?: string; condicionante?: string; numeroProcesso?: string;
  responsavelSugerido?: string; responsavelExterno?: string;
  prazoIdentificado?: string; dataVencimento?: string;
  anexos?: { nome: string; tamanho?: number; tipo?: string }[];
  evidenciaCumprimento?: boolean; nivelConfianca?: number;
  precisaValidacao?: boolean; vinculoPendente?: boolean;
  sugestoesVinculo?: { id: number; nome: string; confianca: number }[];
  observacoesIA?: string; demandaCriadaId?: number;
  validadoPor?: number; validadoEm?: string; validacaoObservacoes?: string;
  criadoEm: string;
}

interface Stats {
  total: number; precisamValidacao: number; vinculoPendente: number;
  altaPrioridade: number; altoRisco: number; demandasCriadas: number;
  porCategoria: { categoria: string; total: number }[];
}

const PRIORIDADE_COLOR: Record<string, string> = {
  alta: "bg-red-100 text-red-800 border-red-300",
  media: "bg-amber-100 text-amber-800 border-amber-300",
  baixa: "bg-green-100 text-green-800 border-green-300",
};
const RISCO_COLOR: Record<string, string> = {
  alto: "bg-red-100 text-red-800", medio: "bg-amber-100 text-amber-800", baixo: "bg-green-100 text-green-800",
};
const STATUS_COLOR: Record<string, string> = {
  pendente: "bg-slate-100 text-slate-700",
  em_andamento: "bg-blue-100 text-blue-800",
  concluida: "bg-green-100 text-green-800",
  aprovada: "bg-emerald-100 text-emerald-800",
  aguardando_validacao: "bg-purple-100 text-purple-800",
  enviada_ao_cliente: "bg-cyan-100 text-cyan-800",
};

function fmtDate(d?: string) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return "—"; }
}
function fmtSize(b?: number) {
  if (!b) return "";
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / 1048576).toFixed(1)}MB`;
}

// ─── Modal Cadastro de Conta ──────────────────────────────────────────────────
function SenhaInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        noNormalize
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-9"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(v => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function ContaModal({ conta, onClose, onSave }: { conta?: EmailConta; onClose: () => void; onSave: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const HOSTS = [
    {
      label: "Gmail", host: "imap.gmail.com", port: 993, secure: true,
      dica: <><strong>Gmail:</strong> Ative o acesso IMAP em <em>Configurações → Encaminhamento e POP/IMAP</em>. Use uma <em>Senha de App</em> (não a senha normal) se tiver verificação em 2 etapas ativada.</>,
    },
    {
      label: "Outlook/Hotmail", host: "outlook.office365.com", port: 993, secure: true,
      dica: <><strong>Outlook/Hotmail:</strong> Certifique-se de que o IMAP está habilitado em <em>Configurações → Email → Sincronização</em>. Use sua senha normal ou senha de app se MFA estiver ativo.</>,
    },
    {
      label: "Yahoo", host: "imap.mail.yahoo.com", port: 993, secure: true,
      dica: <><strong>Yahoo:</strong> Ative o acesso de apps em <em>Segurança da Conta → Gerar senha de app</em>. Use a senha de app gerada, não a senha da conta.</>,
    },
    {
      label: "Locaweb", host: "email-ssl.com.br", port: 993, secure: true,
      dica: <><strong>Locaweb (Webmail):</strong> Use o e-mail completo e senha do Webmail. Servidor: <code className="bg-amber-100 px-1 rounded">email-ssl.com.br</code>, porta 993, SSL/TLS ativado. O usuário deve ser o endereço de e-mail completo.</>,
    },
    {
      label: "Personalizado", host: "__custom__", port: 993, secure: true,
      dica: <><strong>Personalizado:</strong> Informe o servidor IMAP do seu provedor de e-mail. Geralmente disponível no painel de suporte ou configurações avançadas da sua conta.</>,
    },
  ] as const;

  const detectProvider = (host: string) =>
    HOSTS.find(h => h.host !== "__custom__" && h.host === host)?.label || "Personalizado";

  const [selectedProvider, setSelectedProvider] = useState<string>(() => detectProvider(conta?.host || "imap.gmail.com"));

  const [form, setForm] = useState({
    nome: (conta?.nome || "").toLowerCase(),
    email: (conta?.email || "").toLowerCase(),
    host: (conta?.host || "imap.gmail.com").toLowerCase(),
    port: conta?.port || 993,
    secure: conta?.secure !== false,
    usuario: (conta?.usuario || conta?.email || "").toLowerCase(),
    senha: "",
    ativo: conta?.ativo !== false,
  });

  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; raw?: string } | null>(null);

  async function handleTestarCredenciais() {
    if (!form.host || !form.usuario || !form.senha) {
      setTestResult({ ok: false, msg: "Preencha host, usuário e senha antes de testar." });
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/email-automacao/testar-credenciais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ host: form.host, port: form.port, secure: form.secure, usuario: form.usuario, senha: form.senha }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { success: false, error: text.slice(0, 200) || `Erro ${res.status}` }; }
      if (data.success) {
        setTestResult({ ok: true, msg: `✓ Conexão bem-sucedida com ${form.host}:${form.port}` });
      } else {
        setTestResult({ ok: false, msg: data.error || "Falha na conexão", raw: data.rawError || undefined });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message || "Erro de rede" });
    } finally {
      setTestLoading(false);
    }
  }

  const currentDica = HOSTS.find(h => h.label === selectedProvider)?.dica || HOSTS[0].dica;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const method = conta ? "PUT" : "POST";
      const url = conta ? `/api/email-automacao/contas/${conta.id}` : "/api/email-automacao/contas";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, senha: form.senha || undefined }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { throw new Error(text.slice(0, 200) || `Erro ${res.status}`); }
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      return data;
    },
    onSuccess: () => {
      toast({ title: conta ? "Conta atualizada!" : "Conta cadastrada!" });
      qc.invalidateQueries({ queryKey: ["/api/email-automacao/contas"] });
      onSave();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            {conta ? "Editar Conta" : "Cadastrar Conta de E-mail"}
          </DialogTitle>
          <DialogDescription>Configure as credenciais IMAP para monitoramento automático.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Provedor</Label>
              <div className="flex gap-1.5 flex-wrap">
                {HOSTS.map(h => (
                  <button key={h.label} type="button"
                    onClick={() => {
                      setSelectedProvider(h.label);
                      setForm(f => ({
                        ...f,
                        host: h.host === "__custom__" ? "" : h.host,
                        port: h.port,
                        secure: h.secure,
                      }));
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors font-medium ${
                      selectedProvider === h.label
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                    }`}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nome da Conta *</Label>
              <Input noNormalize value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value.toLowerCase() }))} placeholder="Ex: institucional ecobrasil" />
            </div>
            <div className="space-y-1">
              <Label>E-mail *</Label>
              <Input noNormalize type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value.toLowerCase(), usuario: e.target.value.toLowerCase() }))} />
            </div>
            <div className="space-y-1">
              <Label>Servidor IMAP *</Label>
              <Input
                noNormalize
                value={form.host}
                onChange={e => { setForm(f => ({ ...f, host: e.target.value.toLowerCase() })); setSelectedProvider("Personalizado"); }}
                placeholder={selectedProvider === "Personalizado" ? "ex: mail.seudominio.com.br" : ""}
                readOnly={selectedProvider !== "Personalizado"}
                className={selectedProvider !== "Personalizado" ? "bg-slate-50 text-slate-500" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label>Porta</Label>
              <Input type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: parseInt(e.target.value) || 993 }))} />
            </div>
            <div className="space-y-1">
              <Label>Usuário IMAP</Label>
              <Input noNormalize value={form.usuario} onChange={e => setForm(f => ({ ...f, usuario: e.target.value.toLowerCase() }))} placeholder="geralmente o próprio e-mail" />
            </div>
            <div className="space-y-1">
              <Label>{conta ? "Senha (em branco = manter)" : "Senha / Senha de App *"}</Label>
              <SenhaInput value={form.senha} onChange={v => setForm(f => ({ ...f, senha: v }))} placeholder={conta ? "••••••••" : "senha ou senha de aplicativo"} />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <Switch checked={form.secure} onCheckedChange={v => setForm(f => ({ ...f, secure: v }))} />
              <Label>Conexão segura (SSL/TLS)</Label>
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} className="ml-4" />
              <Label>Conta ativa</Label>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-xs text-amber-800 leading-relaxed">
            {currentDica}
          </div>

          {/* Resultado do teste de conexão */}
          {testResult && (
            <div className={`rounded p-2.5 text-xs flex items-start gap-2 ${testResult.ok ? "bg-green-50 border border-green-300 text-green-800" : "bg-red-50 border border-red-300 text-red-800"}`}>
              {testResult.ok
                ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-600" />
                : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-600" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium">{testResult.msg}</p>
                {testResult.raw && (
                  <p className="mt-1 font-mono text-[10px] opacity-70 break-all">{testResult.raw}</p>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="outline" onClick={handleTestarCredenciais} disabled={testLoading || !form.host || !form.usuario || !form.senha} className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50">
            {testLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Testando...</> : <><Wifi className="w-3.5 h-3.5" />Testar Conexão</>}
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.nome || !form.email || !form.host || (!conta && !form.senha)}>
            {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : <><Save className="w-4 h-4 mr-2" />Salvar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal Detalhe de E-mail ──────────────────────────────────────────────────
function EmailDetalhe({ email, onClose, onUpdated }: { email: EmailCapturado; onClose: () => void; onUpdated: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    empreendimentoNome: email.empreendimentoNome || "",
    statusDemanda: email.statusDemanda || "pendente",
    prioridade: email.prioridade || "media",
    responsavelSugerido: email.responsavelSugerido || "",
    validacaoObservacoes: email.validacaoObservacoes || "",
    precisaValidacao: email.precisaValidacao || false,
    vinculoPendente: email.vinculoPendente || false,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/email-automacao/emails/${email.id}`, form);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "E-mail atualizado!" });
      qc.invalidateQueries({ queryKey: ["/api/email-automacao/emails"] });
      qc.invalidateQueries({ queryKey: ["/api/email-automacao/stats"] });
      setEditando(false);
      onUpdated();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const conf = email.nivelConfianca ? Math.round(email.nivelConfianca * 100) : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <span className="truncate text-base">{email.assunto || "(sem assunto)"}</span>
          </DialogTitle>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {email.categoriaPrincipal && <Badge variant="outline" className="text-xs">{email.categoriaPrincipal}</Badge>}
            {email.prioridade && <Badge className={`text-xs border ${PRIORIDADE_COLOR[email.prioridade] || ""}`}>{email.prioridade}</Badge>}
            {email.nivelRisco && <Badge className={`text-xs ${RISCO_COLOR[email.nivelRisco] || ""}`}>Risco {email.nivelRisco}</Badge>}
            {email.statusDemanda && <Badge className={`text-xs ${STATUS_COLOR[email.statusDemanda] || ""}`}>{email.statusDemanda?.replace(/_/g, " ")}</Badge>}
            {email.precisaValidacao && <Badge className="text-xs bg-purple-100 text-purple-800">⚠ Validar</Badge>}
            {email.vinculoPendente && <Badge className="text-xs bg-orange-100 text-orange-800">🔗 Vínculo pendente</Badge>}
            {email.demandaCriadaId && <Badge className="text-xs bg-emerald-100 text-emerald-800">✓ Demanda #{email.demandaCriadaId}</Badge>}
          </div>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Cabeçalho do e-mail */}
          <div className="bg-slate-50 rounded-lg p-3 space-y-1 border">
            <p><span className="text-muted-foreground w-24 inline-block">De:</span> <strong>{email.remetente}</strong>{email.remetenteOrg ? ` · ${email.remetenteOrg}` : ""}</p>
            {email.destinatarios?.length ? <p><span className="text-muted-foreground w-24 inline-block">Para:</span> {email.destinatarios.join(", ")}</p> : null}
            <p><span className="text-muted-foreground w-24 inline-block">Recebido:</span> {fmtDate(email.dataRecebimento)}</p>
            {conf !== null && <p><span className="text-muted-foreground w-24 inline-block">Confiança IA:</span> <span className={conf >= 70 ? "text-green-700 font-medium" : conf >= 40 ? "text-amber-700" : "text-red-700"}>{conf}%</span></p>}
          </div>

          {/* Resumo IA */}
          {email.resumo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1"><Bot className="w-3.5 h-3.5" /> Resumo gerado por IA</p>
              <p className="text-slate-700">{email.resumo}</p>
            </div>
          )}

          {/* Vínculos identificados */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {email.empreendimentoNome && <div className="flex items-center gap-1.5 bg-emerald-50 rounded p-2 border border-emerald-200"><Building2 className="w-3.5 h-3.5 text-emerald-600" /><span><strong>Empreendimento:</strong> {email.empreendimentoNome}</span></div>}
            {email.clienteVinculado && <div className="flex items-center gap-1.5 bg-blue-50 rounded p-2 border border-blue-200"><User className="w-3.5 h-3.5 text-blue-600" /><span><strong>Cliente:</strong> {email.clienteVinculado}</span></div>}
            {email.contratoVinculado && <div className="flex items-center gap-1.5 bg-slate-50 rounded p-2 border"><FileText className="w-3.5 h-3.5 text-slate-600" /><span><strong>Contrato:</strong> {email.contratoVinculado}</span></div>}
            {email.numeroProcesso && <div className="flex items-center gap-1.5 bg-slate-50 rounded p-2 border"><Tag className="w-3.5 h-3.5 text-slate-600" /><span><strong>Processo:</strong> {email.numeroProcesso}</span></div>}
            {email.programaAmbiental && <div className="flex items-center gap-1.5 bg-green-50 rounded p-2 border border-green-200"><FileText className="w-3.5 h-3.5 text-green-600" /><span><strong>Programa:</strong> {email.programaAmbiental}</span></div>}
            {email.condicionante && <div className="flex items-center gap-1.5 bg-amber-50 rounded p-2 border border-amber-200"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /><span><strong>Condicionante:</strong> {email.condicionante}</span></div>}
            {email.responsavelSugerido && <div className="flex items-center gap-1.5 bg-violet-50 rounded p-2 border border-violet-200"><User className="w-3.5 h-3.5 text-violet-600" /><span><strong>Responsável:</strong> {email.responsavelSugerido}</span></div>}
            {email.prazoIdentificado && <div className="flex items-center gap-1.5 bg-rose-50 rounded p-2 border border-rose-200"><Calendar className="w-3.5 h-3.5 text-rose-600" /><span><strong>Prazo:</strong> {email.prazoIdentificado}</span></div>}
          </div>

          {/* Sugestões de vínculo */}
          {email.sugestoesVinculo?.length ? (
            <div className="border rounded-lg p-3 bg-orange-50 border-orange-200">
              <p className="text-xs font-semibold text-orange-700 mb-2">Sugestões de vínculo (vínculo pendente de validação)</p>
              <div className="space-y-1">
                {email.sugestoesVinculo.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-white rounded p-1.5 border">
                    <span>{s.nome}</span>
                    <Badge variant="outline" className={`text-[10px] ${s.confianca >= 0.7 ? "border-green-500 text-green-700" : "border-amber-500 text-amber-700"}`}>{Math.round(s.confianca * 100)}%</Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Anexos */}
          {email.anexos?.length ? (
            <div className="border rounded-lg p-3">
              <p className="text-xs font-semibold mb-2">Anexos ({email.anexos.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {email.anexos.map((a, i) => (
                  <div key={i} className="flex items-center gap-1 bg-slate-100 rounded px-2 py-1 text-xs border">
                    <FileText className="w-3 h-3" /> {a.nome}{a.tamanho ? ` (${fmtSize(a.tamanho)})` : ""}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Observações IA */}
          {email.observacoesIA && (
            <div className="bg-slate-50 rounded-lg p-3 border text-xs text-slate-600">
              <strong className="block mb-1">Observações da IA:</strong>{email.observacoesIA}
            </div>
          )}

          {/* Corpo do e-mail */}
          {email.corpo && (
            <details className="border rounded-lg">
              <summary className="px-3 py-2 cursor-pointer text-xs font-medium text-muted-foreground hover:bg-slate-50 select-none">Ver corpo completo do e-mail</summary>
              <div className="px-3 pb-3 text-xs text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto">{email.corpo}</div>
            </details>
          )}

          {/* Edição / Validação */}
          {editando ? (
            <div className="border-2 border-blue-200 rounded-lg p-3 space-y-2.5 bg-blue-50/50">
              <p className="text-xs font-semibold text-blue-700">Validação manual</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Empreendimento</Label>
                  <Input className="h-7 text-xs" value={form.empreendimentoNome} onChange={e => setForm(f => ({ ...f, empreendimentoNome: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Responsável sugerido</Label>
                  <Input className="h-7 text-xs" value={form.responsavelSugerido} onChange={e => setForm(f => ({ ...f, responsavelSugerido: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={form.statusDemanda} onValueChange={v => setForm(f => ({ ...f, statusDemanda: v }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pendente","em_andamento","concluida","aprovada","aguardando_validacao","enviada_ao_cliente"].map(s => (
                        <SelectItem key={s} value={s} className="text-xs">{s.replace(/_/g," ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alta" className="text-xs">Alta</SelectItem>
                      <SelectItem value="media" className="text-xs">Média</SelectItem>
                      <SelectItem value="baixa" className="text-xs">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Observações de validação</Label>
                  <Textarea className="text-xs h-16 resize-none" value={form.validacaoObservacoes} onChange={e => setForm(f => ({ ...f, validacaoObservacoes: e.target.value }))} />
                </div>
                <div className="col-span-2 flex gap-4 text-xs">
                  <label className="flex items-center gap-1.5"><Switch checked={!form.precisaValidacao} onCheckedChange={v => setForm(f => ({ ...f, precisaValidacao: !v }))} className="scale-75" /><span>Validado</span></label>
                  <label className="flex items-center gap-1.5"><Switch checked={!form.vinculoPendente} onCheckedChange={v => setForm(f => ({ ...f, vinculoPendente: !v }))} className="scale-75" /><span>Vínculo confirmado</span></label>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditando(false)}>Cancelar</Button>
                <Button size="sm" className="h-7 text-xs" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Salvando...</> : <><CheckCircle className="w-3 h-3 mr-1" />Confirmar</>}
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full text-xs gap-1.5" onClick={() => setEditando(true)}>
              <Edit2 className="w-3.5 h-3.5" /> Validar / Corrigir classificação
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function EmailAutomacao() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("painel");
  const [showContaModal, setShowContaModal] = useState(false);
  const [editingConta, setEditingConta] = useState<EmailConta | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailCapturado | null>(null);
  const [busca, setBusca] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("todas");
  const [filterPrioridade, setFilterPrioridade] = useState("todas");
  const [filterValidacao, setFilterValidacao] = useState("todas");
  const [filterVinculo, setFilterVinculo] = useState("todas");
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncErrors, setSyncErrors] = useState<{ email: string; erro: string; rawError?: string }[]>([]);

  const { data: contas = [], isLoading: contasLoading } = useQuery<EmailConta[]>({
    queryKey: ["/api/email-automacao/contas"],
    queryFn: async () => { const r = await fetch("/api/email-automacao/contas", { credentials: "include" }); return r.ok ? r.json() : []; },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/email-automacao/stats"],
    queryFn: async () => { const r = await fetch("/api/email-automacao/stats", { credentials: "include" }); return r.ok ? r.json() : {}; },
  });

  const { data: emails = [], isLoading: emailsLoading, refetch: refetchEmails } = useQuery<EmailCapturado[]>({
    queryKey: ["/api/email-automacao/emails", filterCategoria, filterPrioridade, filterValidacao, filterVinculo, busca],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (filterCategoria !== "todas") p.set("categoria", filterCategoria);
      if (filterPrioridade !== "todas") p.set("prioridade", filterPrioridade);
      if (filterValidacao !== "todas") p.set("validacao", filterValidacao);
      if (filterVinculo !== "todas") p.set("vinculo", filterVinculo);
      if (busca) p.set("busca", busca);
      p.set("limit", "100");
      const r = await fetch(`/api/email-automacao/emails?${p}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/email-automacao/contas/${id}`, {});
      if (!res.ok) throw new Error("Erro ao remover");
    },
    onSuccess: () => {
      toast({ title: "Conta removida" });
      qc.invalidateQueries({ queryKey: ["/api/email-automacao/contas"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  async function testarConexao(id: number) {
    setTestingId(id);
    try {
      const res = await fetch(`/api/email-automacao/contas/${id}/testar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "✓ Conexão bem-sucedida!", description: data.message });
      } else {
        if (data.detalhe) console.warn("[IMAP Testar] Resposta raw do servidor:\n" + data.detalhe);
        toast({
          title: "Falha na conexão",
          description: data.error || "Command failed",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Erro ao testar", description: e.message, variant: "destructive" });
    } finally { setTestingId(null); }
  }

  async function sincronizarConta(id: number, email: string) {
    setSyncingId(id);
    try {
      const res = await apiRequest("POST", `/api/email-automacao/contas/${id}/sincronizar`, {});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na sincronização");
      if (data.capturados === 0) {
        toast({ title: "Sincronização concluída", description: `Nenhum e-mail novo encontrado em ${email}. Os e-mails já existentes não são duplicados.` });
      } else {
        toast({ title: "✓ Sincronização concluída", description: `${data.capturados} novo(s) e-mail(s) capturado(s) de ${email}` });
      }
      qc.invalidateQueries({ queryKey: ["/api/email-automacao/contas"] });
      qc.invalidateQueries({ queryKey: ["/api/email-automacao/emails"] });
      qc.invalidateQueries({ queryKey: ["/api/email-automacao/stats"] });
    } catch (e: any) {
      toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" });
    } finally { setSyncingId(null); }
  }

  async function sincronizarTodas() {
    setSyncingAll(true);
    setSyncErrors([]);
    try {
      const res = await apiRequest("POST", "/api/email-automacao/sincronizar-todas", {});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.errosContas?.length) {
        setSyncErrors(data.errosContas);
        toast({
          title: `Sync parcial: ${data.capturados} e-mail(s)`,
          description: `${data.errosContas.length} conta(s) com erro. Veja os detalhes abaixo.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: data.capturados > 0 ? `✓ ${data.capturados} novo(s) e-mail(s) capturado(s)` : "Nenhum e-mail novo",
          description: data.capturados === 0
            ? `${data.contas} conta(s) verificada(s). E-mails já existentes não são duplicados.`
            : `Capturados de ${data.contas} conta(s)`,
        });
      }
      qc.invalidateQueries({ queryKey: ["/api/email-automacao/contas"] });
      qc.invalidateQueries({ queryKey: ["/api/email-automacao/emails"] });
      qc.invalidateQueries({ queryKey: ["/api/email-automacao/stats"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setSyncingAll(false); }
  }

  const categorias = [...new Set(emails.map(e => e.categoriaPrincipal).filter(Boolean))] as string[];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/20 p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow">
              <Mail className="w-5 h-5 text-white" />
            </div>
            Automação de E-mails
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Leitura, classificação por IA e vinculação automática com empreendimentos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={sincronizarTodas} disabled={syncingAll || !contas.length} className="gap-1.5 text-xs">
            {syncingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sincronizar todas
          </Button>
          <Button size="sm" onClick={() => setShowContaModal(true)} className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700">
            <Plus className="w-3.5 h-3.5" /> Cadastrar conta
          </Button>
        </div>
      </div>

      {/* Sync error banner */}
      {syncErrors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Erros de conexão IMAP detectados
            </p>
            <button onClick={() => setSyncErrors([])} className="text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
          {syncErrors.map((e, i) => (
            <div key={i} className="rounded-lg bg-red-100 px-3 py-2">
              <p className="text-xs font-medium text-red-900">{e.email}</p>
              <p className="text-xs text-red-700 mt-0.5">{e.erro}</p>
              {e.rawError && e.rawError !== e.erro && (
                <p className="text-xs text-red-500 mt-0.5 font-mono break-all">Detalhe: {e.rawError}</p>
              )}
            </div>
          ))}
          <p className="text-xs text-red-600">Dica: use o botão <strong>Testar</strong> em cada conta para verificar a conexão individualmente.</p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total capturados", value: stats?.total ?? 0, icon: Inbox, color: "from-blue-500 to-indigo-600" },
          { label: "Precisam validação", value: stats?.precisamValidacao ?? 0, icon: AlertTriangle, color: "from-purple-500 to-violet-600" },
          { label: "Vínculo pendente", value: stats?.vinculoPendente ?? 0, icon: Link2, color: "from-orange-500 to-amber-600" },
          { label: "Alta prioridade", value: stats?.altaPrioridade ?? 0, icon: TrendingUp, color: "from-red-500 to-rose-600" },
          { label: "Alto risco", value: stats?.altoRisco ?? 0, icon: Shield, color: "from-rose-500 to-pink-600" },
          { label: "Demandas criadas", value: stats?.demandasCriadas ?? 0, icon: Zap, color: "from-emerald-500 to-teal-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
              </div>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border shadow-sm">
          <TabsTrigger value="painel" className="text-xs gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Painel</TabsTrigger>
          <TabsTrigger value="emails" className="text-xs gap-1.5"><Inbox className="w-3.5 h-3.5" /> E-mails Capturados {emails.length > 0 && <Badge className="ml-1 text-[10px] px-1.5 py-0">{emails.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="contas" className="text-xs gap-1.5"><Settings className="w-3.5 h-3.5" /> Contas IMAP</TabsTrigger>
        </TabsList>

        {/* ─── Painel ─── */}
        <TabsContent value="painel" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" /> Distribuição por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!stats?.porCategoria?.length ? (
                  <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
                    <Inbox className="w-10 h-10 opacity-30 mb-2" />
                    <p className="text-sm">Nenhum e-mail capturado ainda.</p>
                    <p className="text-xs mt-1">Cadastre uma conta e sincronize para começar.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats.porCategoria.map((c, i) => {
                      const max = stats.porCategoria[0]?.total || 1;
                      const pct = Math.round((Number(c.total) / Number(max)) * 100);
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="truncate flex-1">{c.categoria || "Sem categoria"}</span>
                            <span className="font-medium ml-2">{c.total}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full">
                            <div className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bot className="w-4 h-4 text-violet-600" /> Como funciona a IA
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2.5">
                {[
                  { icon: Inbox, title: "1. Leitura IMAP", desc: "Conecta às contas configuradas via IMAP seguro e lê e-mails dos últimos 30 dias." },
                  { icon: Bot, title: "2. Classificação GPT", desc: "GPT-4o-mini analisa remetente, assunto e corpo, classifica em 25 categorias e extrai metadados." },
                  { icon: Building2, title: "3. Vínculo automático", desc: "Cruza o conteúdo com os empreendimentos cadastrados e vincula automaticamente." },
                  { icon: Zap, title: "4. Cria demandas", desc: "Quando identifica demanda nova ou pendência, cria automaticamente no módulo de gestão." },
                  { icon: RefreshCw, title: "5. Roda diariamente", desc: "Cron às 06:00 BRT sincroniza todas as contas ativas e processa novos e-mails." },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-3 h-3 text-white" />
                    </div>
                    <div><p className="font-medium text-foreground">{title}</p><p>{desc}</p></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* E-mails recentes que precisam atenção */}
          {(emails.filter(e => e.precisaValidacao || e.vinculoPendente || e.prioridade === "alta").length > 0) && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="w-4 h-4" /> Requerem atenção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {emails.filter(e => e.precisaValidacao || e.vinculoPendente || e.prioridade === "alta").slice(0, 5).map(e => (
                    <button key={e.id} onClick={() => { setSelectedEmail(e); setTab("emails"); }}
                      className="w-full flex items-start gap-2.5 text-left p-2 rounded-lg hover:bg-amber-100 transition-colors">
                      <Mail className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{e.assunto}</p>
                        <p className="text-xs text-muted-foreground">{e.remetente} · {fmtDate(e.dataRecebimento)}</p>
                      </div>
                      <div className="flex gap-1">
                        {e.precisaValidacao && <Badge className="text-[10px] bg-purple-100 text-purple-800">Validar</Badge>}
                        {e.vinculoPendente && <Badge className="text-[10px] bg-orange-100 text-orange-800">Vínculo</Badge>}
                        {e.prioridade === "alta" && <Badge className="text-[10px] bg-red-100 text-red-800">Alta</Badge>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── E-mails Capturados ─── */}
        <TabsContent value="emails" className="mt-4 space-y-3">
          {/* Filtros */}
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input className="pl-8 h-8 text-xs" placeholder="Buscar assunto, remetente..." value={busca} onChange={e => setBusca(e.target.value)} />
                </div>
                <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                  <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas" className="text-xs">Todas as categorias</SelectItem>
                    {categorias.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
                  <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas" className="text-xs">Todas</SelectItem>
                    <SelectItem value="alta" className="text-xs">Alta</SelectItem>
                    <SelectItem value="media" className="text-xs">Média</SelectItem>
                    <SelectItem value="baixa" className="text-xs">Baixa</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterValidacao} onValueChange={setFilterValidacao}>
                  <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Validação" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas" className="text-xs">Todos</SelectItem>
                    <SelectItem value="sim" className="text-xs">Precisam validação</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterVinculo} onValueChange={setFilterVinculo}>
                  <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Vínculo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas" className="text-xs">Todos</SelectItem>
                    <SelectItem value="pendente" className="text-xs">Vínculo pendente</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setBusca(""); setFilterCategoria("todas"); setFilterPrioridade("todas"); setFilterValidacao("todas"); setFilterVinculo("todas"); }}>
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Limpar
                </Button>
              </div>
            </CardContent>
          </Card>

          {emailsLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !emails.length ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
                  <Inbox className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Nenhum e-mail capturado</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {contas.length === 0
                    ? "Cadastre uma conta de e-mail IMAP e sincronize para começar a capturar mensagens."
                    : `Clique em "Sincronizar todas" para capturar os e-mails das contas cadastradas.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {emails.map(e => (
                <button key={e.id} onClick={() => setSelectedEmail(e)}
                  className="w-full text-left bg-white rounded-xl border shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold
                      ${e.prioridade === "alta" ? "bg-gradient-to-br from-red-500 to-rose-600" :
                        e.prioridade === "baixa" ? "bg-gradient-to-br from-green-500 to-teal-600" :
                        "bg-gradient-to-br from-blue-500 to-indigo-600"}`}>
                      {(e.remetente || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{e.assunto || "(sem assunto)"}</p>
                        {e.demandaCriadaId && <Zap className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" title="Demanda criada" />}
                        {e.evidenciaCumprimento && <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" title="Evidência de cumprimento" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.remetente} · {fmtDate(e.dataRecebimento)}</p>
                      {e.resumo && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{e.resumo}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex gap-1 flex-wrap justify-end">
                        {e.categoriaPrincipal && <Badge variant="outline" className="text-[10px] px-1.5">{e.categoriaPrincipal}</Badge>}
                        {e.prioridade && <Badge className={`text-[10px] px-1.5 border ${PRIORIDADE_COLOR[e.prioridade] || ""}`}>{e.prioridade}</Badge>}
                      </div>
                      <div className="flex gap-1">
                        {e.precisaValidacao && <Badge className="text-[10px] bg-purple-100 text-purple-800 px-1.5">⚠</Badge>}
                        {e.vinculoPendente && <Badge className="text-[10px] bg-orange-100 text-orange-800 px-1.5">🔗</Badge>}
                        {e.empreendimentoNome && <Badge className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 max-w-24 truncate">{e.empreendimentoNome}</Badge>}
                      </div>
                      {e.nivelConfianca !== null && e.nivelConfianca !== undefined && (
                        <p className="text-[10px] text-muted-foreground">{Math.round(e.nivelConfianca * 100)}% conf.</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Contas IMAP ─── */}
        <TabsContent value="contas" className="mt-4 space-y-3">
          {contasLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !contas.length ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Nenhuma conta configurada</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  Cadastre contas de e-mail institucionais ou pessoais autorizadas para começar o monitoramento automático.
                </p>
                <Button onClick={() => setShowContaModal(true)} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4" /> Cadastrar primeira conta
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {contas.map(conta => (
                <Card key={conta.id} className={`border ${conta.ativo ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {conta.nome[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{conta.nome}</p>
                          {conta.ativo ? <Badge className="text-[10px] bg-green-100 text-green-800">Ativa</Badge> : <Badge variant="secondary" className="text-[10px]">Inativa</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{conta.email} · {conta.host}:{conta.port} {conta.secure ? "(SSL)" : "(sem SSL)"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {conta.totalEmails} e-mails · {conta.ultimaSincEm ? `Última sinc: ${fmtDate(conta.ultimaSincEm)}` : "Nunca sincronizado"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                          onClick={() => testarConexao(conta.id)} disabled={testingId === conta.id}>
                          {testingId === conta.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Testar
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1"
                          onClick={() => sincronizarConta(conta.id, conta.email)} disabled={syncingId === conta.id}>
                          {syncingId === conta.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          Sincronizar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditingConta(conta); setShowContaModal(true); }}>
                          <Settings className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => { if (confirm(`Remover conta ${conta.email}?`)) deleteMutation.mutate(conta.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modais */}
      {(showContaModal || editingConta) && (
        <ContaModal
          conta={editingConta || undefined}
          onClose={() => { setShowContaModal(false); setEditingConta(null); }}
          onSave={() => { setShowContaModal(false); setEditingConta(null); }}
        />
      )}
      {selectedEmail && (
        <EmailDetalhe
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
          onUpdated={() => { setSelectedEmail(null); refetchEmails(); }}
        />
      )}
    </div>
  );
}
