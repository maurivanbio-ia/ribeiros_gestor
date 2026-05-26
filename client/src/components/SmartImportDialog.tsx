import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileSpreadsheet, Sparkles, CheckCircle2, AlertTriangle,
  Loader2, ChevronRight, ChevronLeft, X, ArrowRight, RefreshCw,
  Table2, Brain, Database, Info,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ColMapping {
  coluna: string;
  campo: string | null;
  label: string;
  obrigatorio: boolean;
}

interface DetectionResult {
  modulo: string;
  confianca: number;
  descricao: string;
  mapeamento: ColMapping[];
}

// ── Module config ──────────────────────────────────────────────────────────────
const MODULE_CONFIG: Record<string, { label: string; icon: string; color: string; queryKeys: string[] }> = {
  financeiro:      { label: "Financeiro",          icon: "💰", color: "bg-emerald-500", queryKeys: ["/api/financeiro/lancamentos"] },
  rh:              { label: "Recursos Humanos",     icon: "👥", color: "bg-blue-500",    queryKeys: ["/api/rh"] },
  empreendimentos: { label: "Empreendimentos",      icon: "🏗️", color: "bg-purple-500",  queryKeys: ["/api/empreendimentos"] },
  fornecedores:    { label: "Fornecedores",         icon: "🤝", color: "bg-orange-500",  queryKeys: ["/api/fornecedores"] },
  treinamentos:    { label: "Treinamentos",         icon: "🎓", color: "bg-cyan-500",    queryKeys: ["/api/treinamentos"] },
  veiculos:        { label: "Frota de Veículos",    icon: "🚗", color: "bg-yellow-500",  queryKeys: ["/api/veiculos"] },
  equipamentos:    { label: "Equipamentos",         icon: "🔧", color: "bg-red-500",     queryKeys: ["/api/equipamentos"] },
  demandas:        { label: "Demandas",             icon: "📋", color: "bg-indigo-500",  queryKeys: ["/api/demandas"] },
  campo:           { label: "Monitoramento de Campo",icon: "🌿",color: "bg-green-600",  queryKeys: ["/api/campo"] },
};

