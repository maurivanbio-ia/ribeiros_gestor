
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SensitivePageWrapper } from "@/components/SensitivePageWrapper";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SelectGroup, SelectLabel, SelectSeparator,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, Download, Trash2, FileText, Database, XCircle, Eye, Edit, X, Loader2,
  ChevronDown, ChevronRight, BookOpen, Search, Shield, History, FolderOpen,
  FolderPlus, Plus, File, Building2, AlertTriangle, Clock, CheckCircle2,
  Sparkles, Link2, ListChecks, BarChart3, CalendarDays, Zap, FileSearch,
  AlertCircle, Info, BrainCircuit, ExternalLink, LayoutGrid, List, Calendar,
  MapPin, User2, LayoutList
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import { FolderTreePicker, DocTypePicker } from "@/components/GestaoDocComponents";
import type { Dataset, Empreendimento, User, DatasetPasta } from "@shared/schema";
import { PDFDocument } from 'pdf-lib';

// ─── PDF Compression Helper ───────────────────────────────────────────────────
async function comprimirPdf(
  inputFile: File,
  scale: number,
  quality: number,
  onProgress: (pct: number) => void
): Promise<File> {
  const pdfjsLib = await import('pdfjs-dist');
  // pdfjs-dist v5 usa exports nomeados, não default
  const { GlobalWorkerOptions, getDocument } = pdfjsLib as any;
  GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await inputFile.arrayBuffer();
  const pdfDoc = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const newPdf = await PDFDocument.create();
  const total = pdfDoc.numPages;

  for (let i = 1; i <= total; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx as any, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const b64 = dataUrl.split(',')[1];
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const img = await newPdf.embedJpg(bytes);
    const p = newPdf.addPage([canvas.width, canvas.height]);
    p.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height });
    onProgress(Math.round((i / total) * 100));
  }

  const pdfBytes = await newPdf.save();
  const outName = inputFile.name.replace(/\.pdf$/i, '') + '_comprimido.pdf';
  return new File([pdfBytes], outName, { type: 'application/pdf' });
}

// ─── Tipos e Constantes ────────────────────────────────────────────────────────

const TIPOS_DOCUMENTAIS = [
  // ── Estudos Ambientais ──────────────────────────────────────────────
  { value: "eia",              label: "EIA – Estudo de Impacto Ambiental",                   icon: "📊", sigla: "EIA",  cat: "estudo"       },
  { value: "rima",             label: "RIMA – Relatório de Impacto ao Meio Ambiente",         icon: "📋", sigla: "RIMA", cat: "estudo"       },
  { value: "ras",              label: "RAS – Relatório Ambiental Simplificado",               icon: "📄", sigla: "RAS",  cat: "estudo"       },
  { value: "rap",              label: "RAP – Relatório Ambiental Preliminar",                 icon: "📄", sigla: "RAP",  cat: "estudo"       },
  { value: "prad",             label: "PRAD – Projeto de Recuperação de Áreas Degradadas",   icon: "🌿", sigla: "PRAD", cat: "estudo"       },
  { value: "pca",              label: "PCA – Plano de Controle Ambiental",                   icon: "📌", sigla: "PCA",  cat: "estudo"       },
  { value: "pba",              label: "PBA – Plano Básico Ambiental",                        icon: "📋", sigla: "PBA",  cat: "estudo"       },
  { value: "pgas",             label: "PGAS – Plano de Gestão Ambiental e Social",           icon: "📋", sigla: "PGAS", cat: "estudo"       },
  { value: "pee",              label: "PEE – Plano de Educação Ambiental",                   icon: "📚", sigla: "PEE",  cat: "estudo"       },
  { value: "pgrs",             label: "PGRS – Plano de Gerenciamento de Resíduos Sólidos",   icon: "♻️", sigla: "PGRS", cat: "estudo"       },
  { value: "pcpv",             label: "PCPV – Programa de Controle de Poeiras e Vibrações",  icon: "💨", sigla: "PCPV", cat: "estudo"       },
  // ── Licenças Ambientais ─────────────────────────────────────────────
  { value: "licenca_previa",      label: "LP – Licença Prévia",                icon: "📋", sigla: "LP",  cat: "licenca"  },
  { value: "licenca_instalacao",  label: "LI – Licença de Instalação",         icon: "📋", sigla: "LI",  cat: "licenca"  },
  { value: "licenca_operacao",    label: "LO – Licença de Operação",           icon: "📋", sigla: "LO",  cat: "licenca"  },
  { value: "las",                 label: "LAS – Licença Ambiental Simplificada", icon: "📋", sigla: "LAS", cat: "licenca" },
  { value: "licenca",             label: "LIC – Licença Ambiental (outros)",   icon: "📋", sigla: "LIC", cat: "licenca"  },
  // ── Comunicação Oficial ─────────────────────────────────────────────
  { value: "oficio",          label: "OFC – Ofício",                           icon: "📨", sigla: "OFC", cat: "comunicacao" },
  { value: "notificacao",     label: "NOT – Notificação",                      icon: "📢", sigla: "NOT", cat: "comunicacao" },
  { value: "parecer",         label: "PAR – Parecer Técnico",                  icon: "🔍", sigla: "PAR", cat: "comunicacao" },
  { value: "auto_infracao",   label: "AIT – Auto de Infração",                 icon: "⚠️", sigla: "AIT", cat: "comunicacao" },
  { value: "termo",           label: "TER – Termo",                            icon: "📜", sigla: "TER", cat: "comunicacao" },
  // ── Documentos Técnicos ─────────────────────────────────────────────
  { value: "art",             label: "ART – Anotação de Responsabilidade Técnica", icon: "🔧", sigla: "ART", cat: "tecnico" },
  { value: "relatorio",       label: "REL – Relatório Técnico (genérico)",     icon: "📊", sigla: "REL", cat: "tecnico"  },
  { value: "mapa",            label: "MAP – Mapa / Cartografia",               icon: "🗺️", sigla: "MAP", cat: "tecnico"  },
  { value: "documento_legal", label: "DOC – Documento Legal",                  icon: "⚖️", sigla: "DOC", cat: "tecnico"  },
  { value: "banco_dados",     label: "BD – Banco de Dados",                    icon: "🗄️", sigla: "BD",  cat: "tecnico"  },
  { value: "condicionante",   label: "CON – Condicionante",                    icon: "📌", sigla: "CON", cat: "tecnico"  },
  { value: "outro",           label: "OUT – Outro",                            icon: "📄", sigla: "OUT", cat: "tecnico"  },
];

const CAT_COLORS: Record<string, { badge: string; border: string; bg: string; dot: string }> = {
  estudo:      { badge: "bg-emerald-100 text-emerald-800 border-emerald-300",    border: "border-l-emerald-500",   bg: "bg-emerald-50/40",   dot: "bg-emerald-500"   },
  licenca:     { badge: "bg-blue-100 text-blue-800 border-blue-300",             border: "border-l-blue-500",      bg: "bg-blue-50/40",      dot: "bg-blue-500"      },
  comunicacao: { badge: "bg-orange-100 text-orange-800 border-orange-300",       border: "border-l-orange-500",    bg: "bg-orange-50/40",    dot: "bg-orange-500"    },
  tecnico:     { badge: "bg-slate-100 text-slate-700 border-slate-300",          border: "border-l-slate-400",     bg: "bg-slate-50/40",     dot: "bg-slate-400"     },
};

const NUMERO_PREFIXOS: Record<string, string> = Object.fromEntries(
  TIPOS_DOCUMENTAIS.map(t => [t.value, t.sigla])
);

function getSigla(tipo: string): string {
  return TIPOS_DOCUMENTAIS.find(t => t.value === tipo)?.sigla || "DOC";
}

function gerarNumeroDocumento(tipo: string, allDocs: any[]): string {
  const sigla = getSigla(tipo);
  const year = new Date().getFullYear();
  const sameType = allDocs.filter(d => d.tipoDocumental === tipo);
  const seq = String(sameType.length + 1).padStart(3, "0");
  return `${sigla}-${seq}/${year}`;
}

function gerarNomeDocumento(tipo: string, empNome: string, dataEmissao?: string): string {
  const sigla = getSigla(tipo);
  const year = dataEmissao ? new Date(dataEmissao + "T12:00:00").getFullYear() : new Date().getFullYear();
  const parts = [sigla];
  if (empNome) parts.push(empNome);
  parts.push(String(year));
  return parts.join(" - ");
}

const STATUS_DOCUMENTAIS = [
  { value: "recebido", label: "Recebido", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "em_analise", label: "Em Análise", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "em_atendimento", label: "Em Atendimento", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "respondido", label: "Respondido", color: "bg-teal-100 text-teal-800 border-teal-200" },
  { value: "concluido", label: "Concluído", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "vencido", label: "Vencido", color: "bg-red-100 text-red-800 border-red-200" },
];

const VINCULOS_TIPOS = [
  // ── Solicitações e Pedidos ──────────────────────────────────────────
  { value: "solicitacao",           label: "📬 Solicitação ao Órgão",       grupo: "Solicitações" },
  { value: "requerimento_formal",   label: "📋 Requerimento Formal",         grupo: "Solicitações" },
  // ── Protocolos ─────────────────────────────────────────────────────
  { value: "protocolo_envio",       label: "📮 Protocolo de Envio",         grupo: "Protocolos" },
  { value: "protocolo_recebimento", label: "📥 Protocolo de Recebimento",   grupo: "Protocolos" },
  // ── Respostas e Atendimentos ────────────────────────────────────────
  { value: "resposta",              label: "📩 Resposta a Documento",        grupo: "Respostas" },
  { value: "atendimento_exigencia", label: "✅ Atendimento de Exigência",   grupo: "Respostas" },
  { value: "esclarecimento",        label: "💬 Esclarecimento/Manifestação", grupo: "Respostas" },
  { value: "recurso",               label: "⚖️ Recurso/Impugnação",         grupo: "Respostas" },
  // ── Comunicações Oficiais ───────────────────────────────────────────
  { value: "despacho",              label: "📄 Despacho do Órgão",          grupo: "Comunicações" },
  { value: "parecer_tecnico",       label: "🔍 Parecer Técnico",            grupo: "Comunicações" },
  { value: "intimacao",             label: "⚠️ Intimação",                  grupo: "Comunicações" },
  // ── Técnicos ────────────────────────────────────────────────────────
  { value: "laudo_embasamento",     label: "📊 Laudo/Embasamento Técnico",  grupo: "Técnicos" },
  { value: "anexo_tecnico",         label: "📎 Anexo Técnico",              grupo: "Técnicos" },
  { value: "complemento",           label: "➕ Complementação",             grupo: "Técnicos" },
  // ── Modificações ────────────────────────────────────────────────────
  { value: "substitui",             label: "🔄 Substitui Versão Anterior",  grupo: "Modificações" },
  { value: "aditamento",            label: "✏️ Aditamento/Alteração",       grupo: "Modificações" },
  // ── Obrigações ──────────────────────────────────────────────────────
  { value: "exigencia",             label: "🔴 Exigência Recebida",         grupo: "Obrigações" },
  { value: "gerando_obrigacao",     label: "📌 Gera Obrigação",             grupo: "Obrigações" },
  // ── Autuações e Notificações ────────────────────────────────────────
  { value: "auto_infracao",         label: "🚫 Auto de Infração",           grupo: "Autuações" },
  { value: "notificacao_recebida",  label: "🔔 Notificação Recebida",       grupo: "Autuações" },
];

// Renderiza o select de VINCULOS_TIPOS agrupado por categoria
function VinculosTiposSelectContent() {
  const grupos = Array.from(new Set(VINCULOS_TIPOS.map(v => v.grupo)));
  return (
    <SelectContent className="max-h-80">
      {grupos.map((grupo, gi) => (
        <SelectGroup key={grupo}>
          <SelectLabel className="text-[11px] text-muted-foreground uppercase tracking-wide px-2 py-1">{grupo}</SelectLabel>
          {VINCULOS_TIPOS.filter(v => v.grupo === grupo).map(v => (
            <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
          ))}
          {gi < grupos.length - 1 && <SelectSeparator />}
        </SelectGroup>
      ))}
    </SelectContent>
  );
}