// Campos disponíveis por módulo (para o select de mapeamento manual)
const MODULE_FIELDS: Record<string, { value: string; label: string }[]> = {
  financeiro: [
    { value: "tipo", label: "Tipo (receita/despesa/reembolso)" },
    { value: "valor", label: "Valor (R$)" },
    { value: "data", label: "Data" },
    { value: "categoria", label: "Categoria" },
    { value: "descricao", label: "Descrição" },
    { value: "empreendimento", label: "Empreendimento" },
    { value: "status", label: "Status" },
  ],
  rh: [
    { value: "nomeColaborador", label: "Nome do colaborador" },
    { value: "cargo", label: "Cargo / função" },
    { value: "cpf", label: "CPF" },
    { value: "rg", label: "RG" },
    { value: "status", label: "Status (ativo/inativo)" },
    { value: "dataInicio", label: "Data de admissão" },
    { value: "valor", label: "Salário / valor" },
    { value: "valorTipo", label: "Tipo de valor (hora/dia/mes)" },
    { value: "contatoEmail", label: "E-mail" },
    { value: "contatoTelefone", label: "Telefone" },
    { value: "regimeContratacao", label: "Regime (CLT/PJ)" },
    { value: "cnpj", label: "CNPJ (PJ)" },
  ],
  empreendimentos: [
    { value: "nome", label: "Nome do empreendimento" },
    { value: "cliente", label: "Cliente / contratante" },
    { value: "tipo", label: "Tipo de empreendimento" },
    { value: "status", label: "Status" },
    { value: "municipio", label: "Município" },
    { value: "uf", label: "UF / Estado" },
    { value: "localizacao", label: "Localização" },
    { value: "responsavelInterno", label: "Responsável interno" },
    { value: "descricao", label: "Descrição" },
  ],
  fornecedores: [
    { value: "razaoSocial", label: "Razão Social / Nome" },
    { value: "nomeFantasia", label: "Nome Fantasia" },
    { value: "cnpj", label: "CNPJ" },
    { value: "cpf", label: "CPF" },
    { value: "tipo", label: "Tipo de fornecedor" },
    { value: "email", label: "E-mail" },
    { value: "telefone", label: "Telefone" },
    { value: "cidade", label: "Cidade" },
    { value: "uf", label: "UF" },
    { value: "avaliacao", label: "Avaliação (1-5)" },
    { value: "status", label: "Status" },
    { value: "servicosPrestados", label: "Serviços prestados" },
  ],
  treinamentos: [
    { value: "titulo", label: "Título do treinamento" },
    { value: "tipo", label: "Tipo (NR/técnico/obrigatório)" },
    { value: "modalidade", label: "Modalidade (presencial/online)" },
    { value: "dataInicio", label: "Data de início" },
    { value: "dataFim", label: "Data de término" },
    { value: "cargaHoraria", label: "Carga horária (h)" },
    { value: "status", label: "Status" },
    { value: "instituicao", label: "Instituição" },
    { value: "instrutor", label: "Instrutor" },
    { value: "local", label: "Local" },
    { value: "custoTotal", label: "Custo total (R$)" },
    { value: "descricao", label: "Descrição" },
  ],
  veiculos: [
    { value: "placa", label: "Placa" },
    { value: "marca", label: "Marca" },
    { value: "modelo", label: "Modelo" },
    { value: "ano", label: "Ano" },
    { value: "tipo", label: "Tipo (carro/van/moto...)" },
    { value: "status", label: "Status" },
    { value: "kmAtual", label: "KM atual" },
    { value: "combustivel", label: "Combustível" },
    { value: "localizacaoAtual", label: "Localização atual" },
    { value: "responsavelAtual", label: "Responsável" },
    { value: "seguro", label: "Seguro" },
    { value: "proximaRevisao", label: "Próxima revisão" },
  ],
  equipamentos: [
    { value: "nome", label: "Nome do equipamento" },
    { value: "tipo", label: "Tipo (GPS/drone/armadilha...)" },
    { value: "status", label: "Status" },
    { value: "localizacaoAtual", label: "Localização" },
    { value: "responsavel", label: "Responsável" },
    { value: "marca", label: "Marca" },
    { value: "modelo", label: "Modelo" },
    { value: "numeroSerie", label: "Número de série" },
    { value: "numeroPatrimonio", label: "Nº de patrimônio" },
    { value: "valorAquisicao", label: "Valor de aquisição" },
    { value: "dataAquisicao", label: "Data de aquisição" },
  ],
  demandas: [
    { value: "titulo", label: "Título" },
    { value: "descricao", label: "Descrição" },
    { value: "setor", label: "Setor" },
    { value: "status", label: "Status" },
    { value: "prioridade", label: "Prioridade (baixa/media/alta/urgente)" },
    { value: "prazo", label: "Prazo" },
    { value: "responsavel", label: "Responsável" },
  ],
  campo: [
    { value: "nomeCientifico", label: "Nome científico" },
    { value: "nomeComum", label: "Nome comum / popular" },
    { value: "grupoTaxonomico", label: "Grupo taxonômico" },
    { value: "campanha", label: "Campanha" },
    { value: "data", label: "Data" },
    { value: "latitude", label: "Latitude" },
    { value: "longitude", label: "Longitude" },
    { value: "abundancia", label: "Abundância / quantidade" },
    { value: "unidadeAmostral", label: "Unidade amostral" },
    { value: "iucn", label: "IUCN" },
    { value: "cites", label: "CITES" },
    { value: "ibamaMma", label: "IBAMA/MMA" },
    { value: "observacoes", label: "Observações" },
  ],
};

// ── Helper ─────────────────────────────────────────────────────────────────────
function parseSpreadsheet(file: File): Promise<{ headers: string[]; rows: any[][]; allRows: any[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        if (!json.length) { reject(new Error("Planilha vazia")); return; }
        const headers: string[] = (json[0] as any[]).map(h => (h !== null && h !== undefined ? String(h).trim() : "")).filter(Boolean);
        const rows = json.slice(1).filter(r => (r as any[]).some(c => c !== null && c !== undefined && c !== ""))
          .map(r => headers.map((_, i) => (r as any[])[i] ?? null));
        const allRows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: null });
        resolve({ headers, rows, allRows });
      } catch (err: any) { reject(err); }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsBinaryString(file);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = "upload" | "detecting" | "mapping" | "importing" | "done";

export default function SmartImportDialog({ open, onClose }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [step, setStep]               = useState<Step>("upload");
  const [isDragging, setIsDragging]   = useState(false);
  const [file, setFile]               = useState<File | null>(null);
  const [parsed, setParsed]           = useState<{ headers: string[]; rows: any[][]; allRows: any[] } | null>(null);
  const [detection, setDetection]     = useState<DetectionResult | null>(null);
  const [mapping, setMapping]         = useState<ColMapping[]>([]);
  const [importResult, setImportResult] = useState<{ inseridos: number; erros: string[]; pulados: string[]; total: number } | null>(null);
  const [parseError, setParseError]   = useState<string | null>(null);

  const resetAll = () => {
    setStep("upload"); setFile(null); setParsed(null);
    setDetection(null); setMapping([]); setImportResult(null); setParseError(null);
  };

  const handleClose = () => { resetAll(); onClose(); };

  // ── Detect mutation ───────────────────────────────────────────────────────
  const detectMutation = useMutation({
    mutationFn: async (data: { headers: string[]; sampleRows: any[][]; fileName: string }) => {
      const res = await fetch("/api/planilha/detectar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<DetectionResult>;
    },
    onSuccess: (data) => {
      setDetection(data);
      setMapping(data.mapeamento || []);
      setStep("mapping");
    },
    onError: (e: any) => {
      toast({ title: "Erro na detecção", description: e.message, variant: "destructive" });
      setStep("upload");
    },
  });

  // ── Import mutation ───────────────────────────────────────────────────────
  const importMutation = useMutation({
    mutationFn: async (data: { modulo: string; registros: any[] }) => {
      const res = await fetch("/api/planilha/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep("done");
      // Invalidate relevant queries
      const cfg = MODULE_CONFIG[detection?.modulo || ""];
      if (cfg) cfg.queryKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: any) => {
      toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
      setStep("mapping");
    },
  });

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFile = useCallback(async (f: File) => {
    setParseError(null);
    setFile(f);
    setStep("detecting");
    try {
      const p = await parseSpreadsheet(f);
      setParsed(p);
      detectMutation.mutate({
        headers: p.headers,
        sampleRows: p.rows.slice(0, 5),
        fileName: f.name,
      });
    } catch (err: any) {
      setParseError(err.message);
      setStep("upload");
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && /\.(xlsx|xls|csv)$/i.test(f.name)) handleFile(f);
    else toast({ title: "Formato inválido", description: "Use .xlsx, .xls ou .csv", variant: "destructive" });
  }, [handleFile]);

  // ── Build registros from mapping ──────────────────────────────────────────
  const buildRegistros = () => {
    if (!parsed || !mapping.length) return [];
    return parsed.allRows.map((row: any) => {
      const rec: any = {};
      mapping.forEach(({ coluna, campo }) => {
        if (campo && row[coluna] !== undefined && row[coluna] !== null)
          rec[campo] = row[coluna];
      });
      return rec;
    }).filter(r => Object.keys(r).length > 0);
  };

  const handleImport = () => {
    if (!detection) return;
    const registros = buildRegistros();
    if (!registros.length) { toast({ title: "Nada para importar", description: "Nenhum registro mapeado", variant: "destructive" }); return; }
    setStep("importing");
    importMutation.mutate({ modulo: detection.modulo, registros });
  };

  const mod = detection ? MODULE_CONFIG[detection.modulo] : null;
  const fields = detection ? (MODULE_FIELDS[detection.modulo] || []) : [];

  const confiancaColor = !detection ? "bg-gray-300"
    : detection.confianca >= 0.8 ? "bg-emerald-500"
    : detection.confianca >= 0.5 ? "bg-yellow-500"
    : "bg-red-500";

  const confiancaLabel = !detection ? ""
    : detection.confianca >= 0.8 ? "Alta confiança"
    : detection.confianca >= 0.5 ? "Confiança média"
    : "Baixa confiança — revise o mapeamento";

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-6 py-4 border-b bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Brain className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-bold">Importação Inteligente de Planilhas</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Qualquer planilha — a IA identifica o tipo de dado e mapeia as colunas automaticamente
            </p>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:opacity-70 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Steps bar ── */}
        <div className="flex items-center gap-0 px-6 py-2 border-b bg-muted/30">
          {[
            { id: "upload",    label: "Arquivo",    icon: Upload },
            { id: "mapping",   label: "Mapeamento", icon: Table2 },
            { id: "done",      label: "Resultado",  icon: CheckCircle2 },
          ].map((s, i, arr) => {
            const active = step === s.id || (step === "detecting" && s.id === "upload") || (step === "importing" && s.id === "mapping");
            const done = (s.id === "upload" && ["mapping","importing","done"].includes(step))
                      || (s.id === "mapping" && ["importing","done"].includes(step));
            return (
              <div key={s.id} className="flex items-center gap-0 flex-1">
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors
                  ${done ? "text-emerald-600" : active ? "text-foreground" : "text-muted-foreground"}`}>
                  {done
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    : <s.icon className="w-3.5 h-3.5" />}
                  {s.label}
                </div>
                {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Step: Upload */}
          {(step === "upload" || step === "detecting") && (
            <div className="space-y-4">
              <div
                ref={dropRef}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => step === "upload" && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer
                  ${isDragging ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[1.01]"
                    : step === "detecting" ? "border-blue-300 bg-blue-50/30 dark:bg-blue-950/20 cursor-default"
                    : "border-muted-foreground/30 hover:border-emerald-400 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10"}`}
              >
                {step === "detecting" ? (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <div className="relative">
                        <Sparkles className="w-10 h-10 text-blue-500 animate-pulse" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      Analisando a planilha com IA...
                    </p>
                    <p className="text-xs text-muted-foreground">{file?.name}</p>
                    <Progress value={undefined} className="w-48 mx-auto h-1.5" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <div className="p-4 rounded-full bg-muted/50">
                        <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Arraste uma planilha ou clique para selecionar</p>
                      <p className="text-xs text-muted-foreground mt-1">Aceita .xlsx, .xls, .csv — qualquer formato</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 text-[10px] text-muted-foreground">
                      {Object.entries(MODULE_CONFIG).map(([k, v]) => (
                        <span key={k} className="px-2 py-0.5 rounded-full bg-muted border">{v.icon} {v.label}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
                className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

              {parseError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {parseError}
                </div>
              )}

              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Como funciona</p>
                <div className="grid grid-cols-3 gap-3 text-xs text-center">
                  {[
                    { icon: "📤", label: "Carregue qualquer planilha", desc: "Excel ou CSV de qualquer fonte" },
                    { icon: "🧠", label: "IA analisa automaticamente", desc: "Identifica o módulo e mapeia as colunas" },
                    { icon: "✅", label: "Revise e importe", desc: "Ajuste o mapeamento se necessário" },
                  ].map(item => (
                    <div key={item.label} className="space-y-1">
                      <div className="text-xl">{item.icon}</div>
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-muted-foreground">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step: Mapping */}
          {step === "mapping" && detection && mod && (
            <div className="space-y-4">
              {/* Detection result card */}
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-gradient-to-r from-muted/40 to-muted/20">
                <span className="text-3xl">{mod.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm">{mod.label}</p>
                    <Badge className={`text-[10px] text-white ${confiancaColor}`}>
                      {Math.round(detection.confianca * 100)}% — {confiancaLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{detection.descricao}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {parsed?.rows.length} linha(s) detectada(s) · {detection.mapeamento.length} coluna(s)
                  </p>
                </div>
                <Button variant="outline" size="sm" className="text-xs flex-shrink-0"
                  onClick={() => { setStep("detecting"); detectMutation.mutate({ headers: parsed!.headers, sampleRows: parsed!.rows.slice(0,5), fileName: file!.name }); }}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Re-analisar
                </Button>
              </div>

              {/* Column mapping table */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Mapeamento de colunas — ajuste conforme necessário
                </p>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Coluna da planilha</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Valor de exemplo</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Mapear para campo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {mapping.map((m, idx) => {
                        const exampleVal = parsed?.rows[0]?.[parsed.headers.indexOf(m.coluna)];
                        const example = exampleVal !== null && exampleVal !== undefined ? String(exampleVal).slice(0, 40) : null;
                        return (
                          <tr key={idx} className={`${m.campo ? "bg-background" : "bg-muted/20"}`}>
                            <td className="px-3 py-2">
                              <span className="font-medium text-foreground">{m.coluna}</span>
                              {m.obrigatorio && <span className="ml-1 text-red-500">*</span>}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground font-mono">
                              {example ? <span className="truncate max-w-[120px] block">{example}</span> : <span className="italic">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              <Select
                                value={m.campo || "__none__"}
                                onValueChange={(v) => {
                                  setMapping(prev => prev.map((item, i) =>
                                    i === idx ? { ...item, campo: v === "__none__" ? null : v } : item
                                  ));
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs border-muted">
                                  <SelectValue placeholder="Não mapear" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">
                                    <span className="text-muted-foreground italic">Não importar esta coluna</span>
                                  </SelectItem>
                                  {fields.map(f => (
                                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Data preview */}
              {parsed && parsed.rows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Prévia dos dados (primeiras 3 linhas)
                  </p>
                  <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full text-[10px] min-w-max">
                      <thead className="bg-muted/40">
                        <tr>
                          {mapping.filter(m => m.campo).map(m => (
                            <th key={m.coluna} className="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">
                              {m.label || m.coluna}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {parsed.rows.slice(0, 3).map((row, ri) => (
                          <tr key={ri}>
                            {mapping.filter(m => m.campo).map(m => {
                              const colIdx = parsed.headers.indexOf(m.coluna);
                              const val = row[colIdx];
                              return (
                                <td key={m.coluna} className="px-2 py-1.5 text-muted-foreground font-mono truncate max-w-[150px]">
                                  {val !== null && val !== undefined ? String(val).slice(0, 50) : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg px-3 py-2">
                <Info className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
                Colunas marcadas com <span className="text-red-500 font-bold">*</span> são obrigatórias. Linhas com campos obrigatórios em branco serão puladas automaticamente.
              </div>
            </div>
          )}

          {/* Step: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative">
                <Database className="w-12 h-12 text-emerald-500 opacity-20" />
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-sm font-medium">Importando registros...</p>
              <p className="text-xs text-muted-foreground">Aguarde enquanto os dados são inseridos no sistema</p>
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && importResult && mod && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="flex justify-center mb-3">
                  <div className="p-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                </div>
                <h3 className="font-bold text-lg">Importação concluída!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Os dados foram importados para o módulo <strong>{mod.icon} {mod.label}</strong>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Importados", value: importResult.inseridos, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" },
                  { label: "Pulados",    value: importResult.pulados?.length ?? 0, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800" },
                  { label: "Erros",      value: importResult.erros?.length ?? 0, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" },
                ].map(item => (
                  <div key={item.label} className={`rounded-xl border p-4 text-center ${item.bg}`}>
                    <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                  </div>
                ))}
              </div>

              {importResult.pulados?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-yellow-600 mb-1">Linhas puladas:</p>
                  <div className="rounded-lg border bg-yellow-50/50 dark:bg-yellow-950/20 px-3 py-2 max-h-28 overflow-y-auto space-y-0.5">
                    {importResult.pulados.map((p, i) => <p key={i} className="text-[10px] text-muted-foreground">{p}</p>)}
                  </div>
                </div>
              )}

              {importResult.erros?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-600 mb-1">Erros encontrados:</p>
                  <div className="rounded-lg border bg-red-50/50 dark:bg-red-950/20 px-3 py-2 max-h-28 overflow-y-auto space-y-0.5">
                    {importResult.erros.map((e, i) => <p key={i} className="text-[10px] text-muted-foreground">{e}</p>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20">
          <div className="text-xs text-muted-foreground">
            {file && step !== "upload" && (
              <span className="flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {file.name} · {parsed ? `${parsed.rows.length} linhas` : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === "mapping" && (
              <>
                <Button variant="outline" size="sm" onClick={resetAll} className="text-xs">
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Voltar
                </Button>
                <Button size="sm" onClick={handleImport}
                  disabled={!mapping.some(m => m.campo) || importMutation.isPending}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                  <ArrowRight className="w-3.5 h-3.5 mr-1" />
                  Importar {parsed?.rows.length} registro{parsed?.rows.length !== 1 ? "s" : ""}
                </Button>
              </>
            )}
            {step === "done" && (
              <>
                <Button variant="outline" size="sm" onClick={resetAll} className="text-xs">
                  <Upload className="w-3.5 h-3.5 mr-1" /> Importar outra planilha
                </Button>
                <Button size="sm" onClick={handleClose} className="text-xs">
                  Concluir
                </Button>
              </>
            )}
            {(step === "upload" || step === "detecting") && (
              <Button variant="outline" size="sm" onClick={handleClose} className="text-xs">
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