const DICIONARIO_SIGLAS = {
  DISC: [
    { sigla: "FAU", descricao: "Fauna" },
    { sigla: "FLO", descricao: "Flora" },
    { sigla: "HID", descricao: "Hidrologia" },
    { sigla: "QUI", descricao: "Química" },
    { sigla: "GEO", descricao: "Geologia/Geomorfologia" },
    { sigla: "SOC", descricao: "Socioeconomia" },
    { sigla: "SIG", descricao: "Geoprocessamento" },
    { sigla: "ENG", descricao: "Engenharia" },
    { sigla: "JUR", descricao: "Jurídico" },
    { sigla: "ESG", descricao: "ESG/Sustentabilidade" },
    { sigla: "GPR", descricao: "Gestão de Projetos" },
  ],
  DOC: [
    { sigla: "REL", descricao: "Relatório" },
    { sigla: "NT", descricao: "Nota Técnica" },
    { sigla: "OF", descricao: "Ofício" },
    { sigla: "MEM", descricao: "Memorial" },
    { sigla: "ATA", descricao: "Ata de Reunião" },
    { sigla: "APR", descricao: "Apresentação" },
    { sigla: "MAP", descricao: "Mapa" },
    { sigla: "DAT", descricao: "Banco de Dados" },
    { sigla: "MET", descricao: "Metodologia" },
    { sigla: "LAU", descricao: "Laudo" },
    { sigla: "PT", descricao: "Plano de Trabalho" },
    { sigla: "PBA", descricao: "Plano Básico Ambiental" },
    { sigla: "EIA", descricao: "Estudo de Impacto Ambiental" },
    { sigla: "PRAD", descricao: "Rec. de Área Degradada" },
    { sigla: "PGR", descricao: "Plan. Ger. de Riscos" },
    { sigla: "CER", descricao: "Certidão/Certificado" },
    { sigla: "CON", descricao: "Contrato" },
    { sigla: "FIC", descricao: "Ficha Técnica" },
  ],
  ENTREGA: [
    { sigla: "D0", descricao: "Diagnóstico Inicial" },
    { sigla: "D1", descricao: "Primeira Entrega" },
    { sigla: "D2", descricao: "Segunda Entrega (Final)" },
    { sigla: "REV", descricao: "Revisão" },
    { sigla: "RES", descricao: "Resposta a Parecer" },
    { sigla: "PROT", descricao: "Protocolado" },
  ],
  STATUS: [
    { sigla: "RASC", descricao: "Rascunho" },
    { sigla: "PRELIM", descricao: "Preliminar" },
    { sigla: "FINAL", descricao: "Final" },
    { sigla: "ASSIN", descricao: "Assinado" },
    { sigla: "PROTOC", descricao: "Protocolado" },
    { sigla: "ENVIADO", descricao: "Enviado" },
    { sigla: "ARQ", descricao: "Arquivado" },
  ],
  CLASS: [
    { sigla: "PUB", descricao: "Público" },
    { sigla: "INT", descricao: "Interno" },
    { sigla: "CONF", descricao: "Confidencial" },
    { sigla: "LGPD", descricao: "Proteção de Dados" },
  ],
  UF: [
    { sigla: "AC", descricao: "Acre" }, { sigla: "AL", descricao: "Alagoas" },
    { sigla: "AP", descricao: "Amapá" }, { sigla: "AM", descricao: "Amazonas" },
    { sigla: "BA", descricao: "Bahia" }, { sigla: "CE", descricao: "Ceará" },
    { sigla: "DF", descricao: "Distrito Federal" }, { sigla: "ES", descricao: "Espírito Santo" },
    { sigla: "GO", descricao: "Goiás" }, { sigla: "MA", descricao: "Maranhão" },
    { sigla: "MT", descricao: "Mato Grosso" }, { sigla: "MS", descricao: "Mato Grosso do Sul" },
    { sigla: "MG", descricao: "Minas Gerais" }, { sigla: "PA", descricao: "Pará" },
    { sigla: "PB", descricao: "Paraíba" }, { sigla: "PR", descricao: "Paraná" },
    { sigla: "PE", descricao: "Pernambuco" }, { sigla: "PI", descricao: "Piauí" },
    { sigla: "RJ", descricao: "Rio de Janeiro" }, { sigla: "RN", descricao: "Rio Grande do Norte" },
    { sigla: "RS", descricao: "Rio Grande do Sul" }, { sigla: "RO", descricao: "Rondônia" },
    { sigla: "RR", descricao: "Roraima" }, { sigla: "SC", descricao: "Santa Catarina" },
    { sigla: "SP", descricao: "São Paulo" }, { sigla: "SE", descricao: "Sergipe" },
    { sigla: "TO", descricao: "Tocantins" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusDocumentalInfo(status: string | null) {
  return STATUS_DOCUMENTAIS.find(s => s.value === status) || STATUS_DOCUMENTAIS[0];
}

function getTipoDocumentalInfo(tipo: string | null) {
  return TIPOS_DOCUMENTAIS.find(t => t.value === tipo);
}

function getStatusBadge(status: string | null) {
  const colors: Record<string, string> = {
    RASC: "bg-gray-200 text-gray-800", PRELIM: "bg-yellow-200 text-yellow-800",
    FINAL: "bg-green-200 text-green-800", ASSIN: "bg-blue-200 text-blue-800",
    PROTOC: "bg-purple-200 text-purple-800", ENVIADO: "bg-teal-200 text-teal-800",
    ARQ: "bg-slate-200 text-slate-800",
  };
  return colors[status || ""] || "bg-gray-100 text-gray-600";
}

function getClassBadge(cls: string | null) {
  const colors: Record<string, string> = {
    PUB: "bg-green-100 text-green-700", INT: "bg-blue-100 text-blue-700",
    CONF: "bg-orange-100 text-orange-700", LGPD: "bg-red-100 text-red-700",
  };
  return colors[cls || ""] || "bg-gray-100 text-gray-600";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function PdfBlobFrame({ dataUrl, nome }: { dataUrl: string; nome: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [embedFailed, setEmbedFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    try {
      const base64 = dataUrl.split(",")[1];
      if (!base64) { setLoading(false); return; }
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch {
      /* silently fail – show fallback */
    } finally {
      setLoading(false);
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [dataUrl]);

  const handleOpenNewTab = () => {
    if (blobUrl) { window.open(blobUrl, "_blank"); return; }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = nome;
    a.click();
  };

  const handleDownloadDirect = () => {
    const a = document.createElement("a");
    a.href = blobUrl || dataUrl;
    a.download = nome;
    a.click();
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[65vh] gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">Preparando PDF...</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={handleOpenNewTab}>
          <ExternalLink className="mr-2 h-4 w-4" />Abrir em nova aba
        </Button>
        <Button size="sm" variant="outline" onClick={handleDownloadDirect}>
          <Download className="mr-2 h-4 w-4" />Baixar
        </Button>
      </div>

      {blobUrl && !embedFailed ? (
        <embed
          src={blobUrl}
          type="application/pdf"
          className="w-full rounded border"
          style={{ height: "65vh" }}
          onError={() => setEmbedFailed(true)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-[55vh] gap-4 rounded border border-dashed bg-muted/30">
          <FileText className="h-14 w-14 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium text-sm mb-1">{nome}</p>
            <p className="text-xs text-muted-foreground mb-4">Visualização em linha bloqueada pelo navegador.</p>
            <Button onClick={handleOpenNewTab}>
              <ExternalLink className="mr-2 h-4 w-4" />Abrir PDF em nova aba
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function getDocSelectLabel(d: any): { primary: string; secondary: string } {
  const tipo = getTipoDocumentalInfo(d.tipoDocumental);
  const tipoLabel = tipo ? `${tipo.icon} ${tipo.label}` : null;

  // Primary text: usa titulo > descricao > versão curta do código
  let primary = '';
  if (d.titulo && d.titulo !== d.codigoArquivo && d.titulo.trim().length > 0) {
    primary = d.titulo.length > 70 ? d.titulo.substring(0, 70) + '…' : d.titulo;
  } else if (d.descricao && d.descricao.trim().length > 0) {
    primary = d.descricao.length > 70 ? d.descricao.substring(0, 70) + '…' : d.descricao;
  } else {
    // Extrai partes do código padronizado: remove prefixo ECOBRASIL-CLIENTE-UF
    const code = (d.codigoArquivo || d.nome || '').replace(/\.(pdf|docx?|xlsx?|txt|png|jpg|zip)$/i, '');
    const parts = code.split('-');
    const short = parts.length > 3 ? parts.slice(2).join('-') : code;
    primary = short.length > 70 ? short.substring(0, 70) + '…' : short;
  }

  // Linha secundária: tipo + órgão + data + status
  const secondaryParts: string[] = [];
  if (tipoLabel) secondaryParts.push(tipoLabel);
  if (d.orgaoEmissor) secondaryParts.push(d.orgaoEmissor);
  if (d.dataEmissao) {
    const parts = String(d.dataEmissao).split('-');
    if (parts.length === 3) secondaryParts.push(`${parts[2]}/${parts[1]}/${parts[0]}`);
  } else if (d.dataUpload) {
    const dt = new Date(d.dataUpload);
    if (!isNaN(dt.getTime())) secondaryParts.push(dt.toLocaleDateString('pt-BR'));
  }
  if (d.status) secondaryParts.push(d.status);

  return { primary, secondary: secondaryParts.join(' · ') };
}

function formatDate(d: any) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(d));
}

function diasParaVencer(prazo: string | null): number | null {
  if (!prazo) return null;
  const hoje = new Date();
  const p = new Date(prazo);
  return Math.ceil((p.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function getRiscoColor(diffDays: number | null): string {
  if (diffDays === null) return "";
  if (diffDays < 0) return "text-red-700 bg-red-50 border-red-200";
  if (diffDays <= 7) return "text-red-600 bg-red-50 border-red-200";
  if (diffDays <= 15) return "text-orange-600 bg-orange-50 border-orange-200";
  return "text-yellow-600 bg-yellow-50 border-yellow-200";
}

// ─── FormattedTextList ─────────────────────────────────────────────────────────
// Renderiza texto com itens em tópicos (linhas que começam com ". " viram sub-itens)

function FormattedTextList({ text, className = "", maxLines }: { text: string; className?: string; maxLines?: number }) {
  const lines = text.split(/\n|\r\n/).map(l => l.trim()).filter(l => l.length > 0);

  const items: { text: string; sub: boolean }[] = [];
  for (const line of lines) {
    if (line.startsWith(". ") || line.startsWith("• ")) {
      items.push({ text: line.replace(/^[.•]\s+/, ""), sub: true });
    } else {
      items.push({ text: line, sub: false });
    }
  }

  const visibleItems = maxLines ? items.slice(0, maxLines) : items;
  const hasMore = maxLines ? items.length > maxLines : false;

  return (
    <ul className={`space-y-0.5 ${className}`}>
      {visibleItems.map((item, i) => (
        <li key={i} className={`flex items-start gap-1.5 ${item.sub ? "ml-4 text-[0.8em]" : ""}`}>
          <span className={`mt-1 shrink-0 ${item.sub ? "text-orange-400" : "text-orange-600"}`}>
            {item.sub ? "◦" : "•"}
          </span>
          <span>{item.text}</span>
        </li>
      ))}
      {hasMore && <li className="text-muted-foreground text-[0.8em] ml-1">...e mais {items.length - maxLines!} item(s)</li>}
    </ul>
  );
}

function FormattedTextListPurple({ text, className = "", maxLines }: { text: string; className?: string; maxLines?: number }) {
  const lines = text.split(/\n|\r\n/).map(l => l.trim()).filter(l => l.length > 0);

  const items: { text: string; sub: boolean }[] = [];
  for (const line of lines) {
    if (line.startsWith(". ") || line.startsWith("• ")) {
      items.push({ text: line.replace(/^[.•]\s+/, ""), sub: true });
    } else {
      items.push({ text: line, sub: false });
    }
  }

  const visibleItems = maxLines ? items.slice(0, maxLines) : items;
  const hasMore = maxLines ? items.length > maxLines : false;

  return (
    <ul className={`space-y-0.5 ${className}`}>
      {visibleItems.map((item, i) => (
        <li key={i} className={`flex items-start gap-1.5 ${item.sub ? "ml-4 text-[0.8em]" : ""}`}>
          <span className={`mt-1 shrink-0 ${item.sub ? "text-purple-400" : "text-purple-600"}`}>
            {item.sub ? "◦" : "•"}
          </span>
          <span>{item.text}</span>
        </li>
      ))}
      {hasMore && <li className="text-muted-foreground text-[0.8em] ml-1">...e mais {items.length - maxLines!} item(s)</li>}
    </ul>
  );
}

// ─── Modelos e Layouts Tab ─────────────────────────────────────────────────────

const TIPOS_MODELO = [
  { value: "relatorio",     label: "Relatório",       color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "oficio",        label: "Ofício",          color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "ata",           label: "Ata",             color: "bg-green-100 text-green-800 border-green-200" },
  { value: "memorando",     label: "Memorando",       color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "contrato",      label: "Contrato",        color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "comunicado",    label: "Comunicado",      color: "bg-pink-100 text-pink-800 border-pink-200" },
  { value: "proposta",      label: "Proposta",        color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { value: "planilha",      label: "Planilha",        color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "apresentacao",  label: "Apresentação",    color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { value: "outro",         label: "Outro",           color: "bg-gray-100 text-gray-700 border-gray-200" },
];

function tipoConfig(tipo: string) {
  return TIPOS_MODELO.find(t => t.value === tipo) ?? TIPOS_MODELO[TIPOS_MODELO.length - 1];
}

function mimeIcon(mime: string | null | undefined) {
  if (!mime) return <FileText className="h-8 w-8 text-muted-foreground" />;
  if (mime.includes("pdf"))          return <FileText className="h-8 w-8 text-red-500" />;
  if (mime.includes("word"))         return <FileText className="h-8 w-8 text-blue-500" />;
  if (mime.includes("sheet") || mime.includes("excel")) return <FileText className="h-8 w-8 text-green-600" />;
  if (mime.includes("presentation")) return <FileText className="h-8 w-8 text-orange-500" />;
  if (mime.includes("image"))        return <FileText className="h-8 w-8 text-purple-500" />;
  return <FileText className="h-8 w-8 text-muted-foreground" />;
}

function formatBytes(b: number | null | undefined) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

type ModeloLayout = {
  id: number; titulo: string; tipo: string; descricao: string | null;
  tags: string | null; versao: string; arquivoPath: string | null;
  arquivoNome: string | null; arquivoMime: string | null; arquivoTamanho: number | null;
  empreendimentoId: number | null; coresRgb: string | null;
  ativo: boolean; criadoPor: string | null; criadoEm: string;
};

function rgbToCss(rgb: string) {
  const parts = rgb.split(",").map(s => s.trim());
  if (parts.length === 3) return `rgb(${parts.join(",")})`;
  return "#ccc";
}

function parseCores(coresRgb: string | null): string[] {
  if (!coresRgb) return [];
  try { return JSON.parse(coresRgb).filter(Boolean); } catch { return []; }
}

function ModeloCard({
  modelo,
  empreendimentoNome,
  onEdit,
  onDelete,
  onDownload,
}: {
  modelo: ModeloLayout;
  empreendimentoNome?: string;
  onEdit: (m: ModeloLayout) => void;
  onDelete: (id: number) => void;
  onDownload: (id: number, nome: string) => void;
}) {
  const tc = tipoConfig(modelo.tipo);
  const tags = modelo.tags ? modelo.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
  const cores = parseCores(modelo.coresRgb);

  // Usa a primeira cor da paleta como borda lateral, ou o primary padrão
  const borderColor = cores.length > 0 ? rgbToCss(cores[0]) : "hsl(var(--primary))";

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow border-l-4" style={{ borderLeftColor: borderColor }}>
      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">{mimeIcon(modelo.arquivoMime)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm leading-tight line-clamp-2">{modelo.titulo}</h3>
              <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${tc.color}`}>{tc.label}</span>
            </div>
            {empreendimentoNome && (
              <p className="text-xs text-primary/80 font-medium mt-0.5 truncate">{empreendimentoNome}</p>
            )}
            {modelo.descricao && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{modelo.descricao}</p>
            )}
          </div>
        </div>

        {/* Paleta de cores */}
        {cores.length > 0 && (
          <div className="flex items-center gap-1.5">
            {cores.map((cor, i) => (
              <div key={i} className="relative group/swatch">
                <div
                  className="w-6 h-6 rounded-md border border-black/10 shadow-sm cursor-default flex-shrink-0"
                  style={{ backgroundColor: rgbToCss(cor) }}
                  title={`Cor ${i + 1}: RGB(${cor})`}
                />
                <div className="absolute bottom-7 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg border whitespace-nowrap opacity-0 group-hover/swatch:opacity-100 transition-opacity pointer-events-none z-10">
                  RGB({cor})
                </div>
              </div>
            ))}
            <span className="text-xs text-muted-foreground ml-1">{cores.length} cor{cores.length > 1 ? "es" : ""}</span>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map(tag => (
              <span key={tag} className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">#{tag}</span>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
          <div className="flex items-center gap-3">
            <span>v{modelo.versao}</span>
            {modelo.arquivoTamanho && <span>{formatBytes(modelo.arquivoTamanho)}</span>}
          </div>
          {modelo.arquivoNome && (
            <span className="truncate max-w-[120px]" title={modelo.arquivoNome}>{modelo.arquivoNome}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 pt-1 border-t">
          {modelo.arquivoPath && (
            <Button
              size="sm" variant="default" className="flex-1 gap-1.5 h-8 text-xs"
              onClick={() => onDownload(modelo.id, modelo.arquivoNome || "modelo")}
            >
              <Download className="h-3 w-3" />Baixar
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={() => onEdit(modelo)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm" variant="outline" className="h-8 px-2.5 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => onDelete(modelo.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const EMPTY_CORES = ["", "", "", ""];

function ModelosLayoutsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ModeloLayout | null>(null);

  // Form state
  const [formTitulo, setFormTitulo] = useState("");
  const [formTipo, setFormTipo] = useState("relatorio");
  const [formDescricao, setFormDescricao] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formVersao, setFormVersao] = useState("1.0");
  const [formEmpreendimentoId, setFormEmpreendimentoId] = useState<string>("");
  const [formCores, setFormCores] = useState<string[]>([...EMPTY_CORES]);
  const [formArquivo, setFormArquivo] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const { data: modelos = [], isLoading } = useQuery<ModeloLayout[]>({
    queryKey: ["/api/modelos-layouts", filterTipo, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterTipo !== "todos") params.set("tipo", filterTipo);
      if (q) params.set("q", q);
      const res = await fetch(`/api/modelos-layouts?${params}`);
      if (!res.ok) throw new Error("Erro ao carregar modelos");
      return res.json();
    },
  });

  const resetForm = () => {
    setFormTitulo(""); setFormTipo("relatorio"); setFormDescricao("");
    setFormTags(""); setFormVersao("1.0"); setFormEmpreendimentoId("");
    setFormCores([...EMPTY_CORES]); setFormArquivo(null); setEditing(null);
  };

  const handleNew = () => { resetForm(); setIsDialogOpen(true); };

  const handleEdit = (m: ModeloLayout) => {
    setEditing(m);
    setFormTitulo(m.titulo); setFormTipo(m.tipo);
    setFormDescricao(m.descricao || ""); setFormTags(m.tags || "");
    setFormVersao(m.versao);
    setFormEmpreendimentoId(m.empreendimentoId ? String(m.empreendimentoId) : "");
    const coresExistentes = parseCores(m.coresRgb);
    const coresPadded = [...coresExistentes, ...EMPTY_CORES].slice(0, 4);
    setFormCores(coresPadded);
    setFormArquivo(null);
    setIsDialogOpen(true);
  };

  const buildCoresJson = () => {
    const validas = formCores.map(c => c.trim()).filter(c => {
      const parts = c.split(",").map(p => p.trim());
      return parts.length === 3 && parts.every(p => !isNaN(Number(p)) && Number(p) >= 0 && Number(p) <= 255);
    });
    return validas.length > 0 ? JSON.stringify(validas) : null;
  };

  const handleSave = async () => {
    if (!formTitulo.trim()) {
      toast({ title: "Informe o título", variant: "destructive" }); return;
    }
    const coresJson = buildCoresJson();
    setIsSaving(true);
    try {
      if (editing) {
        await fetch(`/api/modelos-layouts/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titulo: formTitulo, tipo: formTipo,
            descricao: formDescricao || null, tags: formTags || null,
            versao: formVersao,
            empreendimentoId: formEmpreendimentoId || null,
            coresRgb: coresJson,
          }),
        });
        if (formArquivo) {
          const fd = new FormData();
          fd.append("titulo", formTitulo); fd.append("tipo", formTipo);
          fd.append("descricao", formDescricao); fd.append("tags", formTags);
          fd.append("versao", formVersao);
          if (formEmpreendimentoId) fd.append("empreendimentoId", formEmpreendimentoId);
          if (coresJson) fd.append("coresRgb", coresJson);
          fd.append("arquivo", formArquivo);
          await fetch("/api/modelos-layouts", { method: "POST", body: fd });
        }
        toast({ title: "Modelo atualizado com sucesso" });
      } else {
        const fd = new FormData();
        fd.append("titulo", formTitulo); fd.append("tipo", formTipo);
        if (formDescricao) fd.append("descricao", formDescricao);
        if (formTags) fd.append("tags", formTags);
        fd.append("versao", formVersao);
        if (formEmpreendimentoId) fd.append("empreendimentoId", formEmpreendimentoId);
        if (coresJson) fd.append("coresRgb", coresJson);
        if (formArquivo) fd.append("arquivo", formArquivo);
        const res = await fetch("/api/modelos-layouts", { method: "POST", body: fd });
        if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
        toast({ title: "Modelo cadastrado com sucesso" });
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/modelos-layouts"] });
      setIsDialogOpen(false); resetForm();
    } catch (err: any) {
      toast({ title: err.message || "Erro ao salvar modelo", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este modelo? Esta ação não pode ser desfeita.")) return;
    setIsDeleting(id);
    try {
      await fetch(`/api/modelos-layouts/${id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["/api/modelos-layouts"] });
      toast({ title: "Modelo excluído" });
    } catch {
      toast({ title: "Erro ao excluir modelo", variant: "destructive" });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDownload = async (id: number, nome: string) => {
    try {
      const res = await fetch(`/api/modelos-layouts/${id}/download`);
      if (!res.ok) throw new Error("Arquivo não encontrado");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nome; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao baixar arquivo", variant: "destructive" });
    }
  };

  const filtered = modelos.filter(m =>
    !q || m.titulo.toLowerCase().includes(q.toLowerCase()) ||
    (m.tags || "").toLowerCase().includes(q.toLowerCase()) ||
    (m.descricao || "").toLowerCase().includes(q.toLowerCase())
  );

  const countByTipo = TIPOS_MODELO.reduce((acc, t) => {
    acc[t.value] = modelos.filter(m => m.tipo === t.value).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-2xl font-bold text-primary">{modelos.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total de Modelos</div>
        </Card>
        {["relatorio", "oficio", "ata"].map(tipo => (
          <Card key={tipo} className="p-3">
            <div className="text-2xl font-bold">{countByTipo[tipo] || 0}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{tipoConfig(tipo).label}s</div>
          </Card>
        ))}
      </div>

      {/* Barra de controle */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center flex-1">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, tags..."
              className="pl-9"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPOS_MODELO.map(t => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label} {countByTipo[t.value] ? `(${countByTipo[t.value]})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(q || filterTipo !== "todos") && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setFilterTipo("todos"); }}>
              <XCircle className="h-4 w-4 mr-1" />Limpar
            </Button>
          )}
        </div>
        <Button className="gap-2" onClick={handleNew}>
          <Plus className="h-4 w-4" />Novo Modelo
        </Button>
      </div>

      {/* Grade de cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="h-52 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground space-y-3">
          <LayoutGrid className="h-12 w-12 mx-auto opacity-30" />
          <div>
            <p className="font-medium text-base">Nenhum modelo encontrado</p>
            <p className="text-sm mt-1">
              {q || filterTipo !== "todos" ? "Tente ajustar os filtros" : "Clique em \"Novo Modelo\" para cadastrar o primeiro"}
            </p>
          </div>
          {!q && filterTipo === "todos" && (
            <Button variant="outline" onClick={handleNew} className="gap-2 mt-2">
              <Plus className="h-4 w-4" />Novo Modelo
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(m => {
            const emp = m.empreendimentoId
              ? (empreendimentos as any[]).find((e: any) => e.id === m.empreendimentoId)
              : null;
            const empNome = emp ? (emp.nome || emp.nomeFantasia || `#${emp.id}`) : undefined;
            return (
              <ModeloCard
                key={m.id}
                modelo={m}
                empreendimentoNome={empNome}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDownload={handleDownload}
              />
            );
          })}
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={isDialogOpen} onOpenChange={open => { if (!open) { setIsDialogOpen(false); resetForm(); } else setIsDialogOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-primary" />
              {editing ? "Editar Modelo" : "Novo Modelo"}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 py-2 pr-1">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                placeholder="Ex: Modelo de Relatório Semestral de Monitoramento"
                value={formTitulo}
                onChange={e => setFormTitulo(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={formTipo} onValueChange={setFormTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_MODELO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Versão</Label>
                <Input
                  placeholder="1.0"
                  value={formVersao}
                  onChange={e => setFormVersao(e.target.value)}
                />
              </div>
            </div>

            {/* Empreendimento */}
            <div className="space-y-1.5">
              <Label>Empreendimento <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Select value={formEmpreendimentoId || "nenhum"} onValueChange={v => setFormEmpreendimentoId(v === "nenhum" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o empreendimento..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem empreendimento</SelectItem>
                  {(empreendimentos as any[]).map((e: any) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.nome || e.nomeFantasia || `#${e.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Paleta de cores RGB */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Paleta de cores RGB
                <span className="text-muted-foreground text-xs font-normal">(até 4 cores — formato: R,G,B)</span>
              </Label>
              <div className="grid grid-cols-1 gap-2">
                {formCores.map((cor, i) => {
                  const valida = cor.trim().split(",").length === 3 &&
                    cor.trim().split(",").every(p => !isNaN(Number(p.trim())) && Number(p.trim()) >= 0 && Number(p.trim()) <= 255);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      {/* Swatch preview */}
                      <div
                        className="w-8 h-8 rounded-md border border-black/10 shadow-sm flex-shrink-0 transition-colors"
                        style={{ backgroundColor: valida && cor.trim() ? rgbToCss(cor) : "transparent", border: "1px solid hsl(var(--border))" }}
                      />
                      <div className="flex-1">
                        <Input
                          placeholder={`Cor ${i + 1} — Ex: 0,89,156`}
                          value={cor}
                          onChange={e => {
                            const novas = [...formCores];
                            novas[i] = e.target.value;
                            setFormCores(novas);
                          }}
                          className={`font-mono text-sm ${cor && !valida ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                        />
                      </div>
                      {cor && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground p-1"
                          onClick={() => {
                            const novas = [...formCores];
                            novas[i] = "";
                            setFormCores(novas);
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Preview da paleta */}
              {formCores.some(c => c.trim()) && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">Prévia:</span>
                  <div className="flex gap-1.5">
                    {formCores.map((cor, i) => {
                      const valida = cor.trim().split(",").length === 3 &&
                        cor.trim().split(",").every(p => !isNaN(Number(p.trim())) && Number(p.trim()) >= 0 && Number(p.trim()) <= 255);
                      if (!cor.trim() || !valida) return null;
                      return (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                          <div
                            className="w-8 h-8 rounded-lg border border-black/10 shadow"
                            style={{ backgroundColor: rgbToCss(cor) }}
                          />
                          <span className="text-[10px] text-muted-foreground">{i + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva brevemente o propósito deste modelo..."
                rows={2}
                value={formDescricao}
                onChange={e => setFormDescricao(e.target.value)}
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tags <span className="text-muted-foreground text-xs">(separadas por vírgula)</span></Label>
              <Input
                placeholder="Ex: monitoramento, semestral, fauna"
                value={formTags}
                onChange={e => setFormTags(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{editing ? "Substituir arquivo (opcional)" : "Arquivo do modelo"}</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-colors"
                onClick={() => document.getElementById("modelo-arquivo-input")?.click()}
              >
                {formArquivo ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium">{formArquivo.name}</span>
                    <span className="text-muted-foreground">({formatBytes(formArquivo.size)})</span>
                  </div>
                ) : editing && editing.arquivoNome ? (
                  <div className="text-sm text-muted-foreground">
                    <Download className="h-4 w-4 mx-auto mb-1 opacity-50" />
                    Arquivo atual: <span className="font-medium text-foreground">{editing.arquivoNome}</span>
                    <p className="text-xs mt-1">Clique para substituir</p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <Upload className="h-4 w-4 mx-auto mb-1 opacity-50" />
                    Clique para selecionar o arquivo
                    <p className="text-xs mt-1">PDF, Word, Excel, PowerPoint, imagem (até 30 MB)</p>
                  </div>
                )}
                <input
                  id="modelo-arquivo-input"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt"
                  onChange={e => setFormArquivo(e.target.files?.[0] || null)}
                />
              </div>
            </div>
          </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isSaving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar modelo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Componente Principal ──────────────────────────────────────────────────────

type DatasetExt = Dataset & { empreendimentoNome?: string };

export default function GestaoDados() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [demandaPendente, setDemandaPendente] = useState<{ id: number; titulo: string } | null>(null);
  const [activeTab, setActiveTab] = useState("documentos");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEmpreendimento, setFilterEmpreendimento] = useState("all");
  const [filterTipoDocumental, setFilterTipoDocumental] = useState("all");
  const [filterStatusDocumental, setFilterStatusDocumental] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [groupByEmp, setGroupByEmp] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [dictionarySearch, setDictionarySearch] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [timelineEmpFilter, setTimelineEmpFilter] = useState("all");

  // Upload dialog
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState("");
  const [useAdvancedForm, setUseAdvancedForm] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState(0);

  // Upload form fields
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("");
  const [projeto, setProjeto] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [entrega, setEntrega] = useState("");
  const [status, setStatus] = useState("RASC");
  const [titulo, setTitulo] = useState("");
  const [codigoPreview, setCodigoPreview] = useState("");
  const [pastaDestino, setPastaDestino] = useState("");
  // Novos campos
  const [tipoDocumental, setTipoDocumental] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [orgaoEmissor, setOrgaoEmissor] = useState("");
  const [prazoAtendimento, setPrazoAtendimento] = useState("");
  const [statusDocumental, setStatusDocumental] = useState("recebido");
  const [documentoRelacionadoId, setDocumentoRelacionadoId] = useState("");
  const [vinculoTipo, setVinculoTipo] = useState("");
  const [exigencias, setExigencias] = useState("");
  const [resumoIA, setResumoIA] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [licencaVinculadaId, setLicencaVinculadaId] = useState<string>("");
  const [licencaVinculoTipoUpload, setLicencaVinculoTipoUpload] = useState<string>("");
  const [condicionanteSelecionadaId, setCondicionanteSelecionadaId] = useState<string>("");
  const [selectedResponsavel, setSelectedResponsavel] = useState("");
  const [selectedProjetoId, setSelectedProjetoId] = useState<string>("");
  const [selectedCampanhaId, setSelectedCampanhaId] = useState<string>("");
  const [isExtractingIA, setIsExtractingIA] = useState(false);

  // Edit dialog
  const [editingDataset, setEditingDataset] = useState<DatasetExt | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFields, setEditFields] = useState<Partial<DatasetExt>>({});

  // Análise completa IA
  const [isAnalisandoIA, setIsAnalisandoIA] = useState(false);
  const [analiseCompletaResult, setAnaliseCompletaResult] = useState<any | null>(null);
  const [isAnaliseModalOpen, setIsAnaliseModalOpen] = useState(false);

  // Preview & History
  const [previewDataset, setPreviewDataset] = useState<DatasetExt | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyDataset, setHistoryDataset] = useState<DatasetExt | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailDataset, setDetailDataset] = useState<DatasetExt | null>(null);

  // Folder management
  const [selectedPasta, setSelectedPasta] = useState<DatasetPasta | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [parentFolderId, setParentFolderId] = useState<number | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [folderPassword, setFolderPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<"create" | "delete" | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Gerar demanda from exigência
  const [isGerarDemandaOpen, setIsGerarDemandaOpen] = useState(false);
  const [demandaDoc, setDemandaDoc] = useState<DatasetExt | null>(null);
  const [novaDemandaTitulo, setNovaDemandaTitulo] = useState("");
  const [novaDemandaPrazo, setNovaDemandaPrazo] = useState("");
  const [novaDemandaResponsavel, setNovaDemandaResponsavel] = useState("");

  // Demanda pendente
  useEffect(() => {
    const stored = localStorage.getItem("demandaPendenteConclusao");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.id && parsed?.titulo) setDemandaPendente(parsed);
      } catch { localStorage.removeItem("demandaPendenteConclusao"); }
    }
  }, []);

  const concluirDemandaPendente = async () => {
    if (!demandaPendente) return;
    try {
      const res = await fetch(`/api/demandas/${demandaPendente.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ status: "concluido" }),
      });
      if (res.ok) {
        toast({ title: "Demanda Concluída!", description: `"${demandaPendente.titulo}" concluída com sucesso.` });
        queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
        localStorage.removeItem("demandaPendenteConclusao");
        setDemandaPendente(null);
      }
    } catch { toast({ title: "Erro de conexão", variant: "destructive" }); }
  };

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: currentUser } = useQuery<User & { nome?: string }>({ queryKey: ["/api/auth/user"] });

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: async () => {
      const res = await fetch("/api/empreendimentos", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar empreendimentos");
      return res.json();
    },
  });

  const { data: usuarios = [] } = useQuery<User[]>({
    queryKey: ["/api/team-members"],
    queryFn: async () => {
      const res = await fetch("/api/team-members", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Licenças do empreendimento selecionado (para vincular documentos no upload)
  const { data: licencasDoEmpreendimento = [] } = useQuery<any[]>({
    queryKey: ["/api/empreendimentos", selectedEmpreendimento, "licencas"],
    queryFn: async () => {
      if (!selectedEmpreendimento || selectedEmpreendimento === "") return [];
      const res = await fetch(`/api/empreendimentos/${selectedEmpreendimento}/licencas`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedEmpreendimento && selectedEmpreendimento !== "",
  });

  // Projetos do empreendimento selecionado
  const { data: projetosDoEmpreendimento = [] } = useQuery<any[]>({
    queryKey: ["/api/projetos", selectedEmpreendimento],
    queryFn: async () => {
      if (!selectedEmpreendimento) return [];
      const res = await fetch(`/api/projetos?empreendimentoId=${selectedEmpreendimento}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedEmpreendimento,
  });

  // Campanhas do empreendimento selecionado (filtradas client-side)
  const { data: todasCampanhas = [] } = useQuery<any[]>({
    queryKey: ["/api/campanhas"],
    queryFn: async () => {
      const res = await fetch(`/api/campanhas`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const campanhasDoEmpreendimento = selectedEmpreendimento
    ? todasCampanhas.filter((c: any) => String(c.empreendimentoId) === selectedEmpreendimento)
    : [];

  // Condicionantes da licença selecionada no upload (para auto-evidência)
  const { data: condicionantesDaLicenca = [], isFetching: isFetchingCondicionantes } = useQuery<any[]>({
    queryKey: ["/api/licencas", licencaVinculadaId, "condicionantes"],
    queryFn: async () => {
      if (!licencaVinculadaId || licencaVinculadaId === "") return [];
      const res = await fetch(`/api/licencas/${licencaVinculadaId}/condicionantes`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!licencaVinculadaId && licencaVinculadaId !== "" && licencaVinculoTipoUpload === "cumprimento_condicionante",
  });

  // Licenças do empreendimento do documento sendo editado
  const { data: licencasEditando = [] } = useQuery<any[]>({
    queryKey: ["/api/empreendimentos", editingDataset?.empreendimentoId, "licencas"],
    queryFn: async () => {
      if (!editingDataset?.empreendimentoId) return [];
      const res = await fetch(`/api/empreendimentos/${editingDataset.empreendimentoId}/licencas`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!editingDataset?.empreendimentoId,
  });

  const { data: rhRecords = [] } = useQuery<{ id: number; nomeColaborador: string; contatoEmail?: string | null }[]>({
    queryKey: ["/api/rh"],
    queryFn: async () => {
      const res = await fetch("/api/rh", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Combined & deduplicated list of responsável options: system users first, then RH-only
  const responsavelOptions = useMemo(() => {
    const opts: { value: string; label: string; sub?: string }[] = [];
    const seenEmails = new Set<string>();

    // System users first
    for (const u of usuarios) {
      const emailKey = u.email.toLowerCase();
      if (!seenEmails.has(emailKey)) {
        seenEmails.add(emailKey);
        const displayName = u.nome || u.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        opts.push({ value: u.email, label: displayName, sub: u.cargo || undefined });
      }
    }

    // RH-only people not already in system users
    for (const rh of rhRecords) {
      const emailKey = rh.contatoEmail?.toLowerCase();
      if (emailKey && seenEmails.has(emailKey)) continue; // already added via system user
      const value = rh.contatoEmail || rh.nomeColaborador;
      const valueKey = value.toLowerCase();
      if (seenEmails.has(valueKey)) continue;
      seenEmails.add(valueKey);
      opts.push({ value, label: rh.nomeColaborador, sub: "RH" });
    }

    return opts;
  }, [usuarios, rhRecords]);

  const { data: datasets = [], isLoading, refetch } = useQuery<DatasetExt[]>({
    queryKey: ["/api/datasets", { empreendimentoId: filterEmpreendimento }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterEmpreendimento !== "all") params.append("empreendimentoId", filterEmpreendimento);
      const res = await fetch(`/api/datasets?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar arquivos");
      return res.json();
    },
  });

  const { data: alertas = [], isLoading: alertasLoading } = useQuery<any[]>({
    queryKey: ["/api/datasets/alertas"],
    queryFn: async () => {
      const res = await fetch("/api/datasets/alertas", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: pastas = [], isLoading: pastasLoading, refetch: refetchPastas } = useQuery<DatasetPasta[]>({
    queryKey: ["/api/pastas"],
    queryFn: async () => {
      const res = await fetch("/api/pastas", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: selectedFolderFiles = [], refetch: refetchFolderFiles } = useQuery<Dataset[]>({
    queryKey: ["/api/pastas", selectedPasta?.id, "arquivos"],
    queryFn: async () => {
      if (!selectedPasta?.id) return [];
      const res = await fetch(`/api/pastas/${selectedPasta.id}/arquivos`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedPasta?.id,
  });

  const { data: versoes = [] } = useQuery<any[]>({
    queryKey: ["/api/datasets", historyDataset?.id, "versoes"],
    queryFn: async () => {
      if (!historyDataset?.id) return [];
      const res = await fetch(`/api/datasets/${historyDataset.id}/versoes`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!historyDataset?.id,
  });

  // Status dos modelos de IA
  const { data: aiModelsData } = useQuery<{
    models: { model: string; configured: boolean; isPlaceholder: boolean; baseUrl: string | null; role: string; priority: number }[];
    system: { gmPath: string; pdftoppmPath: string; gmAvailable: boolean; pdftoppmAvailable: boolean };
  }>({
    queryKey: ["/api/datasets/ai-models-status"],
    staleTime: 60 * 1000,
  });
  const aiModels = aiModelsData?.models ?? [];
  const aiSystem = aiModelsData?.system;
  const [pingResults, setPingResults] = useState<Record<string, { reachable: boolean; latencyMs?: number; error?: string; loading?: boolean }>>({});

  async function pingModel(baseUrl: string) {
    setPingResults(prev => ({ ...prev, [baseUrl]: { reachable: false, loading: true } }));
    try {
      const resp = await fetch('/api/datasets/ai-models-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ baseUrl }),
      });
      const data = await resp.json();
      setPingResults(prev => ({ ...prev, [baseUrl]: { ...data, loading: false } }));
    } catch {
      setPingResults(prev => ({ ...prev, [baseUrl]: { reachable: false, error: 'Falha de rede', loading: false } }));
    }
  }

  // ── Auto-inicializar pastas ───────────────────────────────────────────────────
  const [autoInitialized, setAutoInitialized] = useState(false);
  useEffect(() => {
    if (!pastasLoading && pastas.length === 0 && !autoInitialized) {
      setAutoInitialized(true);
      fetch("/api/datasets/estrutura/macro", { method: "POST", credentials: "include" })
        .then(res => { if (res.ok) queryClient.invalidateQueries({ queryKey: ["/api/pastas"] }); })
        .catch(console.error);
    }
  }, [pastasLoading, pastas.length, autoInitialized]);

  // ── Auto-preenchimento ao selecionar empreendimento ──────────────────────────
  useEffect(() => {
    if (!selectedEmpreendimento || !useAdvancedForm) return;
    const emp = empreendimentos.find(e => e.id.toString() === selectedEmpreendimento);
    if (!emp) return;
    if (emp.nome) setProjeto(emp.nome);
  }, [selectedEmpreendimento, useAdvancedForm]);

  // ── Handler tipo documental: auto-gera nome e número ─────────────────────────
  function handleTipoDocumentalChange(value: string) {
    setTipoDocumental(value);
    const emp = empreendimentos.find(e => e.id.toString() === selectedEmpreendimento);
    const empNome = emp?.nome || "";
    // Auto-gera nome no padrão: SIGLA - Empreendimento - Ano
    if (!nome) {
      setNome(gerarNomeDocumento(value, empNome, dataEmissao));
    }
    // Auto-gera número no padrão: SIGLA-NNN/AAAA
    if (!numeroDocumento) {
      setNumeroDocumento(gerarNumeroDocumento(value, datasets));
    }
  }

  // ── Preview código ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (useAdvancedForm && (projeto || disciplina || tipoDocumento)) generateCodePreview();
  }, [projeto, disciplina, tipoDocumento, entrega, status, file]);

  const generateCodePreview = async () => {
    try {
      const extensao = file?.name?.split('.').pop() || '';
      const res = await fetch("/api/datasets/gerar-codigo", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ projeto, disciplina, tipoDocumento, entrega, status, extensao }),
      });
      if (res.ok) { const d = await res.json(); setCodigoPreview(d.codigo); setPastaDestino(d.pastaDestino); }
    } catch {}
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createFolderMutation = useMutation({
    mutationFn: async (data: { nome: string; paiId?: number | null; empreendimentoId?: number }) => {
      const res = await fetch("/api/pastas", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erro ao criar pasta"); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/pastas"] }); refetchPastas(); toast({ title: "Pasta criada com sucesso!" }); setIsCreateFolderOpen(false); setNewFolderName(""); setParentFolderId(null); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (data: { id: number; senha: string }) => {
      const res = await fetch(`/api/pastas/${data.id}`, { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senha: data.senha }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erro ao excluir pasta"); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/pastas"] }); refetchPastas(); if (selectedPasta) setSelectedPasta(null); toast({ title: "Pasta excluída com sucesso!" }); setIsPasswordDialogOpen(false); setFolderPassword(""); setPendingAction(null); setPendingDeleteId(null); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const createFileInFolderMutation = useMutation({
    mutationFn: async (data: { pastaId: number; nome: string; objectPath: string; tipo?: string; tamanho?: number; empreendimentoId: number }) => {
      const res = await fetch(`/api/pastas/${data.pastaId}/arquivos`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Erro ao registrar arquivo");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/pastas", selectedPasta?.id, "arquivos"] }); queryClient.invalidateQueries({ queryKey: ["/api/datasets"] }); refetchFolderFiles(); refetch(); toast({ title: "Arquivo enviado e registrado!" }); if (demandaPendente) concluirDemandaPendente(); },
    onError: () => toast({ title: "Erro", description: "Falha ao registrar arquivo.", variant: "destructive" }),
  });

  const uploadAdvancedMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/datasets/upload-avancado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        let errMsg = `Erro ${res.status}`;
        try { const body = await res.json(); errMsg = body.error || body.message || errMsg; } catch (_) {}
        throw new Error(errMsg);
      }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/datasets"] }); queryClient.invalidateQueries({ queryKey: ["/api/licencas"] }); queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] }); refetch(); toast({ title: "Documento enviado com código padronizado!" }); resetForm(); setIsUploadDialogOpen(false); setIsUploading(false); if (demandaPendente) concluirDemandaPendente(); },
    onError: (e: Error) => { toast({ title: "Erro ao enviar documento", description: e.message, variant: "destructive" }); setIsUploading(false); },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        let errMsg = `Erro ${res.status}`;
        try { const body = await res.json(); errMsg = body.error || body.message || errMsg; } catch (_) {}
        throw new Error(errMsg);
      }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/datasets"] }); queryClient.invalidateQueries({ queryKey: ["/api/licencas"] }); queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] }); refetch(); toast({ title: "Arquivo enviado!" }); resetForm(); setIsUploadDialogOpen(false); setIsUploading(false); if (demandaPendente) concluirDemandaPendente(); },
    onError: (e: Error) => { toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" }); setIsUploading(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/datasets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir arquivo");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/datasets"] }); refetch(); toast({ title: "Arquivo excluído!" }); },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, any> }) => {
      const res = await fetch(`/api/datasets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Erro ao atualizar");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/datasets"] }); queryClient.invalidateQueries({ queryKey: ["/api/licencas"] }); queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] }); refetch(); toast({ title: "Documento atualizado!" }); setIsEditDialogOpen(false); setEditingDataset(null); },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const gerarDemandaMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/demandas", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Erro ao gerar demanda");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/demandas"] }); toast({ title: "Demanda criada com sucesso!", description: "A exigência foi convertida em tarefa no módulo de Demandas." }); setIsGerarDemandaOpen(false); setDemandaDoc(null); setNovaDemandaTitulo(""); setNovaDemandaPrazo(""); setNovaDemandaResponsavel(""); },
    onError: () => toast({ title: "Erro ao criar demanda", variant: "destructive" }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setNome(""); setDescricao(""); setTipo(""); setFile(null);
    setSelectedEmpreendimento(""); setSelectedResponsavel(""); setProjeto("");
    setSelectedProjetoId(""); setSelectedCampanhaId("");
    setDisciplina(""); setTipoDocumento(""); setEntrega(""); setStatus("RASC");
    setTitulo(""); setCodigoPreview(""); setPastaDestino("");
    setTipoDocumental(""); setNumeroDocumento(""); setOrgaoEmissor("");
    setPrazoAtendimento(""); setStatusDocumental("recebido"); setDataEmissao("");
    setDocumentoRelacionadoId(""); setVinculoTipo(""); setExigencias(""); setResumoIA("");
    setLicencaVinculadaId(""); setLicencaVinculoTipoUpload(""); setCondicionanteSelecionadaId("");
  };

  const handleUpload = async () => {
    if (!selectedEmpreendimento || !file) {
      toast({ title: "Selecione o empreendimento e o arquivo.", variant: "destructive" }); return;
    }
    setIsUploading(true);
    try {
      // 1. Enviar arquivo em chunks de 2 MB para contornar limite do proxy nginx
      const CHUNK_SIZE = 2 * 1024 * 1024;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const sessionId = crypto.randomUUID();
      let filePath = "";

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);

        const fd = new FormData();
        fd.append("chunk", chunkBlob, file.name);
        fd.append("sessionId", sessionId);
        fd.append("chunkIndex", String(i));
        fd.append("totalChunks", String(totalChunks));
        fd.append("fileName", file.name);
        fd.append("fileType", file.type || "application/octet-stream");

        const chunkRes = await fetch("/api/object-storage/upload-url", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        if (!chunkRes.ok) {
          const err = await chunkRes.json().catch(() => ({}));
          throw new Error(err.error || `Erro ao enviar chunk ${i + 1}/${totalChunks} (${chunkRes.status})`);
        }
        const result = await chunkRes.json();
        if (result.status === "complete") filePath = result.filePath;
      }

      if (!filePath) throw new Error("Upload incompleto — URL do arquivo não retornada");

      // 2. Registrar metadados no banco com a URL do arquivo
      const base = {
        empreendimentoId: parseInt(selectedEmpreendimento),
        responsavel: selectedResponsavel || currentUser?.email || "",
        descricao, tipoDocumental, numeroDocumento, orgaoEmissor, prazoAtendimento,
        statusDocumental, documentoRelacionadoId: documentoRelacionadoId || null,
        vinculoTipo, exigencias, resumoIA, dataEmissao: dataEmissao || null,
        licencaId: licencaVinculadaId ? parseInt(licencaVinculadaId) : null,
        licencaVinculoTipo: licencaVinculoTipoUpload || null,
        condicionanteId: condicionanteSelecionadaId ? parseInt(condicionanteSelecionadaId) : null,
        projetoVinculoId: selectedProjetoId ? parseInt(selectedProjetoId) : null,
        campanhaVinculoId: selectedCampanhaId ? parseInt(selectedCampanhaId) : null,
      };
      if (useAdvancedForm) {
        uploadAdvancedMutation.mutate({
          ...base, nome: file.name, tipo: file.type || "outro", tamanho: file.size,
          url: filePath, projeto, disciplina,
          tipoDocumento, entrega, status, titulo, pastaDestino,
        });
      } else {
        uploadMutation.mutate({
          ...base, empreendimentoId: parseInt(selectedEmpreendimento),
          nome: nome || file.name, tipo: tipo || "outro", tamanho: file.size,
          usuario: currentUser?.email || "Usuário", url: filePath,
          dataUpload: new Date().toISOString(), pastaDestino,
        });
      }
    } catch (err: any) {
      toast({ title: "Erro ao enviar documento", description: err.message, variant: "destructive" });
      setIsUploading(false);
    }
  };

  const handleComprimir = async () => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      toast({ title: "Selecione um arquivo PDF para comprimir.", variant: "destructive" });
      return;
    }
    setIsCompressing(true);
    setCompressProgress(0);
    try {
      toast({ title: "Comprimindo PDF...", description: "Aguarde, isso pode levar alguns segundos." });
      const originalMB = (file.size / 1024 / 1024).toFixed(2);
      const compressed = await comprimirPdf(file, 0.9, 0.75, setCompressProgress);
      const compressedMB = (compressed.size / 1024 / 1024).toFixed(2);
      const reduction = Math.round((1 - compressed.size / file.size) * 100);
      setFile(compressed);
      setCompressProgress(100);
      toast({
        title: "PDF comprimido com sucesso!",
        description: `${originalMB} MB → ${compressedMB} MB (redução de ${reduction}%)`,
      });
    } catch (err: any) {
      toast({ title: "Erro ao comprimir PDF", description: err.message, variant: "destructive" });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleExtractIA = async () => {
    if (!file) { toast({ title: "Selecione um arquivo primeiro.", variant: "destructive" }); return; }
    setIsExtractingIA(true);
    try {
      let texto = "";
      const isText = file.type.startsWith("text/") || file.name.endsWith(".txt");

      if (isText) {
        // Texto puro: lê direto no browser
        texto = await file.text();
      } else {
        // PDF, imagem ou qualquer outro formato → envia para o servidor (usa pdf-parse ou Gemini Vision)
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/ai/upload-doc", { method: "POST", credentials: "include", body: formData });
        if (uploadRes.ok) {
          const d = await uploadRes.json();
          texto = d.text || "";
        } else {
          // Mostra a mensagem real do servidor
          let errMsg = "Não foi possível extrair texto do arquivo.";
          try { const errBody = await uploadRes.json(); errMsg = errBody.message || errMsg; } catch (_) {}
          toast({ title: "Erro na extração", description: errMsg, variant: "destructive" });
          return;
        }
      }
      if (!texto.trim()) {
        toast({ title: "Documento sem texto extraível", description: "O arquivo parece estar em branco ou é uma imagem sem texto reconhecível.", variant: "destructive" });
        return;
      }
      const res = await fetch("/api/datasets/ai-extrair", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ texto, nomeArquivo: file.name }),
      });
      if (!res.ok) throw new Error("Erro na extração");
      const extracted = await res.json();
      const tipoExtract = (extracted.tipoDocumental && extracted.tipoDocumental !== "null") ? extracted.tipoDocumental : tipoDocumental;
      if (tipoExtract) setTipoDocumental(tipoExtract);
      if (extracted.orgaoEmissor && extracted.orgaoEmissor !== "null") setOrgaoEmissor(extracted.orgaoEmissor);
      const dataExtract = extracted.dataEmissao && extracted.dataEmissao !== "null" ? extracted.dataEmissao : "";
      if (dataExtract) setDataEmissao(dataExtract);
      if (extracted.prazoAtendimento && extracted.prazoAtendimento !== "null") setPrazoAtendimento(extracted.prazoAtendimento);
      if (extracted.exigencias && extracted.exigencias !== "null") setExigencias(extracted.exigencias);
      if (extracted.resumoIA) setResumoIA(extracted.resumoIA);
      // Nome: usa o extraído ou gera automaticamente com sigla + empreendimento + ano
      if (tipoExtract && !nome) {
        const empAtual = empreendimentos.find(e => e.id.toString() === selectedEmpreendimento);
        setNome(gerarNomeDocumento(tipoExtract, empAtual?.nome || "", dataExtract));
      }
      // Número: usa o extraído pela IA ou gera automaticamente
      const numExtract = extracted.numeroDocumento && extracted.numeroDocumento !== "null" ? extracted.numeroDocumento : "";
      if (numExtract) {
        setNumeroDocumento(numExtract);
      } else if (!numeroDocumento && tipoExtract) {
        const autoNum = gerarNumeroDocumento(tipoExtract, datasets);
        setNumeroDocumento(autoNum);
        toast({ title: "IA extraiu os metadados!", description: `Número gerado: ${autoNum}. Revise os campos preenchidos.` });
      } else {
        toast({ title: "IA extraiu os metadados!", description: `Confiança: ${extracted.confianca || "—"}. Revise os campos preenchidos automaticamente.` });
      }
    } catch (e: any) {
      toast({ title: "Erro na extração IA", description: e.message, variant: "destructive" });
    } finally { setIsExtractingIA(false); }
  };

  const handleEdit = (d: DatasetExt) => {
    setEditingDataset(d);
    setEditFields({
      nome: d.nome, descricao: d.descricao || "", titulo: d.titulo || "",
      status: d.status || "RASC", classificacao: d.classificacao || "INT",
      responsavel: d.responsavel || "",
      tipoDocumental: d.tipoDocumental || "", numeroDocumento: d.numeroDocumento || "",
      orgaoEmissor: d.orgaoEmissor || "", prazoAtendimento: d.prazoAtendimento || "",
      dataEmissao: (d as any).dataEmissao || "",
      statusDocumental: d.statusDocumental || "recebido", vinculoTipo: d.vinculoTipo || "",
      exigencias: d.exigencias || "", resumoIA: d.resumoIA || "",
      documentoRelacionadoId: d.documentoRelacionadoId || undefined,
      licencaId: (d as any).licencaId || undefined,
      licencaVinculoTipo: (d as any).licencaVinculoTipo || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingDataset) return;
    editMutation.mutate({ id: editingDataset.id, data: editFields });
  };

  const handleAnalisarIACompleta = async () => {
    if (!editingDataset) return;
    setIsAnalisandoIA(true);
    try {
      const res = await fetch(`/api/datasets/${editingDataset.id}/ai-analise`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      });
      if (!res.ok) {
        let errMsg = "Falha na análise por IA.";
        try {
          const body = await res.json();
          errMsg = body.error || errMsg;
        } catch {
          try { errMsg = (await res.text()).slice(0, 200) || errMsg; } catch { /* noop */ }
        }
        toast({ title: "Erro na análise IA", description: errMsg, variant: "destructive" });
        return;
      }
      const result = await res.json();
      // Preencher automaticamente os campos do formulário de edição
      setEditFields(prev => ({
        ...prev,
        tipoDocumental: result.tipoDocumental || prev.tipoDocumental,
        titulo: result.titulo || prev.titulo,
        numeroDocumento: result.numeroDocumento || prev.numeroDocumento,
        orgaoEmissor: result.orgaoEmissor || prev.orgaoEmissor,
        dataEmissao: result.dataEmissao || (prev as any).dataEmissao,
        prazoAtendimento: result.prazoAtendimento || prev.prazoAtendimento,
        exigencias: result.exigencias || prev.exigencias,
        resumoIA: result.resumoIA || prev.resumoIA,
      }));
      setAnaliseCompletaResult(result.analiseCompleta || result);
      setIsAnaliseModalOpen(true);
      toast({
        title: "Análise completa concluída!",
        description: `Campos preenchidos automaticamente. Confiança: ${result.confianca || "—"}. Confira o relatório completo.`,
      });
    } catch (e: any) {
      toast({ title: "Erro de conexão", description: e.message, variant: "destructive" });
    } finally {
      setIsAnalisandoIA(false);
    }
  };

  const handleGerarDemanda = (d: DatasetExt) => {
    setDemandaDoc(d);
    setNovaDemandaTitulo(d.exigencias ? `Atender exigência: ${d.codigoArquivo || d.nome}` : `Atender documento: ${d.codigoArquivo || d.nome}`);
    setNovaDemandaPrazo(d.prazoAtendimento || "");
    setNovaDemandaResponsavel(d.responsavel || "");
    setIsGerarDemandaOpen(true);
  };

  const handleSubmitGerarDemanda = () => {
    if (!demandaDoc || !novaDemandaTitulo) return;
    gerarDemandaMutation.mutate({
      titulo: novaDemandaTitulo,
      descricao: `Gerado automaticamente a partir do documento ${demandaDoc.codigoArquivo || demandaDoc.nome}.\n\nExigências:\n${demandaDoc.exigencias || "Ver documento original."}`,
      prazo: novaDemandaPrazo || null,
      responsavel: novaDemandaResponsavel || null,
      status: "pendente", prioridade: "alta",
      empreendimentoId: demandaDoc.empreendimentoId,
    });
  };

  const handleDownload = (d: DatasetExt) => {
    // Todos os arquivos passam pelo endpoint autenticado do servidor
    const link = document.createElement("a");
    link.href = `/api/datasets/${d.id}/download`;
    link.download = d.nome;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const getUploadParameters = async () => {
    const res = await fetch("/api/object-storage/upload-url", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ fileName: `folder_${selectedPasta?.id}_${Date.now()}`, directory: ".private" }),
    });
    if (!res.ok) throw new Error("Failed to get upload URL");
    const data = await res.json();
    return { method: "PUT" as const, url: data.uploadUrl, filePath: data.filePath };
  };

  const handleFileUploadComplete = (result: { uploadURL: string; filePath?: string }, fileName: string, fileSize: number) => {
    if (!selectedPasta || !selectedEmpreendimento) { toast({ title: "Selecione pasta e empreendimento primeiro.", variant: "destructive" }); return; }
    createFileInFolderMutation.mutate({ pastaId: selectedPasta.id, nome: fileName, objectPath: result.filePath || "", tamanho: fileSize, empreendimentoId: parseInt(selectedEmpreendimento) });
  };

  // ── Filtros ───────────────────────────────────────────────────────────────────

  const filteredDatasets = datasets.filter(d => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || (d.nome?.toLowerCase().includes(q)) || (d.codigoArquivo?.toLowerCase().includes(q)) || (d.titulo?.toLowerCase().includes(q)) || (d.numeroDocumento?.toLowerCase().includes(q)) || (d.orgaoEmissor?.toLowerCase().includes(q)) || (d.responsavel?.toLowerCase().includes(q));
    const matchEmp = filterEmpreendimento === "all" || String(d.empreendimentoId) === filterEmpreendimento;
    const matchTipoDoc = filterTipoDocumental === "all" || d.tipoDocumental === filterTipoDocumental;
    const matchStatusDoc = filterStatusDocumental === "all" || d.statusDocumental === filterStatusDocumental;
    const matchStatus = filterStatus === "all" || d.status === filterStatus;
    return matchSearch && matchEmp && matchTipoDoc && matchStatusDoc && matchStatus;
  });


  // ── KPIs ──────────────────────────────────────────────────────────────────────

  const kpis = {
    total: datasets.length,
    vencidos: datasets.filter(d => { const dias = diasParaVencer(d.prazoAtendimento); return dias !== null && dias < 0; }).length,
    proximos: datasets.filter(d => { const dias = diasParaVencer(d.prazoAtendimento); return dias !== null && dias >= 0 && dias <= 30; }).length,
    sem_responsavel: datasets.filter(d => !d.responsavel).length,
    concluidos: datasets.filter(d => d.statusDocumental === "concluido").length,
  };

  // ── Filtro de dicionário ──────────────────────────────────────────────────────

  const filteredDictionary = Object.entries(DICIONARIO_SIGLAS).map(([category, items]) => ({
    category,
    items: items.filter(item => dictionarySearch === "" || item.sigla.toLowerCase().includes(dictionarySearch.toLowerCase()) || item.descricao.toLowerCase().includes(dictionarySearch.toLowerCase())),
  })).filter(cat => cat.items.length > 0);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SensitivePageWrapper moduleName="Gestão de Dados" bypassRoles={["admin", "diretor", "coordenador", "rh"]}>
      <div className="container mx-auto p-6 space-y-6">

        {/* Banner de Demanda Pendente */}
        {demandaPendente && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 rounded-full p-2"><FileText className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="font-medium text-amber-800">Demanda aguardando conclusão</p>
                <p className="text-sm text-amber-700">"{demandaPendente.titulo}" será concluída automaticamente após salvar o documento.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={concluirDemandaPendente} className="text-green-600 border-green-200">Concluir agora</Button>
              <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("demandaPendenteConclusao"); setDemandaPendente(null); }} className="text-amber-600">
                <X className="h-4 w-4 mr-1" />Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Database className="h-8 w-8 text-primary" />
              Gestão de Dados
            </h1>
            <p className="text-muted-foreground mt-1">Núcleo inteligente de gestão documental ambiental — Maurivan Vaz Ribeiro</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setIsUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />Enviar Documento
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-primary">{kpis.total}</div>
              <div className="text-xs text-muted-foreground">Total de Documentos</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-red-600">{kpis.vencidos}</div>
              <div className="text-xs text-muted-foreground">Prazo Vencido</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-400">
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-orange-600">{kpis.proximos}</div>
              <div className="text-xs text-muted-foreground">Próximos 30 dias</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-400">
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-yellow-700">{kpis.sem_responsavel}</div>
              <div className="text-xs text-muted-foreground">Sem Responsável</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-green-600">{kpis.concluidos}</div>
              <div className="text-xs text-muted-foreground">Concluídos</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs principais */}
        {/* Painel de modelos de IA */}
        {false && aiModels.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-500" /> Pipeline de Reconhecimento de Documentos
              </span>
              {aiSystem && (
                <span className="text-xs text-muted-foreground">
                  GM: {aiSystem.gmAvailable ? <span className="text-green-600">✓</span> : <span className="text-red-500">✗</span>}
                  {' · '}
                  pdftoppm: {aiSystem.pdftoppmAvailable ? <span className="text-green-600">✓</span> : <span className="text-red-500">✗</span>}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {aiModels.map((m) => {
                const ping = m.baseUrl ? pingResults[m.baseUrl] : undefined;
                const isGemini = m.model.includes('gemini');
                return (
                  <div key={m.model} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono
                    ${m.configured && !m.isPlaceholder
                      ? 'bg-green-50 border-green-300 text-green-800 dark:bg-green-950/50 dark:text-green-300'
                      : m.isPlaceholder
                        ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                        : isGemini && m.configured
                          ? 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'bg-muted/60 border-border text-muted-foreground'}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      ping?.reachable ? 'bg-green-500' :
                      ping?.reachable === false ? 'bg-red-500' :
                      m.configured && !m.isPlaceholder ? 'bg-green-400' :
                      m.isPlaceholder ? 'bg-amber-400' :
                      isGemini && m.configured ? 'bg-blue-400' :
                      'bg-gray-300'
                    }`} />
                    <span className="font-semibold">{m.priority}.</span>
                    <span>{m.model.split('/').pop()}</span>
                    <span className="opacity-60 hidden sm:inline">— {m.role}</span>
                    {m.isPlaceholder && (
                      <span className="text-amber-600 dark:text-amber-400 font-normal hidden md:inline">(URL de exemplo)</span>
                    )}
                    {ping?.latencyMs && (
                      <span className="text-green-600">{ping.latencyMs}ms</span>
                    )}
                    {ping?.error && !ping.loading && (
                      <span className="text-red-500 truncate max-w-[100px]">{ping.error}</span>
                    )}
                    {m.baseUrl && !isGemini && !m.isPlaceholder && (
                      <button
                        onClick={() => pingModel(m.baseUrl!)}
                        disabled={ping?.loading}
                        className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
                        title="Testar conectividade"
                      >
                        {ping?.loading ? '⟳' : '⚡'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {aiModels.some(m => m.isPlaceholder) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                <span>⚠</span>
                <span>
                  Alguns servidores estão com URL de exemplo. Atualize os Secrets <strong>QWEN_VL_BASE_URL</strong>, <strong>GLM_OCR_BASE_URL</strong> e/ou <strong>TEXT_LLM_BASE_URL</strong> com o IP real da sua máquina GPU. Enquanto isso, o sistema usa o Gemini como fallback.
                </span>
              </p>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="documentos" className="gap-2"><FileText className="h-4 w-4" />Documentos</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2"><CalendarDays className="h-4 w-4" />Cronologia do Documento</TabsTrigger>
            <TabsTrigger value="insercao" className="gap-2"><Upload className="h-4 w-4" />Cronologia de Inserção</TabsTrigger>
            <TabsTrigger value="alertas" className="gap-2">
              <AlertCircle className="h-4 w-4" />Alertas & Risco
              {alertas.length > 0 && <Badge className="ml-1 bg-red-500 text-white text-xs px-1.5">{alertas.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="modelos" className="gap-2">
              <LayoutGrid className="h-4 w-4" />Modelos e Layouts
            </TabsTrigger>
          </TabsList>

          {/* ── TAB: Documentos ─────────────────────────────────────────────── */}
          <TabsContent value="documentos" className="space-y-4">
            {/* Dicionário */}
            <Collapsible open={isDictionaryOpen} onOpenChange={setIsDictionaryOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Dicionário de Siglas
                      {isDictionaryOpen ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="mb-4"><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar sigla..." value={dictionarySearch} onChange={e => setDictionarySearch(e.target.value)} className="pl-10" /></div></div>
                    <ScrollArea className="h-[250px]"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filteredDictionary.map(({ category, items }) => (<div key={category} className="space-y-1"><h4 className="font-semibold text-sm text-primary">{category}</h4>{items.map(item => (<div key={item.sigla} className="text-sm flex gap-2"><Badge variant="outline" className="font-mono">{item.sigla}</Badge><span className="text-muted-foreground">{item.descricao}</span></div>))}</div>))}</div></ScrollArea>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Busca e Filtros */}
            <Card>
              <CardHeader className="py-3">
                <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por nome, código, número, órgão, responsável..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsFiltersOpen(!isFiltersOpen)}>
                      <ListChecks className="h-4 w-4 mr-1" />Filtros {isFiltersOpen ? <ChevronDown className="h-3 w-3 ml-1" /> : <ChevronRight className="h-3 w-3 ml-1" />}
                    </Button>
                    {(filterEmpreendimento !== "all" || filterTipoDocumental !== "all" || filterStatusDocumental !== "all" || filterStatus !== "all" || searchQuery) && (
                      <Button variant="ghost" size="sm" onClick={() => { setFilterEmpreendimento("all"); setFilterTipoDocumental("all"); setFilterStatusDocumental("all"); setFilterStatus("all"); setSearchQuery(""); }}>
                        <XCircle className="h-4 w-4 mr-1" />Limpar
                      </Button>
                    )}
                  </div>
                </div>
                {isFiltersOpen && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t">
                    <div>
                      <Label className="text-xs">Empreendimento</Label>
                      <Select value={filterEmpreendimento} onValueChange={setFilterEmpreendimento}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todos</SelectItem>{empreendimentos.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Tipo Documental</Label>
                      <Select value={filterTipoDocumental} onValueChange={setFilterTipoDocumental}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todos</SelectItem>{TIPOS_DOCUMENTAIS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Status Documental</Label>
                      <Select value={filterStatusDocumental} onValueChange={setFilterStatusDocumental}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todos</SelectItem>{STATUS_DOCUMENTAIS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Status do Arquivo</Label>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todos</SelectItem>{DICIONARIO_SIGLAS.STATUS.map(s => <SelectItem key={s.sigla} value={s.sigla}>{s.sigla} - {s.descricao}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardHeader>
            </Card>

            {/* Tabela de Documentos */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle>Documentos Cadastrados</CardTitle>
                  <CardDescription>{filteredDatasets.length} documento(s) encontrado(s)</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {/* Agrupamento */}
                  <Button variant={groupByEmp ? "default" : "outline"} size="sm" onClick={() => setGroupByEmp(p => !p)} className="gap-1.5 h-8">
                    <Building2 className="h-3.5 w-3.5" />{groupByEmp ? "Por Lista" : "Por Empreendimento"}
                  </Button>
                  {/* Modo de visualização */}
                  <div className="flex border rounded-md overflow-hidden">
                    <Button size="sm" variant="ghost" className={`h-8 px-2.5 rounded-none border-r gap-1.5 ${viewMode === "table" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-muted"}`} onClick={() => setViewMode("table")} title="Visualização em tabela">
                      <List className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className={`h-8 px-2.5 rounded-none gap-1.5 ${viewMode === "cards" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-muted"}`} onClick={() => setViewMode("cards")} title="Visualização em cards">
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-6 text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />Carregando...</div>
                ) : filteredDatasets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />Nenhum documento encontrado.</div>
                ) : viewMode === "cards" ? (
                  <DocumentosCards datasets={filteredDatasets} empreendimentos={empreendimentos} onPreview={d => { setPreviewDataset(d); setIsPreviewOpen(true); }} onHistory={d => { setHistoryDataset(d); setIsHistoryOpen(true); }} onEdit={handleEdit} onDownload={handleDownload} onDelete={id => deleteMutation.mutate(id)} onDetail={d => { setDetailDataset(d); setIsDetailOpen(true); }} onGerarDemanda={handleGerarDemanda} />
                ) : groupByEmp ? (
                  <DocumentosGrouped datasets={filteredDatasets} empreendimentos={empreendimentos} onPreview={d => { setPreviewDataset(d); setIsPreviewOpen(true); }} onHistory={d => { setHistoryDataset(d); setIsHistoryOpen(true); }} onEdit={handleEdit} onDownload={handleDownload} onDelete={id => deleteMutation.mutate(id)} onDetail={d => { setDetailDataset(d); setIsDetailOpen(true); }} onGerarDemanda={handleGerarDemanda} />
                ) : (
                  <DocumentosTable datasets={filteredDatasets} onPreview={d => { setPreviewDataset(d); setIsPreviewOpen(true); }} onHistory={d => { setHistoryDataset(d); setIsHistoryOpen(true); }} onEdit={handleEdit} onDownload={handleDownload} onDelete={id => deleteMutation.mutate(id)} onDetail={d => { setDetailDataset(d); setIsDetailOpen(true); }} onGerarDemanda={handleGerarDemanda} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Timeline (Data do Documento) ───────────────────────────── */}
          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />Cronologia de Datas dos Documentos</CardTitle>
                  <CardDescription className="mt-1">Escala temporal pela data exata de emissão/assinatura de cada documento</CardDescription>
                </div>
                <Select value={timelineEmpFilter} onValueChange={setTimelineEmpFilter}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos os empreendimentos" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todos</SelectItem>{empreendimentos.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>)}</SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <TimelineView
                  modo="documento"
                  datasets={datasets.filter(d => timelineEmpFilter === "all" || String(d.empreendimentoId) === timelineEmpFilter)}
                  empreendimentos={empreendimentos}
                  onDetail={d => { setDetailDataset(d); setIsDetailOpen(true); }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Cronologia de Inserção ──────────────────────────────────── */}
          <TabsContent value="insercao" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-blue-600" />Cronologia de Inserção na Plataforma</CardTitle>
                  <CardDescription className="mt-1">Escala temporal pela data em que cada arquivo foi cadastrado no sistema</CardDescription>
                </div>
                <Select value={timelineEmpFilter} onValueChange={setTimelineEmpFilter}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos os empreendimentos" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todos</SelectItem>{empreendimentos.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>)}</SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <TimelineView
                  modo="upload"
                  datasets={datasets.filter(d => timelineEmpFilter === "all" || String(d.empreendimentoId) === timelineEmpFilter)}
                  empreendimentos={empreendimentos}
                  onDetail={d => { setDetailDataset(d); setIsDetailOpen(true); }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Alertas ─────────────────────────────────────────────────── */}
          <TabsContent value="alertas" className="space-y-4">
            <AlertasPanel alertas={alertas} isLoading={alertasLoading} empreendimentos={empreendimentos} onDetail={(id) => {
              const doc = datasets.find(d => d.id === id);
              if (doc) { setDetailDataset(doc); setIsDetailOpen(true); }
            }} onGerarDemanda={(id) => {
              const doc = datasets.find(d => d.id === id);
              if (doc) handleGerarDemanda(doc);
            }} />
          </TabsContent>

          {/* ── TAB: Modelos e Layouts ───────────────────────────────────────── */}
          <TabsContent value="modelos" className="space-y-4">
            <ModelosLayoutsTab />
          </TabsContent>
        </Tabs>

        {/* Rodapé normativo */}
        <Card className="bg-muted/30 border-t-4 border-t-primary">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sistema de gestão de dados e documentos de Maurivan Vaz Ribeiro, estruturado com base nas normas:
                <strong> ISO 15489</strong>, <strong>ABNT NBR ISO 30301</strong>, <strong>ISO 9001</strong>, <strong>ISO 14001</strong>,
                <strong> ISO/IEC 27001</strong>, <strong>ISO 21502</strong>, <strong>ISO 31000</strong>, <strong>Princípios FAIR</strong>, <strong>LGPD (Lei nº 13.709/2018)</strong>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Dialog Upload ──────────────────────────────────────────────────── */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Upload de Documento</DialogTitle>
              <DialogDescription>Preencha os metadados ou use a IA para extração automática.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Modo avançado toggle */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="useAdvanced" checked={useAdvancedForm} onChange={e => setUseAdvancedForm(e.target.checked)} className="rounded" />
                <Label htmlFor="useAdvanced" className="cursor-pointer">Usar formulário avançado com código padronizado</Label>
              </div>

              {/* Empreendimento + Responsável */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Empreendimento *</Label>
                  <Select value={selectedEmpreendimento} onValueChange={setSelectedEmpreendimento}>
                    <SelectTrigger><SelectValue placeholder="Selecione o empreendimento" /></SelectTrigger>
                    <SelectContent>{empreendimentos.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Coordenador Responsável</Label>
                  <Select value={selectedResponsavel || "__self__"} onValueChange={v => setSelectedResponsavel(v === "__self__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={currentUser?.nome || currentUser?.email || "Selecione"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__self__">Eu mesmo ({currentUser?.nome || currentUser?.email || "—"})</SelectItem>
                      {responsavelOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}{opt.sub ? ` (${opt.sub})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Projeto + Campanha */}
              {selectedEmpreendimento && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Projeto</Label>
                    <Select value={selectedProjetoId} onValueChange={v => { setSelectedProjetoId(v === "__none__" ? "" : v); const p = projetosDoEmpreendimento.find((pr: any) => pr.id.toString() === v); if (p) setProjeto(p.nome); }}>
                      <SelectTrigger><SelectValue placeholder="Selecionar projeto (opcional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Nenhum projeto —</SelectItem>
                        {projetosDoEmpreendimento.map((p: any) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Campanha</Label>
                    <Select value={selectedCampanhaId} onValueChange={v => setSelectedCampanhaId(v === "__none__" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar campanha (opcional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Nenhuma campanha —</SelectItem>
                        {campanhasDoEmpreendimento.map((c: any) => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Arquivo + botões */}
              <div>
                <Label>Arquivo *</Label>
                <div className="flex gap-2">
                  <Input type="file" ref={fileInputRef} accept=".csv,.xlsx,.xls,.pdf,.docx,.doc,.jpg,.jpeg,.png,.gif,.webp,.txt,.zip,.rar,.gpkg,.shp,.geojson,.qgz,.py,.r,.R,.sql,.ipynb" onChange={e => { setFile(e.target.files?.[0] || null); setCompressProgress(0); }} className="flex-1" />
                  {file?.name.toLowerCase().endsWith('.pdf') && (
                    <Button type="button" variant="outline" size="sm" disabled={isCompressing || isUploading} onClick={handleComprimir} title="Comprimir PDF antes do envio" className="shrink-0 text-blue-600 border-blue-300 hover:bg-blue-50">
                      {isCompressing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      <span className="ml-1 hidden sm:inline">Comprimir</span>
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" disabled={!file || isExtractingIA || isCompressing} onClick={handleExtractIA} title="Extrair metadados com IA">
                    {isExtractingIA ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                    <span className="ml-1 hidden sm:inline">IA</span>
                  </Button>
                </div>
                {isCompressing && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-xs text-blue-600">
                      <span>Comprimindo PDF, aguarde...</span>
                      <span>{compressProgress}%</span>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${compressProgress}%` }} />
                    </div>
                  </div>
                )}
                {file ? (
                  file.size > 5 * 1024 * 1024 ? (
                    <p className="text-xs mt-1 text-amber-600">
                      Arquivo: {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
                      {file.name.toLowerCase().endsWith('.pdf') ? ' • Arquivo grande — clique em "Comprimir" para reduzir antes do envio.' : ' • Arquivo grande, o envio pode ser mais lento.'}
                    </p>
                  ) : (
                    <p className="text-xs mt-1 text-muted-foreground">
                      Arquivo: {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB &bull; Clique em &quot;IA&quot; para extração automática de metadados
                    </p>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Para arquivos muito grandes, prefira a aba &quot;Pastas&quot;.</p>
                )}
              </div>

              {/* Seção de campos estruturados */}
              <div className="border rounded-lg p-4 space-y-3 bg-blue-50/30">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-blue-800"><ListChecks className="h-4 w-4" />Campos Estruturados de Gestão Documental</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipo Documental</Label>
                    <Select value={tipoDocumental} onValueChange={handleTipoDocumentalChange}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{TIPOS_DOCUMENTAIS.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Número do Documento</Label>
                    <Input className="h-8" value={numeroDocumento} onChange={e => setNumeroDocumento(e.target.value)} placeholder="Ex: NOT-001/2025" />
                  </div>
                  <div>
                    <Label className="text-xs">Órgão Emissor</Label>
                    <Input className="h-8" value={orgaoEmissor} onChange={e => setOrgaoEmissor(e.target.value)} placeholder="Ex: INEMA, IBAMA, SEMA" />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      Data do Documento
                      <span className="text-muted-foreground font-normal">(emissão/assinatura)</span>
                    </Label>
                    <Input type="date" className="h-8" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Prazo de Atendimento</Label>
                    <Input type="date" className="h-8" value={prazoAtendimento} onChange={e => setPrazoAtendimento(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Status Documental</Label>
                    <Select value={statusDocumental} onValueChange={setStatusDocumental}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_DOCUMENTAIS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Documento Relacionado</Label>
                    <Select value={documentoRelacionadoId || "__none__"} onValueChange={v => setDocumentoRelacionadoId(v === "__none__" ? "" : v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {datasets.map(d => {
                          const lbl = getDocSelectLabel(d);
                          return (
                            <SelectItem key={d.id} value={d.id.toString()} textValue={lbl.primary}>
                              <div className="flex flex-col py-0.5 max-w-[380px]">
                                <span className="text-sm leading-snug truncate">{lbl.primary}</span>
                                {lbl.secondary && <span className="text-[11px] text-muted-foreground truncate">{lbl.secondary}</span>}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  {documentoRelacionadoId && (
                    <div className="col-span-2">
                      <Label className="text-xs">Tipo de Vínculo</Label>
                      <Select value={vinculoTipo} onValueChange={setVinculoTipo}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Como este documento se relaciona?" /></SelectTrigger>
                        <VinculosTiposSelectContent />
                      </Select>
                    </div>
                  )}
                  {/* Vínculo com licença */}
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <span>🔗</span> Licença Relacionada
                    </Label>
                    <Select value={licencaVinculadaId || "__none__"} onValueChange={v => setLicencaVinculadaId(v === "__none__" ? "" : v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Vincular a uma licença (opcional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhuma</SelectItem>
                        {licencasDoEmpreendimento.map((l: any) => (
                          <SelectItem key={l.id} value={l.id.toString()}>
                            {l.numero || l.tipo} {l.orgaoEmissor ? `— ${l.orgaoEmissor}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {licencaVinculadaId && licencaVinculadaId !== "__none__" && (
                    <div>
                      <Label className="text-xs">Tipo de Relação com a Licença</Label>
                      <Select value={licencaVinculoTipoUpload} onValueChange={v => { setLicencaVinculoTipoUpload(v); setCondicionanteSelecionadaId(""); }}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="requerimento">📋 Requerimento</SelectItem>
                          <SelectItem value="protocolo">📮 Protocolo</SelectItem>
                          <SelectItem value="notificacao">📬 Notificação</SelectItem>
                          <SelectItem value="resposta">📩 Resposta/Ofício</SelectItem>
                          <SelectItem value="renovacao">🔄 Pedido de Renovação</SelectItem>
                          <SelectItem value="complementacao">➕ Complementação</SelectItem>
                          <SelectItem value="recurso">⚖️ Recurso</SelectItem>
                          <SelectItem value="cumprimento_condicionante">✅ Cumprimento de Condicionante</SelectItem>
                          <SelectItem value="outro">📄 Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {licencaVinculoTipoUpload === "cumprimento_condicionante" && licencaVinculadaId && (
                    <div className="col-span-2">
                      <Label className="text-xs flex items-center gap-1">
                        <span>📌</span> Condicionante Atendida
                        <span className="text-muted-foreground font-normal">(será registrada como evidência automaticamente)</span>
                      </Label>
                      <Select value={condicionanteSelecionadaId || "__none__"} onValueChange={v => setCondicionanteSelecionadaId(v === "__none__" ? "" : v)}>
                        <SelectTrigger className="h-8 border-green-300 focus:ring-green-400">
                          <SelectValue placeholder="Selecione a condicionante..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhuma selecionada</SelectItem>
                          {isFetchingCondicionantes && (
                            <SelectItem value="__loading__" disabled>⏳ Buscando condicionantes...</SelectItem>
                          )}
                          {!isFetchingCondicionantes && condicionantesDaLicenca.length === 0 && (
                            <SelectItem value="__empty__" disabled>⚠ Nenhuma condicionante cadastrada para esta licença</SelectItem>
                          )}
                          {condicionantesDaLicenca.map((c: any) => (
                            <SelectItem key={c.id} value={c.id.toString()}>
                              {c.codigo ? `[${c.codigo}] ` : ""}{c.titulo || c.descricao?.substring(0, 60) || `Condicionante #${c.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {condicionanteSelecionadaId && condicionanteSelecionadaId !== "__none__" && (
                        <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                          ✅ O documento será automaticamente registrado como evidência nesta condicionante.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Exigências Identificadas</Label>
                  <Textarea value={exigencias} onChange={e => setExigencias(e.target.value)} placeholder="Descreva as exigências ou obrigações do documento..." rows={2} className="text-sm" />
                </div>
                {resumoIA && (
                  <div className="bg-purple-50 border border-purple-200 rounded p-2">
                    <p className="text-xs font-medium text-purple-700 mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" />Resumo gerado pela IA:</p>
                    <p className="text-xs text-purple-800">{resumoIA}</p>
                  </div>
                )}
              </div>

              {/* Campos avançados de codificação */}
              {useAdvancedForm ? (
                <div className="border rounded-lg p-4 space-y-3 bg-gray-50/50">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><Database className="h-4 w-4" />Código do Documento</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs">Projeto (auto-preenchido)</Label>
                      <Input className="h-8 bg-muted" value={projeto} onChange={e => setProjeto(e.target.value)} placeholder="Selecione o empreendimento acima" />
                    </div>
                    <div>
                      <Label className="text-xs">Disciplina *</Label>
                      <Select value={disciplina} onValueChange={setDisciplina}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {DICIONARIO_SIGLAS.DISC.map(d => <SelectItem key={d.sigla} value={d.sigla}>{d.sigla} — {d.descricao}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs mb-1 block">Tipo de Documento *</Label>
                      <DocTypePicker
                        options={DICIONARIO_SIGLAS.DOC}
                        value={tipoDocumento}
                        onChange={setTipoDocumento}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Fase / Entrega</Label>
                      <Select value={entrega} onValueChange={setEntrega}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {DICIONARIO_SIGLAS.ENTREGA.map(e => <SelectItem key={e.sigla} value={e.sigla}>{e.sigla} — {e.descricao}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DICIONARIO_SIGLAS.STATUS.map(s => <SelectItem key={s.sigla} value={s.sigla}>{s.sigla} — {s.descricao}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Título (opcional)</Label>
                      <Input className="h-8" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Relatório Semestral de Fauna" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do arquivo" /></div>
                  <div>
                    <Label>Tipo *</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      <SelectContent><SelectItem value="planilha">Planilha</SelectItem><SelectItem value="relatorio">Relatório</SelectItem><SelectItem value="documento">Documento</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div><Label>Descrição</Label><Textarea rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição opcional" /></div>

              {/* Pasta destino */}
              <div>
                <Label className="mb-1 block">Pasta Destino *</Label>
                <FolderTreePicker
                  pastas={pastas}
                  value={pastaDestino}
                  onChange={setPastaDestino}
                />
              </div>

              {useAdvancedForm && codigoPreview && (
                <div className="bg-muted p-3 rounded-lg space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 text-primary" />Preview do Código:</div>
                  <code className="block text-xs bg-background p-2 rounded border break-all">{codigoPreview}</code>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><FolderOpen className="h-3 w-3" />Destino: <span className="font-mono">{pastaDestino}</span></div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleUpload} disabled={isUploading || uploadAdvancedMutation.isPending || uploadMutation.isPending}>
                  {(isUploading || uploadAdvancedMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isUploading ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Dialog Edit ────────────────────────────────────────────────────── */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[750px] max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" />Editar Documento</DialogTitle>
              <DialogDescription className="font-mono text-xs">{editingDataset?.codigoArquivo || editingDataset?.nome}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">

              {/* Botão de Análise Completa com IA — destaque */}
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="bg-violet-100 rounded-full p-2 flex-shrink-0">
                    <BrainCircuit className="h-5 w-5 text-violet-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-violet-900 text-sm">Análise Completa com IA</p>
                    <p className="text-xs text-violet-700 mt-0.5">
                      Extrai automaticamente: tipo, número, órgão, datas, exigências, base legal, riscos e plano de ação do documento.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleAnalisarIACompleta}
                  disabled={isAnalisandoIA}
                  className="bg-violet-600 hover:bg-violet-700 text-white gap-2 flex-shrink-0"
                >
                  {isAnalisandoIA
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Analisando...</>
                    : <><Sparkles className="h-4 w-4" />Analisar com IA</>
                  }
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nome</Label><Input className="h-8" value={editFields.nome || ""} onChange={e => setEditFields(p => ({ ...p, nome: e.target.value }))} /></div>
                <div><Label className="text-xs">Título</Label><Input className="h-8" value={editFields.titulo || ""} onChange={e => setEditFields(p => ({ ...p, titulo: e.target.value }))} /></div>
              </div>
              <div className="border rounded-lg p-3 space-y-3 bg-blue-50/30">
                <h4 className="text-sm font-semibold text-blue-800">Campos Estruturados</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipo Documental</Label>
                    <Select value={editFields.tipoDocumental || ""} onValueChange={v => setEditFields(p => ({ ...p, tipoDocumental: v }))}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{TIPOS_DOCUMENTAIS.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Número do Documento</Label><Input className="h-8" value={editFields.numeroDocumento || ""} onChange={e => setEditFields(p => ({ ...p, numeroDocumento: e.target.value }))} /></div>
                  <div><Label className="text-xs">Órgão Emissor</Label><Input className="h-8" value={editFields.orgaoEmissor || ""} onChange={e => setEditFields(p => ({ ...p, orgaoEmissor: e.target.value }))} /></div>
                  <div>
                    <Label className="text-xs flex items-center gap-1">Data do Documento <span className="text-muted-foreground font-normal">(emissão)</span></Label>
                    <Input type="date" className="h-8" value={(editFields as any).dataEmissao || ""} onChange={e => setEditFields(p => ({ ...p, dataEmissao: e.target.value }))} />
                  </div>
                  <div><Label className="text-xs">Prazo de Atendimento</Label><Input type="date" className="h-8" value={editFields.prazoAtendimento || ""} onChange={e => setEditFields(p => ({ ...p, prazoAtendimento: e.target.value }))} /></div>
                  <div>
                    <Label className="text-xs">Status Documental</Label>
                    <Select value={editFields.statusDocumental || "recebido"} onValueChange={v => setEditFields(p => ({ ...p, statusDocumental: v }))}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_DOCUMENTAIS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Responsável (Coordenador)</Label>
                    <Select value={editFields.responsavel || "__none__"} onValueChange={v => setEditFields(p => ({ ...p, responsavel: v === "__none__" ? "" : v }))}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Nenhum —</SelectItem>
                        {responsavelOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}{opt.sub ? ` (${opt.sub})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Vínculo com Licença */}
                <div className="border rounded-lg p-3 space-y-3 bg-green-50/30 border-green-200">
                  <h4 className="text-sm font-semibold text-green-800 flex items-center gap-1">
                    🔗 Vínculo com Licença
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Licença Relacionada</Label>
                      <Select
                        value={(editFields as any).licencaId ? String((editFields as any).licencaId) : "__none__"}
                        onValueChange={v => setEditFields(p => ({ ...p, licencaId: v === "__none__" ? undefined : parseInt(v) }))}
                      >
                        <SelectTrigger className="h-8"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhuma</SelectItem>
                          {licencasEditando.map((l: any) => (
                            <SelectItem key={l.id} value={String(l.id)}>
                              {l.numero || l.tipo} {l.orgaoEmissor ? `— ${l.orgaoEmissor}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {(editFields as any).licencaId && (
                      <div>
                        <Label className="text-xs">Tipo de Relação com a Licença</Label>
                        <Select
                          value={(editFields as any).licencaVinculoTipo || ""}
                          onValueChange={v => setEditFields(p => ({ ...p, licencaVinculoTipo: v }))}
                        >
                          <SelectTrigger className="h-8"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="requerimento">📋 Requerimento</SelectItem>
                            <SelectItem value="protocolo">📮 Protocolo</SelectItem>
                            <SelectItem value="notificacao">📬 Notificação</SelectItem>
                            <SelectItem value="resposta">📩 Resposta/Ofício</SelectItem>
                            <SelectItem value="renovacao">🔄 Pedido de Renovação</SelectItem>
                            <SelectItem value="complementacao">➕ Complementação</SelectItem>
                            <SelectItem value="recurso">⚖️ Recurso</SelectItem>
                            <SelectItem value="outro">📄 Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
                <div><Label className="text-xs">Exigências</Label><Textarea value={editFields.exigencias || ""} onChange={e => setEditFields(p => ({ ...p, exigencias: e.target.value }))} rows={2} className="text-xs" /></div>
                <div><Label className="text-xs">Resumo / Observações</Label><Textarea value={editFields.resumoIA || ""} onChange={e => setEditFields(p => ({ ...p, resumoIA: e.target.value }))} rows={2} className="text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Status do Arquivo</Label>
                  <Select value={editFields.status || "RASC"} onValueChange={v => setEditFields(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{DICIONARIO_SIGLAS.STATUS.map(s => <SelectItem key={s.sigla} value={s.sigla}>{s.sigla} - {s.descricao}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Classificação</Label>
                  <Select value={editFields.classificacao || "INT"} onValueChange={v => setEditFields(p => ({ ...p, classificacao: v }))}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{DICIONARIO_SIGLAS.CLASS.map(c => <SelectItem key={c.sigla} value={c.sigla}>{c.sigla} - {c.descricao}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs">Descrição</Label><Textarea value={editFields.descricao || ""} onChange={e => setEditFields(p => ({ ...p, descricao: e.target.value }))} rows={2} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveEdit} disabled={editMutation.isPending}>
                  {editMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Modal Análise Completa IA ──────────────────────────────────────── */}
        <Dialog open={isAnaliseModalOpen} onOpenChange={setIsAnaliseModalOpen}>
          <DialogContent className="sm:max-w-[900px] max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-violet-600" />
                Relatório de Análise Documental — IA
              </DialogTitle>
              <DialogDescription>
                Análise completa e exaustiva realizada pelo Gemini. Campos do documento foram preenchidos automaticamente.
              </DialogDescription>
            </DialogHeader>
            {analiseCompletaResult && (
              <div className="space-y-5 text-sm">

                {/* Ficha Técnica */}
                {analiseCompletaResult.fichaTecnica && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-3 text-violet-800">
                      <FileText className="h-4 w-4" />Ficha Técnica do Documento
                    </h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-violet-50 rounded-lg p-4 border border-violet-100">
                      {Object.entries(analiseCompletaResult.fichaTecnica).map(([k, v]) => v && v !== "null" ? (
                        <div key={k}>
                          <span className="text-xs text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}:</span>
                          <p className="font-medium text-sm">{String(v)}</p>
                        </div>
                      ) : null)}
                    </div>
                  </section>
                )}

                {/* Resumo Executivo */}
                {analiseCompletaResult.resumoExecutivo && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-2 text-blue-800">
                      <Info className="h-4 w-4" />Resumo Executivo
                    </h3>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{analiseCompletaResult.resumoExecutivo}</p>
                    </div>
                  </section>
                )}

                {/* Exigências */}
                {analiseCompletaResult.exigencias?.length > 0 && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-3 text-orange-800">
                      <AlertTriangle className="h-4 w-4" />Exigências, Obrigações e Condicionantes
                      <Badge className="bg-orange-100 text-orange-800 border-orange-200">{analiseCompletaResult.exigencias.length}</Badge>
                    </h3>
                    <div className="space-y-3">
                      {analiseCompletaResult.exigencias.map((ex: any, i: number) => (
                        <div key={i} className={`border rounded-lg p-3 ${ex.prioridade === "alta" ? "border-red-200 bg-red-50" : ex.prioridade === "media" ? "border-orange-200 bg-orange-50" : "border-yellow-200 bg-yellow-50"}`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-medium text-sm flex-1">{i + 1}. {ex.descricao}</p>
                            <Badge className={`text-xs flex-shrink-0 ${ex.prioridade === "alta" ? "bg-red-100 text-red-800" : ex.prioridade === "media" ? "bg-orange-100 text-orange-800" : "bg-yellow-100 text-yellow-800"}`}>
                              {ex.prioridade}
                            </Badge>
                          </div>
                          {ex.trechoOriginal && <blockquote className="border-l-2 border-gray-300 pl-2 text-xs text-muted-foreground italic mt-1">{ex.trechoOriginal}</blockquote>}
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                            {ex.dataLimite && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Prazo: {ex.dataLimite}</span>}
                            {ex.responsavelSugerido && <span>Resp: {ex.responsavelSugerido}</span>}
                          </div>
                          {ex.riscoNaoAtendimento && (
                            <p className="text-xs text-red-700 mt-1 flex items-start gap-1">
                              <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />Risco: {ex.riscoNaoAtendimento}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Documentos Relacionados */}
                {analiseCompletaResult.documentosRelacionados?.length > 0 && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-2 text-teal-800">
                      <Link2 className="h-4 w-4" />Documentos Relacionados
                    </h3>
                    <div className="space-y-2">
                      {analiseCompletaResult.documentosRelacionados.map((doc: any, i: number) => (
                        <div key={i} className="border border-teal-200 bg-teal-50 rounded-lg p-3">
                          <p className="font-medium text-sm">{doc.identificacao}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{doc.relacaoLogica}</p>
                          <Badge variant="outline" className="text-xs mt-1">{doc.tipo?.replace(/_/g, " ")}</Badge>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Linha do Tempo */}
                {analiseCompletaResult.linhaDoTempo?.length > 0 && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-2 text-purple-800">
                      <CalendarDays className="h-4 w-4" />Linha do Tempo
                    </h3>
                    <div className="space-y-1">
                      {analiseCompletaResult.linhaDoTempo.map((ev: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${ev.status === "concluido" ? "bg-green-500" : ev.status === "vencido" ? "bg-red-500" : ev.status === "em_andamento" ? "bg-blue-500" : "bg-gray-400"}`} />
                          <div className="flex-1">
                            <span className="font-mono text-xs text-muted-foreground">{ev.data}</span>
                            <p className="text-sm">{ev.evento}</p>
                          </div>
                          <Badge variant="outline" className="text-xs flex-shrink-0">{ev.status?.replace(/_/g, " ")}</Badge>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Base Legal */}
                {analiseCompletaResult.baseLegal?.length > 0 && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-2 text-gray-800">
                      <Shield className="h-4 w-4" />Base Legal e Normativa
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {analiseCompletaResult.baseLegal.map((norma: any, i: number) => (
                        <div key={i} className="border rounded-lg p-2 bg-gray-50 text-xs">
                          <p className="font-medium">{norma.nome} {norma.numero && `nº ${norma.numero}`}{norma.ano && `/${norma.ano}`}</p>
                          {norma.contexto && <p className="text-muted-foreground mt-0.5">{norma.contexto}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Riscos */}
                {analiseCompletaResult.riscos?.length > 0 && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-2 text-red-800">
                      <AlertCircle className="h-4 w-4" />Riscos, Lacunas e Inconsistências
                    </h3>
                    <div className="space-y-2">
                      {analiseCompletaResult.riscos.map((r: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded">
                          <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <Badge className="text-xs bg-red-100 text-red-800 mb-1">{r.tipo?.replace(/_/g, " ")}</Badge>
                            <p className="text-xs text-red-900">{r.descricao}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Plano de Ação */}
                {analiseCompletaResult.planoDeAcao?.length > 0 && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-2 text-green-800">
                      <Zap className="h-4 w-4" />Plano de Ação Proposto
                    </h3>
                    <div className="space-y-2">
                      {[...analiseCompletaResult.planoDeAcao].sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0)).map((acao: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-2 border rounded bg-green-50">
                          <div className="w-6 h-6 rounded-full bg-green-600 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">{acao.ordem || i + 1}</div>
                          <div className="flex-1">
                            <p className="text-sm">{acao.acao}</p>
                            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                              {acao.responsavel && <span>Resp: {acao.responsavel}</span>}
                              <Badge className={`text-xs ${acao.prioridade === "alta" ? "bg-red-100 text-red-800" : acao.prioridade === "media" ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-700"}`}>{acao.prioridade}</Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Dados Técnicos */}
                {analiseCompletaResult.dadosTecnicos && Object.values(analiseCompletaResult.dadosTecnicos).some(v => v && v !== "null") && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-2 text-slate-800">
                      <BarChart3 className="h-4 w-4" />Dados Técnicos Identificados
                    </h3>
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {Object.entries(analiseCompletaResult.dadosTecnicos).map(([k, v]) => v && v !== "null" ? (
                        <div key={k}>
                          <p className="text-xs text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}:</p>
                          <p className="text-sm">{String(v)}</p>
                        </div>
                      ) : null)}
                    </div>
                  </section>
                )}

                {/* Observações Gerais */}
                {analiseCompletaResult.observacoesGerais && (
                  <section>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                      <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-xs text-amber-800 mb-1">Observações Gerais</p>
                        <p className="text-xs text-amber-900">{analiseCompletaResult.observacoesGerais}</p>
                      </div>
                    </div>
                  </section>
                )}

                <div className="flex justify-between items-center pt-3 border-t">
                  <Button variant="outline" onClick={() => { setIsAnaliseModalOpen(false); setIsEditDialogOpen(true); }}>
                    <Edit className="h-4 w-4 mr-2" />Voltar ao Formulário
                  </Button>
                  <Button onClick={() => { handleSaveEdit(); setIsAnaliseModalOpen(false); }} className="bg-violet-600 hover:bg-violet-700">
                    <CheckCircle2 className="h-4 w-4 mr-2" />Salvar Campos Preenchidos
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Dialog Detalhe ─────────────────────────────────────────────────── */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-primary" />
                {detailDataset?.titulo || detailDataset?.codigoArquivo || detailDataset?.nome}
              </DialogTitle>
              {detailDataset?.numeroDocumento && <DialogDescription>Nº {detailDataset.numeroDocumento} · {detailDataset.orgaoEmissor || "—"}</DialogDescription>}
            </DialogHeader>
            {detailDataset && (
              <div className="space-y-4">
                {/* Status documental badge */}
                <div className="flex flex-wrap gap-2">
                  {detailDataset.tipoDocumental && (
                    <Badge variant="outline" className="gap-1">
                      {getTipoDocumentalInfo(detailDataset.tipoDocumental)?.icon}
                      {getTipoDocumentalInfo(detailDataset.tipoDocumental)?.label || detailDataset.tipoDocumental}
                    </Badge>
                  )}
                  <Badge className={getStatusDocumentalInfo(detailDataset.statusDocumental).color}>
                    {getStatusDocumentalInfo(detailDataset.statusDocumental).label}
                  </Badge>
                  {detailDataset.status && <Badge className={getStatusBadge(detailDataset.status)}>{detailDataset.status}</Badge>}
                  {detailDataset.classificacao && <Badge className={getClassBadge(detailDataset.classificacao)}>{detailDataset.classificacao}</Badge>}
                </div>

                {/* Descrição do documento */}
                {detailDataset.descricao && (
                  <div className="bg-muted/50 border rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" />Descrição
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{detailDataset.descricao}</p>
                  </div>
                )}

                {/* Prazo */}
                {detailDataset.prazoAtendimento && (() => {
                  const dias = diasParaVencer(detailDataset.prazoAtendimento);
                  return (
                    <div className={`flex items-center gap-3 p-3 rounded-lg border ${getRiscoColor(dias)}`}>
                      <Clock className="h-5 w-5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Prazo: {new Intl.DateTimeFormat("pt-BR").format(new Date(detailDataset.prazoAtendimento))}</p>
                        <p className="text-xs">{dias !== null && (dias < 0 ? `Vencido há ${Math.abs(dias)} dia(s)` : dias === 0 ? "Vence HOJE!" : `${dias} dia(s) restante(s)`)}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Resumo IA */}
                {detailDataset.resumoIA && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1"><Sparkles className="h-3 w-3" />Resumo Técnico</p>
                    <FormattedTextListPurple text={detailDataset.resumoIA} className="text-sm text-purple-900" />
                  </div>
                )}

                {/* Exigências */}
                {detailDataset.exigencias && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-orange-700 mb-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Exigências Identificadas</p>
                    <FormattedTextList text={detailDataset.exigencias} className="text-sm text-orange-900" />
                    <Button size="sm" variant="outline" className="mt-2 gap-1 text-orange-700 border-orange-300" onClick={() => { setIsDetailOpen(false); handleGerarDemanda(detailDataset); }}>
                      <Zap className="h-3 w-3" />Converter em Demanda
                    </Button>
                  </div>
                )}

                {/* Detalhes do documento */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border rounded-lg p-3 bg-muted/30">
                  {/* Tipo Documental */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Tipo Documental</p>
                    <p className="font-medium">
                      {detailDataset.tipoDocumental
                        ? <Badge variant="outline" className="text-xs">{getTipoDocumentalInfo(detailDataset.tipoDocumental)?.label || detailDataset.tipoDocumental}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </p>
                  </div>
                  {/* Número do Documento */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Número / Protocolo</p>
                    <p className="font-medium">{detailDataset.numeroDocumento || <span className="text-muted-foreground">—</span>}</p>
                  </div>
                  {/* Empreendimento */}
                  <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-blue-600 font-semibold mb-0.5">🏗 Empreendimento</p>
                    <p className="font-semibold text-blue-900">
                      {(detailDataset as any).empreendimentoNome ||
                        empreendimentos.find(e => e.id === detailDataset.empreendimentoId)?.nome ||
                        `#${detailDataset.empreendimentoId}`}
                    </p>
                  </div>
                  {/* Órgão Emissor */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Órgão Emissor</p>
                    <p className="font-medium">{detailDataset.orgaoEmissor || <span className="text-muted-foreground">—</span>}</p>
                  </div>
                  {/* Responsável */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Responsável</p>
                    <p className="font-medium">{detailDataset.responsavel || <span className="text-muted-foreground">—</span>}</p>
                  </div>
                  {/* Data de Emissão */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Data de Emissão</p>
                    <p className="font-medium">
                      {detailDataset.dataEmissao
                        ? new Intl.DateTimeFormat("pt-BR").format(new Date(detailDataset.dataEmissao + "T12:00:00"))
                        : <span className="text-muted-foreground">—</span>}
                    </p>
                  </div>
                  {/* Prazo */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Prazo de Atendimento</p>
                    <p className="font-medium">
                      {detailDataset.prazoAtendimento
                        ? new Intl.DateTimeFormat("pt-BR").format(new Date(detailDataset.prazoAtendimento + "T12:00:00"))
                        : <span className="text-muted-foreground">—</span>}
                    </p>
                  </div>
                  {/* Disciplina + Versão */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Disciplina</p>
                    <p className="font-medium">
                      {detailDataset.disciplina
                        ? <Badge variant="outline" className="text-xs">{detailDataset.disciplina}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Versão</p>
                    <p className="font-medium">{detailDataset.versao || "V0.1"}</p>
                  </div>
                  {/* Upload + Tamanho */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Data de Upload</p>
                    <p className="font-medium">{formatDate(detailDataset.dataUpload)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Tamanho</p>
                    <p className="font-medium">{formatFileSize(detailDataset.tamanho)}</p>
                  </div>
                  {/* Código — ocupa linha inteira */}
                  {detailDataset.codigoArquivo && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Código Padronizado</p>
                      <code className="text-xs bg-muted px-2 py-1 rounded block break-all">{detailDataset.codigoArquivo}</code>
                    </div>
                  )}
                  {/* Vínculo entre documentos */}
                  {detailDataset.vinculoTipo && detailDataset.documentoRelacionadoId && (
                    <div className="col-span-2 flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Vínculo entre documentos</p>
                        <p className="text-sm">{VINCULOS_TIPOS.find(v => v.value === detailDataset.vinculoTipo)?.label || detailDataset.vinculoTipo} — doc #{detailDataset.documentoRelacionadoId}</p>
                      </div>
                    </div>
                  )}
                  {/* Vínculo com licença */}
                  {(detailDataset as any).licencaId && (
                    <div className={`col-span-2 flex items-center gap-2 ${(detailDataset as any).licencaVinculoTipo === "cumprimento_condicionante" ? "bg-teal-50 border-teal-200" : "bg-green-50 border-green-200"} border rounded-lg p-2`}>
                      <span className="text-lg">{(detailDataset as any).licencaVinculoTipo === "cumprimento_condicionante" ? "✅" : "🔗"}</span>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {(detailDataset as any).licencaVinculoTipo === "cumprimento_condicionante" ? "Evidência de Condicionante" : "Licença Vinculada"}
                        </p>
                        <p className="text-sm font-medium text-green-800">
                          Licença #{(detailDataset as any).licencaId}
                          {(detailDataset as any).licencaVinculoTipo && (
                            <span className="ml-2 text-xs font-normal text-green-600">
                              {(detailDataset as any).licencaVinculoTipo === "cumprimento_condicionante"
                                ? `· Condicionante #${(detailDataset as any).condicionanteId || "—"} (evidência auto-registrada)`
                                : `(${(detailDataset as any).licencaVinculoTipo})`}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => handleDownload(detailDataset)}><Download className="h-4 w-4 mr-1" />Baixar</Button>
                  <Button variant="outline" size="sm" onClick={() => { setIsDetailOpen(false); handleEdit(detailDataset); }}><Edit className="h-4 w-4 mr-1" />Editar</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Dialog Preview ─────────────────────────────────────────────────── */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5" />{previewDataset?.nome}</DialogTitle>
              {previewDataset && <DialogDescription className="flex gap-4 text-sm flex-wrap"><span>Tipo: {previewDataset.tipoDocumento || previewDataset.tipo || "N/A"}</span><span>Tamanho: {formatFileSize(previewDataset.tamanho)}</span><span>Por: {previewDataset.usuario || "N/A"}</span></DialogDescription>}
            </DialogHeader>
            <div className="overflow-auto">
              {previewDataset && (() => {
                const isImage = previewDataset.url?.startsWith("data:image/");
                const isPdf = previewDataset.url?.startsWith("data:application/pdf");
                if (isImage) return <img src={previewDataset.url} alt={previewDataset.nome} className="max-w-full max-h-[70vh] object-contain mx-auto" />;
                if (isPdf) return <PdfBlobFrame dataUrl={previewDataset.url!} nome={previewDataset.nome} />;
                return <div className="text-center py-8"><FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" /><p className="text-lg font-medium mb-2">{previewDataset.nome}</p><Button onClick={() => handleDownload(previewDataset)}><Download className="mr-2 h-4 w-4" />Baixar Arquivo</Button></div>;
              })()}
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Dialog Histórico ───────────────────────────────────────────────── */}
        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" />Histórico de Versões</DialogTitle>
              <DialogDescription>{historyDataset?.codigoArquivo || historyDataset?.nome}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Versão Atual</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span>Versão: {historyDataset?.versao || "V0.1"}</span>
                  <span>Status: {historyDataset?.status || "N/A"}</span>
                  <span>Data: {historyDataset && formatDate(historyDataset.dataUpload)}</span>
                  <span>Usuário: {historyDataset?.usuario}</span>
                </div>
              </div>
              {versoes.length > 0 ? (
                <div className="space-y-2">
                  {versoes.map((v: any) => (
                    <div key={v.id} className="border rounded-lg p-3 text-sm">
                      <div className="flex justify-between"><span className="font-medium">Versão {v.versao}</span><span className="text-muted-foreground">{formatDate(v.criadoEm)}</span></div>
                      <div className="text-muted-foreground">Por: {v.criadoPor} · Status: {v.status}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma versão anterior registrada.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Dialog Gerar Demanda ───────────────────────────────────────────── */}
        <Dialog open={isGerarDemandaOpen} onOpenChange={setIsGerarDemandaOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-orange-500" />Gerar Demanda a partir de Exigência</DialogTitle>
              <DialogDescription>Crie uma tarefa no módulo de Demandas para atender a exigência identificada no documento.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {demandaDoc?.exigencias && (
                <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm text-orange-800">
                  <p className="font-semibold mb-1">Exigências do documento:</p>
                  <FormattedTextList text={demandaDoc.exigencias} className="text-sm text-orange-900" />
                </div>
              )}
              <div><Label>Título da Demanda *</Label><Input value={novaDemandaTitulo} onChange={e => setNovaDemandaTitulo(e.target.value)} /></div>
              <div><Label>Prazo</Label><Input type="date" value={novaDemandaPrazo} onChange={e => setNovaDemandaPrazo(e.target.value)} /></div>
              <div><Label>Responsável</Label><Input value={novaDemandaResponsavel} onChange={e => setNovaDemandaResponsavel(e.target.value)} placeholder="Email ou nome" /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsGerarDemandaOpen(false)}>Cancelar</Button>
                <Button onClick={handleSubmitGerarDemanda} disabled={gerarDemandaMutation.isPending || !novaDemandaTitulo}>
                  {gerarDemandaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Zap className="h-4 w-4 mr-2" />Criar Demanda
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SensitivePageWrapper>
  );
}

// ─── Componente: Tabela de Documentos ─────────────────────────────────────────

type DocTableProps = {
  datasets: DatasetExt[];
  empreendimentos?: Empreendimento[];
  onPreview: (d: DatasetExt) => void;
  onHistory: (d: DatasetExt) => void;
  onEdit: (d: DatasetExt) => void;
  onDownload: (d: DatasetExt) => void;
  onDelete: (id: number) => void;
  onDetail: (d: DatasetExt) => void;
  onGerarDemanda: (d: DatasetExt) => void;
};

// ─── Componente: Cards de Documentos ────────────────────────────────────────
function DocumentosCards({ datasets, empreendimentos = [], onPreview, onHistory, onEdit, onDownload, onDelete, onDetail, onGerarDemanda }: DocTableProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; docs: DatasetExt[] }>();
    datasets.forEach(d => {
      const key = String(d.empreendimentoId ?? "sem-emp");
      if (!map.has(key)) {
        const emp = empreendimentos.find(e => e.id === d.empreendimentoId);
        map.set(key, { name: emp?.nome ?? d.empreendimentoNome ?? "Sem Empreendimento", docs: [] });
      }
      map.get(key)!.docs.push(d);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [datasets, empreendimentos]);

  return (
    <div className="space-y-6">
      {grouped.map(([key, group]) => (
        <div key={key}>
          {/* Cabeçalho do grupo */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">{group.name}</span>
            <Badge variant="secondary" className="text-xs">{group.docs.length} doc{group.docs.length !== 1 ? "s" : ""}</Badge>
          </div>
          {/* Grid de cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {group.docs.map(d => {
              const tipoDoc = getTipoDocumentalInfo(d.tipoDocumental);
              const statusDoc = getStatusDocumentalInfo(d.statusDocumental);
              const dias = diasParaVencer(d.prazoAtendimento);
              const cat = (tipoDoc as any)?.cat ?? "tecnico";
              const catColor = CAT_COLORS[cat] ?? CAT_COLORS.tecnico;
              const sigla = (tipoDoc as any)?.sigla ?? (d.tipoDocumental?.toUpperCase() ?? "DOC");
              const prazoUrgente = dias !== null && dias < 0;
              const prazoAlerta = dias !== null && dias >= 0 && dias <= 7;
              const prazoAviso = dias !== null && dias > 7 && dias <= 30;
              return (
                <div
                  key={d.id}
                  className={`relative rounded-lg border border-l-4 ${catColor.border} ${catColor.bg} shadow-sm hover:shadow-md transition-shadow cursor-pointer group`}
                  onClick={() => onDetail(d)}
                >
                  {/* Barra de urgência topo */}
                  {prazoUrgente && (
                    <div className="absolute top-0 left-4 right-0 h-0.5 bg-red-500 rounded-t-lg" />
                  )}
                  <div className="p-3.5 space-y-2.5">
                    {/* Linha topo: sigla + status */}
                    <div className="flex items-start justify-between gap-2">
                      <span className={`inline-flex items-center font-bold text-xs px-2 py-0.5 rounded border ${catColor.badge}`}>
                        {sigla}
                      </span>
                      <Badge className={`text-[10px] shrink-0 ${statusDoc.color}`}>{statusDoc.label}</Badge>
                    </div>

                    {/* Número do documento */}
                    {d.numeroDocumento && (
                      <div className="text-[11px] font-mono text-muted-foreground font-medium">
                        Nº {d.numeroDocumento}
                      </div>
                    )}

                    {/* Nome / Título principal */}
                    <div className="font-semibold text-sm leading-tight line-clamp-2" title={d.titulo || d.nome}>
                      {d.titulo || d.nome || d.codigoArquivo || "Sem título"}
                    </div>

                    {/* Código de arquivo */}
                    {d.codigoArquivo && d.codigoArquivo !== d.nome && (
                      <div className="font-mono text-[10px] text-muted-foreground truncate">
                        {d.codigoArquivo}
                      </div>
                    )}

                    {/* Metadados */}
                    <div className="space-y-1">
                      {d.orgaoEmissor && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{d.orgaoEmissor}</span>
                        </div>
                      )}
                      {(d as any).dataEmissao && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>{new Intl.DateTimeFormat("pt-BR").format(new Date((d as any).dataEmissao + "T12:00:00"))}</span>
                        </div>
                      )}
                      {d.responsavel && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{d.responsavel}</span>
                        </div>
                      )}
                    </div>

                    {/* Barra de prazo */}
                    {d.prazoAtendimento && dias !== null && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">Prazo</span>
                          <span className={`font-semibold ${prazoUrgente ? "text-red-600" : prazoAlerta ? "text-orange-600" : prazoAviso ? "text-yellow-600" : "text-green-600"}`}>
                            {prazoUrgente ? `Vencido (${Math.abs(dias)}d)` : `${dias} dias`}
                          </span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${prazoUrgente ? "bg-red-500 w-full" : prazoAlerta ? "bg-orange-500" : prazoAviso ? "bg-yellow-500" : "bg-green-500"}`}
                            style={{ width: prazoUrgente ? "100%" : `${Math.max(5, 100 - Math.min(dias / 90 * 100, 100))}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Tags de vínculos */}
                    {((d as any).licencaId || d.documentoRelacionadoId || d.exigencias) && (
                      <div className="flex flex-wrap gap-1">
                        {(d as any).licencaId && (
                          <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">🔗 Licença #{(d as any).licencaId}</span>
                        )}
                        {d.documentoRelacionadoId && (
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">🔗 Doc. vinculado</span>
                        )}
                        {d.exigencias && (
                          <span className="text-[10px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">⚠ Exigências</span>
                        )}
                      </div>
                    )}

                    {/* Ações */}
                    <div className="flex items-center justify-between pt-1 border-t border-muted/60" onClick={e => e.stopPropagation()}>
                      <Badge className={`text-[10px] ${getStatusBadge(d.status)}`}>{d.status || "—"}</Badge>
                      <div className="flex gap-0.5">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onPreview(d)} title="Visualizar"><Eye className="h-3.5 w-3.5 text-blue-600" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(d)} title="Editar"><Edit className="h-3.5 w-3.5 text-orange-500" /></Button>
                        {d.exigencias && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onGerarDemanda(d)} title="Gerar Demanda"><Zap className="h-3.5 w-3.5 text-orange-500" /></Button>}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDownload(d)} title="Baixar"><Download className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm("Excluir este documento?")) onDelete(d.id); }} title="Excluir"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DocumentosTable({ datasets, onPreview, onHistory, onEdit, onDownload, onDelete, onDetail, onGerarDemanda }: DocTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-6 px-1"></TableHead>
            <TableHead>Código/Nome</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Tipo Documental</TableHead>
            <TableHead>Status Documental</TableHead>
            <TableHead>Órgão</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {datasets.map(d => {
            const dias = diasParaVencer(d.prazoAtendimento);
            const statusDoc = getStatusDocumentalInfo(d.statusDocumental);
            const tipoDoc = getTipoDocumentalInfo(d.tipoDocumental);
            const isExpanded = expandedId === d.id;
            const docRelacionado = d.documentoRelacionadoId
              ? datasets.find(x => x.id === d.documentoRelacionadoId)
              : null;
            const temVinculos = !!(d.documentoRelacionadoId || (d as any).licencaId || d.exigencias);
            return (
              <React.Fragment key={d.id}>
                <TableRow className={`hover:bg-muted/40 cursor-pointer ${isExpanded ? "bg-blue-50/40" : ""}`} onClick={() => onDetail(d)}>
                  <TableCell className="px-1" onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : d.id); }}>
                    <Button size="icon" variant="ghost" className="h-6 w-6">
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
                        : <ChevronRight className={`h-3.5 w-3.5 ${temVinculos ? "text-indigo-500" : "text-muted-foreground/40"}`} />}
                    </Button>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="truncate font-mono text-xs" title={d.codigoArquivo || d.nome}>{d.codigoArquivo || d.nome}</div>
                    {d.titulo && <div className="text-xs text-muted-foreground truncate">{d.titulo}</div>}
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {(d as any).licencaId && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-green-700 bg-green-50 border border-green-200 rounded px-1">
                          🔗 Lic. #{(d as any).licencaId}
                        </span>
                      )}
                      {d.documentoRelacionadoId && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1">
                          🔗 Doc vinculado
                        </span>
                      )}
                      {d.exigencias && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-1">
                          ⚠ Exigências
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    {d.descricao
                      ? <span className="text-xs text-muted-foreground line-clamp-2" title={d.descricao}>{d.descricao}</span>
                      : <span className="text-xs text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell>
                    {tipoDoc ? (() => {
                      const cat = (tipoDoc as any).cat ?? "tecnico";
                      const cc = CAT_COLORS[cat] ?? CAT_COLORS.tecnico;
                      const sigla = (tipoDoc as any).sigla ?? tipoDoc.value.toUpperCase();
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex items-center font-bold text-[10px] px-1.5 py-0.5 rounded border w-fit ${cc.badge}`}>{sigla}</span>
                          <span className="text-[10px] text-muted-foreground leading-tight" style={{maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{tipoDoc.icon} {tipoDoc.label.split("–")[0].trim()}</span>
                        </div>
                      );
                    })() : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${statusDoc.color}`}>{statusDoc.label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">{d.orgaoEmissor || "—"}</TableCell>
                  <TableCell>
                    {d.prazoAtendimento ? (
                      <span className={`text-xs font-medium ${dias !== null && dias < 0 ? "text-red-600" : dias !== null && dias <= 7 ? "text-orange-600" : "text-muted-foreground"}`}>
                        {dias !== null && dias < 0 ? `Venc. (${Math.abs(dias)}d)` : dias !== null ? `${dias}d` : "—"}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell><Badge className={`text-xs ${getStatusBadge(d.status)}`}>{d.status || "N/A"}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(d.dataUpload)}</TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-0.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onPreview(d)} title="Visualizar"><Eye className="h-3.5 w-3.5 text-blue-600" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onHistory(d)} title="Histórico"><History className="h-3.5 w-3.5 text-purple-600" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(d)} title="Editar"><Edit className="h-3.5 w-3.5 text-orange-600" /></Button>
                      {d.exigencias && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onGerarDemanda(d)} title="Gerar Demanda"><Zap className="h-3.5 w-3.5 text-orange-500" /></Button>}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDownload(d)} title="Baixar"><Download className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm("Excluir este documento?")) onDelete(d.id); }} title="Excluir"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>

                {/* ── Painel de detalhes expansível ─────────────────────── */}
                {isExpanded && (
                  <TableRow key={`exp-${d.id}`} className="bg-blue-50/20 hover:bg-blue-50/20">
                    <TableCell colSpan={9} className="py-3 px-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Órgão Emissor</p>
                          <p className="font-medium">{d.orgaoEmissor || <span className="text-muted-foreground">—</span>}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Data de Emissão</p>
                          <p className="font-medium">
                            {d.dataEmissao
                              ? new Intl.DateTimeFormat("pt-BR").format(new Date(d.dataEmissao + "T12:00:00"))
                              : <span className="text-muted-foreground">—</span>}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Prazo de Atendimento</p>
                          {d.prazoAtendimento ? (
                            <p className={`font-medium ${dias !== null && dias < 0 ? "text-red-600" : dias !== null && dias <= 7 ? "text-orange-600" : ""}`}>
                              {new Intl.DateTimeFormat("pt-BR").format(new Date(d.prazoAtendimento + "T12:00:00"))}
                              {dias !== null && (
                                <span className="ml-1 text-xs font-normal">
                                  ({dias < 0 ? `vencido há ${Math.abs(dias)}d` : dias === 0 ? "vence hoje!" : `${dias}d restantes`})
                                </span>
                              )}
                            </p>
                          ) : <span className="text-muted-foreground">—</span>}
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Status Documental</p>
                          <Badge className={`text-xs ${statusDoc.color}`}>{statusDoc.label}</Badge>
                        </div>

                        {/* Documento relacionado */}
                        {d.documentoRelacionadoId && (
                          <div className="col-span-2 bg-indigo-50 border border-indigo-200 rounded-lg p-2">
                            <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-0.5">🔗 Documento Relacionado</p>
                            <p className="text-sm font-medium text-indigo-900">
                              {docRelacionado
                                ? (docRelacionado.titulo || docRelacionado.codigoArquivo || docRelacionado.nome)
                                : `Doc #${d.documentoRelacionadoId}`}
                            </p>
                            {d.vinculoTipo && (
                              <p className="text-xs text-indigo-600 mt-0.5">
                                Relação: {VINCULOS_TIPOS.find(v => v.value === d.vinculoTipo)?.label || d.vinculoTipo}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Licença vinculada */}
                        {(d as any).licencaId && (
                          <div className={`${d.documentoRelacionadoId ? "" : "col-span-2"} ${(d as any).licencaVinculoTipo === "cumprimento_condicionante" ? "bg-teal-50 border-teal-200" : "bg-green-50 border-green-200"} border rounded-lg p-2`}>
                            <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-0.5">
                              {(d as any).licencaVinculoTipo === "cumprimento_condicionante" ? "✅ Evidência de Condicionante" : "🔗 Licença Vinculada"}
                            </p>
                            <p className="text-sm font-medium text-green-900">Licença #{(d as any).licencaId}</p>
                            {(d as any).licencaVinculoTipo && (
                              <p className="text-xs text-green-600 mt-0.5">
                                {(d as any).licencaVinculoTipo === "cumprimento_condicionante"
                                  ? `Condicionante #${(d as any).condicionanteId || "—"} · Evidência registrada automaticamente`
                                  : `Relação: ${(d as any).licencaVinculoTipo}`}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Exigências */}
                        {d.exigencias && (
                          <div className="col-span-2 md:col-span-4 bg-orange-50 border border-orange-200 rounded-lg p-2">
                            <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide mb-1">⚠ Exigências Identificadas</p>
                            <FormattedTextList text={d.exigencias} className="text-xs text-orange-900" maxLines={5} />
                            <Button size="sm" variant="outline" className="mt-1.5 h-6 text-xs gap-1 text-orange-700 border-orange-300"
                              onClick={e => { e.stopPropagation(); onGerarDemanda(d); }}>
                              <Zap className="h-3 w-3" />Converter em Demanda
                            </Button>
                          </div>
                        )}

                        {/* Resumo IA */}
                        {d.resumoIA && (
                          <div className="col-span-2 md:col-span-4 bg-purple-50 border border-purple-200 rounded-lg p-2">
                            <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />Resumo IA
                            </p>
                            <FormattedTextListPurple text={d.resumoIA} className="text-xs text-purple-900" maxLines={3} />
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end mt-2 pt-2 border-t border-blue-100">
                        <Button size="sm" variant="ghost" className="text-xs text-blue-600 h-7 gap-1"
                          onClick={e => { e.stopPropagation(); onDetail(d); }}>
                          <Eye className="h-3 w-3" />Ver detalhes completos
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Componente: Documentos Agrupados ─────────────────────────────────────────

function DocumentosGrouped({ datasets, empreendimentos = [], onPreview, onHistory, onEdit, onDownload, onDelete, onDetail, onGerarDemanda }: DocTableProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const groups = datasets.reduce<Record<string, { name: string; docs: DatasetExt[] }>>((acc, d) => {
    const key = String(d.empreendimentoId ?? "sem");
    const empName = empreendimentos.find(e => e.id === d.empreendimentoId)?.nome
      || d.empreendimentoNome
      || (d.empreendimentoId ? `Empreendimento #${d.empreendimentoId}` : "Sem empreendimento");
    if (!acc[key]) acc[key] = { name: empName, docs: [] };
    acc[key].docs.push(d);
    return acc;
  }, {});

  const sortedGroups = Object.entries(groups).sort(([, a], [, b]) => a.name.localeCompare(b.name, "pt-BR"));
  const toggle = (key: string) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  const isOpen = (key: string) => key in openGroups ? openGroups[key] : true;

  const formatDataDocumento = (iso?: string | null) => {
    if (!iso) return "—";
    try { return new Intl.DateTimeFormat("pt-BR").format(new Date(iso)); } catch { return iso; }
  };

  return (
    <div className="space-y-3">
      {sortedGroups.map(([key, group]) => {
        const vencidos = group.docs.filter(d => {
          const dias = diasParaVencer(d.prazoAtendimento);
          return dias !== null && dias < 0;
        }).length;
        const alertas = group.docs.filter(d => {
          const dias = diasParaVencer(d.prazoAtendimento);
          return dias !== null && dias >= 0 && dias <= 30;
        }).length;

        return (
          <Collapsible key={key} open={isOpen(key)} onOpenChange={() => toggle(key)}>
            <CollapsibleTrigger className="w-full">
              <div className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 transition cursor-pointer select-none
                ${vencidos > 0 ? "border-red-300 bg-red-50/60 dark:bg-red-950/20" : alertas > 0 ? "border-orange-200 bg-orange-50/40" : "border-primary/20 bg-primary/5 hover:bg-primary/10"}`}>
                <div className="flex items-center gap-3">
                  {isOpen(key) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <Building2 className={`h-4 w-4 ${vencidos > 0 ? "text-red-600" : "text-[#00599C]"}`} />
                  <span className="font-semibold text-sm text-left">{group.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {vencidos > 0 && (
                    <span className="text-[10px] font-bold bg-red-100 text-red-700 rounded-full px-2 py-0.5 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />{vencidos} vencido{vencidos !== 1 ? "s" : ""}
                    </span>
                  )}
                  {alertas > 0 && (
                    <span className="text-[10px] font-bold bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />{alertas} alerta{alertas !== 1 ? "s" : ""}
                    </span>
                  )}
                  <Badge variant="secondary" className="font-bold text-xs">{group.docs.length} doc{group.docs.length !== 1 ? "s" : ""}</Badge>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 rounded-b-lg border border-t-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">Código/Nome</TableHead>
                      <TableHead className="text-xs">Descrição</TableHead>
                      <TableHead className="text-xs">Tipo Documental</TableHead>
                      <TableHead className="text-xs">Status Documental</TableHead>
                      <TableHead className="text-xs">Órgão</TableHead>
                      <TableHead className="text-xs">Prazo</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.docs.map(d => {
                      const dias = diasParaVencer(d.prazoAtendimento);
                      const statusDoc = getStatusDocumentalInfo(d.statusDocumental);
                      const tipoDoc = getTipoDocumentalInfo(d.tipoDocumental);
                      return (
                        <TableRow key={d.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => onDetail(d)}>
                          <TableCell className="max-w-[200px]">
                            <div className="truncate font-mono text-xs font-medium">{d.codigoArquivo || d.nome}</div>
                            {d.titulo && d.titulo !== d.codigoArquivo && (
                              <div className="truncate text-xs text-muted-foreground">{d.titulo.substring(0, 40)}</div>
                            )}
                            {d.numeroDocumento && (
                              <div className="text-[10px] text-muted-foreground">Nº {d.numeroDocumento}</div>
                            )}
                            {(d as any).licencaId && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-green-700 bg-green-50 border border-green-200 rounded px-1 mt-0.5">
                                🔗 Lic. #{(d as any).licencaId}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[160px]">
                            {d.descricao
                              ? <span className="text-xs text-muted-foreground line-clamp-2" title={d.descricao}>{d.descricao}</span>
                              : <span className="text-xs text-muted-foreground/40">—</span>}
                          </TableCell>
                          <TableCell>
                            {tipoDoc ? (() => {
                              const cat = (tipoDoc as any).cat ?? "tecnico";
                              const cc = CAT_COLORS[cat] ?? CAT_COLORS.tecnico;
                              const sigla = (tipoDoc as any).sigla ?? tipoDoc.value.toUpperCase();
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <span className={`inline-flex items-center font-bold text-[10px] px-1.5 py-0.5 rounded border w-fit ${cc.badge}`}>{sigla}</span>
                                  <span className="text-[10px] text-muted-foreground">{tipoDoc.icon} {tipoDoc.label.split("–")[0].trim()}</span>
                                </div>
                              );
                            })() : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell><Badge className={`text-xs ${statusDoc.color}`}>{statusDoc.label}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{d.orgaoEmissor || "—"}</TableCell>
                          <TableCell>
                            {d.prazoAtendimento
                              ? <span className={`text-xs font-medium ${dias !== null && dias < 0 ? "text-red-600" : dias !== null && dias <= 7 ? "text-orange-600" : dias !== null && dias <= 30 ? "text-yellow-600" : "text-muted-foreground"}`}>
                                  {dias !== null && dias < 0 ? `Venc.(${Math.abs(dias)}d)` : `${dias}d`}
                                </span>
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell><Badge className={`text-xs ${getStatusBadge(d.status)}`}>{d.status || "N/A"}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDataDocumento((d as any).dataDocumento || (d as any).dataEmissao || (d as any).criadoEm)}
                          </TableCell>
                          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end gap-0.5">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onPreview(d)}><Eye className="h-3.5 w-3.5 text-blue-600" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onHistory(d)}><History className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(d)}><Edit className="h-3.5 w-3.5 text-orange-600" /></Button>
                              {d.exigencias && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onGerarDemanda(d)} title="Gerar Demanda"><Zap className="h-3.5 w-3.5 text-orange-500" /></Button>}
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDownload(d)}><Download className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm("Excluir?")) onDelete(d.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

// ─── Componente: Timeline Horizontal Butterfly ────────────────────────────────
// Layout horizontal com eixo central colorido, eventos alternando acima e
// abaixo do eixo, marcadores em diamante, escala baseada na DATA DO DOCUMENTO.

// Paleta de marca EcoBrasil
const ECO_BLUE  = "#00599C"; // Azul principal
const ECO_GREEN = "#1A7A45"; // Verde principal

function TimelineView({ datasets, empreendimentos, onDetail, modo: modoProp }: { datasets: DatasetExt[]; empreendimentos: Empreendimento[]; onDetail: (d: DatasetExt) => void; modo?: "documento" | "upload" }) {
  const [modoInterno, setModoInterno] = useState<"documento" | "upload">("documento");
  const [layoutView, setLayoutView] = useState<"lista" | "butterfly">("lista");
  const modoVisualizacao = modoProp ?? modoInterno;
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleDownloadTimeline = async (format: "jpeg" | "png") => {
    if (!timelineRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;

      // Expõe todo o conteúdo horizontal antes de capturar
      const el = timelineRef.current;
      const prevOverflow = el.style.overflow;
      const prevWidth    = el.style.width;
      el.style.overflow = "visible";
      el.style.width    = el.scrollWidth + "px";

      const canvas = await html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        width:  el.scrollWidth,
        height: el.scrollHeight,
        windowWidth:  el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      // Restaura
      el.style.overflow = prevOverflow;
      el.style.width    = prevWidth;

      const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
      const url = canvas.toDataURL(mimeType, 0.95);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timeline-ecobrasil.${format}`;
      a.click();
    } catch (err) {
      console.error("Erro ao exportar timeline:", err);
    }
  };

  // Paleta de cores por tipo documental (harmonizada com EcoBrasil)
  const TYPE_COLORS: Record<string, string> = {
    licenca: "#16a34a", notificacao: "#dc2626", oficio: "#2563eb",
    relatorio: "#9333ea", parecer: "#ca8a04", art: "#ea580c",
    mapa: "#0d9488", documento_legal: "#374151", condicionante: "#db2777", outro: "#6b7280",
  };
  const TYPE_ICONS: Record<string, string> = {
    licenca: "📋", notificacao: "📢", oficio: "📨", relatorio: "📊",
    parecer: "🔍", art: "🔧", mapa: "🗺️", documento_legal: "⚖️", condicionante: "📌", outro: "📄",
  };

  // Parseia datas corrigindo o offset de fuso horário:
  // strings "YYYY-MM-DD" são tratadas como UTC meia-noite pelo JS, o que
  // no horário de Brasília (UTC-3) vira o dia anterior. Forçamos meio-dia local.
  const parseLocalDate = (raw: string): Date | null => {
    if (!raw) return null;
    // Formato ISO apenas data: "2015-08-01" → forçar como hora local
    const isoDateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateOnly) {
      const [, y, m, day] = isoDateOnly;
      return new Date(Number(y), Number(m) - 1, Number(day), 12, 0, 0);
    }
    // Formato BR: "01/08/2015"
    const brDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brDate) {
      const [, day, m, y] = brDate;
      return new Date(Number(y), Number(m) - 1, Number(day), 12, 0, 0);
    }
    // Datetime completo (tem componente horário) — usa normalmente
    const dt = new Date(raw);
    return isNaN(dt.getTime()) ? null : dt;
  };

  // Retorna a data a usar na timeline (com fallback para dataUpload em modo documento)
  const getDataDocumento = (d: any): Date | null => {
    const raw = modoVisualizacao === "documento"
      ? (d.dataEmissao || (d as any).dataReferencia || d.dataUpload) // fallback para upload
      : d.dataUpload;
    if (!raw) return null;
    return parseLocalDate(String(raw));
  };

  // Indica se o documento não tem data de emissão/referência (usando fallback de upload)
  const isDateFallback = (d: any): boolean =>
    modoVisualizacao === "documento" && !d.dataEmissao && !(d as any).dataReferencia && !!d.dataUpload;

  const comData = datasets.filter(d => getDataDocumento(d) !== null);
  const semData: DatasetExt[] = []; // Com fallback, todos têm data

  // Contagem de documentos usando fallback (para banner informativo)
  const fallbackCount = modoVisualizacao === "documento"
    ? datasets.filter(d => isDateFallback(d)).length
    : 0;

  if (datasets.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-40" />
      <p>Nenhum documento para exibir na timeline.</p>
    </div>
  );

  // ─── Calcular escala e posições ─────────────────────────────────────────────
  const PAD_LEFT = 70;  // px de margem antes do primeiro mês
  const PAD_RIGHT = 70; // px de margem depois do último mês
  const AXIS_CENTER = 280; // px do topo até o centro da barra de meses
  const AXIS_H = 32;       // altura da barra de meses
  const AXIS_TOP = AXIS_CENTER - AXIS_H / 2;
  const AXIS_BOTTOM = AXIS_CENTER + AXIS_H / 2;
  const LABEL_W = 168;     // largura da caixa de label do evento
  const LABEL_H = 116;     // altura estimada da caixa de label do evento
  const TIER_GAP = 128;    // espaçamento entre tiers (empilhamento vertical)
  const MIN_TIERS = 2;     // tiers máximos (acima e abaixo têm 2 tiers cada)
  const CONTAINER_H = AXIS_CENTER + AXIS_H / 2 + MIN_TIERS * TIER_GAP + LABEL_H + 40;

  // Datas min/max
  const dates = comData.map(d => getDataDocumento(d)!);
  const minDateMs = dates.length ? Math.min(...dates.map(d => d.getTime())) : Date.now();
  const maxDateMs = dates.length ? Math.max(...dates.map(d => d.getTime())) : Date.now();
  const startDate = new Date(new Date(minDateMs).getFullYear(), new Date(minDateMs).getMonth(), 1);
  const endDate   = new Date(new Date(maxDateMs).getFullYear(), new Date(maxDateMs).getMonth() + 1, 0);
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));

  // Pixels por dia: escala dinâmica para caber bem
  const targetInnerWidth = Math.max(900, window.innerWidth - 120);
  const pxPerDay = Math.max(3, Math.min(16, targetInnerWidth / totalDays));
  const innerWidth = Math.ceil(totalDays * pxPerDay);
  const containerWidth = innerWidth + PAD_LEFT + PAD_RIGHT;

  const dateToX = (d: Date) =>
    PAD_LEFT + Math.floor((d.getTime() - startDate.getTime()) / 86400000) * pxPerDay;

  // Segmentos de meses para a barra do eixo
  const monthSegments: { label: string; x: number; w: number; h1: boolean }[] = [];
  let cur = new Date(startDate);
  while (cur <= endDate) {
    const mStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const mEnd   = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const x0 = dateToX(mStart);
    const x1 = dateToX(mEnd) + pxPerDay;
    monthSegments.push({
      label: mStart.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase(),
      x: x0, w: x1 - x0,
      h1: cur.getMonth() < 6, // Jan-Jun → laranja; Jul-Dez → verde
    });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  // Posicionamento dos eventos (alterna acima/abaixo e resolve colisões por tier)
  const sortedEvs = [...comData].sort((a, b) => getDataDocumento(a)!.getTime() - getDataDocumento(b)!.getTime());
  type EvSlot = { d: DatasetExt; x: number; above: boolean; tier: number; date: Date; color: string; icon: string; fallback: boolean };
  const slots: EvSlot[] = [];
  const occupancy: Map<string, number[]> = new Map(); // key "above|below" → list of x positions per tier

  sortedEvs.forEach((d, idx) => {
    const date = getDataDocumento(d)!;
    const x = dateToX(date);
    const above = idx % 2 === 0;
    const side = above ? "above" : "below";
    const color = TYPE_COLORS[d.tipoDocumental || "outro"] ?? "#6b7280";
    const icon  = TYPE_ICONS[d.tipoDocumental  || "outro"] ?? "📄";

    if (!occupancy.has(`${side}0`)) occupancy.set(`${side}0`, []);
    // Encontrar o primeiro tier livre (sem evento dentro de LABEL_W + 8 px)
    let tier = 0;
    while (true) {
      const key = `${side}${tier}`;
      if (!occupancy.has(key)) occupancy.set(key, []);
      const positions = occupancy.get(key)!;
      const clash = positions.some(ox => Math.abs(ox - x) < LABEL_W + 8);
      if (!clash) { positions.push(x); break; }
      tier++;
    }
    slots.push({ d, x, above, tier, date, color, icon, fallback: isDateFallback(d) });
  });

  // Helper: calcular Y do topo do label
  const labelTopY = (above: boolean, tier: number) =>
    above
      ? AXIS_TOP - 20 - (tier + 1) * TIER_GAP - LABEL_H + TIER_GAP
      : AXIS_BOTTOM + 20 + tier * TIER_GAP;

  // Ponto da linha que toca o eixo (ponta superior/inferior do diamante)
  const diamondR = 6;
  const lineAxisY = (above: boolean) => above ? AXIS_TOP - diamondR : AXIS_BOTTOM + diamondR;

  return (
    <div className="space-y-4">
      {/* Controles superiores */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Seletor de modo data */}
        {!modoProp && (
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button size="sm" variant={modoVisualizacao === "documento" ? "default" : "ghost"}
              onClick={() => setModoInterno("documento")} className="gap-1.5 h-8">
              <FileText className="h-3.5 w-3.5" />Data do Documento
            </Button>
            <Button size="sm" variant={modoVisualizacao === "upload" ? "default" : "ghost"}
              onClick={() => setModoInterno("upload")} className="gap-1.5 h-8">
              <Upload className="h-3.5 w-3.5" />Data de Inserção
            </Button>
          </div>
        )}
        {modoProp && <div />}
        {/* Toggle de layout */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button size="sm" variant={layoutView === "lista" ? "default" : "ghost"}
            onClick={() => setLayoutView("lista")} className="gap-1.5 h-8" title="Vista em lista vertical">
            <LayoutList className="h-3.5 w-3.5" />Lista
          </Button>
          <Button size="sm" variant={layoutView === "butterfly" ? "default" : "ghost"}
            onClick={() => setLayoutView("butterfly")} className="gap-1.5 h-8" title="Vista em linha do tempo horizontal">
            <CalendarDays className="h-3.5 w-3.5" />Linha do Tempo
          </Button>
        </div>
      </div>

      {/* Banner: documentos sem data de emissão usando fallback */}
      {fallbackCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{fallbackCount} documento(s)</strong> sem data de emissão — posicionados pela data de inserção (borda tracejada).
            Edite-os para informar a data exata.
          </span>
        </div>
      )}

      {/* Botões de download */}
      {comData.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => handleDownloadTimeline("jpeg")}>
            <Download className="h-3 w-3" />JPEG
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => handleDownloadTimeline("png")}>
            <Download className="h-3 w-3" />PNG
          </Button>
        </div>
      )}

      {/* ── VISTA EM LISTA VERTICAL ──────────────────────────────────────── */}
      {layoutView === "lista" && comData.length > 0 && (() => {
        // Agrupar por mês/ano
        const grouped = new Map<string, { label: string; items: typeof slots }>();
        [...slots].sort((a, b) => a.date.getTime() - b.date.getTime()).forEach(ev => {
          const key = `${ev.date.getFullYear()}-${String(ev.date.getMonth() + 1).padStart(2, "0")}`;
          const label = ev.date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
          if (!grouped.has(key)) grouped.set(key, { label, items: [] });
          grouped.get(key)!.items.push(ev);
        });

        return (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([key, group]) => (
              <div key={key}>
                {/* Cabeçalho do mês */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-2">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Cards do mês */}
                <div className="relative pl-6">
                  {/* Linha vertical */}
                  <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border" />

                  <div className="space-y-3">
                    {group.items.map(ev => {
                      const tLabel = getTipoDocumentalInfo(ev.d.tipoDocumental)?.label || "Documento";
                      const titulo = ev.d.titulo || ev.d.codigoArquivo || ev.d.nome || "Sem título";
                      const dataStr = ev.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
                      const vLabel = ev.d.vinculoTipo
                        ? VINCULOS_TIPOS.find(v => v.value === ev.d.vinculoTipo)?.label || ev.d.vinculoTipo
                        : null;
                      const isReferenciado = !vLabel && slots.some(s => s.d.documentoRelacionadoId === ev.d.id);

                      return (
                        <div
                          key={ev.d.id}
                          className="relative flex gap-3 cursor-pointer group"
                          onClick={() => onDetail(ev.d)}
                        >
                          {/* Marcador circular */}
                          <div
                            className="absolute -left-6 top-3 w-5 h-5 rounded-full border-2 border-white shadow flex items-center justify-center flex-shrink-0 z-10 text-[10px]"
                            style={{ background: ev.fallback ? "#9ca3af" : ev.color }}
                          >
                            <span>{ev.icon}</span>
                          </div>

                          {/* Card */}
                          <div
                            className="flex-1 rounded-xl bg-white shadow-sm border border-l-4 transition-all group-hover:shadow-md group-hover:-translate-y-0.5"
                            style={{ borderLeftColor: ev.fallback ? "#9ca3af" : ev.color, borderColor: `${ev.fallback ? "#9ca3af" : ev.color}33` }}
                          >
                            {/* Topo: tipo + data */}
                            <div
                              className="flex items-center justify-between px-4 py-2.5 rounded-t-xl"
                              style={{ background: `${ev.fallback ? "#9ca3af" : ev.color}18` }}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
                                  style={{ background: ev.fallback ? "#9ca3af" : ev.color }}
                                >
                                  {tLabel}
                                </span>
                                {(vLabel || isReferenciado) && (
                                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
                                    🔗 {vLabel ? vLabel.replace(/^[^\s]*\s/, "").slice(0, 20) : "referenciado"}
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-[11px] font-semibold"
                                style={{ color: ev.fallback ? "#9ca3af" : ev.color }}
                              >
                                {ev.fallback && "📌 "}{dataStr}
                              </span>
                            </div>

                            {/* Corpo */}
                            <div className="px-4 py-3">
                              <p className="font-semibold text-sm text-foreground leading-snug line-clamp-2 mb-2">
                                {titulo}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                {ev.d.empreendimentoNome && (
                                  <span className="flex items-center gap-1">
                                    <span>🏗</span>
                                    <span className="font-medium" style={{ color: ev.fallback ? "#6b7280" : ev.color }}>{ev.d.empreendimentoNome}</span>
                                  </span>
                                )}
                                {ev.d.orgaoEmissor && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />{ev.d.orgaoEmissor}
                                  </span>
                                )}
                                {ev.d.responsavel && (
                                  <span className="flex items-center gap-1">
                                    <User2 className="h-3 w-3" />
                                    {ev.d.responsavel.includes("@") ? ev.d.responsavel.split("@")[0] : ev.d.responsavel}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── TIMELINE HORIZONTAL BUTTERFLY ────────────────────────────────── */}
      {layoutView === "butterfly" && comData.length > 0 && (
        <div ref={timelineRef} className="border rounded-xl bg-white overflow-x-auto shadow-sm">
          <div style={{ position: "relative", width: containerWidth, height: CONTAINER_H, minHeight: 340 }}>

            {/* Gridlines verticais por mês */}
            {monthSegments.map((m, i) => (
              <div key={i} style={{ position: "absolute", left: m.x, top: 0, width: 1, height: CONTAINER_H, background: "#e5e7eb", zIndex: 0 }} />
            ))}

            {/* Barra do eixo colorida (meses) */}
            {monthSegments.map((m, i) => (
              <div key={i} style={{
                position: "absolute", left: m.x, top: AXIS_TOP, width: m.w, height: AXIS_H, zIndex: 1,
                background: m.h1 ? ECO_BLUE : ECO_GREEN,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.18)",
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ffffff", letterSpacing: 0.5 }}>{m.label}</span>
              </div>
            ))}

            {/* Rótulos de ano (quando há múltiplos anos) */}
            {Array.from(new Set(monthSegments.map(m => {
              const d = new Date(startDate.getFullYear(), startDate.getMonth() + monthSegments.indexOf(m), 1);
              return d.getFullYear();
            }))).map(year => {
              const firstMonthOfYear = monthSegments.find((m, i) => {
                const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
                return d.getFullYear() === year;
              });
              if (!firstMonthOfYear) return null;
              return (
                <div key={year} style={{
                  position: "absolute", left: firstMonthOfYear.x + 4, top: AXIS_BOTTOM + 4,
                  fontSize: 10, color: "#9ca3af", fontWeight: 600, zIndex: 2,
                }}>
                  {year}
                </div>
              );
            })}

            {/* ── Arcos SVG: vínculos entre documentos ─────────────────────── */}
            {(() => {
              // Pares de documentos vinculados que aparecem na timeline
              type LinkArc = { src: EvSlot; tgt: EvSlot; tipo: string; color: string };
              const arcs: LinkArc[] = [];
              const LINK_COLORS: Record<string, string> = {
                resposta: "#2563eb", atendimento_exigencia: "#16a34a", exigencia: "#dc2626",
                gerando_obrigacao: "#ea580c", solicitacao: "#9333ea", requerimento_formal: "#9333ea",
                protocolo_envio: "#0d9488", protocolo_recebimento: "#0d9488",
                esclarecimento: "#ca8a04", recurso: "#dc2626", despacho: "#374151",
                parecer_tecnico: "#db2777", intimacao: "#dc2626", laudo_embasamento: "#2563eb",
                anexo_tecnico: "#6b7280", complemento: "#9333ea", substitui: "#ca8a04",
                aditamento: "#ea580c", auto_infracao: "#991b1b", notificacao_recebida: "#dc2626",
              };
              slots.forEach(src => {
                if (!src.d.documentoRelacionadoId) return;
                const tgt = slots.find(s => s.d.id === src.d.documentoRelacionadoId);
                if (!tgt) return;
                arcs.push({
                  src, tgt,
                  tipo: src.d.vinculoTipo || "resposta",
                  color: LINK_COLORS[src.d.vinculoTipo || ""] || "#6366f1",
                });
              });

              if (arcs.length === 0) return null;
              return (
                <svg
                  style={{ position: "absolute", left: 0, top: 0, width: containerWidth, height: CONTAINER_H, pointerEvents: "none", zIndex: 6 }}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    {arcs.map((arc, i) => (
                      <marker
                        key={i}
                        id={`arrow-${i}`}
                        markerWidth="8" markerHeight="8"
                        refX="6" refY="3"
                        orient="auto"
                      >
                        <path d="M0,0 L0,6 L8,3 z" fill={arc.color} opacity="0.85" />
                      </marker>
                    ))}
                  </defs>
                  {arcs.map((arc, i) => {
                    // Centro X de cada evento no eixo
                    const x1 = arc.src.x;
                    const x2 = arc.tgt.x;
                    const midX = (x1 + x2) / 2;
                    // A profundidade real do arco numa Bézier quadrática é:
                    //   maxDepth = 0.5*AXIS_CENTER + 0.5*cy
                    // Para que o arco passe 55px abaixo de AXIS_BOTTOM (244):
                    //   alvo = AXIS_BOTTOM + 55 = 299
                    //   cy = 2*(299 - 0.5*AXIS_CENTER) = 2*(299 - 115) = 368
                    // → usamos cy ≈ AXIS_BOTTOM + 120 para garantir visibilidade clara
                    const arcDepth = Math.max(120, Math.min(180, Math.abs(x2 - x1) * 0.12));
                    const y1 = AXIS_CENTER;
                    const y2 = AXIS_CENTER;
                    // Ponto de controle ABAIXO da barra de meses com profundidade suficiente
                    const cy = AXIS_BOTTOM + arcDepth;
                    // Ponto mais baixo real do arco (~55–80px abaixo do AXIS_BOTTOM)
                    const realMaxY = 0.5 * AXIS_CENTER + 0.5 * cy;
                    const path = `M ${x1} ${y1} Q ${midX} ${cy} ${x2} ${y2}`;
                    const vinculoLabel = VINCULOS_TIPOS.find(v => v.value === arc.tipo)?.label || arc.tipo;
                    // Rótulo posicionado no ponto mais baixo real da curva
                    const labelX = midX;
                    const labelY = realMaxY + 4;
                    const lblW = Math.min(110, Math.max(60, Math.abs(x2 - x1) * 0.5));
                    return (
                      <g key={i}>
                        {/* Sombra branca por trás para realçar a linha */}
                        <path
                          d={path}
                          fill="none"
                          stroke="white"
                          strokeWidth={5}
                          opacity={0.7}
                        />
                        {/* Arco principal */}
                        <path
                          d={path}
                          fill="none"
                          stroke={arc.color}
                          strokeWidth={2.5}
                          strokeDasharray="6,3"
                          opacity={0.95}
                          markerEnd={`url(#arrow-${i})`}
                        />
                        {/* Rótulo do vínculo */}
                        <rect
                          x={labelX - lblW / 2}
                          y={labelY - 8}
                          width={lblW}
                          height={16}
                          rx={4}
                          fill="white"
                          stroke={arc.color}
                          strokeWidth={1}
                          opacity={0.92}
                        />
                        <text
                          x={labelX}
                          y={labelY + 3}
                          textAnchor="middle"
                          fontSize={8}
                          fontWeight={600}
                          fill={arc.color}
                          style={{ fontFamily: "system-ui, sans-serif" }}
                        >
                          {vinculoLabel.replace(/^[^\s]*\s/, "").slice(0, 16)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              );
            })()}

            {/* Eventos */}
            {slots.map((ev, i) => {
              const labelTop = labelTopY(ev.above, ev.tier);
              const labelLeft = ev.x - LABEL_W / 2;
              const lineTopY  = ev.above ? labelTop + LABEL_H : labelTop;
              const lineBottomY = lineAxisY(ev.above);
              const lineY = Math.min(lineTopY, lineBottomY);
              const lineH = Math.abs(lineTopY - lineBottomY);

              const tipoLabel = getTipoDocumentalInfo(ev.d.tipoDocumental)?.label || "Documento";
              const titulo = (ev.d.titulo || ev.d.codigoArquivo || ev.d.nome || "").slice(0, 32);
              const dataFmt = ev.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

              // Verifica se este documento tem um vínculo
              const temVinculo = !!ev.d.documentoRelacionadoId || slots.some(s => s.d.documentoRelacionadoId === ev.d.id);
              const vinculoLabel = ev.d.vinculoTipo
                ? VINCULOS_TIPOS.find(v => v.value === ev.d.vinculoTipo)?.label || ev.d.vinculoTipo
                : null;

              return (
                <div key={ev.d.id}>
                  {/* Linha vertical ligando label ao eixo */}
                  <div style={{
                    position: "absolute", left: ev.x, top: lineY,
                    width: 2, height: lineH, background: ev.color, zIndex: 2, opacity: 0.7,
                  }} />

                  {/* Marcador diamante no eixo */}
                  <div
                    onClick={() => onDetail(ev.d)}
                    style={{
                      position: "absolute",
                      left: ev.x - diamondR, top: AXIS_CENTER - diamondR,
                      width: diamondR * 2, height: diamondR * 2,
                      background: ev.color, transform: "rotate(45deg)",
                      cursor: "pointer", zIndex: 5,
                      boxShadow: temVinculo ? `0 0 0 3px white, 0 0 0 5px #6366f1` : "0 0 0 2px white",
                    }}
                  />

                  {/* Card do label — redesenhado */}
                  <div
                    onClick={() => onDetail(ev.d)}
                    style={{
                      position: "absolute",
                      left: Math.max(4, Math.min(containerWidth - LABEL_W - 4, labelLeft)),
                      top: labelTop,
                      width: LABEL_W, zIndex: 4,
                      cursor: "pointer",
                    }}
                  >
                    {/* Data em destaque acima do card */}
                    <p style={{
                      fontSize: 10, fontWeight: 700, lineHeight: 1.2, marginBottom: 4,
                      textAlign: "center",
                      color: ev.fallback ? "#9ca3af" : ev.color,
                    }}>
                      {ev.fallback ? "📌 " : ""}{dataFmt}
                    </p>

                    {/* Card principal */}
                    <div
                      style={{
                        background: "white",
                        border: temVinculo ? `2px solid #6366f1` : ev.fallback ? `1.5px dashed #9ca3af` : `1.5px solid ${ev.color}`,
                        borderRadius: 10,
                        overflow: "hidden",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
                        transition: "box-shadow 0.18s, transform 0.18s",
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 18px ${ev.color}44`;
                        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 10px rgba(0,0,0,0.10)";
                        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                      }}
                    >
                      {/* Cabeçalho colorido com tipo do documento */}
                      <div style={{
                        background: ev.fallback ? "#9ca3af" : ev.color,
                        padding: "5px 8px",
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{ev.icon}</span>
                        <span style={{
                          fontSize: 9, color: "white", fontWeight: 700,
                          letterSpacing: 0.4, textTransform: "uppercase",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                        }}>
                          {tipoLabel}
                        </span>
                        {ev.fallback && (
                          <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.8)", fontStyle: "italic", flexShrink: 0 }}>inserção</span>
                        )}
                      </div>

                      {/* Corpo do card */}
                      <div style={{ padding: "7px 9px 6px" }}>
                        {/* Título com clamp de 2 linhas */}
                        <p style={{
                          fontSize: 11, fontWeight: 700,
                          color: ev.fallback ? "#6b7280" : "#111827",
                          lineHeight: 1.35, marginBottom: 4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          wordBreak: "break-word",
                        } as React.CSSProperties}>
                          {titulo}
                        </p>

                        {/* Badge de vínculo */}
                        {(vinculoLabel || slots.some(s => s.d.documentoRelacionadoId === ev.d.id)) && (
                          <div style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            background: "#eef2ff", border: "1px solid #c7d2fe",
                            borderRadius: 5, padding: "2px 6px", marginBottom: 5,
                          }}>
                            <span style={{ fontSize: 9, color: "#4f46e5", fontWeight: 700, letterSpacing: 0.2 }}>
                              🔗 {vinculoLabel ? vinculoLabel.replace(/^[^\s]*\s/, "").slice(0, 18) : "referenciado"}
                            </span>
                          </div>
                        )}

                        {/* Separador */}
                        <div style={{ borderTop: "1px solid #f3f4f6", marginBottom: 5 }} />

                        {/* Linha de metadados */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {ev.d.empreendimentoNome && (
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <span style={{ fontSize: 9, flexShrink: 0 }}>🏗</span>
                              <span style={{
                                fontSize: 9, color: ev.fallback ? "#6b7280" : ev.color, fontWeight: 600,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                lineHeight: 1.3,
                              }}>
                                {ev.d.empreendimentoNome.slice(0, 24)}
                              </span>
                            </div>
                          )}
                          {(ev.d.orgaoEmissor || ev.d.responsavel) && (
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <span style={{ fontSize: 9, flexShrink: 0 }}>👤</span>
                              <span style={{
                                fontSize: 9, color: "#9ca3af",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                lineHeight: 1.3,
                              }}>
                                {ev.d.orgaoEmissor
                                  ? ev.d.orgaoEmissor.slice(0, 22)
                                  : ev.d.responsavel
                                    ? (ev.d.responsavel.includes("@") ? ev.d.responsavel.split("@")[0] : ev.d.responsavel).slice(0, 20)
                                    : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legenda de tipos */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(TYPE_COLORS).filter(([tipo]) =>
          datasets.some(d => (d.tipoDocumental || "outro") === tipo)
        ).map(([tipo, cor]) => (
          <div key={tipo} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div style={{ width: 10, height: 10, background: cor, transform: "rotate(45deg)", flexShrink: 0 }} />
            <span>{getTipoDocumentalInfo(tipo)?.label || tipo}</span>
          </div>
        ))}
        <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto flex-wrap">
          {fallbackCount > 0 && (
            <div className="flex items-center gap-1">
              <div style={{ width: 14, height: 10, border: "1.5px dashed #9ca3af", borderRadius: 2, background: "#f9fafb" }} />
              <span>Sem data de emissão</span>
            </div>
          )}
          {/* Legenda de vínculo */}
          {datasets.some(d => (d as any).documentoRelacionadoId) && (
            <div className="flex items-center gap-1">
              <svg width="28" height="10" viewBox="0 0 28 10">
                <path d="M2 5 Q14 9 26 5" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3,2" fill="none" markerEnd="url(#arr-leg)" />
                <defs>
                  <marker id="arr-leg" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                    <path d="M0,0 L0,5 L5,2.5 z" fill="#6366f1" />
                  </marker>
                </defs>
              </svg>
              <span>Vínculo entre docs</span>
            </div>
          )}
          <div className="flex items-center gap-1"><div style={{ width: 14, height: 10, background: ECO_BLUE, borderRadius: 2 }} /><span>Jan–Jun</span></div>
          <div className="flex items-center gap-1"><div style={{ width: 14, height: 10, background: ECO_GREEN, borderRadius: 2 }} /><span>Jul–Dez</span></div>
        </div>
      </div>

    </div>
  );
}

// ─── Componente: Painel de Alertas (agrupado por empreendimento) ───────────────

const RISCO_CONFIG = {
  critico: { label: "Crítico", color: "text-red-700", bg: "bg-red-50", border: "border-red-400", badge: "bg-red-100 text-red-700", icon: AlertCircle, borderLeft: "border-l-red-500" },
  alto:    { label: "Alto",    color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-400", badge: "bg-orange-100 text-orange-700", icon: AlertTriangle, borderLeft: "border-l-orange-500" },
  medio:   { label: "Médio",   color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-400", badge: "bg-yellow-100 text-yellow-700", icon: Clock, borderLeft: "border-l-yellow-500" },
  baixo:   { label: "Baixo",   color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-300", badge: "bg-blue-100 text-blue-700", icon: Info, borderLeft: "border-l-blue-400" },
} as const;

type RiscoKey = keyof typeof RISCO_CONFIG;

function AlertasPanel({ alertas, isLoading, empreendimentos, onDetail, onGerarDemanda }: {
  alertas: any[];
  isLoading: boolean;
  empreendimentos: Empreendimento[];
  onDetail: (id: number) => void;
  onGerarDemanda: (id: number) => void;
}) {
  const [expandedEmps, setExpandedEmps] = useState<Record<string, boolean>>({});
  const [filterRisco, setFilterRisco] = useState<RiscoKey | "todos">("todos");

  if (isLoading) return <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" /></div>;

  if (alertas.length === 0) return (
    <div className="text-center py-16">
      <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-400" />
      <h3 className="text-lg font-semibold text-green-700">Sem alertas ativos</h3>
      <p className="text-muted-foreground mt-1">Nenhum documento com prazo próximo ou vencido.</p>
    </div>
  );

  // Totais globais
  const totalCriticos = alertas.filter(a => a.risco === "critico").length;
  const totalAltos    = alertas.filter(a => a.risco === "alto").length;
  const totalMedios   = alertas.filter(a => a.risco === "medio").length;
  const totalBaixos   = alertas.filter(a => a.risco === "baixo").length;

  // Agrupamento por empreendimento
  const grouped: Record<string, { nome: string; items: any[] }> = {};
  for (const a of alertas) {
    const key = String(a.empreendimentoId ?? "sem");
    if (!grouped[key]) {
      const emp = empreendimentos.find(e => e.id === a.empreendimentoId);
      grouped[key] = { nome: emp?.nome || (a.empreendimentoId ? `Empreendimento #${a.empreendimentoId}` : "Sem empreendimento"), items: [] };
    }
    grouped[key].items.push(a);
  }

  // Ordenar grupos pelo risco mais grave
  const riscoOrder: Record<string, number> = { critico: 0, alto: 1, medio: 2, baixo: 3 };
  const groupsSorted = Object.entries(grouped).sort(([, ga], [, gb]) => {
    const maxA = Math.min(...ga.items.map(i => riscoOrder[i.risco] ?? 99));
    const maxB = Math.min(...gb.items.map(i => riscoOrder[i.risco] ?? 99));
    return maxA - maxB;
  });

  const toggleEmp = (key: string) =>
    setExpandedEmps(prev => ({ ...prev, [key]: prev[key] === false ? true : false }));

  const isExpanded = (key: string) => expandedEmps[key] !== false; // expanded by default

  const formatDate = (iso: string) => {
    try { return new Intl.DateTimeFormat("pt-BR").format(new Date(iso)); } catch { return iso; }
  };

  return (
    <div className="space-y-4">
      {/* ── KPI globais ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["critico","alto","medio","baixo"] as RiscoKey[]).map(r => {
          const cfg = RISCO_CONFIG[r];
          const count = r === "critico" ? totalCriticos : r === "alto" ? totalAltos : r === "medio" ? totalMedios : totalBaixos;
          const Icon = cfg.icon;
          const active = filterRisco === r;
          return (
            <button key={r} onClick={() => setFilterRisco(filterRisco === r ? "todos" : r)}
              className={`rounded-xl border-2 p-3 text-left transition-all ${cfg.bg} ${active ? cfg.border + " shadow-md ring-2 ring-offset-1" : "border-transparent hover:border-gray-200"}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${cfg.color}`} />
                <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
              </div>
              <div className={`text-3xl font-black ${cfg.color}`}>{count}</div>
              <div className={`text-[10px] mt-0.5 ${cfg.color} opacity-80`}>
                {r === "critico" ? "Vencidos" : r === "alto" ? "≤ 7 dias" : r === "medio" ? "≤ 15 dias" : "≤ 30 dias"}
              </div>
            </button>
          );
        })}
      </div>

      {filterRisco !== "todos" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Filtrando por: <strong className={RISCO_CONFIG[filterRisco].color}>{RISCO_CONFIG[filterRisco].label}</strong></span>
          <button className="underline" onClick={() => setFilterRisco("todos")}>limpar filtro</button>
        </div>
      )}

      {/* ── Cards por empreendimento ── */}
      <div className="space-y-3">
        {groupsSorted.map(([key, group]) => {
          const filtered = filterRisco === "todos" ? group.items : group.items.filter(a => a.risco === filterRisco);
          if (filtered.length === 0) return null;

          const countByRisco = (r: string) => group.items.filter(a => a.risco === r).length;
          const criticos = filtered.filter(a => a.risco === "critico");
          const altos    = filtered.filter(a => a.risco === "alto");
          const medios   = filtered.filter(a => a.risco === "medio");
          const baixos   = filtered.filter(a => a.risco === "baixo");

          // Borda esquerda baseada no risco mais grave
          const topRisco = criticos.length > 0 ? "critico" : altos.length > 0 ? "alto" : medios.length > 0 ? "medio" : "baixo";
          const borderLeftClass = RISCO_CONFIG[topRisco as RiscoKey].borderLeft;

          const expanded = isExpanded(key);

          return (
            <Card key={key} className={`border-l-4 ${borderLeftClass} shadow-sm overflow-hidden`}>
              {/* Header do empreendimento */}
              <button
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                onClick={() => toggleEmp(key)}
              >
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex-1 truncate">{group.nome}</span>
                {/* Mini badges de contagem */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {countByRisco("critico") > 0 && (
                    <span className="text-[10px] font-bold bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">{countByRisco("critico")}🔴</span>
                  )}
                  {countByRisco("alto") > 0 && (
                    <span className="text-[10px] font-bold bg-orange-100 text-orange-700 rounded-full px-1.5 py-0.5">{countByRisco("alto")}🟠</span>
                  )}
                  {countByRisco("medio") > 0 && (
                    <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 rounded-full px-1.5 py-0.5">{countByRisco("medio")}🟡</span>
                  )}
                  {countByRisco("baixo") > 0 && (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5">{countByRisco("baixo")}🔵</span>
                  )}
                  <ChevronDown className={`h-4 w-4 text-muted-foreground ml-1 transition-transform ${expanded ? "" : "-rotate-90"}`} />
                </div>
              </button>

              {/* Corpo colapsável */}
              {expanded && (
                <div className="px-4 pb-4 space-y-4 border-t">
                  {([
                    { key: "critico", items: criticos, title: "Crítico — Prazos Vencidos" },
                    { key: "alto",    items: altos,    title: "Alto Risco — Até 7 dias" },
                    { key: "medio",   items: medios,   title: "Médio Risco — Até 15 dias" },
                    { key: "baixo",   items: baixos,   title: "Baixo Risco — Até 30 dias" },
                  ] as { key: RiscoKey; items: any[]; title: string }[]).map(section => {
                    if (section.items.length === 0) return null;
                    const cfg = RISCO_CONFIG[section.key];
                    const Icon = cfg.icon;
                    return (
                      <div key={section.key} className="pt-3">
                        <div className={`flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md ${cfg.bg}`}>
                          <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                          <span className={`text-xs font-semibold ${cfg.color}`}>{section.title}</span>
                          <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{section.items.length}</span>
                        </div>
                        <div className="space-y-1.5">
                          {section.items.map(a => (
                            <div key={a.id}
                              className="flex items-start justify-between gap-2 border rounded-lg px-3 py-2 hover:shadow-sm hover:bg-muted/30 transition cursor-pointer"
                              onClick={() => onDetail(a.id)}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{a.titulo || a.codigoArquivo || a.nome}</p>
                                <p className="text-xs text-muted-foreground">
                                  {a.numeroDocumento && `Nº ${a.numeroDocumento}`}
                                  {a.orgaoEmissor && ` · ${a.orgaoEmissor}`}
                                </p>
                                {a.responsavel && (
                                  <p className="text-xs text-muted-foreground">👤 {a.responsavel}</p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                                <p className={`text-xs font-bold ${a.vencido ? "text-red-600" : cfg.color}`}>
                                  {a.vencido ? `Vencido há ${Math.abs(a.diffDays)}d` : `Vence em ${a.diffDays}d`}
                                </p>
                                {a.prazoAtendimento && (
                                  <p className="text-[10px] text-muted-foreground">{formatDate(a.prazoAtendimento)}</p>
                                )}
                                <Button size="sm" variant="outline"
                                  className="h-5 text-[10px] px-2 gap-1 text-orange-600 border-orange-300"
                                  onClick={e => { e.stopPropagation(); onGerarDemanda(a.id); }}
                                >
                                  <Zap className="h-2.5 w-2.5" />Gerar Demanda
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {groupsSorted.every(([key, group]) => {
        const filtered = filterRisco === "todos" ? group.items : group.items.filter(a => a.risco === filterRisco);
        return filtered.length === 0;
      }) && filterRisco !== "todos" && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Nenhum alerta de nível <strong>{RISCO_CONFIG[filterRisco].label}</strong>.</p>
          <button className="text-xs underline mt-1" onClick={() => setFilterRisco("todos")}>Ver todos</button>
        </div>
      )}
    </div>
  );
}
