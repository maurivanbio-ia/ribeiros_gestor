import { useState, useEffect, useRef, useMemo, lazy, Suspense, Fragment } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Chart, registerables } from "chart.js";
import {
  RefreshCw, Search, Eye, Download, Activity, Bird, MapPin, Clock,
  BarChart3, Database, AlertTriangle, TrendingUp,
  Trash2, Building2, ChevronRight, Sigma, FlaskConical, Layers, Leaf,
  FolderKanban, FileSpreadsheet, GitBranch, Sparkles, Loader2, X,
  Copy, CheckCheck, FileText, CalendarDays, PlusCircle, CloudRain,
  Waves, Volume2, ShieldAlert, Ruler, PieChart, Network, ShoppingBag, Upload,
  Globe2, Mountain, Droplets, TreePine, Compass,
  Camera, MapPinOff, FileWarning, ShieldCheck, Award, Users, Microscope, Crosshair,
  Keyboard,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";


const CampoMap = lazy(() =>
  import("@/components/campo/CampoMap").then(m => ({ default: m.CampoMap }))
);
const ImportCampoDialog = lazy(() =>
  import("@/components/campo/ImportCampoDialog").then(m => ({ default: m.ImportCampoDialog }))
);

Chart.register(...registerables);

// ── Módulo de IA — cache de sessão e helpers ───────────────────────────────────
const AI_ANALYSES_CACHE = new Map<string, string>();

function renderMd(md: string) {
  function inlineFmt(text: string) {
    return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
      if (p.startsWith("*") && p.endsWith("*")) return <em key={i} className="italic">{p.slice(1, -1)}</em>;
      return p;
    });
  }
  return (
    <div>
      {md.split("\n").map((line, i) => {
        if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-bold mt-3 mb-1 text-foreground">{inlineFmt(line.slice(4))}</h3>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-base font-bold mt-4 mb-1 pb-0.5 border-b text-foreground">{inlineFmt(line.slice(3))}</h2>;
        if (line.startsWith("# ")) return <h1 key={i} className="text-lg font-bold mt-4 mb-2 text-foreground">{inlineFmt(line.slice(2))}</h1>;
        if (line.match(/^[-*] /)) return <li key={i} className="ml-5 text-sm text-foreground list-disc mb-0.5">{inlineFmt(line.slice(2))}</li>;
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm text-foreground mb-1 leading-relaxed">{inlineFmt(line)}</p>;
      })}
    </div>
  );
}

// ── Análise com IA ────────────────────────────────────────────────────────────
function AiAnalysisBtn({ tipo, contexto }: { tipo: string; contexto: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analise, setAnalise] = useState<string | null>(null);
  const [modelo, setModelo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const analyzedCtx = useRef<string>("");

  async function doAnalyze(force = false) {
    if (analise && !force && analyzedCtx.current === contexto) return;
    setLoading(true);
    setError(null);
    setAnalise(null);
    setModelo(null);
    analyzedCtx.current = contexto;
    try {
      const res = await fetch("/api/campo/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, contexto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao analisar");
      setAnalise(data.analise);
      setModelo(data.model || null);
      AI_ANALYSES_CACHE.set(tipo, data.analise);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    doAnalyze();
  }

  function copy() {
    if (!analise) return;
    navigator.clipboard.writeText(analise).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        title="Interpretar com IA"
        className="ml-auto flex items-center justify-center w-6 h-6 rounded text-muted-foreground/50 hover:text-purple-600 hover:bg-purple-50 transition-colors flex-shrink-0"
      >
        <Sparkles className="w-3.5 h-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Análise com IA — {tipo}
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              <p className="text-sm">Analisando dados com IA…</p>
            </div>
          )}

          {error && !loading && (
            <div className="space-y-3">
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
              <Button size="sm" variant="outline" onClick={() => doAnalyze(true)} className="gap-1.5 text-xs">
                <RefreshCw className="w-3 h-3" /> Tentar novamente
              </Button>
            </div>
          )}

          {analise && !loading && (
            <div className="space-y-3">
              <div className="leading-relaxed">{renderMd(analise)}</div>
              <div className="flex items-center gap-2 pt-1 flex-wrap border-t">
                <Button size="sm" variant="outline" onClick={copy} className="gap-1.5 text-xs">
                  {copied ? <CheckCheck className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copiado!" : "Copiar texto"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => doAnalyze(true)} className="gap-1.5 text-xs">
                  <RefreshCw className="w-3 h-3" /> Reanalisar
                </Button>
                {modelo && (
                  <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400" />
                    {modelo}
                  </span>
                )}
              </div>
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
                <span>
                  <strong>Aviso:</strong> Esta análise é gerada automaticamente por IA e tem caráter complementar. O consultor responsável deve verificar as informações e contextualizar com dados de campo adicionais antes de utilizá-la em relatórios técnicos.
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Relatório Completo com IA ──────────────────────────────────────────────────
function mdToHtmlInline(md: string): string {
  return md.split("\n").map(line => {
    const il = line
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    if (line.startsWith("### ")) return `<h3 style="font-size:13px;font-weight:700;color:#1e293b;margin:10px 0 4px;">${il.slice(4)}</h3>`;
    if (line.startsWith("## ")) return `<h2 style="font-size:15px;font-weight:700;color:#003399;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin:14px 0 6px;">${il.slice(3)}</h2>`;
    if (line.startsWith("# ")) return `<h1 style="font-size:17px;font-weight:700;color:#003399;margin:16px 0 8px;">${il.slice(2)}</h1>`;
    if (line.match(/^[-*] /)) return `<li style="margin:2px 0 2px 18px;font-size:13px;">${il.slice(2)}</li>`;
    if (line.trim() === "") return `<div style="height:6px;"></div>`;
    return `<p style="font-size:13px;margin:3px 0;line-height:1.6;">${il}</p>`;
  }).join("\n");
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === "string" ? r.result : "");
      r.onerror = () => resolve("");
      r.readAsDataURL(blob);
    });
  } catch { return ""; }
}

function buildHtmlReport({
  empNome, campLabel, grupoLabel, bioStats, uaData, statsSource, registrosFiltrados, analyses, geradoEm, chartImages, extraTables, coverBgDataUrl,
}: {
  empNome: string; campLabel: string; grupoLabel: string;
  bioStats: any; uaData: any[];
  statsSource: CampoRegistro[]; registrosFiltrados: CampoRegistro[];
  analyses: Record<string, string>; geradoEm: string;
  chartImages: { title: string; dataUrl: string; wide?: boolean }[];
  extraTables?: { title: string; html: string }[];
  coverBgDataUrl?: string;
}): string {
  /* ── helpers ──────────────────────────────────────────── */
  const aiBlock = (id: string) => {
    const txt = analyses[id];
    if (!txt) return "";
    return `
    <div style="background:linear-gradient(135deg,#eef2ff 0%,#f0f7ff 100%);border-left:4px solid #4f46e5;padding:16px 18px;margin-top:16px;border-radius:0 10px 10px 0;box-shadow:0 2px 8px rgba(79,70,229,.08);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:14px;">🤖</span>
        <span style="font-size:10px;color:#4f46e5;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Análise por Inteligência Artificial</span>
      </div>
      <div style="font-size:12.5px;color:#1e293b;line-height:1.7;">${mdToHtmlInline(txt)}</div>
    </div>`;
  };

  const badge = (txt: string, color: string, bg: string) =>
    `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;color:${color};background:${bg};border:1px solid ${color}30;">${txt}</span>`;

  const tbl = (headers: string[], rows: (string | number)[][], accent = "#003399") =>
    `<div style="overflow-x:auto;margin-top:12px;border-radius:10px;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(0,0,0,.04);">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:linear-gradient(90deg,${accent}15,${accent}08);">${headers.map(h => `<th style="padding:10px 12px;text-align:left;font-weight:700;font-size:11px;color:${accent};letter-spacing:.03em;border-bottom:2px solid ${accent}30;">${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row, ri) => `<tr style="background:${ri % 2 === 0 ? "white" : "#f8fafc"};transition:background .15s;" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background='${ri % 2 === 0 ? "white" : "#f8fafc"}'">
        ${row.map((cell, ci) => `<td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;${ci === 0 ? "font-weight:500;" : ""}color:#334155;">${cell}</td>`).join("")}
      </tr>`).join("")}</tbody>
    </table></div>`;

  const kpiCard = (icon: string, label: string, val: string|number, sub: string, accent: string) =>
    `<div style="background:white;border-radius:12px;padding:18px 14px;text-align:center;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,.05);position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${accent};border-radius:12px 12px 0 0;"></div>
      <div style="font-size:22px;margin-bottom:6px;">${icon}</div>
      <div style="font-size:22px;font-weight:800;color:#0f172a;line-height:1;">${val}</div>
      <div style="font-size:11px;font-weight:600;color:#475569;margin-top:5px;">${label}</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:3px;">${sub}</div>
    </div>`;

  const progressBar = (pct: number, color: string) =>
    `<div style="background:#e2e8f0;border-radius:999px;height:6px;margin-top:6px;overflow:hidden;">
      <div style="background:${color};width:${Math.min(100,Math.max(0,pct))}%;height:100%;border-radius:999px;"></div>
    </div>`;

  const sec = (id: string, title: string, icon: string, content: string, accent = "#003399") =>
    `<section style="padding:28px 36px;border-bottom:1px solid #e5e7eb;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
        <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,${accent}18,${accent}08);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${icon}</div>
        <div>
          <h2 style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${title}</h2>
          <div style="width:40px;height:3px;background:linear-gradient(90deg,${accent},#FF6600);border-radius:2px;margin-top:4px;"></div>
        </div>
      </div>
      ${content}
      ${aiBlock(id)}
    </section>`;

  /* ── computed values ─────────────────────────────────── */
  const coverage = bioStats.chao1 > 0 ? Math.min(100,(bioStats.Sobs / bioStats.chao1 * 100)) : 0;
  const coverageTxt = bioStats.chao1 > 0 ? coverage.toFixed(0) + "%" : "—";

  const threatened = (() => {
    const seen = new Set<string>();
    return statsSource.filter(r => {
      const iucn = toIucnSigla(r.iucn);
      const mma  = toMmaSigla(r.ibamaMma);
      return (iucn && ["VU","EN","CR","EW","EX","NT","DD"].includes(iucn)) ||
             (mma  && ["VU","EN","CR","EW","EX","NT","DD"].includes(mma))  ||
             !!toCitesSigla(r.cites) || hasPan(r.pan);
    }).filter(r => {
      if (!r.nomeCientifico || seen.has(r.nomeCientifico)) return false;
      seen.add(r.nomeCientifico); return true;
    });
  })();

  const grupoAgg = registrosFiltrados.reduce((acc, r) => {
    const g = GRUPO_CONFIG[r.grupoTaxonomico]?.label || r.grupoTaxonomico || "Outro";
    if (!acc[g]) acc[g] = { n: 0, spp: new Set<string>() };
    acc[g].n++;
    if (r.nomeCientifico) acc[g].spp.add(r.nomeCientifico.toUpperCase());
    return acc;
  }, {} as Record<string, { n: number; spp: Set<string> }>);

  const dietaRows = Object.entries(bioStats.byDieta || {}).sort((a: any, b: any) => b[1] - a[1]);

  /* ── iucn color helper ───────────────────────────────── */
  const iucnBadge = (raw: string|null|undefined) => {
    const s = toIucnSigla(raw);
    if (!s) return "—";
    const map: Record<string,{c:string;bg:string}> = {
      LC:{c:"#166534",bg:"#dcfce7"}, NT:{c:"#14532d",bg:"#bbf7d0"},
      VU:{c:"#854d0e",bg:"#fef9c3"}, EN:{c:"#7c2d12",bg:"#fed7aa"},
      CR:{c:"#7f1d1d",bg:"#fecaca"}, EW:{c:"#581c87",bg:"#f3e8ff"},
      EX:{c:"#1c1917",bg:"#e7e5e4"},
    };
    const m = map[s];
    return m ? badge(s, m.c, m.bg) : badge(s, "#475569", "#f1f5f9");
  };

  /* ── Código do relatório (REL-AAAA-MM-XXXXX) ───────── */
  const reportCode = `REL-${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}-${Math.abs(Array.from(empNome+grupoLabel).reduce((a,c)=>(a*31+c.charCodeAt(0))|0,7)).toString(36).slice(0,5).toUpperCase()}`;

  /* ── KPI section ─────────────────────────────────────── */
  const kpiGrid = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-top:4px;">
    ${kpiCard("📊","Registros (N)", bioStats.N, "Abundância total", "#003399")}
    ${kpiCard("🌿","Riqueza (Sobs)", bioStats.Sobs, "Espécies observadas", "#16a34a")}
    ${kpiCard("📈","Shannon H'", bioStats.H.toFixed(3), bioStats.H > 3 ? "Alta diversidade" : bioStats.H > 2 ? "Diversidade média" : "Diversidade baixa", "#7c3aed")}
    ${kpiCard("⚖️","Equitabilidade J'", bioStats.J.toFixed(3), bioStats.J > 0.7 ? "Alta equitabilidade" : bioStats.J > 0.5 ? "Equitabilidade média" : "Dominância marcante", "#ea580c")}
    ${kpiCard("🔬","Chao1 (estim.)", bioStats.chao1.toFixed(0), "Riqueza estimada", "#0891b2")}
    ${kpiCard("🎯","Cobertura", coverageTxt, `${bioStats.Sobs} de ~${bioStats.chao1.toFixed(0)} sp.`, coverage >= 80 ? "#16a34a" : coverage >= 60 ? "#d97706" : "#dc2626")}
    ${threatened.length > 0 ? kpiCard("⚠️","Ameaçadas", threatened.length, "espécies com status especial", "#dc2626") : ""}
  </div>
  <div style="margin-top:16px;padding:14px 16px;background:linear-gradient(135deg,#f0fdf4,#f0f9ff);border-radius:10px;border:1px solid #bbf7d0;">
    <div style="font-size:11px;font-weight:700;color:#166534;margin-bottom:8px;">SUFICIÊNCIA AMOSTRAL (Sobs/Chao1)</div>
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="flex:1;">${progressBar(coverage, coverage >= 80 ? "#16a34a" : coverage >= 60 ? "#d97706" : "#dc2626")}</div>
      <span style="font-size:13px;font-weight:700;color:${coverage >= 80 ? "#166534" : coverage >= 60 ? "#92400e" : "#991b1b"};">${coverageTxt}</span>
    </div>
    <div style="font-size:10px;color:#64748b;margin-top:4px;">${coverage >= 80 ? "Amostragem suficiente — &ge;80% da riqueza estimada detectada" : coverage >= 60 ? "Amostragem moderada — recomendável aumentar esforço amostral" : "Amostragem insuficiente — esforço amostral deve ser ampliado"}</div>
  </div>`;

  /* ── Alpha diversity table with bars ─────────────────── */
  const alfaRows = [
    {idx:"Shannon H'", val:bioStats.H.toFixed(4), pct:Math.min(100,bioStats.H/5*100), ref:bioStats.H>3?"Alta diversidade":bioStats.H>2?"Diversidade média":"Diversidade baixa", color:"#7c3aed"},
    {idx:"Simpson 1-D", val:bioStats.D.toFixed(4), pct:bioStats.D*100, ref:bioStats.D>0.8?"Alta diversidade":bioStats.D>0.6?"Diversidade média":"Dominância elevada", color:"#0891b2"},
    {idx:"Pielou J'", val:bioStats.J.toFixed(4), pct:bioStats.J*100, ref:bioStats.J>0.7?"Alta equitabilidade":bioStats.J>0.5?"Equitabilidade média":"Dominância marcante", color:"#ea580c"},
    {idx:"Margalef d", val:bioStats.margalef.toFixed(4), pct:Math.min(100,bioStats.margalef/10*100), ref:"Riqueza relativa ao esforço", color:"#16a34a"},
    {idx:"Menhinick D", val:bioStats.menhinick.toFixed(4), pct:Math.min(100,bioStats.menhinick/5*100), ref:"Riqueza relativa à abundância", color:"#dc2626"},
    {idx:"Berger-Parker d", val:bioStats.bergerParker.toFixed(4), pct:Math.min(100,bioStats.bergerParker*100), ref:bioStats.bergerParker>=0.8?"Dominância extrema":bioStats.bergerParker>=0.5?"Alta dominância":bioStats.bergerParker>=0.3?"Dominância moderada":"Baixa dominância", color:"#b45309"},
  ];
  const alfaContent = `<div style="overflow-x:auto;margin-top:4px;border-radius:10px;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(0,0,0,.04);">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:linear-gradient(90deg,#003399,#0055cc);">
        ${["Índice","Valor","Suficiência","Interpretação"].map(h=>`<th style="padding:10px 14px;text-align:left;font-weight:700;font-size:11px;color:white;letter-spacing:.03em;">${h}</th>`).join("")}
      </tr></thead>
      <tbody>${alfaRows.map((r,ri)=>`<tr style="background:${ri%2===0?"white":"#f8fafc"};">
        <td style="padding:10px 14px;font-weight:600;color:#0f172a;">${r.idx}</td>
        <td style="padding:10px 14px;font-family:monospace;font-size:13px;color:#003399;font-weight:700;">${r.val}</td>
        <td style="padding:10px 14px;width:140px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;background:#e2e8f0;border-radius:999px;height:8px;overflow:hidden;">
              <div style="background:${r.color};width:${r.pct.toFixed(0)}%;height:100%;border-radius:999px;"></div>
            </div>
            <span style="font-size:10px;color:#64748b;flex-shrink:0;">${r.pct.toFixed(0)}%</span>
          </div>
        </td>
        <td style="padding:10px 14px;font-size:11px;color:#475569;">${r.ref}</td>
      </tr>`).join("")}</tbody>
    </table></div>`;

  /* ── Richness estimators ─────────────────────────────── */
  const estimTable = tbl(
    ["Estimador","Valor","Método","Cobertura"],
    [
      ["Sobs (observado)", bioStats.Sobs, "Contagem direta", `${coverageTxt}`],
      ["Jackknife 1ª ordem", bioStats.jack1.toFixed(1), "Baseado em singletons", `${bioStats.jack1>0?(bioStats.Sobs/bioStats.jack1*100).toFixed(0)+"%":"—"}`],
      ["Jackknife 2ª ordem", bioStats.jack2.toFixed(1), "Singletons + doubletons", `${bioStats.jack2>0?(bioStats.Sobs/bioStats.jack2*100).toFixed(0)+"%":"—"}`],
      ["Bootstrap", bioStats.boot.toFixed(1), "Reamostragem", `${bioStats.boot>0?(bioStats.Sobs/bioStats.boot*100).toFixed(0)+"%":"—"}`],
      ["Chao1", bioStats.chao1.toFixed(1), "Singletons/doubletons", coverageTxt],
      ["Chao2", bioStats.chao2.toFixed(1), "UAs únicas/compartilhadas", `${bioStats.chao2>0?(bioStats.Sobs/bioStats.chao2*100).toFixed(0)+"%":"—"}`],
    ]
  );

  /* ── Top species ─────────────────────────────────────── */
  const topSpContent = `<div style="overflow-x:auto;margin-top:4px;border-radius:10px;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(0,0,0,.04);">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:linear-gradient(90deg,#16a34a18,#16a34a08);">
        ${["#","Espécie","n","Abundância relativa"].map(h=>`<th style="padding:10px 12px;text-align:left;font-weight:700;font-size:11px;color:#166534;border-bottom:2px solid #16a34a30;">${h}</th>`).join("")}
      </tr></thead>
      <tbody>${bioStats.topSp.slice(0,20).map(([sp,n]:[string,number],i:number)=>{
        const pct = bioStats.N > 0 ? n/bioStats.N*100 : 0;
        return `<tr style="background:${i%2===0?"white":"#f8fafc"};">
          <td style="padding:8px 12px;color:#94a3b8;font-size:11px;">${i+1}</td>
          <td style="padding:8px 12px;font-style:italic;font-weight:500;color:#0f172a;">${sp}</td>
          <td style="padding:8px 12px;font-weight:700;color:#166534;">${n}</td>
          <td style="padding:8px 12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="flex:1;background:#e2e8f0;border-radius:999px;height:8px;overflow:hidden;">
                <div style="background:linear-gradient(90deg,#16a34a,#4ade80);width:${pct.toFixed(1)}%;height:100%;border-radius:999px;"></div>
              </div>
              <span style="font-size:10px;color:#475569;flex-shrink:0;width:38px;text-align:right;">${pct.toFixed(1)}%</span>
            </div>
          </td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>`;

  /* ── Threatened species ──────────────────────────────── */
  const threatContent = threatened.length > 0
    ? `<div style="overflow-x:auto;margin-top:4px;border-radius:10px;border:1px solid #fecaca;box-shadow:0 1px 4px rgba(220,38,38,.08);">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:linear-gradient(90deg,#fee2e2,#fff7f7);">
        ${["Espécie","IUCN","MMA","CITES","PAN","Grupo"].map(h=>`<th style="padding:10px 12px;text-align:left;font-weight:700;font-size:11px;color:#991b1b;border-bottom:2px solid #fecaca;">${h}</th>`).join("")}
      </tr></thead>
      <tbody>${threatened.map((r,ri)=>`<tr style="background:${ri%2===0?"white":"#fff5f5"};">
        <td style="padding:8px 12px;font-style:italic;font-weight:600;color:#0f172a;">${formatSpeciesName(r.nomeCientifico || "")}</td>
        <td style="padding:8px 12px;">${iucnBadge(r.iucn)}</td>
        <td style="padding:8px 12px;font-size:11px;">${toMmaSigla(r.ibamaMma)||"—"}</td>
        <td style="padding:8px 12px;font-size:11px;">${toCitesSigla(r.cites)?`Ap. ${toCitesSigla(r.cites)}`:"—"}</td>
        <td style="padding:8px 12px;font-size:11px;">${getPanName(r.pan)||"NC"}</td>
        <td style="padding:8px 12px;font-size:11px;">${GRUPO_CONFIG[r.grupoTaxonomico]?.label||r.grupoTaxonomico||"—"}</td>
      </tr>`).join("")}</tbody>
    </table></div>`
    : `<div style="padding:20px;text-align:center;color:#64748b;font-style:italic;background:#f8fafc;border-radius:10px;border:1px dashed #e2e8f0;">Nenhuma espécie com status de conservação especial detectada nos dados.</div>`;

  /* ── Rare species ────────────────────────────────────── */
  const rarasContent = bioStats.rareSpecies.length > 0
    ? tbl(["Espécie","n","Categoria"],
        bioStats.rareSpecies.slice(0,40).map((r:any)=>[`<em>${r.especie}</em>`, r.n,
          r.categoria==="singleton"
            ? badge("Singleton","#7c3aed","#ede9fe")
            : badge("Doubleton","#0891b2","#e0f2fe")
        ]))
    : `<div style="padding:20px;text-align:center;color:#64748b;font-style:italic;background:#f8fafc;border-radius:10px;border:1px dashed #e2e8f0;">Nenhuma espécie rara detectada.</div>`;

  /* ── UA table ────────────────────────────────────────── */
  const uaContent = uaData.length > 1
    ? tbl(["UA","N","S (Sobs)","Shannon H'","Simpson 1-D","Pielou J'","Margalef d","Menhinick D","Berger-Parker d"],
        uaData.map((d:any)=>[d.ua, d.abundancia, d.riqueza, d.H.toFixed(3), d.D.toFixed(3), d.J.toFixed(3), d.margalef.toFixed(3), d.menhinick.toFixed(3), d.bergerParker.toFixed(3)]))
    : "";

  /* ── Grupo table ─────────────────────────────────────── */
  const grupoContent = tbl(
    ["Grupo Taxonômico","Abundância (n)","Riqueza (Sobs)","Freq. %"],
    Object.entries(grupoAgg).sort((a,b)=>b[1].n-a[1].n)
      .map(([g,v])=>[g, v.n, v.spp.size, (v.n/bioStats.N*100).toFixed(1)+"%"])
  );

  /* ── Dieta table ─────────────────────────────────────── */
  const dietaContent = dietaRows.length > 0
    ? tbl(["Guilda Trófica","n","Freq. %"],
        dietaRows.map(([g,n]:any)=>[g, n, (n/bioStats.N*100).toFixed(1)+"%"]))
    : "";

  /* ── Charts grid ─ Layout adaptativo: wide → 1col, square → 2cols (densidade máxima) ─ */
  const figCard = (c:{title:string;dataUrl:string;wide?:boolean}, idx:number, span2:boolean) => `
    <figure style="margin:0;background:white;border:1px solid #d8e1ec;border-radius:12px;overflow:hidden;box-shadow:0 3px 12px rgba(15,23,42,.07);break-inside:avoid;page-break-inside:avoid;${span2?"grid-column:span 2;":""}">
      <figcaption style="padding:10px 16px;background:linear-gradient(90deg,#0a1c32,#1e3a5f);border-bottom:2px solid #1e6146;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11.5px;font-weight:800;color:white;letter-spacing:.02em;line-height:1.3;">Fig. ${idx+1}. ${c.title}</span>
        <span style="font-size:8.5px;font-weight:700;color:#b2cde1;letter-spacing:.14em;flex-shrink:0;margin-left:8px;">SGAI</span>
      </figcaption>
      <div style="padding:12px 14px;background:#fff;display:flex;justify-content:center;align-items:center;">
        <img src="${c.dataUrl}" style="width:100%;height:auto;display:block;border-radius:3px;" />
      </div>
    </figure>`;

  /* ── Extra tables capturadas do DOM (todas as abas) ── */
  const extraTablesSection = (extraTables && extraTables.length > 0)
    ? `<section class="landscape-section page-break" style="padding:28px 32px;border-bottom:1px solid #e5e7eb;background:white;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#003399,#0891b2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;color:white;">📋</div>
          <div>
            <h2 style="margin:0;font-size:18px;font-weight:800;color:#0f172a;letter-spacing:-.01em;">Tabelas Detalhadas — Todas as Análises</h2>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">${extraTables.length} tabelas extraídas das abas Geral, Curvas, Composição, Beta, Multivariada, Biometria e CPUE</div>
            <div style="width:56px;height:3px;background:linear-gradient(90deg,#003399,#0891b2);border-radius:2px;margin-top:6px;"></div>
          </div>
        </div>
        <style>
          .report-extra-tbl table{width:100%;border-collapse:collapse;font-size:11px;font-family:inherit;}
          .report-extra-tbl th{background:linear-gradient(90deg,#0a1c32,#1e3a5f);color:white;font-weight:700;padding:8px 10px;text-align:left;font-size:10.5px;letter-spacing:.02em;border-bottom:2px solid #1e6146;}
          .report-extra-tbl td{padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#1e293b;}
          .report-extra-tbl tr:nth-child(even) td{background:#f8fafc;}
          .report-extra-tbl tr:hover td{background:#eff6ff;}
        </style>
        <div style="display:grid;grid-template-columns:1fr;gap:18px;">
          ${extraTables.map((t,ti)=>`
          <div class="report-extra-tbl" style="background:white;border:1px solid #d8e1ec;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.05);break-inside:avoid;page-break-inside:avoid;">
            <div style="padding:10px 16px;background:linear-gradient(90deg,#f0fdf4,#f0f9ff);border-bottom:2px solid #1e6146;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;font-weight:800;color:#0f172a;">Tab. ${ti+1}. ${t.title}</span>
              <span style="font-size:8.5px;font-weight:700;color:#1e6146;letter-spacing:.14em;">SGAI · Paisagem</span>
            </div>
            <div style="padding:4px 8px;overflow-x:auto;max-width:100%;">${t.html}</div>
          </div>`).join("")}
        </div>
      </section>`
    : "";

  const chartsSection = chartImages.length > 0
    ? `<section style="padding:28px 32px;border-bottom:1px solid #e5e7eb;background:linear-gradient(180deg,#fafbfd,#ffffff);">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#1e6146,#0891b2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;color:white;">📊</div>
          <div>
            <h2 style="margin:0;font-size:18px;font-weight:800;color:#0f172a;letter-spacing:-.01em;">Gráficos e Visualizações</h2>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">${chartImages.length} figuras geradas a partir das análises ativas</div>
            <div style="width:56px;height:3px;background:linear-gradient(90deg,#1e6146,#0891b2);border-radius:2px;margin-top:6px;"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;align-items:start;">
          ${chartImages.map((c,ci)=>figCard(c, ci, !!c.wide)).join("")}
        </div>
        <p style="font-size:9.5px;color:#94a3b8;margin-top:14px;font-style:italic;text-align:center;">Figuras capturadas automaticamente dos painéis renderizados. Para incluir gráficos de abas específicas (Multivariada, Biometria, CPUE), abra cada aba antes de gerar o relatório.</p>
      </section>`
    : `<section style="padding:24px 32px;border-bottom:1px solid #e5e7eb;background:#fef3c7;">
        <div style="font-size:12px;color:#92400e;text-align:center;">
          ℹ️ Nenhum gráfico capturado. Para incluir figuras no relatório, navegue pelas abas de análise (Diversidade Alfa, Multivariada, Biometria, CPUE) antes de gerar o relatório.
        </div>
      </section>`;

  /* ── Full HTML ───────────────────────────────────────── */
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório Técnico de Monitoramento — ${empNome}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;}
  body{font-family:'Inter','Segoe UI',Arial,sans-serif;margin:0;color:#1a1a1a;background:#f1f5f9;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  @media print{
    body{background:white;font-size:11px;}
    .no-print{display:none!important;}
    section{break-inside:avoid;}
    .page-break{break-before:page;}
    @page{size:A4 portrait;margin:18mm 12mm 18mm;}
    @page landscape{size:A4 landscape;margin:14mm 10mm 14mm;}
    .landscape-section{page:landscape;}
    /* Header & footer fixos repetidos em cada página impressa (Chrome-safe).
       Não dá para inserir nº de página dinâmico em window.print do Chrome —
       usamos identificação estável (código do relatório + empreendimento). */
    .print-header,.print-footer{
      position:fixed;left:0;right:0;font-family:'Inter',sans-serif;font-size:8.5px;
      color:#64748b;display:flex;justify-content:space-between;
      align-items:center;padding:4px 14px;background:white;z-index:10;
    }
    .print-header{top:0;border-bottom:1px solid #e5e7eb;}
    .print-footer{bottom:0;border-top:1px solid #e5e7eb;color:#94a3b8;}
    .print-header,.print-footer{display:none;}
  }
  @media print{
    .print-header,.print-footer{display:flex!important;}
    .print-header .code,.print-footer .code{font-weight:700;color:#003399;font-family:'JetBrains Mono',monospace;}
    .cover-page{position:relative;z-index:20;background:#0a1c32;}
  }
  /* Visualização em tela: tabelas largas com scroll horizontal */
  .landscape-section{overflow-x:auto;}
  .report-extra-tbl table{table-layout:auto;}
  .report-extra-tbl th,.report-extra-tbl td{white-space:nowrap;vertical-align:middle;}
  @media print{
    .report-extra-tbl th,.report-extra-tbl td{white-space:normal;word-break:break-word;font-size:9.5px!important;padding:4px 6px!important;}
    .report-extra-tbl table{font-size:9.5px!important;}
  }
</style>
</head>
<body>

<!-- PRINT BUTTON -->
<div class="no-print" style="position:fixed;bottom:24px;right:24px;z-index:999;display:flex;gap:10px;">
  <button onclick="window.print()" style="background:linear-gradient(135deg,#003399,#0055cc);color:white;border:none;border-radius:12px;padding:12px 22px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(0,51,153,.35);display:flex;align-items:center;gap:8px;">
    🖨️ Imprimir / Salvar PDF
  </button>
</div>

<!-- HEADER / FOOTER fixos para impressão (repetem em cada página no Chrome) -->
<div class="print-header">
  <span class="code">${reportCode}</span>
  <span>${empNome.slice(0,60)}</span>
  <span>SGAI — Relatório Técnico</span>
</div>
<div class="print-footer">
  <span>SGAI · maurivangestao.online</span>
  <span class="code">${reportCode}</span>
  <span>${geradoEm}</span>
</div>

<!-- COVER (estilo Relatório 360° / Financeiro com imagem distinta de campo) -->
<div class="cover-page" style="position:relative;background:#0a1c32;color:white;overflow:hidden;">
  <!-- Imagem de fundo distinta -->
  <div style="position:absolute;inset:0;background-image:url('${coverBgDataUrl||"/images/pdf-cover-quelonios.png"}');background-size:cover;background-position:center;opacity:.55;"></div>
  <!-- Overlay escuro gradiente -->
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,28,50,.55) 0%,rgba(10,28,50,.78) 55%,rgba(10,28,50,.96) 100%);"></div>
  <!-- Faixa verde no topo (estilo 360°) -->
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#1e6146;"></div>

  <div style="position:relative;padding:54px 48px 44px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:34px;">
      <div style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);border-radius:10px;padding:9px 16px;font-size:13px;font-weight:800;letter-spacing:.14em;">SGAI</div>
      <div style="font-size:9px;color:#b2cde1;font-weight:600;letter-spacing:.04em;">Sistema de Gestão Ambiental Integrada</div>
      <div style="height:1px;flex:1;background:rgba(178,205,225,.3);"></div>
      <div style="font-size:10.5px;color:#b2cde1;opacity:.85;">maurivangestao.online</div>
    </div>

    <!-- Separador azul fino (estilo 360°) -->
    <div style="height:.8px;background:#3a7bbf;margin-bottom:18px;"></div>

    <!-- Tipo de relatório em âmbar com letter-spacing (estilo 360°) -->
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px;">
      <div style="font-size:10.5px;font-weight:800;color:#f5a800;letter-spacing:.22em;text-transform:uppercase;">Relatório Técnico de Monitoramento</div>
      <div style="background:rgba(245,168,0,.15);border:1px solid rgba(245,168,0,.45);border-radius:6px;padding:3px 10px;font-size:10.5px;font-weight:800;color:#f5a800;letter-spacing:.08em;font-family:'JetBrains Mono',monospace;">${reportCode}</div>
    </div>

    <h1 style="margin:0 0 8px;font-size:34px;font-weight:800;line-height:1.15;letter-spacing:-.015em;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.4);">Monitoramento de<br>Biodiversidade em Campo</h1>

    <div style="font-size:13px;color:#b2cde1;font-weight:500;margin-bottom:14px;">Análise de Diversidade, Composição e Conservação</div>

    <!-- Divisor verde (estilo 360°) -->
    <div style="width:64px;height:2.5px;background:#1e6146;margin-bottom:28px;"></div>

    <!-- Metadata em grid (estilo 360°) -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;max-width:760px;">
      ${[
        ["EMPREENDIMENTO",empNome],
        ["CAMPANHA",campLabel],
        ["GRUPO TAXONÔMICO",grupoLabel],
        ["GERADO EM",geradoEm],
      ].map(([lbl,val])=>`
      <div>
        <div style="font-size:7.5px;font-weight:800;color:#b2cde1;letter-spacing:.16em;margin-bottom:5px;">${lbl}</div>
        <div style="font-size:12px;font-weight:700;color:#fff;line-height:1.35;">${val}</div>
      </div>`).join("")}
    </div>

    <!-- Badge confidencial (estilo 360°) -->
    <div style="margin-top:26px;">
      <div style="display:inline-block;background:#1e6146;border-radius:18px;padding:7px 18px;font-size:9.5px;font-weight:800;letter-spacing:.08em;color:#fff;">● RELATÓRIO TÉCNICO-CIENTÍFICO</div>
      <div style="font-size:9.5px;color:#b2cde1;margin-top:10px;max-width:600px;line-height:1.5;">Documento gerado automaticamente a partir dos registros de monitoramento de campo. Análises estatísticas e textuais complementares para suporte à decisão técnica.</div>
    </div>
  </div>

  <!-- Rodapé da capa (estilo 360°) -->
  <div style="position:relative;background:#1e6146;height:2px;"></div>
  <div style="position:relative;background:#0a1c32;padding:8px 48px;text-align:center;font-size:9.5px;color:#b2cde1;">SGAI — Sistema de Gestão Ambiental Integrada</div>
</div>

<!-- WRAPPER -->
<div style="max-width:1100px;margin:0 auto;background:white;box-shadow:0 0 40px rgba(0,0,0,.08);">

${sec("sintese","Síntese Executiva","📋",kpiGrid,"#003399")}
${sec("alfa","Índices de Diversidade Alfa","📈",alfaContent,"#7c3aed")}
${sec("estim","Estimadores de Riqueza","🔬",estimTable,"#0891b2")}
${sec("spp","Espécies Mais Abundantes — Top 20","🌿",topSpContent,"#16a34a")}
${sec("ameac","Espécies em Situação de Conservação Especial","⚠️",threatContent,"#dc2626")}
${bioStats.rareSpecies.length>0?sec("raras","Espécies Raras (Singletons e Doubletons)","🔍",rarasContent,"#7c3aed"):""}
${uaData.length>1?sec("ua","Diversidade por Unidade Amostral","📌",uaContent,"#003399"):""}
${sec("grupo","Composição por Grupo Taxonômico","🗂️",grupoContent,"#475569")}
${dietaRows.length>0?sec("dieta","Guilda Trófica (Dieta)","🍽️",dietaContent,"#ea580c"):""}
${chartsSection}
${extraTablesSection}
${analyses["recom"]?sec("recom","Recomendações para o Monitoramento","💡","","#16a34a"):""}

<!-- FOOTER -->
<footer style="padding:28px 36px;background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-top:3px solid #e2e8f0;">
  <div style="background:linear-gradient(135deg,#fffbeb,#fff7ed);border:1px solid #fcd34d;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:16px;flex-shrink:0;">⚠️</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:4px;">Aviso sobre Análises por Inteligência Artificial</div>
        <div style="font-size:11px;color:#92400e;line-height:1.6;">As análises geradas por IA têm caráter complementar e informativo. O profissional responsável deve verificar as informações, contextualizar com o histórico do empreendimento e com a literatura científica regional antes de utilizá-las em relatórios técnicos, laudos ou tomadas de decisão. Não substitui análise crítica especializada.</div>
      </div>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
    <div style="font-size:11px;color:#64748b;">
      <strong style="color:#003399;">SGAI</strong> — Sistema de Gestão Ambiental Integrada<br>
      <span style="color:#94a3b8;">maurivangestao.online</span>
    </div>
    <div style="font-size:10px;color:#94a3b8;text-align:right;">
      Relatório gerado automaticamente<br>${geradoEm}
    </div>
  </div>
</footer>

</div><!-- /WRAPPER -->
</body>
</html>`;
}

type ReportSectionState = {
  id: string; title: string;
  status: "pending" | "loading" | "done" | "error";
  analise?: string;
};

function formatCampanhaLabel(filterCampanha: string, multi: Set<string>, mode: "long" | "fname" = "long"): string {
  if (multi.size === 1) {
    const only = Array.from(multi)[0];
    return mode === "fname" ? `_${only}` : only;
  }
  if (multi.size > 1) {
    const arr = Array.from(multi);
    if (mode === "fname") return `_${multi.size}campanhas`;
    return arr.length <= 3 ? arr.join(", ") : `${multi.size} campanhas (${arr.slice(0, 3).join(", ")}…)`;
  }
  if (filterCampanha !== "todas") return mode === "fname" ? `_${filterCampanha}` : filterCampanha;
  return mode === "fname" ? "" : "Todas as campanhas";
}

type BioTabId = "geral"|"curvas"|"composicao"|"beta"|"multivariada"|"biometria"|"cpue";
type SubModes = {
  bioMode: "geral"|"por_ua"; setBioMode: (v:"geral"|"por_ua")=>void;
  groupViewMode: "ua"|"campanha"|"localizacao"; setGroupViewMode: (v:"ua"|"campanha"|"localizacao")=>void;
  dendroMetric: "jaccard"|"bray-curtis"|"sorensen"; setDendroMetric: (v:"jaccard"|"bray-curtis"|"sorensen")=>void;
  heatMode: "spUa"|"campSp"|"uaCamp"; setHeatMode: (v:"spUa"|"campSp"|"uaCamp")=>void;
  rarefMode: "campanha"|"ua"; setRarefMode: (v:"campanha"|"ua")=>void;
  hillMode: "campanha"|"ua"; setHillMode: (v:"campanha"|"ua")=>void;
  indvalGroupBy: "campanha"|"ua"|"posicao"; setIndvalGroupBy: (v:"campanha"|"ua"|"posicao")=>void;
  multiMode: "ua"|"campanha"|"posicao"; setMultiMode: (v:"ua"|"campanha"|"posicao")=>void;
};
function FullReportBtn({
  bioStats, uaData, registrosFiltrados, statsSource, selectedEmp, filterCampanha, filterCampanhasMulti, filterGrupo,
  bioAnalysisTab, setBioAnalysisTab, subModes,
}: {
  bioStats: any; uaData: any[]; registrosFiltrados: CampoRegistro[];
  statsSource: CampoRegistro[]; selectedEmp?: any;
  filterCampanha: string; filterCampanhasMulti: Set<string>; filterGrupo: string;
  bioAnalysisTab: BioTabId;
  setBioAnalysisTab: (t: BioTabId) => void;
  subModes: SubModes;
}) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [sections, setSections] = useState<ReportSectionState[]>([]);
  const [done, setDone] = useState(false);
  const [reportBlob, setReportBlob] = useState<Blob | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMsg, setCaptureMsg] = useState("");
  const abortRef = useRef(false);

  async function callAI(tipo: string, contexto: string): Promise<string> {
    const res = await fetch("/api/campo/ai-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, contexto }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro na IA");
    AI_ANALYSES_CACHE.set(tipo, data.analise);
    return data.analise || "";
  }

  function updSec(id: string, patch: Partial<ReportSectionState>) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  async function generate() {
    if (!bioStats) return;
    abortRef.current = false;
    const empNome = selectedEmp?.nome || "N/D";
    const campLabel = formatCampanhaLabel(filterCampanha, filterCampanhasMulti, "long");
    const grupoLabel = GRUPO_CONFIG[filterGrupo]?.label || filterGrupo || "Todos os grupos";

    const hasThreatened = statsSource.some(r => {
      const iucn = toIucnSigla(r.iucn);
      const mma  = toMmaSigla(r.ibamaMma);
      return (iucn && ["VU","EN","CR","EW","EX","NT","DD"].includes(iucn)) ||
             (mma  && ["VU","EN","CR","EW","EX","NT","DD"].includes(mma))  ||
             !!toCitesSigla(r.cites) || hasPan(r.pan);
    });
    const hasUA = uaData.length > 1;
    const hasDieta = Object.keys(bioStats.byDieta || {}).length > 0;
    const covPct = bioStats.chao1 > 0 ? (bioStats.Sobs / bioStats.chao1 * 100).toFixed(0) : "N/D";

    const defs = [
      {
        id: "sintese", title: "Síntese Executiva",
        tipo: "Síntese Executiva do Monitoramento",
        contexto: `Empreendimento: ${empNome}. Campanha: ${campLabel}. Grupo taxonômico: ${grupoLabel}.\nTotal de registros: ${bioStats.N}. Riqueza observada (Sobs): ${bioStats.Sobs}.\nShannon H'=${bioStats.H.toFixed(3)}, Pielou J'=${bioStats.J.toFixed(3)}, Simpson 1-D=${bioStats.D.toFixed(3)}.\nChao1=${bioStats.chao1.toFixed(1)}, cobertura estimada: ${covPct}%.\nEspécies ameaçadas: ${hasThreatened ? "detectadas" : "nenhuma detectada"}. Top 3: ${bioStats.topSp.slice(0, 3).map(([sp, n]: [string, number]) => `${sp} (n=${n})`).join(", ")}.`,
      },
      {
        id: "alfa", title: "Diversidade Alfa",
        tipo: "Índices de Diversidade Alfa",
        contexto: `N=${bioStats.N}, Sobs=${bioStats.Sobs}. H'=${bioStats.H.toFixed(3)}, J'=${bioStats.J.toFixed(3)}, 1-D=${bioStats.D.toFixed(3)}, Margalef d=${bioStats.margalef.toFixed(3)}, Menhinick D=${bioStats.menhinick.toFixed(3)}. Famílias: ${bioStats.nFamilias}. Ordens: ${bioStats.nOrdens}.`,
      },
      {
        id: "estim", title: "Estimadores de Riqueza",
        tipo: "Estimadores de Riqueza de Espécies",
        contexto: `Sobs=${bioStats.Sobs}. Jack1=${bioStats.jack1.toFixed(1)}, Jack2=${bioStats.jack2.toFixed(1)}, Bootstrap=${bioStats.boot.toFixed(1)}, Chao1=${bioStats.chao1.toFixed(1)}, Chao2=${bioStats.chao2.toFixed(1)}. Cobertura (Sobs/Chao1): ${covPct}%. Singletons: ${bioStats.rareSpecies.filter((s: any) => s.categoria === "singleton").length}. Doubletons: ${bioStats.rareSpecies.filter((s: any) => s.categoria === "doubleton").length}.`,
      },
      {
        id: "spp", title: "Top Espécies / Dominância",
        tipo: "Composição e Dominância de Espécies",
        contexto: `Riqueza total: ${bioStats.Sobs}. N total: ${bioStats.N}.\nTop 15:\n${bioStats.topSp.slice(0, 15).map(([sp, n]: [string, number], i: number) => `${i + 1}. ${sp}: ${n} (${(n / bioStats.N * 100).toFixed(1)}%)`).join("\n")}`,
      },
      ...(hasThreatened ? [{
        id: "ameac", title: "Espécies Ameaçadas",
        tipo: "Espécies em Situação de Conservação Especial",
        contexto: (() => {
          const seen = new Set<string>();
          const list = statsSource.filter(r => {
            const s = toIucnSigla(r.iucn);
            return (s && ["VU","EN","CR","EW","EX","NT","DD"].includes(s)) || !!toCitesSigla(r.cites) || hasPan(r.pan);
          }).filter(r => { if (!r.nomeCientifico || seen.has(r.nomeCientifico)) return false; seen.add(r.nomeCientifico); return true; });
          return `Total: ${list.length}.\n${list.map(r => `${r.nomeCientifico} — IUCN: ${toIucnSigla(r.iucn) || "—"}, MMA: ${toMmaSigla(r.ibamaMma) || "—"}, CITES: ${toCitesSigla(r.cites) || "—"}, PAN: ${getPanName(r.pan) || "NC"}`).join("\n")}`;
        })(),
      }] : []),
      ...(bioStats.rareSpecies.length > 0 ? [{
        id: "raras", title: "Espécies Raras",
        tipo: "Espécies Raras e Suficiência Amostral",
        contexto: `Singletons: ${bioStats.rareSpecies.filter((s: any) => s.categoria === "singleton").length}. Doubletons: ${bioStats.rareSpecies.filter((s: any) => s.categoria === "doubleton").length}.\n${bioStats.rareSpecies.slice(0, 20).map((r: any) => `${r.especie}: ${r.n} — ${r.categoria}`).join("\n")}`,
      }] : []),
      ...(hasUA ? [{
        id: "ua", title: "Diversidade por UA",
        tipo: "Diversidade por Unidade Amostral",
        contexto: `UAs: ${uaData.length}.\n${uaData.map((d: any) => `UA ${d.ua}: N=${d.abundancia}, S=${d.riqueza}, H'=${d.H.toFixed(3)}, J'=${d.J.toFixed(3)}`).join("\n")}`,
      }] : []),
      ...(hasDieta ? [{
        id: "dieta", title: "Guilda Trófica",
        tipo: "Análise de Guilda Trófica",
        contexto: `Categorias de dieta:\n${Object.entries(bioStats.byDieta || {}).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join("\n")}`,
      }] : []),
      {
        id: "recom", title: "Recomendações Gerais",
        tipo: "Recomendações para o Monitoramento",
        contexto: `Empreendimento: ${empNome}. Grupo: ${grupoLabel}. Campanha: ${campLabel}. N=${bioStats.N}, Sobs=${bioStats.Sobs}, H'=${bioStats.H.toFixed(3)}, J'=${bioStats.J.toFixed(3)}. Cobertura: ${covPct}%. Ameaçadas: ${hasThreatened ? "sim" : "não"}.`,
      },
    ];

    setSections(defs.map(d => ({ id: d.id, title: d.title, status: "pending" })));
    setStarted(true);
    setDone(false);
    setReportBlob(null);

    const analyses: Record<string, string> = {};
    for (const def of defs) {
      if (abortRef.current) break;
      updSec(def.id, { status: "loading" });
      try {
        const analise = await callAI(def.tipo, def.contexto);
        analyses[def.id] = analise;
        updSec(def.id, { status: "done", analise });
      } catch {
        analyses[def.id] = "";
        updSec(def.id, { status: "error" });
      }
    }

    const { charts: chartImages, tables: extraTables } = await captureAllAcrossTabs();
    const coverBgDataUrl = await fetchImageAsDataUrl("/images/pdf-cover-quelonios.png");
    const html = buildHtmlReport({
      empNome, campLabel, grupoLabel, bioStats, uaData,
      statsSource, registrosFiltrados, analyses, chartImages, extraTables, coverBgDataUrl,
      geradoEm: new Date().toLocaleString("pt-BR"),
    });
    setReportBlob(new Blob([html], { type: "text/html;charset=utf-8" }));
    setDone(true);
  }

  async function generateQuick() {
    if (!bioStats) return;
    const empNome = selectedEmp?.nome || "N/D";
    const campLabel = formatCampanhaLabel(filterCampanha, filterCampanhasMulti, "long");
    const grupoLabel = GRUPO_CONFIG[filterGrupo]?.label || filterGrupo || "Todos os grupos";
    const { charts: chartImages, tables: extraTables } = await captureAllAcrossTabs();
    const coverBgDataUrl = await fetchImageAsDataUrl("/images/pdf-cover-quelonios.png");
    const html = buildHtmlReport({
      empNome, campLabel, grupoLabel, bioStats, uaData,
      statsSource, registrosFiltrados, analyses: {}, chartImages, extraTables, coverBgDataUrl,
      geradoEm: new Date().toLocaleString("pt-BR"),
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    openReport(blob);
  }

  function handleOpen() {
    setOpen(true);
    setStarted(false);
    setSections([]);
    setDone(false);
    setReportBlob(null);
  }

  // Hash rápido (FNV-1a 32-bit em hex) — usado como fingerprint estável da imagem
  function fingerprint(s: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16);
  }

  function captureChartImages(into?: { title: string; dataUrl: string; wide?: boolean }[], modeKey: string = ""): { title: string; dataUrl: string; wide?: boolean }[] {
    const results = into || [];
    // Dedupe APENAS pelo conteúdo binário (fingerprint). Se a imagem é idêntica → mesma figura.
    const seenHashes = new Set<string>((results as any)._hashes || []);
    // Conta quantas vezes cada título base já apareceu — usa _rawTitle persistido em cada entry
    const titleCount: Map<string, number> = (results as any)._titleCount instanceof Map
      ? (results as any)._titleCount
      : new Map<string, number>();
    if (!(results as any)._titleCount) {
      results.forEach((r: any) => {
        const base = r._rawTitle || r.title;
        titleCount.set(base, (titleCount.get(base) || 0) + 1);
      });
      (results as any)._titleCount = titleCount;
    }
    const BLANK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

    const tryPush = (rawTitle: string, dataUrl: string, wide: boolean) => {
      const h = fingerprint(dataUrl);
      if (seenHashes.has(h)) return; // mesma imagem capturada antes → ignora
      seenHashes.add(h);
      // Primeira ocorrência: usa o título limpo. A partir da 2ª (mesmo título mas pixels diferentes): adiciona modo.
      const prevCount = titleCount.get(rawTitle) || 0;
      const title = prevCount === 0
        ? rawTitle
        : (modeKey ? `${rawTitle} — ${modeKey}` : `${rawTitle} (vista ${prevCount + 1})`);
      titleCount.set(rawTitle, prevCount + 1);
      const entry: any = { title, dataUrl, wide };
      entry._rawTitle = rawTitle;
      results.push(entry);
    };

    const root = document.querySelector("[data-bio-analysis-root]") || document;
    const allFigs = Array.from(root.querySelectorAll("[data-chart-title], [data-svg-figure]"));
    allFigs.forEach((el) => {
      if (el.hasAttribute("data-chart-title")) {
        const rawTitle = el.getAttribute("data-chart-title") || "Gráfico";
        const canvas = el.querySelector("canvas") as HTMLCanvasElement | null;
        if (!canvas) return;
        try {
          const dataUrl = canvas.toDataURL("image/png");
          if (dataUrl && dataUrl !== BLANK && dataUrl.length > 200) {
            const wide = (canvas.width / Math.max(1, canvas.height)) > 1.9;
            tryPush(rawTitle, dataUrl, wide);
          }
        } catch {}
      } else if (el.hasAttribute("data-svg-figure")) {
        const name = el.getAttribute("data-svg-figure") || "figura";
        const rawTitle = svgFigureTitle(name);
        const svgs = Array.from(el.querySelectorAll("svg")).filter(s => !s.closest("[data-svg-download-btn]"));
        const svg = svgs[0] as SVGSVGElement | undefined;
        if (!svg) return;
        try {
          const clone = svg.cloneNode(true) as SVGSVGElement;
          if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          if (!clone.getAttribute("viewBox")) {
            const w = (svg as any).viewBox?.baseVal?.width || svg.clientWidth || 800;
            const h = (svg as any).viewBox?.baseVal?.height || svg.clientHeight || 400;
            clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
          }
          const xml = new XMLSerializer().serializeToString(clone);
          const b64 = btoa(unescape(encodeURIComponent(xml)));
          const dataUrl = `data:image/svg+xml;base64,${b64}`;
          const vb = clone.getAttribute("viewBox")?.split(/\s+/).map(Number) || [0, 0, 1, 1];
          const wide = (vb[2] / Math.max(1, vb[3])) > 1.9;
          tryPush(rawTitle, dataUrl, wide);
        } catch {}
      }
    });
    // Persiste as hashes para chamadas subsequentes (passadas no mesmo array `into`)
    (results as any)._hashes = Array.from(seenHashes);
    return results;
  }

  // Extrai todas as tabelas dentro do container de análises (data-bio-analysis-root)
  function captureTablesHtml(into?: { title: string; html: string }[]): { title: string; html: string }[] {
    const results = into || [];
    const seenKeys = new Set(results.map(r => r.html.slice(0,180)));
    const root = document.querySelector("[data-bio-analysis-root]");
    if (!root) return results;
    root.querySelectorAll("table").forEach((tbl) => {
      if (tbl.closest("[data-skip-report]")) return;
      // Acha o título mais próximo subindo na árvore
      let titleEl: Element | null = null;
      let p: Element | null = tbl;
      for (let i = 0; i < 8 && p; i++) {
        const found = p.previousElementSibling?.querySelector?.(".text-sm, h2, h3, [class*='CardTitle']") || p.querySelector(".text-sm, h2, h3, [class*='CardTitle']");
        if (found && found.textContent && found.textContent.trim().length > 3) { titleEl = found; break; }
        p = p.parentElement;
      }
      const title = (titleEl?.textContent || "Tabela").trim().replace(/\s+/g," ").slice(0,140);
      // Serializa apenas o conteúdo da tabela (preserva estrutura, remove classes Tailwind)
      const clone = tbl.cloneNode(true) as HTMLTableElement;
      // Insere separador ", " entre badges/spans adjacentes dentro de células (TD/TH)
      // para que UA e Campanha apareçam como "UA-2, UA-3" em vez de "UA-2UA-3"/"23".
      clone.querySelectorAll("td, th").forEach(cell => {
        const inlineChildren = Array.from(cell.children).filter(c => {
          const tag = c.tagName.toLowerCase();
          return tag === "span" || tag === "div" || tag === "a" || tag === "small" || tag === "em" || tag === "i" || tag === "b" || tag === "strong";
        });
        if (inlineChildren.length >= 2) {
          for (let i = 0; i < inlineChildren.length - 1; i++) {
            const sep = cell.ownerDocument!.createTextNode(", ");
            inlineChildren[i].after(sep);
          }
        }
      });
      clone.querySelectorAll("*").forEach(el => {
        el.removeAttribute("class");
        el.removeAttribute("style");
      });
      const html = clone.outerHTML;
      const key = html.slice(0,180);
      if (seenKeys.has(key)) return;
      // Filtra tabelas vazias/pequenas demais
      if ((clone.textContent || "").replace(/\s/g,"").length < 12) return;
      results.push({ title, html });
      seenKeys.add(key);
    });
    return results;
  }

  // Itera todas as abas + sub-modos capturando figuras + tabelas em cada combinação
  async function captureAllAcrossTabs(): Promise<{ charts: {title:string;dataUrl:string;wide?:boolean}[]; tables: {title:string;html:string}[] }> {
    setIsCapturing(true);
    const charts: {title:string;dataUrl:string;wide?:boolean}[] = [];
    const tables: {title:string;html:string}[] = [];
    const orig = {
      tab: bioAnalysisTab,
      bioMode: subModes.bioMode, groupViewMode: subModes.groupViewMode,
      dendroMetric: subModes.dendroMetric, heatMode: subModes.heatMode,
      rarefMode: subModes.rarefMode, hillMode: subModes.hillMode,
      indvalGroupBy: subModes.indvalGroupBy, multiMode: subModes.multiMode,
    };

    // Sincronização baseada em rAF: espera React commit + animação Chart.js
    const raf = () => new Promise<void>(r => requestAnimationFrame(() => r()));
    const settle = async (ms=600) => {
      await raf(); await raf();
      await new Promise(r => setTimeout(r, ms));
    };
    const cap = async (label: string, modeKey: string) => {
      setCaptureMsg(label);
      await settle();
      captureChartImages(charts, modeKey);
      captureTablesHtml(tables);
    };

    try {
      // ABA: geral — varia groupViewMode e bioMode
      setBioAnalysisTab("geral");
      await settle(300);
      for (const gm of ["ua","campanha","localizacao"] as const) {
        subModes.setGroupViewMode(gm);
        await cap(`Visão Geral · grupo=${gm}`, `Geral/grupo=${gm}`);
      }
      for (const bm of ["geral","por_ua"] as const) {
        subModes.setBioMode(bm);
        await cap(`Visão Geral · modo=${bm}`, `Geral/modo=${bm}`);
      }

      // ABA: curvas — rarefação e Hill
      setBioAnalysisTab("curvas");
      await settle(300);
      for (const rm of ["campanha","ua"] as const) {
        subModes.setRarefMode(rm);
        await cap(`Curvas · rarefação=${rm}`, `Curvas/rarefação=${rm}`);
      }
      for (const hm of ["campanha","ua"] as const) {
        subModes.setHillMode(hm);
        await cap(`Curvas · Hill=${hm}`, `Curvas/Hill=${hm}`);
      }

      // ABA: composicao — groupView e heatmap
      setBioAnalysisTab("composicao");
      await settle(300);
      for (const gm of ["ua","campanha","localizacao"] as const) {
        subModes.setGroupViewMode(gm);
        await cap(`Composição · grupo=${gm}`, `Composição/grupo=${gm}`);
      }
      for (const hm of ["spUa","campSp","uaCamp"] as const) {
        subModes.setHeatMode(hm);
        await cap(`Composição · heatmap=${hm}`, `Heatmap/${hm}`);
      }

      // ABA: beta — métricas de dendrograma
      setBioAnalysisTab("beta");
      await settle(300);
      for (const dm of ["jaccard","bray-curtis","sorensen"] as const) {
        subModes.setDendroMetric(dm);
        await cap(`Beta & Agrupamento · ${dm}`, `Beta/${dm}`);
      }

      // ABA: multivariada — multiMode e IndVal groupBy
      setBioAnalysisTab("multivariada");
      await settle(300);
      for (const mm of ["ua","campanha","posicao"] as const) {
        subModes.setMultiMode(mm);
        await cap(`Multivariada · ${mm}`, `Multivariada/${mm}`);
      }
      for (const ig of ["campanha","ua","posicao"] as const) {
        subModes.setIndvalGroupBy(ig);
        await cap(`Multivariada · IndVal=${ig}`, `IndVal/${ig}`);
      }

      // ABA: biometria
      setBioAnalysisTab("biometria");
      await cap("Biometria", "Biometria");

      // ABA: CPUE
      setBioAnalysisTab("cpue");
      await cap("CPUE", "CPUE");
    } finally {
      // Restaura sempre — mesmo se algo der erro no meio
      subModes.setBioMode(orig.bioMode);
      subModes.setGroupViewMode(orig.groupViewMode);
      subModes.setDendroMetric(orig.dendroMetric);
      subModes.setHeatMode(orig.heatMode);
      subModes.setRarefMode(orig.rarefMode);
      subModes.setHillMode(orig.hillMode);
      subModes.setIndvalGroupBy(orig.indvalGroupBy);
      subModes.setMultiMode(orig.multiMode);
      setBioAnalysisTab(orig.tab);
      await new Promise(r => setTimeout(r, 200));
      setIsCapturing(false);
      setCaptureMsg("");
    }
    return { charts, tables };
  }

  function openReport(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio_campo_${new Date().toISOString().split("T")[0]}.html`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function download() {
    if (!reportBlob) return;
    openReport(reportBlob);
  }

  const statusIcon = (s: ReportSectionState["status"]) =>
    s === "done" ? "✓" : s === "error" ? "✗" : s === "loading" ? null : "○";

  return (
    <>
      <Button
        size="sm" variant="outline"
        onClick={handleOpen}
        disabled={!bioStats || registrosFiltrados.length === 0}
        className="gap-1.5 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
      >
        <FileText className="w-3 h-3" /> Relatório
      </Button>

      {/* Overlay de captura — bloqueia interação e mostra progresso */}
      {isCapturing && (
        <div
          style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(15,23,42,0.45)",backdropFilter:"blur(2px)",display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"all"}}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{background:"white",borderRadius:14,padding:"22px 28px",boxShadow:"0 20px 50px rgba(0,0,0,0.25)",minWidth:340,maxWidth:480,display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
            <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
            <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>Gerando relatório técnico</div>
            <div style={{fontSize:12,color:"#475569",textAlign:"center",lineHeight:1.5}}>
              Capturando figuras e tabelas de todas as abas e sub-modos.<br/>
              <span style={{color:"#0891b2",fontWeight:600}}>{captureMsg || "Preparando…"}</span>
            </div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>Não feche esta página nem clique nas abas.</div>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { abortRef.current = true; } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" />
              Gerar Relatório Técnico
            </DialogTitle>
          </DialogHeader>

          {!started && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Gera um documento HTML completo com design profissional, todos os gráficos e tabelas de biodiversidade. Abre em nova aba para impressão ou exportação como PDF.
              </p>

              {/* Quick report card */}
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Relatório Rápido</p>
                    <p className="text-xs text-emerald-700">Geração instantânea com todos os gráficos e dados estatísticos</p>
                  </div>
                </div>
                <Button
                  disabled={isCapturing}
                  onClick={async () => { setOpen(false); await generateQuick(); }}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60"
                >
                  {isCapturing
                    ? (<><Loader2 className="w-4 h-4 animate-spin" /> Capturando análises…</>)
                    : (<><FileText className="w-4 h-4" /> Gerar Agora (sem IA)</>)}
                </Button>
              </div>

              {/* AI report card */}
              <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <div>
                    <p className="text-sm font-semibold text-purple-800">Relatório com Análise por IA</p>
                    <p className="text-xs text-purple-700">Inclui interpretação técnica por IA em cada seção (1–2 min)</p>
                  </div>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800 flex gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Serão feitas <strong>7-9 chamadas de IA</strong> sequenciais. Tempo estimado: <strong>1–2 minutos</strong>.</span>
                </div>
                <Button onClick={generate} className="w-full gap-2 text-white text-sm" style={{ backgroundColor: "#4f46e5" }}>
                  <Sparkles className="w-4 h-4" /> Gerar com IA
                </Button>
              </div>

              <div className="rounded-lg bg-slate-50 border p-3 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Ambos os relatórios incluem:</p>
                <p>• Capa profissional • KPIs executivos • Índices alfa e estimadores</p>
                <p>• Top espécies • Espécies ameaçadas • Espécies raras</p>
                <p>• Diversidade por UA • Guildas tróficas • Todos os gráficos</p>
              </div>
            </div>
          )}

          {started && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Gerando análises por IA sequencialmente…</p>
              {sections.map(s => (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${
                    s.status === "done" ? "bg-green-100 text-green-700" :
                    s.status === "loading" ? "bg-purple-100 text-purple-700" :
                    s.status === "error" ? "bg-red-100 text-red-600" :
                    "bg-slate-100 text-slate-400"}`}>
                    {s.status === "loading"
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <span>{statusIcon(s.status)}</span>}
                  </span>
                  <span className={
                    s.status === "done" ? "text-foreground" :
                    s.status === "loading" ? "text-purple-700 font-medium" :
                    s.status === "error" ? "text-red-500" : "text-muted-foreground"
                  }>{s.title}</span>
                </div>
              ))}

              {done && (
                <div className="pt-3 space-y-2 border-t">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800 font-medium">
                    ✅ Relatório gerado com sucesso!
                  </div>
                  <Button onClick={download} className="w-full gap-2 text-white" style={{ backgroundColor: "#003399" }}>
                    <FileText className="w-4 h-4" /> Abrir Relatório em Nova Aba
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Use Ctrl+P / Cmd+P na nova aba para exportar como PDF
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Chart / table download utilities ──────────────────────────────────────────

/**
 * Exporta um canvas do Chart.js em alta resolução.
 *
 * Estratégia:
 *  1. Obtém a instância Chart.js via Chart.getChart(canvas).
 *  2. Temporariamente aumenta devicePixelRatio → re-renderiza vetorialmente (sem blur).
 *  3. Copia o resultado para um canvas final com fundo branco + título + margem.
 *  4. Restaura o DPR original em setTimeout para não causar flash visível.
 *
 * Para SVGs ou canvas sem instância Chart.js usa fallback de escala.
 */
function downloadCanvas(canvas: HTMLCanvasElement, filename: string, format: "png" | "jpeg") {
  const mime = format === "jpeg" ? "image/jpeg" : "image/png";
  const ext  = format === "jpeg" ? "jpg" : "png";

  // Título: lê data-chart-title do ancestral mais próximo
  const rawTitle =
    canvas.closest("[data-chart-title]")?.getAttribute("data-chart-title") ||
    filename.replace(/_/g, " ");

  const TARGET_DPR = 3; // ≈ 288 DPI em telas de 96 DPI

  const buildOutput = (src: HTMLCanvasElement) => {
    const sw = src.width;
    const sh = src.height;

    // Margens e título (em pixels do canvas de saída, já em alta resolução)
    const PAD = Math.round(sw * 0.025);  // ~2.5% de margem lateral
    const TH  = Math.round(sw * 0.045); // altura da faixa de título

    const ow = sw + PAD * 2;
    const oh = sh + TH + PAD;

    const off = document.createElement("canvas");
    off.width  = ow;
    off.height = oh;
    const ctx = off.getContext("2d")!;

    // Fundo branco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ow, oh);

    // Título
    const fontSize = Math.max(14, Math.round(sw / 55));
    ctx.fillStyle   = "#1e293b";
    ctx.font        = `bold ${fontSize}px system-ui, Arial, sans-serif`;
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(rawTitle, ow / 2, TH / 2, ow - PAD * 2);

    // Linha separadora
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, TH);
    ctx.lineTo(ow - PAD, TH);
    ctx.stroke();

    // Gráfico
    ctx.drawImage(src, PAD, TH);

    const a = document.createElement("a");
    a.href     = off.toDataURL(mime, 0.97);
    a.download = `${filename}.${ext}`;
    a.click();
  };

  const chart = Chart.getChart(canvas);
  if (chart) {
    const origDPR = chart.options.devicePixelRatio ?? (window.devicePixelRatio || 1);
    chart.options.devicePixelRatio = TARGET_DPR;
    chart.resize();
    chart.update("none");

    buildOutput(canvas);

    // Restaura DPR original sem causar flash
    setTimeout(() => {
      chart.options.devicePixelRatio = origDPR;
      chart.resize();
      chart.update("none");
    }, 150);
  } else {
    // Fallback para canvas sem instância Chart.js (SVG convertido etc.)
    const cssW = canvas.offsetWidth  || Math.round(canvas.width  / (window.devicePixelRatio || 1));
    const cssH = canvas.offsetHeight || Math.round(canvas.height / (window.devicePixelRatio || 1));
    const tmp = document.createElement("canvas");
    tmp.width  = cssW * TARGET_DPR;
    tmp.height = cssH * TARGET_DPR;
    const tc = tmp.getContext("2d")!;
    tc.fillStyle = "#ffffff";
    tc.fillRect(0, 0, tmp.width, tmp.height);
    tc.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, tmp.width, tmp.height);
    buildOutput(tmp);
  }
}

function ChartDownloadBtn({ canvasRef, name }: { canvasRef: { current: HTMLCanvasElement | null }; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground shadow-sm"
        title="Baixar gráfico">
        <Download className="w-3 h-3" /> Exportar
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border rounded shadow-lg py-1 min-w-[150px]">
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"
              onClick={() => { if (canvasRef.current) downloadCanvas(canvasRef.current, name, "png"); setOpen(false); }}>
              🖼️ PNG — alta resolução
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"
              onClick={() => { if (canvasRef.current) downloadCanvas(canvasRef.current, name, "jpeg"); setOpen(false); }}>
              📷 JPG — alta resolução
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function downloadSvg(svgEl: SVGSVGElement, filename: string, format: "png" | "jpeg", containerEl?: Element | null) {
  const mime = format === "jpeg" ? "image/jpeg" : "image/png";
  const ext  = format === "jpeg" ? "jpg" : "png";
  const rawTitle =
    (containerEl ?? svgEl).closest("[data-chart-title]")?.getAttribute("data-chart-title") ||
    filename.replace(/_/g, " ");

  const TARGET = 3;
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const vb = svgEl.viewBox.baseVal;
    const sw = (vb.width  || svgEl.width.baseVal.value  || 600) * TARGET;
    const sh = (vb.height || svgEl.height.baseVal.value || 400) * TARGET;

    const PAD = Math.round(sw * 0.025);
    const TH  = Math.round(sw * 0.045);

    const ow = sw + PAD * 2;
    const oh = sh + TH + PAD;

    const off = document.createElement("canvas");
    off.width  = ow;
    off.height = oh;
    const ctx = off.getContext("2d")!;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ow, oh);

    const fontSize = Math.max(14, Math.round(sw / 55));
    ctx.fillStyle   = "#1e293b";
    ctx.font        = `bold ${fontSize}px system-ui, Arial, sans-serif`;
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(rawTitle, ow / 2, TH / 2, ow - PAD * 2);

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, TH);
    ctx.lineTo(ow - PAD, TH);
    ctx.stroke();

    ctx.drawImage(img, PAD, TH, sw, sh);
    URL.revokeObjectURL(url);

    const a = document.createElement("a");
    a.href     = off.toDataURL(mime, 0.97);
    a.download = `${filename}.${ext}`;
    a.click();
  };
  img.src = url;
}

async function exportElementToImage(el: HTMLElement, filename: string, format: "png" | "jpeg", title?: string) {
  // Esconde o próprio botão de download durante a captura
  const btn = el.querySelector('[data-svg-download-btn]') as HTMLElement | null;
  const prevDisplay = btn?.style.display;
  if (btn) btn.style.display = "none";
  try {
    const html2canvas = (await import("html2canvas")).default;
    const captured = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 3,
      logging: false,
      useCORS: true,
    });
    const mime = format === "jpeg" ? "image/jpeg" : "image/png";
    const ext  = format === "jpeg" ? "jpg" : "png";
    const rawTitle = title
      || el.closest("[data-chart-title]")?.getAttribute("data-chart-title")
      || el.getAttribute("data-chart-title")
      || filename.replace(/_/g, " ");

    const sw = captured.width;
    const sh = captured.height;
    const PAD = Math.round(sw * 0.025);
    const TH  = Math.round(sw * 0.045);
    const ow = sw + PAD * 2;
    const oh = sh + TH + PAD;

    const off = document.createElement("canvas");
    off.width = ow; off.height = oh;
    const ctx = off.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ow, oh);

    const fontSize = Math.max(14, Math.round(sw / 55));
    ctx.fillStyle = "#1e293b";
    ctx.font = `bold ${fontSize}px system-ui, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(rawTitle, ow / 2, TH / 2, ow - PAD * 2);

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, TH);
    ctx.lineTo(ow - PAD, TH);
    ctx.stroke();

    ctx.drawImage(captured, PAD, TH);

    const a = document.createElement("a");
    a.href = off.toDataURL(mime, 0.97);
    a.download = `${filename}.${ext}`;
    a.click();
  } finally {
    if (btn) btn.style.display = prevDisplay || "";
  }
}

function SvgDownloadBtn({ containerRef, name, title }: { containerRef: React.RefObject<HTMLDivElement>; name: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const dl = (format: "png" | "jpeg") => {
    if (containerRef.current) exportElementToImage(containerRef.current, name, format, title);
    setOpen(false);
  };
  return (
    <div className="relative" data-svg-download-btn>
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground shadow-sm"
        title="Baixar figura">
        <Download className="w-3 h-3" /> Exportar
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border rounded shadow-lg py-1 min-w-[150px]">
            <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"
              onClick={() => dl("png")}>🖼️ PNG — alta resolução</button>
            <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"
              onClick={() => dl("jpeg")}>📷 JPG — alta resolução</button>
          </div>
        </>
      )}
    </div>
  );
}

function SvgFigure({ children, name, title, className }: { children: React.ReactNode; name: string; title?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const resolvedTitle = title || svgFigureTitle(name);
  return (
    <div
      ref={ref}
      data-svg-figure={name}
      data-chart-title={resolvedTitle}
      className={`relative${className ? " " + className : ""}`}
    >
      <div className="absolute top-0 right-0 z-10">
        <SvgDownloadBtn containerRef={ref} name={name} title={resolvedTitle} />
      </div>
      {children}
    </div>
  );
}

const SVG_FIGURE_TITLES: Record<string,string> = {
  dendrograma_upgma: "Dendrograma UPGMA (Bray-Curtis)",
  nmds_panel_a_pontos: "NMDS — Painel A: Pontos por UA",
  nmds_panel_b_elipses: "NMDS — Painel B: Elipses de Confiança 95%",
  nmds_panel_c_centroides: "NMDS — Painel C: Centróides por UA",
  nmds_biplot_vetores: "NMDS Biplot — Vetores de Espécies",
  biometria_comprimento_peso: "Biometria — Relação Comprimento × Peso",
  biometria_pca_biplot: "Biometria — PCA Biplot",
  biometria_comprimento_peso_por_ua: "Biometria — Comprimento × Peso por UA",
};
function svgFigureTitle(name: string): string {
  if (SVG_FIGURE_TITLES[name]) return SVG_FIGURE_TITLES[name];
  if (name.startsWith("pcoa_pca_")) return `PCoA/PCA — Eixos ${name.replace("pcoa_pca_","").toUpperCase()}`;
  if (name.startsWith("cpue_ua_")) return `CPUE por UA — ${name.replace("cpue_ua_","").replace(/_/g," ").toUpperCase()}`;
  if (name.startsWith("cpue_campanha_")) return `CPUE por Campanha — ${name.replace("cpue_campanha_","").replace(/_/g," ").toUpperCase()}`;
  if (name.startsWith("cpue_especie_")) return `CPUE por Espécie — ${name.replace("cpue_especie_","").replace(/_/g," ").toUpperCase()}`;
  return name.replace(/_/g," ").replace(/\b\w/g, c=>c.toUpperCase());
}

// ── Grupo config ─────────────────────────────────────────────────────────────
const GRUPO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  fauna_aves:          { label: "Aves",          color: "#ea580c", bg: "bg-orange-100 text-orange-800" },
  fauna_mamiferos:     { label: "Mamíferos",      color: "#0099a8", bg: "bg-cyan-100 text-cyan-800" },
  fauna_herpetofauna:  { label: "Herpetofauna",   color: "#c2410c", bg: "bg-orange-200 text-orange-900" },
  fauna_ictiofauna:    { label: "Ictiofauna",     color: "#0e7490", bg: "bg-cyan-100 text-cyan-900" },
  fauna_invertebrados: { label: "Invertebrados",  color: "#f97316", bg: "bg-orange-100 text-orange-700" },
  flora:               { label: "Flora",           color: "#155e75", bg: "bg-teal-100 text-teal-800" },
  ruido:               { label: "Ruído",           color: "#9a3a0a", bg: "bg-amber-100 text-amber-900" },
  solo:                { label: "Solo",            color: "#fdba74", bg: "bg-orange-50 text-orange-700" },
  qualidade_agua:      { label: "Água",            color: "#06b6d4", bg: "bg-cyan-100 text-cyan-700" },
  // Aliases from import dialog values
  avifauna:            { label: "Aves",          color: "#ea580c", bg: "bg-orange-100 text-orange-800" },
  mastofauna:          { label: "Mamíferos",      color: "#0099a8", bg: "bg-cyan-100 text-cyan-800" },
  herpetofauna:        { label: "Herpetofauna",   color: "#c2410c", bg: "bg-orange-200 text-orange-900" },
  ictiofauna:          { label: "Ictiofauna",     color: "#0e7490", bg: "bg-cyan-100 text-cyan-900" },
  invertebrados:       { label: "Invertebrados",  color: "#f97316", bg: "bg-orange-100 text-orange-700" },
  quiropteros:         { label: "Quirópteros",    color: "#fb923c", bg: "bg-orange-50 text-orange-700" },
};

// ── Normaliza chaves legadas (avifauna, ictiofauna, …) → canônicas (fauna_*) ──
const GRUPO_ALIAS: Record<string, string> = {
  avifauna: "fauna_aves",
  mastofauna: "fauna_mamiferos",
  herpetofauna: "fauna_herpetofauna",
  ictiofauna: "fauna_ictiofauna",
  invertebrados: "fauna_invertebrados",
  quiropteros: "fauna_mamiferos",
};
function normalizeGrupoKey(raw: string | null | undefined): string {
  const k = (raw || "").trim().toLowerCase();
  return GRUPO_ALIAS[k] || k;
}

// ── Domínio de monitoramento ──────────────────────────────────────────────────
type MonitoringDomain = "fauna" | "flora" | "qualidade_agua" | "solo" | "ruido";

function mapGrupoToDomain(grupo: string): MonitoringDomain {
  if (!grupo || grupo === "todos") return "fauna";
  if (grupo === "qualidade_agua") return "qualidade_agua";
  if (grupo === "solo") return "solo";
  if (grupo === "ruido") return "ruido";
  if (grupo === "flora") return "flora";
  return "fauna";
}

function detectDomain(filterGrupo: string, registros: { grupoTaxonomico: string }[]): MonitoringDomain {
  if (filterGrupo !== "todos") return mapGrupoToDomain(filterGrupo);
  if (registros.length === 0) return "fauna";
  const counts: Record<string, number> = {};
  registros.forEach(r => { counts[r.grupoTaxonomico] = (counts[r.grupoTaxonomico] || 0) + 1; });
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  return mapGrupoToDomain(dominant);
}

const IUCN_COLORS: Record<string, string> = {
  LC: "#22c55e", NT: "#84cc16", VU: "#f59e0b",
  EN: "#f97316", CR: "#ef4444", EW: "#7c3aed", EX: "#000000", DD: "#94a3b8", NE: "#cbd5e1",
};

// ── Paleta institucional EcoBrasil ─────────────────────────────────────────────
// Paleta unificada profissional: Laranja (Jusante) + Teal (Montante) + tons próximos.
// Usada em TODOS os gráficos de /campo (todas as abas e subabas) para visual coeso.
const ECO_PALETTE = [
  "#ea580c", // 0  laranja primário (Jusante)
  "#0099a8", // 1  teal primário (Montante)
  "#c2410c", // 2  laranja queimado
  "#0e7490", // 3  teal profundo
  "#f97316", // 4  laranja vibrante
  "#06b6d4", // 5  ciano
  "#fb923c", // 6  laranja suave
  "#155e75", // 7  teal escuro
  "#9a3a0a", // 8  âmbar-marrom
  "#22d3ee", // 9  ciano claro
  "#fdba74", // 10 pêssego
  "#164e63", // 11 teal profundíssimo
] as const;
const ECO_STROKE = [
  "#9a3a0a", "#006070", "#7c2d12", "#083344", "#c2410c", "#0e7490",
  "#c2410c", "#083344", "#451a03", "#0e7490", "#9a3a0a", "#082f49",
] as const;
function ecoColor(i: number): string { return ECO_PALETTE[((i % ECO_PALETTE.length) + ECO_PALETTE.length) % ECO_PALETTE.length]; }
function ecoStroke(i: number): string { return ECO_STROKE[((i % ECO_STROKE.length) + ECO_STROKE.length) % ECO_STROKE.length]; }

/**
 * Formata nome científico segundo regra taxonômica simplificada:
 * - Primeira letra do gênero MAIÚSCULA, todo o restante minúsculo
 * - aff., cf. e epíteto específico em minúsculas
 * - Pontuação preservada (aff./cf. recebem ponto se ausente)
 * Renderizar em <em>/italic separadamente.
 */
function formatSpeciesName(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  // Capitaliza apenas a primeira letra (gênero); demais minúsculas
  let out = s.charAt(0).toUpperCase() + s.slice(1);
  // Garante ponto final em qualificadores aff/cf quando vierem como palavra
  out = out.replace(/\b(aff|cf)\b(?!\.)/g, "$1.");
  return out;
}

const BRAND = {
  blue1:     "#0099a8",  // Teal principal (era azul)
  blue2:     "#0e7490",  // Teal secundário
  orange1:   "#ea580c",  // Laranja principal
  orange2:   "#c2410c",  // Laranja variação
  // Tons suaves para fill
  blue1a:    "rgba(0,153,168,0.18)",
  blue2a:    "rgba(14,116,144,0.18)",
  orange1a:  "rgba(234,88,12,0.22)",
  orange2a:  "rgba(194,65,12,0.22)",
  neutral:   "#94a3b8",
} as const;

// ── Informações científicas dos índices de biodiversidade ────────────────────
const INDEX_INFO: Record<string, {
  label: string; emoji: string; grupo: string;
  descricao: string; formula: string; interpretacao: string; citacao: string;
}> = {
  "Shannon (H')": {
    label: "Shannon-Wiener (H')", emoji: "📐", grupo: "Diversidade Alfa",
    descricao: "Mede a incerteza na identidade de um indivíduo amostrado aleatoriamente. Integra riqueza de espécies e equitabilidade da distribuição de abundâncias em um único valor.",
    formula: "H' = −Σ pᵢ · ln(pᵢ)",
    interpretacao: "H' < 1 = baixa diversidade · 1–3 = moderada · > 3 = alta diversidade. O valor máximo teórico é ln(S), alcançado quando todas as espécies são igualmente abundantes.",
    citacao: "Shannon, C.E. & Weaver, W. (1949). The Mathematical Theory of Communication. University of Illinois Press, Urbana.",
  },
  "Simpson (1-D)": {
    label: "Simpson (1−D)", emoji: "🔵", grupo: "Diversidade Alfa",
    descricao: "Probabilidade de que dois indivíduos escolhidos aleatoriamente pertençam a espécies diferentes. Expressa o inverso da dominância.",
    formula: "D = 1 − Σ [nᵢ(nᵢ−1) / N(N−1)]",
    interpretacao: "Varia de 0 a 1. Próximo de 1 = alta diversidade e baixa dominância. Próximo de 0 = dominância de poucas espécies.",
    citacao: "Simpson, E.H. (1949). Measurement of diversity. Nature, 163(4148), 688.",
  },
  "Pielou (J')": {
    label: "Equitabilidade de Pielou (J')", emoji: "⚖️", grupo: "Diversidade Alfa",
    descricao: "Mede a uniformidade com que os indivíduos se distribuem entre as espécies, relativizada pelo máximo teórico possível (equitabilidade perfeita).",
    formula: "J' = H' / ln(S)",
    interpretacao: "Varia de 0 a 1. J' = 1 significa que todas as espécies são igualmente abundantes; J' próximo de 0 indica forte dominância de uma ou poucas espécies.",
    citacao: "Pielou, E.C. (1966). The measurement of diversity in different types of biological collections. Journal of Theoretical Biology, 13, 131–144.",
  },
  "Margalef (d)": {
    label: "Índice de Margalef (d)", emoji: "🌿", grupo: "Diversidade Alfa",
    descricao: "Estima a riqueza de espécies corrigindo o número de espécies pelo tamanho amostral via logaritmo natural. Permite comparar amostras de tamanhos diferentes.",
    formula: "d = (S − 1) / ln(N)",
    interpretacao: "Valores mais altos indicam maior riqueza relativa ao esforço amostral. Não tem limite superior definido; deve ser interpretado comparativamente entre amostras.",
    citacao: "Margalef, R. (1958). Information theory in ecology. General Systems, 3, 36–71.",
  },
  "Menhinick (D)": {
    label: "Índice de Menhinick (D)", emoji: "📏", grupo: "Diversidade Alfa",
    descricao: "Estimador de riqueza que padroniza o número de espécies pela raiz quadrada do número total de indivíduos, tornando-o menos sensível a grandes variações de N.",
    formula: "D = S / √N",
    interpretacao: "Valores mais altos = maior riqueza relativa. Útil para comparações rápidas entre amostras, especialmente quando o esforço amostral varia.",
    citacao: "Menhinick, E.F. (1964). A comparison of some species-individuals diversity indices applied to samples of field insects. Ecology, 45(4), 859–861.",
  },
  "Berger-Parker (d)": {
    label: "Dominância de Berger-Parker (d)", emoji: "👑", grupo: "Diversidade Alfa",
    descricao: "Mede a importância relativa da espécie mais abundante na comunidade. É o índice de dominância mais simples e direto, calculado como a proporção dos indivíduos da espécie dominante em relação ao total.",
    formula: "d = N_max / N_T",
    interpretacao: "Varia de 0 a 1. Valores próximos a 1 indicam alta dominância (comunidade controlada por uma única espécie). Escala: 0,8–1,0 = dominância extrema (risco ao ecossistema); 0,5–0,7 = alta dominância; 0,3–0,4 = dominância moderada; 0,1–0,2 = baixa dominância (alta diversidade).",
    citacao: "Berger, W.H. & Parker, F.L. (1970). Diversity of planktonic foraminifera in deep-sea sediments. Science, 168(3937), 1345–1347.",
  },
  "Sobs": {
    label: "Riqueza Observada (Sobs)", emoji: "🔍", grupo: "Estimadores de Riqueza",
    descricao: "Número de espécies efetivamente detectadas na amostra. É a contagem direta das espécies únicas presentes nos registros.",
    formula: "Sobs = |{espécies únicas registradas}|",
    interpretacao: "Subestima a riqueza real, pois espécies raras podem ter passado despercebidas. Representa o ponto de partida para os demais estimadores de riqueza.",
    citacao: "Colwell, R.K. & Coddington, J.A. (1994). Estimating terrestrial biodiversity through extrapolation. Philosophical Transactions of the Royal Society B, 345, 101–118.",
  },
  "Chao1": {
    label: "Chao1", emoji: "📈", grupo: "Estimadores de Riqueza",
    descricao: "Estimador não-paramétrico de riqueza que usa a proporção de espécies raras (singletons e doubletons) para projetar quantas espécies ainda não foram detectadas.",
    formula: "Chao1 = Sobs + f₁² / (2f₂)  [f₁ = singletons, f₂ = doubletons]",
    interpretacao: "Fornece o limite inferior da riqueza total esperada. Quanto maior a razão f₁/f₂, mais espécies foram perdidas na amostragem.",
    citacao: "Chao, A. (1984). Nonparametric estimation of the number of classes in a population. Scandinavian Journal of Statistics, 11, 265–270.",
  },
  "Chao2": {
    label: "Chao2", emoji: "📊", grupo: "Estimadores de Riqueza",
    descricao: "Variante incidência do Chao1. Baseado na frequência de espécies presentes em apenas uma (uniques) ou duas (duplicates) unidades amostrais. Ideal para dados de múltiplas amostras.",
    formula: "Chao2 = Sobs + Q₁² / (2Q₂)  [Q₁ = uniques, Q₂ = duplicates entre UAs]",
    interpretacao: "Recomendado quando há múltiplas UAs independentes. Mais robusto que Chao1 quando a abundância por espécie é desconhecida.",
    citacao: "Chao, A. (1987). Estimating the population size for capture-recapture data with unequal catchability. Biometrics, 43, 783–791.",
  },
  "Jackknife 1": {
    label: "Jackknife de 1ª Ordem", emoji: "🔧", grupo: "Estimadores de Riqueza",
    descricao: "Estimador de riqueza baseado em espécies presentes em apenas uma unidade amostral (uniques). Reduz o viés de subestimativa do Sobs por meio de reamostagem.",
    formula: "Jack1 = Sobs + Q₁ × (m − 1) / m  [m = número de UAs]",
    interpretacao: "Geralmente supera Chao2 em precisão para comunidades com moderada heterogeneidade entre UAs. Aumenta conforme cresce Q₁.",
    citacao: "Burnham, K.P. & Overton, W.S. (1979). Robust estimation of population size when capture probabilities vary. Ecology, 60(5), 927–936.",
  },
  "Jackknife 2": {
    label: "Jackknife de 2ª Ordem", emoji: "🔩", grupo: "Estimadores de Riqueza",
    descricao: "Extensão do Jackknife 1 que incorpora também espécies presentes em exatamente duas UAs (duplicates), reduzindo ainda mais o viés para comunidades heterogêneas.",
    formula: "Jack2 = Sobs + Q₁(2m−3)/m − Q₂(m−2)²/[m(m−1)]",
    interpretacao: "Mais preciso que Jack1 quando há alta variação de composição entre UAs. Pode superestimar levemente em amostras pequenas.",
    citacao: "Burnham, K.P. & Overton, W.S. (1979). Robust estimation of population size when capture probabilities vary. Ecology, 60(5), 927–936.",
  },
  "Bootstrap": {
    label: "Estimador Bootstrap", emoji: "🔁", grupo: "Estimadores de Riqueza",
    descricao: "Corrige a riqueza observada pela probabilidade de não-detecção de cada espécie, estimada pela frequência relativa entre as UAs. Baseia-se em reamostagem com reposição.",
    formula: "Boot = Sobs + Σ (1 − pᵢ)^m  [pᵢ = frequência da espécie i entre as m UAs]",
    interpretacao: "Tende a ser mais conservador que Chao. Útil quando a amostragem é relativamente representativa da comunidade real.",
    citacao: "Smith, E.P. & van Belle, G. (1984). Nonparametric estimation of species richness. Biometrics, 40(1), 119–129.",
  },
  "ICE": {
    label: "ICE — Incidence Coverage Estimator", emoji: "🧊", grupo: "Estimadores de Riqueza",
    descricao: "Estimador baseado na cobertura de incidência. Divide as espécies em 'frequentes' (presentes em >10 UAs) e 'raras' (≤10 UAs), e usa a proporção das raras para estimar espécies não detectadas. Mais robusto que Chao2 quando há muitas espécies raras.",
    formula: "ICE = S_freq + S_rare/C_ice + (γ²_ice × S_rare)/C_ice  [C_ice = cobertura de incidência das espécies raras]",
    interpretacao: "Valores maiores que Chao1/Chao2 indicam alta proporção de espécies raras sub-representadas. Considere aumentar o número de UAs ou de campanhas para reduzir a diferença entre ICE e Sobs.",
    citacao: "Chao, A. & Lee, S.M. (1992). Estimating the number of classes via sample coverage. Journal of the American Statistical Association, 87(417), 210–217.",
  },
  "singleton": {
    label: "Singleton", emoji: "🔴", grupo: "Espécies Raras",
    descricao: "Espécie representada por apenas um único indivíduo (ou registro) em toda a amostra. São indicadores críticos de possível subamostragem e de espécies potencialmente raras ou ameaçadas no inventário.",
    formula: "f₁ = número de espécies com nᵢ = 1  (abundância = 1 registro)",
    interpretacao: "Uma alta proporção de singletons (f₁) em relação ao total de espécies indica que a amostragem ainda não foi suficiente para detectar toda a diversidade local. Singletons são usados diretamente pelo estimador Chao1: quanto maior f₁ em relação a f₂, maior o número de espécies não detectadas estimadas.",
    citacao: "Colwell, R.K. & Coddington, J.A. (1994). Estimating terrestrial biodiversity through extrapolation. Philosophical Transactions of the Royal Society B, 345, 101–118.",
  },
  "doubleton": {
    label: "Doubleton", emoji: "🟡", grupo: "Espécies Raras",
    descricao: "Espécie representada por exatamente dois indivíduos (ou registros) em toda a amostra. Também chamadas de 'espécies duplas', funcionam como divisor no estimador Chao1 e como complemento ao singleton no diagnóstico de subamostragem.",
    formula: "f₂ = número de espécies com nᵢ = 2  (abundância = 2 registros)",
    interpretacao: "A razão f₁/f₂ é um indicador direto de suficiência amostral: razões altas (f₁ >> f₂) sugerem que muitas espécies raras ainda não foram detectadas. Quando f₂ = 0, o estimador Chao1 é calculado como Sobs + f₁(f₁−1)/2, resultando em estimativas mais elevadas de riqueza potencial.",
    citacao: "Chao, A. (1984). Nonparametric estimation of the number of classes in a population. Scandinavian Journal of Statistics, 11, 265–270.",
  },
};

// Extra palette for custom/unknown groups — usa ECO_PALETTE (laranja/teal unificado)
const EXTRA_GRUPO_PALETTE = [...ECO_PALETTE];
function getGrupoColor(key: string, unknownKeys: string[]): string {
  if (GRUPO_CONFIG[key]) return GRUPO_CONFIG[key].color;
  const idx = unknownKeys.indexOf(key);
  return EXTRA_GRUPO_PALETTE[idx >= 0 ? idx % EXTRA_GRUPO_PALETTE.length : 0] || "#6b7280";
}

// ── Display normalization (handles spreadsheet text values in stored data) ───
const IUCN_TEXT_SIGLA: Record<string, string> = {
  "pouco preocupante": "LC", "least concern": "LC",
  "quase ameaçado": "NT", "near threatened": "NT",
  "vulnerável": "VU", "vulnerable": "VU",
  "em perigo": "EN", "endangered": "EN",
  "criticamente em perigo": "CR", "critically endangered": "CR",
  "extinta na natureza": "EW", "extinct in the wild": "EW",
  "extinta": "EX", "extinct": "EX",
  "dados insuficientes": "DD", "data deficient": "DD",
  "não avaliado": "NE", "not evaluated": "NE",
};
function toIucnSigla(val?: string): string {
  if (!val?.trim()) return "";
  return IUCN_TEXT_SIGLA[val.trim().toLowerCase()] || val.trim();
}
function toMmaSigla(val?: string): string {
  if (!val?.trim()) return "";
  const v = val.trim().toLowerCase();
  if (["não", "nao", "no", "false", "0", "não listado"].includes(v)) return "";
  if (["sim", "yes", "true", "1"].includes(v)) return "";
  return IUCN_TEXT_SIGLA[v] || val.trim();
}
function toCitesSigla(val?: string): string {
  if (!val?.trim()) return "";
  const v = val.trim().toLowerCase();
  if (v.includes("nenhum") || v === "none" || v === "-" || v === "0") return "";
  const m = v.match(/\b(iii|ii|i|3|2|1)\b/);
  if (!m) return "";
  const n = m[1];
  if (n === "iii" || n === "3") return "III";
  if (n === "ii" || n === "2") return "II";
  if (n === "i" || n === "1") return "I";
  return "";
}
// Conjunto de valores negativos/genéricos que significam "não está em nenhum PAN"
const PAN_NEGATIVES = new Set([
  "não","nao","no","false","0","nc","nenhum","ausente","—","-","",
  "não ameaçada","nao ameacada","não ameaçado","nao ameacado",
  "não consta","nao consta","nenhuma","sem pan","sem plano",
  "não se aplica","nao se aplica","n/a","na","nd","sim","yes","true","1","pan",
]);
// Retorna o nome do plano PAN se existir, ou "" (vazio) se não constar
function getPanName(val?: string): string {
  if (!val?.trim()) return "";
  const v = val.trim().toLowerCase();
  if (PAN_NEGATIVES.has(v)) return "";
  return val.trim();
}
// Para exibição: nome real do plano, ou "NC"
function toPanLabel(val?: string): string {
  const n = getPanName(val);
  return n || "NC";
}
// Para filtros: true somente se a espécie tem um plano PAN real
function hasPan(val?: string): boolean {
  return !!getPanName(val);
}

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Empreendimento { id: number; nome: string; cliente?: string; municipio?: string; uf?: string; }
interface SysCampanha { id: number; nome: string; periodoInicio: string; periodoFim: string; status?: string | null; }
interface SysProjeto { id: number; nome: string; status: string; empreendimentoId: number; }
interface CampoRegistro {
  id: number; grupoTaxonomico: string; empreendimentoId?: number; campanha?: string;
  data: string; horario?: string; periodo?: string; unidadeAmostral?: string;
  latitude?: string; longitude?: string; zonaUtm?: string | null; nomeCientifico?: string; nomeComum?: string;
  filo?: string; classe?: string; ordem?: string; familia?: string;
  sexo?: string; idade?: string; metodo?: string; modoRegistro?: string; statusRegistro?: string;
  caracterizacao?: string; malha?: string; densidade?: string; estagioDesenvolvimento?: string;
  numeroEtiquetaCampo?: string;
  iucn?: string; ibamaMma?: string; cites?: string; listaEstadual?: string; pan?: string;
  dieta?: string; endemismo?: string; migracao?: string; sensibilidade?: string;
  estagioReprodutivo?: string; distribuicao?: string; usoHabitat?: string;
  ambientePreferencial?: string; habitat?: string; fitofisionomia?: string;
  raridade?: string; abundancia?: number | null;
  nomeColetor?: string; observacoes?: string;
  pesoG?: string; ctMm?: string; lcMm?: string; ccMm?: string; acMm?: string; doMm?: string;
  tipoCorpoAgua?: string; estratoVertical?: string;
  localizacao?: string;
  esforcoAmostral?: number | null; unidadeEsforco?: string;
  parametros?: Record<string, number | string | null>;
  fotos?: { id: number; url: string }[];
}
interface DashboardStats {
  total: number; totalCampanhas: number; totalEspecies: number;
  byGrupo: Record<string, number>; byStatus: Record<string, number>;
}

// ══════════════════════════════════════════════════════════════════════════════
// ANÁLISES MULTIVARIADAS — Bray-Curtis, PCoA, PCA Hellinger, PERMANOVA
// ══════════════════════════════════════════════════════════════════════════════
function brayCurtisVec(a: number[], b: number[]): number {
  let num = 0, den = 0;
  for (let i = 0; i < a.length; i++) { num += Math.abs(a[i] - b[i]); den += a[i] + b[i]; }
  return den === 0 ? 0 : num / den;
}
function computeDistMatrix(mat: number[][]): number[][] {
  const n = mat.length;
  const d = Array.from({length: n}, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) { const v = brayCurtisVec(mat[i], mat[j]); d[i][j] = d[j][i] = v; }
  return d;
}
function powerIteration(mat: number[][], seed: number[], maxIter = 300): number[] {
  let v = [...seed];
  for (let iter = 0; iter < maxIter; iter++) {
    const vn = mat.map(row => row.reduce((s, x, j) => s + x * v[j], 0));
    const len = Math.sqrt(vn.reduce((s, x) => s + x * x, 0));
    if (len < 1e-14) break;
    v = vn.map(x => x / len);
  }
  return v;
}
function pcoaFromDist(distMat: number[][]): { scores: {x:number;y:number}[]; var1:number; var2:number } {
  const n = distMat.length;
  if (n < 3) return { scores: distMat.map((_, i) => ({x: i, y: 0})), var1: 100, var2: 0 };
  const D2 = distMat.map(row => row.map(v => v * v));
  const rowM = D2.map(row => row.reduce((s, v) => s + v, 0) / n);
  const colM = D2[0].map((_, j) => D2.reduce((s, row) => s + row[j], 0) / n);
  const gM = rowM.reduce((s, v) => s + v, 0) / n;
  const B = D2.map((row, i) => row.map((v, j) => -0.5 * (v - rowM[i] - colM[j] + gM)));
  const traceB = B.reduce((s, row, i) => s + row[i], 0);
  const s1seed = Array.from({length: n}, (_, i) => i === 0 ? 1 : (i * 0.01));
  const v1 = powerIteration(B, s1seed);
  const l1 = v1.reduce((s, x, i) => s + x * B[i].reduce((ss, y, j) => ss + y * v1[j], 0), 0);
  const B2 = B.map((row, i) => row.map((x, j) => x - l1 * v1[i] * v1[j]));
  const s2seed = Array.from({length: n}, (_, i) => i === 1 ? 1 : (i * 0.013));
  const v2 = powerIteration(B2, s2seed);
  const l2 = v2.reduce((s, x, i) => s + x * B2[i].reduce((ss, y, j) => ss + y * v2[j], 0), 0);
  const sc1 = Math.sqrt(Math.max(0, l1)), sc2 = Math.sqrt(Math.max(0, l2));
  const scores = Array.from({length: n}, (_, i) => ({ x: v1[i] * sc1, y: v2[i] * sc2 }));
  // Use sum of positive eigenvalues as denominator; traceB can be small/negative with
  // semi-metric distances (Bray-Curtis), so clamp to [0, 100].
  const posSum = Math.max(l1 + Math.max(0, l2), 1e-12);
  const denom = Math.max(traceB, posSum);
  const var1 = Math.min(100, Math.max(0, l1 / denom * 100));
  const var2 = Math.min(100, Math.max(0, l2 / denom * 100));
  return { scores, var1, var2 };
}
// ── True NMDS — Kruskal stress-1 minimisation (isotonic regression + gradient descent) ──
function nmdsFromDist(distMat: number[][], maxIter = 400): {
  scores: {x:number;y:number}[];
  stress: number;
  converged: boolean;
} {
  const n = distMat.length;
  if (n < 3) return { scores: distMat.map((_,i)=>({x:i,y:0})), stress:0, converged:true };

  // Initialize from PCoA (warm start → much faster convergence)
  const initPcoa = pcoaFromDist(distMat);
  let Y: [number,number][] = initPcoa.scores.map(s=>[s.x,s.y] as [number,number]);

  // Center configuration
  const centerY = (Yc:[number,number][])=>{
    const cx=Yc.reduce((s,r)=>s+r[0],0)/n, cy=Yc.reduce((s,r)=>s+r[1],0)/n;
    return Yc.map(r=>[r[0]-cx,r[1]-cy] as [number,number]);
  };
  // Scale to unit RMS (prevents scale drift)
  const scaleY = (Yc:[number,number][])=>{
    const rms=Math.sqrt(Yc.reduce((s,r)=>s+r[0]**2+r[1]**2,0)/n)||1;
    return Yc.map(r=>[r[0]/rms,r[1]/rms] as [number,number]);
  };
  Y = scaleY(centerY(Y));

  // All pairs + their dissimilarities
  const pairs:[number,number][] = [];
  for (let i=0;i<n;i++) for (let j=i+1;j<n;j++) pairs.push([i,j]);
  const M = pairs.length;
  const delta = pairs.map(([i,j])=>distMat[i][j]);

  // Sort pairs by dissimilarity (ascending) → rank order
  const sortIdx = [...Array(M).keys()].sort((a,b)=>delta[a]-delta[b]||(a-b));

  // Pool-Adjacent-Violators isotonic regression (non-decreasing)
  const pavAscend = (vals:number[]) => {
    const blk:{sum:number;len:number}[] = vals.map(v=>({sum:v,len:1}));
    let i=0;
    while(i<blk.length-1){
      if(blk[i].sum/blk[i].len > blk[i+1].sum/blk[i+1].len){
        blk[i]={sum:blk[i].sum+blk[i+1].sum,len:blk[i].len+blk[i+1].len};
        blk.splice(i+1,1);
        if(i>0)i--;
      }else i++;
    }
    const r:number[]=[];
    blk.forEach(b=>{const a=b.sum/b.len;for(let j=0;j<b.len;j++)r.push(a);});
    return r;
  };

  // Compute d, dhat, stress, gradient in one pass
  const computeStressGrad = (Yc:[number,number][]) => {
    const d = pairs.map(([i,j])=>{
      const dx=Yc[i][0]-Yc[j][0],dy=Yc[i][1]-Yc[j][1];
      return Math.sqrt(dx*dx+dy*dy)||1e-10;
    });
    const dByRank = sortIdx.map(k=>d[k]);
    const dhatRank = pavAscend(dByRank);
    const dhat:number[] = new Array(M);
    sortIdx.forEach((k,r)=>{dhat[k]=dhatRank[r];});

    const A_val = pairs.reduce((s,_,k)=>s+(d[k]-dhat[k])**2,0);
    const B_val = pairs.reduce((s,_,k)=>s+d[k]**2,0);
    const stress = B_val>0 ? Math.sqrt(A_val/B_val) : 0;

    // Gradient of Kruskal stress-1 w.r.t. configuration points
    // ∂S/∂y_ia = Σⱼ c_ij * (y_ia - y_ja)
    // where c_ij = (d_ij - dhat_ij)/(d_ij * S * B) - S/B
    const grad:[number,number][] = Array.from({length:n},()=>[0,0] as [number,number]);
    if(stress > 1e-12 && B_val > 1e-20){
      const invSB = 1/(stress*B_val);
      const S_B   = stress/B_val;
      for(let k=0;k<M;k++){
        const [i,j]=pairs[k];
        const c=((d[k]-dhat[k])/d[k])*invSB - S_B;
        const dx=Yc[i][0]-Yc[j][0], dy=Yc[i][1]-Yc[j][1];
        grad[i][0]+=c*dx; grad[i][1]+=c*dy;
        grad[j][0]-=c*dx; grad[j][1]-=c*dy;
      }
    }
    return {stress, grad};
  };

  let {stress: curStress, grad} = computeStressGrad(Y);
  let stepSize = 0.3;
  let converged = false;

  for(let iter=0; iter<maxIter; iter++){
    if(curStress < 1e-7){ converged=true; break; }
    // Gradient descent with backtracking line search
    let accepted = false;
    const prevY = Y;
    for(let ls=0; ls<8; ls++){
      const Yn: [number,number][] = Y.map((r,i)=>[r[0]-stepSize*grad[i][0], r[1]-stepSize*grad[i][1]] as [number,number]);
      const Ync = centerY(Yn);
      const {stress: ns} = computeStressGrad(Ync);
      if(ns < curStress){
        Y = Ync;
        curStress = ns;
        stepSize *= 1.15;
        accepted = true;
        break;
      }
      stepSize *= 0.5;
    }
    if(!accepted){ Y = prevY; break; }
    const {stress: newStress, grad: newGrad} = computeStressGrad(Y);
    if(Math.abs(curStress - newStress) < 1e-7 && iter > 10){ converged=true; break; }
    curStress = newStress;
    grad = newGrad;
  }

  // Final scaling: max pairwise distance ≈ 1 (comparable across datasets)
  const maxD = Math.max(...pairs.map(([i,j])=>Math.sqrt((Y[i][0]-Y[j][0])**2+(Y[i][1]-Y[j][1])**2)))||1;
  Y = Y.map(r=>[r[0]/maxD,r[1]/maxD] as [number,number]);

  // Recompute final stress at scaled config
  const {stress: finalStress} = computeStressGrad(Y);

  return { scores: Y.map(r=>({x:r[0],y:r[1]})), stress: finalStress, converged };
}

function hellingerTransformMat(mat: number[][]): number[][] {
  return mat.map(row => {
    const sum = row.reduce((s, v) => s + v, 0);
    return sum === 0 ? row.map(() => 0) : row.map(v => Math.sqrt(v / sum));
  });
}
function matMulT(A: number[][]): number[][] {
  const n = A.length, p = A[0].length;
  return Array.from({length: p}, (_, i) =>
    Array.from({length: p}, (_, j) => A.reduce((s, row) => s + row[i] * row[j], 0) / (n - 1))
  );
}
function pcaHellinger(speciesMat: number[][]): { scores: {x:number;y:number}[]; var1:number; var2:number } | null {
  const n = speciesMat.length;
  if (n < 3 || speciesMat[0].length < 2) return null;
  const hell = hellingerTransformMat(speciesMat);
  const p = hell[0].length;
  const means = Array.from({length: p}, (_, j) => hell.reduce((s, row) => s + row[j], 0) / n);
  const centered = hell.map(row => row.map((v, j) => v - means[j]));
  const cov = matMulT(centered);
  const tr = cov.reduce((s, row, i) => s + row[i], 0);
  const s1 = Array.from({length: p}, (_, i) => i === 0 ? 1 : i * 0.01);
  const v1 = powerIteration(cov, s1);
  const l1 = v1.reduce((s, x, i) => s + x * cov[i].reduce((ss, y, j) => ss + y * v1[j], 0), 0);
  const cov2 = cov.map((row, i) => row.map((x, j) => x - l1 * v1[i] * v1[j]));
  const s2 = Array.from({length: p}, (_, i) => i === 1 ? 1 : i * 0.013);
  const v2 = powerIteration(cov2, s2);
  const l2 = v2.reduce((s, x, i) => s + x * cov2[i].reduce((ss, y, j) => ss + y * v2[j], 0), 0);
  const scores = centered.map(row => ({
    x: row.reduce((s, v, j) => s + v * v1[j], 0),
    y: row.reduce((s, v, j) => s + v * v2[j], 0),
  }));
  // Covariance matrix is PSD so eigenvalues ≥ 0; clamp to [0,100] for floating-point safety.
  const var1pca = tr > 0 ? Math.min(100, Math.max(0, l1 / tr * 100)) : 0;
  const var2pca = tr > 0 ? Math.min(100 - var1pca, Math.max(0, l2 / tr * 100)) : 0;
  return { scores, var1: var1pca, var2: var2pca };
}
function permanovaTest(distMat: number[][], groups: string[], nPerm = 299): {
  pseudoF: number; pValue: number; R2: number;
  ssBetween: number; ssWithin: number; ssTotal: number;
  dfBetween: number; dfWithin: number;
} {
  const n = distMat.length;
  const D2 = distMat.map(row => row.map(v => v * v));
  function calcF(grps: string[]): number {
    let ssT = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) ssT += D2[i][j];
    ssT /= n;
    const uGroups = [...new Set(grps)];
    let ssW = 0;
    for (const g of uGroups) {
      const idx = grps.reduce<number[]>((acc, gr, k) => gr === g ? [...acc, k] : acc, []);
      const ng = idx.length; if (ng < 2) continue;
      let ws = 0;
      for (let ii = 0; ii < idx.length; ii++) for (let jj = ii + 1; jj < idx.length; jj++) ws += D2[idx[ii]][idx[jj]];
      ssW += ws / ng;
    }
    const ssB = ssT - ssW;
    const dfB = uGroups.length - 1, dfW = n - uGroups.length;
    if (dfW <= 0 || dfB <= 0 || ssW === 0) return 0;
    return (ssB / dfB) / (ssW / dfW);
  }
  const obsF = calcF(groups);
  let exceed = 0;
  const perm = [...groups];
  for (let p = 0; p < nPerm; p++) {
    for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    if (calcF(perm) >= obsF) exceed++;
  }
  let ssT = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) ssT += D2[i][j];
  ssT /= n;
  const uGroups = [...new Set(groups)];
  let ssW = 0;
  for (const g of uGroups) {
    const idx = groups.reduce<number[]>((acc, gr, k) => gr === g ? [...acc, k] : acc, []);
    const ng = idx.length; if (ng < 2) continue;
    let ws = 0;
    for (let ii = 0; ii < idx.length; ii++) for (let jj = ii + 1; jj < idx.length; jj++) ws += D2[idx[ii]][idx[jj]];
    ssW += ws / ng;
  }
  const ssB = ssT - ssW;
  const dfB = uGroups.length - 1, dfW = n - uGroups.length;
  return { pseudoF: obsF, pValue: (exceed + 1) / (nPerm + 1), R2: ssT > 0 ? ssB / ssT : 0, ssBetween: ssB, ssWithin: ssW, ssTotal: ssT, dfBetween: dfB, dfWithin: dfW };
}

// Pairwise PERMANOVA with Bonferroni-adjusted p-values (Anderson 2001; Anderson & Walsh 2013)
// Post-hoc analog to Dunn's test for multivariate composition. Runs a 2-group PERMANOVA
// for each pair, then adjusts p by multiplying by the number of comparisons (Bonferroni).
function permanovaPairwise(distMat: number[][], groups: string[], nPerm = 299):
  { a: string; b: string; nA: number; nB: number; pseudoF: number; R2: number; p: number; pAdj: number }[] {
  const uGroups = [...new Set(groups)];
  if (uGroups.length < 2) return [];
  const m = (uGroups.length * (uGroups.length - 1)) / 2;
  const out: { a: string; b: string; nA: number; nB: number; pseudoF: number; R2: number; p: number; pAdj: number }[] = [];
  for (let a = 0; a < uGroups.length; a++) {
    for (let b = a + 1; b < uGroups.length; b++) {
      const ga = uGroups[a], gb = uGroups[b];
      const idx: number[] = [];
      const sub: string[] = [];
      for (let i = 0; i < groups.length; i++) {
        if (groups[i] === ga || groups[i] === gb) { idx.push(i); sub.push(groups[i]); }
      }
      if (idx.length < 3) continue;
      const subDist = idx.map(i => idx.map(j => distMat[i][j]));
      const res = permanovaTest(subDist, sub, nPerm);
      const nA = sub.filter(g => g === ga).length;
      const nB = sub.filter(g => g === gb).length;
      out.push({ a: ga, b: gb, nA, nB, pseudoF: res.pseudoF, R2: res.R2, p: res.pValue, pAdj: Math.min(1, res.pValue * m) });
    }
  }
  return out.sort((x, y) => x.pAdj - y.pAdj);
}

// ── Statistical helpers ──────────────────────────────────────────────────────
// Regularised incomplete beta  I(x; a, b)  — Numerical Recipes (Press et al.)
function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0; if (x >= 1) return 1;
  function lgam(z: number): number {
    if (z < 0.5) return Math.log(Math.PI/Math.sin(Math.PI*z)) - lgam(1-z);
    z -= 1; let v = 0.99999999999980993;
    [676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7].forEach((c,i)=>{v+=c/(z+i+1);});
    const t=z+7.5; return 0.5*Math.log(2*Math.PI)+(z+0.5)*Math.log(t)-t+Math.log(v);
  }
  function bcf(x: number, a: number, b: number): number {
    const eps=3e-7,fp=1e-30,qab=a+b,qap=a+1,qam=a-1;
    let c=1,d=1-qab*x/qap; if(Math.abs(d)<fp)d=fp; d=1/d; let h=d;
    for(let m=1;m<=100;m++){
      const m2=2*m;
      let aa=m*(b-m)*x/((qam+m2)*(a+m2));
      d=1+aa*d; if(Math.abs(d)<fp)d=fp; c=1+aa/c; if(Math.abs(c)<fp)c=fp; d=1/d; h*=d*c;
      aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
      d=1+aa*d; if(Math.abs(d)<fp)d=fp; c=1+aa/c; if(Math.abs(c)<fp)c=fp; d=1/d; const del=d*c; h*=del;
      if(Math.abs(del-1)<eps)break;
    }
    return h;
  }
  const lb=lgam(a)+lgam(b)-lgam(a+b);
  const bt=Math.exp(a*Math.log(x)+b*Math.log(1-x)-lb);
  return x<(a+1)/(a+b+2) ? bt*bcf(x,a,b)/a : 1-bt*bcf(1-x,b,a)/b;
}
// Two-tailed p-value from t-distribution
function tPVal2(t: number, df: number): number { return df>0 ? betaInc(df/(df+t*t), df/2, 0.5) : 1; }
// Skewness & excess kurtosis → Jarque-Bera statistic + p-value (χ²≈exp(-JB/2))
function jarqueBera(v: number[]): {jb:number;p:number;skew:number;kurt:number} {
  const n=v.length; if(n<4) return {jb:NaN,p:NaN,skew:NaN,kurt:NaN};
  const mu=v.reduce((s,x)=>s+x,0)/n;
  const m2=v.reduce((s,x)=>s+(x-mu)**2,0)/n;
  const m3=v.reduce((s,x)=>s+(x-mu)**3,0)/n;
  const m4=v.reduce((s,x)=>s+(x-mu)**4,0)/n;
  const skew=m3/Math.pow(m2,1.5), kurt=m4/m2**2-3;
  const jb=n/6*(skew**2+kurt**2/4);
  return {jb,p:Math.exp(-jb/2),skew,kurt};
}
// Pearson correlation on arrays (returns r, t, p, n)
function pearson(x: number[], y: number[]): {r:number;t:number;p:number;n:number} {
  const n=x.length; if(n<3) return {r:NaN,t:NaN,p:NaN,n};
  const mx=x.reduce((s,v)=>s+v,0)/n, my=y.reduce((s,v)=>s+v,0)/n;
  let sxy=0,sxx=0,syy=0;
  for(let i=0;i<n;i++){sxy+=(x[i]-mx)*(y[i]-my);sxx+=(x[i]-mx)**2;syy+=(y[i]-my)**2;}
  const r=sxy/Math.sqrt(sxx*syy)||0, df=n-2;
  const t=r*Math.sqrt(df)/Math.sqrt(Math.max(1e-12,1-r*r));
  return {r,t,p:tPVal2(t,df),n};
}
// Spearman correlation (rank-transform then Pearson)
function spearman(x: number[], y: number[]): {r:number;t:number;p:number;n:number} {
  const rank=(a:number[])=>{const s=[...a].map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v);const r=new Array(a.length);s.forEach((e,ri)=>{r[e.i]=ri+1;});return r;};
  return pearson(rank(x), rank(y));
}
// Standard normal CDF (Abramowitz & Stegun 26.2.17)
function normalCDF(x: number): number {
  const t=1/(1+0.2316419*Math.abs(x));
  const d=0.3989422820*Math.exp(-x*x/2);
  const p=d*t*(0.3193815+(t*(-0.3565638+(t*(1.7814779+(t*(-1.8212560+t*1.3302744)))))));
  return x>=0 ? 1-p : p;
}
// Mann-Whitney U test (two-tailed z-approximation, no continuity correction)
function mannWhitney(a: number[], b: number[]): {z:number;p:number;U:number}|null {
  const n1=a.length,n2=b.length; if(n1<2||n2<2) return null;
  // Rank combined
  const combined=[...a.map(v=>({v,g:0})),...b.map(v=>({v,g:1}))].sort((x,y)=>x.v-y.v);
  const ranks=new Array(combined.length);
  let i=0;
  while(i<combined.length){
    let j=i;
    while(j<combined.length-1&&combined[j+1].v===combined[j].v) j++;
    const avgR=(i+j)/2+1;
    for(let k=i;k<=j;k++) ranks[k]=avgR;
    i=j+1;
  }
  let R1=0;
  combined.forEach((e,idx)=>{ if(e.g===0) R1+=ranks[idx]; });
  const U1=R1-n1*(n1+1)/2;
  const muU=n1*n2/2;
  const sigU=Math.sqrt(n1*n2*(n1+n2+1)/12);
  const z=(U1-muU)/sigU;
  const p=2*(1-normalCDF(Math.abs(z)));
  return {z,p,U:U1};
}
// ── Chi-square upper-tail p-value via regularised incomplete gamma (series + CF)
function chiSquareUpperP(x: number, df: number): number {
  if (x <= 0 || df <= 0) return 1;
  const a = df / 2, z = x / 2;
  // Log-gamma via Lanczos for stability
  const lgamma = (n: number): number => {
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (n < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * n)) - lgamma(1 - n);
    n -= 1; let xg = c[0];
    for (let i = 1; i < g + 2; i++) xg += c[i] / (n + i);
    const t = n + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (n + 0.5) * Math.log(t) - t + Math.log(xg);
  };
  if (z < a + 1) {
    // Series representation of P(a,z)
    let term = 1 / a, sum = term;
    for (let i = 1; i < 200; i++) { term *= z / (a + i); sum += term; if (Math.abs(term) < Math.abs(sum) * 1e-12) break; }
    const P = sum * Math.exp(-z + a * Math.log(z) - lgamma(a));
    return Math.max(0, Math.min(1, 1 - P));
  }
  // Continued fraction for Q(a,z)
  let b = z + 1 - a, c = 1e30, d = 1 / b, h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break;
  }
  const Q = h * Math.exp(-z + a * Math.log(z) - lgamma(a));
  return Math.max(0, Math.min(1, Q));
}

// Kruskal-Wallis H test (omnibus non-parametric ANOVA on ranks, tie-corrected)
function kruskalWallis(groups: number[][]): { H: number; df: number; p: number; N: number; tieC: number } | null {
  const valid = groups.filter(g => g.length > 0);
  if (valid.length < 2) return null;
  const all: { v: number; g: number }[] = [];
  valid.forEach((g, gi) => g.forEach(v => all.push({ v, g: gi })));
  const N = all.length;
  if (N < 3) return null;
  all.sort((a, b) => a.v - b.v);
  // Average ranks for ties
  const ranks = new Array(N);
  const tieGroups: number[] = [];
  let i = 0;
  while (i < N) {
    let j = i;
    while (j < N - 1 && all[j + 1].v === all[i].v) j++;
    const avgR = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = avgR;
    if (j > i) tieGroups.push(j - i + 1);
    i = j + 1;
  }
  // Sum of ranks per group
  const Ri: number[] = new Array(valid.length).fill(0);
  all.forEach((e, idx) => { Ri[e.g] += ranks[idx]; });
  let H = 0;
  valid.forEach((g, gi) => { H += (Ri[gi] * Ri[gi]) / g.length; });
  H = (12 / (N * (N + 1))) * H - 3 * (N + 1);
  // Tie correction
  const tieSum = tieGroups.reduce((s, t) => s + (t * t * t - t), 0);
  const tieC = 1 - tieSum / (N * N * N - N);
  // Guard against division by zero when all values are tied (tieC = 0)
  H = tieC > 0 ? H / tieC : 0;
  const df = valid.length - 1;
  const p = chiSquareUpperP(H, df);
  return { H, df, p, N, tieC };
}

// Dunn's post-hoc test (pairwise z + Bonferroni-adjusted p-values)
// Anderson 2014; Dunn 1964. Standard tool after a significant Kruskal-Wallis.
function dunnTest(groups: number[][], labels: string[]):
  { i: number; j: number; a: string; b: string; z: number; p: number; pAdj: number }[] {
  const valid: { vals: number[]; lbl: string; idx: number }[] = [];
  groups.forEach((g, idx) => { if (g.length > 0) valid.push({ vals: g, lbl: labels[idx], idx }); });
  if (valid.length < 2) return [];
  const all: { v: number; g: number }[] = [];
  valid.forEach((gr, gi) => gr.vals.forEach(v => all.push({ v, g: gi })));
  const N = all.length;
  all.sort((a, b) => a.v - b.v);
  const ranks = new Array(N);
  const tieGroups: number[] = [];
  let i = 0;
  while (i < N) {
    let j = i;
    while (j < N - 1 && all[j + 1].v === all[i].v) j++;
    const avgR = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = avgR;
    if (j > i) tieGroups.push(j - i + 1);
    i = j + 1;
  }
  const meanR: number[] = new Array(valid.length).fill(0);
  const sumR: number[] = new Array(valid.length).fill(0);
  all.forEach((e, idx) => { sumR[e.g] += ranks[idx]; });
  valid.forEach((gr, gi) => { meanR[gi] = sumR[gi] / gr.vals.length; });
  const tieSum = tieGroups.reduce((s, t) => s + (t * t * t - t), 0);
  const T = tieSum / (12 * (N - 1));
  const sigma2Base = (N * (N + 1)) / 12 - T;
  const m = (valid.length * (valid.length - 1)) / 2;
  const out: { i: number; j: number; a: string; b: string; z: number; p: number; pAdj: number }[] = [];
  for (let a = 0; a < valid.length; a++) {
    for (let b = a + 1; b < valid.length; b++) {
      const se = Math.sqrt(sigma2Base * (1 / valid[a].vals.length + 1 / valid[b].vals.length));
      if (se === 0) continue;
      const z = (meanR[a] - meanR[b]) / se;
      const p = 2 * (1 - normalCDF(Math.abs(z)));
      out.push({ i: valid[a].idx, j: valid[b].idx, a: valid[a].lbl, b: valid[b].lbl, z, p, pAdj: Math.min(1, p * m) });
    }
  }
  return out.sort((x, y) => x.pAdj - y.pAdj);
}

// 95% confidence ellipse parameters from a set of 2-D points (χ²=5.991, df=2)
function compute95Ellipse(pts: {x:number;y:number}[]): {cx:number;cy:number;rx:number;ry:number;angle:number}|null {
  if (pts.length < 3) return null;
  const n = pts.length;
  const mx = pts.reduce((s,p)=>s+p.x,0)/n, my = pts.reduce((s,p)=>s+p.y,0)/n;
  const sxx = pts.reduce((s,p)=>s+(p.x-mx)**2,0)/(n-1);
  const syy = pts.reduce((s,p)=>s+(p.y-my)**2,0)/(n-1);
  const sxy = pts.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0)/(n-1);
  const tr=sxx+syy, det=sxx*syy-sxy**2, disc=Math.sqrt(Math.max(0,tr**2/4-det));
  const l1=tr/2+disc, l2=tr/2-disc, chi2=5.991;
  return { cx:mx, cy:my, rx:Math.sqrt(Math.max(0,l1*chi2)), ry:Math.sqrt(Math.max(0,l2*chi2)), angle:sxy===0?0:Math.atan2(l1-sxx,sxy) };
}
// Analytical 2-variable PCA for biplot
function pca2D(data:{x:number;y:number}[]): {scores:{x:number;y:number}[];loadings:{name:string;x:number;y:number}[];var1:number;var2:number}|null {
  const n=data.length; if(n<3) return null;
  const mx=data.reduce((s,p)=>s+p.x,0)/n, my=data.reduce((s,p)=>s+p.y,0)/n;
  const sdx=Math.sqrt(data.reduce((s,p)=>s+(p.x-mx)**2,0)/(n-1))||1;
  const sdy=Math.sqrt(data.reduce((s,p)=>s+(p.y-my)**2,0)/(n-1))||1;
  const std=data.map(p=>({x:(p.x-mx)/sdx,y:(p.y-my)/sdy}));
  const sxx=std.reduce((s,p)=>s+p.x**2,0)/(n-1);
  const syy=std.reduce((s,p)=>s+p.y**2,0)/(n-1);
  const sxy=std.reduce((s,p)=>s+p.x*p.y,0)/(n-1);
  const tr=sxx+syy, det=sxx*syy-sxy**2, disc=Math.sqrt(Math.max(0,tr**2/4-det));
  const l1=tr/2+disc, l2=tr/2-disc;
  let v1x:number,v1y:number;
  if(Math.abs(sxy)>1e-10){const rv=l1-syy;const len=Math.sqrt(rv**2+sxy**2);v1x=rv/len;v1y=sxy/len;}
  else{v1x=sxx>=syy?1:0;v1y=sxx>=syy?0:1;}
  const v2x=-v1y,v2y=v1x;
  const sc1=Math.sqrt(Math.max(0,l1)),sc2=Math.sqrt(Math.max(0,l2));
  const total=l1+l2||1;
  return {
    scores:std.map(p=>({x:p.x*v1x+p.y*v1y,y:p.x*v2x+p.y*v2y})),
    // biplot loadings: row = variable, components = [on PC1, on PC2]
    loadings:[
      {name:"CT",  x:v1x*sc1, y:v2x*sc2},
      {name:"PESO",x:v1y*sc1, y:v2y*sc2},
    ],
    var1:l1/total*100, var2:l2/total*100,
  };
}
function powerLawFit(xArr: number[], yArr: number[]): { a: number; b: number; r2: number } | null {
  const pairs = xArr.map((x, i) => ({x, y: yArr[i]})).filter(p => p.x > 0 && p.y > 0);
  if (pairs.length < 3) return null;
  const lx = pairs.map(p => Math.log(p.x)), ly = pairs.map(p => Math.log(p.y));
  const n = pairs.length;
  const mx = lx.reduce((s, v) => s + v, 0) / n, my = ly.reduce((s, v) => s + v, 0) / n;
  const sxy = lx.reduce((s, x, i) => s + (x - mx) * (ly[i] - my), 0);
  const sx2 = lx.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (sx2 === 0) return null;
  const b = sxy / sx2, lna = my - b * mx, a = Math.exp(lna);
  const ssRes = pairs.reduce((s, _, i) => s + (ly[i] - (lna + b * lx[i])) ** 2, 0);
  const ssTot = ly.reduce((s, y) => s + (y - my) ** 2, 0);
  return { a, b, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0 };
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTATÍSTICAS DE BIODIVERSIDADE (port do Python)
// ══════════════════════════════════════════════════════════════════════════════
function shannonH(counts: number[]): number {
  const pos = counts.filter(c => c > 0);
  const N = pos.reduce((a, b) => a + b, 0);
  if (N === 0) return 0;
  return -pos.reduce((h, c) => { const p = c / N; return h + p * Math.log(p); }, 0);
}
function simpsonD(counts: number[]): number {
  const pos = counts.filter(c => c > 0);
  const N = pos.reduce((a, b) => a + b, 0);
  if (N === 0) return 0;
  return 1 - pos.reduce((d, c) => d + (c / N) ** 2, 0);
}
function pielouJ(counts: number[]): number {
  const H = shannonH(counts);
  const S = counts.filter(c => c > 0).length;
  if (S <= 1) return 0;
  return H / Math.log(S);
}
// Jackknife 1 (incidência por UA)
function jackknife1(samplesBySpecies: Record<string, Set<string>>): number {
  const allSamples = new Set<string>();
  Object.values(samplesBySpecies).forEach(s => s.forEach(ua => allSamples.add(ua)));
  const n = allSamples.size;
  if (n === 0) return 0;
  const Sobs = Object.keys(samplesBySpecies).length;
  // Q1 = espécies presentes em exatamente 1 UA
  const Q1 = Object.values(samplesBySpecies).filter(s => s.size === 1).length;
  return Sobs + Q1 * (n - 1) / n;
}
// Bootstrap (incidência)
function bootstrapS(samplesBySpecies: Record<string, Set<string>>): number {
  const allSamples = new Set<string>();
  Object.values(samplesBySpecies).forEach(s => s.forEach(ua => allSamples.add(ua)));
  const n = allSamples.size;
  if (n === 0) return 0;
  const Sobs = Object.keys(samplesBySpecies).length;
  const correction = Object.values(samplesBySpecies).reduce((acc, s) => {
    const p = s.size / n;
    return acc + (1 - p) ** n;
  }, 0);
  return Sobs + correction;
}
// ── Novos estimadores de riqueza ──────────────────────────────────────────────
function chao1(spCounts: Record<string, number>): number {
  const counts = Object.values(spCounts);
  const Sobs = counts.filter(c => c > 0).length;
  const f1 = counts.filter(c => c === 1).length;
  const f2 = counts.filter(c => c === 2).length;
  if (f2 === 0) return f1 > 0 ? Sobs + (f1 * (f1 - 1)) / 2 : Sobs;
  return Sobs + (f1 * f1) / (2 * f2);
}
function chao2(spByUa: Record<string, Set<string>>): number {
  const Sobs = Object.keys(spByUa).length;
  const n = new Set(Object.values(spByUa).flatMap(s => [...s])).size;
  if (n === 0) return Sobs;
  const Q1 = Object.values(spByUa).filter(s => s.size === 1).length;
  const Q2 = Object.values(spByUa).filter(s => s.size === 2).length;
  if (Q2 === 0) return Q1 > 0 ? Sobs + (Q1 * (Q1 - 1)) / 2 : Sobs;
  return Sobs + ((n - 1) / n) * (Q1 * Q1) / (2 * Q2);
}
function jackknife2(spByUa: Record<string, Set<string>>): number {
  const n = new Set(Object.values(spByUa).flatMap(s => [...s])).size;
  if (n <= 2) return jackknife1(spByUa);
  const Sobs = Object.keys(spByUa).length;
  const Q1 = Object.values(spByUa).filter(s => s.size === 1).length;
  const Q2 = Object.values(spByUa).filter(s => s.size === 2).length;
  return Sobs + Q1 * (2 * n - 3) / n - Q2 * (n - 2) ** 2 / (n * (n - 1));
}
function margalef(Sobs: number, N: number): number {
  if (N <= 1) return 0;
  return (Sobs - 1) / Math.log(N);
}
function menhinick(Sobs: number, N: number): number {
  if (N === 0) return 0;
  return Sobs / Math.sqrt(N);
}
// Rank-abundance (retorna top 30 espécies ordenadas por abundância)
function rankAbundance(spCounts: Record<string, number>): { rank: number; especie: string; n: number; logN: number }[] {
  return Object.entries(spCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([especie, n], i) => ({ rank: i + 1, especie, n, logN: n > 0 ? Math.log10(n) : 0 }));
}
// Riqueza + abundância por dimensão (periodo, ambiente, familia, ordem)
// Natural sort comparator — sorts "UA2" before "UA10", "Campanha 1" before "Campanha 10"
const natSort = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

function byDimensao(
  registros: CampoRegistro[],
  getKey: (r: CampoRegistro) => string | null | undefined,
  topN = 15,
  sortBy: "label" | "richness" = "label",
): { label: string; abundancia: number; riqueza: number }[] {
  const grouped: Record<string, Set<string>> = {};
  const counts: Record<string, number> = {};
  registros.forEach(r => {
    const k = getKey(r)?.trim() || null;
    if (!k) return;
    if (!grouped[k]) { grouped[k] = new Set(); counts[k] = 0; }
    if (r.nomeCientifico) grouped[k].add(r.nomeCientifico.trim().toUpperCase());
    counts[k]++;
  });
  return Object.entries(grouped)
    .map(([label, spp]) => ({ label, abundancia: counts[label], riqueza: spp.size }))
    .sort((a, b) => sortBy === "richness" ? b.riqueza - a.riqueza : natSort(a.label, b.label))
    .slice(0, topN);
}
// Espécies raras (singletons e doubletons)
function rareSpeciesList(spCounts: Record<string, number>): { especie: string; n: number; categoria: "singleton" | "doubleton" }[] {
  return Object.entries(spCounts)
    .filter(([, n]) => n <= 2)
    .sort((a, b) => a[1] - b[1])
    .map(([especie, n]) => ({ especie, n, categoria: n === 1 ? "singleton" as const : "doubleton" as const }));
}
// ── ICE (Incidence Coverage Estimator) ────────────────────────────────────────
// Reference: Chao & Lee 1992. More robust than Chao2 when many rare species.
function iceEstimator(spByUa: Record<string, Set<string>>): number {
  const spFreqs = Object.values(spByUa).map(s => s.size);
  const Sinfreq = spFreqs.filter(f => f <= 10).length;
  const Sfreq   = spFreqs.filter(f => f > 10).length;
  if (Sinfreq === 0) return Sfreq;
  // f_k: species count found in exactly k UAs (k=1..10)
  const fk = new Array<number>(11).fill(0);
  for (const f of spFreqs) if (f <= 10) fk[f]++;
  const f1 = fk[1];
  const N_inf = spFreqs.filter(f => f <= 10).reduce((s, f) => s + f, 0);
  if (N_inf === 0) return Sfreq + Sinfreq;
  const Cice = 1 - f1 / N_inf;
  if (Cice <= 0) return Sfreq + Sinfreq + f1;
  let sumKK1 = 0;
  for (let k = 1; k <= 10; k++) sumKK1 += k * (k - 1) * fk[k];
  const gamma2 = Math.max(0, (Sinfreq * sumKK1) / (Cice * N_inf * (N_inf - 1)) - 1);
  return Math.round((Sfreq + Sinfreq / Cice + (f1 / Cice) * gamma2) * 10) / 10;
}

// ── Taxa de novas espécies por dia ────────────────────────────────────────────
interface NewSpDay { date: string; label: string; dayNum: number; newSp: number; cumSp: number }

function newSpeciesPerDay(registros: CampoRegistro[]): NewSpDay[] {
  const days = [...new Set(registros.map(r => r.data).filter(Boolean) as string[])].sort();
  const seen = new Set<string>();
  return days.map((day, i) => {
    const todaySp = new Set(
      registros.filter(r => r.data === day).map(r => r.nomeCientifico?.trim().toUpperCase()).filter(Boolean) as string[]
    );
    const newSp = [...todaySp].filter(sp => !seen.has(sp)).length;
    todaySp.forEach(sp => seen.add(sp));
    const parts = day.split(/[-/]/);
    const label = parts.length >= 3 ? `${parts[2].slice(-2)}/${parts[1]}` : day.slice(0, 5);
    return { date: day, label, dayNum: i + 1, newSp, cumSp: seen.size };
  });
}

// ── Rarefação por abundância (Coleman subsampling) ────────────────────────────
// Returns E[S(n)] for n = 1..minN for each campaign (comparable curves).
interface RarefactionPoint { n: number; eSobs: number }
interface RarefStats {
  label: string; color: string;
  n: number; sobs: number;
  chao1: number; chao1se: number;
  ace: number;
  goodsCoverage: number;      // 0–1
  completeness: number;       // sobs/chao1 * 100
  rarefN: number | null;      // E[S(nMin)] at standardised sample size
}
interface RarefactionSeries { label: string; color: string; points: RarefactionPoint[]; extPoints?: RarefactionPoint[]; stats?: RarefStats }

// Paleta unificada EcoBrasil — laranja/teal (mesma identidade visual das demais figuras)
const RAREF_COLORS = [...ECO_PALETTE];

// Hurlbert 1971 E[S(n)] — log-binomial for overflow safety
function computeESobs(recs: CampoRegistro[], n: number): number {
  const spCounts: Record<string, number> = {};
  recs.forEach(r => {
    const sp = r.nomeCientifico?.trim().toUpperCase();
    if (sp) spCounts[sp] = (spCounts[sp] || 0) + 1;
  });
  const counts = Object.values(spCounts).filter(c => c > 0);
  const Sobs  = counts.length;
  const N     = counts.reduce((s, c) => s + c, 0);
  if (Sobs === 0 || N === 0) return 0;
  if (n >= N) return Sobs;
  let eS = 0;
  for (const Ni of counts) {
    // If N-Ni < n, the species must appear → contributes 1
    if (N - Ni < n) { eS += 1; continue; }
    // log C(N-Ni, n) / C(N, n) = sum_k=0..n-1 [ log(N-Ni-k) - log(N-k) ]
    let logP = 0;
    for (let k = 0; k < n; k++) logP += Math.log(N - Ni - k) - Math.log(N - k);
    eS += 1 - Math.exp(logP);
  }
  return Math.max(0, Math.min(Sobs, eS));
}

// ── Non-parametric richness estimators + coverage ─────────────────────────────

/** Chao1 + standard error from species abundance vector */
function chao1Extended(counts: number[]): { chao1: number; se: number; f1: number; f2: number } {
  const Sobs = counts.filter(c => c > 0).length;
  const f1 = counts.filter(c => c === 1).length;
  const f2 = counts.filter(c => c === 2).length;
  let c1: number;
  if (f2 === 0) c1 = f1 > 0 ? Sobs + (f1 * (f1 - 1)) / 2 : Sobs;
  else c1 = Sobs + (f1 * f1) / (2 * f2);
  // Chao (1987) variance approximation
  let se = 0;
  if (f2 > 0) {
    const k = f1 / f2;
    se = Math.sqrt(f2 * (k ** 4 / 4 + k ** 3 + k ** 2 / 2));
  }
  return { chao1: c1, se, f1, f2 };
}

/**
 * ACE — Abundance-based Coverage Estimator (Chao & Lee 1992)
 * Rare species threshold: 10 individuals.
 */
function computeACE(counts: number[]): number {
  const rare   = counts.filter(c => c > 0 && c <= 10);
  const abund  = counts.filter(c => c > 10);
  const Srare  = rare.length;
  const Sabund = abund.length;
  const nRare  = rare.reduce((s, c) => s + c, 0);
  if (Srare === 0) return Sabund;
  const f1 = counts.filter(c => c === 1).length;
  const Cace = f1 === nRare ? 0 : 1 - f1 / nRare;
  if (Cace <= 0) {
    // fallback: Chao1 when coverage undefined
    const { chao1: ch } = chao1Extended(counts);
    return ch;
  }
  // gamma² = correction factor for clumping of rare species
  let sumII = 0;
  for (let i = 1; i <= 10; i++) {
    const fi = counts.filter(c => c === i).length;
    sumII += i * (i - 1) * fi;
  }
  const gamma2 = Math.max(
    0,
    (Srare / Cace) * sumII / (nRare * (nRare - 1)) - 1,
  );
  return Sabund + Srare / Cace + (f1 / Cace) * gamma2;
}

/**
 * Good's Coverage = 1 − f1/N
 * Fraction of individuals belonging to species observed more than once.
 */
function goodsCoverage(counts: number[]): number {
  const N  = counts.reduce((s, c) => s + c, 0);
  if (N === 0) return 0;
  const f1 = counts.filter(c => c === 1).length;
  return Math.max(0, 1 - f1 / N);
}

/** Build full RarefStats for a set of records, optionally evaluating E[S] at nMin */
function buildRarefStats(
  recs: CampoRegistro[],
  label: string,
  color: string,
  nMin?: number,
): RarefStats | null {
  const valid = recs.filter(r => r.nomeCientifico?.trim());
  if (!valid.length) return null;
  const spCounts: Record<string, number> = {};
  valid.forEach(r => {
    const sp = r.nomeCientifico!.trim().toUpperCase();
    spCounts[sp] = (spCounts[sp] || 0) + 1;
  });
  const counts = Object.values(spCounts);
  const N    = counts.reduce((s, c) => s + c, 0);
  const Sobs = counts.filter(c => c > 0).length;
  const { chao1: c1, se } = chao1Extended(counts);
  const ace  = computeACE(counts);
  const cov  = goodsCoverage(counts);
  const comp = c1 > 0 ? Math.min(100, (Sobs / c1) * 100) : 0;
  const rarefN = (nMin && nMin < N) ? computeESobs(valid, nMin) : null;
  return { label, color, n: N, sobs: Sobs, chao1: c1, chao1se: se, ace, goodsCoverage: cov, completeness: comp, rarefN };
}

/**
 * iNEXT-style extrapolation from N to 2N.
 * E[S(n*)] = Sobs + (Chao1 − Sobs) × (1 − exp(−a × (n* − N)))
 * where a = f1 / (N × (Chao1 − Sobs)), clamped for stability.
 */
function buildExtrapolation(recs: CampoRegistro[]): RarefactionPoint[] {
  const valid = recs.filter(r => r.nomeCientifico?.trim());
  if (!valid.length) return [];
  const spCounts: Record<string, number> = {};
  valid.forEach(r => {
    const sp = r.nomeCientifico!.trim().toUpperCase();
    spCounts[sp] = (spCounts[sp] || 0) + 1;
  });
  const counts = Object.values(spCounts);
  const N = counts.reduce((s, c) => s + c, 0);
  const Sobs = counts.filter(c => c > 0).length;
  const { chao1, f1 } = chao1Extended(counts);
  if (chao1 <= Sobs) return []; // no gap to extrapolate
  const gap = chao1 - Sobs;
  const a = f1 > 0 ? f1 / (N * gap) : 1 / N;
  const nMax = N * 2;
  const step = Math.max(1, Math.floor((nMax - N) / 25));
  const pts: RarefactionPoint[] = [];
  for (let n = N + step; n <= nMax; n += step) {
    const eSobs = Sobs + gap * (1 - Math.exp(-a * (n - N)));
    pts.push({ n, eSobs: Math.round(Math.min(chao1, eSobs) * 10) / 10 });
  }
  if (!pts.length || pts.at(-1)!.n < nMax) {
    const eSobs = Sobs + gap * (1 - Math.exp(-a * (nMax - N)));
    pts.push({ n: nMax, eSobs: Math.round(Math.min(chao1, eSobs) * 10) / 10 });
  }
  return pts;
}

/**
 * Build rarefaction curve (50 steps) + iNEXT extrapolation + full RarefStats for a set of records.
 * nMin — if provided, marks the standardised comparison point (vertical line).
 */
function buildRarefSeries(
  recs: CampoRegistro[],
  label: string,
  color: string,
  nMin?: number,
): RarefactionSeries | null {
  const valid = recs.filter(r => r.nomeCientifico?.trim());
  if (valid.length === 0) return null;
  const N    = valid.length;
  const step = Math.max(1, Math.floor(N / 50));
  const points: RarefactionPoint[] = [];
  for (let n = step; n <= N; n += step) {
    points.push({ n, eSobs: Math.round(computeESobs(valid, n) * 10) / 10 });
  }
  if (!points.length || points.at(-1)!.n < N) {
    points.push({ n: N, eSobs: Math.round(computeESobs(valid, N) * 10) / 10 });
  }
  const stats    = buildRarefStats(recs, label, color, nMin) ?? undefined;
  const extPoints = buildExtrapolation(recs);
  return { label, color, points, extPoints, stats };
}

/** Compute the common N (minimum across all series) for rarefaction standardisation */
function computeNmin(recs: CampoRegistro[], groups: string[], groupFn: (r: CampoRegistro) => string | null | undefined): number {
  const grouped = groups.map(g => recs.filter(r => groupFn(r) === g || (!groupFn(r) && g === "(todos)")));
  const sizes = grouped.map(g => g.filter(r => r.nomeCientifico?.trim()).length).filter(n => n > 0);
  return sizes.length >= 2 ? Math.min(...sizes) : 0;
}

// Group registros by campanha → rarefaction series (max 10 groups)
function rarefactionByCampanha(registros: CampoRegistro[], campanhas: string[]): RarefactionSeries[] {
  const groups = campanhas.length > 0 ? campanhas : ["(todos)"];
  const nMin = computeNmin(registros, groups, r => r.campanha);
  return groups.slice(0, 10).flatMap((camp, ci) => {
    const recs = camp === "(todos)" ? registros : registros.filter(r => r.campanha === camp);
    const s = buildRarefSeries(recs, camp, RAREF_COLORS[ci % RAREF_COLORS.length], nMin > 0 ? nMin : undefined);
    return s ? [s] : [];
  });
}

// Group registros by unidade amostral → rarefaction series (max 10 UAs)
function rarefactionByUA(registros: CampoRegistro[]): RarefactionSeries[] {
  const uas = [...new Set(registros.map(r => r.unidadeAmostral?.trim()).filter(Boolean) as string[])].sort(natSort);
  if (!uas.length) return [];
  const nMin = computeNmin(registros, uas, r => r.unidadeAmostral?.trim());
  return uas.slice(0, 10).flatMap((ua, ci) => {
    const recs = registros.filter(r => r.unidadeAmostral?.trim() === ua);
    const s = buildRarefSeries(recs, ua, RAREF_COLORS[ci % RAREF_COLORS.length], nMin > 0 ? nMin : undefined);
    return s ? [s] : [];
  });
}

// Legacy wrapper (kept for compatibility)
function rarefactionCurves(registros: CampoRegistro[], campanhas: string[]): RarefactionSeries[] {
  return rarefactionByCampanha(registros, campanhas);
}

// ── Mapa de calor: localização × mês × grupo ─────────────────────────────────
interface HeatCell { row: string; col: string; count: number; richness: number }
interface HeatmapData { rows: string[]; cols: string[]; cells: HeatCell[] }

function buildHeatmap(registros: CampoRegistro[], rowFn: (r: CampoRegistro) => string | null, colFn: (r: CampoRegistro) => string | null): HeatmapData {
  const matrix: Record<string, Record<string, { n: number; sp: Set<string> }>> = {};
  registros.forEach(r => {
    const row = rowFn(r)?.trim();
    const col = colFn(r)?.trim();
    if (!row || !col) return;
    if (!matrix[row]) matrix[row] = {};
    if (!matrix[row][col]) matrix[row][col] = { n: 0, sp: new Set() };
    matrix[row][col].n++;
    const sp = r.nomeCientifico?.trim().toUpperCase();
    if (sp) matrix[row][col].sp.add(sp);
  });
  const rows = Object.keys(matrix).sort(natSort);
  const colSet = new Set<string>();
  rows.forEach(r => Object.keys(matrix[r]).forEach(c => colSet.add(c)));
  const cols = [...colSet].sort(natSort);
  const cells: HeatCell[] = [];
  rows.forEach(row => cols.forEach(col => {
    const d = matrix[row]?.[col];
    cells.push({ row, col, count: d?.n ?? 0, richness: d?.sp.size ?? 0 });
  }));
  return { rows, cols, cells };
}

// ── Completude por campanha ────────────────────────────────────────────────────
interface CampComplde { camp: string; Sobs: number; N: number; chao1: number; pct: number }

function campCompletude(registros: CampoRegistro[], campanhas: string[]): CampComplde[] {
  return campanhas.map(camp => {
    const recs = registros.filter(r => r.campanha === camp || (!r.campanha && camp === "(sem campanha)"));
    const spCounts: Record<string, number> = {};
    recs.forEach(r => {
      const sp = r.nomeCientifico?.trim().toUpperCase();
      if (sp) spCounts[sp] = (spCounts[sp] || 0) + 1;
    });
    const Sobs = Object.keys(spCounts).length;
    const N = Object.values(spCounts).reduce((s, c) => s + c, 0);
    const ch1 = chao1(spCounts);
    const pct = ch1 > 0 ? Math.min(100, (Sobs / ch1) * 100) : 0;
    return { camp, Sobs, N, chao1: Math.round(ch1 * 10) / 10, pct: Math.round(pct * 10) / 10 };
  }).filter(d => d.N > 0).sort((a, b) => b.pct - a.pct);
}

// ── Progresso de descoberta por campanha ──────────────────────────────────────
interface CampanhaProgress {
  camp: string;
  N: number;
  Sobs: number;
  novaSp: number;      // new species not seen in previous campaigns
  cumSp: number;       // cumulative unique species up to this campaign
  exclusivaSp: number; // species found ONLY in this campaign
  exclusivaSpList: string[]; // names of exclusive species
  novaSpList: string[];      // names of new species (first time seen)
}

function buildCampanhaProgress(registros: CampoRegistro[], campanhas: string[]): CampanhaProgress[] {
  const ordered = campanhas.filter(c => registros.some(r => r.campanha === c));
  if (!ordered.length) return [];
  const seenBefore = new Set<string>();
  const spPerCamp: Record<string, Set<string>> = {};

  for (const camp of ordered) {
    const recs = registros.filter(r => r.campanha === camp);
    const spSet = new Set<string>();
    recs.forEach(r => {
      const sp = r.nomeCientifico?.trim().toUpperCase();
      if (sp) spSet.add(sp);
    });
    spPerCamp[camp] = spSet;
  }

  const rows: CampanhaProgress[] = [];
  for (const camp of ordered) {
    const spSet = spPerCamp[camp];
    const N = registros.filter(r => r.campanha === camp).length;
    const Sobs = spSet.size;
    const novaSpList = [...spSet].filter(sp => !seenBefore.has(sp)).sort();
    const novaSp = novaSpList.length;
    spSet.forEach(sp => seenBefore.add(sp));
    const cumSp = seenBefore.size;
    // exclusive = only in this campaign
    const exclusivaSpList = [...spSet].filter(sp =>
      ordered.filter(c => c !== camp).every(c => !spPerCamp[c].has(sp))
    ).sort();
    const exclusivaSp = exclusivaSpList.length;
    rows.push({ camp, N, Sobs, novaSp, cumSp, exclusivaSp, exclusivaSpList, novaSpList });
  }
  return rows;
}

// ── Grupos taxonômicos por campanha ────────────────────────────────────────────
interface GrupoByCamp { camp: string; grupos: Record<string, number> }

function buildGruposByCampanha(registros: CampoRegistro[], campanhas: string[]): GrupoByCamp[] {
  return campanhas.map(camp => {
    const recs = registros.filter(r => r.campanha === camp);
    const grupos: Record<string, number> = {};
    recs.forEach(r => {
      const g = normalizeGrupoKey(r.grupoTaxonomico) || "outros";
      grupos[g] = (grupos[g] || 0) + 1;
    });
    return { camp, grupos };
  }).filter(d => Object.keys(d.grupos).length > 0);
}

// Diversidade beta — Jaccard pairwise entre UAs (retorna matriz)
function betaJaccardMatrix(registros: CampoRegistro[]): { uas: string[]; matrix: number[][] } {
  const uaMap: Record<string, Set<string>> = {};
  registros.forEach(r => {
    const ua = r.unidadeAmostral?.trim();
    const sp = r.nomeCientifico?.trim().toUpperCase();
    if (!ua || !sp) return;
    if (!uaMap[ua]) uaMap[ua] = new Set();
    uaMap[ua].add(sp);
  });
  const uas = Object.keys(uaMap).sort();
  const matrix = uas.map((a, i) =>
    uas.map((b, j) => {
      if (i === j) return 1;
      const A = uaMap[a], B = uaMap[b];
      const inter = [...A].filter(s => B.has(s)).length;
      const union = new Set([...A, ...B]).size;
      return union === 0 ? 0 : Math.round((inter / union) * 1000) / 1000;
    })
  );
  return { uas, matrix };
}

// ── Matrizes de distância entre UAs ──────────────────────────────────────────
type UaMatrix = { uas: string[]; especies: string[]; matriz: number[][] };

function brayCurtisDistMatrix({ uas, especies, matriz }: UaMatrix): number[][] {
  const n = uas.length, nSp = especies.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 0;
      let sumMin = 0, sumA = 0, sumB = 0;
      for (let k = 0; k < nSp; k++) {
        sumMin += Math.min(matriz[k][i], matriz[k][j]);
        sumA += matriz[k][i];
        sumB += matriz[k][j];
      }
      const denom = sumA + sumB;
      return denom === 0 ? 0 : 1 - (2 * sumMin) / denom;
    })
  );
}

function sorensenDistMatrix({ uas, especies, matriz }: UaMatrix): number[][] {
  const n = uas.length, nSp = especies.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 0;
      let shared = 0, A = 0, B = 0;
      for (let k = 0; k < nSp; k++) {
        const a = matriz[k][i] > 0 ? 1 : 0;
        const b = matriz[k][j] > 0 ? 1 : 0;
        if (a && b) shared++;
        A += a; B += b;
      }
      const denom = A + B;
      return denom === 0 ? 0 : 1 - (2 * shared) / denom;
    })
  );
}

function jaccardDistMatrix({ uas, especies, matriz }: UaMatrix): number[][] {
  const n = uas.length, nSp = especies.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 0;
      let shared = 0, union = 0;
      for (let k = 0; k < nSp; k++) {
        const a = matriz[k][i] > 0, b = matriz[k][j] > 0;
        if (a || b) union++;
        if (a && b) shared++;
      }
      return union === 0 ? 0 : 1 - shared / union;
    })
  );
}

// ── UPGMA hierarchical clustering ─────────────────────────────────────────────
type DendroNode = { label?: string; left?: DendroNode; right?: DendroNode; height: number; leaves: string[] };

function upgma(labels: string[], distMatrix: number[][]): DendroNode | null {
  if (labels.length === 0) return null;
  if (labels.length === 1) return { label: labels[0], height: 0, leaves: [labels[0]] };
  const n = labels.length;
  const dist = distMatrix.map(row => [...row]);
  const nodes: DendroNode[] = labels.map(l => ({ label: l, height: 0, leaves: [l] }));
  const sizes = Array<number>(n).fill(1);
  const active = Array.from({ length: n }, (_, i) => i);
  while (active.length > 1) {
    let minD = Infinity, mi = -1, mj = -1;
    for (let ai = 0; ai < active.length; ai++)
      for (let aj = ai + 1; aj < active.length; aj++) {
        const v = dist[active[ai]][active[aj]];
        if (v < minD) { minD = v; mi = ai; mj = aj; }
      }
    const ci = active[mi], cj = active[mj];
    const ni = sizes[ci], nj = sizes[cj];
    const merged: DendroNode = {
      left: nodes[ci], right: nodes[cj],
      height: minD / 2,
      leaves: [...nodes[ci].leaves, ...nodes[cj].leaves],
    };
    for (const ak of active) {
      if (ak === ci || ak === cj) continue;
      const d = (dist[ci][ak] * ni + dist[cj][ak] * nj) / (ni + nj);
      dist[ci][ak] = dist[ak][ci] = d;
    }
    sizes[ci] = ni + nj;
    nodes[ci] = merged;
    active.splice(mj, 1);
  }
  return nodes[active[0]];
}

function getLeafOrder(node: DendroNode): string[] {
  if (node.label) return [node.label];
  return [...getLeafOrder(node.left!), ...getLeafOrder(node.right!)];
}

// ── Dendrograma SVG ───────────────────────────────────────────────────────────
function DendrogramSVG({ root }: { root: DendroNode }) {
  const orderedLeaves = getLeafOrder(root);
  const n = orderedLeaves.length;
  const leafY: Record<string, number> = {};
  orderedLeaves.forEach((l, i) => { leafY[l] = i; });

  const rowH = Math.max(24, Math.min(44, 500 / Math.max(n, 1)));
  const pad = { left: 16, right: 150, top: 28, bottom: 20 };
  const plotW = 480;
  const plotH = rowH * Math.max(n - 1, 1);
  const totalW = pad.left + plotW + pad.right;
  const totalH = pad.top + plotH + pad.bottom;
  const maxH = root.height || 1;
  const xScale = (h: number) => pad.left + (h / maxH) * plotW;
  const yScale = (i: number) => pad.top + i * rowH;

  const lines: JSX.Element[] = [];
  let k = 0;

  function drawNode(node: DendroNode): number {
    if (node.label !== undefined) return yScale(leafY[node.label]);
    const ly = drawNode(node.left!);
    const ry = drawNode(node.right!);
    const x = xScale(node.height);
    const lx = node.left!.label !== undefined ? xScale(0) : xScale(node.left!.height);
    const rx = node.right!.label !== undefined ? xScale(0) : xScale(node.right!.height);
    lines.push(<line key={k++} x1={x} y1={ly} x2={x} y2={ry} stroke={BRAND.blue1} strokeWidth={1.5} />);
    lines.push(<line key={k++} x1={lx} y1={ly} x2={x} y2={ly} stroke={BRAND.blue1} strokeWidth={1.5} />);
    lines.push(<line key={k++} x1={rx} y1={ry} x2={x} y2={ry} stroke={BRAND.blue1} strokeWidth={1.5} />);
    return (ly + ry) / 2;
  }

  drawNode(root);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const x = pad.left + f * plotW;
    return (
      <g key={f}>
        <line x1={x} y1={pad.top} x2={x} y2={pad.top + plotH} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="3 3" />
        <text x={x} y={pad.top - 8} textAnchor="middle" fontSize={9} fill="#9ca3af">{(maxH * f).toFixed(2)}</text>
      </g>
    );
  });

  return (
    <SvgFigure name="dendrograma_upgma">
    <svg width="100%" viewBox={`0 0 ${totalW} ${totalH}`} style={{ fontFamily: "inherit", overflow: "visible" }}>
      <text x={pad.left + plotW / 2} y={10} textAnchor="middle" fontSize={9} fill="#9ca3af">← Distância →</text>
      {ticks}
      {lines}
      {orderedLeaves.map((l, i) => (
        <g key={l}>
          <circle cx={pad.left} cy={yScale(i)} r={3.5} fill={BRAND.orange1} />
          <text x={pad.left + plotW + 10} y={yScale(i) + 4} fontSize={11} fill="#374151">
            {l.length > 22 ? l.slice(0, 20) + "…" : l}
          </text>
        </g>
      ))}
    </svg>
    </SvgFigure>
  );
}

// ── NewSpDayChart — gráfico de barras de novas espécies por dia ───────────────
function NewSpDayChart({ data }: { data: NewSpDay[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current || !data.length) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "bar",
      data: {
        labels: data.map(d => d.label),
        datasets: [
          {
            type: "bar" as const,
            label: "Novas espécies",
            data: data.map(d => d.newSp),
            backgroundColor: data.map(d => d.newSp === 0 ? "#fca5a5" : d.newSp <= 2 ? "#fed7aa" : BRAND.blue1 + "cc"),
            borderColor: data.map(d => d.newSp === 0 ? "#ef4444" : d.newSp <= 2 ? BRAND.orange1 : BRAND.blue1),
            borderWidth: 1.5,
            borderRadius: 4,
            yAxisID: "yBars",
            order: 2,
          },
          {
            type: "line" as const,
            label: "Acumulada (Sobs)",
            data: data.map(d => d.cumSp),
            borderColor: BRAND.orange1,
            backgroundColor: "transparent",
            tension: 0.4,
            pointRadius: 3,
            borderWidth: 2,
            yAxisID: "yLine",
            order: 1,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "top" as const, labels: { boxWidth: 14, font: { size: 10 } } },
          tooltip: {
            mode: "index" as const, intersect: false,
            callbacks: {
              title: (items) => `Dia ${data[items[0].dataIndex]?.dayNum}  (${data[items[0].dataIndex]?.date})`,
              label: (item) => item.dataset.label === "Novas espécies"
                ? ` Novas: ${item.raw} espécies${(item.raw as number) === 0 ? " — saturação!" : ""}`
                : ` Acumulada: ${item.raw} espécies`,
            },
          },
        },
        scales: {
          x: { ticks: { maxRotation: 45, font: { size: 9 } }, grid: { display: false }, title: { display: true, text: "Dia de Coleta", font: { size: 9 } } },
          yBars: { beginAtZero: true, position: "left" as const, title: { display: true, text: "Novas spp.", font: { size: 9 } }, grid: { color: "#f1f5f9" } },
          yLine: { beginAtZero: true, position: "right" as const, title: { display: true, text: "Sobs acum.", font: { size: 9 } }, grid: { display: false } },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [data]);
  return (
    <div className="relative h-full" data-chart-title="Taxa de Novas Espécies por Dia">
      <div className="absolute top-0 right-0 z-10"><ChartDownloadBtn canvasRef={ref} name="novas_sp_por_dia" /></div>
      <canvas ref={ref} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

// ── RarefactionChart — curvas de rarefação com linha de padronização ──────────
function RarefactionChart({ series, groupBy, canvasRef: externalRef }: {
  series: RarefactionSeries[];
  groupBy: "campanha" | "ua";
  canvasRef?: { current: HTMLCanvasElement | null };
}) {
  const internalRef = useRef<HTMLCanvasElement>(null);
  const ref = externalRef || internalRef;
  const chartRef  = useRef<Chart | null>(null);
  const seriesKey = series.map(s => `${s.label}:${s.points.length}:${s.points.at(-1)?.eSobs}`).join("|");
  const prevKey   = useRef<string>("");

  // nMin = minimum total N across all series (standardisation point)
  const nMin = series.length >= 2
    ? Math.min(...series.map(s => s.points.at(-1)?.n ?? 0).filter(n => n > 0))
    : 0;

  useEffect(() => {
    if (!ref.current) return;
    if (prevKey.current === seriesKey && chartRef.current) return;
    prevKey.current = seriesKey;
    chartRef.current?.destroy();
    if (!series.length) { chartRef.current = null; return; }

    // Plugin: end-of-curve labels
    const endLabelsPlugin = {
      id: "endLabels",
      afterDatasetsDraw(chart: any) {
        const ctx = chart.ctx as CanvasRenderingContext2D;
        chart.data.datasets.forEach((ds: any, i: number) => {
          if ((ds.label as string).startsWith("__ext__")) return;
          const meta = chart.getDatasetMeta(i);
          if (!meta.visible || !meta.data.length) return;
          const last = meta.data[meta.data.length - 1];
          if (!last) return;
          const { x, y } = last.getProps(["x", "y"], true);
          const lbl = ds.label as string;
          ctx.save();
          ctx.font = "bold 9px system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.strokeStyle = "white"; ctx.lineWidth = 3; ctx.lineJoin = "round";
          ctx.strokeText(lbl, x + 5, y);
          ctx.fillStyle = ds.borderColor as string;
          ctx.fillText(lbl, x + 5, y);
          ctx.restore();
        });
      },
    };

    // Plugin: dashed vertical line + annotation at nMin (standardisation) — ECO orange
    const nMinLine = nMin > 0 ? {
      id: "nMinLine",
      afterDraw(chart: any) {
        const xScale = chart.scales["x"];
        const yScale = chart.scales["y"];
        if (!xScale || !yScale) return;
        const xPx = xScale.getPixelForValue(nMin);
        if (xPx < xScale.left || xPx > xScale.right) return;
        const ctx = chart.ctx as CanvasRenderingContext2D;
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = "#ea580c";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xPx, yScale.top);
        ctx.lineTo(xPx, yScale.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        // Label box
        const lbl = `N padrão = ${nMin}`;
        ctx.font = "bold 10px system-ui, sans-serif";
        const tw = ctx.measureText(lbl).width;
        const bx = xPx - tw / 2 - 6;
        const by = yScale.top - 2;
        ctx.fillStyle = "#ea580c";
        ctx.strokeStyle = "#9a3a0a";
        ctx.lineWidth = 0.8;
        const rr = 4;
        ctx.beginPath();
        ctx.roundRect(bx, by, tw + 12, 16, rr);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(lbl, xPx, by + 8);
        ctx.restore();
      },
    } : null;

    const maxN = Math.max(
      ...series.flatMap(s => s.points.map(p => p.n)),
      ...series.flatMap(s => s.extPoints?.map(p => p.n) ?? []),
    );
    const plugins = nMinLine ? [endLabelsPlugin, nMinLine] : [endLabelsPlugin];

    // Canvas height for gradient fills
    const cv = ref.current;
    const cH = cv.clientHeight || 320;
    const ctx2 = cv.getContext("2d")!;

    const mainDatasets = series.map((s, i) => {
      // Force ECO palette deterministic mapping (orange/teal alternation)
      const color = ECO_PALETTE[i % ECO_PALETTE.length];
      const grad = ctx2.createLinearGradient(0, 0, 0, cH);
      grad.addColorStop(0, color + "33");
      grad.addColorStop(0.6, color + "10");
      grad.addColorStop(1, color + "00");
      return {
        label: s.label.length > 22 ? s.label.slice(0, 20) + "…" : s.label,
        data: s.points.map(p => ({ x: p.n, y: p.eSobs })),
        borderColor: color,
        backgroundColor: grad,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: "#fff",
        pointHoverBorderWidth: 2,
        borderWidth: 3,
        fill: true,
        cubicInterpolationMode: "monotone" as const,
      };
    });

    const extDatasets = series
      .filter(s => s.extPoints && s.extPoints.length > 0)
      .map((s, i) => {
        const color = ECO_PALETTE[i % ECO_PALETTE.length];
        return {
          label: "__ext__" + s.label,
          data: [s.points.at(-1)!, ...s.extPoints!].map(p => ({ x: p.n, y: p.eSobs })),
          borderColor: color + "80",
          backgroundColor: "transparent",
          borderDash: [6, 4],
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 0,
          borderWidth: 2,
          fill: false,
        };
      });

    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "line",
      plugins,
      data: {
        datasets: [...mainDatasets, ...extDatasets],
      },
      options: {
        animation: false as any,
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 72, top: nMin > 0 ? 16 : 4 } },
        plugins: {
          legend: {
            display: true, position: "top" as const, align: "start" as const,
            labels: {
              boxWidth: 10, boxHeight: 10,
              font: { size: 11, family: "system-ui, sans-serif", weight: "600" as const },
              padding: 14, usePointStyle: true, pointStyle: "rectRounded" as const,
              color: "#334155",
              generateLabels(chart: any) {
                return chart.data.datasets
                  .map((ds: any, i: number) => ({ ds, i }))
                  .filter(({ ds }) => !(ds.label as string).startsWith("__ext__"))
                  .map(({ ds, i }) => ({
                    text: ds.label, fillStyle: ds.borderColor, strokeStyle: ds.borderColor,
                    lineWidth: 0, hidden: !chart.getDatasetMeta(i).visible, datasetIndex: i,
                  }));
              },
            },
          },
          tooltip: {
            mode: "index" as const, intersect: false,
            backgroundColor: "rgba(15,23,42,0.92)",
            titleColor: "#e2e8f0", bodyColor: "#cbd5e1",
            borderColor: "rgba(255,255,255,0.12)", borderWidth: 1, padding: 10,
            titleFont: { size: 11, weight: "bold" as const },
            bodyFont: { size: 10 },
            callbacks: {
              title: (items) => `N = ${(items[0].raw as any).x} registros`,
              label: (item) => {
                const lbl = item.dataset.label as string;
                if (lbl.startsWith("__ext__")) return null as any;
                return `  ${lbl}: ${((item.raw as any).y as number).toFixed(1)} spp`;
              },
            },
          },
        },
        scales: {
          x: {
            type: "linear" as const, min: 0, max: Math.ceil(maxN * 1.15),
            title: { display: true, text: "Tamanho da amostra (N registros)", font: { size: 11, weight: "600" as const, family: "system-ui, sans-serif" }, color: "#475569", padding: { top: 6 } },
            ticks: { font: { size: 10 }, color: "#64748b", maxTicksLimit: 8 },
            grid: { color: "#f1f5f9", lineWidth: 1 },
            border: { color: "#e2e8f0" },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Riqueza esperada  E[S(n)]", font: { size: 11, weight: "600" as const, family: "system-ui, sans-serif" }, color: "#475569", padding: { bottom: 6 } },
            ticks: { font: { size: 10 }, color: "#64748b", maxTicksLimit: 8 },
            grid: { color: "#f1f5f9", lineWidth: 1 },
            border: { color: "#e2e8f0", dash: [4, 4] },
          },
        },
      },
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [seriesKey]);

  return (
    <div className="relative h-full" data-chart-title={`Curvas de Rarefação por ${groupBy === "ua" ? "Unidade Amostral" : "Campanha"}`}>
      {series.length > 0 && (
        <div className="absolute top-0 right-0 z-10">
          <ChartDownloadBtn canvasRef={ref} name="rarefacao" />
        </div>
      )}
      {!series.length && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Sigma className="w-8 h-8 opacity-20" />
          <p className="text-xs">Sem dados com nome científico</p>
        </div>
      )}
      <canvas ref={ref} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

// ── RarefStatsTable — tabela científica de suficiência amostral ───────────────
function RarefStatsTable({ series, nMin }: { series: RarefactionSeries[]; nMin: number }) {
  const rows = series.filter(s => s.stats).map(s => s.stats!);
  if (!rows.length) return null;

  const hasnMin = nMin > 0 && rows.some(r => r.rarefN !== null);

  function CovBar({ pct }: { pct: number }) {
    const color = pct >= 85 ? "#16a34a" : pct >= 70 ? "#d97706" : "#dc2626";
    return (
      <div className="flex items-center gap-1.5 min-w-[80px]">
        <div className="flex-1 rounded-full h-1.5 bg-black/10">
          <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
        </div>
        <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border-t">
      <table className="w-full text-[11px] font-mono">
        <thead>
          <tr className="border-b bg-slate-50 text-slate-500 text-[10px] font-semibold tracking-wide">
            <th className="px-3 py-1.5 text-left font-sans">Grupo</th>
            <th className="px-2 py-1.5 text-right">N</th>
            <th className="px-2 py-1.5 text-right">Sobs</th>
            {hasnMin && <th className="px-2 py-1.5 text-right text-violet-600" title={`E[S] na amostra padronizada N=${nMin}`}>E[S(N<sub>{nMin}</sub>)]</th>}
            <th className="px-2 py-1.5 text-right text-sky-700" title="Estimador Chao1 (Chao 1984) ± EP">Chao1 ± EP</th>
            <th className="px-2 py-1.5 text-right text-emerald-700" title="ACE — Abundance-based Coverage Estimator (Chao & Lee 1992)">ACE</th>
            <th className="px-2 py-1.5 text-right text-amber-700" title="Cobertura de Good (1953): 1 − f₁/N">Good's C</th>
            <th className="px-3 py-1.5 text-left" title="Completude amostral: Sobs / Chao1 (%)">Completude</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(r => (
            <tr key={r.label} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-3 py-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: r.color }} />
                  <span className="font-sans font-medium text-[11px] text-slate-700 truncate max-w-[120px]" title={r.label}>{r.label}</span>
                </span>
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{r.n}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-slate-800">{r.sobs}</td>
              {hasnMin && (
                <td className="px-2 py-1.5 text-right tabular-nums text-violet-700 font-semibold">
                  {r.rarefN !== null ? r.rarefN.toFixed(1) : <span className="text-slate-300">—</span>}
                </td>
              )}
              <td className="px-2 py-1.5 text-right tabular-nums text-sky-800">
                {r.chao1.toFixed(1)}{r.chao1se > 0 && <span className="text-slate-400 font-normal"> ±{r.chao1se.toFixed(1)}</span>}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-emerald-800">{r.ace.toFixed(1)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-amber-800">{(r.goodsCoverage * 100).toFixed(1)}%</td>
              <td className="px-3 py-1.5"><CovBar pct={r.completeness} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-1.5 flex flex-wrap gap-3 text-[9px] text-slate-400 font-sans border-t bg-slate-50/60">
        <span><span className="font-semibold text-violet-600">E[S(Nmin)]</span> — rarefação padronizada (Hurlbert 1971)</span>
        <span><span className="font-semibold text-sky-600">Chao1</span> — estimador não-paramétrico f₁²/(2f₂) + Sobs (Chao 1984)</span>
        <span><span className="font-semibold text-emerald-600">ACE</span> — Abundance-based Coverage Estimator (Chao &amp; Lee 1992)</span>
        <span><span className="font-semibold text-amber-600">Good's C</span> — 1 − f₁/N (Good 1953)</span>
        <span><span className="font-semibold">Completude</span> = Sobs/Chao1 × 100%</span>
      </div>
    </div>
  );
}

// ── Hill numbers profile — vegan::renyi scales ────────────────────────────────
// Matches R: renyi(bd, scales=c(0,.25,.5,1,2,4,8,16,32,64,Inf), hill=TRUE)
const HILL_Q_SCALES = [0, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, Infinity] as const;
const HILL_Q_LABELS = ["0", "0.25", "0.5", "1", "2", "4", "8", "16", "32", "64", "∞"];

// Named q positions for annotations
const HILL_NAMED: { idx: number; label: string; color: string; bg: string }[] = [
  { idx: 0,  label: "Riqueza (S)",      color: "#0099a8", bg: "#cffafe" },
  { idx: 3,  label: "Shannon exp(H')",  color: "#ea580c", bg: "#ffedd5" },
  { idx: 4,  label: "Simpson (1/D)",    color: "#0e7490", bg: "#cffafe" },
  { idx: 10, label: "Berger-Parker",    color: "#c2410c", bg: "#fed7aa" },
];

interface HillPoint { q: number; D: number }
interface HillSeries { label: string; color: string; points: HillPoint[] }

/**
 * Compute Hill diversity series at vegan renyi scales with hill=TRUE.
 * D(0)=Sobs | D(q→1)=exp(H') | D(2)=1/ΣpΙ² | D(∞)=1/max(pᵢ)
 * General: (Σpᵢ^q)^(1/(1−q))
 */
function computeHillProfile(counts: number[]): HillPoint[] {
  const pos = counts.filter(c => c > 0);
  if (!pos.length) return [];
  const N = pos.reduce((s, c) => s + c, 0);
  const Sobs = pos.length;
  const props = pos.map(c => c / N);
  return HILL_Q_SCALES.map(q => {
    let D: number;
    if (q === 0) {
      D = Sobs;
    } else if (q === Infinity) {
      D = 1 / Math.max(...props);           // Berger-Parker reciprocal
    } else if (Math.abs(q - 1) < 1e-9) {
      const H = -props.reduce((s, p) => s + p * Math.log(p), 0);
      D = Math.exp(H);
    } else {
      const sumPq = props.reduce((s, p) => s + Math.pow(p, q), 0);
      D = Math.pow(sumPq, 1 / (1 - q));
    }
    return { q, D: Math.max(0, D) };
  });
}

function buildHillSeries(registros: CampoRegistro[], groupFn: (r: CampoRegistro) => string | null | undefined, groups: string[]): HillSeries[] {
  return groups.slice(0, 10).flatMap((g, gi) => {
    const recs = registros.filter(r => groupFn(r)?.trim() === g || (!groupFn(r)?.trim() && g === "(todos)"));
    const spCounts: Record<string, number> = {};
    recs.forEach(r => {
      const sp = r.nomeCientifico?.trim().toUpperCase();
      if (sp) spCounts[sp] = (spCounts[sp] || 0) + 1;
    });
    const counts = Object.values(spCounts);
    if (!counts.length) return [];
    return [{ label: g, color: RAREF_COLORS[gi % RAREF_COLORS.length], points: computeHillProfile(counts) }];
  });
}

function HillProfileChart({ series }: { series: HillSeries[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const key = series.map(s => s.label + ":" + s.points.map(p => p.D.toFixed(2)).join(",")).join("|");
  const prevKey = useRef("");

  useEffect(() => {
    if (!ref.current) return;
    if (prevKey.current === key && chartRef.current) return;
    prevKey.current = key;
    chartRef.current?.destroy();
    if (!series.length) { chartRef.current = null; return; }

    const ctx = ref.current.getContext("2d")!;

    // Build gradient fills per series
    const canvasH = ref.current.offsetHeight || 320;
    const datasets = series.map((s, i) => {
      const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
      grad.addColorStop(0, s.color + "40");
      grad.addColorStop(0.7, s.color + "10");
      grad.addColorStop(1, s.color + "00");
      return {
        label: s.label,
        data: s.points.map(p => p.D),
        borderColor: s.color,
        backgroundColor: grad,
        tension: 0.42,
        pointRadius: 3.5,
        pointHoverRadius: 7,
        pointBackgroundColor: s.color,
        pointBorderColor: "#fff",
        pointBorderWidth: 1.5,
        pointHoverBackgroundColor: s.color,
        borderWidth: 2.5,
        fill: true,
        hidden: hidden.has(i),
      };
    });

    // Custom plugins
    // 1) Named-q vertical annotations + top labels — badges em "lane" reservada acima do gráfico
    const namedQPlugin = {
      id: "namedQ",
      afterDraw(chart: any) {
        const { ctx: c, scales: { x, y } } = chart;
        HILL_NAMED.forEach(({ idx, label, color }) => {
          const xPx = x.getPixelForValue(idx);
          if (xPx < x.left || xPx > x.right) return;
          c.save();
          c.setLineDash([4, 3]);
          c.strokeStyle = color + "70";
          c.lineWidth = 1.1;
          c.beginPath();
          c.moveTo(xPx, y.top);
          c.lineTo(xPx, y.bottom);
          c.stroke();
          c.setLineDash([]);
          // Badge no topo — agora dentro da lane de 28px reservada via padding.top
          c.font = "600 9px system-ui, sans-serif";
          const tw = c.measureText(label).width;
          const bw = tw + 10, bh = 16;
          const bx = xPx - bw / 2, by = y.top - bh - 4;
          c.fillStyle = "#ffffff";
          c.strokeStyle = color;
          c.lineWidth = 1;
          c.beginPath();
          c.roundRect(bx, by, bw, bh, 4);
          c.fill(); c.stroke();
          c.fillStyle = color;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(label, xPx, by + bh / 2 + 0.5);
          c.restore();
        });
      },
    };

    // 2) End-of-curve labels at q=∞ — pílula com fundo branco
    const endLabelsPlugin = {
      id: "hillEndLabels",
      afterDatasetsDraw(chart: any) {
        const c = chart.ctx as CanvasRenderingContext2D;
        // Coleta posições para evitar sobreposição vertical
        const items: { y: number; lbl: string; color: string; x: number }[] = [];
        chart.data.datasets.forEach((ds: any, i: number) => {
          const meta = chart.getDatasetMeta(i);
          if (!meta.visible || !meta.data.length) return;
          const last = meta.data[meta.data.length - 1];
          if (!last) return;
          const { x, y } = last.getProps(["x", "y"], true);
          // Mostra apenas índice quando há muitas séries (badge numerado)
          const lbl = chart.data.datasets.length > 4 ? String(i + 1) : (ds.label.length > 14 ? ds.label.slice(0, 12) + "…" : ds.label);
          items.push({ x, y, lbl, color: ds.borderColor as string });
        });
        // Ordena por y e empurra colisões
        items.sort((a, b) => a.y - b.y);
        const minGap = 12;
        for (let i = 1; i < items.length; i++) {
          if (items[i].y - items[i-1].y < minGap) items[i].y = items[i-1].y + minGap;
        }
        items.forEach(({ x, y, lbl, color }) => {
          c.save();
          c.font = "600 9px system-ui, sans-serif";
          const tw = c.measureText(lbl).width;
          const bw = tw + 8, bh = 14;
          const bx = x + 5, by = y - bh / 2;
          c.fillStyle = "#ffffff";
          c.strokeStyle = color;
          c.lineWidth = 1;
          c.beginPath();
          c.roundRect(bx, by, bw, bh, 3);
          c.fill(); c.stroke();
          c.fillStyle = color;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(lbl, bx + bw / 2, by + bh / 2 + 0.5);
          c.restore();
        });
      },
    };

    chartRef.current = new Chart(ctx, {
      type: "line",
      plugins: [namedQPlugin, endLabelsPlugin],
      data: {
        labels: HILL_Q_LABELS,
        datasets,
      },
      options: {
        animation: false as any,
        responsive: true,
        maintainAspectRatio: false,
        // Lane superior de 32px reservada para badges (Riqueza/Shannon/Simpson/Berger-Parker)
        // Lane direita de 70px para labels de fim de curva
        layout: { padding: { right: 70, top: 36, bottom: 6, left: 4 } },
        plugins: {
          legend: {
            display: series.length > 1,
            position: "bottom" as const,
            align: "center" as const,
            labels: {
              boxWidth: 14,
              boxHeight: 3,
              padding: 8,
              usePointStyle: false,
              font: { size: 11, weight: 500 as const },
              color: "#334155",
            },
          },
          tooltip: {
            mode: "index" as const, intersect: false,
            backgroundColor: "rgba(15,23,42,0.92)",
            titleColor: "#e2e8f0", bodyColor: "#cbd5e1",
            borderColor: "rgba(255,255,255,0.1)", borderWidth: 1, padding: 10,
            titleFont: { size: 11, weight: "bold" as const },
            bodyFont: { size: 10 },
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                const named = HILL_NAMED.find(n => n.idx === idx);
                const q = HILL_Q_LABELS[idx];
                return named ? `a = ${q}  —  ${named.label}` : `a = ${q}`;
              },
              label: (item) => `  ${item.dataset.label}: ${(item.raw as number).toFixed(2)}`,
            },
          },
        },
        scales: {
          x: {
            type: "category" as const,
            title: {
              display: true,
              text: "Parâmetro a (escala de Hill)",
              font: { size: 11, weight: "600" as const, family: "system-ui, sans-serif" },
              color: "#475569", padding: { top: 6 },
            },
            ticks: { font: { size: 10 }, color: "#64748b", maxRotation: 0 },
            grid: { color: "#f1f5f9", lineWidth: 1 },
            border: { color: "#e2e8f0" },
          },
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: "ᵃD  (Número de Hill)",
              font: { size: 11, weight: "600" as const, family: "system-ui, sans-serif" },
              color: "#475569", padding: { bottom: 6 },
            },
            ticks: { font: { size: 10 }, color: "#64748b", maxTicksLimit: 8 },
            grid: { color: "#f1f5f9", lineWidth: 1 },
            border: { color: "#e2e8f0" },
          },
        },
      },
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [key]);

  return (
    <div className="flex flex-col gap-3 h-full" data-chart-title="Série de Hill (renyi, hill=TRUE)">
      <div className="relative flex-1 min-h-0">
        <div className="absolute top-0 right-0 z-10"><ChartDownloadBtn canvasRef={ref} name="serie_hill" /></div>
        <canvas ref={ref} style={{ height: "100%", width: "100%" }} />
      </div>
    </div>
  );
}

// ── IndVal — Valor Indicador (Dufrêne & Legendre 1997) ─────────────────────────
interface IndValRow { species: string; group: string; indval: number; A: number; B: number }

function computeIndVal(
  registros: CampoRegistro[],
  groupFn: (r: CampoRegistro) => string | null | undefined,
): IndValRow[] {
  const groups = [...new Set(registros.map(r => groupFn(r)?.trim()).filter(Boolean) as string[])];
  const species = [...new Set(registros.map(r => r.nomeCientifico?.trim().toUpperCase()).filter(Boolean) as string[])];
  if (groups.length < 2 || !species.length) return [];

  // group → site → sp → count
  const groupSites: Record<string, Record<string, Record<string, number>>> = {};
  registros.forEach(r => {
    const g = groupFn(r)?.trim();
    const sp = r.nomeCientifico?.trim().toUpperCase();
    const site = r.unidadeAmostral?.trim() || String(r.id ?? Math.random());
    if (!g || !sp) return;
    if (!groupSites[g]) groupSites[g] = {};
    if (!groupSites[g][site]) groupSites[g][site] = {};
    groupSites[g][site][sp] = (groupSites[g][site][sp] || 0) + 1;
  });

  const results: IndValRow[] = [];
  for (const sp of species) {
    const meanAbund: Record<string, number> = {};
    for (const g of groups) {
      const sites = Object.values(groupSites[g] || {});
      const tot = sites.reduce((s, sc) => s + (sc[sp] || 0), 0);
      meanAbund[g] = sites.length > 0 ? tot / sites.length : 0;
    }
    const totalMean = Object.values(meanAbund).reduce((s, v) => s + v, 0);
    if (totalMean === 0) continue;

    let bestGroup = "";
    let bestIndVal = 0;
    let bestA = 0;
    let bestB = 0;
    for (const g of groups) {
      const A = meanAbund[g] / totalMean;
      const sites = Object.values(groupSites[g] || {});
      const sitesWithSp = sites.filter(sc => (sc[sp] || 0) > 0).length;
      const B = sites.length > 0 ? sitesWithSp / sites.length : 0;
      const iv = A * B * 100;
      if (iv > bestIndVal) { bestIndVal = iv; bestGroup = g; bestA = A; bestB = B; }
    }
    if (bestIndVal > 0) results.push({ species: sp, group: bestGroup, indval: bestIndVal, A: bestA, B: bestB });
  }
  return results.sort((a, b) => b.indval - a.indval).slice(0, 30);
}

// Gráfico de barras horizontais — IndVal por espécie, colorido por grupo preferencial
function IndValChart({ rows }: { rows: IndValRow[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const key = rows.map(r => `${r.species}:${r.indval.toFixed(1)}:${r.group}`).join("|");

  useEffect(() => {
    if (!ref.current || !rows.length) return;
    const ctx = ref.current.getContext("2d");
    if (!ctx) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const top = rows.slice(0, 15);
    const groups = [...new Set(top.map(r => r.group))];
    const groupColorMap: Record<string, string> = {};
    groups.forEach((g, i) => { groupColorMap[g] = ECO_PALETTE[i % ECO_PALETTE.length]; });

    const labels = top.map(r => formatSpeciesName(r.species));
    const data = top.map(r => r.indval);
    const colors = top.map(r => groupColorMap[r.group]);

    chartRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "IndVal (%)",
          data,
          backgroundColor: colors,
          borderColor: colors.map(c => c),
          borderWidth: 0,
          borderRadius: 3,
        }],
      },
      options: {
        indexAxis: "y" as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: groups.length > 1,
            position: "bottom" as const,
            labels: {
              generateLabels: () => groups.map(g => ({
                text: g,
                fillStyle: groupColorMap[g],
                strokeStyle: groupColorMap[g],
                lineWidth: 0,
                hidden: false,
                index: 0,
              })),
              font: { size: 10 },
              boxWidth: 12,
              padding: 8,
            },
            title: { display: true, text: "Grupo Preferencial", font: { size: 10, weight: "bold" as const } },
          },
          title: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const r = top[ctx.dataIndex];
                return [
                  `IndVal: ${r.indval.toFixed(1)}%`,
                  `Grupo: ${r.group}`,
                  `A (abundância): ${(r.A * 100).toFixed(0)}%`,
                  `B (fidelidade): ${(r.B * 100).toFixed(0)}%`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            max: Math.ceil(Math.max(...data, 100) / 10) * 10,
            title: { display: true, text: "Índice de Valor Indicador (IndVal %)", font: { size: 10 } },
            ticks: { font: { size: 10 } },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
          y: {
            ticks: {
              font: { size: 10, style: "italic" as const },
              autoSkip: false,
            },
            grid: { display: false },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [key, rows]);

  if (!rows.length) return (
    <div className="px-3 pt-3 pb-3 border-b border-border/40 bg-gradient-to-b from-orange-50/30 to-transparent">
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
        Top 15 espécies indicadoras · barras coloridas por grupo preferencial
      </div>
      <div className="flex flex-col items-center justify-center py-8 px-4 rounded-lg border-2 border-dashed border-orange-200 bg-white/60 text-center gap-1.5">
        <span className="text-2xl">📊</span>
        <p className="text-xs font-medium text-slate-700">Sem dados para calcular IndVal</p>
        <p className="text-[10px] text-muted-foreground max-w-md leading-relaxed">
          O Índice de Valor Indicador requer <strong>pelo menos 2 grupos</strong> (campanhas ou unidades amostrais) e espécies com nome científico preenchido. Verifique se há mais de uma campanha/UA nos registros filtrados.
        </p>
      </div>
    </div>
  );
  return (
    <div className="relative px-3 pt-3 pb-2 border-b border-border/40 bg-gradient-to-b from-orange-50/30 to-transparent">
      <div className="absolute top-2 right-2 z-10"><ChartDownloadBtn canvasRef={ref} name="indval" /></div>
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
        Top 15 espécies indicadoras · barras coloridas por grupo preferencial
      </div>
      <div style={{ height: Math.max(280, Math.min(15, rows.length) * 26) }}>
        <canvas ref={ref} />
      </div>
    </div>
  );
}

// ── CategoryDistChart — barras horizontais para categorias ecológicas ──────────
function CategoryDistChart({ registros, field, label, Icon }: {
  registros: CampoRegistro[];
  field: keyof CampoRegistro;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    registros.forEach(r => {
      const raw = (r[field] as string | null | undefined)?.trim();
      if (!raw) return;
      // Split semicolon-separated values (some fields allow multiple)
      raw.split(/[;,/]/).map(s => s.trim()).filter(Boolean).forEach(v => {
        const norm = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
        m[norm] = (m[norm] || 0) + 1;
      });
    });
    return Object.entries(m).sort(([,a],[,b]) => b - a).slice(0, 12);
  }, [registros, field]);

  const key = counts.map(([k,v]) => `${k}:${v}`).join("|");

  useEffect(() => {
    if (!ref.current) return;
    chartRef.current?.destroy();
    if (!counts.length) { chartRef.current = null; return; }
    const ctx = ref.current.getContext("2d")!;
    chartRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: counts.map(([k]) => k),
        datasets: [{
          label: "Registros",
          data: counts.map(([,v]) => v),
          backgroundColor: counts.map((_, i) => ECO_PALETTE[i % ECO_PALETTE.length]),
          borderWidth: 0,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: "y" as const,
        responsive: true,
        maintainAspectRatio: false,
        animation: false as any,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15,23,42,0.92)",
            titleColor: "#e2e8f0", bodyColor: "#cbd5e1",
            padding: 8,
            callbacks: { label: (it: any) => `${it.parsed.x} registro(s)` },
          },
        },
        scales: {
          x: { beginAtZero: true, ticks: { font: { size: 9 }, color: "#64748b", precision: 0 }, grid: { color: "#f1f5f9" } },
          y: { ticks: { font: { size: 10, weight: "500" as const }, color: "#334155", autoSkip: false }, grid: { display: false } },
        },
      },
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [key]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold flex items-center gap-2 text-slate-700">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-orange-50 to-teal-50 border border-orange-100/60">
            <Icon className="w-3.5 h-3.5 text-orange-600" />
          </span>
          {label}
          <span className="ml-auto text-[10px] font-normal text-muted-foreground tabular-nums">{counts.length} categoria(s)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0 relative">
        {counts.length > 0 && (
          <div className="absolute top-1 right-1 z-10"><ChartDownloadBtn canvasRef={ref} name={`dist_${String(field)}`} /></div>
        )}
        {counts.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-[11px] text-muted-foreground">
            Coluna {label} não preenchida nos registros
          </div>
        ) : (
          <div style={{ height: Math.max(180, counts.length * 22 + 30) }}>
            <canvas ref={ref} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DataQualityCard — Auditoria de qualidade dos registros
// ─────────────────────────────────────────────────────────────────────────────
function DataQualityCard({ registros }: { registros: CampoRegistro[] }) {
  const stats = useMemo(() => {
    const total = registros.length;
    if (!total) return null;
    let semGps = 0, semNome = 0, semCampanha = 0, semUa = 0;
    let implausPeso = 0, implausComp = 0, gpsZero = 0;

    registros.forEach(r => {
      const lat = parseFloat((r.latitude as any) || "");
      const lon = parseFloat((r.longitude as any) || "");
      const hasGps = isFinite(lat) && isFinite(lon) && (lat !== 0 || lon !== 0);
      if (!hasGps) semGps++;
      if (isFinite(lat) && isFinite(lon) && lat === 0 && lon === 0) gpsZero++;
      if (!r.nomeCientifico?.trim()) semNome++;
      if (!r.campanha?.trim()) semCampanha++;
      if (!r.unidadeAmostral?.trim()) semUa++;

      const peso = parseFloat((r.pesoG as any) || "");
      if (isFinite(peso) && peso <= 0) implausPeso++;
      const ct = parseFloat((r.ctMm as any) || "");
      // > 2 metros é implausível para a maioria; ajuste conforme grupo
      if (isFinite(ct) && (ct < 0 || ct > 2000)) implausComp++;
    });

    const pct = (n: number) => Math.round((n / total) * 100);
    // Pesos redistribuídos após remoção de "Sem foto" (cada linha = 1 indivíduo, foto é opcional)
    const score = Math.max(0, 100 - (
      pct(semGps) * 0.30 + pct(semNome) * 0.35 +
      pct(semCampanha) * 0.10 + pct(semUa) * 0.15 +
      pct(implausPeso) * 0.05 + pct(implausComp) * 0.05
    ));
    return { total, semGps, semNome, semCampanha, semUa, implausPeso, implausComp, gpsZero, score, pct };
  }, [registros]);

  if (!stats) return null;
  const { total, semGps, semNome, semCampanha, semUa, implausPeso, implausComp, score, pct } = stats;
  const scoreColor = score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600";
  const scoreBg    = score >= 80 ? "from-emerald-50 to-teal-50 border-emerald-200" : score >= 60 ? "from-amber-50 to-orange-50 border-amber-200" : "from-red-50 to-orange-50 border-red-200";
  const ItemRow = ({ Icon, label, n, color, hint }: { Icon: any; label: string; n: number; color: string; hint?: string }) => (
    <div className="flex items-center gap-2 text-xs">
      <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} />
      <span className="text-slate-700 flex-1 truncate" title={hint}>{label}</span>
      <span className="tabular-nums font-semibold text-slate-800">{n}</span>
      <span className="tabular-nums text-[10px] text-muted-foreground w-9 text-right">{pct(n)}%</span>
    </div>
  );

  return (
    <Card className={`overflow-hidden bg-gradient-to-br ${scoreBg} border`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-700" />
          Auditoria de Qualidade dos Dados
          <span className="ml-auto text-[10px] text-muted-foreground font-normal">{total} registro(s)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex flex-col items-center justify-center bg-white/70 rounded-lg p-3 border">
            <div className={`text-4xl font-bold tabular-nums ${scoreColor}`}>{score.toFixed(0)}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Score de Qualidade</div>
            <div className="text-[10px] text-slate-600 mt-1 font-medium">
              {score >= 80 ? "Excelente" : score >= 60 ? "Aceitável" : "Crítico — revise os dados"}
            </div>
          </div>
          <div className="bg-white/70 rounded-lg p-2.5 border space-y-1.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Completude</p>
            <ItemRow Icon={MapPinOff} label="Sem GPS" n={semGps} color="text-rose-600" hint="Sem latitude/longitude válidas" />
            <ItemRow Icon={Bird} label="Sem nome científico" n={semNome} color="text-amber-600" />
            <ItemRow Icon={CalendarDays} label="Sem campanha" n={semCampanha} color="text-cyan-600" />
            <ItemRow Icon={MapPin} label="Sem UA" n={semUa} color="text-teal-600" />
          </div>
          <div className="bg-white/70 rounded-lg p-2.5 border space-y-1.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Implausibilidades</p>
            <ItemRow Icon={FileWarning} label="Peso ≤ 0" n={implausPeso} color="text-red-600" />
            <ItemRow Icon={FileWarning} label="CT fora de 0–2000mm" n={implausComp} color="text-red-600" />
            {(semGps + implausPeso + implausComp) === 0 && (
              <div className="text-[10px] text-emerald-700 flex items-center gap-1 pt-1"><CheckCheck className="w-3 h-3" /> Sem inconsistências detectadas</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BoxplotChart — Box-and-whiskers (manual, sem plugin)
// ─────────────────────────────────────────────────────────────────────────────
type BoxStats = { label: string; n: number; min: number; q1: number; median: number; q3: number; max: number; outliers: number[] };
function buildBoxStats(values: number[]): Omit<BoxStats, "label"> | null {
  const v = values.filter(x => isFinite(x)).slice().sort((a, b) => a - b);
  if (v.length < 4) return v.length ? { n: v.length, min: v[0], q1: v[0], median: v[Math.floor(v.length / 2)], q3: v[v.length - 1], max: v[v.length - 1], outliers: [] } : null;
  const quantile = (arr: number[], p: number) => {
    const idx = (arr.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
  };
  const q1 = quantile(v, 0.25);
  const median = quantile(v, 0.5);
  const q3 = quantile(v, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const inside = v.filter(x => x >= lo && x <= hi);
  const outliers = v.filter(x => x < lo || x > hi);
  return { n: v.length, min: inside.length ? inside[0] : v[0], q1, median, q3, max: inside.length ? inside[inside.length - 1] : v[v.length - 1], outliers };
}

function BoxplotChart({ groups, yLabel, title, color = "#0099a8" }: {
  groups: BoxStats[]; yLabel: string; title: string; color?: string;
}) {
  if (!groups.length) return null;
  const W = 600, H = 280, PL = 60, PR = 16, PT = 18, PB = 60;
  const pw = W - PL - PR, ph = H - PT - PB;
  const allVals = groups.flatMap(g => [g.min, g.max, ...g.outliers]);
  const yMin = Math.min(...allVals), yMax = Math.max(...allVals);
  const range = yMax - yMin || 1;
  const yMinPad = yMin - range * 0.05, yMaxPad = yMax + range * 0.05;
  const ySpan = yMaxPad - yMinPad;
  const y = (v: number) => H - PB - (v - yMinPad) / ySpan * ph;
  const groupWidth = pw / groups.length;
  const boxWidth = Math.max(14, Math.min(48, groupWidth * 0.55));
  return (
    <div className="bg-white rounded-lg border p-2">
      <p className="text-xs font-semibold text-slate-700 mb-1 px-1">{title}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[260px]">
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const yv = yMinPad + t * ySpan;
          return <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(yv)} y2={y(yv)} stroke="#e5e7eb" strokeWidth=".7" strokeDasharray="3,3" />
            <text x={PL - 6} y={y(yv) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{yv.toFixed(yv > 100 ? 0 : 1)}</text>
          </g>;
        })}
        <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke="#9ca3af" strokeWidth="1" />
        <line x1={PL} x2={PL} y1={PT} y2={H - PB} stroke="#9ca3af" strokeWidth="1" />
        <text x={16} y={PT + ph / 2} textAnchor="middle" fontSize="10" fill="#475569" transform={`rotate(-90 16 ${PT + ph / 2})`}>{yLabel}</text>
        {groups.map((g, i) => {
          const cx = PL + groupWidth * (i + 0.5);
          const xL = cx - boxWidth / 2, xR = cx + boxWidth / 2;
          const yQ1 = y(g.q1), yQ3 = y(g.q3), yMed = y(g.median);
          return (
            <g key={i}>
              <line x1={cx} x2={cx} y1={y(g.min)} y2={y(g.max)} stroke={color} strokeWidth="1.2" />
              <line x1={xL + 6} x2={xR - 6} y1={y(g.min)} y2={y(g.min)} stroke={color} strokeWidth="1.4" />
              <line x1={xL + 6} x2={xR - 6} y1={y(g.max)} y2={y(g.max)} stroke={color} strokeWidth="1.4" />
              <rect x={xL} y={yQ3} width={boxWidth} height={Math.max(1, yQ1 - yQ3)} fill={color + "33"} stroke={color} strokeWidth="1.4" rx="2" />
              <line x1={xL} x2={xR} y1={yMed} y2={yMed} stroke={color} strokeWidth="2.4" />
              {g.outliers.map((o, oi) => {
                // jitter determinístico (sem Math.random) — estável em re-render e export
                const jitter = ((oi * 9301 + 49297) % 233280) / 233280 - 0.5;
                return (
                  <circle key={oi} cx={cx + jitter * (boxWidth * 0.3)} cy={y(o)} r="2.4" fill="white" stroke={color} strokeWidth="1.1" opacity=".85">
                    <title>Outlier: {o.toFixed(2)}</title>
                  </circle>
                );
              })}
              <text x={cx} y={H - PB + 14} textAnchor="middle" fontSize="9" fill="#475569" transform={groups.length > 6 ? `rotate(35 ${cx} ${H - PB + 14})` : undefined}>
                {g.label.length > 14 ? g.label.slice(0, 12) + "…" : g.label}
              </text>
              <text x={cx} y={H - PB + (groups.length > 6 ? 38 : 26)} textAnchor="middle" fontSize="8" fill="#94a3b8">n={g.n}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IBI — Índice de Integridade Biótica (heurística adaptada de Araújo 1998)
// ─────────────────────────────────────────────────────────────────────────────
type IbiResult = {
  pctNativas: number; pctTolerantes: number; pctOnivoros: number;
  riquezaFamilias: number; riquezaTotal: number; nIndividuos: number;
  scoreNativas: number; scoreTolerantes: number; scoreOnivoros: number; scoreFamilias: number;
  total: number; classification: string; color: string;
};
function computeIBI(registros: CampoRegistro[]): IbiResult | null {
  if (!registros.length) return null;
  const validRecs = registros.filter(r => r.nomeCientifico?.trim());
  if (validRecs.length < 5) return null;

  const isExotic = (r: CampoRegistro) => {
    const orig = ((r as any).origem || "").toLowerCase();
    const dist = (r.distribuicao || "").toLowerCase();
    return orig.includes("exot") || orig.includes("invas") || dist.includes("exót") || dist.includes("invas");
  };
  const isTolerant = (r: CampoRegistro) => {
    const sens = (r.sensibilidade || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const bio = ((r as any).bioindicador || "").toLowerCase();
    return sens === "baixa" || sens.includes("tolerant") || bio.includes("degrad");
  };
  const isOmnivore = (r: CampoRegistro) => {
    const d = (r.dieta || "").toLowerCase();
    return d.includes("onív") || d.includes("oniv") || d.includes("generalist") || d.includes("oportun");
  };

  const nIndividuos = validRecs.length;
  const exoticas = validRecs.filter(isExotic).length;
  const pctNativas = ((nIndividuos - exoticas) / nIndividuos) * 100;
  const pctTolerantes = (validRecs.filter(isTolerant).length / nIndividuos) * 100;
  const pctOnivoros = (validRecs.filter(isOmnivore).length / nIndividuos) * 100;
  const familias = new Set(validRecs.map(r => r.familia).filter(Boolean));
  const especies = new Set(validRecs.map(r => r.nomeCientifico?.trim().toUpperCase()).filter(Boolean));
  const riquezaFamilias = familias.size;
  const riquezaTotal = especies.size;

  // Scoring 0-5-10 (Araújo 1998 adaptado)
  const scoreNativas    = pctNativas >= 90 ? 25 : pctNativas >= 70 ? 15 : 5;
  const scoreTolerantes = pctTolerantes <= 20 ? 25 : pctTolerantes <= 50 ? 15 : 5;
  const scoreOnivoros   = pctOnivoros <= 25 ? 25 : pctOnivoros <= 50 ? 15 : 5;
  const scoreFamilias   = riquezaFamilias >= 10 ? 25 : riquezaFamilias >= 5 ? 15 : 5;
  const total = scoreNativas + scoreTolerantes + scoreOnivoros + scoreFamilias;

  const classification = total >= 85 ? "Excelente" : total >= 65 ? "Bom" : total >= 45 ? "Regular" : total >= 25 ? "Pobre" : "Muito Pobre";
  const color = total >= 85 ? "#16a34a" : total >= 65 ? "#65a30d" : total >= 45 ? "#ca8a04" : total >= 25 ? "#ea580c" : "#dc2626";

  return { pctNativas, pctTolerantes, pctOnivoros, riquezaFamilias, riquezaTotal, nIndividuos, scoreNativas, scoreTolerantes, scoreOnivoros, scoreFamilias, total, classification, color };
}

function IbiCard({ registros }: { registros: CampoRegistro[] }) {
  const ibi = useMemo(() => computeIBI(registros), [registros]);
  if (!ibi) return null;
  const metrics = [
    { label: "% Espécies Nativas",        value: ibi.pctNativas,    score: ibi.scoreNativas,    inverse: false, hint: "Nativas vs exóticas/invasoras" },
    { label: "% Tolerantes à Poluição",   value: ibi.pctTolerantes, score: ibi.scoreTolerantes, inverse: true,  hint: "Quanto menor, melhor a integridade" },
    { label: "% Generalistas Tróficos",   value: ibi.pctOnivoros,   score: ibi.scoreOnivoros,   inverse: true,  hint: "Onívoros e oportunistas" },
    { label: "Riqueza de Famílias",       value: ibi.riquezaFamilias, score: ibi.scoreFamilias, inverse: false, hint: "Maior diversidade familiar = melhor IBI", isCount: true },
  ];
  return (
    <Card className="overflow-hidden border-2" style={{ borderColor: ibi.color + "55" }}>
      <CardHeader className="pb-2 border-b" style={{ backgroundColor: ibi.color + "0d" }}>
        <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
          <Award className="w-4 h-4" style={{ color: ibi.color }} />
          Índice de Integridade Biótica (IBI)
          <Badge style={{ backgroundColor: ibi.color, color: "white" }} className="text-[10px] font-bold">{ibi.classification}</Badge>
          <span className="text-[10px] font-normal text-muted-foreground ml-auto">
            Araújo (1998) adaptado · N={ibi.nIndividuos} · S={ibi.riquezaTotal}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-stretch">
          <div className="md:col-span-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-white rounded-lg border p-3">
            <div className="text-4xl font-bold tabular-nums" style={{ color: ibi.color }}>{ibi.total}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Pontos / 100</div>
            <div className="w-full h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${ibi.total}%`, backgroundColor: ibi.color }} />
            </div>
          </div>
          <div className="md:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {metrics.map(m => {
              const display = m.isCount ? String(m.value) : `${m.value.toFixed(1)}%`;
              const scoreColor = m.score >= 25 ? "#16a34a" : m.score >= 15 ? "#ca8a04" : "#dc2626";
              return (
                <div key={m.label} className="bg-white rounded-lg border p-2.5">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[10px] font-medium text-slate-600 flex-1 leading-tight pr-2">{m.label}</span>
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: scoreColor }}>+{m.score}</span>
                  </div>
                  <div className="text-lg font-bold tabular-nums text-slate-800">{display}</div>
                  <div className="text-[9.5px] text-muted-foreground mt-0.5 leading-tight">{m.hint}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-2.5 text-[10px] text-muted-foreground leading-relaxed bg-slate-50/60 rounded p-2 border">
          <strong className="text-slate-700">Interpretação:</strong> IBI ≥ 85 = Excelente · 65–84 = Bom · 45–64 = Regular · 25–44 = Pobre · &lt; 25 = Muito Pobre. Cada uma das 4 métricas contribui com até 25 pontos. Adaptado de Araújo, F.G. (1998), <em>Adaptação do Índice de Integridade Biótica usando peixes para avaliar a qualidade ambiental de rios</em>. Limites de tolerância variam por bioma — interprete em conjunto com especialista regional.
        </div>
      </CardContent>
    </Card>
  );
}

function IndValTable({ rows }: { rows: IndValRow[] }) {
  if (!rows.length) return (
    <p className="text-center text-muted-foreground text-xs py-6">
      Mínimo 2 grupos para calcular IndVal
    </p>
  );
  const maxIV = rows[0]?.indval ?? 100;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] font-mono">
        <thead>
          <tr className="border-b bg-slate-50 text-slate-500 text-[10px] font-semibold tracking-wide">
            <th className="px-3 py-1.5 text-left font-sans">#</th>
            <th className="px-3 py-1.5 text-left font-sans">Espécie</th>
            <th className="px-2 py-1.5 text-left font-sans">Grupo preferencial</th>
            <th className="px-2 py-1.5 text-right" title="IndVal = A × B × 100 (Dufrêne & Legendre 1997)">IndVal (%)</th>
            <th className="px-2 py-1.5 text-right" title="A = abundância relativa no grupo">A</th>
            <th className="px-2 py-1.5 text-right" title="B = fidelidade (fração de sítios no grupo com a espécie)">B</th>
            <th className="px-3 py-1.5 text-left">Força</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => {
            const pct = (r.indval / maxIV) * 100;
            const color = r.indval >= 70 ? "#16a34a" : r.indval >= 40 ? "#d97706" : "#64748b";
            return (
              <tr key={r.species} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-3 py-1 text-slate-400">{i + 1}</td>
                <td className="px-3 py-1 italic text-slate-800 max-w-[160px] truncate" title={r.species}>{formatSpeciesName(r.species)}</td>
                <td className="px-2 py-1 font-sans text-slate-600 max-w-[110px] truncate" title={r.group}>{r.group}</td>
                <td className="px-2 py-1 text-right font-bold tabular-nums" style={{ color }}>{r.indval.toFixed(1)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-500">{(r.A * 100).toFixed(0)}%</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-500">{(r.B * 100).toFixed(0)}%</td>
                <td className="px-3 py-1">
                  <div className="flex items-center gap-1 min-w-[60px]">
                    <div className="flex-1 h-1.5 rounded-full bg-black/10">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-3 py-1.5 text-[9px] text-slate-400 border-t bg-slate-50/60">
        IndVal = A × B × 100 (Dufrêne &amp; Legendre 1997)  ·  A = abundância relativa no grupo  ·  B = fidelidade (frequência relativa de sítios)  ·  Top 30 espécies por IndVal decrescente
      </div>
    </div>
  );
}

// ── CampanhaProgressChart — novas espécies por campanha ──────────────────────
function CampanhaProgressChart({ data }: { data: CampanhaProgress[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const key = data.map(d => d.camp + d.novaSp).join("|");

  useEffect(() => {
    if (!ref.current || !data.length) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      data: {
        labels: data.map(d => d.camp.length > 18 ? d.camp.slice(0, 16) + "…" : d.camp),
        datasets: [
          {
            type: "bar" as const,
            label: "Novas espécies",
            data: data.map(d => d.novaSp),
            backgroundColor: "#0099a8cc",
            borderRadius: 4,
            yAxisID: "y",
            order: 2,
          },
          {
            type: "bar" as const,
            label: "Exclusivas",
            data: data.map(d => d.exclusivaSp),
            backgroundColor: "#ea580ccc",
            borderRadius: 4,
            yAxisID: "y",
            order: 2,
          },
          {
            type: "line" as const,
            label: "Spp acumuladas",
            data: data.map(d => d.cumSp),
            borderColor: "#0e7490",
            backgroundColor: "#0e749022",
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 7,
            fill: false,
            yAxisID: "y2",
            order: 1,
            borderWidth: 2.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" as const, labels: { font: { size: 10 }, boxWidth: 14 } },
          tooltip: {
            mode: "index" as const, intersect: false,
            callbacks: {
              afterBody: (items) => {
                const i = items[0].dataIndex;
                return [`  Sobs (campanha): ${data[i].Sobs}`, `  N registros: ${data[i].N}`];
              },
            },
          },
        },
        scales: {
          x: { ticks: { font: { size: 10 }, maxRotation: 40 }, grid: { display: false }, title: { display: true, text: "Campanha", font: { size: 10 } } },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Espécies (barra)", font: { size: 10 } },
            position: "left" as const,
          },
          y2: {
            beginAtZero: true,
            title: { display: true, text: "Spp acumuladas (linha)", font: { size: 10 } },
            position: "right" as const,
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [key]);

  return (
    <div className="relative h-full" data-chart-title="Progresso de Descoberta de Espécies por Campanha">
      <div className="absolute top-1 right-1 z-10">
        <ChartDownloadBtn canvasRef={ref} name="progresso_campanhas" />
      </div>
      <canvas ref={ref} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

// ── GruposByCampanhaChart — composição taxonômica por campanha ────────────────
function GruposByCampanhaChart({ data }: { data: GrupoByCamp[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const key = data.map(d => d.camp).join("|");

  useEffect(() => {
    if (!ref.current || !data.length) return;
    chartRef.current?.destroy();

    // Collect all unique grupos
    const allGrupos = [...new Set(data.flatMap(d => Object.keys(d.grupos)))].sort();
    const datasets = allGrupos.map((g) => {
      const cfg = GRUPO_CONFIG[g];
      const { color } = resolveGrupoColor(g);
      const label = cfg?.label || g.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      return {
        label,
        data: data.map(d => d.grupos[g] ?? 0),
        backgroundColor: color + "cc",
        borderColor: color,
        borderWidth: 1,
        borderRadius: 3,
      };
    });

    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "bar",
      data: {
        labels: data.map(d => d.camp.length > 18 ? d.camp.slice(0, 16) + "…" : d.camp),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" as const, labels: { font: { size: 10 }, boxWidth: 12 } },
          tooltip: { mode: "index" as const, intersect: false },
        },
        scales: {
          x: { stacked: true, ticks: { font: { size: 10 }, maxRotation: 40 }, grid: { display: false }, title: { display: true, text: "Campanha", font: { size: 10 } } },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: "Nº de Registros", font: { size: 10 } } },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [key]);

  return (
    <div className="relative h-full" data-chart-title="Grupos Taxonômicos por Campanha">
      <div className="absolute top-1 right-1 z-10">
        <ChartDownloadBtn canvasRef={ref} name="grupos_por_campanha" />
      </div>
      <canvas ref={ref} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

// ── SensibilidadeChart — distribuição de sensibilidade ambiental ─────────────
const SENSIB_COLORS: Record<string, { bar: string; bg: string; text: string; border: string }> = {
  Alta:  { bar: "#c2410c", bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
  Média: { bar: "#ea580c", bg: "bg-orange-50",  text: "text-orange-700", border: "border-orange-200" },
  Baixa: { bar: "#0099a8", bg: "bg-cyan-50",    text: "text-cyan-800",   border: "border-cyan-200" },
};
const SENSIB_DEFAULT = { bar: "#6b7280", bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" };

function SensibilidadeChart({ data }: { data: { label: string; abundancia: number; riqueza: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const total = data.reduce((s, d) => s + d.riqueza, 0);

  useEffect(() => {
    if (!ref.current || !data.length) return;
    chartRef.current?.destroy();
    const colors = data.map(d => (SENSIB_COLORS[d.label] ?? SENSIB_DEFAULT).bar);
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "doughnut",
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.riqueza),
          backgroundColor: colors.map(c => c + "cc"),
          borderColor: colors,
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 11 }, padding: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const d = data[ctx.dataIndex];
                const pct = total > 0 ? ((d.riqueza / total) * 100).toFixed(1) : "0.0";
                return [`  ${d.riqueza} spp (${pct}%)`, `  ${d.abundancia} registros`];
              },
            },
          },
        },
      },
      plugins: [{
        id: "center-text",
        afterDraw(chart) {
          const { ctx, chartArea } = chart;
          if (!chartArea) return;
          const cx = (chartArea.left + chartArea.right) / 2;
          const cy = (chartArea.top + chartArea.bottom) / 2;
          ctx.save();
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.font = "bold 22px Inter, sans-serif"; ctx.fillStyle = "#0f172a";
          ctx.fillText(String(total), cx, cy - 8);
          ctx.font = "11px Inter, sans-serif"; ctx.fillStyle = "#64748b";
          ctx.fillText("spp", cx, cy + 12);
          ctx.restore();
        },
      }],
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data]);

  if (!data.length) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
      <ShieldAlert className="w-7 h-7 opacity-20" />
      <p className="text-xs">Campo "Sensibilidade" não preenchido nos registros</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Badges de resumo */}
      <div className="flex gap-2 flex-wrap">
        {data.map(d => {
          const c = SENSIB_COLORS[d.label] ?? SENSIB_DEFAULT;
          return (
            <div key={d.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${c.bg} ${c.border}`}>
              <div className="w-2 h-2 rounded-full" style={{ background: (SENSIB_COLORS[d.label] ?? SENSIB_DEFAULT).bar }} />
              <span className={`text-[11px] font-semibold ${c.text}`}>{d.label}</span>
              <span className={`text-[11px] font-bold ${c.text}`}>{d.riqueza} spp</span>
              <span className={`text-[10px] opacity-70 ${c.text}`}>· {d.abundancia} reg.</span>
            </div>
          );
        })}
      </div>
      {/* Donut */}
      <div className="flex-1 min-h-0 relative">
        <canvas ref={ref} style={{ width: "100%", height: "100%" }} />
        <div className="absolute top-0 right-0"><ChartDownloadBtn canvasRef={ref} name="sensibilidade" /></div>
      </div>
    </div>
  );
}

// ── HeatmapChart — grade colorida de contagens / riqueza / presença-ausência ───
type HeatMetric = "count" | "richness" | "pa";

const HEAT_PALETTE: Record<HeatMetric, (t: number) => string> = {
  count:    t => t === 0 ? "#f8fafc" : t < 0.25 ? `hsl(20,80%,${90 - t*30}%)`  : t < 0.6 ? `hsl(20,85%,${75 - t*30}%)`  : `hsl(20,90%,${55 - (t-0.6)*30}%)`,
  richness: t => t === 0 ? "#f8fafc" : t < 0.3 ? `hsl(186,70%,${88 - t*35}%)` : t < 0.7 ? `hsl(186,80%,${68 - t*25}%)` : `hsl(186,90%,${40 - (t-0.7)*30}%)`,
  pa:       t => t === 0 ? "#f8fafc" : "#0099a8",
};
const HEAT_LABEL: Record<HeatMetric, string> = {
  count:    "abundância (registros)",
  richness: "riqueza (spp)",
  pa:       "presença/ausência",
};

function HeatmapChart({
  data,
  metric = "count",
  rowLabel = "linha",
  colLabel = "coluna",
}: {
  data: HeatmapData;
  metric?: HeatMetric;
  rowLabel?: string;
  colLabel?: string;
}) {
  if (!data.rows.length || !data.cols.length)
    return <p className="text-center text-muted-foreground text-xs pt-10">Sem dados suficientes</p>;

  const getValue  = (cell: HeatCell | undefined) =>
    metric === "richness" ? (cell?.richness ?? 0) : metric === "pa" ? (cell?.count ? 1 : 0) : (cell?.count ?? 0);
  const maxVal    = Math.max(1, ...data.cells.map(c => getValue(c)));
  const getColor  = HEAT_PALETTE[metric];

  // Dynamic sizing: many rows → smaller cells; few rows → larger
  const cellH = Math.max(18, Math.min(42, Math.floor(520 / Math.max(data.rows.length, 1))));
  const cellW = Math.max(32, Math.min(80, Math.floor(640 / Math.max(data.cols.length, 1))));
  const rowLabelW = 148;

  // Fast lookup
  const cellMap = new Map<string, HeatCell>();
  data.cells.forEach(c => cellMap.set(`${c.row}|${c.col}`, c));

  return (
    <div className="overflow-auto" data-chart-title="Mapa de Calor">
      <div className="flex items-start" style={{ minWidth: cellW * data.cols.length + rowLabelW + 8 }}>
        {/* Row labels */}
        <div className="flex flex-col flex-shrink-0" style={{ marginTop: 30, width: rowLabelW }}>
          {data.rows.map(row => (
            <div key={row} title={row}
              className="flex items-center justify-end pr-2 text-[10px] text-muted-foreground font-medium italic"
              style={{ height: cellH, width: rowLabelW }}>
              <span className="truncate">{row.length > 20 ? row.slice(0, 19) + "…" : row}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          {/* Column headers */}
          <div className="flex">
            {data.cols.map(col => (
              <div key={col} title={col}
                className="text-[9px] text-muted-foreground font-medium text-center"
                style={{ width: cellW, height: 28, lineHeight: "1.1", paddingTop: 4, overflow: "hidden" }}>
                {col.length > 9 ? col.slice(0, 8) + "…" : col}
              </div>
            ))}
          </div>
          {/* Cells */}
          {data.rows.map(row => (
            <div key={row} className="flex">
              {data.cols.map(col => {
                const cell  = cellMap.get(`${row}|${col}`);
                const v     = getValue(cell);
                const t     = v / maxVal;
                const color = getColor(t);
                const label = metric === "pa" ? (v ? "✓" : "") : v > 0 ? String(v) : "";
                return (
                  <div key={col}
                    title={`${row} × ${col}\n${HEAT_LABEL[metric]}: ${metric === "pa" ? (v ? "presente" : "ausente") : v}`}
                    className="border border-white flex items-center justify-center text-[9px] font-semibold cursor-default select-none transition-all hover:opacity-80"
                    style={{ width: cellW, height: cellH, backgroundColor: color, color: t > 0.55 ? "white" : "#374151" }}>
                    {label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-2 px-2 flex-wrap">
        {metric === "pa" ? (
          <>
            <div className="flex items-center gap-1">
              <div className="w-4 h-3 rounded" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }} />
              <span className="text-[9px] text-muted-foreground">ausente</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-3 rounded" style={{ background: "#1d4ed8" }} />
              <span className="text-[9px] text-muted-foreground">presente</span>
            </div>
          </>
        ) : (
          <>
            <span className="text-[9px] text-muted-foreground">0</span>
            <div className="flex h-3 rounded overflow-hidden" style={{ width: 100 }}>
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map(t => (
                <div key={t} style={{ flex: 1, backgroundColor: getColor(t) }} />
              ))}
            </div>
            <span className="text-[9px] text-muted-foreground">{maxVal}</span>
            <span className="text-[9px] text-muted-foreground ml-1">({HEAT_LABEL[metric]})</span>
          </>
        )}
        <span className="text-[9px] text-muted-foreground/50 ml-2">{data.rows.length} {rowLabel}s × {data.cols.length} {colLabel}s</span>
      </div>
    </div>
  );
}

// ── Pool-accumulation curve (analogue of vegan::poolaccum) ────────────────────
// Uses random permutations to compute mean ± 95% CI for Sobs, Jackknife1 and Bootstrap.
// X-axis = sampling effort in days (number of distinct sampled days accumulated).
type AccumPoint = { mean: number; lo: number; hi: number; sd: number };
interface AccumCurveData {
  nDays: number; nPerms: number;
  dates: string[];   // actual sampled dates in chronological order
  labels: string[];  // "Dia 1", "Dia 2", …
  sobs:  AccumPoint[];
  jack1: AccumPoint[];
  boot:  AccumPoint[];
  // final-step values (for AI context + estimator reference)
  sobsFinal: number; jack1Final: number; bootFinal: number;
}

function _fisherYates(arr: number[]): number[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function _permStats(vals: number[]): AccumPoint {
  const n = vals.length;
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  const sd   = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const sorted = vals.slice().sort((a, b) => a - b);
  const lo = sorted[Math.max(0, Math.floor(n * 0.025))];
  const hi = sorted[Math.min(n - 1, Math.floor(n * 0.975))];
  return { mean: Math.round(mean * 10) / 10, sd: Math.round(sd * 10) / 10, lo, hi };
}

function accumulationCurve(registros: CampoRegistro[], nPerms = 1000): AccumCurveData {
  // 1. Distinct sampling days (sorted chronologically) → "sites"
  const days = [...new Set(registros.map(r => r.data).filter(Boolean) as string[])].sort();
  const nDays = days.length;
  const empty: AccumCurveData = {
    nDays: 0, nPerms: 0, dates: [], labels: [],
    sobs: [], jack1: [], boot: [],
    sobsFinal: 0, jack1Final: 0, bootFinal: 0,
  };
  if (nDays < 2) return empty;

  // 2. All species → index map
  const allSp = [...new Set(
    registros.map(r => r.nomeCientifico?.trim().toUpperCase()).filter(Boolean) as string[]
  )];
  const spIdx = new Map(allSp.map((sp, i) => [sp, i]));
  const nSp   = allSp.length;
  if (nSp === 0) return empty;

  // 3. Day × species incidence matrix (Uint8Array for performance)
  const matrix = days.map(day => {
    const row = new Uint8Array(nSp);
    registros
      .filter(r => r.data === day)
      .forEach(r => {
        const sp = r.nomeCientifico?.trim().toUpperCase();
        if (sp && spIdx.has(sp)) row[spIdx.get(sp)!] = 1;
      });
    return row;
  });

  // 4. Permutation loop — O(nPerms × nDays × nSp)
  const sobsPerms:  number[][] = Array.from({ length: nDays }, () => []);
  const jack1Perms: number[][] = Array.from({ length: nDays }, () => []);
  const bootPerms:  number[][] = Array.from({ length: nDays }, () => []);
  const indices = Array.from({ length: nDays }, (_, i) => i);

  for (let p = 0; p < nPerms; p++) {
    const perm = _fisherYates(indices);
    const cnt  = new Uint8Array(nSp); // incidence count per species

    for (let k = 0; k < nDays; k++) {
      const row = matrix[perm[k]];
      for (let s = 0; s < nSp; s++) if (row[s]) cnt[s]++;

      const n = k + 1;
      let Sobs = 0, Q1 = 0, bootSum = 0;
      for (let s = 0; s < nSp; s++) {
        const c = cnt[s];
        if (c > 0) {
          Sobs++;
          if (c === 1) Q1++;
          bootSum += Math.pow(1 - c / n, n);
        }
      }
      const jack1 = Sobs + (n > 1 ? Q1 * (n - 1) / n : Q1);

      sobsPerms[k].push(Sobs);
      jack1Perms[k].push(jack1);
      bootPerms[k].push(Sobs + bootSum);
    }
  }

  // 5. Summarise
  const sobsArr  = sobsPerms.map(_permStats);
  const jack1Arr = jack1Perms.map(_permStats);
  const bootArr  = bootPerms.map(_permStats);

  // Labels: "Dia 1 (dd/mm)", …
  const labels = days.map((d, i) => {
    const parts = d.split(/[-/]/);
    const dateStr = parts.length >= 3
      ? `${parts[2].slice(-2)}/${parts[1]}`
      : d.slice(0, 5);
    return `Dia ${i + 1} · ${dateStr}`;
  });

  return {
    nDays, nPerms, dates: days, labels,
    sobs: sobsArr, jack1: jack1Arr, boot: bootArr,
    sobsFinal:  sobsArr.at(-1)!.mean,
    jack1Final: jack1Arr.at(-1)!.mean,
    bootFinal:  bootArr.at(-1)!.mean,
  };
}
// Frequência relativa (top N + OUTRAS) — port direto do Python
function relativeFrequency(registros: CampoRegistro[], topN = 20): { especie: string; abs: number; pct: number }[] {
  const counts: Record<string, number> = {};
  registros.forEach(r => {
    const sp = r.nomeCientifico?.trim().toUpperCase();
    if (sp) counts[sp] = (counts[sp] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, n]) => s + n, 0);
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const result = top.map(([especie, abs]) => ({ especie, abs, pct: (abs / total) * 100 }));
  if (rest.length > 0) {
    const restAbs = rest.reduce((s, [, n]) => s + n, 0);
    result.push({ especie: "OUTRAS", abs: restAbs, pct: (restAbs / total) * 100 });
  }
  return result;
}
// Abundância e riqueza por metodologia
function byMetodo(registros: CampoRegistro[]): { metodo: string; abundancia: number; riqueza: number }[] {
  const grouped: Record<string, Set<string>> = {};
  const counts: Record<string, number> = {};
  registros.forEach(r => {
    const m = r.metodo?.trim() || "Não informado";
    if (!grouped[m]) { grouped[m] = new Set(); counts[m] = 0; }
    if (r.nomeCientifico) grouped[m].add(r.nomeCientifico);
    counts[m]++;
  });
  return Object.entries(grouped)
    .map(([metodo, spp]) => ({ metodo, abundancia: counts[metodo], riqueza: spp.size }))
    .sort((a, b) => b.abundancia - a.abundancia);
}
// Tabela por Unidade Amostral (espécie × UA)
function matrizUa(registros: CampoRegistro[]): { especies: string[]; uas: string[]; matriz: number[][] } {
  const especiesSet = new Set<string>();
  const uasSet = new Set<string>();
  registros.forEach(r => {
    if (r.nomeCientifico) especiesSet.add(r.nomeCientifico);
    if (r.unidadeAmostral) uasSet.add(r.unidadeAmostral);
  });
  const especies = [...especiesSet].sort(natSort);
  const uas = [...uasSet].sort(natSort);
  const matriz = especies.map(sp =>
    uas.map(ua => registros.filter(r => r.nomeCientifico === sp && r.unidadeAmostral === ua).length)
  );
  return { especies, uas, matriz };
}

// Tabela por (Unidade Amostral × Campanha) — cada célula é uma amostra independente
// para análises multivariadas com replicação temporal
function matrizUaCamp(registros: CampoRegistro[]): {
  especies: string[];
  samples: { key: string; ua: string; campanha: string }[];
  matriz: number[][];
} {
  const especiesSet = new Set<string>();
  const sampleMap = new Map<string, { ua: string; campanha: string }>();
  registros.forEach(r => {
    if (!r.nomeCientifico || !r.unidadeAmostral) return;
    const camp = r.campanha?.trim() || "(sem campanha)";
    const key = `${r.unidadeAmostral}|||${camp}`;
    if (!sampleMap.has(key)) sampleMap.set(key, { ua: r.unidadeAmostral, campanha: camp });
    especiesSet.add(r.nomeCientifico.trim());
  });
  const especies = [...especiesSet].sort(natSort);
  const samples = Array.from(sampleMap.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => natSort(a.ua, b.ua) || natSort(a.campanha, b.campanha));
  const countMap = new Map<string, Map<string, number>>();
  registros.forEach(r => {
    if (!r.nomeCientifico || !r.unidadeAmostral) return;
    const camp = r.campanha?.trim() || "(sem campanha)";
    const sKey = `${r.unidadeAmostral}|||${camp}`;
    const sp = r.nomeCientifico.trim();
    if (!countMap.has(sKey)) countMap.set(sKey, new Map());
    const m = countMap.get(sKey)!;
    m.set(sp, (m.get(sp) || 0) + 1);
  });
  const matriz = especies.map(sp =>
    samples.map(s => countMap.get(s.key)?.get(sp) ?? 0)
  );
  return { especies, samples, matriz };
}

// Biodiversidade por Unidade Amostral
type GroupStat = { label: string; abundancia: number; riqueza: number; H: number; D: number; J: number; margalef: number; menhinick: number; bergerParker: number };

function byGroupStats(registros: CampoRegistro[], keyFn: (r: CampoRegistro) => string | null | undefined): GroupStat[] {
  const groups = [...new Set(registros.map(keyFn).filter(Boolean) as string[])].sort(natSort);
  return groups.map(label => {
    const recs = registros.filter(r => keyFn(r) === label);
    const counts: Record<string, number> = {};
    recs.forEach(r => { const sp = r.nomeCientifico?.trim().toUpperCase(); if (sp) counts[sp] = (counts[sp] || 0) + 1; });
    const vals = Object.values(counts);
    const S = vals.length, N = recs.length;
    const margalef = N > 1 ? (S - 1) / Math.log(N) : 0;
    const menhinick = N > 0 ? S / Math.sqrt(N) : 0;
    const bergerParker = N > 0 ? Math.max(...(vals.length ? vals : [0])) / N : 0;
    return { label, abundancia: N, riqueza: S, H: shannonH(vals), D: simpsonD(vals), J: pielouJ(vals), margalef, menhinick, bergerParker };
  });
}

function byUaStats(registros: CampoRegistro[]): {
  ua: string; abundancia: number; riqueza: number; H: number; D: number; J: number; margalef: number; menhinick: number; bergerParker: number;
}[] {
  return byGroupStats(registros, r => r.unidadeAmostral).map(g => ({ ...g, ua: g.label }));
}

// ── Chart components ──────────────────────────────────────────────────────────
// Resolves a grupo key (e.g. "avifauna", "mastofauna", "fauna_aves") → color + label
function resolveGrupoColor(key: string): { color: string; label: string } {
  if (GRUPO_CONFIG[key]) return { color: GRUPO_CONFIG[key].color, label: GRUPO_CONFIG[key].label };
  const k = key.toLowerCase().trim();
  if (k.includes("ave") || k.includes("bird") || k.includes("avif")) return { color: "#0099a8", label: "Aves" };
  if (k.includes("mam") || k.includes("masto")) return { color: "#ea580c", label: "Mamíferos" };
  if (k.includes("herp") || k.includes("réptil") || k.includes("reptil") || k.includes("anfib")) return { color: "#0e7490", label: "Herpetofauna" };
  if (k.includes("ictio") || k.includes("peix") || k.includes("fish")) return { color: "#06b6d4", label: "Ictiofauna" };
  if (k.includes("invert") || k.includes("inseto") || k.includes("artr")) return { color: "#f97316", label: "Invertebrados" };
  if (k.includes("flor") || k.includes("plan") || k.includes("veget")) return { color: "#155e75", label: "Flora" };
  if (k.includes("ruíd") || k.includes("ruid") || k.includes("son")) return { color: "#c2410c", label: "Ruído" };
  if (k.includes("solo") || k.includes("sedim")) return { color: "#9a3a0a", label: "Solo" };
  if (k.includes("água") || k.includes("agua") || k.includes("hidro")) return { color: "#22d3ee", label: "Água" };
  const idx = Math.abs(key.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  return { color: ecoColor(idx), label: key };
}

function GrupoChart({ byGrupo }: { byGrupo: Record<string, number> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current || !byGrupo || !Object.keys(byGrupo).length) return;
    chartRef.current?.destroy();
    const entries = Object.entries(byGrupo).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    const resolved = entries.map(([k]) => resolveGrupoColor(k));
    const labels = resolved.map(r => r.label);
    const colors = resolved.map(r => r.color);
    const values = entries.map(([, v]) => v);

    // Center text plugin
    const centerPlugin = {
      id: "centerText",
      afterDraw(chart: Chart) {
        const { ctx, chartArea: { top, left, right, bottom } } = chart;
        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2;
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 20px Inter, sans-serif";
        ctx.fillStyle = "#0f172a";
        ctx.fillText(String(total), cx, cy - 8);
        ctx.font = "11px Inter, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.fillText("registros", cx, cy + 10);
        ctx.restore();
      },
    };

    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 3,
          borderColor: "#fff",
          hoverBorderWidth: 4,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            position: "right",
            labels: {
              font: { size: 11 },
              boxWidth: 12,
              padding: 10,
              generateLabels(chart) {
                const ds = chart.data.datasets[0];
                const tot = (ds.data as number[]).reduce((a, b) => a + b, 0);
                return (chart.data.labels as string[]).map((lbl, i) => ({
                  text: `${lbl}  ${ds.data[i]}  (${tot > 0 ? ((ds.data[i] as number) / tot * 100).toFixed(0) : 0}%)`,
                  fillStyle: (ds.backgroundColor as string[])[i],
                  strokeStyle: "#fff",
                  lineWidth: 1,
                  hidden: false,
                  index: i,
                }));
              },
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0";
                return `  ${ctx.label}: ${ctx.parsed} registros (${pct}%)`;
              },
            },
          },
        },
      },
      plugins: [centerPlugin as any],
    });
    return () => chartRef.current?.destroy();
  }, [byGrupo]);
  return (
    <div className="relative h-full" data-chart-title="Composição por Grupo Taxonômico">
      <div className="absolute top-1 right-1 z-10">
        <ChartDownloadBtn canvasRef={ref} name="grafico_grupos" />
      </div>
      <canvas ref={ref} />
    </div>
  );
}

// Keys are normalised: lowercase, sem acento, sem gênero (sufixos "o/a" removidos no fim)
const GUILDA_COLORS: Record<string, string> = {
  "carniv":     "#ea580c", // laranja vivo
  "oniv":       "#0099a8", // teal principal
  "omniv":      "#0099a8",
  "herbiv":     "#c2410c", // laranja queimado
  "frugiv":     "#0e7490", // teal escuro
  "insetiv":    "#f97316", // laranja claro
  "graniv":     "#155e75", // teal profundo
  "nectariv":   "#fb923c", // pêssego
  "pisciv":     "#9a3a0a", // marrom-laranja
  "detritiv":   "#164e63", // teal-marinho
  "foliv":      "#fdba74", // pêssego claro
  "mirmecofag": "#06b6d4", // ciano
  "filtrador":  "#22d3ee",
  "parasita":   "#9a3a0a",
  "saprofag":   "#164e63",
};
function guildaColor(key: string, idx: number): string {
  // Normalise: trim, lower, remove diacritics, drop trailing "o/a"
  const norm = key.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[oa]s?$/, ""); // carnivoro → carniv, herbívora → herbiv
  // Try exact then prefix match
  if (GUILDA_COLORS[norm]) return GUILDA_COLORS[norm];
  for (const k of Object.keys(GUILDA_COLORS)) {
    if (norm.startsWith(k)) return GUILDA_COLORS[k];
  }
  return ecoColor(idx);
}

function GuildaChart({ byDieta }: { byDieta: Record<string, number> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const entries = useMemo(
    () => Object.entries(byDieta).sort((a, b) => b[1] - a[1]),
    [byDieta]
  );
  const total = useMemo(() => entries.reduce((s, [, v]) => s + v, 0), [entries]);

  useEffect(() => {
    if (!ref.current || !entries.length) return;
    chartRef.current?.destroy();
    const labels = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);
    const colors = labels.map((l, i) => guildaColor(l, i));

    // Plugin: rótulos com % dentro/fora das fatias
    const percentLabelsPlugin = {
      id: "guildaPercentLabels",
      afterDatasetsDraw(chart: any) {
        const c = chart.ctx as CanvasRenderingContext2D;
        const meta = chart.getDatasetMeta(0);
        const sum = values.reduce((a, b) => a + b, 0);
        meta.data.forEach((arc: any, i: number) => {
          const pct = (values[i] / sum) * 100;
          if (pct < 1.5) return; // não rotula fatias muito pequenas
          const { x, y, startAngle, endAngle, innerRadius, outerRadius } = arc.getProps(
            ["x","y","startAngle","endAngle","innerRadius","outerRadius"], true
          );
          const mid = (startAngle + endAngle) / 2;
          const isLarge = pct >= 8;
          // Fatias grandes: rótulo dentro do anel; pequenas: leader line + fora
          if (isLarge) {
            const r = (innerRadius + outerRadius) / 2;
            const lx = x + Math.cos(mid) * r;
            const ly = y + Math.sin(mid) * r;
            const txt = pct >= 10 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
            c.save();
            c.font = "700 12px system-ui, sans-serif";
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillStyle = "#fff";
            c.strokeStyle = "rgba(0,0,0,0.4)";
            c.lineWidth = 3;
            c.lineJoin = "round";
            c.strokeText(txt, lx, ly);
            c.fillText(txt, lx, ly);
            c.restore();
          } else {
            const r1 = outerRadius + 2;
            const r2 = outerRadius + 14;
            const x1 = x + Math.cos(mid) * r1;
            const y1 = y + Math.sin(mid) * r1;
            const x2 = x + Math.cos(mid) * r2;
            const y2 = y + Math.sin(mid) * r2;
            const right = Math.cos(mid) >= 0;
            const x3 = x2 + (right ? 12 : -12);
            const txt = `${pct.toFixed(1)}%`;
            c.save();
            c.strokeStyle = colors[i];
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(x1, y1);
            c.lineTo(x2, y2);
            c.lineTo(x3, y2);
            c.stroke();
            c.font = "600 10.5px system-ui, sans-serif";
            c.textBaseline = "middle";
            c.textAlign = right ? "left" : "right";
            c.fillStyle = "#1e293b";
            c.fillText(txt, x3 + (right ? 3 : -3), y2);
            c.restore();
          }
        });

        // Texto central: total
        const cx = meta.data[0]?.x ?? chart.chartArea.left + chart.chartArea.width / 2;
        const cy = meta.data[0]?.y ?? chart.chartArea.top + chart.chartArea.height / 2;
        c.save();
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = "#0f172a";
        c.font = "800 18px system-ui, sans-serif";
        c.fillText(String(sum), cx, cy - 7);
        c.font = "500 9.5px system-ui, sans-serif";
        c.fillStyle = "#64748b";
        c.fillText("registros", cx, cy + 9);
        c.restore();
      },
    };

    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "doughnut",
      plugins: [percentLabelsPlugin],
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2.5,
          borderColor: "#fff",
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "58%",
        layout: { padding: { top: 10, bottom: 10, left: 24, right: 24 } },
        plugins: {
          legend: {
            display: true,
            position: "bottom" as const,
            align: "center" as const,
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              padding: 10,
              font: { size: 11, weight: 500 as const },
              color: "#334155",
              generateLabels: (chart: any) => {
                const ds = chart.data.datasets[0];
                const lbls = chart.data.labels as string[];
                const data = ds.data as number[];
                const sum = data.reduce((a, b) => a + b, 0);
                return lbls.map((label, i) => {
                  const pct = sum > 0 ? (data[i] / sum) * 100 : 0;
                  return {
                    text: `${label.toUpperCase()} — ${pct.toFixed(1)}%`,
                    fillStyle: colors[i],
                    strokeStyle: colors[i],
                    lineWidth: 0,
                    hidden: false,
                    index: i,
                  };
                });
              },
            },
          },
          tooltip: {
            backgroundColor: "rgba(15,23,42,0.92)",
            titleColor: "#e2e8f0",
            bodyColor: "#cbd5e1",
            padding: 10,
            titleFont: { size: 11, weight: "bold" as const },
            bodyFont: { size: 10 },
            callbacks: {
              label: (ctx) => {
                const sum = (ctx.dataset.data as number[]).reduce((a,b)=>a+b,0);
                return `  ${ctx.label}: ${ctx.parsed} (${((ctx.parsed/sum)*100).toFixed(1)}%)`;
              },
            },
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [entries]);

  return (
    <div className="relative h-full flex flex-col" data-chart-title="Guilda Trófica (Dieta)">
      <div className="absolute top-1 right-1 z-10"><ChartDownloadBtn canvasRef={ref} name="grafico_guildas" /></div>
      <div className="relative flex-1 min-h-0">
        <canvas ref={ref} />
      </div>
    </div>
  );
}

// ── Sazonalidade (coluna "sazonalidade" do banco) ────────────────────────────
// Paleta de cores por palavra-chave no valor da sazonalidade
function sazonColor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("chuv") || l.includes("úmid") || l.includes("umid") || l.includes("wet"))
    return "#0099a8"; // teal — período chuvoso/úmido
  if (l.includes("seca") || l.includes("seco") || l.includes("árido") || l.includes("arid") || l.includes("dry"))
    return "#ea580c"; // laranja — período seco
  if (l.includes("trans"))
    return "#fdba74"; // pêssego — transição
  // fallback ECO palette
  return ecoColor(Math.abs(label.charCodeAt(0) - 65));
}

function SazonalidadeChart({ registros }: { registros: CampoRegistro[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const bySazon = useMemo(() => {
    const agg: Record<string, { n: number; spp: Set<string> }> = {};
    registros.forEach(r => {
      const s = (r as any).sazonalidade;
      if (!s || String(s).trim() === "") return;
      const key = String(s).trim();
      if (!agg[key]) agg[key] = { n: 0, spp: new Set() };
      agg[key].n++;
      if (r.nomeCientifico) agg[key].spp.add(r.nomeCientifico.trim().toUpperCase());
    });
    // sort: chuva first, then seca, then rest alphabetically
    return Object.entries(agg)
      .sort(([a], [b]) => {
        const rank = (k: string) => {
          const l = k.toLowerCase();
          if (l.includes("chuv")) return 0;
          if (l.includes("trans")) return 1;
          if (l.includes("sec")) return 2;
          return 3;
        };
        return rank(a) - rank(b) || a.localeCompare(b);
      })
      .map(([label, v]) => ({ label, abundancia: v.n, riqueza: v.spp.size }));
  }, [registros]);

  const hasData = bySazon.length > 0;

  useEffect(() => {
    if (!ref.current || !hasData) return;
    chartRef.current?.destroy();
    const colors = bySazon.map(d => sazonColor(d.label));
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "bar",
      data: {
        labels: bySazon.map(d => d.label),
        datasets: [
          {
            type: "bar" as const,
            label: "Abundância (n registros)",
            data: bySazon.map(d => d.abundancia),
            backgroundColor: colors.map(c => c + "bb"),
            borderColor: colors,
            borderWidth: 2,
            borderRadius: 5,
            yAxisID: "y",
          },
          {
            type: "line" as const,
            label: "Riqueza (n espécies)",
            data: bySazon.map(d => d.riqueza),
            borderColor: "#0e7490",
            backgroundColor: "#0e749022",
            pointBackgroundColor: "#0e7490",
            pointRadius: 6,
            tension: 0.35,
            fill: false,
            yAxisID: "y2",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { font: { size: 11 }, usePointStyle: true } },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const d = bySazon[ctx.dataIndex];
                if (!d) return "";
                return `Riqueza: ${d.riqueza} spp`;
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: "Sazonalidade", font: { size: 10 } }, ticks: { font: { size: 10 } }, grid: { display: false } },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Abundância (n)", font: { size: 10 } },
            ticks: { font: { size: 10 } },
          },
          y2: {
            beginAtZero: true, position: "right",
            title: { display: true, text: "Riqueza (spp)", font: { size: 10 } },
            ticks: { font: { size: 10 } },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [bySazon, hasData]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-[160px] gap-2 text-muted-foreground">
        <CloudRain className="w-8 h-8 opacity-30" />
        <p className="text-xs text-center">
          Nenhum registro possui a coluna <strong>Sazonalidade</strong> preenchida.<br />
          Preencha o campo nos registros ou importe uma planilha com a coluna &quot;Sazonalidade&quot;.
        </p>
      </div>
    );
  }

  const maxSazon = bySazon.reduce((a, b) => a.abundancia > b.abundancia ? a : b, bySazon[0]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-xs">
        {bySazon.map(d => (
          <span key={d.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: sazonColor(d.label) }} />
            <span className="font-medium" style={{ color: sazonColor(d.label) }}>{d.label}:</span>
            <span className="text-muted-foreground">{d.abundancia} reg · {d.riqueza} spp</span>
          </span>
        ))}
        {bySazon.length > 1 && (
          <span className="text-muted-foreground">· Maior detecção: <strong>{maxSazon.label}</strong></span>
        )}
      </div>
      <div className="relative h-[220px]" data-chart-title="Abundância e Riqueza por Sazonalidade">
        <div className="absolute top-1 right-1 z-10">
          <ChartDownloadBtn canvasRef={ref} name="grafico_sazonalidade" />
        </div>
        <canvas ref={ref} />
      </div>
    </div>
  );
}

function FreqRelChart({ data }: { data: { especie: string; abs: number; pct: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current || !data.length) return;
    chartRef.current?.destroy();
    const colors = data.map(d => d.especie === "OUTRAS" ? BRAND.neutral : BRAND.blue2);
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "bar",
      data: {
        labels: data.map(d => d.especie),
        datasets: [{ label: "Freq. relativa (%)", data: data.map(d => +d.pct.toFixed(2)), backgroundColor: colors, borderRadius: 3 }],
      },
      options: {
        indexAxis: "y" as const,
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { left: 4, right: 24, top: 4, bottom: 4 } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.x.toFixed(2)}%` } } },
        scales: {
          x: { beginAtZero: true, ticks: { callback: (v) => `${v}%`, font: { size: 10 } }, title: { display: true, text: "Frequência Relativa (%)", font: { size: 10 } } },
          y: {
            ticks: { font: { size: 10, style: "italic" as const }, autoSkip: false, crossAlign: "far" as const, padding: 4 },
            afterFit: (axis: any) => {
              const maxLen = data.reduce((m, d) => Math.max(m, d.especie.length), 0);
              axis.width = Math.min(300, Math.max(120, maxLen * 6.2 + 16));
            },
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [data]);
  return <div className="relative w-full h-full" data-chart-title="Frequência Relativa das Espécies"><div className="absolute top-1 right-1 z-10"><ChartDownloadBtn canvasRef={ref} name="grafico_frequencia_relativa" /></div><canvas ref={ref} style={{ width: "100%", height: "100%" }} /></div>;
}

function MetodoChart({ data }: { data: { metodo: string; abundancia: number; riqueza: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current || !data.length) return;
    chartRef.current?.destroy();
    const labels = data.map(d => d.metodo.length > 20 ? d.metodo.slice(0, 18) + "…" : d.metodo);
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { type: "bar" as const, label: "Abundância (n registros)", data: data.map(d => d.abundancia), backgroundColor: BRAND.blue2 + "cc", borderRadius: 3, yAxisID: "y" },
          { type: "line" as const, label: "Riqueza (n espécies)", data: data.map(d => d.riqueza), borderColor: BRAND.orange1, backgroundColor: BRAND.orange1a, tension: 0.4, pointRadius: 5, fill: false, yAxisID: "y2" },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "top", labels: { font: { size: 11 } } } },
        scales: {
          x: { title: { display: true, text: "Método de Coleta", font: { size: 10 } }, ticks: { font: { size: 10 } }, grid: { display: false } },
          y: { beginAtZero: true, title: { display: true, text: "Abundância (n)", font: { size: 10 } }, position: "left" },
          y2: { beginAtZero: true, title: { display: true, text: "Riqueza (nº spp)", font: { size: 10 } }, position: "right", grid: { drawOnChartArea: false } },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [data]);
  return <div className="relative" data-chart-title="Abundância e Riqueza por Método de Coleta"><div className="absolute top-1 right-1 z-10"><ChartDownloadBtn canvasRef={ref} name="grafico_metodo" /></div><canvas ref={ref} height={220} /></div>;
}

function GroupBarChart({ data, groupLabel, chartName }: { data: { label: string; abundancia: number; riqueza: number }[]; groupLabel: string; chartName: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const key = data.map(d => d.label + d.abundancia).join("|");
  useEffect(() => {
    if (!ref.current || !data.length) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      data: {
        labels: data.map(d => d.label.length > 18 ? d.label.slice(0, 16) + "…" : d.label),
        datasets: [
          { type: "bar" as const, label: "Abundância (N)", data: data.map(d => d.abundancia), backgroundColor: BRAND.blue1 + "cc", borderRadius: 4, yAxisID: "y" },
          { type: "line" as const, label: "Riqueza (Sobs)", data: data.map(d => d.riqueza), borderColor: BRAND.orange1, backgroundColor: BRAND.orange1a, tension: 0.4, pointRadius: 5, fill: false, yAxisID: "y2" },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "top", labels: { font: { size: 11 } } } },
        scales: {
          x: { ticks: { font: { size: 10 }, maxRotation: 40 }, grid: { display: false }, title: { display: true, text: groupLabel, font: { size: 10 } } },
          y: { beginAtZero: true, title: { display: true, text: "Abundância (N)", font: { size: 10 } }, position: "left" },
          y2: { beginAtZero: true, title: { display: true, text: "Riqueza (nº spp)", font: { size: 10 } }, position: "right", grid: { drawOnChartArea: false } },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [key, groupLabel]);
  return (
    <div className="relative h-full" data-chart-title={`Abundância e Riqueza por ${groupLabel}`}>
      <div className="absolute top-1 right-1 z-10"><ChartDownloadBtn canvasRef={ref} name={chartName} /></div>
      <canvas ref={ref} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

function UaBarChart({ data }: { data: { ua: string; abundancia: number; riqueza: number }[] }) {
  return <GroupBarChart data={data.map(d => ({ label: d.ua, abundancia: d.abundancia, riqueza: d.riqueza }))} groupLabel="Unidade Amostral" chartName="grafico_por_ua" />;
}

// ── AccumChart — pool-accumulation with 95% CI bands ─────────────────────────
const ACCUM_SERIES_CFG = [
  { key: "sobs",  label: "Sobs (observada)",  color: BRAND.blue1,  dash: [] as number[] },
  { key: "jack1", label: "Jackknife 1",        color: BRAND.orange1, dash: [6, 3] },
  { key: "boot",  label: "Bootstrap",          color: "#7c3aed",    dash: [4, 2] },
] as const;

function makeBandDatasets(
  key: string, pts: AccumPoint[], color: string, dash: number[], showCI: boolean,
) {
  const means = pts.map(p => p.mean);
  const his   = pts.map(p => p.hi);
  const los   = pts.map(p => p.lo);
  return [
    // 0 — CI upper (fills down to dataset+1 = CI lower)
    ...(showCI ? [{
      label: `${key}_hi`, data: his,
      fill: "+1",
      backgroundColor: color + "20",
      borderColor: "transparent",
      pointRadius: 0, tension: 0.4, borderWidth: 0,
      order: 10,
    }] : []),
    // 1 — CI lower
    ...(showCI ? [{
      label: `${key}_lo`, data: los,
      fill: false,
      borderColor: color + "50",
      backgroundColor: "transparent",
      pointRadius: 0, tension: 0.4, borderWidth: 1,
      borderDash: [3, 2],
      order: 10,
    }] : []),
    // 2 — mean line
    {
      label: key,
      data: means,
      fill: false,
      borderColor: color,
      backgroundColor: color + "22",
      tension: 0.35,
      pointRadius: pts.length <= 30 ? 3 : 0,
      pointHoverRadius: 5,
      borderWidth: 2.5,
      borderDash: [...dash],
      order: 1,
    },
  ];
}

function AccumChart({ data }: { data: AccumCurveData }) {
  const ref  = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [active, setActive] = useState<Set<string>>(new Set(["sobs", "jack1", "boot"]));
  const [showCI, setShowCI] = useState(true);

  const toggle = (key: string) =>
    setActive(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const dataMap: Record<string, AccumPoint[]> = {
    sobs: data.sobs, jack1: data.jack1, boot: data.boot,
  };

  useEffect(() => {
    if (!ref.current || !data.nDays) return;
    chartRef.current?.destroy();

    const datasets: any[] = [];
    ACCUM_SERIES_CFG.forEach(s => {
      if (!active.has(s.key)) return;
      datasets.push(...makeBandDatasets(s.key, dataMap[s.key], s.color, s.dash, showCI));
    });

    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "line",
      data: { labels: data.labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index", intersect: false,
            filter: (item) => !["_hi","_lo"].some(s => String(item.dataset.label).includes(s)),
            callbacks: {
              title: (items) => {
                const i = items[0].dataIndex;
                return `${data.labels[i]}  (${data.dates[i] || ""})`;
              },
              label: (item) => {
                const key = String(item.dataset.label);
                if (key.includes("_hi") || key.includes("_lo")) return "";
                const pt = dataMap[key]?.[item.dataIndex];
                if (!pt) return ` ${key}: ${item.raw}`;
                const cfg = ACCUM_SERIES_CFG.find(s => s.key === key);
                return ` ${cfg?.label ?? key}: ${pt.mean.toFixed(1)}  [IC 95%: ${pt.lo}–${pt.hi}]  ±${pt.sd}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Esforço amostral (dias de coleta)", font: { size: 10 } },
            ticks: { maxTicksLimit: 15, font: { size: 9 }, maxRotation: 40, minRotation: 20 },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Nº espécies", font: { size: 10 } },
          },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [data, active, showCI]);

  return (
    <div className="flex flex-col h-full gap-1">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-1.5 px-1">
        {ACCUM_SERIES_CFG.map(s => {
          const on = active.has(s.key);
          return (
            <button
              key={s.key} onClick={() => toggle(s.key)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-all"
              style={{
                borderColor: on ? s.color : "#e2e8f0",
                backgroundColor: on ? s.color + "18" : "transparent",
                color: on ? s.color : "#94a3b8",
              }}
            >
              <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: on ? s.color : "#e2e8f0" }} />
              {s.label}
            </button>
          );
        })}
        <button
          onClick={() => setShowCI(p => !p)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-all ml-1"
          style={{
            borderColor: showCI ? "#0891b2" : "#e2e8f0",
            backgroundColor: showCI ? "#e0f2fe" : "transparent",
            color: showCI ? "#0891b2" : "#94a3b8",
          }}
        >
          IC 95%
        </button>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {data.nPerms} permutações · {data.nDays} dias
        </span>
      </div>
      <div className="relative flex-1 min-h-0" data-chart-title="Curva de Acumulação de Espécies (poolaccum)">
        <div className="absolute top-0 right-0 z-10"><ChartDownloadBtn canvasRef={ref} name="curva_acumulacao" /></div>
        <canvas ref={ref} style={{ height: "100%", width: "100%" }} />
      </div>
    </div>
  );
}

function IucnChart({ registros }: { registros: CampoRegistro[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chartRef.current?.destroy();
    const counts: Record<string, number> = {};
    registros.forEach(r => { const s = toIucnSigla(r.iucn); if (s) counts[s] = (counts[s] || 0) + 1; });
    const cats = Object.keys(counts);
    if (!cats.length) return;
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "bar",
      data: { labels: cats, datasets: [{ label: "Registros", data: cats.map(c => counts[c]), backgroundColor: cats.map(c => IUCN_COLORS[c] || "#94a3b8"), borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: "Categoria IUCN", font: { size: 10 } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: "Nº de Registros", font: { size: 10 } } } } },
    });
    return () => chartRef.current?.destroy();
  }, [registros]);
  return <div className="relative" data-chart-title="Status de Conservação IUCN"><div className="absolute top-1 right-1 z-10"><ChartDownloadBtn canvasRef={ref} name="grafico_iucn" /></div><canvas ref={ref} height={200} /></div>;
}

function TimelineChart({ registros }: { registros: CampoRegistro[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chartRef.current?.destroy();
    const byDay: Record<string, number> = {};
    registros.forEach(r => { if (r.data) byDay[r.data] = (byDay[r.data] || 0) + 1; });
    const days = Object.keys(byDay).sort().slice(-30);
    if (!days.length) return;
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "line",
      data: { labels: days.map(d => d.slice(5)), datasets: [{ label: "Registros/dia", data: days.map(d => byDay[d]), fill: true, backgroundColor: BRAND.orange1a, borderColor: BRAND.orange1, tension: 0.4, pointRadius: 3, pointBackgroundColor: BRAND.orange1 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: "Data", font: { size: 10 } }, ticks: { font: { size: 9 } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: "Registros por dia", font: { size: 10 } } } } },
    });
    return () => chartRef.current?.destroy();
  }, [registros]);
  return <div className="relative" data-chart-title="Linha do Tempo de Registros (30 dias)"><div className="absolute top-1 right-1 z-10"><ChartDownloadBtn canvasRef={ref} name="grafico_timeline" /></div><canvas ref={ref} height={200} /></div>;
}

// ── Gráfico: Rank-Abundance ────────────────────────────────────────────────────
function RankAbundChart({ data }: { data: { rank: number; especie: string; n: number; logN: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current || !data.length) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "line",
      data: {
        labels: data.map(d => d.rank),
        datasets: [{
          label: "log₁₀(Abundância)",
          data: data.map(d => d.logN),
          borderColor: BRAND.blue1,
          backgroundColor: BRAND.blue1a,
          fill: true, tension: 0.4, pointRadius: 4, borderWidth: 2,
          pointBackgroundColor: BRAND.blue1,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                const nm = data[idx].especie;
                return nm.length > 32 ? nm.slice(0, 30) + "…" : nm;
              },
              label: (item) => `n = ${data[item.dataIndex].n}  |  log₁₀ = ${item.raw}`,
            },
          },
        },
        scales: {
          x: { title: { display: true, text: "Rank (ordem decrescente)" }, ticks: { stepSize: 1 } },
          y: { title: { display: true, text: "log₁₀(n)" }, beginAtZero: true },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [data]);
  return <div className="relative" data-chart-title="Rank-Abundância (log₁₀)"><div className="absolute top-1 right-1 z-10"><ChartDownloadBtn canvasRef={ref} name="rank_abundancia" /></div><canvas ref={ref} height={220} /></div>;
}

// ── Gráfico: Barra genérica (Riqueza + Abundância) ────────────────────────────
function DimensaoBarChart({
  data, barColor = BRAND.blue2, lineColor = BRAND.orange1, name = "grafico", chartTitle,
}: { data: { label: string; abundancia: number; riqueza: number }[]; barColor?: string; lineColor?: string; name?: string; chartTitle?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current || !data.length) return;
    chartRef.current?.destroy();
    const labels = data.map(d => d.label.length > 18 ? d.label.slice(0, 16) + "…" : d.label);
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      data: {
        labels,
        datasets: [
          { type: "bar" as const, label: "Abundância (n)", data: data.map(d => d.abundancia), backgroundColor: barColor + "cc", borderRadius: 3, yAxisID: "y" },
          { type: "line" as const, label: "Riqueza (spp)", data: data.map(d => d.riqueza), borderColor: lineColor, backgroundColor: lineColor + "33", tension: 0.4, pointRadius: 5, fill: false, yAxisID: "y2" },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "top", labels: { font: { size: 11 } } } },
        scales: {
          x: { ticks: { font: { size: 10 }, maxRotation: 40 }, grid: { display: false }, title: { display: true, text: "Categoria", font: { size: 10 } } },
          y: { beginAtZero: true, title: { display: true, text: "Abundância (n)", font: { size: 10 } }, position: "left" },
          y2: { beginAtZero: true, title: { display: true, text: "Riqueza (nº spp)", font: { size: 10 } }, position: "right", grid: { drawOnChartArea: false } },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [data, barColor, lineColor]);
  return <div className="relative" {...(chartTitle ? { "data-chart-title": chartTitle } : {})}><div className="absolute top-1 right-1 z-10"><ChartDownloadBtn canvasRef={ref} name={name} /></div><canvas ref={ref} height={220} /></div>;
}

// ── Campanha fuzzy match ───────────────────────────────────────────────────────
// Recognises equivalences: "1" = "CAMPANHA 1" = "primeira" = "1ª"
const ORDINALS: Record<string, string> = {
  "primeira": "1", "first": "1", "1a": "1", "1ª": "1",
  "segunda": "2", "second": "2", "2a": "2", "2ª": "2",
  "terceira": "3", "third": "3", "3a": "3", "3ª": "3",
  "quarta": "4", "fourth": "4", "4a": "4", "4ª": "4",
  "quinta": "5", "fifth": "5", "5a": "5", "5ª": "5",
  "sexta": "6", "seventh": "6", "6a": "6", "6ª": "6",
  "sétima": "7", "seventh2": "7", "7a": "7", "7ª": "7",
  "oitava": "8", "eighth": "8", "8a": "8", "8ª": "8",
  "nona": "9", "ninth": "9", "9a": "9", "9ª": "9",
  "décima": "10", "tenth": "10", "10a": "10", "10ª": "10",
};
function extractNum(s: string): string | undefined {
  // "CAMPANHA 1" → "1", "1" → "1", "primeira" → "1", "C3" → "3"
  const ord = ORDINALS[s.toLowerCase().trim()];
  if (ord) return ord;
  return s.match(/\d+/)?.[0];
}
function campanhaMatch(recordVal: string | null | undefined, filter: string): boolean {
  if (!recordVal) return false;
  const r = recordVal.trim();
  const f = filter.trim();
  if (r.toLowerCase() === f.toLowerCase()) return true;
  const rIsNum = /^\d+$/.test(r);
  const fIsNum = /^\d+$/.test(f);
  // Pure-numeric names (e.g. "1", "11") must match by exact numeric equality
  // to avoid "1" matching "10", "11", "12"...
  if (rIsNum && fIsNum) return Number(r) === Number(f);
  // Mixed: substring only when at least one side has non-digit chars
  // (e.g. filter "1" matching record "CAMPANHA 1")
  if (!rIsNum || !fIsNum) {
    // Word-boundary check to avoid "1" matching "10" inside "CAMPANHA 10"
    const rTokens = r.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const fTokens = f.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (rTokens.some(t => fTokens.includes(t)) || fTokens.some(t => rTokens.includes(t))) return true;
  }
  // numeric equivalence (both extract to same number)
  const rN = extractNum(r);
  const fN = extractNum(f);
  if (rN && fN && rN === fN) return true;
  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// PAINÉIS DE MONITORAMENTO AMBIENTAL (não-biológico)
// ══════════════════════════════════════════════════════════════════════════════

// ── helpers ─────────────────────────────────────────────────────────────────
function numParam(regs: { parametros?: Record<string, number | string | null> | null }[], key: string): number[] {
  return regs
    .map(r => r.parametros?.[key])
    .filter((v): v is number => typeof v === "number" && isFinite(v));
}
function statOf(vals: number[]) {
  if (!vals.length) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { mean, min: Math.min(...vals), max: Math.max(...vals), n: vals.length };
}
function fmtN(v: number, d = 2) { return v.toFixed(d); }

// ── ParametroChart (Chart.js bar) ──────────────────────────────────────────
function ParametroChart({
  labels, values, label, unit, limiteLine, color, chartKey,
}: {
  labels: string[]; values: number[]; label: string; unit: string;
  limiteLine?: number; color: string; chartKey: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current || !values.length) return;
    chartRef.current?.destroy();
    const datasets: any[] = [{
      type: "bar" as const,
      label,
      data: values,
      backgroundColor: color + "cc",
      borderColor: color,
      borderWidth: 1,
      borderRadius: 5,
      yAxisID: "y",
      order: 2,
    }];
    if (limiteLine !== undefined) {
      datasets.push({
        type: "line" as const,
        label: `Limite (${limiteLine}${unit})`,
        data: Array(labels.length).fill(limiteLine),
        borderColor: "#ef4444",
        borderWidth: 2,
        borderDash: [6, 3],
        pointRadius: 0,
        backgroundColor: "transparent",
        yAxisID: "y",
        order: 1,
      });
    }
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "bar",
      data: { labels: labels.map(l => l.length > 14 ? l.slice(0, 12) + "…" : l), datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: limiteLine !== undefined, labels: { font: { size: 9 } } } },
        scales: {
          x: { ticks: { font: { size: 9 } }, grid: { display: false }, title: { display: true, text: "Amostra", font: { size: 9 } } },
          y: { beginAtZero: false, title: { display: true, text: unit || label, font: { size: 9 } } },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [labels, values, limiteLine, label, unit, color, chartKey]);
  return (
    <div className="relative" data-chart-title={`${label}${unit ? ` (${unit})` : ""}`}>
      <div className="absolute top-0 right-0 z-10"><ChartDownloadBtn canvasRef={ref} name={`parametro_${chartKey}`} /></div>
      <canvas ref={ref} height={180} />
    </div>
  );
}

// ── RuidoPanel ──────────────────────────────────────────────────────────────
function RuidoPanel({ registros }: { registros: { parametros?: Record<string, number | string | null> | null; unidadeAmostral?: string; campanha?: string; data: string }[] }) {
  const comParams = registros.filter(r => r.parametros && Object.keys(r.parametros).length > 0);
  const leqVals = numParam(registros, "Leq");
  const lmaxVals = numParam(registros, "Lmax");
  const lminVals = numParam(registros, "Lmin");
  const l90Vals  = numParam(registros, "L90");

  const statLeq  = statOf(leqVals);
  const nPontos  = new Set(registros.map(r => r.unidadeAmostral).filter(Boolean)).size;
  const nCampanhas = new Set(registros.map(r => r.campanha).filter(Boolean)).size;

  // CONAMA 001/90 - Zona residencial: 55 dB(A) diurno
  const LIMITE_DIURNO = 55;
  const conformes = leqVals.filter(v => v <= LIMITE_DIURNO).length;
  const taxaConf = leqVals.length > 0 ? Math.round((conformes / leqVals.length) * 100) : null;

  // Per-UA stats
  const byUa: Record<string, number[]> = {};
  registros.forEach(r => {
    const ua = r.unidadeAmostral || "—";
    const v = r.parametros?.["Leq"];
    if (typeof v === "number" && isFinite(v)) {
      if (!byUa[ua]) byUa[ua] = [];
      byUa[ua].push(v);
    }
  });
  const uaLabels = Object.keys(byUa);
  const uaMeans  = uaLabels.map(ua => parseFloat((byUa[ua].reduce((a, b) => a + b, 0) / byUa[ua].length).toFixed(1)));

  if (comParams.length === 0) {
    return (
      <div className="rounded-xl border bg-orange-50 border-orange-200 p-6 text-center text-sm text-orange-700">
        <Volume2 className="w-8 h-8 mx-auto mb-2 text-orange-400" />
        <p className="font-semibold">Nenhum parâmetro de ruído encontrado</p>
        <p className="text-xs mt-1">Importe uma planilha com colunas <code>Leq</code>, <code>Lmax</code>, <code>L90</code>, etc.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Volume2 className="w-5 h-5 text-orange-500" />
        <h2 className="text-lg font-bold text-foreground">Monitoramento de Ruído</h2>
        <Badge variant="outline" className="text-xs">CONAMA 001/90 · ABNT NBR 10151</Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pontos de Medição", value: nPontos, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Campanhas", value: nCampanhas, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Leq Médio (dB)", value: statLeq ? fmtN(statLeq.mean, 1) : "—", color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Conformidade (≤55dB)", value: taxaConf !== null ? `${taxaConf}%` : "—", color: taxaConf !== null && taxaConf >= 80 ? "text-green-600" : "text-red-600", bg: taxaConf !== null && taxaConf >= 80 ? "bg-green-50" : "bg-red-50" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Leq por ponto */}
        {uaLabels.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Leq Médio por Ponto de Monitoramento
                <span className="text-xs font-normal text-red-500 ml-1">— limite 55 dB(A)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ParametroChart
                labels={uaLabels} values={uaMeans}
                label="Leq (dB)" unit="dB(A)"
                limiteLine={LIMITE_DIURNO}
                color="#f97316" chartKey="ruido-ua"
              />
            </CardContent>
          </Card>
        )}

        {/* Tabela de estatísticas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Estatísticas por Parâmetro</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 font-medium text-muted-foreground">Parâmetro</th>
                  <th className="text-right py-1 font-medium text-muted-foreground">n</th>
                  <th className="text-right py-1 font-medium text-muted-foreground">Média</th>
                  <th className="text-right py-1 font-medium text-muted-foreground">Mín</th>
                  <th className="text-right py-1 font-medium text-muted-foreground">Máx</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Leq (dB)", vals: leqVals, limite: 55 },
                  { label: "Lmax (dB)", vals: lmaxVals, limite: undefined },
                  { label: "Lmin (dB)", vals: lminVals, limite: undefined },
                  { label: "L90 (dB)", vals: l90Vals, limite: undefined },
                ].filter(p => p.vals.length > 0).map(p => {
                  const s = statOf(p.vals)!;
                  const acima = p.limite !== undefined ? p.vals.filter(v => v > p.limite!).length : 0;
                  return (
                    <tr key={p.label} className="border-b last:border-0">
                      <td className="py-1.5 font-mono font-semibold">{p.label}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{s.n}</td>
                      <td className={`py-1.5 text-right font-semibold ${p.limite && s.mean > p.limite ? "text-red-600" : "text-foreground"}`}>
                        {fmtN(s.mean, 1)}
                      </td>
                      <td className="py-1.5 text-right text-muted-foreground">{fmtN(s.min, 1)}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{fmtN(s.max, 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {leqVals.length > 0 && (
              <div className="mt-3 rounded-lg p-2 text-xs border" style={{ borderColor: taxaConf !== null && taxaConf >= 80 ? "#22c55e" : "#ef4444", backgroundColor: taxaConf !== null && taxaConf >= 80 ? "#f0fdf4" : "#fef2f2" }}>
                <p className={taxaConf !== null && taxaConf >= 80 ? "text-green-700" : "text-red-700"}>
                  <strong>{leqVals.filter(v => v > LIMITE_DIURNO).length}</strong> de {leqVals.length} medições acima do limite de {LIMITE_DIURNO} dB(A) (zona residencial diurno — CONAMA 001/90).
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela por ponto */}
      {uaLabels.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Resultados por Ponto de Monitoramento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-3 py-2 font-medium">Ponto (UA)</th>
                    <th className="text-right px-3 py-2 font-medium">n med.</th>
                    <th className="text-right px-3 py-2 font-medium">Leq médio</th>
                    <th className="text-right px-3 py-2 font-medium">Lmax</th>
                    <th className="text-right px-3 py-2 font-medium">L90</th>
                    <th className="text-center px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {uaLabels.map(ua => {
                    const leqMean = uaMeans[uaLabels.indexOf(ua)];
                    const uaRegs = registros.filter(r => r.unidadeAmostral === ua);
                    const lmaxMean = statOf(numParam(uaRegs, "Lmax"));
                    const l90Mean  = statOf(numParam(uaRegs, "L90"));
                    const conforme = leqMean <= LIMITE_DIURNO;
                    return (
                      <tr key={ua} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{ua}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{byUa[ua].length}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${!conforme ? "text-red-600" : "text-green-700"}`}>
                          {fmtN(leqMean, 1)} dB
                        </td>
                        <td className="px-3 py-2 text-right">{lmaxMean ? fmtN(lmaxMean.mean, 1) : "—"}</td>
                        <td className="px-3 py-2 text-right">{l90Mean ? fmtN(l90Mean.mean, 1) : "—"}</td>
                        <td className="px-3 py-2 text-center">
                          <Badge className={conforme ? "bg-green-100 text-green-800 text-[10px]" : "bg-red-100 text-red-800 text-[10px]"}>
                            {conforme ? "Conforme" : "Acima limite"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── QualidadeAguaPanel ──────────────────────────────────────────────────────
function QualidadeAguaPanel({ registros }: { registros: { parametros?: Record<string, number | string | null> | null; unidadeAmostral?: string; campanha?: string; data: string }[] }) {
  const comParams = registros.filter(r => r.parametros && Object.keys(r.parametros).length > 0);
  const nEstacoes  = new Set(registros.map(r => r.unidadeAmostral).filter(Boolean)).size;
  const nCampanhas = new Set(registros.map(r => r.campanha).filter(Boolean)).size;

  // CONAMA 357/2005 - Classe 2 (padrão mais comum)
  const LIMITES: Record<string, { op: ">=" | "<=" | "range"; val: number | [number, number]; label: string; unit: string }> = {
    pH:          { op: "range",  val: [6.0, 9.0], label: "pH",      unit: "" },
    OD:          { op: ">=",     val: 5,           label: "OD",      unit: "mg/L" },
    turbidez:    { op: "<=",     val: 100,         label: "Turbidez",unit: "NTU" },
    DBO:         { op: "<=",     val: 5,           label: "DBO",     unit: "mg/L" },
    condutividade:{ op: "<=",   val: 1000,         label: "Condutividade", unit: "µS/cm" },
  };

  const PARAMS_SHOW = [
    { key: "pH",          label: "pH",              unit: "",       color: "#0ea5e9" },
    { key: "OD",          label: "OD (mg/L)",       unit: "mg/L",  color: "#22c55e" },
    { key: "turbidez",    label: "Turbidez (NTU)",  unit: "NTU",   color: "#f59e0b" },
    { key: "condutividade",label: "Condutividade (µS/cm)", unit: "µS/cm", color: "#a855f7" },
    { key: "temperatura", label: "Temperatura (°C)",unit: "°C",    color: "#f97316" },
    { key: "DBO",         label: "DBO (mg/L)",      unit: "mg/L",  color: "#ef4444" },
    { key: "DQO",         label: "DQO (mg/L)",      unit: "mg/L",  color: "#dc2626" },
  ];

  function checkConformidade(key: string, mean: number) {
    const lim = LIMITES[key];
    if (!lim) return null;
    if (lim.op === ">=") return mean >= (lim.val as number);
    if (lim.op === "<=") return mean <= (lim.val as number);
    if (lim.op === "range") { const [lo, hi] = lim.val as [number, number]; return mean >= lo && mean <= hi; }
    return null;
  }

  // Per-station for primary param (pH)
  const byUa: Record<string, number[]> = {};
  registros.forEach(r => {
    const ua = r.unidadeAmostral || "Sem UA";
    const v = r.parametros?.["pH"];
    if (typeof v === "number" && isFinite(v)) {
      if (!byUa[ua]) byUa[ua] = [];
      byUa[ua].push(v);
    }
  });
  const uaLabels = Object.keys(byUa);
  const uaMeans  = uaLabels.map(ua => parseFloat((byUa[ua].reduce((a, b) => a + b, 0) / byUa[ua].length).toFixed(2)));

  if (comParams.length === 0) {
    return (
      <div className="rounded-xl border bg-cyan-50 border-cyan-200 p-6 text-center text-sm text-cyan-700">
        <Waves className="w-8 h-8 mx-auto mb-2 text-cyan-400" />
        <p className="font-semibold">Nenhum parâmetro hídrico encontrado</p>
        <p className="text-xs mt-1">Importe uma planilha com colunas <code>pH</code>, <code>OD</code>, <code>Turbidez</code>, <code>Condutividade</code>, etc.</p>
      </div>
    );
  }

  const paramStats = PARAMS_SHOW.map(p => {
    const vals = numParam(registros, p.key);
    return { ...p, stat: statOf(vals), vals };
  }).filter(p => p.stat !== null);

  const comLimite = paramStats.filter(p => LIMITES[p.key]);
  const totalChecks = comLimite.reduce((acc, p) => acc + p.vals.length, 0);
  const conformeChecks = comLimite.reduce((acc, p) => {
    const lim = LIMITES[p.key];
    return acc + p.vals.filter(v => {
      if (lim.op === ">=") return v >= (lim.val as number);
      if (lim.op === "<=") return v <= (lim.val as number);
      if (lim.op === "range") { const [lo, hi] = lim.val as [number, number]; return v >= lo && v <= hi; }
      return true;
    }).length;
  }, 0);
  const taxaConf = totalChecks > 0 ? Math.round((conformeChecks / totalChecks) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Waves className="w-5 h-5 text-cyan-500" />
        <h2 className="text-lg font-bold text-foreground">Qualidade da Água</h2>
        <Badge variant="outline" className="text-xs">CONAMA 357/2005</Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Estações", value: nEstacoes, color: "text-cyan-600", bg: "bg-cyan-50" },
          { label: "Campanhas", value: nCampanhas, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Parâmetros", value: paramStats.length, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Conformidade (CONAMA)", value: taxaConf !== null ? `${taxaConf}%` : "—", color: taxaConf !== null && taxaConf >= 80 ? "text-green-600" : "text-amber-600", bg: taxaConf !== null && taxaConf >= 80 ? "bg-green-50" : "bg-amber-50" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* pH por estação */}
        {uaLabels.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                pH por Estação de Amostragem
                <span className="text-xs font-normal text-muted-foreground ml-1">(faixa 6.0–9.0 CONAMA 357)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ParametroChart
                labels={uaLabels} values={uaMeans}
                label="pH" unit="pH" limiteLine={9.0}
                color="#0ea5e9" chartKey="agua-ua-ph"
              />
            </CardContent>
          </Card>
        )}

        {/* Parâmetros com conformidade */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Parâmetros vs. CONAMA 357/2005 (Classe 2)</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 font-medium text-muted-foreground">Parâmetro</th>
                  <th className="text-right py-1 font-medium text-muted-foreground">Média</th>
                  <th className="text-right py-1 font-medium text-muted-foreground">Mín</th>
                  <th className="text-right py-1 font-medium text-muted-foreground">Máx</th>
                  <th className="text-center py-1 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {paramStats.map(p => {
                  const conf = checkConformidade(p.key, p.stat!.mean);
                  return (
                    <tr key={p.key} className="border-b last:border-0">
                      <td className="py-1.5 font-medium" style={{ color: p.color }}>{p.label}</td>
                      <td className="py-1.5 text-right font-mono">{fmtN(p.stat!.mean, 2)}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{fmtN(p.stat!.min, 2)}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{fmtN(p.stat!.max, 2)}</td>
                      <td className="py-1.5 text-center">
                        {conf === null
                          ? <span className="text-muted-foreground text-[10px]">—</span>
                          : <Badge className={conf ? "bg-green-100 text-green-800 text-[10px]" : "bg-red-100 text-red-800 text-[10px]"}>{conf ? "OK" : "Alerta"}</Badge>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Tabela por estação */}
      {uaLabels.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Resumo por Estação de Monitoramento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-3 py-2 font-medium">Estação (UA)</th>
                    {paramStats.slice(0, 5).map(p => (
                      <th key={p.key} className="text-right px-3 py-2 font-medium">{p.label.split(" ")[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uaLabels.map(ua => {
                    const uaRegs = registros.filter(r => r.unidadeAmostral === ua);
                    return (
                      <tr key={ua} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{ua}</td>
                        {paramStats.slice(0, 5).map(p => {
                          const vals = numParam(uaRegs, p.key);
                          const s = statOf(vals);
                          const conf = s ? checkConformidade(p.key, s.mean) : null;
                          return (
                            <td key={p.key} className={`px-3 py-2 text-right font-mono ${conf === false ? "text-red-600 font-semibold" : conf === true ? "text-green-700" : "text-muted-foreground"}`}>
                              {s ? fmtN(s.mean, 2) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── SoloPanel ───────────────────────────────────────────────────────────────
function SoloPanel({ registros }: { registros: { parametros?: Record<string, number | string | null> | null; unidadeAmostral?: string; campanha?: string; data: string }[] }) {
  const comParams = registros.filter(r => r.parametros && Object.keys(r.parametros).length > 0);
  const nAmostras  = registros.length;
  const nPontos    = new Set(registros.map(r => r.unidadeAmostral).filter(Boolean)).size;
  const nCampanhas = new Set(registros.map(r => r.campanha).filter(Boolean)).size;

  const PARAMS_SHOW = [
    { key: "pH", label: "pH (H₂O)", unit: "", color: "#0ea5e9" },
    { key: "MO", label: "M.O. (%)", unit: "%", color: "#78716c" },
    { key: "P",  label: "P (mg/dm³)", unit: "mg/dm³", color: "#f59e0b" },
    { key: "K",  label: "K (mg/dm³)", unit: "mg/dm³", color: "#a855f7" },
    { key: "Ca", label: "Ca (cmolc/dm³)", unit: "cmolc/dm³", color: "#22c55e" },
    { key: "Mg", label: "Mg (cmolc/dm³)", unit: "cmolc/dm³", color: "#10b981" },
    { key: "Al", label: "Al (cmolc/dm³)", unit: "cmolc/dm³", color: "#ef4444" },
    { key: "CTC","label": "CTC (cmolc/dm³)", unit: "cmolc/dm³", color: "#6366f1" },
    { key: "V",  label: "V (%)", unit: "%", color: "#f97316" },
    { key: "N",  label: "N (dag/kg)", unit: "dag/kg", color: "#84cc16" },
  ];

  // pH classes EMBRAPA
  function phClass(ph: number) {
    if (ph < 4.0) return { label: "Muito Ácido", color: "#dc2626" };
    if (ph < 5.0) return { label: "Ácido", color: "#f97316" };
    if (ph < 5.5) return { label: "Mod. Ácido", color: "#f59e0b" };
    if (ph < 7.0) return { label: "Adequado", color: "#22c55e" };
    if (ph < 7.5) return { label: "Neutro", color: "#10b981" };
    return { label: "Alcalino", color: "#3b82f6" };
  }

  // V% fertility
  function vClass(v: number) {
    if (v < 40) return { label: "Baixa", color: "#ef4444" };
    if (v < 60) return { label: "Média", color: "#f59e0b" };
    return { label: "Alta", color: "#22c55e" };
  }

  const paramStats = PARAMS_SHOW.map(p => {
    const vals = numParam(registros, p.key);
    return { ...p, stat: statOf(vals) };
  }).filter(p => p.stat !== null);

  const phVals = numParam(registros, "pH");
  const phStat = statOf(phVals);
  const vVals  = numParam(registros, "V");
  const vStat  = statOf(vVals);

  // Per-UA pH
  const byUa: Record<string, number[]> = {};
  registros.forEach(r => {
    const ua = r.unidadeAmostral || "Sem UA";
    const v = r.parametros?.["pH"];
    if (typeof v === "number" && isFinite(v)) {
      if (!byUa[ua]) byUa[ua] = [];
      byUa[ua].push(v);
    }
  });
  const uaLabels = Object.keys(byUa);
  const uaMeans  = uaLabels.map(ua => parseFloat((byUa[ua].reduce((a, b) => a + b, 0) / byUa[ua].length).toFixed(2)));

  if (comParams.length === 0) {
    return (
      <div className="rounded-xl border bg-yellow-50 border-yellow-200 p-6 text-center text-sm text-yellow-700">
        <Layers className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
        <p className="font-semibold">Nenhum parâmetro de solo encontrado</p>
        <p className="text-xs mt-1">Importe uma planilha com colunas <code>pH</code>, <code>MO</code>, <code>P</code>, <code>K</code>, <code>Ca</code>, <code>Mg</code>, etc.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Layers className="w-5 h-5 text-yellow-600" />
        <h2 className="text-lg font-bold text-foreground">Monitoramento de Solo</h2>
        <Badge variant="outline" className="text-xs">EMBRAPA — Manual de Análises Químicas</Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Amostras", value: nAmostras, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Pontos de Coleta", value: nPontos, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Campanhas", value: nCampanhas, color: "text-blue-600", bg: "bg-blue-50" },
          { label: phStat ? `pH médio (${phClass(phStat.mean).label})` : "pH médio", value: phStat ? fmtN(phStat.mean, 2) : "—", phColor: phStat ? phClass(phStat.mean).color : undefined, bg: "bg-muted" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
              <p className="text-2xl font-bold" style={{ color: (k as any).phColor || (k as any).color }}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* pH por ponto */}
        {uaLabels.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">pH por Ponto de Coleta</CardTitle>
            </CardHeader>
            <CardContent>
              <ParametroChart
                labels={uaLabels} values={uaMeans}
                label="pH" unit="pH"
                color="#eab308" chartKey="solo-ua-ph"
              />
              <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                {[
                  { label: "Muito Ácido", range: "< 4.0", color: "#dc2626" },
                  { label: "Ácido", range: "4.0–5.0", color: "#f97316" },
                  { label: "Mod. Ácido", range: "5.0–5.5", color: "#f59e0b" },
                  { label: "Adequado", range: "5.5–7.0", color: "#22c55e" },
                  { label: "Alcalino", range: "> 7.0", color: "#3b82f6" },
                ].map(c => (
                  <span key={c.label} className="flex items-center gap-1 px-1.5 py-0.5 rounded border" style={{ borderColor: c.color, color: c.color }}>
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                    {c.label} ({c.range})
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Parâmetros tabela */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Análise Química — Estatísticas</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 font-medium text-muted-foreground">Parâmetro</th>
                  <th className="text-right py-1 font-medium text-muted-foreground">n</th>
                  <th className="text-right py-1 font-medium text-muted-foreground">Média</th>
                  <th className="text-right py-1 font-medium text-muted-foreground">Mín</th>
                  <th className="text-right py-1 font-medium text-muted-foreground">Máx</th>
                </tr>
              </thead>
              <tbody>
                {paramStats.map(p => (
                  <tr key={p.key} className="border-b last:border-0">
                    <td className="py-1.5 font-medium" style={{ color: p.color }}>{p.label}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{p.stat!.n}</td>
                    <td className="py-1.5 text-right font-mono">{fmtN(p.stat!.mean, 2)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{fmtN(p.stat!.min, 2)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{fmtN(p.stat!.max, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {vStat && (
              <div className="mt-3 rounded-lg p-2 text-xs border" style={{ borderColor: vClass(vStat.mean).color, backgroundColor: vClass(vStat.mean).color + "18" }}>
                <p style={{ color: vClass(vStat.mean).color }}>
                  Saturação de Bases (V%): média <strong>{fmtN(vStat.mean, 1)}%</strong> —
                  Fertilidade <strong>{vClass(vStat.mean).label}</strong>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela por ponto */}
      {uaLabels.length > 0 && paramStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Resultados por Ponto de Coleta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-3 py-2 font-medium">Ponto (UA)</th>
                    {paramStats.slice(0, 6).map(p => (
                      <th key={p.key} className="text-right px-3 py-2 font-medium">{p.key}</th>
                    ))}
                    <th className="text-center px-3 py-2 font-medium">pH Class.</th>
                  </tr>
                </thead>
                <tbody>
                  {uaLabels.map(ua => {
                    const uaRegs = registros.filter(r => r.unidadeAmostral === ua);
                    const phMean = statOf(numParam(uaRegs, "pH"));
                    return (
                      <tr key={ua} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{ua}</td>
                        {paramStats.slice(0, 6).map(p => {
                          const s = statOf(numParam(uaRegs, p.key));
                          return <td key={p.key} className="px-3 py-2 text-right font-mono">{s ? fmtN(s.mean, 2) : "—"}</td>;
                        })}
                        <td className="px-3 py-2 text-center">
                          {phMean && (
                            <Badge className="text-[10px]" style={{ backgroundColor: phClass(phMean.mean).color + "20", color: phClass(phMean.mean).color, borderColor: phClass(phMean.mean).color }}>
                              {phClass(phMean.mean).label}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── FloraPanel ─ (phytosociology stub, reuses biodiversity where applicable) ─
// Flora uses the existing biodiversity section, no separate panel needed.

// ── F5: Painel de Histórico de Alterações ────────────────────────────────────
function CampoAuditLogPanel({ registroId }: { registroId: number }) {
  const [expanded, setExpanded] = useState(false);
  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/campo", registroId, "audit"],
    queryFn: async () => {
      const res = await fetch(`/api/campo/${registroId}/audit`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: expanded,
  });
  const fmtDate = (d: any) => {
    try { return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return ""; }
  };
  const acaoBadge: Record<string, string> = {
    create: "bg-emerald-100 text-emerald-800 border-emerald-300",
    update: "bg-amber-100 text-amber-800 border-amber-300",
    delete: "bg-red-100 text-red-800 border-red-300",
  };
  const acaoLabel: Record<string, string> = { create: "Criado", update: "Editado", delete: "Excluído" };
  return (
    <div className="rounded-md border border-muted bg-muted/30 text-xs mb-2">
      <button type="button"
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/60 transition-colors"
        onClick={() => setExpanded(v => !v)}>
        <span className="flex items-center gap-2 font-medium text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          Histórico de alterações
        </span>
        <span className="text-muted-foreground/70">{expanded ? "ocultar" : "mostrar"}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-1.5 max-h-48 overflow-y-auto">
          {isLoading ? (
            <p className="text-muted-foreground italic py-2">Carregando…</p>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground italic py-2">Sem alterações registradas.</p>
          ) : logs.map((l: any) => (
            <div key={l.id} className="flex items-start gap-2 py-1 border-b border-muted/50 last:border-0">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${acaoBadge[l.acao] || ""}`}>
                {acaoLabel[l.acao] || l.acao}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px]">
                  <span className="font-medium">{l.userName || "—"}</span>
                  <span className="text-muted-foreground"> · {fmtDate(l.criadoEm)}</span>
                </p>
                {Array.isArray(l.camposAlterados) && l.camposAlterados.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Campos: <span className="font-mono">{l.camposAlterados.slice(0, 8).join(", ")}{l.camposAlterados.length > 8 ? "…" : ""}</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CampoMonitoramento() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedEmpId, setSelectedEmpId] = useState<string>("todos");
  const [filterCampanha, setFilterCampanha] = useState<string>("todas");
  const [filterCampanhasMulti, setFilterCampanhasMulti] = useState<Set<string>>(new Set());
  const [filterProjeto, setFilterProjeto] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [filterGrupo, setFilterGrupo] = useState("todos");
  const [bioMode, setBioMode] = useState<"geral" | "por_ua">("geral");
  const [bioAnalysisTab, setBioAnalysisTab] = useState<"geral"|"curvas"|"composicao"|"beta"|"multivariada"|"biometria"|"cpue">("geral");
  const [openAnalysisTabs, setOpenAnalysisTabs] = useState<Set<string>>(new Set());
  const toggleAnalysisTab = (id: string) => setOpenAnalysisTabs(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const expandAllTabs = () => setOpenAnalysisTabs(new Set(["geral","curvas","composicao","beta","multivariada","biometria","cpue"]));
  const collapseAllTabs = () => setOpenAnalysisTabs(new Set());
  const [groupViewMode, setGroupViewMode] = useState<"ua" | "campanha" | "localizacao">("ua");
  const [filterLocalizacao, setFilterLocalizacao] = useState<string>("todas");
  const [selectedUA, setSelectedUA] = useState<string>("");
  const [dendroMetric, setDendroMetric] = useState<"jaccard" | "bray-curtis" | "sorensen">("jaccard");
  const [activeIndexInfo, setActiveIndexInfo] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<CampoRegistro | null>(null);
  const [editingRecord, setEditingRecord] = useState<CampoRegistro | null>(null);
  const [editForm, setEditForm] = useState<Partial<CampoRegistro>>({});
  const [editFotos, setEditFotos] = useState<any[]>([]);
  const editFotoFileRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortCol, setSortCol] = useState<string>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isNewRecordOpen, setIsNewRecordOpen] = useState(false);
  const [importCampoOpen, setImportCampoOpen] = useState(false);
  // F9: Detecção de outliers ecológicos
  const [outliersOpen, setOutliersOpen] = useState(false);
  const [outliersLoading, setOutliersLoading] = useState(false);
  const [outliersData, setOutliersData] = useState<any | null>(null);
  const [outliersError, setOutliersError] = useState<string | null>(null);
  const [showOutliersOnMap, setShowOutliersOnMap] = useState(true);
  const [mapFocus, setMapFocus] = useState<{ id: number; nonce: number } | null>(null);
  const outlierIdSet = useMemo(() => {
    if (!showOutliersOnMap || !outliersData?.outliers?.length) return null;
    return new Set<number>(outliersData.outliers.map((o: any) => o.registroId));
  }, [outliersData, showOutliersOnMap]);
  // F10: Alertas inteligentes (espécie ausente / queda de riqueza)
  const [alertasOpen, setAlertasOpen] = useState(false);
  const [alertasLoading, setAlertasLoading] = useState(false);
  const [alertasData, setAlertasData] = useState<any | null>(null);
  const [alertasError, setAlertasError] = useState<string | null>(null);
  // helper: faz fetch tolerante a respostas não-JSON (HTML quando sessão expira)
  const fetchJsonOrThrow = async (url: string, defaultErr: string) => {
    let r: Response;
    try { r = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } }); }
    catch (e: any) { throw new Error(e?.message ? `Falha de rede: ${e.message}` : 'Falha de rede ao conectar ao servidor'); }
    const ct = r.headers.get('content-type') || '';
    if (r.status === 401) throw new Error('Sessão expirada. Recarregue a página e faça login novamente.');
    if (r.status === 403) throw new Error('Sem permissão para acessar este recurso.');
    if (!ct.includes('application/json')) {
      throw new Error(`Resposta inesperada do servidor (HTTP ${r.status}). Recarregue a página e tente novamente.`);
    }
    let j: any;
    try { j = await r.json(); }
    catch (e: any) { throw new Error('Resposta do servidor inválida (JSON malformado).'); }
    if (!r.ok) throw new Error(j?.message || `${defaultErr} (HTTP ${r.status})`);
    return j;
  };
  const fetchAlertas = async () => {
    setAlertasOpen(true);
    setAlertasLoading(true);
    setAlertasData(null);
    setAlertasError(null);
    try {
      setAlertasData(await fetchJsonOrThrow('/api/campo/alertas-inteligentes', 'Falha ao consultar alertas'));
    } catch (e: any) {
      setAlertasError(e?.message || 'Falha ao consultar alertas');
    } finally { setAlertasLoading(false); }
  };
  const fetchOutliers = async () => {
    setOutliersOpen(true);
    setOutliersLoading(true);
    setOutliersData(null);
    setOutliersError(null);
    try {
      setOutliersData(await fetchJsonOrThrow('/api/campo/outliers', 'Falha ao consultar outliers'));
    } catch (e: any) {
      setOutliersError(e?.message || 'Falha ao consultar outliers');
    } finally { setOutliersLoading(false); }
  };
  const [newForm, setNewForm] = useState<Partial<CampoRegistro>>({ grupoTaxonomico: "aves", data: new Date().toISOString().split("T")[0] });
  const [draftRestored, setDraftRestored] = useState(false);
  const DRAFT_KEY = "campo-draft-v1";

  // F7: estados da identificação por IA
  const [iaOpen, setIaOpen] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaSuggestions, setIaSuggestions] = useState<Array<{ nomeCientifico: string; nomeComum?: string; confianca?: number; justificativa?: string }>>([]);
  const iaFotoRef = useRef<HTMLInputElement>(null);

  async function handleIdentifyPhoto(file: File) {
    if (!file) return;
    setIaLoading(true);
    setIaOpen(true);
    setIaSuggestions([]);
    try {
      const blob = await compressImage(file, 1280, 0.82);
      const fd = new FormData();
      fd.append("foto", new File([blob], "foto.jpg", { type: "image/jpeg" }));
      fd.append("grupo", String((editForm as any).grupoTaxonomico || "fauna"));
      const res = await fetch("/api/campo/identify-photo", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Falha na identificação");
      }
      const data = await res.json();
      setIaSuggestions(Array.isArray(data.sugestoes) ? data.sugestoes : []);
    } catch (err: any) {
      toast({ title: "Erro na identificação por IA", description: err.message, variant: "destructive" });
      setIaOpen(false);
    } finally {
      setIaLoading(false);
    }
  }
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareMode, setCompareMode] = useState<"campanhas" | "empreendimentos">("campanhas");
  const [compareCampA, setCompareCampA] = useState("todas");
  const [compareCampB, setCompareCampB] = useState("todas");
  const [compareEmpA, setCompareEmpA] = useState<string>("todos");
  const [compareEmpB, setCompareEmpB] = useState<string>("todos");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(["dendrograma", "beta-matrix"]));
  const [heatMode, setHeatMode]       = useState<"spUa" | "campSp" | "uaCamp">("spUa");
  const [heatMetric, setHeatMetric]   = useState<HeatMetric>("count");
  const [rarefMode, setRarefMode]     = useState<"campanha" | "ua">("campanha");
  const [hillMode, setHillMode]       = useState<"campanha" | "ua">("campanha");
  const [indvalGroupBy, setIndvalGroupBy] = useState<"campanha" | "ua" | "posicao">("campanha");
  const [nmdsJusanteUas, setNmdsJusanteUas] = useState<Set<string>>(new Set());
  const [selectedMultiUas, setSelectedMultiUas] = useState<Set<string>>(new Set());
  const [multiMode, setMultiMode] = useState<"ua"|"campanha"|"posicao">("ua");
  const [selectedMultiCamps, setSelectedMultiCamps] = useState<Set<string>>(new Set());
  const [multiFilterOpen, setMultiFilterOpen] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fotoFileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({ queryKey: ["/api/empreendimentos"] });

  // Projects for the selected empreendimento
  const { data: sysProjetos = [] } = useQuery<SysProjeto[]>({
    queryKey: ["/api/projetos", selectedEmpId],
    queryFn: async () => {
      if (selectedEmpId === "todos") return [];
      const res = await fetch(`/api/projetos?empreendimentoId=${selectedEmpId}`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: selectedEmpId !== "todos",
  });

  // All campaigns for the selected empreendimento (project is for context only, not strict filtering)
  const { data: sysCampanhas = [] } = useQuery<SysCampanha[]>({
    queryKey: ["/api/empreendimentos", selectedEmpId, "campanhas"],
    queryFn: async () => {
      if (selectedEmpId === "todos") return [];
      const res = await fetch(`/api/empreendimentos/${selectedEmpId}/campanhas`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: selectedEmpId !== "todos",
  });

  // Conformidade — condicionantes vinculadas ao empreendimento selecionado
  const { data: condicionantesConf = [] } = useQuery<any[]>({
    queryKey: ["/api/campo/conformidade", selectedEmpId],
    queryFn: async () => {
      if (selectedEmpId === "todos") return [];
      const res = await fetch(`/api/campo/conformidade?empreendimentoId=${selectedEmpId}`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: selectedEmpId !== "todos",
  });

  const empParam = selectedEmpId !== "todos" ? `&empreendimentoId=${selectedEmpId}` : "";
  const empParamStats = selectedEmpId !== "todos" ? `?empreendimentoId=${selectedEmpId}` : "";

  const { data: registros = [], isLoading, refetch } = useQuery<CampoRegistro[]>({
    queryKey: ["/api/campo", selectedEmpId],
    queryFn: async () => {
      const res = await fetch(`/api/campo?limit=2000${empParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar");
      return res.json();
    },
  });

  // All registros (all empreendimentos) for cross-project comparison
  const { data: allRegistros = [] } = useQuery<CampoRegistro[]>({
    queryKey: ["/api/campo/all-for-compare"],
    queryFn: async () => {
      const res = await fetch("/api/campo?limit=5000", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: compareOpen && compareMode === "empreendimentos",
    staleTime: 60_000,
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/campo/stats/dashboard", selectedEmpId],
    queryFn: async () => {
      const res = await fetch(`/api/campo/stats/dashboard${empParamStats}`, { credentials: "include" });
      return res.ok ? res.json() : null;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/campo/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campo/stats/dashboard"] });
      toast({ title: "Registro excluído" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => apiRequest("DELETE", "/api/campo", { ids }),
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campo/stats/dashboard"] });
      setSelectedIds(new Set());
      toast({ title: `${ids.length} registro(s) excluído(s)` });
    },
  });

  const backfillMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/campo/backfill", {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campo/stats/dashboard"] });
      toast({ title: `Preenchimento automático concluído`, description: `${data.updated} de ${data.total} registros atualizados com IUCN, MMA, CITES e PAN` });
    },
    onError: (err: any) => {
      toast({ title: "Erro no preenchimento", description: err.message, variant: "destructive" });
    },
  });

  // ── Quota de fotos por registro ────────────────────────────────────────
  const MAX_FOTOS_POR_REGISTRO = 8;

  // ── Foto helpers ──────────────────────────────────────────────────────────
  async function compressImage(file: File, maxPx = 1920, quality = 0.85): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("Falha ao comprimir imagem")), "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function handleFotoUpload(registroId: number, files: FileList | null) {
    if (!files?.length) return;
    const atuais = viewingRecord?.fotos?.length || 0;
    const disponivel = MAX_FOTOS_POR_REGISTRO - atuais;
    if (disponivel <= 0) {
      toast({ title: `Limite de ${MAX_FOTOS_POR_REGISTRO} fotos atingido`, description: "Remova alguma foto antes de enviar mais.", variant: "destructive" });
      return;
    }
    const lista = Array.from(files).slice(0, disponivel);
    if (files.length > disponivel) {
      toast({ title: `Apenas ${disponivel} foto(s) serão enviadas`, description: `Limite de ${MAX_FOTOS_POR_REGISTRO} fotos por registro.`, variant: "destructive" });
    }
    setUploadingFoto(true);
    let totalOriginal = 0; let totalFinal = 0;
    try {
      for (const file of lista) {
        const blob = await compressImage(file);
        totalOriginal += file.size; totalFinal += blob.size;
        const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
        const fd = new FormData();
        fd.append("foto", compressed);
        const res = await fetch(`/api/campo/${registroId}/fotos`, { method: "POST", body: fd, credentials: "include" });
        if (!res.ok) throw new Error("Falha no upload");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
      // Update viewingRecord fotos in-place
      const updated = await fetch(`/api/campo/${registroId}`, { credentials: "include" });
      if (updated.ok) setViewingRecord(await updated.json());
      const economia = totalOriginal > 0 ? Math.round((1 - totalFinal / totalOriginal) * 100) : 0;
      toast({
        title: `${lista.length} foto(s) enviada(s)`,
        description: `Compressão: ${(totalOriginal/1024).toFixed(0)}KB → ${(totalFinal/1024).toFixed(0)}KB · economia ${economia}%`,
      });
    } catch (err: any) {
      toast({ title: "Erro ao enviar foto", description: err.message, variant: "destructive" });
    } finally {
      setUploadingFoto(false);
      if (fotoFileRef.current) fotoFileRef.current.value = "";
    }
  }

  async function handleFotoDelete(fotoId: number, registroId: number) {
    try {
      await apiRequest("DELETE", `/api/campo/fotos/${fotoId}`);
      const updated = await fetch(`/api/campo/${registroId}`, { credentials: "include" });
      if (updated.ok) setViewingRecord(await updated.json());
      toast({ title: "Foto removida" });
    } catch (err: any) {
      toast({ title: "Erro ao remover foto", description: err.message, variant: "destructive" });
    }
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CampoRegistro> }) => {
      // Strip system/read-only fields and relation fields before sending
      const { id: _id, criadoEm: _c, atualizadoEm: _a, sincronizado: _s, fotos: _f, ...rest } = data as any;
      // Replace undefined with null so server receives valid JSON
      const sanitized = Object.fromEntries(
        Object.entries(rest).map(([k, v]) => [k, v === undefined ? null : v])
      );
      return apiRequest("PUT", `/api/campo/${id}`, sanitized);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campo/stats/dashboard"] });
      setEditingRecord(null);
      setEditFotos([]);
      toast({ title: "Registro atualizado com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar registro", description: err?.message || "Tente novamente", variant: "destructive" });
    },
  });

  // ── F2: Auto-save de rascunho no localStorage (debounced 500ms) ──────
  useEffect(() => {
    if (!isNewRecordOpen) return;
    const t = setTimeout(() => {
      try {
        const hasData = Object.entries(newForm).some(([k, v]) =>
          v !== "" && v !== undefined && v !== null && !(k === "grupoTaxonomico" && v === "aves") && !(k === "data")
        );
        if (hasData) localStorage.setItem(DRAFT_KEY, JSON.stringify(newForm));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [newForm, isNewRecordOpen]);

  // ── F2: Restaura rascunho quando dialog abre ───────────────────────────
  useEffect(() => {
    if (!isNewRecordOpen) { setDraftRestored(false); return; }
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && typeof draft === "object" && Object.keys(draft).length > 0) {
        setNewForm(draft);
        setDraftRestored(true);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewRecordOpen]);

  // ── F3: Atalhos de teclado globais ────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || (e.target as HTMLElement)?.isContentEditable;
      // Ctrl/Cmd combos work even when typing
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        exportExcel();
        return;
      }
      // Ignore single-key shortcuts when user is typing in an input
      if (typing) return;
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setIsNewRecordOpen(true);
        return;
      }
      if (e.key === "i" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setImportCampoOpen(true);
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        setShortcutsHelpOpen(true);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createMutation = useMutation({
    mutationFn: async (data: Partial<CampoRegistro>) => {
      const res = await apiRequest("POST", "/api/campo", data);
      return res.json().catch(() => ({}));
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campo/stats/dashboard"] });
      setIsNewRecordOpen(false);
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setDraftRestored(false);
      setNewForm({ grupoTaxonomico: "aves", data: new Date().toISOString().split("T")[0] });
      if (data?.isNewSpecies) {
        toast({
          title: "🚨 Primeira ocorrência registrada!",
          description: `${data.nomeCientifico || "Nova espécie"} — primeira detecção neste empreendimento.`,
          duration: 7000,
        });
      } else {
        toast({ title: "Registro criado com sucesso" });
      }
    },
    onError: () => toast({ title: "Erro ao criar registro", variant: "destructive" }),
  });

  function toggleSection(id: string) {
    setCollapsedSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function openEdit(r: CampoRegistro) {
    setEditingRecord(r);
    setEditForm({ ...r });
    setEditFotos([]);
    // Load fotos for this record
    try {
      const res = await fetch(`/api/campo/${r.id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEditFotos(data.fotos || []);
      }
    } catch {}
  }

  async function handleEditFotoUpload(files: FileList | null) {
    if (!files?.length || !editingRecord) return;
    const atuais = editFotos.length;
    const disponivel = MAX_FOTOS_POR_REGISTRO - atuais;
    if (disponivel <= 0) {
      toast({ title: `Limite de ${MAX_FOTOS_POR_REGISTRO} fotos atingido`, description: "Remova alguma foto antes de enviar mais.", variant: "destructive" });
      return;
    }
    const lista = Array.from(files).slice(0, disponivel);
    if (files.length > disponivel) {
      toast({ title: `Apenas ${disponivel} foto(s) serão enviadas`, description: `Limite de ${MAX_FOTOS_POR_REGISTRO} fotos por registro.`, variant: "destructive" });
    }
    setUploadingFoto(true);
    let totalOriginal = 0; let totalFinal = 0;
    try {
      for (const file of lista) {
        const blob = await compressImage(file);
        totalOriginal += file.size; totalFinal += blob.size;
        const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
        const fd = new FormData();
        fd.append("foto", compressed);
        const res = await fetch(`/api/campo/${editingRecord.id}/fotos`, { method: "POST", body: fd, credentials: "include" });
        if (!res.ok) throw new Error("Falha no upload");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
      // Refresh fotos list in edit modal
      const updated = await fetch(`/api/campo/${editingRecord.id}`, { credentials: "include" });
      if (updated.ok) {
        const data = await updated.json();
        setEditFotos(data.fotos || []);
      }
      const economia = totalOriginal > 0 ? Math.round((1 - totalFinal / totalOriginal) * 100) : 0;
      toast({
        title: `${lista.length} foto(s) enviada(s)`,
        description: `Compressão: ${(totalOriginal/1024).toFixed(0)}KB → ${(totalFinal/1024).toFixed(0)}KB · economia ${economia}%`,
      });
    } catch (err: any) {
      toast({ title: "Erro ao enviar foto", description: err.message, variant: "destructive" });
    } finally {
      setUploadingFoto(false);
      if (editFotoFileRef.current) editFotoFileRef.current.value = "";
    }
  }

  async function handleEditFotoDelete(fotoId: number) {
    if (!editingRecord) return;
    try {
      await apiRequest("DELETE", `/api/campo/fotos/${fotoId}`);
      setEditFotos(prev => prev.filter(f => f.id !== fotoId));
      toast({ title: "Foto removida" });
    } catch (err: any) {
      toast({ title: "Erro ao remover foto", description: err.message, variant: "destructive" });
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === tableData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tableData.map(r => r.id)));
    }
  }


  function handleRefresh() {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/campo/stats/dashboard"] });
    toast({ title: "Dados atualizados" });
  }

  // ── Filtros de campanha + grupo + datas (usados nos cálculos de bio) ──────
  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => {
      const matchCampanha = filterCampanhasMulti.size > 0
        ? Array.from(filterCampanhasMulti).some(c => campanhaMatch(r.campanha, c))
        : (filterCampanha === "todas" || campanhaMatch(r.campanha, filterCampanha));
      const matchGrupo = filterGrupo === "todos" || normalizeGrupoKey(r.grupoTaxonomico) === normalizeGrupoKey(filterGrupo);
      const matchDateFrom = !dateFrom || (r.data && r.data >= dateFrom);
      const matchDateTo = !dateTo || (r.data && r.data <= dateTo);
      const matchLocalizacao = filterLocalizacao === "todas" ||
        (r.localizacao || "").toLowerCase().trim() === filterLocalizacao.toLowerCase().trim();
      return matchCampanha && matchGrupo && matchDateFrom && matchDateTo && matchLocalizacao;
    });
  }, [registros, filterCampanha, filterCampanhasMulti, filterGrupo, dateFrom, dateTo, filterLocalizacao]);

  // ── Contagem de registros por grupo (sobre TODOS os registros, para o seletor) ─
  const allGroupStats = useMemo(() => {
    const counts: Record<string, number> = {};
    registros.forEach(r => { if (r.grupoTaxonomico) counts[r.grupoTaxonomico] = (counts[r.grupoTaxonomico] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [registros]);

  const unknownGroups = useMemo(
    () => allGroupStats.map(([g]) => g).filter(g => !GRUPO_CONFIG[g]),
    [allGroupStats]
  );

  // Merge system campaigns (from DB) with any mentioned in field records
  // MUST be declared before campProgresso / gruposByCamp to avoid TDZ in prod build
  const campanhas = useMemo(() => {
    const fromRecords = registros.filter(r => r.campanha).map(r => r.campanha!);
    const fromSystem = sysCampanhas.map(c => c.nome);
    return [...new Set([...fromSystem, ...fromRecords])].sort(natSort);
  }, [registros, sysCampanhas]);

  // ── Dados por UA (sempre calculado sobre todos os registros filtrados) ────────
  const uaData          = useMemo(() => byUaStats(registrosFiltrados), [registrosFiltrados]);
  const campData        = useMemo(() => byGroupStats(registrosFiltrados, r => r.campanha), [registrosFiltrados]);
  const localizacaoData = useMemo(() => {
    // Primary: use the LOCALIZAÇÃO column when filled
    const direct = byGroupStats(registrosFiltrados, r => r.localizacao || null);
    if (direct.length > 0) return direct;
    // Fallback: derive Jusante/Montante from the multivariada configuration (nmdsJusanteUas).
    // When localizacao is empty but UAs exist, classify by position (UA-based).
    const allUas = [...new Set(registrosFiltrados.map(r => r.unidadeAmostral).filter(Boolean) as string[])];
    if (allUas.length < 2) return direct;
    const jusante: Set<string> = nmdsJusanteUas.size > 0 ? nmdsJusanteUas : new Set(allUas.slice(0, 1));
    return byGroupStats(registrosFiltrados, r => {
      const ua = r.unidadeAmostral?.trim();
      if (!ua) return null;
      return jusante.has(ua) ? "Jusante" : "Montante";
    });
  }, [registrosFiltrados, nmdsJusanteUas]);
  // Distinct localizacao values present in all (non-filtered) registros for the filter dropdown
  const localizacaoOpts = useMemo(() => [...new Set(registros.map(r => r.localizacao?.trim()).filter(Boolean) as string[])].sort(), [registros]);
  const campProgresso = useMemo(() => buildCampanhaProgress(registrosFiltrados, campanhas), [registrosFiltrados, campanhas]);
  const gruposByCamp  = useMemo(() => buildGruposByCampanha(registrosFiltrados, campanhas), [registrosFiltrados, campanhas]);

  // Lista de UAs disponíveis para o seletor
  const uaList = useMemo(() => uaData.map(d => d.ua), [uaData]);

  // Fonte de cálculo: geral ou somente a UA selecionada
  const statsSource = useMemo(() => {
    if (bioMode === "por_ua" && selectedUA) {
      return registrosFiltrados.filter(r => r.unidadeAmostral === selectedUA);
    }
    return registrosFiltrados;
  }, [registrosFiltrados, bioMode, selectedUA]);

  // ── Cálculos de biodiversidade ─────────────────────────────────────────────
  const bioStats = useMemo(() => {
    if (!statsSource.length) return null;

    const spCounts: Record<string, number> = {};
    const spByUa: Record<string, Set<string>> = {};
    statsSource.forEach(r => {
      const sp = r.nomeCientifico?.trim().toUpperCase();
      if (!sp) return;
      spCounts[sp] = (spCounts[sp] || 0) + 1;
      if (!spByUa[sp]) spByUa[sp] = new Set();
      if (r.unidadeAmostral) spByUa[sp].add(r.unidadeAmostral);
    });

    const counts = Object.values(spCounts);
    const Sobs = counts.length;
    const N = counts.reduce((s, c) => s + c, 0);
    const H = shannonH(counts);
    const D = simpsonD(counts);
    const J = pielouJ(counts);
    const jack1 = jackknife1(spByUa);
    const jack2 = jackknife2(spByUa);
    const boot = bootstrapS(spByUa);
    const chao1val = chao1(spCounts);
    const chao2val = chao2(spByUa);
    const margalefVal = margalef(Sobs, N);
    const menhinickVal = menhinick(Sobs, N);
    const bergerParkerVal = N > 0 ? Math.max(...counts) / N : 0;

    // Riqueza taxonômica
    const nOrdens = new Set(statsSource.map(r => r.ordem).filter(Boolean)).size;
    const nFamilias = new Set(statsSource.map(r => r.familia).filter(Boolean)).size;

    const ice = iceEstimator(spByUa);
    const accum = accumulationCurve(statsSource);
    const freqRel = relativeFrequency(statsSource, Infinity);
    const metodoData = byMetodo(statsSource);
    const ua = matrizUa(statsSource);
    const threatened = (() => {
      const seen = new Set<string>();
      return statsSource.filter(r => {
        const iucn = toIucnSigla(r.iucn);
        const mma  = toMmaSigla(r.ibamaMma);
        return (iucn && ["VU","EN","CR","EW","EX","NT","DD"].includes(iucn)) ||
               (mma  && ["VU","EN","CR","EW","EX","NT","DD"].includes(mma))  ||
               !!toCitesSigla(r.cites) || hasPan(r.pan);
      }).filter(r => {
        const key = r.nomeCientifico?.trim().toUpperCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })();
    const topSp = Object.entries(spCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Novas análises
    const rankAbund = rankAbundance(spCounts);
    const rareSpecies = rareSpeciesList(spCounts);
    const byPeriodo = byDimensao(statsSource, r => r.periodo);
    const byAmbiente = byDimensao(statsSource, r => r.ambiente || r.ambientePreferencial);
    const byFamilia = byDimensao(statsSource, r => r.familia, 12, "richness");
    const byOrdem = byDimensao(statsSource, r => r.ordem, 12, "richness");
    const betaMatrix = betaJaccardMatrix(statsSource);
    const newSpDay = newSpeciesPerDay(statsSource);

    // Sensibilidade ambiental (alta / média / baixa)
    const bySensibilidade = (() => {
      const cats: Record<string, { spp: Set<string>; n: number }> = {};
      statsSource.forEach(r => {
        const raw = r.sensibilidade?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (!raw) return;
        const key = raw === "media" ? "média" : raw;
        if (!cats[key]) cats[key] = { spp: new Set(), n: 0 };
        if (r.nomeCientifico) cats[key].spp.add(r.nomeCientifico.trim().toUpperCase());
        cats[key].n++;
      });
      const ORDER = ["alta", "média", "baixa"];
      const known = ORDER.filter(k => cats[k]).map(k => ({ label: k.charAt(0).toUpperCase() + k.slice(1), abundancia: cats[k].n, riqueza: cats[k].spp.size }));
      const others = Object.keys(cats).filter(k => !ORDER.includes(k)).map(k => ({ label: k, abundancia: cats[k].n, riqueza: cats[k].spp.size }));
      return [...known, ...others];
    })();

    // Guilda trófica (dieta)
    const byDieta: Record<string, number> = {};
    statsSource.forEach(r => {
      const d = r.dieta?.trim();
      if (d) byDieta[d] = (byDieta[d] || 0) + 1;
    });

    // ── Heatmap 1: Espécies × Unidade Amostral (composição da comunidade)
    const heatSpUa = buildHeatmap(
      statsSource,
      r => r.nomeCientifico?.trim() || null,
      r => r.unidadeAmostral?.trim() || null,
    );

    // ── Heatmap 2: Campanha × Espécies (sazonalidade / detecção)
    const heatCampSp = buildHeatmap(
      statsSource,
      r => r.campanha?.trim() || "(sem campanha)",
      r => r.nomeCientifico?.trim() || null,
    );

    // ── Heatmap 3: Unidade Amostral × Campanha (estabilidade / distúrbios)
    const heatUaCamp = buildHeatmap(
      statsSource,
      r => r.unidadeAmostral?.trim() || null,
      r => r.campanha?.trim() || "(sem campanha)",
    );

    // Espécies com interesse comercial (CITES) — únicas
    const citesSeen = new Set<string>();
    const citesCount = statsSource.filter(r => {
      if (!toCitesSigla(r.cites)) return false;
      const key = r.nomeCientifico?.trim().toUpperCase();
      if (!key || citesSeen.has(key)) return false;
      citesSeen.add(key);
      return true;
    }).length;

    return {
      Sobs, N, H, D, J, jack1, jack2, boot, chao1: chao1val, chao2: chao2val,
      margalef: margalefVal, menhinick: menhinickVal, bergerParker: bergerParkerVal, ice,
      nOrdens, nFamilias,
      accum, freqRel, metodoData, ua, threatened, citesCount, topSp,
      rankAbund, rareSpecies, byPeriodo, byAmbiente, byFamilia, byOrdem, betaMatrix,
      bySensibilidade, byDieta, newSpDay, heatSpUa, heatCampSp, heatUaCamp,
    };
  }, [statsSource]);

  // Rarefação por campanha
  const rarefacaoByCamp = useMemo(() => {
    if (!registrosFiltrados.length) return [];
    if (!campanhas.length) return rarefactionByCampanha(registrosFiltrados, []);
    return rarefactionByCampanha(registrosFiltrados, campanhas.slice(0, 10));
  }, [registrosFiltrados, campanhas]);

  // Rarefação por unidade amostral
  const rarefacaoByUA = useMemo(() => {
    if (!registrosFiltrados.length) return [];
    return rarefactionByUA(registrosFiltrados);
  }, [registrosFiltrados]);

  // Série ativa conforme modo selecionado
  const rarefacaoSeries = rarefMode === "ua" ? rarefacaoByUA : rarefacaoByCamp;

  // Hill numbers profile series
  const hillSeries = useMemo((): HillSeries[] => {
    if (!registrosFiltrados.length) return [];
    if (hillMode === "ua") {
      const uas = [...new Set(registrosFiltrados.map(r => r.unidadeAmostral?.trim()).filter(Boolean) as string[])].sort();
      if (!uas.length) return [];
      return buildHillSeries(registrosFiltrados, r => r.unidadeAmostral, uas.slice(0, 10));
    }
    const groups = campanhas.length ? campanhas.slice(0, 10) : ["(todos)"];
    return buildHillSeries(registrosFiltrados, r => r.campanha, groups);
  }, [registrosFiltrados, campanhas, hillMode]);

  // IndVal rows
  const indValRows = useMemo((): IndValRow[] => {
    if (!registrosFiltrados.length) return [];
    let groupFn: (r: CampoRegistro) => string | null | undefined;
    if (indvalGroupBy === "ua") {
      groupFn = (r) => r.unidadeAmostral?.trim();
    } else if (indvalGroupBy === "campanha") {
      groupFn = (r) => r.campanha?.trim();
    } else {
      // posicao: prefer r.localizacao when filled; otherwise derive Jusante/Montante from nmdsJusanteUas
      const allUas = [...new Set(registrosFiltrados.map(r => r.unidadeAmostral?.trim()).filter(Boolean) as string[])];
      const jusante: Set<string> = nmdsJusanteUas.size > 0 ? nmdsJusanteUas : new Set(allUas.slice(0, 1));
      groupFn = (r) => {
        const loc = r.localizacao?.trim();
        if (loc) return loc;
        const ua = r.unidadeAmostral?.trim();
        if (!ua) return null;
        return jusante.has(ua) ? "Jusante" : "Montante";
      };
    }
    return computeIndVal(registrosFiltrados, groupFn);
  }, [registrosFiltrados, indvalGroupBy, nmdsJusanteUas]);

  // Completude por campanha
  const campCompldeData = useMemo(() => {
    if (!campanhas.length) return [];
    return campCompletude(registros, campanhas);
  }, [registros, campanhas]);

  const selectedEmp = empreendimentos.find(e => String(e.id) === selectedEmpId);

  // Tabela final com filtros + ordenação
  const tableData = useMemo(() => {
    const filtered = registrosFiltrados.filter(r => {
      return !search ||
        r.nomeCientifico?.toLowerCase().includes(search.toLowerCase()) ||
        r.nomeComum?.toLowerCase().includes(search.toLowerCase()) ||
        r.campanha?.toLowerCase().includes(search.toLowerCase()) ||
        r.unidadeAmostral?.toLowerCase().includes(search.toLowerCase());
    });
    return [...filtered].sort((a, b) => {
      const va = String((a as any)[sortCol] ?? "");
      const vb = String((b as any)[sortCol] ?? "");
      const cmp = va.localeCompare(vb, undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [registrosFiltrados, search, sortCol, sortDir]);

  // Paginação
  const totalPages = Math.ceil(tableData.length / PAGE_SIZE);
  const pagedData = useMemo(() => tableData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [tableData, page]);
  useEffect(() => { setPage(0); }, [tableData]);

  // Comparação entre campanhas
  const compareBioStats = useMemo(() => {
    const THREAT_SET = ["CR", "EX", "EW", "EN", "VU"];
    function calcFromData(data: CampoRegistro[]) {
      if (!data.length) return null;
      const spCounts: Record<string, number> = {};
      const spByUa: Record<string, Set<string>> = {};
      const threatSet = new Set<string>();
      const citesSet = new Set<string>();
      data.forEach(r => {
        const sp = r.nomeCientifico?.trim().toUpperCase();
        if (!sp) return;
        spCounts[sp] = (spCounts[sp] || 0) + (r.abundancia || 1);
        if (!spByUa[sp]) spByUa[sp] = new Set();
        if (r.unidadeAmostral) spByUa[sp].add(r.unidadeAmostral);
        if (THREAT_SET.includes(r.iucn || "") || THREAT_SET.includes(r.ibamaMma || "")) threatSet.add(sp);
        if (r.cites) citesSet.add(sp);
      });
      const counts = Object.values(spCounts);
      const Sobs = counts.length;
      const N = counts.reduce((s, c) => s + c, 0);
      const H = shannonH(counts);
      const D = simpsonD(counts);
      const J = pielouJ(counts);
      const ch1 = chao1(spCounts);
      const ch2 = chao2(spByUa);
      const cov = ch1 > 0 ? (Sobs / ch1 * 100) : 0;
      const dMarg = margalef(Sobs, N);
      const dMenh = menhinick(Sobs, N);
      const f1 = counts.filter(c => c === 1).length;
      const f2 = counts.filter(c => c === 2).length;
      const berger = N > 0 ? Math.max(...counts) / N : 0;
      const nUAs = new Set(data.filter(r => r.unidadeAmostral).map(r => r.unidadeAmostral)).size;
      const nCamps = new Set(data.filter(r => r.campanha).map(r => r.campanha)).size;
      const spSet = new Set(Object.keys(spCounts));
      return { Sobs, N, H, D, J, chao1: ch1, chao2: ch2, coverage: cov,
               margalef: dMarg, menhinick: dMenh, f1, f2, berger,
               nUAs, nCamps, threatened: threatSet.size, citesN: citesSet.size, spSet };
    }
    if (!compareOpen) return null;
    let dataA: CampoRegistro[], dataB: CampoRegistro[];
    if (compareMode === "campanhas") {
      const matchGrupo = (r: CampoRegistro) => filterGrupo === "todos" || r.grupoTaxonomico === filterGrupo;
      dataA = registros.filter(r => matchGrupo(r) && (compareCampA === "todas" || campanhaMatch(r.campanha, compareCampA)));
      dataB = registros.filter(r => matchGrupo(r) && (compareCampB === "todas" || campanhaMatch(r.campanha, compareCampB)));
    } else {
      dataA = compareEmpA === "todos" ? allRegistros : allRegistros.filter(r => String(r.empreendimentoId) === compareEmpA);
      dataB = compareEmpB === "todos" ? allRegistros : allRegistros.filter(r => String(r.empreendimentoId) === compareEmpB);
    }
    const a = calcFromData(dataA);
    const b = calcFromData(dataB);
    // Jaccard & Sørensen
    let jaccard: number | null = null, sorensen: number | null = null;
    if (a && b) {
      const shared = [...a.spSet].filter(sp => b.spSet.has(sp)).length;
      const union = a.spSet.size + b.spSet.size - shared;
      jaccard = union > 0 ? shared / union : 0;
      sorensen = (a.spSet.size + b.spSet.size) > 0 ? (2 * shared) / (a.spSet.size + b.spSet.size) : 0;
    }
    return { a, b, jaccard, sorensen };
  }, [compareOpen, compareMode, compareCampA, compareCampB, compareEmpA, compareEmpB, registros, allRegistros, filterGrupo]);

  function getEmpNome(id?: number) {
    if (!id) return null;
    return empreendimentos.find(e => e.id === id)?.nome || `Empreendimento #${id}`;
  }

  function exportCSV() {
    if (!tableData.length) return;
    const headers = ["ID", "Empreendimento", "Grupo", "Nome Científico", "Nome Comum", "Campanha", "Data", "UA", "Latitude", "Longitude", "Método", "IUCN", "IBAMA", "CITES", "Coletor"];
    const rows = tableData.map(r => [r.id, getEmpNome(r.empreendimentoId) || "", GRUPO_CONFIG[r.grupoTaxonomico]?.label || r.grupoTaxonomico, r.nomeCientifico || "", r.nomeComum || "", r.campanha || "", r.data, r.unidadeAmostral || "", r.latitude || "", r.longitude || "", r.metodo || "", r.iucn || "", r.ibamaMma || "", r.cites || "", r.nomeColetor || ""]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    const empLabel = selectedEmp ? `_${selectedEmp.nome.replace(/\s+/g, "_")}` : "";
    const campLabel = formatCampanhaLabel(filterCampanha, filterCampanhasMulti, "fname");
    a.download = `campo${empLabel}${campLabel}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function exportExcel() {
    if (!tableData.length) return;
    const { utils, writeFile } = await import("xlsx");
    const empLabel = selectedEmp ? `_${selectedEmp.nome.replace(/\s+/g, "_")}` : "";
    const campLabel = formatCampanhaLabel(filterCampanha, filterCampanhasMulti, "fname");
    const filename = `campo${empLabel}${campLabel}_${new Date().toISOString().split("T")[0]}`;

    // ── Planilha 1: Registros de campo ────────────────────────────────────────
    const sheetData = tableData.map(r => ({
      "ID": r.id,
      "Empreendimento": getEmpNome(r.empreendimentoId) || "",
      "Grupo Taxonômico": GRUPO_CONFIG[r.grupoTaxonomico]?.label || r.grupoTaxonomico || "",
      "Nome Científico": r.nomeCientifico || "",
      "Nome Comum": r.nomeComum || "",
      "Filo": r.filo || "",
      "Classe": r.classe || "",
      "Ordem": r.ordem || "",
      "Família": r.familia || "",
      "Campanha": r.campanha || "",
      "Data": r.data || "",
      "Horário": r.horario || "",
      "Período": r.periodo || "",
      "Unidade Amostral": r.unidadeAmostral || "",
      "Localização": r.localizacao || "",
      "Latitude": r.latitude || "",
      "Longitude": r.longitude || "",
      "Método": r.metodo || "",
      "Sexo": r.sexo || "",
      "Idade": r.idade || "",
      "Abundância": r.abundancia ?? "",
      "Status Registro": r.statusRegistro || "",
      "Coletor": r.nomeColetor || "",
      "IUCN Global": toIucnSigla(r.iucn),
      "MMA/IBAMA": toMmaSigla(r.ibamaMma),
      "CITES": toCitesSigla(r.cites) ? `Apêndice ${toCitesSigla(r.cites)}` : "",
      "PAN": toPanLabel(r.pan),
      "Lista Estadual": r.listaEstadual || "",
      "Endemismo": r.endemismo || "",
      "Dieta": r.dieta || "",
      "Observações": r.observacoes || "",
    }));
    const ws1 = utils.json_to_sheet(sheetData);
    ws1["!cols"] = [
      {wch:6},{wch:22},{wch:16},{wch:30},{wch:22},
      {wch:14},{wch:14},{wch:16},{wch:16},{wch:14},
      {wch:12},{wch:10},{wch:10},{wch:14},{wch:14},
      {wch:14},{wch:18},{wch:8},{wch:10},{wch:10},
      {wch:14},{wch:18},{wch:12},{wch:12},{wch:16},
      {wch:20},{wch:16},{wch:12},{wch:14},{wch:35},
    ];

    // ── Planilha 2: Banco corrigido (somente espécies com status de conservação) ─
    const atRisk = [...new Map(registrosFiltrados
      .filter(r => toIucnSigla(r.iucn) || toMmaSigla(r.ibamaMma) || toCitesSigla(r.cites) || hasPan(r.pan))
      .map(r => [r.nomeCientifico, r])).values()];
    const sheetRisk = atRisk.map(r => ({
      "Nome Científico": r.nomeCientifico || "",
      "Nome Comum": r.nomeComum || "",
      "Grupo": GRUPO_CONFIG[r.grupoTaxonomico]?.label || r.grupoTaxonomico || "",
      "IUCN Global": toIucnSigla(r.iucn),
      "MMA/IBAMA": toMmaSigla(r.ibamaMma),
      "CITES": toCitesSigla(r.cites) ? `Apêndice ${toCitesSigla(r.cites)}` : "",
      "PAN": toPanLabel(r.pan),
      "Lista Estadual": r.listaEstadual || "",
      "Nº Registros": registrosFiltrados.filter(x => x.nomeCientifico === r.nomeCientifico).length,
    }));
    const ws2 = utils.json_to_sheet(sheetRisk.length ? sheetRisk : [{"Aviso": "Nenhuma espécie com status de conservação especial"}]);
    ws2["!cols"] = [{wch:30},{wch:22},{wch:16},{wch:12},{wch:12},{wch:16},{wch:20},{wch:16},{wch:12}];

    // ── Planilha 3: Resumo por grupo ──────────────────────────────────────────
    const byGrupo: Record<string, { n: number; spp: Set<string> }> = {};
    registrosFiltrados.forEach(r => {
      const g = GRUPO_CONFIG[r.grupoTaxonomico]?.label || r.grupoTaxonomico || "Outro";
      if (!byGrupo[g]) byGrupo[g] = { n: 0, spp: new Set() };
      byGrupo[g].n++;
      if (r.nomeCientifico) byGrupo[g].spp.add(r.nomeCientifico.toUpperCase());
    });
    const sheetResumo = Object.entries(byGrupo).map(([g, v]) => ({
      "Grupo": g, "Abundância (n)": v.n, "Riqueza (spp)": v.spp.size,
    }));
    const ws3 = utils.json_to_sheet(sheetResumo);
    ws3["!cols"] = [{wch:20},{wch:16},{wch:14}];

    // ── Planilha 4: Índices de Biodiversidade ────────────────────────────────
    const bioSheetData = bioStats ? [
      { "Índice": "Riqueza Observada (Sobs)", "Valor": bioStats.Sobs, "Categoria": "Riqueza" },
      { "Índice": "Abundância Total (N)", "Valor": bioStats.N, "Categoria": "Riqueza" },
      { "Índice": "Nº Ordens", "Valor": bioStats.nOrdens, "Categoria": "Riqueza" },
      { "Índice": "Nº Famílias", "Valor": bioStats.nFamilias, "Categoria": "Riqueza" },
      { "Índice": "Shannon (H')", "Valor": bioStats.H.toFixed(4), "Categoria": "Diversidade Alfa" },
      { "Índice": "Simpson (1-D)", "Valor": bioStats.D.toFixed(4), "Categoria": "Diversidade Alfa" },
      { "Índice": "Pielou (J')", "Valor": bioStats.J.toFixed(4), "Categoria": "Diversidade Alfa" },
      { "Índice": "Margalef (d)", "Valor": bioStats.margalef.toFixed(4), "Categoria": "Diversidade Alfa" },
      { "Índice": "Menhinick (D)", "Valor": bioStats.menhinick.toFixed(4), "Categoria": "Diversidade Alfa" },
      { "Índice": "Berger-Parker (d)", "Valor": bioStats.bergerParker.toFixed(4), "Categoria": "Diversidade Alfa" },
      { "Índice": "Chao1", "Valor": bioStats.chao1.toFixed(2), "Categoria": "Estimadores de Riqueza" },
      { "Índice": "Chao2", "Valor": bioStats.chao2.toFixed(2), "Categoria": "Estimadores de Riqueza" },
      { "Índice": "Jackknife 1", "Valor": bioStats.jack1.toFixed(2), "Categoria": "Estimadores de Riqueza" },
      { "Índice": "Jackknife 2", "Valor": bioStats.jack2.toFixed(2), "Categoria": "Estimadores de Riqueza" },
      { "Índice": "Bootstrap", "Valor": bioStats.boot.toFixed(2), "Categoria": "Estimadores de Riqueza" },
      { "Índice": "Cobertura Amostral (Sobs/Chao1 %)", "Valor": bioStats.chao1 > 0 ? (bioStats.Sobs / bioStats.chao1 * 100).toFixed(1) + "%" : "N/D", "Categoria": "Estimadores de Riqueza" },
      { "Índice": "Espécies com Status de Conservação (IUCN VU/EN/CR/NT/DD)", "Valor": bioStats.threatened.length, "Categoria": "Conservação" },
      { "Índice": "Singletons", "Valor": bioStats.rareSpecies.filter((s: any) => s.categoria === "singleton").length, "Categoria": "Raridade" },
      { "Índice": "Doubletons", "Valor": bioStats.rareSpecies.filter((s: any) => s.categoria === "doubleton").length, "Categoria": "Raridade" },
    ] : [{ "Índice": "Sem dados", "Valor": "—", "Categoria": "" }];
    const ws4 = utils.json_to_sheet(bioSheetData);
    ws4["!cols"] = [{ wch: 40 }, { wch: 16 }, { wch: 26 }];

    // ── Planilha 5: Análises de IA (coletadas durante a sessão) ──────────────
    const aiEntries = Array.from(AI_ANALYSES_CACHE.entries());
    const ws5 = utils.json_to_sheet(
      aiEntries.length > 0
        ? aiEntries.map(([tipo, analise]) => ({ "Seção / Tipo": tipo, "Análise Gerada por IA": analise }))
        : [{ "Seção / Tipo": "Nenhuma análise gerada", "Análise Gerada por IA": "Use os botões 'IA' nos gráficos ou gere o Relatório Completo para popular esta aba." }]
    );
    ws5["!cols"] = [{ wch: 40 }, { wch: 120 }];

    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws1, "Registros de Campo");
    utils.book_append_sheet(wb, ws2, "Espécies Ameaçadas");
    utils.book_append_sheet(wb, ws3, "Resumo por Grupo");
    utils.book_append_sheet(wb, ws4, "Índices Biodiversidade");
    utils.book_append_sheet(wb, ws5, "Análises IA");
    writeFile(wb, `${filename}.xlsx`);
  }

  async function exportPDF() {
    if (!registrosFiltrados.length) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const empNome = selectedEmp?.nome || "Todos os Empreendimentos";
    const campLabel = formatCampanhaLabel(filterCampanha, filterCampanhasMulti, "long");
    const today = new Date().toLocaleDateString("pt-BR");

    // ── Cabeçalho / Capa ────────────────────────────────────────────────────
    doc.setFillColor(15, 72, 52);
    doc.rect(0, 0, 297, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE MONITORAMENTO DE CAMPO", 148.5, 10, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${empNome}  |  ${campLabel}  |  Gerado em ${today}`, 148.5, 16, { align: "center" });

    // ── Resumo executivo ─────────────────────────────────────────────────────
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo Executivo", 14, 32);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const sppSet = new Set(registrosFiltrados.map(r => r.nomeCientifico).filter(Boolean));
    const atRiskSpp = [...new Set(registrosFiltrados.filter(r => toIucnSigla(r.iucn) || toMmaSigla(r.ibamaMma) || toCitesSigla(r.cites) || hasPan(r.pan)).map(r => r.nomeCientifico).filter(Boolean))];
    const campanhasSet = new Set(registrosFiltrados.map(r => r.campanha).filter(Boolean));
    const summaryRows = [
      ["Total de Registros", String(registrosFiltrados.length)],
      ["Riqueza (spp. distintas)", String(sppSet.size)],
      ["Campanhas", String(campanhasSet.size)],
      ["Spp. com Status de Conservação", String(atRiskSpp.length)],
      ...(bioStats ? [
        ["Shannon (H')", bioStats.H.toFixed(3)],
        ["Simpson (1-D)", bioStats.D.toFixed(3)],
        ["Pielou (J')", bioStats.J.toFixed(3)],
        ["Berger-Parker (d)", bioStats.bergerParker.toFixed(3)],
        ["Chao1", bioStats.chao1.toFixed(1)],
      ] : []),
    ];
    autoTable(doc, {
      startY: 36,
      head: [["Parâmetro", "Valor"]],
      body: summaryRows,
      theme: "striped",
      headStyles: { fillColor: [15, 72, 52], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 40 } },
      margin: { left: 14 },
      tableWidth: 115,
    });

    // ── Espécies com status de conservação ──────────────────────────────────
    const atRiskData = [...new Map(registrosFiltrados
      .filter(r => toIucnSigla(r.iucn) || toMmaSigla(r.ibamaMma) || toCitesSigla(r.cites) || hasPan(r.pan))
      .map(r => [r.nomeCientifico, r])).values()];

    if (atRiskData.length) {
      doc.addPage();
      doc.setFillColor(15, 72, 52);
      doc.rect(0, 0, 297, 12, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Espécies com Status de Conservação Especial", 14, 8.5);
      doc.setTextColor(30, 30, 30);
      autoTable(doc, {
        startY: 17,
        head: [["Nome Científico", "Nome Comum", "Grupo", "IUCN", "MMA/IBAMA", "CITES", "PAN", "N Registros"]],
        body: atRiskData.map(r => [
          r.nomeCientifico || "", r.nomeComum || "",
          GRUPO_CONFIG[r.grupoTaxonomico]?.label || r.grupoTaxonomico,
          toIucnSigla(r.iucn) || "—", toMmaSigla(r.ibamaMma) || "—",
          toCitesSigla(r.cites) ? `Ap. ${toCitesSigla(r.cites)}` : "—",
          toPanLabel(r.pan) || "—",
          String(registrosFiltrados.filter(x => x.nomeCientifico === r.nomeCientifico).length),
        ]),
        theme: "striped",
        headStyles: { fillColor: [220, 53, 69], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
        margin: { left: 14, right: 14 },
      });
    }

    // ── Lista completa de registros ─────────────────────────────────────────
    doc.addPage();
    doc.setFillColor(15, 72, 52);
    doc.rect(0, 0, 297, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Lista de Registros de Campo", 14, 8.5);
    doc.setTextColor(30, 30, 30);
    autoTable(doc, {
      startY: 17,
      head: [["ID", "Empreendimento", "Grupo", "Nome Científico", "Nome Comum", "Campanha", "Data", "UA", "IUCN", "MMA", "Lat", "Lon"]],
      body: registrosFiltrados.slice(0, 3000).map(r => [
        String(r.id), getEmpNome(r.empreendimentoId) || "",
        GRUPO_CONFIG[r.grupoTaxonomico]?.label || r.grupoTaxonomico,
        r.nomeCientifico || "", r.nomeComum || "", r.campanha || "", r.data || "",
        r.unidadeAmostral || "", toIucnSigla(r.iucn) || "", toMmaSigla(r.ibamaMma) || "",
        r.latitude ? String(r.latitude) : "", r.longitude ? String(r.longitude) : "",
      ]),
      theme: "grid",
      headStyles: { fillColor: [30, 100, 80], textColor: 255, fontSize: 7.5 },
      bodyStyles: { fontSize: 7 },
      margin: { left: 14, right: 14 },
    });

    // ── Rodapé ──────────────────────────────────────────────────────────────
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(`Página ${i} / ${pageCount}  |  SGAI — Sistema de Gestão Ambiental Integrado  |  ${today}`, 148.5, 206, { align: "center" });
    }

    const empSlug = selectedEmp?.nome.replace(/\s+/g, "_") || "todos";
    doc.save(`relatorio_campo_${empSlug}_${new Date().toISOString().split("T")[0]}.pdf`);
  }

  const hasDados = registrosFiltrados.length > 0;
  const domain = detectDomain(filterGrupo, registrosFiltrados);
  const isEnvDomain = domain === "qualidade_agua" || domain === "solo" || domain === "ruido";

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-full w-full overflow-x-hidden">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-600" /> Monitoramento de Campo
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Recepção e análise estatística dos dados coletados em campo</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleRefresh} className="gap-1.5 text-xs">
            <RefreshCw className="w-3 h-3" /> Atualizar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShortcutsHelpOpen(true)} className="gap-1.5 text-xs text-muted-foreground" title="Atalhos de teclado (?)">
            <Keyboard className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setImportCampoOpen(true)} className="gap-1.5 text-xs border-emerald-400 text-emerald-700 hover:bg-emerald-50">
            <Upload className="w-3 h-3" /> Importar
          </Button>
          <Button size="sm" variant="outline" onClick={fetchOutliers} className="gap-1.5 text-xs border-amber-400 text-amber-700 hover:bg-amber-50" title="Detectar registros geograficamente fora do range esperado da espécie (alerta de identificação suspeita)">
            <AlertTriangle className="w-3 h-3" /> Outliers
          </Button>
          <Button size="sm" variant="outline" onClick={fetchAlertas} className="gap-1.5 text-xs border-rose-400 text-rose-700 hover:bg-rose-50" title="Alertas inteligentes: espécies não detectadas há ≥3 campanhas e quedas significativas de riqueza por UA">
            <TrendingUp className="w-3 h-3" /> Alertas
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV} disabled={!tableData.length} className="gap-1.5 text-xs">
            <Download className="w-3 h-3" /> CSV
          </Button>
          <Button size="sm" onClick={exportExcel} disabled={!tableData.length} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
            <FileSpreadsheet className="w-3 h-3" /> Excel
          </Button>
          <Button size="sm" onClick={exportPDF} disabled={!registrosFiltrados.length} className="gap-1.5 bg-red-700 hover:bg-red-800 text-white text-xs">
            <FileText className="w-3 h-3" /> PDF
          </Button>
          <FullReportBtn
            bioStats={bioStats}
            uaData={uaData}
            registrosFiltrados={registrosFiltrados}
            statsSource={statsSource}
            selectedEmp={selectedEmp}
            filterCampanha={filterCampanha}
            filterCampanhasMulti={filterCampanhasMulti}
            filterGrupo={filterGrupo}
            bioAnalysisTab={bioAnalysisTab}
            setBioAnalysisTab={setBioAnalysisTab}
            subModes={{
              bioMode, setBioMode,
              groupViewMode, setGroupViewMode,
              dendroMetric, setDendroMetric,
              heatMode, setHeatMode,
              rarefMode, setRarefMode,
              hillMode, setHillMode,
              indvalGroupBy, setIndvalGroupBy,
              multiMode, setMultiMode,
            }}
          />
        </div>
      </div>


      {/* ── Empreendimento + Campanha ── */}
      <Card className="border-2 border-emerald-200 bg-emerald-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-sm text-emerald-800">Empreendimento:</span>
            </div>
            <Select value={selectedEmpId} onValueChange={val => { setSelectedEmpId(val); setFilterCampanha("todas"); setFilterCampanhasMulti(new Set()); setFilterProjeto("todos"); }}>
              <SelectTrigger className="flex-1 max-w-sm bg-white border-emerald-300">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os empreendimentos</SelectItem>
                {empreendimentos.map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    <span className="font-medium">{e.nome}</span>
                    {e.municipio && <span className="text-muted-foreground text-xs ml-2">— {e.municipio}{e.uf ? `/${e.uf}` : ""}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Projeto filter — only when empreendimento is selected */}
            {selectedEmpId !== "todos" && sysProjetos.length > 0 && (
              <>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <FolderKanban className="w-4 h-4 text-violet-600" />
                  <span className="font-semibold text-sm text-violet-800">Projeto:</span>
                </div>
                <Select value={filterProjeto} onValueChange={val => { setFilterProjeto(val); setFilterCampanha("todas"); setFilterCampanhasMulti(new Set()); }}>
                  <SelectTrigger className="flex-1 max-w-xs bg-white border-violet-300">
                    <SelectValue placeholder="Todos..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os projetos</SelectItem>
                    {sysProjetos.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            <div className="flex items-center gap-2 flex-shrink-0">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-sm text-blue-800">Campanha:</span>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 max-w-xs bg-white border-blue-300 justify-between font-normal"
                  data-testid="button-filter-campanhas-multi"
                >
                  <span className="truncate text-left">
                    {filterCampanhasMulti.size === 0
                      ? (filterCampanha === "todas" ? "Todas as campanhas" : filterCampanha)
                      : filterCampanhasMulti.size === 1
                        ? Array.from(filterCampanhasMulti)[0]
                        : `${filterCampanhasMulti.size} campanhas selecionadas`}
                  </span>
                  <Search className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
                  <span className="text-xs font-semibold text-slate-700">
                    {filterCampanhasMulti.size > 0
                      ? `${filterCampanhasMulti.size} selecionada(s)`
                      : "Selecione campanhas"}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost" size="sm" className="h-6 px-2 text-xs"
                      onClick={() => setFilterCampanhasMulti(new Set(campanhas))}
                      data-testid="button-campanhas-todas"
                    >Todas</Button>
                    <Button
                      variant="ghost" size="sm" className="h-6 px-2 text-xs"
                      onClick={() => { setFilterCampanhasMulti(new Set()); setFilterCampanha("todas"); }}
                      data-testid="button-campanhas-limpar"
                    >Limpar</Button>
                  </div>
                </div>
                <ScrollArea className="h-64">
                  <div className="p-2 space-y-1">
                    {campanhas.map(c => {
                      const sysCamp = sysCampanhas.find(sc => sc.nome === c);
                      const checked = filterCampanhasMulti.has(c);
                      return (
                        <label
                          key={c}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-blue-50 cursor-pointer"
                          data-testid={`checkbox-campanha-${c}`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(val) => {
                              setFilterCampanhasMulti(prev => {
                                const next = new Set(prev);
                                if (val) next.add(c); else next.delete(c);
                                return next;
                              });
                              setFilterCampanha("todas");
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{c}</div>
                            {sysCamp && (
                              <div className="text-[10px] text-muted-foreground">
                                {sysCamp.periodoInicio?.split('-').reverse().join('/')} → {sysCamp.periodoFim?.split('-').reverse().join('/')}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                    {campanhas.length === 0 && (
                      <div className="text-xs text-muted-foreground px-2 py-4 text-center">Sem campanhas disponíveis</div>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            {/* ── Filtro por Localização (jusante/montante) ── */}
            {localizacaoOpts.length > 0 && (
              <>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <MapPin className="w-4 h-4 text-teal-600" />
                  <span className="font-semibold text-sm text-teal-800">Localização:</span>
                </div>
                <Select value={filterLocalizacao} onValueChange={setFilterLocalizacao}>
                  <SelectTrigger className="flex-1 max-w-[180px] bg-white border-teal-300">
                    <SelectValue placeholder="Todas..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as localizações</SelectItem>
                    {localizacaoOpts.map(loc => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {/* ── Filtro por intervalo de datas ── */}
            <div className="flex items-center gap-1.5 flex-shrink-0 border rounded-lg px-2 py-1 bg-white border-slate-300">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                type="date"
                className="text-xs border-0 outline-none bg-transparent w-28 text-slate-700"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                title="Data inicial"
              />
              <span className="text-slate-400 text-xs">→</span>
              <input
                type="date"
                className="text-xs border-0 outline-none bg-transparent w-28 text-slate-700"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                title="Data final"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="ml-1 text-slate-400 hover:text-red-500 text-xs font-bold transition-colors"
                  title="Limpar filtro de data"
                >✕</button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground -mt-2">
        <Clock className="inline w-3 h-3 mr-1" />
        {registrosFiltrados.length} registros{selectedEmp ? ` — ${selectedEmp.nome}` : ""}
        {filterProjeto !== "todos" ? ` · ${sysProjetos.find(p => String(p.id) === filterProjeto)?.nome || ""}` : ""}
        {(filterCampanhasMulti.size > 0 || filterCampanha !== "todas") ? ` · ${formatCampanhaLabel(filterCampanha, filterCampanhasMulti, "long")}` : ""}
        {filterLocalizacao !== "todas" ? ` · ${filterLocalizacao}` : ""}
        {dateFrom || dateTo ? ` · ${dateFrom || "início"} → ${dateTo || "hoje"}` : ""}
      </p>

      {/* ── Seletor de Banco de Dados Ativo ── */}
      {allGroupStats.length > 0 && (
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2.5">
            <Database className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-bold text-foreground">Banco de Dados Ativo</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              — todas as análises e gráficos calculados para o grupo selecionado
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {/* Todos */}
            <button
              onClick={() => setFilterGrupo("todos")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                filterGrupo === "todos"
                  ? "bg-slate-800 border-slate-800 text-white shadow"
                  : "border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700"
              }`}>
              <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
              Todos
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${filterGrupo === "todos" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                {registros.length}
              </span>
            </button>
            {/* Per-group buttons */}
            {allGroupStats.map(([g, count]) => {
              const color  = getGrupoColor(g, unknownGroups);
              const label  = GRUPO_CONFIG[g]?.label || g;
              const active = filterGrupo === g;
              return (
                <button
                  key={g}
                  onClick={() => setFilterGrupo(g)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all"
                  style={{
                    borderColor: active ? color : color + "50",
                    backgroundColor: active ? color : color + "12",
                    color: active ? "#fff" : color,
                    boxShadow: active ? `0 1px 6px ${color}55` : "none",
                  }}>
                  <span className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: active ? "rgba(255,255,255,0.7)" : color }} />
                  {label}
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{ backgroundColor: active ? "rgba(255,255,255,0.2)" : color + "25", color: active ? "#fff" : color }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {filterGrupo !== "todos" && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: getGrupoColor(filterGrupo, unknownGroups) }} />
              Analisando: <strong className="text-foreground">{GRUPO_CONFIG[filterGrupo]?.label || filterGrupo}</strong>
              &nbsp;·&nbsp;{registrosFiltrados.length} registros desta campanha/empreendimento
              <button onClick={() => setFilterGrupo("todos")} className="ml-2 text-muted-foreground underline hover:text-foreground">
                Limpar
              </button>
            </p>
          )}
        </div>
      )}

      {/* ── KPIs básicos ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(() => {
          // Helper: lista única (com contagem) de valores de um campo, ordenada por contagem desc
          const listWithCount = (vals: (string | null | undefined)[]): { name: string; count: number }[] => {
            const m = new Map<string, number>();
            vals.forEach(v => {
              const k = (v || "").trim();
              if (!k) return;
              m.set(k, (m.get(k) || 0) + 1);
            });
            return Array.from(m.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
          };
          const campanhasList = listWithCount(registrosFiltrados.map(r => r.campanha));
          const uasList       = listWithCount(registrosFiltrados.map(r => r.unidadeAmostral));
          const baseCards = [
            { label: "Total Registros", value: registrosFiltrados.length, icon: Database, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Campanhas", value: campanhasList.length, icon: BarChart3, color: "text-blue-600", bg: "bg-blue-50", details: campanhasList },
          ];
          const envCards = [
            { label: "Pontos (UA)", value: uasList.length, icon: MapPin, color: "text-purple-600", bg: "bg-purple-50", details: uasList },
            { label: "Com Parâmetros", value: registrosFiltrados.filter(r => r.parametros && Object.keys(r.parametros).length > 0).length, icon: Activity, color: "text-teal-600", bg: "bg-teal-50" },
          ];
          // Per-species abundance for KPI subtitle
          const spAbundKpi: Record<string, number> = {};
          statsSource.forEach(r => {
            if (!r.nomeCientifico) return;
            const k = r.nomeCientifico.trim().toUpperCase();
            spAbundKpi[k] = (spAbundKpi[k] || 0) + ((r.abundancia && r.abundancia > 0) ? r.abundancia : 1);
          });

          const threatenedList = bioStats?.threatened ?? [];
          const threatKpiSub = threatenedList.length > 0 ? (() => {
            const shown = threatenedList.slice(0, 3);
            return (
              <div className="mt-1 flex flex-col gap-0.5">
                {shown.map(r => {
                  const n = spAbundKpi[r.nomeCientifico?.trim().toUpperCase() ?? ""] ?? 1;
                  const iucnS = toIucnSigla(r.iucn);
                  const mmaS  = toMmaSigla(r.ibamaMma);
                  const status = iucnS || mmaS || (toCitesSigla(r.cites) ? "CITES" : "") || "PAN";
                  return (
                    <span key={r.nomeCientifico} className="flex items-center gap-1 text-[10px] leading-tight">
                      <span className="inline-block px-1 py-0.5 rounded text-white font-bold text-[9px]"
                        style={{ backgroundColor: IUCN_COLORS[status] || "#dc2626" }}>{status}</span>
                      <span className="italic truncate max-w-[110px] text-red-800 font-medium">{r.nomeCientifico ? formatSpeciesName(r.nomeCientifico) : r.nomeComum}</span>
                      <span className="text-red-500 font-semibold">n={n}</span>
                    </span>
                  );
                })}
                {threatenedList.length > 3 && (
                  <span className="text-[10px] text-red-400">+{threatenedList.length - 3} espécie(s)…</span>
                )}
              </div>
            );
          })() : null;

          // Métricas adicionais para preencher a 2ª linha do grid (6 cols × 2 = 12 cards)
          const generosList = listWithCount(
            statsSource.map(r => {
              const sp = (r.nomeCientifico || "").trim();
              if (!sp) return null;
              const first = sp.split(/\s+/)[0];
              return first && first.length > 2 ? first[0].toUpperCase() + first.slice(1).toLowerCase() : null;
            })
          );
          const classesList   = listWithCount(statsSource.map(r => r.classe));
          const ordensList    = listWithCount(statsSource.map(r => r.ordem));
          const familiasList  = listWithCount(statsSource.map(r => r.familia));
          const coletoresList = listWithCount(statsSource.map(r => r.nomeColetor));
          const especiesList  = listWithCount(statsSource.map(r => r.nomeCientifico ? formatSpeciesName(r.nomeCientifico) : null));
          const conservacaoList = (threatenedList || []).map((r: any) => {
            const iucnS = toIucnSigla(r.iucn);
            const mmaS  = toMmaSigla(r.ibamaMma);
            const status = iucnS || mmaS || (toCitesSigla(r.cites) ? "CITES" : "") || "PAN";
            const name = r.nomeCientifico ? formatSpeciesName(r.nomeCientifico) : (r.nomeComum || "—");
            return { name: `${status} · ${name}`, count: spAbundKpi[r.nomeCientifico?.trim().toUpperCase() ?? ""] ?? 1 };
          });
          const citesList = listWithCount(
            statsSource.filter(r => toCitesSigla(r.cites)).map(r => r.nomeCientifico ? formatSpeciesName(r.nomeCientifico) : null)
          );
          const nUAs = uasList.length;
          const nComGps = registrosFiltrados.filter(r => {
            const la = parseFloat(r.latitude as any), lo = parseFloat(r.longitude as any);
            return Number.isFinite(la) && Number.isFinite(lo);
          }).length;
          const gpsPct = registrosFiltrados.length > 0 ? Math.round((nComGps / registrosFiltrados.length) * 100) : 0;
          const gpsSub = registrosFiltrados.length > 0 ? (
            <span className="text-[10px] text-muted-foreground">{gpsPct}% georreferenciado</span>
          ) : null;

          const bioCards: { label: string; value: number; icon: any; color: string; bg: string; sub?: React.ReactNode; details?: { name: string; count: number }[] }[] = [
            { label: "Espécies (Sobs)", value: bioStats?.Sobs ?? 0, icon: Bird, color: "text-purple-600", bg: "bg-purple-50", details: especiesList },
            { label: "Conservação Especial", value: threatenedList.length, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", sub: threatKpiSub, details: conservacaoList },
            { label: "Interesse Comercial", value: bioStats?.citesCount ?? 0, icon: ShoppingBag, color: "text-amber-600", bg: "bg-amber-50", details: citesList },
            { label: "Ordens", value: ordensList.length, icon: Sigma, color: "text-orange-600", bg: "bg-orange-50", details: ordensList },
            { label: "Famílias", value: familiasList.length, icon: Layers, color: "text-teal-600", bg: "bg-teal-50", details: familiasList },
            { label: "Gêneros", value: generosList.length, icon: TreePine, color: "text-lime-600", bg: "bg-lime-50", details: generosList },
            { label: "Classes", value: classesList.length, icon: Microscope, color: "text-indigo-600", bg: "bg-indigo-50", details: classesList },
            { label: "UAs Amostradas", value: nUAs, icon: MapPin, color: "text-cyan-600", bg: "bg-cyan-50", details: uasList },
            { label: "c/ GPS", value: nComGps, icon: Crosshair, color: "text-sky-600", bg: "bg-sky-50", sub: gpsSub },
            { label: "Coletores", value: coletoresList.length, icon: Users, color: "text-rose-600", bg: "bg-rose-50", details: coletoresList },
          ];
          const cards = isEnvDomain ? [...baseCards, ...envCards] : [...baseCards, ...bioCards];
          return cards.map(({ label, value, icon: Icon, color, bg, sub, details }: any) => {
            const cardEl = (
              <Card key={label} className={(sub ? "col-span-2 sm:col-span-1 " : "") + (details && details.length ? "cursor-help transition-shadow hover:shadow-md hover:ring-1 hover:ring-emerald-200" : "")}>
                <CardContent className="pt-4 pb-3 flex items-start gap-3">
                  <div className={`rounded-lg p-2 ${bg} flex-shrink-0`}><Icon className={`w-5 h-5 ${color}`} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    {sub}
                  </div>
                </CardContent>
              </Card>
            );
            if (!details || details.length === 0) return <div key={label}>{cardEl}</div>;
            const maxShow = 30;
            return (
              <HoverCard key={label} openDelay={120} closeDelay={80}>
                <HoverCardTrigger asChild>{cardEl}</HoverCardTrigger>
                <HoverCardContent side="top" align="start" className="w-72 p-0 border shadow-xl">
                  <div className={`px-3 py-2 ${bg} border-b flex items-center gap-2`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                    <div className="text-xs font-semibold flex-1">{label}</div>
                    <span className={`text-[11px] font-bold ${color}`}>{details.length}</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-2 space-y-0.5">
                    {details.slice(0, maxShow).map((d: any, i: number) => (
                      <div key={d.name + i} className="flex items-center gap-2 text-[11px] px-2 py-1 rounded hover:bg-muted/50">
                        <span className="text-muted-foreground tabular-nums w-5 text-right">{i + 1}.</span>
                        <span className="flex-1 truncate" title={d.name}>{d.name}</span>
                        <span className="tabular-nums font-semibold text-foreground">{d.count}</span>
                      </div>
                    ))}
                    {details.length > maxShow && (
                      <div className="text-[10px] text-muted-foreground text-center pt-1 border-t mt-1">
                        +{details.length - maxShow} item(s) não exibido(s)
                      </div>
                    )}
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          });
        })()}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MAPA DE OCORRÊNCIAS
      ═══════════════════════════════════════════════════════════════════ */}
      {hasDados && (() => {
        const comCoords = registrosFiltrados.filter(r => r.latitude && r.longitude);
        return (
          <Card data-campo-map>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Mapa de Ocorrências
                <Badge variant="outline" className="text-xs ml-1">{comCoords.length} pts com GPS</Badge>
                {comCoords.length < registrosFiltrados.length && (
                  <span className="text-xs text-muted-foreground">
                    ({registrosFiltrados.length - comCoords.length} sem coordenadas)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="flex items-center justify-center h-40 text-muted-foreground text-sm gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Carregando mapa...</div>}>
                {outlierIdSet && outlierIdSet.size > 0 && (
                  <div className="mb-2 flex items-center justify-between flex-wrap gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-300 dark:border-amber-700">
                    <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span><b>{outlierIdSet.size}</b> outlier{outlierIdSet.size > 1 ? "s" : ""} destacado{outlierIdSet.size > 1 ? "s" : ""} no mapa (anel pulsante laranja)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setOutliersOpen(true)} className="text-[11px] px-2 py-1 rounded border border-amber-400 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40">Ver detalhes</button>
                      <button onClick={() => setShowOutliersOnMap(false)} className="text-[11px] px-2 py-1 rounded border border-amber-400 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40">Ocultar do mapa</button>
                    </div>
                  </div>
                )}
                {!showOutliersOnMap && outliersData?.outliers?.length > 0 && (
                  <div className="mb-2 flex items-center justify-end">
                    <button onClick={() => setShowOutliersOnMap(true)} className="text-[11px] px-2 py-1 rounded border border-amber-400 text-amber-700 hover:bg-amber-50">Mostrar {outliersData.outliers.length} outlier(s) no mapa</button>
                  </div>
                )}
                <CampoMap
                  registros={registrosFiltrados}
                  height={440}
                  onEditClick={(id) => {
                    const r = registrosFiltrados.find(x => x.id === id);
                    if (r) openEdit(r);
                  }}
                  outlierIds={outlierIdSet}
                  focused={mapFocus}
                />
              </Suspense>
            </CardContent>
          </Card>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════
          PAINEL AMBIENTAL (ruído / água / solo) ou BIODIVERSIDADE
      ═══════════════════════════════════════════════════════════════════ */}
      {isEnvDomain && hasDados && (
        <>
          {domain === "ruido"         && <RuidoPanel registros={registrosFiltrados} />}
          {domain === "qualidade_agua" && <QualidadeAguaPanel registros={registrosFiltrados} />}
          {domain === "solo"          && <SoloPanel registros={registrosFiltrados} />}
        </>
      )}

      {!isEnvDomain && <>
          {/* ── Título da seção ── */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Sigma className="w-5 h-5 text-violet-600" />
              <h2 className="text-lg font-bold text-foreground">Estatísticas de Biodiversidade</h2>
            </div>
            {(filterCampanhasMulti.size > 0 || filterCampanha !== "todas") && <Badge variant="outline" className="text-xs">{formatCampanhaLabel(filterCampanha, filterCampanhasMulti, "long")}</Badge>}
            {!hasDados && <Badge variant="outline" className="text-xs text-muted-foreground">Aguardando dados do campo</Badge>}
            {/* Geral / Por UA toggle */}
            {hasDados && (
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setCompareOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300 transition-colors">
                  <BarChart3 className="w-3.5 h-3.5" /> Comparar Campanhas
                </button>
                <div className="flex rounded-lg border overflow-hidden text-xs font-medium">
                  <button
                    onClick={() => setBioMode("geral")}
                    className={`px-3 py-1.5 transition-colors ${bioMode === "geral" ? "bg-violet-600 text-white" : "hover:bg-muted text-muted-foreground"}`}>
                    Geral
                  </button>
                  <button
                    onClick={() => { setBioMode("por_ua"); if (!selectedUA && uaList.length) setSelectedUA(uaList[0]); }}
                    className={`px-3 py-1.5 transition-colors ${bioMode === "por_ua" ? "bg-violet-600 text-white" : "hover:bg-muted text-muted-foreground"}`}>
                    Por UA
                  </button>
                </div>
                {bioMode === "por_ua" && uaList.length > 0 && (
                  <Select value={selectedUA} onValueChange={setSelectedUA}>
                    <SelectTrigger className="h-7 text-xs w-44">
                      <SelectValue placeholder="Selecionar UA..." />
                    </SelectTrigger>
                    <SelectContent>
                      {uaList.map(ua => (
                        <SelectItem key={ua} value={ua}>{ua}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          {/* ══ PAINEL DE MÉTRICAS DE BIODIVERSIDADE ══ */}
          {bioStats && (() => {
            const sobs  = bioStats.Sobs;
            const chao1 = bioStats.chao1;
            const sufPct = chao1 > 0 ? Math.min(100, (sobs / chao1) * 100) : 0;
            const sufColor = sufPct >= 85 ? "#16a34a" : sufPct >= 70 ? "#d97706" : "#dc2626";
            const sufBg    = sufPct >= 85 ? "#f0fdf4" : sufPct >= 70 ? "#fffbeb" : "#fef2f2";
            const sufBorder= sufPct >= 85 ? "#bbf7d0" : sufPct >= 70 ? "#fde68a" : "#fecaca";
            const sufLabel = sufPct >= 85 ? "Cobertura excelente" : sufPct >= 70 ? "Cobertura moderada — recomenda-se esforço adicional" : "Cobertura baixa — levantamento incompleto";

            // Richness estimators — infoKey must match INDEX_INFO keys exactly
            const estimators: { label: string; abbr: string; infoKey: string; value: number; ref: number; color: string; bg: string; tip: string }[] = [
              { label: "Sobs",       abbr: "Sobs",  infoKey: "Sobs",         value: sobs,           ref: chao1,          color: "#059669", bg: "#f0fdf4", tip: "Riqueza observada — clique para detalhes" },
              { label: "Abundância", abbr: "N",     infoKey: "Sobs",         value: bioStats.N,     ref: bioStats.N,     color: "#0d9488", bg: "#f0fdfa", tip: "Abundância total (N) — soma de todos os indivíduos registrados" },
              { label: "Chao 1",     abbr: "Chao1", infoKey: "Chao1",        value: bioStats.chao1, ref: bioStats.chao1, color: "#65a30d", bg: "#f7fee7", tip: "Est. abund.-based — clique para detalhes" },
              { label: "Chao 2",     abbr: "Chao2", infoKey: "Chao2",        value: bioStats.chao2, ref: bioStats.chao2, color: "#16a34a", bg: "#f0fdf4", tip: "Est. incidence-based — clique para detalhes" },
              { label: "Jack. 1",    abbr: "J1",    infoKey: "Jackknife 1",  value: bioStats.jack1, ref: bioStats.jack1, color: "#0891b2", bg: "#ecfeff", tip: "Jackknife 1ª ordem — clique para detalhes" },
              { label: "Jack. 2",    abbr: "J2",    infoKey: "Jackknife 2",  value: bioStats.jack2, ref: bioStats.jack2, color: "#0e7490", bg: "#ecfeff", tip: "Jackknife 2ª ordem — clique para detalhes" },
              { label: "Bootstrap",  abbr: "Boot",  infoKey: "Bootstrap",    value: bioStats.boot,  ref: bioStats.boot,  color: "#7c3aed", bg: "#faf5ff", tip: "Estimador Bootstrap — clique para detalhes" },
              { label: "ICE",        abbr: "ICE",   infoKey: "ICE",          value: bioStats.ice,   ref: bioStats.ice,   color: "#be185d", bg: "#fdf2f8", tip: "Incidence Coverage Estimator — clique para detalhes" },
            ];

            // Alpha diversity indices — infoKey must match INDEX_INFO keys exactly
            const alphas: { label: string; infoKey: string; value: string; sub: string; color: string; bg: string; pct: number | null }[] = [
              { label: "Shannon H'",   infoKey: "Shannon (H')",   value: bioStats.H.toFixed(3),        sub: "Diversidade",     color: "#7c3aed", bg: "#faf5ff", pct: bioStats.Sobs > 1 ? Math.min(100, bioStats.J * 100) : null },
              { label: "Simpson 1-D",  infoKey: "Simpson (1-D)",  value: bioStats.D.toFixed(3),        sub: "Dom. inversa",    color: "#4f46e5", bg: "#eef2ff", pct: Math.min(100, bioStats.D * 100) },
              { label: "Pielou J'",    infoKey: "Pielou (J')",    value: bioStats.J.toFixed(3),        sub: "Equitabilidade",  color: "#2563eb", bg: "#eff6ff", pct: Math.min(100, bioStats.J * 100) },
              { label: "Margalef d",   infoKey: "Margalef (d)",   value: bioStats.margalef.toFixed(3), sub: "Riqueza pond.",   color: "#0284c7", bg: "#f0f9ff", pct: chao1 > 0 ? Math.min(100, (sobs / chao1) * 100) : null },
              { label: "Menhinick D",  infoKey: "Menhinick (D)",  value: bioStats.menhinick.toFixed(3),   sub: "Riqueza pond.",  color: "#db2777", bg: "#fdf2f8", pct: chao1 > 0 ? Math.min(100, (sobs / chao1) * 100) : null },
              { label: "Berger-Parker",infoKey: "Berger-Parker (d)", value: bioStats.bergerParker.toFixed(3), sub: "Dominância",   color: "#b45309", bg: "#fffbeb", pct: Math.min(100, bioStats.bergerParker * 100) },
            ];

            return (
              <div className="flex flex-col gap-3">
                {/* ── Suficiência Amostral ── */}
                <div className="rounded-xl border p-3" style={{ backgroundColor: sufBg, borderColor: sufBorder }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: sufColor }}>
                      <TrendingUp className="w-3.5 h-3.5" /> Suficiência Amostral (Sobs / Chao1)
                    </span>
                    <span className="text-lg font-bold tabular-nums" style={{ color: sufColor }}>{sufPct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full rounded-full h-2.5 bg-black/10 mb-1">
                    <div className="h-2.5 rounded-full transition-all duration-500" style={{ width: `${sufPct}%`, backgroundColor: sufColor }} />
                  </div>
                  <p className="text-[11px]" style={{ color: sufColor }}>
                    <b>{sobs}</b> espécies detectadas de <b>~{chao1.toFixed(0)}</b> estimadas pelo Chao1 — {sufLabel}
                  </p>
                </div>

                {/* ── Estimadores de Riqueza ── */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5" /> Estimadores de Riqueza
                    </p>
                    <AiAnalysisBtn tipo="Estimadores de Riqueza" contexto={`Sobs=${sobs}. N=${bioStats.N}. f₁=${bioStats.rareSpecies.filter(s=>s.n===1).length} f₂=${bioStats.rareSpecies.filter(s=>s.n===2).length}. Chao1=${bioStats.chao1.toFixed(1)}, Chao2=${bioStats.chao2.toFixed(1)}, Jack1=${bioStats.jack1.toFixed(1)}, Jack2=${bioStats.jack2.toFixed(1)}, Boot=${bioStats.boot.toFixed(1)}.`} />
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2">
                    {estimators.map(est => {
                      const pct = est.ref > 0 ? Math.min(100, (sobs / est.ref) * 100) : 0;
                      const barC = pct >= 85 ? "#16a34a" : pct >= 70 ? "#d97706" : "#dc2626";
                      return (
                        <button
                          key={est.label}
                          title={est.tip}
                          onClick={() => setActiveIndexInfo(est.infoKey)}
                          className="rounded-xl border p-2.5 text-left hover:shadow-md transition-all group relative cursor-pointer"
                          style={{ backgroundColor: est.bg, borderColor: est.color + "40" }}
                        >
                          <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{est.label}</p>
                          <p className="text-lg font-bold tabular-nums leading-none" style={{ color: est.color }}>
                            {est.value > 0 ? est.value.toFixed(est.abbr === "Sobs" ? 0 : 1) : "—"}
                          </p>
                          {est.ref > 0 && est.abbr !== "Sobs" && (
                            <div className="mt-1.5">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[8px] text-muted-foreground">Sobs/est.</span>
                                <span className="text-[8px] font-bold" style={{ color: barC }}>{pct.toFixed(0)}%</span>
                              </div>
                              <div className="w-full rounded-full h-1 bg-black/10">
                                <div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: barC }} />
                              </div>
                            </div>
                          )}
                          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[8px] px-1 py-0.5 rounded bg-white/80 text-slate-400">?</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Índices Alfa ── */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <FlaskConical className="w-3.5 h-3.5" /> Diversidade Alfa
                    </p>
                    <AiAnalysisBtn tipo="Índices de Diversidade Alfa" contexto={`H'=${bioStats.H.toFixed(3)}, 1-D=${bioStats.D.toFixed(3)}, J'=${bioStats.J.toFixed(3)}, Margalef=${bioStats.margalef.toFixed(3)}, Menhinick=${bioStats.menhinick.toFixed(3)}, Berger-Parker d=${bioStats.bergerParker.toFixed(3)}. Sobs=${sobs}, N=${bioStats.N}, Ordens=${bioStats.nOrdens}, Famílias=${bioStats.nFamilias}.`} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {alphas.map(a => {
                      const barC = (a.pct ?? 0) >= 85 ? "#16a34a" : (a.pct ?? 0) >= 70 ? "#d97706" : "#dc2626";
                      return (
                        <button
                          key={a.label}
                          onClick={() => setActiveIndexInfo(a.infoKey)}
                          className="rounded-xl border p-2.5 text-left hover:shadow-md transition-all group relative cursor-pointer"
                          style={{ backgroundColor: a.bg, borderColor: a.color + "40" }}
                        >
                          <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{a.label}</p>
                          <p className="text-xl font-bold tabular-nums leading-none" style={{ color: a.color }}>{a.value}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5 mb-1.5">{a.sub}</p>
                          {a.pct !== null && (
                            <div>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[8px] text-muted-foreground">Sufic.</span>
                                <span className="text-[8px] font-bold" style={{ color: barC }}>{a.pct.toFixed(0)}%</span>
                              </div>
                              <div className="w-full rounded-full h-1 bg-black/10">
                                <div className="h-1 rounded-full" style={{ width: `${a.pct}%`, backgroundColor: barC }} />
                              </div>
                            </div>
                          )}
                          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[8px] px-1 py-0.5 rounded bg-white/80 text-slate-400">?</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {bioStats ? (<div data-bio-analysis-root>

          {/* ── Navegação de seções de análise ── */}
          <div className="mb-4 p-1.5 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
            <div className="flex gap-1 min-w-max items-center">
              {([
                {id:"geral",       label:"Visão Geral",          Icon:BarChart3,  gradient:"from-emerald-500 to-teal-600",  ring:"ring-emerald-300"},
                {id:"curvas",      label:"Curvas & Estimadores", Icon:TrendingUp, gradient:"from-blue-500 to-indigo-600",   ring:"ring-blue-300"},
                {id:"composicao",  label:"Composição",           Icon:PieChart,   gradient:"from-violet-500 to-purple-600", ring:"ring-violet-300"},
                {id:"beta",        label:"Beta & Agrupamento",   Icon:Network,    gradient:"from-rose-500 to-pink-600",     ring:"ring-rose-300"},
                {id:"multivariada",label:"Multivariada",         Icon:Sigma,      gradient:"from-orange-500 to-amber-600",  ring:"ring-orange-300"},
                {id:"biometria",   label:"Biometria",            Icon:Ruler,      gradient:"from-cyan-500 to-sky-600",      ring:"ring-cyan-300"},
                {id:"cpue",        label:"CPUE",                 Icon:Waves,      gradient:"from-teal-500 to-emerald-600",  ring:"ring-teal-300"},
              ] as {id:"geral"|"curvas"|"composicao"|"beta"|"multivariada"|"biometria"|"cpue";label:string;Icon:any;gradient:string;ring:string}[]).map(tab => {
                const open = openAnalysisTabs.has(tab.id);
                return (
                  <button key={tab.id} onClick={() => { setBioAnalysisTab(tab.id); toggleAnalysisTab(tab.id); }}
                    className={`group flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg whitespace-nowrap transition-all duration-200 ${
                      open
                        ? `bg-gradient-to-br ${tab.gradient} text-white shadow-lg ring-2 ${tab.ring} ring-offset-1 scale-[1.02]`
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white hover:shadow-md border border-slate-200 dark:border-slate-700"
                    }`}>
                    <tab.Icon className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? "scale-110" : "group-hover:scale-110"}`} />
                    <span className={open ? "tracking-wide" : ""}>{tab.label}</span>
                    <ChevronRight className={`w-3 h-3 ml-0.5 transition-transform duration-200 ${open ? "rotate-90 opacity-80" : "opacity-40"}`} />
                  </button>
                );
              })}
              <div className="ml-2 flex gap-1 border-l border-slate-200 dark:border-slate-700 pl-2">
                <button onClick={expandAllTabs} className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors whitespace-nowrap">Expandir todas</button>
                <button onClick={collapseAllTabs} className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors whitespace-nowrap">Recolher tudo</button>
              </div>
            </div>
          </div>

          {openAnalysisTabs.has("geral") && <>
          {/* ── Auditoria de Qualidade dos Dados ── */}
          <DataQualityCard registros={statsSource} />

          {/* ── Frequência Relativa (full width) ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                <Layers className="w-4 h-4 text-emerald-600" />
                Frequência Relativa das Espécies ({bioStats.freqRel.length} espécies)
                <AiAnalysisBtn tipo="Frequência Relativa das Espécies" contexto={`Total de espécies: ${bioStats.freqRel.length}. Total de registros: ${bioStats.N}.\n` + bioStats.freqRel.slice(0,30).map(d => `${d.especie}: ${d.abs} registros (${d.pct.toFixed(2)}%)`).join("\n")} />
              </CardTitle>
            </CardHeader>
            <CardContent style={{ height: Math.max(220, bioStats.freqRel.length * 26) }}>
              <FreqRelChart data={bioStats.freqRel} />
            </CardContent>
          </Card>

          {/* ── Riqueza e Abundância por UA / Campanha ── */}
          {bioMode === "geral" && (uaData.length > 0 || campData.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    Riqueza e Abundância
                    {groupViewMode === "ua"
                      ? <Badge variant="outline" className="text-xs">{uaData.length} UAs</Badge>
                      : <Badge variant="outline" className="text-xs">{campData.length} campanhas</Badge>}
                    <AiAnalysisBtn
                      tipo={`Riqueza e Abundância por ${groupViewMode === "ua" ? "Unidade Amostral" : "Campanha"}`}
                      contexto={groupViewMode === "ua"
                        ? `UAs: ${uaData.length}\n` + uaData.map(d => `UA ${d.ua}: ${d.abundancia} registros, ${d.riqueza} espécies`).join("\n")
                        : `Campanhas: ${campData.length}\n` + campData.map(d => `${d.label}: ${d.abundancia} registros, ${d.riqueza} espécies`).join("\n")}
                    />
                  </CardTitle>
                  <div className="flex rounded-lg border overflow-hidden text-[11px] font-medium">
                    {(["ua", "campanha"] as const).map(m => (
                      <button key={m} onClick={() => setGroupViewMode(m)}
                        className={`px-3 py-1 transition-colors ${groupViewMode === m ? "bg-emerald-600 text-white" : "hover:bg-muted text-muted-foreground"}`}>
                        {m === "ua" ? "Por UA" : "Por Campanha"}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              {groupViewMode === "ua" && uaData.length > 0
                ? <CardContent style={{ height: Math.max(260, uaData.length * 30 + 60) }}>
                    <UaBarChart data={uaData} />
                  </CardContent>
                : groupViewMode === "campanha" && campData.length > 0
                  ? <CardContent style={{ height: Math.max(260, campData.length * 30 + 60) }}>
                      <GroupBarChart
                        data={campData}
                        groupLabel="Campanha"
                        chartName="grafico_por_campanha"
                      />
                    </CardContent>
                  : <CardContent className="h-[200px] flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Sem dados de {groupViewMode === "ua" ? "unidades amostrais" : "campanhas"}</p>
                    </CardContent>
              }
            </Card>
          )}

          {/* ── Índices de Diversidade por UA / Campanha ── */}
          {bioMode === "geral" && (uaData.length > 0 || campData.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-violet-600" />
                    Índices de Diversidade
                    {groupViewMode === "ua"
                      ? <Badge variant="outline" className="text-xs">{uaData.length} UAs</Badge>
                      : groupViewMode === "campanha"
                        ? <Badge variant="outline" className="text-xs">{campData.length} campanhas</Badge>
                        : <Badge variant="outline" className="text-xs">{localizacaoData.length} localizações</Badge>}
                    <AiAnalysisBtn
                      tipo={`Índices de Diversidade por ${groupViewMode === "ua" ? "Unidade Amostral" : groupViewMode === "campanha" ? "Campanha" : "Localização"}`}
                      contexto={(() => {
                        const rows = groupViewMode === "ua" ? uaData.map(d => ({ ...d, label: d.ua })) : groupViewMode === "campanha" ? campData : localizacaoData;
                        return `Grupos: ${rows.length}\n` + rows.map(d => `${d.label}: N=${d.abundancia}, S=${d.riqueza}, H'=${d.H.toFixed(3)}, 1-D=${d.D.toFixed(3)}, J'=${d.J.toFixed(3)}, Margalef=${d.margalef.toFixed(3)}, Menhinick=${d.menhinick.toFixed(3)}, Berger-Parker=${d.bergerParker.toFixed(3)}`).join("\n");
                      })()}
                    />
                  </CardTitle>
                  <div className="flex rounded-lg border overflow-hidden text-[11px] font-medium">
                    {(["ua", "campanha", "localizacao"] as const).map(m => (
                      <button key={m} onClick={() => setGroupViewMode(m)}
                        className={`px-3 py-1 transition-colors ${groupViewMode === m ? "bg-violet-600 text-white" : "hover:bg-muted text-muted-foreground"}`}>
                        {m === "ua" ? "Por UA" : m === "campanha" ? "Por Campanha" : "Por Localização"}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {(() => {
                  const rows: GroupStat[] = groupViewMode === "ua"
                    ? uaData.map(d => ({ ...d, label: d.ua }))
                    : groupViewMode === "campanha" ? campData : localizacaoData;
                  if (!rows.length) return <p className="text-xs text-center text-muted-foreground py-6">Sem dados{groupViewMode === "localizacao" ? " — preencha a coluna LOCALIZAÇÃO nos registros" : ""}</p>;
                  const colHeader = groupViewMode === "ua" ? "UA" : groupViewMode === "campanha" ? "Campanha" : "Localização";
                  return (
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead className="bg-muted">
                          <tr>
                            {[colHeader,"Abundância (N)","Riqueza (Sobs)","Shannon H'","Simpson 1-D","Pielou J'","Margalef d","Menhinick D","Berger-Parker d"].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((d, i) => (
                            <tr key={d.label} className={i % 2 === 0 ? "bg-white" : "bg-muted/30"}>
                              <td className="px-3 py-1.5 font-medium max-w-[160px] truncate" title={d.label}>{d.label}</td>
                              <td className="px-3 py-1.5 tabular-nums">{d.abundancia}</td>
                              <td className="px-3 py-1.5 tabular-nums font-semibold">{d.riqueza}</td>
                              <td className={`px-3 py-1.5 font-semibold tabular-nums ${d.H > 3 ? "text-emerald-600" : d.H > 2 ? "text-amber-600" : "text-red-500"}`}>{d.H.toFixed(3)}</td>
                              <td className="px-3 py-1.5 tabular-nums">{d.D.toFixed(3)}</td>
                              <td className="px-3 py-1.5 tabular-nums">{d.J.toFixed(3)}</td>
                              <td className="px-3 py-1.5 tabular-nums">{d.margalef.toFixed(3)}</td>
                              <td className="px-3 py-1.5 tabular-nums">{d.menhinick.toFixed(3)}</td>
                              <td className="px-3 py-1.5 tabular-nums">{d.bergerParker.toFixed(3)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
          </>}

          {openAnalysisTabs.has("curvas") && <>
          {/* ── Abundância × Riqueza por Metodologia + Curva de Acumulação ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                Abundância e Riqueza por Metodologia
                <AiAnalysisBtn tipo="Abundância e Riqueza por Metodologia" contexto={bioStats.metodoData.map(d => `${d.metodo}: ${d.abundancia} registros, ${d.riqueza} espécies`).join("\n") || "Sem dados de metodologia"} />
              </CardTitle>
              </CardHeader>
              <CardContent className="h-[260px]">
                {bioStats.metodoData.length > 0
                  ? <MetodoChart data={bioStats.metodoData} />
                  : <p className="text-center text-muted-foreground text-xs pt-10">Sem dados de metodologia</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                  <TrendingUp className="w-4 h-4 text-violet-600" />
                  Curva de Acumulação de Espécies
                  <AiAnalysisBtn tipo="Curva de Acumulação de Espécies" contexto={`Dias amostrados: ${bioStats.accum.nDays}. Permutações: ${bioStats.accum.nPerms}. Sobs final (média): ${bioStats.accum.sobsFinal}. Jackknife1 final: ${bioStats.accum.jack1Final?.toFixed(1)}. Bootstrap final: ${bioStats.accum.bootFinal?.toFixed(1)}. Datas: ${bioStats.accum.dates?.slice(0,10).join(", ")}${(bioStats.accum.dates?.length??0) > 10 ? "…" : ""}`} />
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[330px]">
                {bioStats.accum.nDays > 1
                  ? <AccumChart data={bioStats.accum} />
                  : <p className="text-center text-muted-foreground text-xs pt-10">Precisa de registros com datas em ≥2 dias diferentes para gerar a curva</p>}
              </CardContent>
            </Card>
          </div>

          {/* ── Taxa de Novas Espécies por Dia + Rarefação ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Taxa de Novas Espécies por Dia
                  <span className="text-[10px] text-muted-foreground font-normal">zero = saturação amostral</span>
                  <AiAnalysisBtn tipo="Taxa de Novas Espécies por Dia" contexto={`Dias amostrados: ${bioStats.newSpDay.length}. Dias com novas espécies: ${bioStats.newSpDay.filter(d=>d.newSp>0).length}. Dias com zero novas espécies: ${bioStats.newSpDay.filter(d=>d.newSp===0).length}.\nDetalhes por dia: ${bioStats.newSpDay.map(d=>`${d.date}: +${d.newSp} novas (total ${d.cumSp})`).join(", ")}`} />
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                {bioStats.newSpDay.length > 0
                  ? <NewSpDayChart data={bioStats.newSpDay} />
                  : <p className="text-center text-muted-foreground text-xs pt-10">Sem datas nos registros</p>}
              </CardContent>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader className="pb-0 border-b border-border/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Sigma className="w-4 h-4 text-violet-600" />
                      Rarefação &amp; Suficiência Amostral
                      <AiAnalysisBtn tipo={`Curvas de Rarefação por ${rarefMode === "ua" ? "Unidade Amostral" : "Campanha"}`}
                        contexto={`Agrupado por: ${rarefMode}. Grupos: ${rarefacaoSeries.map(s=>s.label).join(", ")}. N total por grupo: ${rarefacaoSeries.map(s=>`${s.label}=${s.points.at(-1)?.n}, Sobs=${s.stats?.sobs}, Chao1=${s.stats?.chao1.toFixed(1)}, ACE=${s.stats?.ace.toFixed(1)}, Good's C=${s.stats ? (s.stats.goodsCoverage*100).toFixed(1)+"%" : "—"}, completude=${s.stats?.completeness.toFixed(0)}%`).join(" | ")}.`} />
                    </CardTitle>
                    <p className="text-[10px] text-muted-foreground font-mono tracking-tight">
                      E[S(n)] Hurlbert 1971 · Chao1 (1984) · ACE Chao &amp; Lee 1992 · Good's Coverage 1953
                    </p>
                  </div>
                </div>
                {/* Toolbar */}
                <div className="flex items-center gap-1.5 mt-2 pb-2.5">
                  {(["campanha", "ua"] as const).map(m => (
                    <button key={m} onClick={() => setRarefMode(m)}
                      className={`px-3 py-1 rounded-full border text-[11px] font-semibold transition-all ${rarefMode === m
                        ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                        : "border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50"}`}>
                      {m === "campanha" ? "Por Campanha" : "Por Unidade Amostral"}
                    </button>
                  ))}
                  {(() => {
                    const nMin = rarefacaoSeries.length >= 2
                      ? Math.min(...rarefacaoSeries.map(s => s.points.at(-1)?.n ?? 0).filter(n => n > 0))
                      : 0;
                    return nMin > 0 ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-[10px] text-violet-700 font-semibold">
                        <span className="inline-block w-3 h-0.5 border border-dashed border-violet-500 mr-0.5" />
                        Padronização N={nMin}
                      </span>
                    ) : null;
                  })()}
                  <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                    {rarefacaoSeries.length} {rarefMode === "ua" ? "UA" : "campanha"}(s)
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div style={{ height: 290 }} className="px-3 pb-3 pt-1">
                  <RarefactionChart series={rarefacaoSeries} groupBy={rarefMode} />
                </div>
                {rarefacaoSeries.some(s => s.stats) && (
                  <RarefStatsTable
                    series={rarefacaoSeries}
                    nMin={rarefacaoSeries.length >= 2
                      ? Math.min(...rarefacaoSeries.map(s => s.points.at(-1)?.n ?? 0).filter(n => n > 0))
                      : 0}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Perfil de Números de Hill ── */}
          {hillSeries.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-0 border-b border-border/40">
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sigma className="w-4 h-4 text-teal-600" />
                    Perfil de Diversidade — Números de Hill
                    <AiAnalysisBtn tipo="Série de Hill (vegan::renyi)"
                      contexto={`Script: renyi(bd, scales=c(0,.25,.5,1,2,4,8,16,32,64,Inf), hill=TRUE). Grupos: ${hillSeries.map(s => s.label).join(", ")}.\n` +
                        hillSeries.map(s => {
                          const pt = (q: number) => s.points.find(p => q === Infinity ? p.q === Infinity : Math.abs(p.q - q) < 0.01)?.D ?? 0;
                          return `${s.label}: a=0→${pt(0).toFixed(0)}, a=1→${pt(1).toFixed(2)}, a=2→${pt(2).toFixed(2)}, a=4→${pt(4).toFixed(2)}, a=∞→${pt(Infinity).toFixed(2)}`;
                        }).join("\n")} />
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground font-mono tracking-tight">
                    renyi(bd, scales=c(0,.25,.5,1,2,4,8,16,32,64,∞), hill=TRUE)  ·  Hill (1973) / Faleiro (2016)
                  </p>
                </div>
                <div className="flex items-center gap-1.5 mt-2 pb-2.5">
                  {(["campanha", "ua"] as const).map(m => (
                    <button key={m} onClick={() => setHillMode(m)}
                      className={`px-3 py-1 rounded-full border text-[11px] font-semibold transition-all ${hillMode === m
                        ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                        : "border-slate-200 text-slate-500 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50"}`}>
                      {m === "campanha" ? "Por Campanha" : "Por Unidade Amostral"}
                    </button>
                  ))}
                  <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                    {hillSeries.length} {hillMode === "ua" ? "UA" : "campanha"}(s)
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div style={{ height: 300 }} className="px-3 pb-3 pt-2">
                  <HillProfileChart series={hillSeries} />
                </div>
                {/* Quick stats table — matches vegan::renyi output columns */}
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-[11px] font-mono">
                    <thead>
                      <tr className="border-b bg-slate-50 text-[10px] font-semibold tracking-wide">
                        <th className="px-3 py-1.5 text-left font-sans text-slate-500">Grupo</th>
                        <th className="px-2 py-1.5 text-right text-[#0072B2]" title="a=0 → Riqueza de espécies (Sobs)">ᵃD  a=0</th>
                        <th className="px-2 py-1.5 text-right text-[#7c3aed]" title="a=1 → exp(Shannon H') — diversidade efetiva">ᵃD  a=1</th>
                        <th className="px-2 py-1.5 text-right text-[#059669]" title="a=2 → 1/Simpson (espécies dominantes)">ᵃD  a=2</th>
                        <th className="px-2 py-1.5 text-right text-slate-500" title="a=4 → diversidade ponderada nos mais abundantes">ᵃD  a=4</th>
                        <th className="px-2 py-1.5 text-right text-[#dc2626]" title="a=∞ → 1/max(pᵢ) Berger-Parker recíproco">ᵃD  a=∞</th>
                        <th className="px-2 py-1.5 text-right text-slate-400" title="Equitabilidade = D(1)/D(0)">J</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {hillSeries.map((s, ri) => {
                        const pt = (q: number) => s.points.find(p => q === Infinity ? p.q === Infinity : Math.abs(p.q - q) < 0.01)?.D ?? 0;
                        const d0 = pt(0); const d1 = pt(1); const d2 = pt(2); const d4 = pt(4); const dinf = pt(Infinity);
                        const J = d0 > 0 ? d1 / d0 : 0;
                        return (
                          <tr key={s.label} className={ri % 2 === 0 ? "bg-white hover:bg-slate-50/60" : "bg-slate-50/40 hover:bg-slate-50/80"}>
                            <td className="px-3 py-1.5">
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                                <span className="font-sans font-medium text-[11px] text-slate-700 truncate max-w-[110px]" title={s.label}>{s.label}</span>
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-bold text-[#0072B2]">{d0.toFixed(0)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-[#7c3aed]">{d1.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-[#059669]">{d2.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{d4.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-[#dc2626]">{dinf.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{J.toFixed(3)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-3 py-1.5 text-[9px] text-slate-400 font-sans border-t bg-slate-50/60 flex flex-wrap gap-3">
                    <span><span className="font-semibold text-[#0072B2]">a=0</span> = Sobs (riqueza)</span>
                    <span><span className="font-semibold text-[#7c3aed]">a=1</span> = exp(H') Shannon efetivo</span>
                    <span><span className="font-semibold text-[#059669]">a=2</span> = 1/Σpᵢ² Simpson</span>
                    <span><span className="font-semibold text-[#dc2626]">a=∞</span> = 1/max(pᵢ) Berger-Parker</span>
                    <span><span className="font-semibold">J</span> = D(1)/D(0) equitabilidade</span>
                    <span className="text-[8px] italic">Script: Faleiro (2016) — vegan::renyi</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Completude por campanha ── */}
          {campCompldeData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  Completude Amostral por Campanha (Sobs/Chao1)
                  <AiAnalysisBtn tipo="Completude Amostral por Campanha" contexto={campCompldeData.map(d=>`${d.camp}: Sobs=${d.Sobs}, Chao1=${d.chao1}, cobertura=${d.pct}%`).join("\n")} />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {campCompldeData.map(d => {
                    const color = d.pct >= 85 ? "#16a34a" : d.pct >= 70 ? "#d97706" : "#dc2626";
                    const bg = d.pct >= 85 ? "#f0fdf4" : d.pct >= 70 ? "#fffbeb" : "#fef2f2";
                    return (
                      <div key={d.camp} className="flex items-center gap-3 px-4 py-2.5" style={{ backgroundColor: bg + "55" }}>
                        <div className="w-40 truncate text-xs font-medium text-muted-foreground" title={d.camp}>{d.camp}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <div className="flex-1 rounded-full h-2 bg-black/10">
                              <div className="h-2 rounded-full transition-all" style={{ width: `${d.pct}%`, backgroundColor: color }} />
                            </div>
                            <span className="text-[11px] font-bold tabular-nums" style={{ color }}>{d.pct}%</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                          {d.Sobs} / ~{d.chao1} spp · N={d.N}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Progresso de descoberta + Grupos por campanha ── */}
          {campProgresso.length >= 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    Progresso de Descoberta por Campanha
                    <AiAnalysisBtn tipo="Progresso de Descoberta de Espécies por Campanha"
                      contexto={`Campanhas: ${campProgresso.length}. Total acumulado: ${campProgresso.at(-1)?.cumSp ?? 0} spp.\n` + campProgresso.map(d => `${d.camp}: N=${d.N}, Sobs=${d.Sobs}, novas=${d.novaSp}, exclusivas=${d.exclusivaSp}, acumuladas=${d.cumSp}`).join("\n")} />
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground">Novas espécies / Exclusivas por campanha + curva acumulada</p>
                </CardHeader>
                <CardContent style={{ height: Math.max(260, campProgresso.length * 40 + 80) }}>
                  <CampanhaProgressChart data={campProgresso} />
                </CardContent>
                {/* Summary table */}
                <div className="border-t overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[10px] font-semibold">
                        <th className="px-3 py-1.5 text-left">Campanha</th>
                        <th className="px-2 py-1.5 text-right">N</th>
                        <th className="px-2 py-1.5 text-right">Sobs</th>
                        <th className="px-2 py-1.5 text-right text-blue-700">Novas</th>
                        <th className="px-2 py-1.5 text-right text-amber-700">Exclusivas</th>
                        <th className="px-2 py-1.5 text-right text-emerald-700">Acum.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {campProgresso.map((d, i) => {
                        const fmtList = (arr: string[]) =>
                          arr.map(sp => sp.charAt(0) + sp.slice(1).toLowerCase()).join(", ");
                        return (
                          <Fragment key={d.camp}>
                            <tr className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                              <td className="px-3 py-1 max-w-[140px] truncate font-medium text-slate-700" title={d.camp}>{d.camp}</td>
                              <td className="px-2 py-1 text-right tabular-nums text-slate-500">{d.N}</td>
                              <td className="px-2 py-1 text-right tabular-nums font-semibold">{d.Sobs}</td>
                              <td className="px-2 py-1 text-right tabular-nums text-blue-700 font-semibold" title={d.novaSpList.length ? fmtList(d.novaSpList) : ""}>+{d.novaSp}</td>
                              <td className="px-2 py-1 text-right tabular-nums text-amber-700" title={d.exclusivaSpList.length ? fmtList(d.exclusivaSpList) : ""}>{d.exclusivaSp}</td>
                              <td className="px-2 py-1 text-right tabular-nums text-emerald-700 font-semibold">{d.cumSp}</td>
                            </tr>
                            {d.exclusivaSpList.length > 0 && (
                              <tr className={i % 2 === 0 ? "bg-amber-50/40" : "bg-amber-50/60"}>
                                <td colSpan={6} className="px-3 py-1 text-[10px] text-amber-900 italic">
                                  <span className="font-semibold not-italic">⭐ Exclusivas:</span>{" "}
                                  {d.exclusivaSpList.map((sp, k) => (
                                    <span key={sp}>
                                      {k > 0 && ", "}
                                      <span className="italic">{sp.charAt(0) + sp.slice(1).toLowerCase()}</span>
                                    </span>
                                  ))}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
              {gruposByCamp.length >= 2 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                      <Layers className="w-4 h-4 text-pink-600" />
                      Grupos Taxonômicos por Campanha
                      <AiAnalysisBtn tipo="Grupos Taxonômicos por Campanha"
                        contexto={gruposByCamp.map(d => `${d.camp}: ` + Object.entries(d.grupos).map(([g,n]) => `${g}=${n}`).join(", ")).join("\n")} />
                    </CardTitle>
                    <p className="text-[10px] text-muted-foreground">Composição taxonômica (registros empilhados por grupo)</p>
                  </CardHeader>
                  <CardContent style={{ height: Math.max(260, gruposByCamp.length * 40 + 80) }}>
                    <GruposByCampanhaChart data={gruposByCamp} />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          </>}

          {openAnalysisTabs.has("composicao") && <>
          {/* ── Índice de Integridade Biótica (IBI) ── */}
          <IbiCard registros={statsSource} />

          {/* ── Matrizes Ecológicas (3 heatmaps) ── */}
          {(() => {
            if (!bioStats) return null;
            const hasAny = (bioStats.heatSpUa?.rows.length ?? 0) > 0 || (bioStats.heatCampSp?.rows.length ?? 0) > 0 || (bioStats.heatUaCamp?.rows.length ?? 0) > 0;
            if (!hasAny) return null;

            const MATRICES: { id: "spUa" | "campSp" | "uaCamp"; label: string; desc: string; rowLabel: string; colLabel: string; supportedMetrics: HeatMetric[] }[] = [
              { id: "spUa",   label: "Espécies × UA",        desc: "Composição da comunidade por unidade amostral",   rowLabel: "espécie",  colLabel: "UA",       supportedMetrics: ["count","pa"] },
              { id: "campSp", label: "Campanha × Espécies",  desc: "Sazonalidade e entrada/saída de espécies",        rowLabel: "campanha", colLabel: "espécie",  supportedMetrics: ["count","pa"] },
              { id: "uaCamp", label: "UA × Campanha",        desc: "Estabilidade ecológica e influência de distúrbios",rowLabel: "UA",       colLabel: "campanha", supportedMetrics: ["count","richness"] },
            ];

            const current = MATRICES.find(m => m.id === heatMode)!;
            const heatData = heatMode === "spUa" ? bioStats.heatSpUa : heatMode === "campSp" ? bioStats.heatCampSp : bioStats.heatUaCamp;
            const activeMetric: HeatMetric = current.supportedMetrics.includes(heatMetric) ? heatMetric : current.supportedMetrics[0];

            const metricLabels: Record<HeatMetric, string> = { count: "Abundância", richness: "Riqueza (spp)", pa: "Presença/Ausência" };

            return (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                    <Layers className="w-4 h-4 text-pink-600" />
                    Matrizes Ecológicas — Heatmap
                    <span className="text-[10px] text-muted-foreground font-normal hidden sm:inline">{current.desc}</span>
                    <AiAnalysisBtn tipo={`Heatmap ${current.label}`}
                      contexto={`Matriz: ${current.label}. Linhas: ${heatData.rows.length}. Colunas: ${heatData.cols.length}. Métrica: ${metricLabels[activeMetric]}. Top linhas: ${heatData.rows.slice(0,5).join(", ")}. Top colunas: ${heatData.cols.slice(0,5).join(", ")}.`} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    {/* ── Matrix selector ── */}
                    <div className="flex flex-wrap gap-1.5">
                      {MATRICES.map(m => (
                        <button key={m.id} onClick={() => setHeatMode(m.id)}
                          className={`px-3 py-1 rounded-full border text-xs font-semibold transition-all ${heatMode === m.id ? "bg-pink-600 text-white border-pink-600 shadow" : "border-pink-200 text-pink-700 hover:bg-pink-50"}`}>
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* ── Metric selector ── */}
                    <div className="flex gap-1">
                      {current.supportedMetrics.map(mt => (
                        <button key={mt} onClick={() => setHeatMetric(mt)}
                          className={`px-2.5 py-0.5 rounded border text-[11px] font-medium transition-all ${activeMetric === mt ? "bg-slate-700 text-white border-slate-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                          {metricLabels[mt]}
                        </button>
                      ))}
                    </div>

                    {/* ── Description ── */}
                    <p className="text-[10px] text-muted-foreground leading-relaxed -mt-1">{current.desc}</p>

                    {/* ── Heatmap ── */}
                    <HeatmapChart data={heatData} metric={activeMetric} rowLabel={current.rowLabel} colLabel={current.colLabel} />
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* ── Valor Indicador (IndVal) ── */}
          {registrosFiltrados.some(r => r.nomeCientifico?.trim()) && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-0 border-b border-border/40">
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sigma className="w-4 h-4 text-orange-600" />
                    Valor Indicador de Espécies — IndVal
                    <AiAnalysisBtn tipo="IndVal — Valor Indicador de Espécies"
                      contexto={`Agrupado por: ${indvalGroupBy}. Top 10 espécies por IndVal: ${indValRows.slice(0,10).map(r=>`${r.species} → ${r.group} (IndVal=${r.indval.toFixed(1)}, A=${(r.A*100).toFixed(0)}%, B=${(r.B*100).toFixed(0)}%)`).join("; ")||"—"}. Total com IndVal>0: ${indValRows.length} espécies.`} />
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground font-mono tracking-tight">
                    IndVal = A × B × 100  ·  Dufrêne &amp; Legendre (1997)  ·  A = abundância relativa  ·  B = fidelidade ao grupo
                  </p>
                </div>
                <div className="flex items-center gap-1.5 mt-2 pb-2.5">
                  {(["campanha", "ua", "posicao"] as const).map(m => (
                    <button key={m} onClick={() => setIndvalGroupBy(m)}
                      className={`px-3 py-1 rounded-full border text-[11px] font-semibold transition-all ${indvalGroupBy === m
                        ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                        : "border-slate-200 text-slate-500 hover:border-orange-300 hover:text-orange-700 hover:bg-orange-50"}`}>
                      {m === "campanha" ? "Por Campanha" : m === "ua" ? "Por Unidade Amostral" : "Por Posição (Jusante/Montante)"}
                    </button>
                  ))}
                  <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                    {indValRows.length} espécie(s) indicadoras
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <IndValChart rows={indValRows} />
                <IndValTable rows={indValRows} />
              </CardContent>
            </Card>
          )}

          {/* ── Ecologia & Conservação — distribuições categóricas ── */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/40 bg-gradient-to-r from-orange-50/40 to-teal-50/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-orange-600" />
                Ecologia & Conservação — Distribuições
                <AiAnalysisBtn tipo="Ecologia & Conservação — Distribuições"
                  contexto={(() => {
                    const fields: Array<[keyof CampoRegistro, string]> = [
                      ["distribuicao","Distribuição"],["endemismo","Endemismo"],
                      ["usoHabitat","Uso do Habitat"],["migracao","Migratória"],
                      ["bioindicador","Bioindicador"],["tipoCorpoAgua","Tipo de Corpo d'Água"],
                      ["estratoVertical","Estrato Vertical"],
                    ];
                    return fields.map(([f, lbl]) => {
                      const m: Record<string, number> = {};
                      registrosFiltrados.forEach(r => {
                        const v = (r[f] as string | null | undefined)?.trim();
                        if (v) m[v] = (m[v] || 0) + 1;
                      });
                      const top = Object.entries(m).sort(([,a],[,b]) => b - a).slice(0, 5);
                      return `${lbl}: ${top.map(([k,v]) => `${k}=${v}`).join(", ") || "sem dados"}`;
                    }).join(" | ");
                  })()} />
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Frequência de registros por categoria ecológica · clique no botão de download em cada gráfico para exportar PNG
              </p>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <CategoryDistChart registros={registrosFiltrados} field="distribuicao"    label="Distribuição"          Icon={Globe2} />
                <CategoryDistChart registros={registrosFiltrados} field="endemismo"       label="Endemismo"             Icon={MapPin} />
                <CategoryDistChart registros={registrosFiltrados} field="usoHabitat"      label="Uso do Habitat"        Icon={Mountain} />
                <CategoryDistChart registros={registrosFiltrados} field="migracao"        label="Migratória"            Icon={Compass} />
                <CategoryDistChart registros={registrosFiltrados} field="bioindicador"    label="Bioindicador"          Icon={FlaskConical} />
                <CategoryDistChart registros={registrosFiltrados} field="tipoCorpoAgua"   label="Tipo de Corpo d'Água"  Icon={Droplets} />
                <CategoryDistChart registros={registrosFiltrados} field="estratoVertical" label="Estrato Vertical"      Icon={TreePine} />
              </div>
            </CardContent>
          </Card>

          {/* ── Grupo Taxonômico + IUCN + Timeline ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">Por Grupo Taxonômico<AiAnalysisBtn tipo="Composição por Grupo Taxonômico" contexto={`Grupos registrados:\n` + Object.entries(stats?.byGrupo || {}).map(([k,v]) => `${k}: ${v} registros`).join("\n")} /></CardTitle></CardHeader>
              <CardContent className="h-[240px]">
                {stats?.byGrupo && Object.keys(stats.byGrupo).length
                  ? <GrupoChart byGrupo={stats.byGrupo} />
                  : <p className="text-center text-muted-foreground text-sm pt-8">Sem dados</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">Status de Conservação<AiAnalysisBtn tipo="Status de Conservação" contexto={(() => {
                const iucnC: Record<string,Set<string>>={};
                const mmaC: Record<string,Set<string>>={};
                const citesC: Record<string,Set<string>>={};
                let panSp = new Set<string>();
                registrosFiltrados.forEach(r => {
                  const sp = r.nomeCientifico || "?";
                  const iu = toIucnSigla(r.iucn); if(iu){if(!iucnC[iu])iucnC[iu]=new Set();iucnC[iu].add(sp);}
                  const mm = toMmaSigla(r.ibamaMma); if(mm){if(!mmaC[mm])mmaC[mm]=new Set();mmaC[mm].add(sp);}
                  const ci = toCitesSigla(r.cites); if(ci){if(!citesC[ci])citesC[ci]=new Set();citesC[ci].add(sp);}
                  if(hasPan(r.pan)) panSp.add(sp);
                });
                return `IUCN: ${Object.entries(iucnC).map(([k,s])=>`${k}=${s.size}sp`).join(", ")||"—"}\nMMA: ${Object.entries(mmaC).map(([k,s])=>`${k}=${s.size}sp`).join(", ")||"—"}\nCITES: ${Object.entries(citesC).map(([k,s])=>`Ap.${k}=${s.size}sp`).join(", ")||"—"}\nPAN: ${panSp.size} espécies`;
              })()} /></CardTitle></CardHeader>
              <CardContent className="h-[220px] overflow-y-auto">
                {(() => {
                  const iucnC: Record<string,number>={};
                  const mmaC: Record<string,number>={};
                  const citesC: Record<string,number>={};
                  let panCount = 0;
                  const seen: Record<string, { iucn?: string; mma?: string; cites?: string; pan?: boolean }> = {};
                  registrosFiltrados.forEach(r => {
                    const sp = r.nomeCientifico || `__${r.id}`;
                    if (!seen[sp]) seen[sp] = {};
                    const iu = toIucnSigla(r.iucn); if(iu && !seen[sp].iucn){ seen[sp].iucn=iu; iucnC[iu]=(iucnC[iu]||0)+1; }
                    const mm = toMmaSigla(r.ibamaMma); if(mm && !seen[sp].mma){ seen[sp].mma=mm; mmaC[mm]=(mmaC[mm]||0)+1; }
                    const ci = toCitesSigla(r.cites); if(ci && !seen[sp].cites){ seen[sp].cites=ci; citesC[ci]=(citesC[ci]||0)+1; }
                    if(hasPan(r.pan) && !seen[sp].pan){ seen[sp].pan=true; panCount++; }
                  });
                  const hasAny = Object.keys(iucnC).length || Object.keys(mmaC).length || Object.keys(citesC).length || panCount > 0;
                  if (!hasAny) return <p className="text-center text-muted-foreground text-sm pt-8">Nenhum status de conservação registrado</p>;
                  const IUCN_ORDER = ["EX","EW","CR","EN","VU","NT","LC","DD","NE"];
                  const renderSection = (label: string, color: string, counts: Record<string,number>, order?: string[], prefix?: string) => {
                    const entries = (order ? order.filter(k => counts[k]) : Object.keys(counts)).map(k => [k, counts[k]] as [string,number]);
                    if (!entries.length) return null;
                    const total = entries.reduce((s,[,n]) => s+n, 0);
                    return (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{color}}>{label}</p>
                        <div className="flex flex-wrap gap-1">
                          {entries.map(([k,n]) => (
                            <span key={k} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-white text-[10px] font-bold" style={{backgroundColor: IUCN_COLORS[k] || color}}>
                              {prefix}{k} <span className="opacity-80 font-normal">({n})</span>
                            </span>
                          ))}
                          <span className="text-[10px] text-muted-foreground self-center">{total} sp</span>
                        </div>
                      </div>
                    );
                  };
                  return (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1">
                      {renderSection("IUCN Global", "#dc2626", iucnC, IUCN_ORDER)}
                      {renderSection("MMA/IBAMA", "#b45309", mmaC, IUCN_ORDER)}
                      {renderSection("CITES", "#7c3aed", citesC, ["I","II","III"], "Ap.")}
                      {panCount > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide mb-1 text-blue-700">PAN</p>
                          <div className="flex flex-wrap gap-1">
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">
                              {panCount} <span className="opacity-80 font-normal">espécies</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Registros por Data (últimos 30 dias)</CardTitle></CardHeader>
              <CardContent className="h-[220px]"><TimelineChart registros={registrosFiltrados} /></CardContent>
            </Card>
          </div>

          {/* ── Painel de Conformidade de Licenciamento ── */}
          {selectedEmpId !== "todos" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Conformidade de Licenciamento
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {condicionantesConf.length} condicionante(s)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!condicionantesConf.length ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhuma condicionante vinculada a este empreendimento.
                    Configure licenças e condicionantes no módulo de Licenciamento.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold">Condicionante</th>
                          <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold">Categoria</th>
                          <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold">Periodicidade</th>
                          <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold">Prazo</th>
                          <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold">Progresso</th>
                          <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {condicionantesConf.slice(0, 20).map((c: any) => {
                          const statusColor = c.status === "cumprida" ? "bg-emerald-100 text-emerald-700"
                            : c.status === "vencida" ? "bg-red-100 text-red-700"
                            : c.status === "em_andamento" ? "bg-blue-100 text-blue-700"
                            : c.status === "cancelada" ? "bg-slate-100 text-slate-500"
                            : "bg-amber-100 text-amber-700";
                          const statusLabel = c.status === "cumprida" ? "Cumprida"
                            : c.status === "vencida" ? "Vencida"
                            : c.status === "em_andamento" ? "Em Andamento"
                            : c.status === "cancelada" ? "Cancelada"
                            : "Pendente";
                          const prazoDate = c.prazo ? new Date(c.prazo) : null;
                          const hoje = new Date();
                          const vencida = prazoDate && prazoDate < hoje && c.status !== "cumprida";
                          const progresso = Number(c.progresso) || 0;
                          const progColor = progresso >= 80 ? "#16a34a" : progresso >= 50 ? "#d97706" : "#dc2626";
                          const perLabel: Record<string,string> = {
                            diario:"Diária", semanal:"Semanal", quinzenal:"Quinzenal",
                            mensal:"Mensal", bimestral:"Bimestral", trimestral:"Trimestral",
                            semestral:"Semestral", anual:"Anual", bianual:"Bianual"
                          };
                          return (
                            <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="py-1.5 px-2 max-w-[200px]">
                                <span className="font-medium truncate block">{c.titulo || c.codigo || `#${c.id}`}</span>
                                {c.descricao && <span className="text-muted-foreground truncate block text-[10px]">{c.descricao.slice(0,80)}{c.descricao.length>80?"…":""}</span>}
                              </td>
                              <td className="py-1.5 px-2 text-muted-foreground">{c.categoria || "—"}</td>
                              <td className="py-1.5 px-2">{perLabel[c.periodicidade] || c.periodicidade || "—"}</td>
                              <td className={`py-1.5 px-2 font-mono ${vencida ? "text-red-600 font-semibold" : ""}`}>
                                {prazoDate ? prazoDate.toLocaleDateString("pt-BR") : "—"}
                              </td>
                              <td className="py-1.5 px-2 min-w-[80px]">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                                    <div className="h-1.5 rounded-full transition-all" style={{width:`${progresso}%`, backgroundColor: progColor}} />
                                  </div>
                                  <span className="tabular-nums font-medium" style={{color: progColor}}>{progresso}%</span>
                                </div>
                              </td>
                              <td className="py-1.5 px-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusColor}`}>{statusLabel}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {condicionantesConf.length > 20 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        + {condicionantesConf.length - 20} condicionantes. Acesse o módulo de Licenciamento para visualizar todas.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Guilda Trófica ── */}
          <Card>
            <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("guilda")}>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span className="text-base">🍽️</span>
                Guilda Trófica (Dieta)
                {bioStats && Object.keys(bioStats.byDieta).length > 0 && (
                  <Badge variant="outline" className="text-xs ml-1">
                    {Object.keys(bioStats.byDieta).length} categorias
                  </Badge>
                )}
                {bioStats && Object.keys(bioStats.byDieta).length > 0 && (
                  <AiAnalysisBtn tipo="Guilda Trófica" contexto={`Total de registros com dieta: ${Object.values(bioStats.byDieta).reduce((a,b)=>a+b,0)}. Categorias:\n` + Object.entries(bioStats.byDieta).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}: ${v} registros`).join("\n")} />
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">{collapsedSections.has("guilda") ? "▶ expandir" : "▼ recolher"}</span>
              </CardTitle>
            </CardHeader>
            {!collapsedSections.has("guilda") && (
              <CardContent className="h-[240px]">
                {bioStats && Object.keys(bioStats.byDieta).length > 0
                  ? <GuildaChart byDieta={bioStats.byDieta} />
                  : <p className="text-center text-muted-foreground text-sm pt-10">Nenhuma informação de dieta/guilda registrada nos dados</p>}
              </CardContent>
            )}
          </Card>

          {/* ── Top Espécies + Espécies Ameaçadas ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">Top Espécies por Abundância<AiAnalysisBtn tipo="Top Espécies por Abundância" contexto={`Ranking das 10 espécies mais abundantes (de ${bioStats.Sobs} total):\n` + bioStats.topSp.map(([sp,n],i) => `${i+1}. ${sp}: ${n} registros (${((n/bioStats.N)*100).toFixed(1)}%)`).join("\n")} /></CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs">#</th>
                      <th className="px-4 py-2 text-left text-xs">Espécie</th>
                      <th className="px-4 py-2 text-right text-xs">n</th>
                      <th className="px-4 py-2 text-right text-xs">Freq. %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bioStats.topSp.map(([sp, n], i) => {
                      const total = registrosFiltrados.filter(r => r.nomeCientifico).length;
                      return (
                        <tr key={sp} className="border-t">
                          <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2 italic text-xs">{sp}</td>
                          <td className="px-4 py-2 text-right font-semibold">{n}</td>
                          <td className="px-4 py-2 text-right text-xs text-muted-foreground">{total ? ((n / total) * 100).toFixed(1) : 0}%</td>
                        </tr>
                      );
                    })}
                    {!bioStats.topSp.length && <tr><td colSpan={4} className="px-4 py-4 text-center text-muted-foreground text-xs">Nenhuma espécie registrada</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600 w-full">
                  <AlertTriangle className="w-4 h-4" /> Espécies em Situação de Conservação Especial
                  <AiAnalysisBtn tipo="Espécies em Situação de Conservação Especial" contexto={`Total de registros: ${registrosFiltrados.length}. Espécies ameaçadas detectadas:\n` + (() => { const seen = new Set<string>(); return statsSource.filter(r => { const s = toIucnSigla(r.iucn); return (s && ["VU","EN","CR","EW","EX","NT","DD"].includes(s)) || !!toCitesSigla(r.cites) || hasPan(r.pan); }).filter(r => { if (!r.nomeCientifico || seen.has(r.nomeCientifico)) return false; seen.add(r.nomeCientifico); return true; }).map(r => `${r.nomeCientifico} — IUCN: ${toIucnSigla(r.iucn)||"—"}, MMA: ${toMmaSigla(r.ibamaMma)||"—"}, CITES: ${toCitesSigla(r.cites)||"—"}`).join("\n") || "Nenhuma detectada"; })()} />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(() => {
                  // Per-species aggregation: N, UAs, campaigns
                  type SpMeta = { N: number; uas: Set<string>; campanhas: Set<string> };
                  const spMeta = new Map<string, SpMeta>();
                  statsSource.forEach(r => {
                    if (!r.nomeCientifico) return;
                    const key = r.nomeCientifico.trim().toUpperCase();
                    if (!spMeta.has(key)) spMeta.set(key, { N: 0, uas: new Set(), campanhas: new Set() });
                    const m = spMeta.get(key)!;
                    m.N += (r.abundancia && r.abundancia > 0) ? r.abundancia : 1;
                    if (r.unidadeAmostral) m.uas.add(r.unidadeAmostral);
                    if (r.campanha) m.campanhas.add(r.campanha);
                  });

                  // Deduplicate by scientific name — keep record with best conservation data
                  const byName = new Map<string, CampoRegistro>();
                  statsSource.forEach(r => {
                    if (!r.nomeCientifico) return;
                    const key = r.nomeCientifico.toUpperCase();
                    const prev = byName.get(key);
                    const hasAny = (x: CampoRegistro) => toIucnSigla(x.iucn) || toMmaSigla(x.ibamaMma) || toCitesSigla(x.cites) || hasPan(x.pan);
                    if (!prev || (!hasAny(prev) && hasAny(r))) byName.set(key, r);
                  });
                  const atRisk = [...byName.values()].filter(r => {
                    const iucnS = toIucnSigla(r.iucn);
                    const mmaS  = toMmaSigla(r.ibamaMma);
                    return (iucnS && ["VU","EN","CR","EW","EX","NT","DD"].includes(iucnS)) ||
                           (mmaS  && ["VU","EN","CR","EW","EX","NT","DD"].includes(mmaS)) ||
                           !!toCitesSigla(r.cites) || hasPan(r.pan);
                  }).sort((a, b) => {
                    const rank: Record<string, number> = { CR: 0, EX: 0, EW: 1, EN: 2, VU: 3, NT: 4, DD: 5 };
                    const aS = toIucnSigla(a.iucn) || toMmaSigla(a.ibamaMma) || "";
                    const bS = toIucnSigla(b.iucn) || toMmaSigla(b.ibamaMma) || "";
                    return (rank[aS] ?? 9) - (rank[bS] ?? 9);
                  });
                  if (!atRisk.length) return (
                    <p className="px-4 py-6 text-center text-xs text-muted-foreground">Nenhuma espécie com status de conservação detectado</p>
                  );

                  // Format helpers: prefix "UA " for numeric UAs; keep campanhas plain
                  const fmtUa = (s: string) => {
                    const t = String(s).trim();
                    if (!t) return "";
                    // Se for puramente numérico → "UA 01", "UA 02"
                    if (/^\d+$/.test(t)) return `UA ${t.padStart(2, "0")}`;
                    // Se já contém "UA" no início, mantém
                    if (/^ua/i.test(t)) return t.toUpperCase().replace(/^UA[\s-]*/, "UA ");
                    return t;
                  };
                  const fmtCampanha = (s: string) => String(s).trim();

                  // Helper: render up to N tags com separação visual nítida + overflow tag
                  const TagList = ({ items, max = 6, colorClass = "bg-slate-100 text-slate-700 border-slate-200", formatter }: { items: string[]; max?: number; colorClass?: string; formatter?: (s: string) => string }) => {
                    const formatted = items.map(it => formatter ? formatter(it) : it);
                    return (
                      <div className="flex flex-wrap gap-x-1.5 gap-y-1">
                        {formatted.slice(0, max).map((it, i) => (
                          <span key={it + i} className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold tabular-nums border ${colorClass}`} title={it}>
                            {it.length > 18 ? it.slice(0, 17) + "…" : it}
                          </span>
                        ))}
                        {formatted.length > max && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-300"
                            title={formatted.slice(max).join(", ")}
                          >
                            +{formatted.length - max}
                          </span>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-red-50 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Espécie</th>
                            <th className="px-3 py-2 text-left font-medium">Nome Comum</th>
                            <th className="px-3 py-2 text-center font-medium">N (ind.)</th>
                            <th className="px-3 py-2 text-center font-medium">IUCN Global</th>
                            <th className="px-3 py-2 text-center font-medium">MMA/IBAMA</th>
                            <th className="px-3 py-2 text-center font-medium">CITES</th>
                            <th className="px-3 py-2 text-center font-medium">PAN</th>
                            <th className="px-3 py-2 text-left font-medium">Grupo</th>
                            <th className="px-3 py-2 text-left font-medium">Unidades Amostrais</th>
                            <th className="px-3 py-2 text-left font-medium">Campanhas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {atRisk.slice(0, 20).map(r => {
                            const key = r.nomeCientifico?.trim().toUpperCase() ?? "";
                            const meta = spMeta.get(key);
                            const uas = meta ? [...meta.uas].sort(natSort) : [];
                            const camps = meta ? [...meta.campanhas].sort(natSort) : [];
                            const nInd = meta?.N ?? 1;
                            return (
                              <tr key={r.nomeCientifico} className="border-t hover:bg-red-50/30">
                                <td className="px-3 py-2 italic font-semibold text-slate-800">{r.nomeCientifico ? formatSpeciesName(r.nomeCientifico) : "—"}</td>
                                <td className="px-3 py-2 text-muted-foreground">{r.nomeComum || "—"}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className="inline-flex items-center justify-center w-8 h-6 rounded-full bg-red-100 text-red-700 font-bold text-xs tabular-nums">
                                    {nInd}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {(() => { const s = toIucnSigla(r.iucn); return s ? <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: IUCN_COLORS[s] || "#94a3b8" }}>{s}</span> : <span className="text-muted-foreground/40">—</span>; })()}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {(() => { const s = toMmaSigla(r.ibamaMma); return s ? <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: IUCN_COLORS[s] || "#1E6146" }}>{s}</span> : <span className="text-muted-foreground/40">—</span>; })()}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {(() => { const s = toCitesSigla(r.cites); return s ? <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${s === "I" ? "bg-red-600 text-white" : s === "II" ? "bg-amber-500 text-white" : "bg-yellow-400 text-black"}`}>Ap. {s}</span> : <span className="text-muted-foreground/40">—</span>; })()}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {(() => {
                                    const name = getPanName(r.pan);
                                    return name
                                      ? <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-medium" title={name}>{name}</span>
                                      : <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 text-xs">NC</span>;
                                  })()}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge className={`text-xs ${GRUPO_CONFIG[r.grupoTaxonomico]?.bg || "bg-gray-100 text-gray-800"}`}>
                                    {GRUPO_CONFIG[r.grupoTaxonomico]?.label || r.grupoTaxonomico}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 min-w-[160px]">
                                  {uas.length > 0
                                    ? <TagList items={uas} max={6} colorClass="bg-purple-50 text-purple-700 border-purple-200" formatter={fmtUa} />
                                    : <span className="text-muted-foreground/40 text-[10px]">não informado</span>}
                                </td>
                                <td className="px-3 py-2 min-w-[140px]">
                                  {camps.length > 0
                                    ? <TagList items={camps} max={8} colorClass="bg-blue-50 text-blue-700 border-blue-200" formatter={fmtCampanha} />
                                    : <span className="text-muted-foreground/40 text-[10px]">não informado</span>}
                                </td>
                              </tr>
                            );
                          })}
                          {atRisk.length > 20 && (
                            <tr className="border-t bg-muted/20">
                              <td colSpan={10} className="px-3 py-2 text-center text-muted-foreground">+ {atRisk.length - 20} espécies (exporte CSV para ver completo)</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* ── Rank-Abundance + Riqueza por Período ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                  <TrendingUp className="w-4 h-4 text-violet-600" />
                  Curva Rank-Abundance
                  <span className="text-[10px] text-muted-foreground font-normal">log₁₀(n) × rank</span>
                  <AiAnalysisBtn tipo="Curva Rank-Abundance" contexto={`Riqueza total: ${bioStats.rankAbund.length} espécies. Rank e abundância:\n` + bioStats.rankAbund.slice(0,20).map(d => `Rank ${d.rank}: ${d.especie} (n=${d.n})`).join("\n")} />
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[240px]">
                {bioStats.rankAbund.length > 0
                  ? <RankAbundChart data={bioStats.rankAbund} />
                  : <p className="text-center text-muted-foreground text-xs pt-10">Sem dados</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                  <Sigma className="w-4 h-4 text-orange-600" />
                  Riqueza e Abundância por Período
                  <AiAnalysisBtn tipo="Riqueza e Abundância por Período" contexto={bioStats.byPeriodo.map(d => `${d.label}: ${d.abundancia} registros, ${d.riqueza} espécies`).join("\n") || "Sem dados de período"} />
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[240px]">
                {bioStats.byPeriodo.length > 0
                  ? <DimensaoBarChart data={bioStats.byPeriodo} barColor={BRAND.blue2} lineColor={BRAND.orange1} name="riqueza_por_periodo" chartTitle="Riqueza e Abundância por Período" />
                  : <p className="text-center text-muted-foreground text-xs pt-10">Campo "Período" não preenchido nos registros</p>}
              </CardContent>
            </Card>
          </div>

          {/* ── Riqueza por Ambiente + Top Famílias ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  Riqueza e Abundância por Ambiente
                  <AiAnalysisBtn tipo="Riqueza e Abundância por Ambiente" contexto={bioStats.byAmbiente.map(d => `${d.label}: ${d.abundancia} registros, ${d.riqueza} espécies`).join("\n") || "Sem dados de ambiente"} />
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[240px]">
                {bioStats.byAmbiente.length > 0
                  ? <DimensaoBarChart data={bioStats.byAmbiente} barColor={BRAND.blue1} lineColor={BRAND.orange2} name="riqueza_por_ambiente" chartTitle="Riqueza e Abundância por Ambiente" />
                  : <p className="text-center text-muted-foreground text-xs pt-10">Campo "Ambiente" não preenchido nos registros</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                  <Layers className="w-4 h-4 text-teal-600" />
                  Top Famílias (Riqueza + Abundância)
                  <AiAnalysisBtn tipo="Top Famílias Taxonômicas" contexto={bioStats.byFamilia.map(d => `${d.label}: ${d.abundancia} registros, ${d.riqueza} espécies`).join("\n") || "Sem dados de família"} />
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[240px]">
                {bioStats.byFamilia.length > 0
                  ? <DimensaoBarChart data={bioStats.byFamilia} barColor={BRAND.blue2} lineColor={BRAND.orange1} name="top_familias" chartTitle="Top Famílias (Riqueza + Abundância)" />
                  : <p className="text-center text-muted-foreground text-xs pt-10">Campo "Família" não preenchido nos registros</p>}
              </CardContent>
            </Card>
          </div>

          {/* ── Top Ordens + Espécies Raras ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                  <BarChart3 className="w-4 h-4 text-orange-500" />
                  Top Ordens (Riqueza + Abundância)
                  <AiAnalysisBtn tipo="Riqueza e Abundância por Ordem Taxonômica" contexto={bioStats.byOrdem.map(d => `${d.label}: ${d.abundancia} registros, ${d.riqueza} espécies`).join("\n") || "Sem dados de ordem taxonômica"} />
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[240px]">
                {bioStats.byOrdem.length > 0
                  ? <DimensaoBarChart data={bioStats.byOrdem} barColor={BRAND.blue1} lineColor={BRAND.orange2} name="top_ordens" chartTitle="Top Ordens (Riqueza + Abundância)" />
                  : <p className="text-center text-muted-foreground text-xs pt-10">Campo "Ordem" não preenchido nos registros</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Espécies Raras
                  {bioStats.rareSpecies.length > 0 && (
                    <div className="flex items-center gap-1 ml-1">
                      <button onClick={() => setActiveIndexInfo("singleton")}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition-colors border border-red-200 cursor-pointer">
                        {bioStats.rareSpecies.filter(s => s.categoria === "singleton").length} singleton
                      </button>
                      <span className="text-muted-foreground text-[10px]">·</span>
                      <button onClick={() => setActiveIndexInfo("doubleton")}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors border border-amber-200 cursor-pointer">
                        {bioStats.rareSpecies.filter(s => s.categoria === "doubleton").length} doubleton
                      </button>
                    </div>
                  )}
                  <AiAnalysisBtn tipo="Espécies Raras (Singletons e Doubletons)" contexto={`Total espécies raras: ${bioStats.rareSpecies.length} (singletons: ${bioStats.rareSpecies.filter(s=>s.categoria==="singleton").length}, doubletons: ${bioStats.rareSpecies.filter(s=>s.categoria==="doubleton").length}). Riqueza total: ${bioStats.Sobs}.\n` + bioStats.rareSpecies.map(r => `${r.especie}: ${r.n} registro(s) → ${r.categoria}`).join("\n")} />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[240px] overflow-y-auto">
                {bioStats.rareSpecies.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead className="bg-amber-50 border-b sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Espécie</th>
                        <th className="px-3 py-2 text-center font-medium">n</th>
                        <th className="px-3 py-2 text-center font-medium">Categoria</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bioStats.rareSpecies.map(r => (
                        <tr key={r.especie} className="border-t hover:bg-amber-50/30">
                          <td className="px-3 py-1.5 italic">{r.especie.charAt(0) + r.especie.slice(1).toLowerCase()}</td>
                          <td className="px-3 py-1.5 text-center font-bold">{r.n}</td>
                          <td className="px-3 py-1.5 text-center">
                            <button
                              onClick={() => setActiveIndexInfo(r.categoria)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-opacity hover:opacity-75 ${r.categoria === "singleton" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                              {r.categoria}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center text-muted-foreground text-xs py-10">Nenhuma espécie rara encontrada</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Sensibilidade Ambiental ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Sensibilidade Ambiental
                <AiAnalysisBtn
                  tipo="Sensibilidade Ambiental das Espécies"
                  contexto={bioStats.bySensibilidade.map(d => `${d.label}: ${d.riqueza} spp, ${d.abundancia} registros`).join("\n") || "Campo 'sensibilidade' não preenchido"} />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[280px]">
              <SensibilidadeChart data={bioStats.bySensibilidade} />
            </CardContent>
          </Card>

          {/* ── Sazonalidade (coluna do banco) ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap w-full">
                <CloudRain className="w-4 h-4 text-blue-500" />
                Sazonalidade — Abundância e Riqueza por Período
                <Badge variant="outline" className="text-xs font-normal">Baseado na coluna &quot;Sazonalidade&quot; dos registros</Badge>
                <AiAnalysisBtn
                  tipo="Padrão de Sazonalidade"
                  contexto={(() => {
                    const agg: Record<string,{n:number;spp:Set<string>}> = {};
                    statsSource.forEach(r => {
                      const s = (r as any).sazonalidade;
                      if (!s || String(s).trim() === "") return;
                      const key = String(s).trim();
                      if (!agg[key]) agg[key] = { n: 0, spp: new Set() };
                      agg[key].n++;
                      if (r.nomeCientifico) agg[key].spp.add(r.nomeCientifico.toUpperCase());
                    });
                    const total = Object.values(agg).reduce((s,v)=>s+v.n,0);
                    if (!total) return "Nenhum registro com coluna Sazonalidade preenchida.";
                    return Object.entries(agg)
                      .sort(([,a],[,b])=>b.n-a.n)
                      .map(([k,v])=>`${k}: ${v.n} registros (${((v.n/total)*100).toFixed(1)}%), ${v.spp.size} espécies`)
                      .join("\n");
                  })()}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SazonalidadeChart registros={statsSource} />
            </CardContent>
          </Card>
          </>}

          {openAnalysisTabs.has("beta") && <>
          {/* ── Diversidade Beta (Jaccard) entre UAs ── */}
          {bioStats.betaMatrix.uas.length >= 2 && (
            <Card>
              <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("beta-matrix")}>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap w-full">
                  <FlaskConical className="w-4 h-4 text-indigo-600" />
                  Diversidade Beta — Similaridade de Jaccard entre Unidades Amostrais
                  <Badge variant="outline" className="text-xs">0 = sem espécies em comum · 1 = idênticas</Badge>
                  <AiAnalysisBtn tipo="Diversidade Beta — Matriz de Jaccard entre UAs" contexto={`UAs analisadas: ${bioStats.betaMatrix.uas.join(", ")}.\nMatriz de similaridade (Jaccard):\n` + bioStats.betaMatrix.uas.map((ua, i) => `${ua}: ` + bioStats.betaMatrix.uas.map((ub, j) => `${ub}=${bioStats.betaMatrix.matrix[i][j].toFixed(2)}`).join(", ")).join("\n")} />
                  <span className="ml-auto text-[10px] text-muted-foreground">{collapsedSections.has("beta-matrix") ? "▶ expandir" : "▼ recolher"}</span>
                </CardTitle>
              </CardHeader>
              {!collapsedSections.has("beta-matrix") && <CardContent className="p-0 overflow-x-auto">
                <table className="text-xs w-full">
                  <thead className="bg-indigo-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium sticky left-0 bg-indigo-50">UA</th>
                      {bioStats.betaMatrix.uas.map(ua => (
                        <th key={ua} className="px-2 py-2 text-center font-medium whitespace-nowrap">{ua}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bioStats.betaMatrix.uas.map((ua, i) => (
                      <tr key={ua} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                        <td className="px-3 py-1.5 font-medium sticky left-0 bg-inherit whitespace-nowrap">{ua}</td>
                        {bioStats.betaMatrix.matrix[i].map((val, j) => (
                          <td key={j} className="px-2 py-1.5 text-center"
                            style={{ backgroundColor: i === j ? "#dbeafe" : val === 0 ? "transparent" : `rgba(0,70,160,${val * 0.75})`, color: val > 0.5 ? "#fff" : undefined }}>
                            {val.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>}
            </Card>
          )}

          {/* ── Dendrograma de Agrupamento ── */}
          {bioStats.ua.uas.length >= 2 && bioStats.ua.especies.length > 0 && (() => {
            const uaM: UaMatrix = { uas: bioStats.ua.uas, especies: bioStats.ua.especies, matriz: bioStats.ua.matriz };
            const distFns = {
              "jaccard": jaccardDistMatrix,
              "bray-curtis": brayCurtisDistMatrix,
              "sorensen": sorensenDistMatrix,
            } as const;
            const distMatrix = distFns[dendroMetric](uaM);
            const root = upgma(bioStats.ua.uas, distMatrix);
            const metricInfo: Record<typeof dendroMetric, { title: string; icon: string; desc: string; uso: string; tip: string }> = {
              "jaccard": {
                title: "Jaccard",
                icon: "🔬",
                desc: "Baseada em presença/ausência de espécies.",
                uso: "Indicada para inventários e listas de espécies onde a abundância não foi registrada.",
                tip: "Distância = 1 − (espécies compartilhadas / espécies no total das duas UAs)",
              },
              "bray-curtis": {
                title: "Bray-Curtis",
                icon: "📊",
                desc: "Considera a abundância relativa de cada espécie.",
                uso: "Muito usada em estudos de comunidades onde a contagem de indivíduos é relevante.",
                tip: "Distância = 1 − (2 × Σ min(aᵢ, bᵢ)) / (Σaᵢ + Σbᵢ)",
              },
              "sorensen": {
                title: "Sørensen",
                icon: "🌿",
                desc: "Similar ao Jaccard, porém mais sensível a espécies compartilhadas.",
                uso: "Recomendada quando a fauna comum entre unidades tem maior peso ecológico.",
                tip: "Distância = 1 − (2 × espécies compartilhadas) / (spp_A + spp_B)",
              },
            };
            const info = metricInfo[dendroMetric];
            return (
              <Card>
                <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("dendrograma")}>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap w-full">
                    <GitBranch className="w-4 h-4 text-blue-700" />
                    Dendrograma de Agrupamento entre Unidades Amostrais
                    <Badge variant="outline" className="text-xs">UPGMA</Badge>
                    <span className="text-xs text-muted-foreground font-normal">{bioStats.ua.uas.length} UAs</span>
                    <AiAnalysisBtn tipo={`Dendrograma UPGMA (${dendroMetric})`} contexto={`Método de agrupamento: UPGMA. Distância: ${dendroMetric}. UAs analisadas (${bioStats.ua.uas.length}): ${bioStats.ua.uas.join(", ")}. Espécies registradas: ${bioStats.ua.especies.length}. Riqueza total: ${bioStats.Sobs}.`} />
                    <span className="ml-auto text-[10px] text-muted-foreground">{collapsedSections.has("dendrograma") ? "▶ expandir" : "▼ recolher"}</span>
                  </CardTitle>
                </CardHeader>
                {!collapsedSections.has("dendrograma") && <CardContent className="space-y-3">
                  {/* Seletor de métrica */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-muted-foreground font-medium">Índice de distância:</span>
                    {(["jaccard", "bray-curtis", "sorensen"] as const).map(m => {
                      const labels = { "jaccard": "Jaccard", "bray-curtis": "Bray-Curtis", "sorensen": "Sørensen" };
                      const active = dendroMetric === m;
                      return (
                        <button
                          key={m}
                          onClick={() => setDendroMetric(m)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${active
                            ? "text-white border-transparent"
                            : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"}`}
                          style={active ? { backgroundColor: BRAND.blue1, borderColor: BRAND.blue1 } : undefined}
                        >
                          {labels[m]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Card informativo da métrica selecionada */}
                  <div className="rounded-lg border p-3 flex gap-3 items-start" style={{ borderColor: BRAND.blue2 + "40", backgroundColor: BRAND.blue2 + "08" }}>
                    <span className="text-xl mt-0.5">{info.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: BRAND.blue1 }}>{info.title}</p>
                      <p className="text-xs text-slate-700 mt-0.5">{info.desc}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{info.uso}</p>
                      <p className="text-[11px] mt-1.5 font-mono px-2 py-1 rounded" style={{ backgroundColor: BRAND.orange1 + "12", color: BRAND.blue1 }}>{info.tip}</p>
                    </div>
                  </div>

                  {/* Dendrograma */}
                  {root && root.leaves.length >= 2 ? (
                    <>
                      <div className="overflow-x-auto">
                        <DendrogramSVG root={root} />
                      </div>
                      {/* Legenda — leitura do dendrograma */}
                      <div className="mt-2 rounded-md border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-50/40 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Legenda:</span>
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                            <svg width="14" height="10" viewBox="0 0 14 10"><circle cx="7" cy="5" r="3.5" fill={BRAND.orange1}/></svg>
                            Unidade Amostral (UA)
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                            <svg width="22" height="10" viewBox="0 0 22 10"><line x1="2" y1="5" x2="20" y2="5" stroke="#475569" strokeWidth="1.5"/></svg>
                            Ramo = distância de dissimilaridade
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                            <span className="inline-block px-1.5 py-0.5 rounded font-mono text-[10px] bg-white border border-slate-300 text-slate-700">{dendroMetric === "bray-curtis" ? "Bray-Curtis" : dendroMetric === "jaccard" ? "Jaccard" : "Sørensen"}</span>
                            <span className="text-slate-500 font-normal">0 = idênticas · 1 = distintas</span>
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 text-center mt-1.5 italic">
                          UAs unidas em ramos baixos (próximas da esquerda) compartilham mais espécies. UPGMA agrupa pela média não ponderada das distâncias.
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">Dados insuficientes para gerar o dendrograma.</p>
                  )}
                </CardContent>}
              </Card>
            );
          })()}

          {/* ── Matriz por Unidade Amostral ── */}
          {bioStats.ua.uas.length > 0 && bioStats.ua.especies.length > 0 && (
            <Card>
              <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("matriz-ua")}>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Tabela de Espécies × Unidade Amostral
                  <Badge variant="outline" className="text-xs">{bioStats.ua.especies.length} spp × {bioStats.ua.uas.length} UAs</Badge>
                  <span className="ml-auto text-[10px] text-muted-foreground">{collapsedSections.has("matriz-ua") ? "▶ expandir" : "▼ recolher"}</span>
                </CardTitle>
              </CardHeader>
              {!collapsedSections.has("matriz-ua") && <CardContent className="p-0 overflow-x-auto">
                <table className="text-xs w-full">
                  <thead className="bg-blue-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium sticky left-0 bg-blue-50 min-w-[180px]">Espécie</th>
                      {bioStats.ua.uas.map(ua => (
                        <th key={ua} className="px-2 py-2 text-center font-medium whitespace-nowrap">{ua}</th>
                      ))}
                      <th className="px-2 py-2 text-center font-semibold bg-blue-100">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bioStats.ua.especies.slice(0, 30).map((sp, si) => {
                      const total = bioStats.ua.matriz[si].reduce((a, b) => a + b, 0);
                      return (
                        <tr key={sp} className={`border-t ${si % 2 === 0 ? "" : "bg-muted/20"}`}>
                          <td className="px-3 py-1.5 italic sticky left-0 bg-inherit">{sp}</td>
                          {bioStats.ua.matriz[si].map((v, ui) => (
                            <td key={ui} className="px-2 py-1.5 text-center">
                              {v > 0
                                ? <span className="px-1.5 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: `rgba(16,185,129,${Math.min(0.9, v * 0.2 + 0.15)})`, color: v > 3 ? "#fff" : "#065f46" }}>{v}</span>
                                : <span className="text-muted-foreground/40">·</span>}
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-center font-bold text-blue-700 bg-blue-50">{total}</td>
                        </tr>
                      );
                    })}
                    {bioStats.ua.especies.length > 30 && (
                      <tr className="border-t bg-muted/30">
                        <td colSpan={bioStats.ua.uas.length + 2} className="px-3 py-2 text-xs text-muted-foreground text-center">
                          + {bioStats.ua.especies.length - 30} espécies (exporte CSV para ver completo)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>}
            </Card>
          )}

          {/* ── Lista Taxonômica das Espécies ── */}
          {(() => {
            // Deduplica por nomeCientifico, guarda primeiro registro encontrado
            const spMap = new Map<string, CampoRegistro>();
            statsSource.forEach(r => {
              const key = (r.nomeCientifico || '').trim().toUpperCase();
              if (key && !spMap.has(key)) spMap.set(key, r);
            });
            const rows = Array.from(spMap.values()).sort((a, b) =>
              (a.nomeCientifico || '').localeCompare(b.nomeCientifico || '')
            );
            if (rows.length === 0) return null;

            // Contagem de registros por espécie e por UA
            const allUas = [...new Set(
              statsSource.map(r => (r.unidadeAmostral || '').trim()).filter(Boolean)
            )].sort();
            // Map: nomeCientifico → { total, ua1: n, ua2: n, ..., camps: Set<string> }
            const countMap = new Map<string, { total: number; byUa: Record<string, number>; camps: Set<string> }>();
            statsSource.forEach(r => {
              const sp   = (r.nomeCientifico || '').trim().toUpperCase();
              const ua   = (r.unidadeAmostral || '').trim();
              const camp = (r.campanha || '').trim();
              if (!sp) return;
              if (!countMap.has(sp)) countMap.set(sp, { total: 0, byUa: {}, camps: new Set() });
              const entry = countMap.get(sp)!;
              entry.total++;
              if (ua) entry.byUa[ua] = (entry.byUa[ua] || 0) + 1;
              if (camp) entry.camps.add(camp);
            });
            // Total geral de registros
            const grandTotal = statsSource.length;

            const FIXED_COLS: { key: keyof CampoRegistro; label: string }[] = [
              { key: 'classe',        label: 'CLASSE' },
              { key: 'ordem',         label: 'ORDEM' },
              { key: 'familia',       label: 'FAMÍLIA' },
              { key: 'nomeCientifico',label: 'NOME CIENTÍFICO' },
              { key: 'nomeComum',     label: 'NOME COMUM' },
              { key: 'endemismo',     label: 'ENDEMISMO' },
              { key: 'distribuicao',  label: 'DISTRIBUIÇÃO' },
              { key: 'iucn',          label: 'IUCN' },
              { key: 'ibamaMma',      label: 'MMA' },
              { key: 'pan',           label: 'PAN' },
              { key: 'cites',         label: 'CITES' },
            ];
            const HDR_BG  = '#003399';
            const HDR_UA  = '#1a4799'; // UAs ligeiramente mais claro
            const HDR_TOT = '#002277'; // Total mais escuro

            return (
              <Card>
                <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection("lista-taxonomica")}>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-700" />
                    Lista Taxonômica das Espécies
                    <Badge variant="outline" className="text-xs">{rows.length} espécies</Badge>
                    <Badge variant="secondary" className="text-xs">{grandTotal} registros</Badge>
                    <span className="ml-auto text-[10px] text-muted-foreground">{collapsedSections.has("lista-taxonomica") ? "▶ expandir" : "▼ recolher"}</span>
                  </CardTitle>
                </CardHeader>
                {!collapsedSections.has("lista-taxonomica") && (
                  <CardContent className="p-0">
                    {/* Estilo do cabeçalho vertical — texto rotacionado para ocupar largura mínima */}
                    <style>{`
                      .lt-vh { writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; padding: 6px 4px; height: 130px; vertical-align: bottom; line-height: 1; letter-spacing: .02em; font-size: 10.5px; }
                      .lt-vh-ua { height: 110px; font-size: 10px; }
                      .lt-cell { padding: 3px 6px; font-size: 10.5px; line-height: 1.25; }
                      .lt-cell-num { padding: 3px 4px; font-size: 10px; }
                      .lt-sticky { position: sticky; left: 0; z-index: 5; }
                      .lt-sticky-h { position: sticky; left: 0; z-index: 7; }
                      .lt-wrap { white-space: normal; word-break: break-word; }
                    `}</style>
                    <p className="px-3 pt-2 pb-1.5 text-[10.5px] text-slate-500 italic">
                      Cabeçalhos rotacionados verticalmente para caber todas as colunas. Role horizontalmente se necessário. <span className="font-semibold not-italic text-slate-600">Nome Científico</span> fica fixo à esquerda.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse" style={{ fontSize: '10.5px' }}>
                        <thead>
                          <tr>
                            {/* Colunas fixas — cabeçalho VERTICAL */}
                            {FIXED_COLS.map(c => {
                              const isNome = c.key === 'nomeCientifico';
                              return (
                                <th
                                  key={c.key}
                                  className={`lt-vh text-center font-bold tracking-wide border-r border-blue-800 ${isNome ? 'lt-sticky-h' : ''}`}
                                  style={{ backgroundColor: HDR_BG, color: '#ffffff' }}
                                  title={c.label}
                                >
                                  {c.label}
                                </th>
                              );
                            })}
                            {/* Coluna Total */}
                            <th className="lt-vh text-center font-bold tracking-wide border-r border-blue-900" style={{ backgroundColor: HDR_TOT, color: '#ffffff' }}>
                              Nº REG.
                            </th>
                            {/* Frequência Relativa */}
                            <th className="lt-vh text-center font-bold tracking-wide border-r border-blue-900" style={{ backgroundColor: HDR_TOT, color: '#ffffff' }}>
                              FREQ. REL.
                            </th>
                            {/* Campanhas em que aparece */}
                            <th className="lt-vh text-center font-bold tracking-wide border-r border-blue-900" style={{ backgroundColor: HDR_TOT, color: '#ffffff' }}>
                              CAMPANHAS
                            </th>
                            {/* Uma coluna por UA — cabeçalho vertical mais compacto */}
                            {allUas.map(ua => (
                              <th
                                key={ua}
                                className="lt-vh lt-vh-ua text-center font-bold tracking-wide border-r border-blue-700 last:border-r-0"
                                style={{ backgroundColor: HDR_UA, color: '#ffffff' }}
                                title={ua}
                              >
                                {ua.length > 18 ? ua.slice(0, 17) + '…' : ua}
                              </th>
                            ))}
                          </tr>
                          {/* Linha de totais por coluna */}
                          <tr style={{ backgroundColor: '#e8eef8' }}>
                            {FIXED_COLS.map((c, i) => {
                              const isNome = c.key === 'nomeCientifico';
                              return (
                                <td
                                  key={c.key}
                                  className={`lt-cell-num border-r border-blue-200 font-semibold text-blue-900 text-center ${isNome ? 'lt-sticky' : ''}`}
                                  style={isNome ? { backgroundColor: '#e8eef8' } : undefined}
                                >
                                  {i === 3 ? `${rows.length} spp` : ''}
                                </td>
                              );
                            })}
                            {/* Total geral */}
                            <td className="lt-cell-num border-r border-blue-300 font-bold text-blue-900 text-center" style={{ backgroundColor: '#d0daf5' }}>
                              {grandTotal}
                            </td>
                            <td className="lt-cell-num border-r border-blue-300 font-bold text-blue-900 text-center" style={{ backgroundColor: '#d0daf5' }}>
                              100%
                            </td>
                            <td className="lt-cell-num border-r border-blue-300 font-bold text-blue-900 text-center" style={{ backgroundColor: '#d0daf5' }}>
                              {new Set(statsSource.map(r => (r.campanha || '').trim()).filter(Boolean)).size}
                            </td>
                            {allUas.map(ua => {
                              const uaTotal = statsSource.filter(r => (r.unidadeAmostral || '').trim() === ua).length;
                              return (
                                <td key={ua} className="lt-cell-num border-r border-blue-200 font-semibold text-blue-900 text-center last:border-r-0" style={{ backgroundColor: '#dce5f5' }}>
                                  {uaTotal}
                                </td>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => {
                            const sp     = (r.nomeCientifico || '').trim().toUpperCase();
                            const counts = countMap.get(sp);
                            const rowBg  = i % 2 === 0 ? '#ffffff' : '#f5f8ff';
                            return (
                              <tr key={i} style={{ backgroundColor: rowBg }}>
                                {FIXED_COLS.map(c => {
                                  const val = r[c.key] as string | undefined;
                                  const isNome = c.key === 'nomeCientifico';
                                  // Quebra de linha permitida em colunas de texto longo
                                  const wrap = ['classe','ordem','familia','nomeComum','endemismo','distribuicao'].includes(c.key as string);
                                  return (
                                    <td
                                      key={c.key}
                                      className={`lt-cell border-b border-slate-100 border-r ${isNome ? 'italic font-semibold text-slate-800 lt-sticky' : 'text-slate-700'} ${wrap ? 'lt-wrap' : ''}`}
                                      style={isNome ? { backgroundColor: rowBg, minWidth: 150, maxWidth: 220, whiteSpace: 'nowrap' } : (wrap ? { maxWidth: 110 } : undefined)}
                                    >
                                      {val || <span className="text-slate-300">—</span>}
                                    </td>
                                  );
                                })}
                                <td className="lt-cell-num border-b border-slate-100 border-r text-center font-semibold text-blue-800" style={{ backgroundColor: '#f0f4ff' }}>
                                  {counts?.total ?? 0}
                                </td>
                                <td className="lt-cell-num border-b border-slate-100 border-r text-center text-slate-700" style={{ backgroundColor: '#f5f7ff' }}>
                                  {grandTotal > 0 ? ((counts?.total ?? 0) / grandTotal * 100).toFixed(1) + '%' : '—'}
                                </td>
                                <td className="lt-cell border-b border-slate-100 border-r text-center text-slate-700 font-medium lt-wrap" style={{ backgroundColor: '#f5f7ff', maxWidth: 120 }}>
                                  {counts && counts.camps.size > 0
                                    ? Array.from(counts.camps).sort(natSort).join(', ')
                                    : <span className="text-slate-300">—</span>}
                                </td>
                                {allUas.map(ua => (
                                  <td key={ua} className="lt-cell-num border-b border-slate-100 border-r last:border-r-0 text-center text-slate-600 tabular-nums">
                                    {counts?.byUa[ua] || <span className="text-slate-200">—</span>}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })()}
          </>}

          {openAnalysisTabs.has("multivariada") && (() => {
            // ── Available dimensions ──
            const allMultiUas   = [...new Set(statsSource.map(r => r.unidadeAmostral).filter(Boolean) as string[])].sort(natSort);
            const allMultiCamps = [...new Set(statsSource.map(r => r.campanha).filter(Boolean) as string[])].sort(natSort);
            const effectiveMultiUas: Set<string>   = selectedMultiUas.size   > 0 ? selectedMultiUas   : new Set(allMultiUas);
            const effectiveMultiCamps: Set<string> = selectedMultiCamps.size > 0 ? selectedMultiCamps : new Set(allMultiCamps);

            // ── Filter source based on active mode ──
            const filteredForMulti = multiMode === "campanha"
              ? statsSource.filter(r => r.campanha         && effectiveMultiCamps.has(r.campanha))
              : statsSource.filter(r => r.unidadeAmostral  && effectiveMultiUas.has(r.unidadeAmostral));

            // ── UA×campanha matrix: one sample per (UA × campanha) combination ──
            const ucData = matrizUaCamp(filteredForMulti);
            const { especies, samples } = ucData;
            // Pure UA matrix for PCA (Hellinger) — computed from filtered data
            const uaStatMulti = matrizUa(filteredForMulti);
            const uasOnly = uaStatMulti.uas;
            const uaMatOnly = uaStatMulti.matriz;

            // ── Shared filter-panel opener icon (reused in each card header) ──
            const modeLabel = multiMode === "ua" ? "🏢 Por UA" : multiMode === "campanha" ? "📅 Por Campanha" : "📍 Por Posição";
            const modeCount = multiMode === "ua"
              ? `${effectiveMultiUas.size}/${allMultiUas.length} UAs`
              : multiMode === "campanha"
                ? `${effectiveMultiCamps.size}/${allMultiCamps.length} Campanhas`
                : `Jusante / Montante`;
            const FilterBadge = () => (
              <button
                onClick={() => setMultiFilterOpen(o => !o)}
                title="Alterar perspectiva / filtro"
                className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-sm transition-all">
                <svg className="w-3 h-3 opacity-60" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M2 4h12M5 8h6M7 12h2" strokeLinecap="round"/>
                </svg>
                {modeLabel} · {modeCount}
              </button>
            );

            // ── Perspective selector panel ──
            const PerspectivePanel = () => (
              <Card className="border-slate-200 bg-slate-50/60">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 opacity-60" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M2 4h12M5 8h6M7 12h2" strokeLinecap="round"/>
                    </svg>
                    Perspectiva de Análise
                    <button onClick={() => setMultiFilterOpen(false)} className="ml-auto text-slate-400 hover:text-slate-700 font-normal text-[11px]">✕ fechar</button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-3">
                  {/* Mode toggle */}
                  <div className="flex gap-2">
                    <button onClick={() => setMultiMode("ua")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${multiMode==="ua" ? "bg-slate-800 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"}`}>
                      🏢 Por UA
                    </button>
                    <button onClick={() => setMultiMode("campanha")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${multiMode==="campanha" ? "bg-indigo-700 text-white border-indigo-900" : "bg-white text-slate-500 border-slate-200 hover:border-indigo-400"}`}>
                      📅 Por Campanha
                    </button>
                    <button onClick={() => setMultiMode("posicao")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${multiMode==="posicao" ? "bg-orange-600 text-white border-orange-800" : "bg-white text-slate-500 border-slate-200 hover:border-orange-400"}`}>
                      📍 Por Posição
                    </button>
                  </div>
                  {/* UA selector */}
                  {multiMode === "ua" && (<>
                    <div className="flex flex-wrap gap-1.5">
                      {allMultiUas.map(ua => {
                        const active = effectiveMultiUas.has(ua);
                        return (
                          <button key={ua}
                            onClick={() => setSelectedMultiUas(prev => {
                              const base = prev.size > 0 ? new Set(prev) : new Set(allMultiUas);
                              if (base.has(ua)) base.delete(ua); else base.add(ua);
                              if (base.size === allMultiUas.length) return new Set<string>();
                              return new Set<string>(base);
                            })}
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${active ? "bg-slate-700 text-white border-slate-900 shadow-sm" : "bg-white text-slate-400 border-slate-200 opacity-50 hover:opacity-80"}`}>
                            {ua}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <button onClick={() => setSelectedMultiUas(new Set())} className="text-slate-500 underline hover:text-slate-700">Todas</button>
                      {selectedMultiUas.size > 0 && <button onClick={() => setSelectedMultiUas(new Set())} className="text-red-400 underline">Limpar</button>}
                      <span className="text-slate-400">{samples.length} amostras · {especies.length} sp · {uasOnly.length} UAs</span>
                    </div>
                  </>)}
                  {/* Campanha selector */}
                  {multiMode === "campanha" && (<>
                    <div className="flex flex-wrap gap-1.5">
                      {allMultiCamps.map(camp => {
                        const active = effectiveMultiCamps.has(camp);
                        return (
                          <button key={camp}
                            onClick={() => setSelectedMultiCamps(prev => {
                              const base = prev.size > 0 ? new Set(prev) : new Set(allMultiCamps);
                              if (base.has(camp)) base.delete(camp); else base.add(camp);
                              if (base.size === allMultiCamps.length) return new Set<string>();
                              return new Set<string>(base);
                            })}
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${active ? "bg-indigo-700 text-white border-indigo-900 shadow-sm" : "bg-white text-slate-400 border-slate-200 opacity-50 hover:opacity-80"}`}>
                            {camp}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <button onClick={() => setSelectedMultiCamps(new Set())} className="text-slate-500 underline hover:text-slate-700">Todas</button>
                      {selectedMultiCamps.size > 0 && <button onClick={() => setSelectedMultiCamps(new Set())} className="text-red-400 underline">Limpar</button>}
                      <span className="text-slate-400">{samples.length} amostras · {especies.length} sp · {allMultiCamps.size} campanhas</span>
                    </div>
                  </>)}
                </CardContent>
              </Card>
            );

            if (samples.length < 3) return (
              <div className="flex flex-col gap-4">
                <PerspectivePanel/>
                <div className="flex flex-col items-center py-12 text-center gap-2 border-2 border-dashed border-muted rounded-xl">
                  <span className="text-3xl">🔬</span>
                  <p className="text-sm font-medium text-muted-foreground">Mínimo de 3 amostras (UA × campanha) necessário para análises multivariadas</p>
                  <p className="text-xs text-muted-foreground/70">{samples.length} amostra(s) disponível(s) em {uasOnly.length} UA(s)</p>
                </div>
              </div>
            );

            // Sample matrix: rows = samples (UA×camp), cols = species
            const sampleMatrix: number[][] = samples.map((_,si) => especies.map((_,ei) => ucData.matriz[ei][si]));
            const distMat = computeDistMatrix(sampleMatrix);
            const pcoa = pcoaFromDist(distMat);
            // True NMDS (Kruskal stress-1 minimisation on Bray-Curtis distances)
            const nmds = nmdsFromDist(distMat);

            // UA-level matrix for PCA (Hellinger PCA is per-UA) — uses filtered UA matrix
            const uaSpMatrix: number[][] = uasOnly.map((_,ui) => uaStatMulti.especies.map((_,si) => uaMatOnly[si][ui]));
            const pca = pcaHellinger(uaSpMatrix);

            // Per-sample labels
            const campLabels = samples.map(s => s.campanha);
            const uaLabels   = samples.map(s => s.ua);

            // ── Position groups: Jusante vs Montante ──
            // Heuristic: UA with lowest numeric suffix = Jusante; rest = Montante
            // Users can override via the `nmdsJusanteUas` state (Set<string>)
            const allUasSorted = [...new Set(samples.map(s => s.ua))].sort((a,b)=>{
              const na=parseInt((a.match(/\d+/)||["9999"])[0]);
              const nb=parseInt((b.match(/\d+/)||["9999"])[0]);
              return na-nb;
            });
            // Default jusante = first UA when nmdsJusanteUas is empty
            const defaultJusante = allUasSorted.slice(0,1);
            const effectiveJusante: Set<string> = nmdsJusanteUas.size > 0 ? nmdsJusanteUas : new Set(defaultJusante);
            const posLabels  = samples.map(s => effectiveJusante.has(s.ua) ? "Jusante" : "Montante");
            const poses      = ["Jusante","Montante"] as const;
            const posColor: Record<string,string> = { Jusante:"#ea580c", Montante:"#0099a8" };
            const posStroke: Record<string,string> = { Jusante:"#9a3a0a", Montante:"#006070" };

            const PAL = [...ECO_PALETTE];
            const camps = [...new Set(campLabels)].sort(natSort);
            const campColor: Record<string,string> = Object.fromEntries(camps.map((c,i)=>[c,PAL[i%PAL.length]]));

            // ── Ictiofauna-only: position grouping ──
            const isIctiofaunaGroup = filterGrupo === "ictiofauna" || filterGrupo === "fauna_ictiofauna";

            // ── Color palettes — ECO unificada (laranja/teal) ──
            const UA_PAL = [...ECO_PALETTE, ...ECO_PALETTE];
            const uaColorMap: Record<string,string> = Object.fromEntries(
              allUasSorted.map((ua,i) => [ua, UA_PAL[i % UA_PAL.length]])
            );
            const campColorMap: Record<string,string> = Object.fromEntries(
              camps.map((c,i) => [c, UA_PAL[i % UA_PAL.length]])
            );

            // ── Visual grouping & ellipses ──
            // campanha mode → group/color by campaign
            // posicao mode → Jusante/Montante (respects config panel)
            // ua mode → by UA
            const activeGroupLabels: string[] = multiMode === "campanha"
              ? campLabels
              : multiMode === "posicao" ? posLabels : uaLabels;
            const activeGroups: string[] = multiMode === "campanha"
              ? camps
              : multiMode === "posicao" ? [...poses] : allUasSorted;
            const activeGroupColor = (g: string) => multiMode === "campanha"
              ? (campColorMap[g] ?? "#888")
              : multiMode === "posicao" ? (posColor[g] ?? "#888") : (uaColorMap[g] ?? "#888");
            const activeGroupStroke = (g: string) => multiMode === "campanha"
              ? (campColorMap[g] ?? "#555")
              : multiMode === "posicao" ? (posStroke[g] ?? "#555") : (uaColorMap[g] ?? "#555");

            const permLabel = multiMode === "campanha"
              ? "entre Campanhas"
              : multiMode === "posicao" ? "Jusante vs Montante" : "entre UAs";

            // For PCA chart (UA-level indexing)
            const posLabelsByUa = uasOnly.map(ua => effectiveJusante.has(ua) ? "Jusante" : "Montante");
            const activeLabelsByUa: string[] = multiMode === "campanha"
              ? uasOnly  // PCA stays UA-based even in campanha mode
              : multiMode === "posicao" ? posLabelsByUa : uasOnly;

            // PERMANOVA matches the visual grouping
            const perm = permanovaTest(distMat, activeGroupLabels, 299);

            const SVGScatter = ({scores,var1,var2,ax1,ax2,t,grpLbls,uaLbls,campLbls}: {scores:{x:number;y:number}[];var1:number;var2:number;ax1:string;ax2:string;t:string;grpLbls?:string[];uaLbls?:string[];campLbls?:string[]}) => {
              const gl=grpLbls||activeGroupLabels, ul=uaLbls||uaLabels, cl=campLbls||campLabels;
              const W=400,H=270,PL=48,PR=14,PT=22,PB=48;
              const pw=W-PL-PR,ph=H-PT-PB;
              const xs=scores.map(s=>s.x),ys=scores.map(s=>s.y);
              const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
              const xr=x1-x0||1,yr=y1-y0||1;
              const px=(x:number)=>PL+(x-x0)/xr*pw, py=(y:number)=>H-PB-(y-y0)/yr*ph;
              return (
                <div>
                  <p className="text-[11px] font-semibold mb-1 text-slate-600 italic">{t}</p>
                  <SvgFigure name={`pcoa_pca_${ax1.toLowerCase()}`}>
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[260px] border rounded-lg bg-white/60">
                    {[.25,.5,.75,1].map(t=>(<line key={t} x1={PL} x2={W-PR} y1={H-PB-t*ph} y2={H-PB-t*ph} stroke="#e5e7eb" strokeWidth=".7" strokeDasharray="3,3"/>))}
                    {[.25,.5,.75,1].map(t=>(<line key={t} x1={PL+t*pw} x2={PL+t*pw} y1={PT} y2={H-PB} stroke="#e5e7eb" strokeWidth=".7" strokeDasharray="3,3"/>))}
                    <line x1={PL} x2={W-PR} y1={H-PB} y2={H-PB} stroke="#9ca3af" strokeWidth="1"/>
                    <line x1={PL} x2={PL} y1={PT} y2={H-PB} stroke="#9ca3af" strokeWidth="1"/>
                    {scores.map((s,i)=>(<circle key={i} cx={px(s.x)} cy={py(s.y)} r="6" fill={activeGroupColor(gl[i]||activeGroups[0])} stroke={activeGroupStroke(gl[i]||activeGroups[0])} strokeWidth="1.3" opacity=".87"><title>{ul[i]} [{cl[i]||""}] — {gl[i]} ({s.x.toFixed(3)},{s.y.toFixed(3)})</title></circle>))}
                    {scores.map((s,i)=>(<text key={i} x={px(s.x)+8} y={py(s.y)+3} fontSize="7" fill="#374151" opacity=".7">{ul[i]?.length>8?ul[i].slice(0,8)+'…':ul[i]}</text>))}
                    <text x={PL+pw/2} y={H-6} textAnchor="middle" fontSize="9" fill="#6b7280">{ax1} ({var1.toFixed(1)}%)</text>
                    <text x={13} y={PT+ph/2} textAnchor="middle" fontSize="9" fill="#6b7280" transform={`rotate(-90 13 ${PT+ph/2})`}>{ax2} ({var2.toFixed(1)}%)</text>
                  </svg>
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/60 px-3 py-1.5">
                    <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mr-1">Grupos:</span>
                      {activeGroups.map(g=>(
                        <span key={g} className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                          <span className="inline-block w-3 h-3 rounded-full border-[1.5px]" style={{background:activeGroupColor(g),borderColor:activeGroupStroke(g)}}/>
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                  </SvgFigure>
                </div>
              );
            };
            return (
              <div className="flex flex-col gap-5">
                {/* ── Perspective / Filter panel (collapsible) ── */}
                {multiFilterOpen
                  ? <PerspectivePanel/>
                  : <div className="flex items-center gap-2 px-1">
                      <span className="text-[10px] text-slate-400">Análise:</span>
                      <FilterBadge/>
                    </div>
                }

                {/* ── Jusante / Montante configuration — visible em modo Por Posição ── */}
                {multiMode === "posicao" && <Card className="border-teal-200 bg-teal-50/50">
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardTitle className="text-xs font-semibold text-teal-800 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-teal-500 inline-block"/>
                      Configuração de Posição — Jusante / Montante
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-[10px] text-teal-700 mb-2">Selecione as UAs que representam o trecho <strong>Jusante</strong> (impacto potencial). As demais serão classificadas como <strong>Montante</strong> (referência). As elipses 95% e o PERMANOVA usam esta classificação.</p>
                    <div className="flex flex-wrap gap-2">
                      {allUasSorted.map(ua=>{
                        const isJus = effectiveJusante.has(ua);
                        return (
                          <button key={ua}
                            onClick={()=>setNmdsJusanteUas(prev=>{
                              const next=new Set(prev.size>0?prev:new Set(defaultJusante));
                              if(next.has(ua)) next.delete(ua); else next.add(ua);
                              return new Set(next);
                            })}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${isJus?"bg-orange-500 text-white border-orange-700":"bg-teal-100 text-teal-800 border-teal-300 hover:bg-teal-200"}`}>
                            {ua} {isJus?"(Jusante)":"(Montante)"}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-3 mt-2 text-[10px] text-teal-600">
                      <span>Jusante ({[...effectiveJusante].join(", ")}): {posLabels.filter(p=>p==="Jusante").length} amostras</span>
                      <span>Montante: {posLabels.filter(p=>p==="Montante").length} amostras</span>
                    </div>
                  </CardContent>
                </Card>}

                {/* ── Section: Ordenação ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-slate-200"/>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest px-2">Ordenação</span>
                    <div className="h-px flex-1 bg-slate-200"/>
                  </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">🔬 PCoA — Coordenadas Principais (Bray-Curtis)<FilterBadge/><AiAnalysisBtn tipo="PCoA — Coordenadas Principais (Bray-Curtis)" contexto={`Amostras analisadas: ${samples.length} (${uasOnly.length} UAs × campanhas) × ${especies.length} espécies. Variância explicada: PCoA1=${pcoa.var1.toFixed(1)}% e PCoA2=${pcoa.var2.toFixed(1)}%. Distância Bray-Curtis (escalamento métrico).`} /></CardTitle></CardHeader>
                    <CardContent>
                      <SVGScatter scores={pcoa.scores} var1={pcoa.var1} var2={pcoa.var2} ax1="PCoA1" ax2="PCoA2" t={`${samples.length} amostras (${uasOnly.length} UAs × campanhas) × ${especies.length} espécies`}/>
                      <p className="text-[10px] text-muted-foreground mt-2">PCoA (Gower 1966) — escalamento métrico baseado em distância Bray-Curtis. Diferente do NMDS, preserva distâncias absolutas entre amostras. Pontos próximos têm composição semelhante.</p>
                    </CardContent>
                  </Card>
                  {pca ? (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">📐 PCA — Transformação de Hellinger<FilterBadge/><AiAnalysisBtn tipo="PCA — Transformação de Hellinger" contexto={`UAs: ${uasOnly.length}. Espécies: ${especies.length}. Variância explicada CP1=${pca.var1.toFixed(1)}% e CP2=${pca.var2.toFixed(1)}% (total ${(pca.var1+pca.var2).toFixed(1)}%). PCA sobre dados Hellinger-transformados.`} /></CardTitle></CardHeader>
                      <CardContent>
                        <SVGScatter scores={pca.scores} var1={pca.var1} var2={pca.var2} ax1="CP1" ax2="CP2" t={`Variância explicada: ${(pca.var1+pca.var2).toFixed(1)}%`} grpLbls={activeLabelsByUa} uaLbls={uasOnly} campLbls={uasOnly.map(()=>"")}/>
                        <p className="text-[10px] text-muted-foreground mt-2">tb-PCA (Legendre & Gallagher 2001) — PCA sobre dados Hellinger-transformados (√proporção). Robusto para matrizes esparsas com muitos zeros. CP1+CP2 explicam {(pca.var1+pca.var2).toFixed(1)}% da variância total.</p>
                      </CardContent>
                    </Card>
                  ) : <Card><CardContent className="py-12 text-center text-xs text-muted-foreground">Dados insuficientes para PCA (mín. 3 UAs × 2 espécies)</CardContent></Card>}
                </div>
                </div>{/* end Ordenação section */}

                {/* ── Section: NMDS ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-slate-200"/>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest px-2">NMDS — Ordenação Não-Métrica</span>
                    <div className="h-px flex-1 bg-slate-200"/>
                  </div>
                {/* ── NMDS 3-panel row (Kruskal stress-1 on Bray-Curtis) ── */}
                {(() => {
                  // Use true NMDS scores (stress minimisation)
                  const cScores = nmds.scores;

                  // Species centroids: weighted average of sample scores by abundance
                  const spCentroids = especies.map((sp,ei)=>{
                    let wx=0,wy=0,w=0;
                    samples.forEach((_,si)=>{ const ab=ucData.matriz[ei][si]; if(ab>0){wx+=ab*cScores[si].x;wy+=ab*cScores[si].y;w+=ab;} });
                    return {sp,x:w>0?wx/w:0,y:w>0?wy/w:0,tot:w};
                  }).filter(s=>s.tot>0).sort((a,b)=>b.tot-a.tot).slice(0,10);

                  // Per-group ellipses (Jusante/Montante for ictiofauna, campanha for others)
                  const groupScores: Record<string,{x:number;y:number}[]> = Object.fromEntries(activeGroups.map(g=>[g,[]]));
                  cScores.forEach((s,i)=>{ if(groupScores[activeGroupLabels[i]]) groupScores[activeGroupLabels[i]].push(s); });
                  const ellipses: Record<string,ReturnType<typeof compute95Ellipse>> = {};
                  activeGroups.forEach(g=>{ ellipses[g]=compute95Ellipse(groupScores[g]); });

                  // SVG helpers for NMDS panels
                  const W=310,H=230,PL=42,PR=12,PT=18,PB=38;
                  const pw=W-PL-PR,ph=H-PT-PB;
                  // Inclui o bounding box das elipses no cálculo do range para que apareçam inteiras
                  const ellExtents = Object.values(ellipses).filter(e=>e && e.rx>0).flatMap(e=>{
                    const cs=Math.cos(e.angle), sn=Math.sin(e.angle);
                    const dx=Math.sqrt((e.rx*cs)**2+(e.ry*sn)**2);
                    const dy=Math.sqrt((e.rx*sn)**2+(e.ry*cs)**2);
                    return [{x:e.cx-dx,y:e.cy-dy},{x:e.cx+dx,y:e.cy+dy}];
                  });
                  const allX=[...cScores.map(s=>s.x),...spCentroids.map(s=>s.x),...ellExtents.map(p=>p.x)];
                  const allY=[...cScores.map(s=>s.y),...spCentroids.map(s=>s.y),...ellExtents.map(p=>p.y)];
                  const xMin=Math.min(...allX),xMax=Math.max(...allX),yMin=Math.min(...allY),yMax=Math.max(...allY);
                  const xRange=xMax-xMin||0.001,yRange=yMax-yMin||0.001;
                  const pad=0.08;
                  const xlo=xMin-pad*xRange,xhi=xMax+pad*xRange,ylo=yMin-pad*yRange,yhi=yMax+pad*yRange;
                  const xr=xhi-xlo,yr=yhi-ylo;
                  const px=(x:number)=>PL+(x-xlo)/xr*pw;
                  const py=(y:number)=>H-PB-(y-ylo)/yr*ph;

                  // Render ellipse as polyline
                  const ellipsePts=(el:ReturnType<typeof compute95Ellipse>,n=60)=>{
                    if(!el||el.rx===0) return "";
                    return Array.from({length:n+1},(_,i)=>{
                      const t=i/n*2*Math.PI;
                      const ex=el.cx+el.rx*Math.cos(t)*Math.cos(el.angle)-el.ry*Math.sin(t)*Math.sin(el.angle);
                      const ey=el.cy+el.rx*Math.cos(t)*Math.sin(el.angle)+el.ry*Math.sin(t)*Math.cos(el.angle);
                      return `${px(ex).toFixed(1)},${py(ey).toFixed(1)}`;
                    }).join(" ");
                  };

                  const Grid=()=><>
                    {[.25,.5,.75,1].map(t=><line key={`h${t}`} x1={PL} x2={W-PR} y1={H-PB-t*ph} y2={H-PB-t*ph} stroke="#e5e7eb" strokeWidth=".6" strokeDasharray="3,2"/>)}
                    {[.25,.5,.75,1].map(t=><line key={`v${t}`} x1={PL+t*pw} x2={PL+t*pw} y1={PT} y2={H-PB} stroke="#e5e7eb" strokeWidth=".6" strokeDasharray="3,2"/>)}
                    <line x1={PL} x2={W-PR} y1={H-PB} y2={H-PB} stroke="#9ca3af" strokeWidth="1"/>
                    <line x1={PL} x2={PL} y1={PT} y2={H-PB} stroke="#9ca3af" strokeWidth="1"/>
                  </>;
                  const AxLabels=({ax,ay}:{ax:string;ay:string})=><>
                    <text x={PL+pw/2} y={H-4} textAnchor="middle" fontSize="8" fill="#6b7280">{ax}</text>
                    <text x={11} y={PT+ph/2} textAnchor="middle" fontSize="8" fill="#6b7280" transform={`rotate(-90 11 ${PT+ph/2})`}>{ay}</text>
                  </>;

                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                          🌐 Ordenação NMDS — Tripainel (Bray-Curtis)
                          <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${nmds.stress < 0.05 ? "bg-green-100 text-green-700" : nmds.stress < 0.10 ? "bg-blue-100 text-blue-700" : nmds.stress < 0.20 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                            Stress = {nmds.stress.toFixed(4)}
                          </span>
                          <FilterBadge/>
                          <AiAnalysisBtn tipo="NMDS — Ordenação Não-Métrica (Bray-Curtis)" contexto={`Stress = ${nmds.stress.toFixed(4)} (${nmds.stress<0.05?"excelente":nmds.stress<0.10?"bom":nmds.stress<0.20?"aceitável":"ruim"}). Amostras: ${samples.length}. Espécies: ${especies.length}. Grupos: ${activeGroups.join(", ")}.`} />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Panel A — Pontos */}
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 mb-1">(A) NMDS — Pontos</p>
                            <SvgFigure name="nmds_panel_a_pontos">
                            <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[210px] border rounded-lg bg-white/70">
                              <Grid/>
                              <AxLabels ax="NMDS1" ay="NMDS2"/>
                              {cScores.map((s,i)=>(
                                <circle key={i} cx={px(s.x)} cy={py(s.y)} r="5.5" fill={activeGroupColor(activeGroupLabels[i])} stroke={activeGroupStroke(activeGroupLabels[i])} strokeWidth="1.3" opacity=".85">
                                  <title>{uaLabels[i]} [{campLabels[i]}] — {activeGroupLabels[i]}</title>
                                </circle>
                              ))}
                            </svg>
                            <div className="mt-1.5 rounded border border-slate-200 bg-slate-50/60 px-2 py-1">
                              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                                {activeGroups.map(g=>(
                                  <span key={g} className="inline-flex items-center gap-1 text-[10px] text-slate-700 font-medium">
                                    <span className="inline-block w-2.5 h-2.5 rounded-full border-[1.5px]" style={{background:activeGroupColor(g),borderColor:activeGroupStroke(g)}}/>
                                    {g}
                                  </span>
                                ))}
                              </div>
                            </div>
                            </SvgFigure>
                          </div>
                          {/* Panel B — Elipses 95% por grupo */}
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 mb-1">(B) NMDS — {multiMode==="campanha"?"Campanhas":multiMode==="posicao"?"Jusante/Montante":"UAs"} (Elipses 95%)</p>
                            <SvgFigure name="nmds_panel_b_elipses">
                            <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[210px] border rounded-lg bg-white/70">
                              <Grid/>
                              <AxLabels ax="NMDS1" ay="NMDS2"/>
                              {activeGroups.map(g=>{
                                const pts=ellipsePts(ellipses[g]);
                                if(!pts) return null;
                                return <polyline key={g} points={pts} fill={activeGroupColor(g)} fillOpacity=".09" stroke={activeGroupColor(g)} strokeWidth="1.3" strokeDasharray="5,3" opacity=".85"/>;
                              })}
                              {cScores.map((s,i)=>(
                                <circle key={i} cx={px(s.x)} cy={py(s.y)} r="5" fill={activeGroupColor(activeGroupLabels[i])} stroke={activeGroupStroke(activeGroupLabels[i])} strokeWidth="1.2" opacity=".88">
                                  <title>{uaLabels[i]} [{campLabels[i]}] — {activeGroupLabels[i]}</title>
                                </circle>
                              ))}
                            </svg>
                            <div className="mt-1.5 rounded border border-slate-200 bg-slate-50/60 px-2 py-1">
                              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                                {activeGroups.map(g=>(
                                  <span key={g} className="inline-flex items-center gap-1 text-[10px] text-slate-700 font-medium">
                                    <svg width="14" height="10" viewBox="0 0 14 10"><ellipse cx="7" cy="5" rx="6" ry="3.5" fill={activeGroupColor(g)} fillOpacity="0.12" stroke={activeGroupColor(g)} strokeWidth="1.2" strokeDasharray="3,2"/></svg>
                                    {g} <span className="text-slate-500 font-normal">({groupScores[g]?.length||0})</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                            </SvgFigure>
                          </div>
                          {/* Panel C — Species centroids */}
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 mb-1">(C) NMDS — Centróides das {spCentroids.length} spp.</p>
                            <SvgFigure name="nmds_panel_c_centroides">
                            <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[210px] border rounded-lg bg-white/70">
                              <Grid/>
                              <AxLabels ax="NMDS1" ay="NMDS2"/>
                              {/* Sample points (faint) */}
                              {cScores.map((s,i)=>(
                                <circle key={i} cx={px(s.x)} cy={py(s.y)} r="4" fill="#94a3b8" stroke="white" strokeWidth="1" opacity=".4"/>
                              ))}
                              {/* Species centroids */}
                              {spCentroids.map((s,i)=>(
                                <g key={i}>
                                  <circle cx={px(s.x)} cy={py(s.y)} r="6" fill="#1e293b" stroke="white" strokeWidth="1.5" opacity=".9"/>
                                  <text x={px(s.x)+8} y={py(s.y)+3} fontSize="6.5" fill="#1e293b" fontWeight="bold" opacity=".85">
                                    {s.sp.split(" ").map((w:string)=>w[0]).join("").toUpperCase()}
                                  </text>
                                </g>
                              ))}
                            </svg>
                            <div className="mt-1.5 rounded border border-slate-200 bg-slate-50/60 px-2 py-1">
                              <div className="text-[9px] uppercase tracking-wider font-semibold text-slate-500 mb-0.5">Abreviações ({Math.min(6, spCentroids.length)}/{spCentroids.length})</div>
                              <div className="flex flex-col gap-0.5">
                                {spCentroids.slice(0,6).map(s=>(
                                  <span key={s.sp} className="text-[10px] text-slate-700 italic leading-tight">
                                    <span className="inline-block min-w-[28px] font-bold not-italic text-slate-900">{s.sp.split(" ").map((w:string)=>w[0]).join("").toUpperCase()}</span>
                                    <span className="text-slate-400 not-italic mx-1">=</span>
                                    {s.sp.split(" ").slice(0,2).join(" ")}
                                  </span>
                                ))}
                              </div>
                            </div>
                            </SvgFigure>
                          </div>
                        </div>
                        <div className="mt-3 rounded-md border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-50/40 px-3 py-2">
                          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Grupos compartilhados:</span>
                            {activeGroups.map(g=>(
                              <span key={g} className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                                <span className="inline-block w-3 h-3 rounded-full border-[1.5px]" style={{background:activeGroupColor(g),borderColor:activeGroupStroke(g)}}/>
                                {g} <span className="text-slate-500 font-normal tabular-nums">({groupScores[g]?.length||0} amostras)</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">NMDS não-métrico — minimização de Kruskal Stress-1 (Bray-Curtis), {samples.length} amostras UA×campanha. Stress &lt;0,05 = excelente; 0,05–0,10 = bom; 0,10–0,20 = razoável; &gt;0,20 = fraco. (B) elipses 95% por {multiMode==="campanha"?"campanha":multiMode==="posicao"?"posição (Jusante/Montante)":"UA"}. (C) centróides ponderados pela abundância.</p>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* ── NMDS Biplot com vetores de espécies ── */}
                {(() => {
                  // Use true NMDS scores (Kruskal stress-1)
                  const cSc = nmds.scores;

                  // Species centroids (weighted by abundance, using UA×campanha samples)
                  const spVecs = especies.map((sp,ei)=>{
                    let wx=0,wy=0,w=0;
                    samples.forEach((_,si)=>{ const ab=ucData.matriz[ei][si]; if(ab>0){wx+=ab*cSc[si].x;wy+=ab*cSc[si].y;w+=ab;} });
                    return {sp,x:w>0?wx/w:0,y:w>0?wy/w:0,len:w>0?Math.sqrt((wx/w)**2+(wy/w)**2):0,tot:w};
                  }).filter(s=>s.tot>0).sort((a,b)=>b.len-a.len).slice(0,10);

                  // Plot dimensions — symmetric around 0
                  const WP=500,HP=380,PLP=55,PRP=65,PTP=28,PBP=48;
                  const pwP=WP-PLP-PRP,phP=HP-PTP-PBP;

                  // Per-group ellipses (Jusante/Montante for ictiofauna, campanha for others)
                  // DECLARE BEFORE USE — bounding box abaixo depende disso
                  const grpPts: Record<string,{x:number;y:number}[]> = Object.fromEntries(activeGroups.map(g=>[g,[]]));
                  cSc.forEach((s,i)=>{ if(grpPts[activeGroupLabels[i]]) grpPts[activeGroupLabels[i]].push(s); });

                  // Calcula bounding box das elipses ativas para incluí-las no range
                  const ellBboxPts: {x:number;y:number}[] = activeGroups.flatMap(g=>{
                    const e = compute95Ellipse(grpPts[g]);
                    if(!e || e.rx===0) return [];
                    const cs=Math.cos(e.angle), sn=Math.sin(e.angle);
                    const dx=Math.sqrt((e.rx*cs)**2+(e.ry*sn)**2);
                    const dy=Math.sqrt((e.rx*sn)**2+(e.ry*cs)**2);
                    return [{x:e.cx-dx,y:e.cy-dy},{x:e.cx+dx,y:e.cy+dy}];
                  });
                  const allAbsX=[...cSc.map(s=>Math.abs(s.x)),...spVecs.map(s=>Math.abs(s.x)),...ellBboxPts.map(p=>Math.abs(p.x))];
                  const allAbsY=[...cSc.map(s=>Math.abs(s.y)),...spVecs.map(s=>Math.abs(s.y)),...ellBboxPts.map(p=>Math.abs(p.y))];
                  const halfX=Math.max(...allAbsX)*1.15||1, halfY=Math.max(...allAbsY)*1.15||1;
                  // Keep aspect square by using same half-range on both axes
                  const half=Math.max(halfX,halfY);
                  const pxP=(x:number)=>PLP+(x+half)/(2*half)*pwP;
                  const pyP=(y:number)=>HP-PBP-(y+half)/(2*half)*phP;
                  const ox0=pxP(0), oy0=pyP(0);

                  // Scale species vectors to 65% of half-range
                  const maxVec=Math.max(...spVecs.map(s=>s.len))||1;
                  const vecScale=half*0.65/maxVec;

                  // Ellipse polyline helper (same as in tripainel)
                  const ellPts=(el:ReturnType<typeof compute95Ellipse>,n=64)=>{
                    if(!el||el.rx===0) return "";
                    return Array.from({length:n+1},(_,i)=>{
                      const t=i/n*2*Math.PI;
                      const ex=el.cx+el.rx*Math.cos(t)*Math.cos(el.angle)-el.ry*Math.sin(t)*Math.sin(el.angle);
                      const ey=el.cy+el.rx*Math.cos(t)*Math.sin(el.angle)+el.ry*Math.sin(t)*Math.cos(el.angle);
                      return `${pxP(ex).toFixed(1)},${pyP(ey).toFixed(1)}`;
                    }).join(" ");
                  };

                  // Marker shapes by campaign index
                  const SHAPES=["circle","square","triangle","diamond"];
                  const Marker=({cx,cy,fill,title,ci}:{cx:number;cy:number;fill:string;title:string;ci:number})=>{
                    const shape=SHAPES[ci%SHAPES.length];
                    const s=7;
                    if(shape==="circle")  return <circle cx={cx} cy={cy} r={s} fill={fill} stroke="white" strokeWidth="1.5" opacity=".9"><title>{title}</title></circle>;
                    if(shape==="square")  return <rect x={cx-s} y={cy-s} width={s*2} height={s*2} fill={fill} stroke="white" strokeWidth="1.5" opacity=".9" rx="1"><title>{title}</title></rect>;
                    if(shape==="triangle"){
                      const pts=`${cx},${cy-s} ${cx+s*0.9},${cy+s*0.6} ${cx-s*0.9},${cy+s*0.6}`;
                      return <polygon points={pts} fill={fill} stroke="white" strokeWidth="1.5" opacity=".9"><title>{title}</title></polygon>;
                    }
                    // diamond
                    const dp=`${cx},${cy-s} ${cx+s},${cy} ${cx},${cy+s} ${cx-s},${cy}`;
                    return <polygon points={dp} fill={fill} stroke="white" strokeWidth="1.5" opacity=".9"><title>{title}</title></polygon>;
                  };

                  // Grid tick values
                  const ticks=[-0.75,-0.5,-0.25,0,0.25,0.5,0.75].filter(v=>Math.abs(v)<=half*1.05);

                  const markerId=`arrow-biplot-${Math.random().toString(36).slice(2,7)}`;

                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">🌐 NMDS Biplot — Amostras + Vetores de Espécies<FilterBadge/><AiAnalysisBtn tipo="NMDS Biplot — Amostras + Vetores de Espécies" contexto={`Stress = ${nmds.stress.toFixed(4)}. Amostras: ${samples.length}. Top 10 espécies indicadoras: ${spVecs.slice(0,10).map(s=>s.sp).join(", ")}.`} /></CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SvgFigure name="nmds_biplot_vetores">
                        <svg viewBox={`0 0 ${WP} ${HP}`} className="w-full max-h-[360px] border rounded-lg bg-white/70">
                          <defs>
                            <marker id={markerId} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                              <path d="M0,0 L0,7 L7,3.5 z" fill="#8b1a1a"/>
                            </marker>
                          </defs>
                          {/* Grid lines */}
                          {ticks.map(v=>[
                            <line key={`gh${v}`} x1={PLP} x2={WP-PRP} y1={pyP(v)} y2={pyP(v)} stroke="#e5e7eb" strokeWidth=".6" strokeDasharray="3,2"/>,
                            <line key={`gv${v}`} x1={pxP(v)} x2={pxP(v)} y1={PTP} y2={HP-PBP} stroke="#e5e7eb" strokeWidth=".6" strokeDasharray="3,2"/>
                          ])}
                          {/* Cross-hair at origin */}
                          <line x1={PLP} x2={WP-PRP} y1={oy0} y2={oy0} stroke="#94a3b8" strokeWidth="1.1"/>
                          <line x1={ox0} x2={ox0} y1={PTP} y2={HP-PBP} stroke="#94a3b8" strokeWidth="1.1"/>
                          {/* Border axes */}
                          <line x1={PLP} x2={WP-PRP} y1={HP-PBP} y2={HP-PBP} stroke="#9ca3af" strokeWidth="1"/>
                          <line x1={PLP} x2={PLP} y1={PTP} y2={HP-PBP} stroke="#9ca3af" strokeWidth="1"/>
                          {/* 95% ellipses per active group */}
                          {activeGroups.map(g=>{
                            const el=compute95Ellipse(grpPts[g]);
                            const pts=ellPts(el);
                            if(!pts) return null;
                            return <polyline key={g} points={pts} fill={activeGroupColor(g)} fillOpacity=".08" stroke={activeGroupColor(g)} strokeWidth="1.5" strokeDasharray="6,4" opacity=".87"/>;
                          })}
                          {/* Species arrow vectors */}
                          {spVecs.map((s)=>{
                            const tx=pxP(s.x*vecScale), ty=pyP(s.y*vecScale);
                            const dx=tx-ox0,dy=ty-oy0,dl=Math.sqrt(dx**2+dy**2)||1;
                            // shorten line slightly for arrowhead room
                            const tx2=tx-dx/dl*4, ty2=ty-dy/dl*4;
                            // label position: a bit beyond arrowhead
                            const lx=tx+(dx/dl)*18, ly=ty+(dy/dl)*14;
                            const isRight=dx>0;
                            return (
                              <g key={s.sp}>
                                <line x1={ox0} y1={oy0} x2={tx2} y2={ty2}
                                  stroke="#8b1a1a" strokeWidth="1.8" markerEnd={`url(#${markerId})`} opacity=".9"/>
                                <text x={lx} y={ly} fontSize="8.5" fontWeight="bold" fill="#8b1a1a"
                                  textAnchor={isRight?"start":"end"} opacity=".95" fontStyle="italic">
                                  {s.sp.split(" ").map(w=>w.toUpperCase()).join(" ")}
                                </text>
                              </g>
                            );
                          })}
                          {/* Sample points: color by active group, shape by campanha */}
                          {cSc.map((s,i)=>{
                            const ci=camps.indexOf(campLabels[i]);
                            return <Marker key={i} cx={pxP(s.x)} cy={pyP(s.y)} fill={activeGroupColor(activeGroupLabels[i])} title={`${uaLabels[i]} [${campLabels[i]}] — ${activeGroupLabels[i]}`} ci={ci}/>;
                          })}
                          {/* Axis labels */}
                          <text x={PLP+pwP/2} y={HP-8} textAnchor="middle" fontSize="10" fill="#6b7280">NMDS1 (stress = {nmds.stress.toFixed(4)})</text>
                          <text x={14} y={PTP+phP/2} textAnchor="middle" fontSize="10" fill="#6b7280" transform={`rotate(-90 14 ${PTP+phP/2})`}>NMDS2</text>
                          {/* Tick values */}
                          {ticks.map(v=>[
                            <text key={`tx${v}`} x={pxP(v)} y={HP-PBP+14} textAnchor="middle" fontSize="7.5" fill="#9ca3af">{v.toFixed(2)}</text>,
                            <text key={`ty${v}`} x={PLP-4} y={pyP(v)+3} textAnchor="end" fontSize="7.5" fill="#9ca3af">{v.toFixed(2)}</text>
                          ])}
                        </svg>
                        {/* Legend — organizada em três seções: Grupos | Formas (campanhas) | Vetores */}
                        <div className="mt-2.5 rounded-md border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-50/40 px-3 py-2 space-y-1.5">
                          {/* Linha 1 — Cores (grupos) — forma única para isolar a semântica de cor */}
                          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Cor — Grupos:</span>
                            {activeGroups.map((g)=>(
                              <span key={g} className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                                <svg width="14" height="14" viewBox="0 0 14 14">
                                  <circle cx="7" cy="7" r="6" fill={activeGroupColor(g)} stroke={activeGroupStroke(g)} strokeWidth="1"/>
                                </svg>
                                {g}
                              </span>
                            ))}
                          </div>
                          {/* Linha 2 — Formas (campanhas) */}
                          {camps.length > 1 && (
                            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-200/70 pt-1.5">
                              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Forma — Campanha:</span>
                              {camps.map((c,ci)=>{
                                const shape=SHAPES[ci%SHAPES.length];
                                return (
                                  <span key={c} className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                                    <svg width="14" height="14" viewBox="0 0 14 14">
                                      {shape==="circle"  && <circle cx="7" cy="7" r="5.5" fill="#94a3b8" stroke="#475569" strokeWidth="1"/>}
                                      {shape==="square"  && <rect x="1.5" y="1.5" width="11" height="11" fill="#94a3b8" stroke="#475569" strokeWidth="1" rx="1"/>}
                                      {shape==="triangle"&& <polygon points="7,1.5 12.5,12.5 1.5,12.5" fill="#94a3b8" stroke="#475569" strokeWidth="1"/>}
                                      {shape==="diamond" && <polygon points="7,1.5 12.5,7 7,12.5 1.5,7" fill="#94a3b8" stroke="#475569" strokeWidth="1"/>}
                                    </svg>
                                    {c}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {/* Linha 3 — Vetores + Elipses */}
                          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-200/70 pt-1.5">
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                              <svg width="26" height="10" viewBox="0 0 26 10"><line x1="2" y1="5" x2="20" y2="5" stroke="#8b1a1a" strokeWidth="1.8"/><polygon points="20,2 26,5 20,8" fill="#8b1a1a"/></svg>
                              <span className="italic">Vetor de espécie</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                              <svg width="26" height="14" viewBox="0 0 26 14"><ellipse cx="13" cy="7" rx="11" ry="5" fill="#64748b" fillOpacity="0.1" stroke="#64748b" strokeWidth="1.3" strokeDasharray="4,3"/></svg>
                              Elipse 95% (intervalo de confiança)
                            </span>
                          </div>
                        </div>
                        </SvgFigure>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Biplot NMDS — Kruskal Stress-1 (Bray-Curtis), {samples.length} amostras UA×campanha, stress = {nmds.stress.toFixed(4)}. Setas = centróides de espécies ponderados pela abundância (escala: {vecScale.toFixed(3)}×). Elipses 95% por {multiMode==="campanha"?"campanha":multiMode==="posicao"?"posição (Jusante/Montante)":"UA"}.
                        </p>
                      </CardContent>
                    </Card>
                  );
                })()}
                </div>{/* end NMDS section */}

                {/* ── Section: Dissimilaridade & Testes ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-slate-200"/>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest px-2">Dissimilaridade & Testes</span>
                    <div className="h-px flex-1 bg-slate-200"/>
                  </div>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">📊 Matriz de Distância de Bray-Curtis ({permLabel})<FilterBadge/><AiAnalysisBtn tipo="Matriz de Distância de Bray-Curtis" contexto={`Amostras: ${samples.length}. Mín=${Math.min(...distMat.flat().filter(v=>v>0)).toFixed(3)}. Máx=${Math.max(...distMat.flat()).toFixed(3)}. Média=${(distMat.flat().reduce((s,v)=>s+v,0)/(distMat.length*distMat.length)).toFixed(3)}.`} /></CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] font-mono">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-medium text-slate-600">Amostra</th>
                            {samples.map(s=>{
                              const lbl=`${s.ua}\n${s.campanha}`;
                              return <th key={s.key} className="px-2 py-1.5 text-center font-medium text-slate-600 whitespace-nowrap" title={lbl} style={{color:activeGroupColor(multiMode==="posicao"?(effectiveJusante.has(s.ua)?"Jusante":"Montante"):multiMode==="campanha"?s.campanha:s.ua)}}>{s.ua.length>6?s.ua.slice(0,6)+'…':s.ua}</th>;
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {samples.map((s,i)=>(
                            <tr key={s.key} className={i%2===0?"bg-white":"bg-slate-50/50"}>
                              <td className="px-2 py-1 font-semibold text-slate-700 whitespace-nowrap" style={{color:activeGroupColor(activeGroupLabels[i])}}>{s.ua} <span className="text-slate-400 font-normal">{s.campanha.length>8?s.campanha.slice(0,8)+'…':s.campanha}</span></td>
                              {distMat[i].map((v,j)=>(
                                <td key={j} className="px-2 py-1 text-center tabular-nums"
                                  style={{background:v===0?'#dbeafe':`rgba(220,38,38,${Math.min(0.65,v*0.85)})`,color:v>0.5?'white':'#1e293b'}}>{v.toFixed(3)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="px-3 py-2 text-[10px] text-muted-foreground">Bray-Curtis — 0 = comunidades idênticas · 1 = sem espécies em comum. Rótulos coloridos por UA.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">📋 PERMANOVA — {permLabel} (299 perm.)<FilterBadge/><AiAnalysisBtn tipo="PERMANOVA" contexto={`Fator: ${permLabel}. Pseudo-F = ${perm.pseudoF.toFixed(4)}. p-valor = ${perm.pValue<0.001?"<0.001":perm.pValue.toFixed(3)}. R² = ${(perm.R2*100).toFixed(1)}%. gl entre = ${perm.dfBetween}, gl dentro = ${perm.dfWithin}. 299 permutações.`} /></CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto mb-3">
                      <table className="w-full text-xs font-mono">
                        <thead className="bg-slate-50 border-b">
                          <tr>{["Fonte","gl","SS","MS","Pseudo-F","p-valor","R²"].map(h=><th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="px-3 py-2 font-medium">Entre {multiMode==="campanha"?"Campanhas":multiMode==="posicao"?"posições":"UAs"}</td>
                            <td className="px-3 py-2 tabular-nums">{perm.dfBetween}</td>
                            <td className="px-3 py-2 tabular-nums">{perm.ssBetween.toFixed(4)}</td>
                            <td className="px-3 py-2 tabular-nums">{perm.dfBetween>0?(perm.ssBetween/perm.dfBetween).toFixed(4):"—"}</td>
                            <td className="px-3 py-2 tabular-nums font-bold">{perm.pseudoF.toFixed(4)}</td>
                            <td className="px-3 py-2"><span className={`font-bold ${perm.pValue<0.05?"text-red-600":"text-muted-foreground"}`}>{perm.pValue<0.001?"<0,001":perm.pValue.toFixed(3)}</span></td>
                            <td className="px-3 py-2 tabular-nums">{(perm.R2*100).toFixed(1)}%</td>
                          </tr>
                          <tr className="border-b bg-slate-50/50">
                            <td className="px-3 py-2 text-muted-foreground">Dentro das {multiMode==="campanha"?"Campanhas":multiMode==="posicao"?"posições":"UAs"}</td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">{perm.dfWithin}</td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">{perm.ssWithin.toFixed(4)}</td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">{perm.dfWithin>0?(perm.ssWithin/perm.dfWithin).toFixed(4):"—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">—</td><td className="px-3 py-2 text-muted-foreground">—</td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">{((1-perm.R2)*100).toFixed(1)}%</td>
                          </tr>
                          <tr className="font-semibold border-t-2">
                            <td className="px-3 py-2">Total</td>
                            <td className="px-3 py-2 tabular-nums">{perm.dfBetween+perm.dfWithin}</td>
                            <td className="px-3 py-2 tabular-nums">{perm.ssTotal.toFixed(4)}</td>
                            <td className="px-3 py-2">—</td><td className="px-3 py-2">—</td><td className="px-3 py-2">—</td>
                            <td className="px-3 py-2">100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{perm.pValue<0.05?`Composição difere significativamente ${permLabel} (p=${perm.pValue<0.001?"<0,001":perm.pValue.toFixed(3)}, R²=${(perm.R2*100).toFixed(1)}%, ${samples.length} amostras UA×campanha)`:`Sem diferença significativa na composição ${permLabel} (p=${perm.pValue.toFixed(3)}, ${samples.length} amostras UA×campanha)`}</p>
                    {(() => {
                      const singletonGroups = activeGroups.filter(g => activeGroupLabels.filter(l => l === g).length === 1);
                      if (singletonGroups.length === 0) return null;
                      return (
                        <div className="mt-2 rounded bg-amber-50 border border-amber-200 px-2 py-1.5 text-[10px] text-amber-800">
                          <strong>Atenção:</strong> {singletonGroups.join(", ")} com apenas 1 amostra. Grupos com n=1 podem inflar o pseudo-F. Interprete com cautela (Anderson 2001).
                        </div>
                      );
                    })()}
                    <div className="mt-2 rounded bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-[10px] text-slate-600 leading-relaxed">
                      <p><strong>Como ler a tabela:</strong> a linha "Dentro das {multiMode==="campanha"?"Campanhas":multiMode==="posicao"?"posições":"UAs"}" é o <strong>resíduo</strong> — quantifica a variação intra-grupo (SS, gl, MS), representa <strong>{((1-perm.R2)*100).toFixed(1)}%</strong> da variação total e serve de <strong>denominador</strong> do Pseudo-F. Por convenção (Anderson 2001), <strong>Pseudo-F e p aparecem só na linha "Entre"</strong>, pois PERMANOVA é um teste omnibus único — não há F ou p para o próprio resíduo.</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Anderson (2001) — Bray-Curtis ao quadrado, {299} permutações. H₀: composição idêntica {permLabel}.</p>
                  </CardContent>
                </Card>

                {/* ── PERMANOVA pareada (post-hoc com correção de Bonferroni) ── */}
                {activeGroups.length >= 3 && (() => {
                  const pairs = permanovaPairwise(distMat, activeGroupLabels, 299);
                  if (pairs.length === 0) return null;
                  const pFmt = (v:number) => v<0.001 ? '<0,001' : v.toFixed(3).replace('.',',');
                  const factorWord = multiMode === "campanha" ? "Campanhas" : multiMode === "posicao" ? "Posições" : "UAs";
                  const sigCount = pairs.filter(p => p.pAdj < 0.05).length;
                  const sigCtx = pairs.filter(p=>p.pAdj<0.05).map(p=>`${p.a}×${p.b}: F=${p.pseudoF.toFixed(2)}, p=${pFmt(p.pAdj)}, R²=${(p.R2*100).toFixed(1)}%`).join("; ") || "nenhum par significativo";
                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full flex-wrap">
                          🔬 PERMANOVA Pareada (post-hoc) — entre {factorWord}
                          <Badge variant="outline" className="text-xs">{pairs.length} pares</Badge>
                          {sigCount > 0
                            ? <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50">{sigCount} significativo{sigCount>1?"s":""}</Badge>
                            : <Badge variant="outline" className="text-xs">nenhum significativo</Badge>}
                          <AiAnalysisBtn tipo={`PERMANOVA Pareada (${factorWord})`}
                            contexto={`Fator: ${factorWord}. ${pairs.length} comparações pareadas (Bonferroni m=${pairs.length}). Pares com p-ajustado < 0,05: ${sigCtx}.`} />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gradient-to-r from-[#0e7490] to-[#0099a8] text-white">
                                <th className="px-3 py-2.5 text-left font-semibold">Comparação</th>
                                <th className="px-3 py-2.5 text-center font-semibold">n (A,B)</th>
                                <th className="px-3 py-2.5 text-center font-semibold">Pseudo-F</th>
                                <th className="px-3 py-2.5 text-center font-semibold">R²</th>
                                <th className="px-3 py-2.5 text-center font-semibold">p</th>
                                <th className="px-3 py-2.5 text-center font-semibold">p adj.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pairs.map((pp, i) => {
                                const sig = pp.pAdj < 0.05;
                                return (
                                  <tr key={i} className={i%2===0?"bg-white":"bg-slate-50/70"}>
                                    <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                                      <span className="text-slate-800">{pp.a}</span>
                                      <span className="mx-1.5 text-slate-400">vs</span>
                                      <span className="text-slate-800">{pp.b}</span>
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums text-slate-600">{pp.nA}, {pp.nB}</td>
                                    <td className="px-3 py-2 text-center tabular-nums font-mono text-slate-700">{pp.pseudoF.toFixed(3).replace('.',',')}</td>
                                    <td className="px-3 py-2 text-center tabular-nums text-slate-600">{(pp.R2*100).toFixed(1)}%</td>
                                    <td className={`px-3 py-2 text-center tabular-nums ${pp.p<0.05?"text-orange-600":"text-slate-500"}`}>{pFmt(pp.p)}</td>
                                    <td className={`px-3 py-2 text-center tabular-nums font-bold ${sig?"text-red-600":"text-slate-500"}`}>{pFmt(pp.pAdj)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="px-3 py-2 text-[10px] text-muted-foreground space-y-0.5 border-t bg-slate-50/30 leading-relaxed">
                          <p><strong>PERMANOVA pareada:</strong> análogo multivariado do Dunn pós-Kruskal-Wallis. Roda uma PERMANOVA de 2 grupos em cada par, com {299} permutações sobre Bray-Curtis². <strong>p adj.</strong> = Bonferroni (p × {pairs.length} comparações).</p>
                          <p>Pares com <strong>p adj. &lt; 0,05</strong> em <strong className="text-red-600">vermelho</strong> = composição difere significativamente entre os dois grupos. R² = fração da variação explicada pela diferença entre o par. Anderson (2001); Anderson &amp; Walsh (2013). α=0,05.</p>
                          {pairs.length === 1 && (
                            <p className="text-amber-700"><strong>Atenção:</strong> apenas 1 par disponível — o p-ajustado é igual ao p bruto (Bonferroni com m=1).</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                </div>{/* end Dissimilaridade & Testes section */}
              </div>
            );
          })()}

          {openAnalysisTabs.has("biometria") && (() => {
            // CT (comprimento total) is the primary biometric length variable.
            // LC (comprimento padrão) is used as fallback when CT is absent.
            const bioPairs: {sp:string;lc:number;peso:number;src:"CT"|"LC";sexo:string;campanha:string;ua:string}[] = [];
            statsSource.forEach(r => {
              if (!r.nomeCientifico) return;
              const ctv = parseFloat(r.ctMm || "");
              const lcv = parseFloat(r.lcMm || "");
              const lv = isFinite(ctv) && ctv > 0 ? ctv : (isFinite(lcv) && lcv > 0 ? lcv : NaN);
              const src: "CT"|"LC" = isFinite(ctv) && ctv > 0 ? "CT" : "LC";
              const pv = parseFloat(r.pesoG || "");
              if (isFinite(lv) && lv>0 && isFinite(pv) && pv>0) bioPairs.push({
                sp: r.nomeCientifico.trim(),
                lc: lv, peso: pv, src,
                sexo: (r.sexo || "").trim().toUpperCase(),
                campanha: r.campanha || "",
                ua: r.unidadeAmostral || "",
              });
            });
            const hasCT = bioPairs.some(p=>p.src==="CT");
            const hasLC = bioPairs.some(p=>p.src==="LC");
            const lenLabel = hasCT && hasLC ? "CT/LC (mm)" : hasCT ? "CT (mm)" : "LC (mm)";
            if (bioPairs.length < 3) return (
              <div className="flex flex-col items-center py-12 text-center gap-2 border-2 border-dashed border-muted rounded-xl">
                <span className="text-3xl">📏</span>
                <p className="text-sm font-medium text-muted-foreground">Sem dados biométricos disponíveis</p>
                <p className="text-xs text-muted-foreground/70">Preencha <strong>CT (MM)</strong> e <strong>PESO (G)</strong> nos registros de ictiofauna para habilitar esta análise. LC (MM) também é aceito como medida de comprimento alternativa.</p>
              </div>
            );
            const fit = powerLawFit(bioPairs.map(p=>p.lc), bioPairs.map(p=>p.peso));
            const xArr=bioPairs.map(p=>p.lc), yArr=bioPairs.map(p=>p.peso);
            const x0=Math.min(...xArr),x1=Math.max(...xArr),y0=Math.min(...yArr),y1=Math.max(...yArr);
            const W=500,H=300,PL=55,PR=20,PT=20,PB=50;
            const pw=W-PL-PR,ph=H-PT-PB;
            const px=(x:number)=>PL+(x-x0)/(x1-x0||1)*pw, py=(y:number)=>H-PB-(y-y0)/(y1-y0||1)*ph;
            const curvePts = fit ? Array.from({length:60},(_,i)=>{const x=x0+i/59*(x1-x0);return {x,y:fit.a*Math.pow(x,fit.b)};}).filter(p=>p.y>=y0&&p.y<=y1*1.15) : [];
            const BIO_PAL = [...ECO_PALETTE, ...ECO_PALETTE];
            const uasBio = [...new Set(bioPairs.map(p=>p.ua).filter(Boolean))].sort();
            const uaColorBio: Record<string,string> = Object.fromEntries(uasBio.map((ua,i)=>[ua, BIO_PAL[i%BIO_PAL.length]]));
            const sps=[...new Set(bioPairs.map(p=>p.sp))].sort();
            const spColor:Record<string,string>=Object.fromEntries(sps.map((s,i)=>[s,BIO_PAL[i%BIO_PAL.length]]));
            const bySpecies = sps.map(sp=>{
              const pts=bioPairs.filter(p=>p.sp===sp);
              const ml=pts.reduce((s,p)=>s+p.lc,0)/pts.length, mp=pts.reduce((s,p)=>s+p.peso,0)/pts.length;
              const sf=powerLawFit(pts.map(p=>p.lc),pts.map(p=>p.peso));
              return {sp,n:pts.length,meanLc:ml,meanPeso:mp,a:sf?.a,b:sf?.b,r2:sf?.r2};
            });
            return (
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap w-full">
                      📏 Relação Comprimento-Peso — W (g) = a × {hasCT && !hasLC ? "CT" : hasLC && !hasCT ? "LC" : "L"}^b
                      {fit && <Badge variant="outline" className="text-xs font-mono">R² = {fit.r2.toFixed(4)} · a = {fit.a.toFixed(5)} · b = {fit.b.toFixed(4)}</Badge>}
                      <AiAnalysisBtn tipo="Relação Comprimento-Peso" contexto={`Variável de comprimento: ${hasCT && !hasLC ? "CT" : hasLC && !hasCT ? "LC" : "L"}. ${fit ? `Coeficientes ajustados: a=${fit.a.toFixed(5)}, b=${fit.b.toFixed(4)}, R²=${fit.r2.toFixed(4)}.` : "Sem ajuste possível."} N=${bioPairs.length} indivíduos. ${bySpecies.length} espécies analisadas.`} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SvgFigure name="biometria_comprimento_peso">
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[280px] border rounded-lg bg-white/60">
                      {[.25,.5,.75,1].map(t=>(<line key={t} x1={PL} x2={W-PR} y1={H-PB-t*ph} y2={H-PB-t*ph} stroke="#e5e7eb" strokeWidth=".7" strokeDasharray="3,3"/>))}
                      {[.25,.5,.75,1].map(t=>(<line key={t} x1={PL+t*pw} x2={PL+t*pw} y1={PT} y2={H-PB} stroke="#e5e7eb" strokeWidth=".7" strokeDasharray="3,3"/>))}
                      <line x1={PL} x2={W-PR} y1={H-PB} y2={H-PB} stroke="#9ca3af" strokeWidth="1"/>
                      <line x1={PL} x2={PL} y1={PT} y2={H-PB} stroke="#9ca3af" strokeWidth="1"/>
                      {curvePts.length>1&&<polyline points={curvePts.map(p=>`${px(p.x)},${py(p.y)}`).join(" ")} fill="none" stroke="#dc2626" strokeWidth="2" strokeDasharray="6,3" opacity=".8"/>}
                      {bioPairs.map((p,i)=>(<circle key={i} cx={px(p.lc)} cy={py(p.peso)} r="5" fill={uaColorBio[p.ua]??"#888"} stroke="white" strokeWidth="1.2" opacity=".85"><title>{p.sp} [{p.ua}]: L={p.lc}mm, W={p.peso}g</title></circle>))}
                      {fit && (
                        <g>
                          <rect x={PL+4} y={PT+4} width="152" height="28" rx="3" fill="white" fillOpacity=".88" stroke="#d1d5db" strokeWidth=".8"/>
                          <text x={PL+10} y={PT+16} fontSize="8.5" fill="#1e293b" fontFamily="monospace">log₁₀(W) = {(Math.log10(fit.a)).toFixed(3)} + {fit.b.toFixed(2)}·log₁₀(L)</text>
                          <text x={PL+10} y={PT+27} fontSize="8.5" fill="#475569" fontFamily="monospace">R² = {fit.r2.toFixed(3)}</text>
                        </g>
                      )}
                      <text x={PL+pw/2} y={H-8} textAnchor="middle" fontSize="10" fill="#6b7280">Comprimento — {lenLabel}</text>
                      <text x={16} y={PT+ph/2} textAnchor="middle" fontSize="10" fill="#6b7280" transform={`rotate(-90 16 ${PT+ph/2})`}>Peso (g)</text>
                      {[x0,(x0+x1)/2,x1].map((v,i)=>(<text key={i} x={px(v)} y={H-PB+15} textAnchor="middle" fontSize="8" fill="#9ca3af">{v.toFixed(0)}</text>))}
                      {[y0,(y0+y1)/2,y1].map((v,i)=>(<text key={i} x={PL-4} y={py(v)+3} textAnchor="end" fontSize="8" fill="#9ca3af">{v.toFixed(1)}</text>))}
                    </svg>
                    </SvgFigure>
                    {fit && (
                      <div className="mt-2 p-2 rounded-lg bg-slate-50 border text-xs">
                        <p className="font-semibold font-mono">W (g) = {fit.a.toFixed(5)} × {hasCT && !hasLC ? "CT" : hasLC && !hasCT ? "LC" : "L"}^{fit.b.toFixed(4)}</p>
                        <p className="text-muted-foreground">R² = {fit.r2.toFixed(4)} · N = {bioPairs.length} registros · {sps.length} espécie(s) · comprimento: {lenLabel}</p>
                        {fit.b>=2.8&&fit.b<=3.2&&<p className="text-emerald-600 mt-1">✓ b ≈ 3 — crescimento isométrico</p>}
                        {fit.b>3.2&&<p className="text-violet-600 mt-1">↑ b &gt; 3 — alometria positiva (engorda proporcionalmente mais)</p>}
                        {fit.b<2.8&&<p className="text-amber-600 mt-1">↓ b &lt; 3 — alometria negativa (cresce proporcionalmente mais)</p>}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">{uasBio.map(ua=>(<span key={ua} className="flex items-center gap-1 text-[10px] text-slate-600 font-medium"><span className="inline-block w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{background:uaColorBio[ua]}}/>{ua}</span>))}</div>
                    <p className="text-[10px] text-muted-foreground mt-1">Pontos coloridos por UA. Passe o mouse sobre cada ponto para ver espécie e valores.</p>
                  </CardContent>
                </Card>
                {/* ── PCA Biplot (CT & Peso) ── */}
                {(() => {
                  const hasCT2 = bioPairs.some(p=>p.ct!=null&&p.ct>0);
                  const pairsForPca = bioPairs.filter(p=>p.peso>0&&(hasCT2?p.ct!=null&&p.ct>0:p.lc>0));
                  const xVarLabel = hasCT2 ? "CT" : "LC";
                  const pcaBio = pca2D(pairsForPca.map(p=>({x:(hasCT2&&p.ct!=null)?p.ct:p.lc, y:p.peso})));
                  if (!pcaBio || pairsForPca.length < 3) return (
                    <Card><CardContent className="py-8 text-center text-xs text-muted-foreground">Dados insuficientes para PCA biplot (mínimo 3 registros com comprimento e peso)</CardContent></Card>
                  );
                  const {scores,loadings,var1,var2} = pcaBio;
                  const WB=500,HB=320,PLB=50,PRB=20,PTB=24,PBB=46;
                  const pwB=WB-PLB-PRB,phB=HB-PTB-PBB;
                  const allSx=scores.map(s=>s.x),allSy=scores.map(s=>s.y);
                  // scale loadings to ~60% of data range for visibility
                  const maxSR=Math.max(...allSx.map(v=>Math.abs(v)),...allSy.map(v=>Math.abs(v)))||1;
                  const maxLR=Math.max(...loadings.map(l=>Math.sqrt(l.x**2+l.y**2)))||1;
                  const arrScale=maxSR*0.6/maxLR;
                  const scaledL=loadings.map(l=>({name:l.name,x:l.x*arrScale,y:l.y*arrScale}));
                  const allX=[...allSx,...scaledL.map(l=>l.x)];
                  const allY=[...allSy,...scaledL.map(l=>l.y)];
                  const xMinB=Math.min(...allX),xMaxB=Math.max(...allX);
                  const yMinB=Math.min(...allY),yMaxB=Math.max(...allY);
                  const xRangeB=xMaxB-xMinB||1,yRangeB=yMaxB-yMinB||1;
                  const padB=0.13;
                  const xloB=xMinB-padB*xRangeB,xhiB=xMaxB+padB*xRangeB;
                  const yloB=yMinB-padB*yRangeB,yhiB=yMaxB+padB*yRangeB;
                  const pxB=(x:number)=>PLB+(x-xloB)/(xhiB-xloB)*pwB;
                  const pyB=(y:number)=>HB-PBB-(y-yloB)/(yhiB-yloB)*phB;
                  // origin position
                  const ox=pxB(0),oy=pyB(0);
                  // arrowhead helper
                  const arrowHead=(x2:number,y2:number)=>{
                    const dx=x2-ox,dy=y2-oy,len=Math.sqrt(dx**2+dy**2)||1;
                    const ux=dx/len,uy=dy/len,sz=7;
                    const lx=x2-sz*ux+sz*0.4*(-uy), ly=y2-sz*uy+sz*0.4*ux;
                    const rx2=x2-sz*ux-sz*0.4*(-uy), ry2=y2-sz*uy-sz*0.4*ux;
                    return `M${lx.toFixed(1)},${ly.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} L${rx2.toFixed(1)},${ry2.toFixed(1)}`;
                  };
                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                          📊 PCA Biplot — {xVarLabel} & Peso
                          <Badge variant="outline" className="text-xs">PC1 {var1.toFixed(1)}% · PC2 {var2.toFixed(1)}%</Badge>
                          <AiAnalysisBtn tipo={`PCA Biplot — ${xVarLabel} & Peso`} contexto={`PCA biométrica baseada em ${xVarLabel} e peso. Variância explicada: PC1=${var1.toFixed(1)}%, PC2=${var2.toFixed(1)}% (total ${(var1+var2).toFixed(1)}%).`} />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SvgFigure name="biometria_pca_biplot">
                        <svg viewBox={`0 0 ${WB} ${HB}`} className="w-full max-h-[300px] border rounded-lg bg-white/70">
                          {/* grid */}
                          {[.25,.5,.75,1].map(t=>[
                            <line key={`gh${t}`} x1={PLB} x2={WB-PRB} y1={HB-PBB-t*phB} y2={HB-PBB-t*phB} stroke="#e5e7eb" strokeWidth=".6" strokeDasharray="3,3"/>,
                            <line key={`gv${t}`} x1={PLB+t*pwB} x2={PLB+t*pwB} y1={PTB} y2={HB-PBB} stroke="#e5e7eb" strokeWidth=".6" strokeDasharray="3,3"/>
                          ])}
                          {/* origin axes */}
                          {ox>=PLB&&ox<=WB-PRB&&<line x1={ox} x2={ox} y1={PTB} y2={HB-PBB} stroke="#cbd5e1" strokeWidth="1"/>}
                          {oy>=PTB&&oy<=HB-PBB&&<line x1={PLB} x2={WB-PRB} y1={oy} y2={oy} stroke="#cbd5e1" strokeWidth="1"/>}
                          {/* border axes */}
                          <line x1={PLB} x2={WB-PRB} y1={HB-PBB} y2={HB-PBB} stroke="#9ca3af" strokeWidth="1"/>
                          <line x1={PLB} x2={PLB} y1={PTB} y2={HB-PBB} stroke="#9ca3af" strokeWidth="1"/>
                          {/* sample points colored by UA */}
                          {scores.map((s,i)=>(
                            <circle key={i} cx={pxB(s.x)} cy={pyB(s.y)} r="5" fill={uaColorBio[pairsForPca[i]?.ua]??"#888"} stroke="white" strokeWidth="1.2" opacity=".82">
                              <title>{pairsForPca[i]?.sp} [{pairsForPca[i]?.ua}]: {xVarLabel}={pairsForPca[i]?.lc}mm, W={pairsForPca[i]?.peso}g</title>
                            </circle>
                          ))}
                          {/* loading arrows */}
                          {scaledL.map(l=>{
                            const tx=pxB(l.x),ty=pyB(l.y);
                            return (
                              <g key={l.name}>
                                <line x1={ox} y1={oy} x2={tx} y2={ty} stroke="#dc2626" strokeWidth="1.8" opacity=".9"/>
                                <path d={arrowHead(tx,ty)} fill="#dc2626" opacity=".9"/>
                                <text x={tx+(tx>ox?6:-6)} y={ty+(ty>oy?12:-5)} fontSize="10" fontWeight="bold" fill="#dc2626" textAnchor={tx>ox?"start":"end"}>{l.name}</text>
                              </g>
                            );
                          })}
                          {/* axis labels */}
                          <text x={PLB+pwB/2} y={HB-8} textAnchor="middle" fontSize="10" fill="#6b7280">PC1 ({var1.toFixed(1)}%)</text>
                          <text x={16} y={PTB+phB/2} textAnchor="middle" fontSize="10" fill="#6b7280" transform={`rotate(-90 16 ${PTB+phB/2})`}>PC2 ({var2.toFixed(1)}%)</text>
                          {/* tick values */}
                          {[0,.5,1].map(v=>{
                            const xv=xMinB+v*xRangeB;
                            return <text key={v} x={pxB(xv)} y={HB-PBB+14} textAnchor="middle" fontSize="7" fill="#9ca3af">{xv.toFixed(2)}</text>;
                          })}
                          {[0,.5,1].map(v=>{
                            const yv=yMinB+v*yRangeB;
                            return <text key={v} x={PLB-5} y={pyB(yv)+3} textAnchor="end" fontSize="7" fill="#9ca3af">{yv.toFixed(2)}</text>;
                          })}
                        </svg>
                        </SvgFigure>
                        <div className="flex flex-wrap gap-2 mt-2">{uasBio.map(ua=>(<span key={ua} className="flex items-center gap-1 text-[10px] text-slate-600 font-medium"><span className="inline-block w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{background:uaColorBio[ua]}}/>{ua}</span>))}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">PCA (2 variáveis, dados padronizados). Setas vermelhas = vetores de carga de {xVarLabel} e Peso. Pontos coloridos por UA.</p>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* ── Relação Comprimento-Peso por UA ── */}
                {uasBio.length >= 2 && (() => {
                  const WU=560,HU=300,PLU=55,PRU=20,PTU=22,PBU=50;
                  const pwU=WU-PLU-PRU,phU=HU-PTU-PBU;
                  const xAll=bioPairs.map(p=>p.lc), yAll=bioPairs.map(p=>p.peso);
                  const x0U=Math.min(...xAll),x1U=Math.max(...xAll),y0U=Math.min(...yAll),y1U=Math.max(...yAll);
                  const pxU=(x:number)=>PLU+(x-x0U)/(x1U-x0U||1)*pwU;
                  const pyU=(y:number)=>HU-PBU-(y-y0U)/(y1U-y0U||1)*phU;
                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                          📍 Relação Comprimento-Peso por UA
                          <Badge variant="outline" className="text-xs">{uasBio.length} UAs</Badge>
                          <AiAnalysisBtn tipo="Relação Comprimento-Peso por UA" contexto={`UAs comparadas: ${uasBio.length} (${uasBio.join(", ")}). Análise visual da variação biométrica entre unidades amostrais.`} />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SvgFigure name="biometria_comprimento_peso_por_ua">
                        <svg viewBox={`0 0 ${WU} ${HU}`} className="w-full max-h-[290px] border rounded-lg bg-white/60">
                          {[.25,.5,.75,1].map(t=>(<line key={`gh${t}`} x1={PLU} x2={WU-PRU} y1={HU-PBU-t*phU} y2={HU-PBU-t*phU} stroke="#e5e7eb" strokeWidth=".7" strokeDasharray="3,3"/>))}
                          {[.25,.5,.75,1].map(t=>(<line key={`gv${t}`} x1={PLU+t*pwU} x2={PLU+t*pwU} y1={PTU} y2={HU-PBU} stroke="#e5e7eb" strokeWidth=".7" strokeDasharray="3,3"/>))}
                          <line x1={PLU} x2={WU-PRU} y1={HU-PBU} y2={HU-PBU} stroke="#9ca3af" strokeWidth="1"/>
                          <line x1={PLU} x2={PLU} y1={PTU} y2={HU-PBU} stroke="#9ca3af" strokeWidth="1"/>
                          {/* Per-UA regression curves */}
                          {uasBio.map(ua=>{
                            const pts=bioPairs.filter(p=>p.ua===ua);
                            if(pts.length<3) return null;
                            const f=powerLawFit(pts.map(p=>p.lc),pts.map(p=>p.peso));
                            if(!f) return null;
                            const xUa=pts.map(p=>p.lc);
                            const xMin=Math.min(...xUa),xMax=Math.max(...xUa);
                            const cPts=Array.from({length:40},(_,i)=>{const x=xMin+i/39*(xMax-xMin);return {x,y:f.a*Math.pow(x,f.b)};}).filter(p=>p.y>=y0U&&p.y<=y1U*1.15);
                            if(cPts.length<2) return null;
                            return <polyline key={ua} points={cPts.map(p=>`${pxU(p.x)},${pyU(p.y)}`).join(" ")} fill="none" stroke={uaColorBio[ua]} strokeWidth="2" strokeDasharray="5,3" opacity=".8"/>;
                          })}
                          {/* Points colored by UA */}
                          {bioPairs.map((p,i)=>(<circle key={i} cx={pxU(p.lc)} cy={pyU(p.peso)} r="4.5" fill={uaColorBio[p.ua]??"#888"} stroke="white" strokeWidth="1.2" opacity=".85"><title>{p.sp} [{p.ua}]: L={p.lc}mm, W={p.peso}g</title></circle>))}
                          <text x={PLU+pwU/2} y={HU-8} textAnchor="middle" fontSize="10" fill="#6b7280">Comprimento — {lenLabel}</text>
                          <text x={16} y={PTU+phU/2} textAnchor="middle" fontSize="10" fill="#6b7280" transform={`rotate(-90 16 ${PTU+phU/2})`}>Peso (g)</text>
                          {[x0U,(x0U+x1U)/2,x1U].map((v,i)=>(<text key={i} x={pxU(v)} y={HU-PBU+15} textAnchor="middle" fontSize="8" fill="#9ca3af">{v.toFixed(0)}</text>))}
                          {[y0U,(y0U+y1U)/2,y1U].map((v,i)=>(<text key={i} x={PLU-4} y={pyU(v)+3} textAnchor="end" fontSize="8" fill="#9ca3af">{v.toFixed(1)}</text>))}
                        </svg>
                        </SvgFigure>
                        {/* Per-UA stats table */}
                        <div className="overflow-x-auto mt-3">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 border-b">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold">UA</th>
                                <th className="px-3 py-2 text-center font-semibold">N</th>
                                <th className="px-3 py-2 text-left font-semibold">L̄ ({lenLabel})</th>
                                <th className="px-3 py-2 text-left font-semibold">W̄ (g)</th>
                                <th className="px-3 py-2 text-left font-semibold font-mono">a</th>
                                <th className="px-3 py-2 text-left font-semibold font-mono">b</th>
                                <th className="px-3 py-2 text-left font-semibold">R²</th>
                              </tr>
                            </thead>
                            <tbody>
                              {uasBio.map((ua,i)=>{
                                const pts=bioPairs.filter(p=>p.ua===ua);
                                const ml=pts.reduce((s,p)=>s+p.lc,0)/pts.length;
                                const mp=pts.reduce((s,p)=>s+p.peso,0)/pts.length;
                                const f=pts.length>=3?powerLawFit(pts.map(p=>p.lc),pts.map(p=>p.peso)):null;
                                return (
                                  <tr key={ua} className={i%2===0?"bg-white":"bg-slate-50/60"}>
                                    <td className="px-3 py-1.5 font-semibold flex items-center gap-1.5">
                                      <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{background:uaColorBio[ua]}}/>
                                      {ua}
                                    </td>
                                    <td className="px-3 py-1.5 tabular-nums text-center">{pts.length}</td>
                                    <td className="px-3 py-1.5 tabular-nums">{ml.toFixed(1)}</td>
                                    <td className="px-3 py-1.5 tabular-nums">{mp.toFixed(2)}</td>
                                    <td className="px-3 py-1.5 tabular-nums font-mono text-[10px]">{f?f.a.toFixed(5):"—"}</td>
                                    <td className="px-3 py-1.5 tabular-nums font-mono text-[10px]">{f?f.b.toFixed(4):"—"}</td>
                                    <td className="px-3 py-1.5 tabular-nums">{f?f.r2.toFixed(4):"—"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">Curvas tracejadas = regressão de potência W=a×L^b por UA (mín. 3 registros). Pontos coloridos por UA.</p>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* ── Testes Estatísticos Biométricos ── */}
                {(() => {
                  const hasCT3 = bioPairs.some(p=>p.ct!=null&&p.ct>0);
                  const valid = bioPairs.filter(p=>p.peso>0&&(hasCT3?p.ct!=null&&p.ct>0:p.lc>0));
                  if (valid.length < 4) return null;
                  const L  = valid.map(p=>(hasCT3&&p.ct!=null)?p.ct:p.lc);
                  const W  = valid.map(p=>p.peso);
                  const lL = L.map(v=>Math.log10(v));
                  const lW = W.map(v=>Math.log10(v));
                  const n  = valid.length;

                  // Pearson on log-log
                  const pr = pearson(lL, lW);
                  // Spearman on raw
                  const sp = spearman(L, W);
                  // t-test for isometry H₀: b=3
                  const tIso = (() => {
                    if (!fit || n < 4) return null;
                    // SE(b) = sqrt((1-r²)*var_logy / ((n-2)*var_logx))
                    const mlL=lL.reduce((s,v)=>s+v,0)/n, mlW=lW.reduce((s,v)=>s+v,0)/n;
                    const varX=lL.reduce((s,v)=>s+(v-mlL)**2,0)/(n-1);
                    const varY=lW.reduce((s,v)=>s+(v-mlW)**2,0)/(n-1);
                    const se = Math.sqrt(Math.max(0,(1-pr.r**2)*varY/((n-2)*varX)));
                    const tStat = se>0?(fit.b-3)/se:NaN;
                    return {t:tStat, p:tPVal2(tStat,n-2), se, df:n-2};
                  })();
                  // Jarque-Bera normality
                  const jbL = jarqueBera(L);
                  const jbW = jarqueBera(W);
                  const jbLL= jarqueBera(lL);
                  const jbLW= jarqueBera(lW);

                  const lenLbl = hasCT3 ? "CT (mm)" : "LC (mm)";

                  const pFmt=(p:number)=>{
                    if(isNaN(p)) return "—";
                    if(p<0.001) return "<0,001";
                    return p.toFixed(3).replace(".",",");
                  };

                  type Row = {label:string; stat:string; val:string; p:number|null; interp:string; interpCls:string};
                  const rows: Row[] = [
                    {
                      label:"Correlação de Pearson — log₁₀(L) vs log₁₀(W)",
                      stat:`r = ${isNaN(pr.r)?'—':pr.r.toFixed(4)}`,
                      val:`t(${n-2}) = ${isNaN(pr.t)?'—':pr.t.toFixed(3)}`,
                      p:pr.p,
                      interp:isNaN(pr.p)?'—':pr.p<0.05?`Correlação linear forte no espaço log-log (r=${pr.r.toFixed(3)})`:"Correlação fraca ou não significativa",
                      interpCls:pr.p<0.05?"text-emerald-700":"text-amber-600",
                    },
                    {
                      label:"Correlação de Spearman — L vs W (monotônica)",
                      stat:`ρ = ${isNaN(sp.r)?'—':sp.r.toFixed(4)}`,
                      val:`t(${n-2}) = ${isNaN(sp.t)?'—':sp.t.toFixed(3)}`,
                      p:sp.p,
                      interp:isNaN(sp.p)?'—':sp.p<0.05?`Associação monotônica significativa (ρ=${sp.r.toFixed(3)})`:"Associação não significativa",
                      interpCls:sp.p<0.05?"text-emerald-700":"text-amber-600",
                    },
                    ...(tIso ? [{
                      label:"Teste t — Isometria (H₀: b = 3)",
                      stat:`b = ${fit?fit.b.toFixed(4):'—'} · SE = ${tIso.se.toFixed(4)}`,
                      val:`t(${tIso.df}) = ${isNaN(tIso.t)?'—':tIso.t.toFixed(3)}`,
                      p:tIso.p,
                      interp:isNaN(tIso.p)?'—':tIso.p<0.05
                        ?(fit&&fit.b>3?"Alometria positiva (b>3): peso cresce mais rápido que comprimento":"Alometria negativa (b<3): comprimento cresce mais rápido")
                        :"Crescimento isométrico — b não difere de 3",
                      interpCls:tIso.p<0.05?"text-violet-700":"text-emerald-700",
                    }] : []),
                    {
                      label:`Normalidade — ${lenLbl} (Jarque-Bera)`,
                      stat:`JB = ${isNaN(jbL.jb)?'—':jbL.jb.toFixed(3)} · S=${isNaN(jbL.skew)?'—':jbL.skew.toFixed(3)} · K=${isNaN(jbL.kurt)?'—':jbL.kurt.toFixed(3)}`,
                      val:`χ²≈ ${isNaN(jbL.jb)?'—':jbL.jb.toFixed(3)} (df=2)`,
                      p:jbL.p,
                      interp:isNaN(jbL.p)?'—':jbL.p<0.05?"Distribuição não normal":"Distribuição compatível com normalidade",
                      interpCls:jbL.p<0.05?"text-amber-700":"text-emerald-700",
                    },
                    {
                      label:"Normalidade — Peso (g) (Jarque-Bera)",
                      stat:`JB = ${isNaN(jbW.jb)?'—':jbW.jb.toFixed(3)} · S=${isNaN(jbW.skew)?'—':jbW.skew.toFixed(3)} · K=${isNaN(jbW.kurt)?'—':jbW.kurt.toFixed(3)}`,
                      val:`χ²≈ ${isNaN(jbW.jb)?'—':jbW.jb.toFixed(3)} (df=2)`,
                      p:jbW.p,
                      interp:isNaN(jbW.p)?'—':jbW.p<0.05?"Distribuição não normal":"Distribuição compatível com normalidade",
                      interpCls:jbW.p<0.05?"text-amber-700":"text-emerald-700",
                    },
                    {
                      label:"Normalidade — log₁₀(L) (Jarque-Bera)",
                      stat:`JB = ${isNaN(jbLL.jb)?'—':jbLL.jb.toFixed(3)} · S=${isNaN(jbLL.skew)?'—':jbLL.skew.toFixed(3)} · K=${isNaN(jbLL.kurt)?'—':jbLL.kurt.toFixed(3)}`,
                      val:`χ²≈ ${isNaN(jbLL.jb)?'—':jbLL.jb.toFixed(3)} (df=2)`,
                      p:jbLL.p,
                      interp:isNaN(jbLL.p)?'—':jbLL.p<0.05?"Dados log não normais — interprete regressão com cautela":"log₁₀(L) compatível com normalidade",
                      interpCls:jbLL.p<0.05?"text-amber-700":"text-emerald-700",
                    },
                    {
                      label:"Normalidade — log₁₀(W) (Jarque-Bera)",
                      stat:`JB = ${isNaN(jbLW.jb)?'—':jbLW.jb.toFixed(3)} · S=${isNaN(jbLW.skew)?'—':jbLW.skew.toFixed(3)} · K=${isNaN(jbLW.kurt)?'—':jbLW.kurt.toFixed(3)}`,
                      val:`χ²≈ ${isNaN(jbLW.jb)?'—':jbLW.jb.toFixed(3)} (df=2)`,
                      p:jbLW.p,
                      interp:isNaN(jbLW.p)?'—':jbLW.p<0.05?"Dados log não normais — interprete regressão com cautela":"log₁₀(W) compatível com normalidade",
                      interpCls:jbLW.p<0.05?"text-amber-700":"text-emerald-700",
                    },
                  ];

                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                          🔢 Testes Estatísticos Biométricos
                          <Badge variant="outline" className="text-xs">N = {n}</Badge>
                          <AiAnalysisBtn tipo="Testes Estatísticos Biométricos" contexto={`N total = ${n} indivíduos analisados em testes biométricos (normalidade, homogeneidade, comparações entre UAs/grupos).`} />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gradient-to-r from-[#0e7490] to-[#0099a8] text-white">
                                <th className="px-3 py-2.5 text-left font-semibold">Teste / Estatística</th>
                                <th className="px-3 py-2.5 text-left font-semibold">Valor</th>
                                <th className="px-3 py-2.5 text-center font-semibold">p</th>
                                <th className="px-3 py-2.5 text-left font-semibold">Interpretação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row,i)=>(
                                <tr key={i} className={i%2===0?"bg-white":"bg-slate-50/70"}>
                                  <td className="px-3 py-2 font-medium text-slate-700 max-w-[200px]">{row.label}</td>
                                  <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">{row.stat}<br/><span className="text-[10px] text-slate-400">{row.val}</span></td>
                                  <td className="px-3 py-2 text-center tabular-nums">
                                    {row.p!==null && (
                                      <span className={`font-bold ${row.p<0.05?"text-red-600":"text-slate-500"}`}>
                                        {pFmt(row.p)}
                                      </span>
                                    )}
                                  </td>
                                  <td className={`px-3 py-2 ${row.interpCls}`}>{row.interp}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="px-3 py-2 text-[10px] text-muted-foreground">
                          Pearson/Spearman: H₀ ρ=0, df=n−2. Isometria: H₀ b=3 (crescimento isométrico). Jarque-Bera: H₀ normalidade, p≈exp(−JB/2) para χ²(2). α=0,05.
                        </p>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* ── Mann-Whitney: por Sexo dentro de cada Espécie ── */}
                {(() => {
                  const lenLblMW = bioPairs.some(p=>p.src==="CT") ? "CT" : "LC";
                  const zFmt  = (v:number|undefined) => v==null||isNaN(v) ? '—' : v.toFixed(3);
                  const pFmt2 = (v:number|undefined) => {
                    if (v==null||isNaN(v)) return '—';
                    if (v<0.001) return '<0,001';
                    return v.toFixed(3).replace('.',',');
                  };

                  // ── helpers ──────────────────────────────────────────────
                  type MWRow = {label:string;sub:string;mwL:ReturnType<typeof mannWhitney>;mwW:ReturnType<typeof mannWhitney>};
                  const SEX_M = ["M","MACHO","MALE"];
                  const SEX_F = ["F","FEMEA","FÊMEA","FEMALE"];
                  const normSex = (s:string) => SEX_M.includes(s) ? "M" : SEX_F.includes(s) ? "F" : "";

                  const spList = [...new Set(bioPairs.map(p=>p.sp))].sort();
                  const rows: MWRow[] = [];
                  let mode: "sex"|"camp"|"intersp" = "intersp";

                  // 1️⃣  PRIMARY — M vs F within each species
                  spList.forEach(sp => {
                    const pts = bioPairs.filter(p=>p.sp===sp&&p.peso>0&&p.lc>0);
                    const mPts = pts.filter(p=>normSex(p.sexo)==="M");
                    const fPts = pts.filter(p=>normSex(p.sexo)==="F");
                    if (mPts.length>=2 && fPts.length>=2) {
                      rows.push({
                        label: sp,
                        sub: `Machos (n=${mPts.length}) vs Fêmeas (n=${fPts.length})`,
                        mwL: mannWhitney(mPts.map(p=>p.lc), fPts.map(p=>p.lc)),
                        mwW: mannWhitney(mPts.map(p=>p.peso), fPts.map(p=>p.peso)),
                      });
                    }
                  });
                  if (rows.length > 0) mode = "sex";

                  // 2️⃣  SECONDARY — between campanhas within each species (if ≥2 campanhas)
                  if (rows.length === 0) {
                    spList.forEach(sp => {
                      const pts = bioPairs.filter(p=>p.sp===sp&&p.peso>0&&p.lc>0&&p.campanha);
                      const camps = [...new Set(pts.map(p=>p.campanha))].sort();
                      for (let ci=0;ci<camps.length;ci++)
                        for (let cj=ci+1;cj<camps.length;cj++) {
                          const cA=camps[ci], cB=camps[cj];
                          const dA=pts.filter(p=>p.campanha===cA), dB=pts.filter(p=>p.campanha===cB);
                          if (dA.length>=2&&dB.length>=2)
                            rows.push({
                              label: sp,
                              sub: `${cA} (n=${dA.length}) vs ${cB} (n=${dB.length})`,
                              mwL: mannWhitney(dA.map(p=>p.lc), dB.map(p=>p.lc)),
                              mwW: mannWhitney(dA.map(p=>p.peso), dB.map(p=>p.peso)),
                            });
                        }
                    });
                    if (rows.length > 0) mode = "camp";
                  }

                  // 3️⃣  FALLBACK — between species (only if no intraspecific comparison possible)
                  if (rows.length === 0 && spList.length >= 2) {
                    mode = "intersp";
                    const abbrSp=(s:string)=>s.split(" ").map(w=>w[0]).join(".").toUpperCase();
                    for(let i=0;i<spList.length;i++)
                      for(let j=i+1;j<spList.length;j++){
                        const sp1=spList[i],sp2=spList[j];
                        const d1=bioPairs.filter(p=>p.sp===sp1&&p.lc>0&&p.peso>0);
                        const d2=bioPairs.filter(p=>p.sp===sp2&&p.lc>0&&p.peso>0);
                        if(d1.length>=2&&d2.length>=2)
                          rows.push({
                            label:`${abbrSp(sp1)} vs ${abbrSp(sp2)}`,
                            sub:`${sp1} × ${sp2}`,
                            mwL:mannWhitney(d1.map(p=>p.lc),d2.map(p=>p.lc)),
                            mwW:mannWhitney(d1.map(p=>p.peso),d2.map(p=>p.peso)),
                          });
                      }
                  }

                  if (rows.length === 0) return null;

                  const sectionTitle =
                    mode === "sex"    ? "Dimorfismo Sexual — Mann-Whitney U (Macho vs Fêmea por espécie)" :
                    mode === "camp"   ? "Variação Temporal — Mann-Whitney U (entre campanhas por espécie)" :
                                        "Comparação Interespecífica — Mann-Whitney U";
                  const subtitle = mode === "intersp"
                    ? "Atenção: sem dados de sexo ou campanha suficientes por espécie. Exibindo comparação interespecífica como alternativa."
                    : "";

                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap w-full">
                          {sectionTitle}
                          <Badge variant="outline" className="text-xs">{rows.length} comparação(ões)</Badge>
                          <AiAnalysisBtn tipo={sectionTitle} contexto={`${sectionTitle}. ${rows.length} comparações pareadas executadas.`} />
                        </CardTitle>
                        {subtitle && (
                          <p className="text-[10px] text-amber-600 mt-0.5">{subtitle}</p>
                        )}
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gradient-to-r from-[#0e7490] to-[#0099a8] text-white">
                                <th className="px-3 py-2.5 text-left font-semibold">Espécie / Comparação</th>
                                <th className="px-3 py-2.5 text-center font-semibold">z ({lenLblMW})</th>
                                <th className="px-3 py-2.5 text-center font-semibold">p ({lenLblMW})</th>
                                <th className="px-3 py-2.5 text-center font-semibold">z (Peso)</th>
                                <th className="px-3 py-2.5 text-center font-semibold">p (Peso)</th>
                                <th className="px-3 py-2.5 text-left font-semibold">Resultado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row,i) => {
                                const sigL = row.mwL && row.mwL.p < 0.05;
                                const sigW = row.mwW && row.mwW.p < 0.05;
                                return (
                                  <tr key={i} className={i%2===0?"bg-white":"bg-slate-50/70"}>
                                    <td className="px-3 py-2 font-medium text-slate-700">
                                      <span className="italic font-semibold">{row.label}</span>
                                      <div className="text-[9px] text-slate-400 font-normal">{row.sub}</div>
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums font-mono">
                                      <span className={sigL?"text-red-600 font-bold":"text-slate-600"}>{zFmt(row.mwL?.z)}</span>
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums">
                                      <span className={sigL?"text-red-600 font-bold":"text-slate-500"}>{pFmt2(row.mwL?.p)}</span>
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums font-mono">
                                      <span className={sigW?"text-red-600 font-bold":"text-slate-600"}>{zFmt(row.mwW?.z)}</span>
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums">
                                      <span className={sigW?"text-red-600 font-bold":"text-slate-500"}>{pFmt2(row.mwW?.p)}</span>
                                    </td>
                                    <td className="px-3 py-2 text-[10px]">
                                      {sigL && sigW && <span className="text-red-600 font-medium">Diferem em {lenLblMW} e Peso</span>}
                                      {sigL && !sigW && <span className="text-amber-600">Diferem em {lenLblMW}</span>}
                                      {!sigL && sigW && <span className="text-amber-600">Diferem em Peso</span>}
                                      {!sigL && !sigW && <span className="text-emerald-600">Sem diferença sig.</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="px-3 py-2 text-[10px] text-muted-foreground">
                          Mann-Whitney U, z-aproximação normal (sem correção de continuidade). H₀: distribuições idênticas entre grupos. Valores em <strong>vermelho</strong> = p &lt; 0,05. α=0,05.
                        </p>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* ── Kruskal-Wallis + Dunn (post-hoc): comparação entre múltiplos grupos ── */}
                {(() => {
                  const lenLblKW = bioPairs.some(p=>p.src==="CT") ? "CT" : "LC";
                  const pFmt3 = (v:number) => {
                    if (v==null||isNaN(v)) return '—';
                    if (v<0.001) return '<0,001';
                    return v.toFixed(3).replace('.',',');
                  };
                  // Group by UA (primary) — only UAs with ≥3 pairs
                  const byUa: Record<string, {lc:number[];peso:number[]}> = {};
                  bioPairs.forEach(p => {
                    if (!p.ua) return;
                    if (!byUa[p.ua]) byUa[p.ua] = {lc:[], peso:[]};
                    byUa[p.ua].lc.push(p.lc);
                    byUa[p.ua].peso.push(p.peso);
                  });
                  const uaList = Object.keys(byUa).filter(u => byUa[u].lc.length >= 3).sort(natSort);
                  // Group by Campanha (secondary) — only camps with ≥3 pairs
                  const byCamp: Record<string, {lc:number[];peso:number[]}> = {};
                  bioPairs.forEach(p => {
                    if (!p.campanha) return;
                    if (!byCamp[p.campanha]) byCamp[p.campanha] = {lc:[], peso:[]};
                    byCamp[p.campanha].lc.push(p.lc);
                    byCamp[p.campanha].peso.push(p.peso);
                  });
                  const campList = Object.keys(byCamp).filter(c => byCamp[c].lc.length >= 3).sort(natSort);

                  // Pick the best factor (≥3 groups preferred; fall back to 2 if needed)
                  const useFactor: "ua" | "camp" | null =
                    uaList.length >= 2 ? "ua" : campList.length >= 2 ? "camp" : null;
                  if (!useFactor) return null;

                  const labels = useFactor === "ua" ? uaList : campList;
                  const groupsLc   = labels.map(l => useFactor === "ua" ? byUa[l].lc   : byCamp[l].lc);
                  const groupsPeso = labels.map(l => useFactor === "ua" ? byUa[l].peso : byCamp[l].peso);
                  const factorLbl  = useFactor === "ua" ? "Unidades Amostrais" : "Campanhas";

                  const kwLc   = kruskalWallis(groupsLc);
                  const kwPeso = kruskalWallis(groupsPeso);
                  const dunnLc   = dunnTest(groupsLc,   labels);
                  const dunnPeso = dunnTest(groupsPeso, labels);

                  // Index pairs (a,b) → quick lookup map for Dunn results
                  const dunnLcMap   = new Map(dunnLc.map(d   => [`${d.a}|||${d.b}`, d]));
                  const dunnPesoMap = new Map(dunnPeso.map(d => [`${d.a}|||${d.b}`, d]));
                  // All pairs in canonical order
                  const allPairs: {a:string;b:string}[] = [];
                  for (let i=0;i<labels.length;i++) for (let j=i+1;j<labels.length;j++) allPairs.push({a:labels[i], b:labels[j]});

                  const kwBadge = (kw: ReturnType<typeof kruskalWallis>) => {
                    if (!kw) return <Badge variant="outline" className="text-[10px]">N/A</Badge>;
                    const sig = kw.p < 0.05;
                    return (
                      <Badge variant="outline" className={`text-[10px] tabular-nums ${sig?"border-red-300 text-red-700 bg-red-50":"border-slate-200 text-slate-600 bg-slate-50"}`}>
                        H={kw.H.toFixed(2)} · df={kw.df} · p={pFmt3(kw.p)}
                      </Badge>
                    );
                  };

                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full flex-wrap">
                          📊 Kruskal-Wallis + Dunn (post-hoc) — Comparação entre {factorLbl}
                          <Badge variant="outline" className="text-xs">{labels.length} grupos</Badge>
                          <AiAnalysisBtn tipo={`Kruskal-Wallis + Dunn (${factorLbl})`}
                            contexto={`Fator: ${factorLbl}. Grupos: ${labels.join(", ")}. KW ${lenLblKW}: H=${kwLc?.H.toFixed(3)}, p=${kwLc?pFmt3(kwLc.p):"—"}. KW Peso: H=${kwPeso?.H.toFixed(3)}, p=${kwPeso?pFmt3(kwPeso.p):"—"}. Pares significativos (Dunn, p<0,05 após Bonferroni): ${[...dunnLc.filter(d=>d.pAdj<0.05).map(d=>`${d.a} vs ${d.b} [${lenLblKW}]`),...dunnPeso.filter(d=>d.pAdj<0.05).map(d=>`${d.a} vs ${d.b} [Peso]`)].join("; ")||"nenhum"}.`} />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {/* Omnibus row */}
                        <div className="px-3 pt-2 pb-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-700 border-b bg-slate-50/50">
                          <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500">Omnibus (Kruskal-Wallis):</span>
                          <span>{lenLblKW}: {kwBadge(kwLc)}</span>
                          <span>·</span>
                          <span>Peso: {kwBadge(kwPeso)}</span>
                        </div>
                        {/* Dunn pairwise table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gradient-to-r from-[#0e7490] to-[#0099a8] text-white">
                                <th className="px-3 py-2.5 text-left font-semibold">Comparação</th>
                                <th className="px-3 py-2.5 text-center font-semibold">z ({lenLblKW})</th>
                                <th className="px-3 py-2.5 text-center font-semibold">p ({lenLblKW})</th>
                                <th className="px-3 py-2.5 text-center font-semibold">p adj. ({lenLblKW})</th>
                                <th className="px-3 py-2.5 text-center font-semibold">z (Peso)</th>
                                <th className="px-3 py-2.5 text-center font-semibold">p (Peso)</th>
                                <th className="px-3 py-2.5 text-center font-semibold">p adj. (Peso)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {allPairs.map((pair, i) => {
                                const dl = dunnLcMap.get(`${pair.a}|||${pair.b}`);
                                const dp = dunnPesoMap.get(`${pair.a}|||${pair.b}`);
                                const sigLc = dl && dl.pAdj < 0.05;
                                const sigPeso = dp && dp.pAdj < 0.05;
                                return (
                                  <tr key={i} className={i%2===0?"bg-white":"bg-slate-50/70"}>
                                    <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                                      <span className="text-slate-800">{pair.a}</span>
                                      <span className="mx-1.5 text-slate-400">vs</span>
                                      <span className="text-slate-800">{pair.b}</span>
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums font-mono text-slate-600">{dl?dl.z.toFixed(3).replace('.',','):'—'}</td>
                                    <td className={`px-3 py-2 text-center tabular-nums ${dl && dl.p<0.05?"text-orange-600":"text-slate-500"}`}>{dl?pFmt3(dl.p):'—'}</td>
                                    <td className={`px-3 py-2 text-center tabular-nums font-bold ${sigLc?"text-red-600":"text-slate-500"}`}>{dl?pFmt3(dl.pAdj):'—'}</td>
                                    <td className="px-3 py-2 text-center tabular-nums font-mono text-slate-600">{dp?dp.z.toFixed(3).replace('.',','):'—'}</td>
                                    <td className={`px-3 py-2 text-center tabular-nums ${dp && dp.p<0.05?"text-orange-600":"text-slate-500"}`}>{dp?pFmt3(dp.p):'—'}</td>
                                    <td className={`px-3 py-2 text-center tabular-nums font-bold ${sigPeso?"text-red-600":"text-slate-500"}`}>{dp?pFmt3(dp.pAdj):'—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="px-3 py-2 text-[10px] text-muted-foreground space-y-0.5 border-t bg-slate-50/30">
                          <p><strong>Kruskal-Wallis:</strong> ANOVA não-paramétrica omnibus sobre rankings (com correção para empates). H₀: distribuições idênticas em todos os grupos. Se p &lt; 0,05, há pelo menos um par diferente.</p>
                          <p><strong>Dunn (post-hoc):</strong> comparações pareadas usando ranks médios. Coluna <strong>p adj.</strong> = ajuste de Bonferroni (p × nº de comparações). Pares com p adj. &lt; 0,05 em <strong className="text-red-600">vermelho</strong>. α=0,05. Dunn (1964); Pohlert (2014).</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* ── Boxplots de Biometria por UA ── */}
                {(() => {
                  const byUaLc: Record<string, number[]> = {};
                  const byUaPeso: Record<string, number[]> = {};
                  bioPairs.forEach(p => {
                    const ua = p.ua || "(sem UA)";
                    if (!byUaLc[ua]) byUaLc[ua] = [];
                    if (!byUaPeso[ua]) byUaPeso[ua] = [];
                    if (isFinite(p.lc) && p.lc > 0) byUaLc[ua].push(p.lc);
                    if (isFinite(p.peso) && p.peso > 0) byUaPeso[ua].push(p.peso);
                  });
                  const lcGroups: BoxStats[] = Object.entries(byUaLc)
                    .map(([label, v]) => { const s = buildBoxStats(v); return s ? { label, ...s } : null; })
                    .filter((x): x is BoxStats => !!x && x.n >= 2)
                    .sort((a, b) => b.n - a.n).slice(0, 14);
                  const pesoGroups: BoxStats[] = Object.entries(byUaPeso)
                    .map(([label, v]) => { const s = buildBoxStats(v); return s ? { label, ...s } : null; })
                    .filter((x): x is BoxStats => !!x && x.n >= 2)
                    .sort((a, b) => b.n - a.n).slice(0, 14);
                  if (!lcGroups.length && !pesoGroups.length) return null;
                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Ruler className="w-4 h-4 text-teal-600" />
                          Boxplots de Biometria por Unidade Amostral
                          <span className="text-[10px] font-normal text-muted-foreground ml-auto">
                            Q1–Q3 · mediana · whiskers 1.5×IQR · outliers
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {lcGroups.length > 0 && (
                            <BoxplotChart groups={lcGroups} yLabel={`Comprimento (${lenLabel})`} title={`Comprimento ${lenLabel} por UA`} color="#0099a8" />
                          )}
                          {pesoGroups.length > 0 && (
                            <BoxplotChart groups={pesoGroups} yLabel="Peso (g)" title="Peso (g) por UA" color="#ea580c" />
                          )}
                        </div>
                        <div className="mt-2 text-[10px] text-muted-foreground bg-slate-50/60 rounded p-2 border leading-relaxed">
                          <strong>Como ler:</strong> caixa = intervalo interquartílico (Q1–Q3); linha central = mediana; bigodes (whiskers) = valores dentro de 1,5×IQR a partir dos quartis; pontos isolados = outliers. Top 14 UAs por nº de medições.
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">Estatísticas Biométricas por Espécie<AiAnalysisBtn tipo="Estatísticas Biométricas por Espécie" contexto={`Espécies analisadas: ${bySpecies.length}.\n` + bySpecies.slice(0,15).map(r => `${r.sp}: N=${r.n}, L̄=${r.meanLc?.toFixed(2)}, W̄=${r.meanPeso?.toFixed(2)}g${r.b?`, b=${r.b.toFixed(3)}, R²=${r.r2?.toFixed(3)}`:""}`).join("\n")} /></CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b">
                          <tr>{["Espécie","N",`L̄ ${lenLabel}`,"W̄ (g)","a","b","R²"].map(h=><th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>{bySpecies.map((row,i)=>(
                          <tr key={row.sp} className={i%2===0?"bg-white":"bg-slate-50/50"}>
                            <td className="px-3 py-1.5 font-medium italic">{row.sp}</td>
                            <td className="px-3 py-1.5 tabular-nums">{row.n}</td>
                            <td className="px-3 py-1.5 tabular-nums">{row.meanLc.toFixed(1)}</td>
                            <td className="px-3 py-1.5 tabular-nums">{row.meanPeso.toFixed(2)}</td>
                            <td className="px-3 py-1.5 tabular-nums font-mono text-[10px]">{row.a!==undefined?row.a.toFixed(5):"—"}</td>
                            <td className="px-3 py-1.5 tabular-nums font-mono text-[10px]">{row.b!==undefined?row.b.toFixed(4):"—"}</td>
                            <td className="px-3 py-1.5 tabular-nums">{row.r2!==undefined?row.r2.toFixed(4):"—"}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════
              CPUE — Captura Por Unidade de Esforço
          ══════════════════════════════════════════════════════════════ */}
          {openAnalysisTabs.has("cpue") && (() => {
            const cpueSource = statsSource;
            if (!cpueSource.length) return (
              <div className="flex flex-col items-center py-12 text-center gap-2 border-2 border-dashed border-muted rounded-xl">
                <Waves className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Sem registros para análise de CPUE</p>
                <p className="text-xs text-muted-foreground/70">Importe dados com as colunas <strong>ESFORÇO AMOSTRAL</strong> e <strong>UNIDADE DE ESFORÇO</strong> para calcular a CPUE real.</p>
              </div>
            );

            const hasEsforco = cpueSource.some(r => r.esforcoAmostral && r.esforcoAmostral > 0);
            const effortUnit = hasEsforco
              ? ([...new Set(cpueSource.filter(r => r.unidadeEsforco).map(r => r.unidadeEsforco!))].join("/") || "unid.")
              : "evento";

            const getN = (r: CampoRegistro) => (r.abundancia && r.abundancia > 0) ? r.abundancia : 1;
            const getE = (r: CampoRegistro) => (r.esforcoAmostral && r.esforcoAmostral > 0) ? r.esforcoAmostral : 0;
            const getW = (r: CampoRegistro) => { const v = parseFloat(r.pesoG || ""); return isNaN(v) ? 0 : v; };

            const cpueLabel  = hasEsforco ? `CPUEn [N/f — ind./${effortUnit}]` : "IAR (ind./campanha)";
            const cpueLabelW = hasEsforco ? `CPUEb [B/f — g/${effortUnit}]` : "IAR Biomassa (g/campanha)"; // used in MatrixTable header
            const hasWeightData = cpueSource.some(r => getW(r) > 0);

            // ── All methods in dataset (sorted). CPUE is ALWAYS stratified per method.
            const allMethods = [...new Set(cpueSource.map(r => r.metodo?.trim() || "(sem método)"))].sort();
            const METHOD_PAL = [...ECO_PALETTE, ...ECO_PALETTE];

            // ── Matrix: rows keyed by primaryKey, columns keyed by method ─────────
            // CPUE real: CPUEn = (ΣN / ΣE) × 100  — estimador de razão (Petersen).
            //   Acumula ΣN e ΣE separadamente por bucket (pk × método), depois divide.
            //   Robusto quando o esforço varia entre registros; evita o viés da soma
            //   de razões Σ(Nᵢ/Eᵢ) que super-pondera eventos com baixo esforço.
            //   Registros sem esforço (E=0) são contabilizados em skippedN e excluídos
            //   do cálculo CPUE (mas o N total da linha ainda os inclui).
            //
            // IAR (sem esforço): IAR = ΣN / nº de campanhas distintas por bucket.
            //   "Campanha" = r.campanha || r.data || "s/d". Evita inflação quando há
            //   muitas campanhas acumuladas — o resultado é a média de indivíduos/campanha.

            type MEntry = {
              totalN: number; totalW: number; totalE: number;
              skippedN: number;              // N de registros sem esforço (excluídos do CPUE)
              camps: Set<string>;
              eventEfforts: Map<string, number>; // efeito-amostral único por evento de coleta
            };
            type MRow = { label: string; byMethod: Record<string, MEntry>; totN: number };
            type MEntryFinal = { cpueN: number; cpueW: number; N: number; effort: number; nEvents: number; skippedN: number };
            type MRowFinal   = { label: string; byMethod: Record<string, MEntryFinal>; totN: number };

            const buildMatrix = (
              key: (r: CampoRegistro) => string,
              sortFn?: (a: MRowFinal, b: MRowFinal) => number,
              topN?: number
            ): MRowFinal[] => {
              const m: Record<string, MRow> = {};
              cpueSource.forEach(r => {
                const pk   = key(r) || "(não informado)";
                const met  = r.metodo?.trim() || "(sem método)";
                const camp = r.campanha || r.data || "s/d";
                // Evento de coleta = combinação única que compartilha o MESMO esforço
                // (mesma UA + método + campanha + data). Sem isso, o esforço fixo
                // copiado em cada linha de espécie inflaria ΣE proporcional a ΣN.
                const eventKey = `${r.unidadeAmostral || ""}|${met}|${camp}|${r.data || ""}`;
                if (!m[pk]) m[pk] = { label: pk, byMethod: {}, totN: 0 };
                if (!m[pk].byMethod[met]) m[pk].byMethod[met] = { totalN: 0, totalW: 0, totalE: 0, skippedN: 0, camps: new Set(), eventEfforts: new Map() };
                const nm = getN(r); const bm = getW(r); const epm = getE(r);
                m[pk].totN += nm;
                m[pk].byMethod[met].camps.add(camp);
                if (hasEsforco) {
                  if (epm > 0) {
                    m[pk].byMethod[met].totalN += nm;
                    m[pk].byMethod[met].totalW += bm;
                    // Guarda esforço por evento — mesmo evento, mesmo valor (não soma)
                    const prev = m[pk].byMethod[met].eventEfforts.get(eventKey);
                    // Se houver divergência (raro), conserva o maior valor reportado
                    if (prev === undefined || epm > prev) {
                      m[pk].byMethod[met].eventEfforts.set(eventKey, epm);
                    }
                  } else {
                    m[pk].byMethod[met].skippedN += nm;
                  }
                } else {
                  m[pk].byMethod[met].totalN += nm;
                  m[pk].byMethod[met].totalW += bm;
                }
              });
              const rows: MRowFinal[] = Object.values(m).map(row => {
                const byMethod: Record<string, MEntryFinal> = {};
                for (const [met, e] of Object.entries(row.byMethod)) {
                  const nEvents = e.camps.size || 1;
                  // Esforço total = soma dos esforços ÚNICOS por evento de coleta
                  const eTotal = hasEsforco
                    ? Array.from(e.eventEfforts.values()).reduce((s, v) => s + v, 0)
                    : 0;
                  const cpueN = hasEsforco
                    ? (eTotal > 0 ? e.totalN / eTotal : 0)
                    : e.totalN / nEvents;
                  const cpueW = hasEsforco
                    ? (eTotal > 0 ? e.totalW / eTotal : 0)
                    : e.totalW / nEvents;
                  byMethod[met] = {
                    cpueN, cpueW,
                    N:       e.totalN + e.skippedN,
                    effort:  hasEsforco ? eTotal : nEvents,
                    nEvents,
                    skippedN: e.skippedN,
                  };
                }
                return { label: row.label, byMethod, totN: row.totN };
              }).filter(r => Object.values(r.byMethod).some(v => v.cpueN > 0 || v.N > 0));
              if (sortFn) rows.sort(sortFn);
              if (topN) rows.splice(topN);
              return rows;
            };

            const maxCpue = (r: MRowFinal) => Math.max(...Object.values(r.byMethod).map(v => v.cpueN));
            const matrixUA   = buildMatrix(r => r.unidadeAmostral || "", (a,b) => maxCpue(b) - maxCpue(a));
            const matrixCamp = buildMatrix(r => r.campanha || "",        (a,b) => natSort(a.label, b.label));
            const matrixSp   = buildMatrix(
              r => r.nomeCientifico?.trim() || r.nomeComum?.trim() || "",
              (a,b) => maxCpue(b) - maxCpue(a),
              15
            );

            // Registros sem esforço em modo CPUE (para aviso ao usuário)
            const nSkipped = hasEsforco ? cpueSource.filter(r => getE(r) === 0).length : 0;

            // ── Per-method totals for KPI cards ─────────────────────────────────
            // Usa o mesmo estimador de razão (ΣN/ΣE)×100 para consistência com a matriz.
            // IAR: ΣN / nº de campanhas distintas por método (mesmo denominador da matriz).
            const methodTotals = allMethods.map((met, i) => {
              const data = cpueSource.filter(r => (r.metodo?.trim() || "(sem método)") === met);
              const totN = data.reduce((s, r) => s + getN(r), 0);
              // CPUE: ratio of sums — only records with E > 0
              const withE  = hasEsforco ? data.filter(r => getE(r) > 0) : [];
              const sumN_e = withE.reduce((s, r) => s + getN(r), 0);
              const sumE   = withE.reduce((s, r) => s + getE(r), 0);
              const sumW_e = withE.reduce((s, r) => s + getW(r), 0);
              const nCamps = new Set(data.map(r => r.campanha || r.data || "s/d")).size || 1;
              const cpueTotal = hasEsforco
                ? (sumE > 0 ? (sumN_e / sumE) * 100 : 0)
                : totN / nCamps;
              const cpueW = hasEsforco && sumE > 0 ? (sumW_e / sumE) * 100 : 0;
              const totE  = hasEsforco ? sumE : nCamps;
              return { met, totN, totE, cpueTotal, cpueW, color: METHOD_PAL[i % METHOD_PAL.length] };
            });

            // ── SVG charts ───────────────────────────────────────────────────────
            const HBar = ({ data, color }: { data: { label: string; value: number }[]; color: string }) => {
              // Largura do rótulo proporcional ao maior nome (≈5.4 px por caractere a fontSize=10)
              const maxLabelLen = Math.max(...data.map(d => d.label.length), 8);
              const labelW = Math.min(320, Math.max(160, Math.round(maxLabelLen * 5.4) + 12));
              const valW = 55;
              const W = labelW + 330 + valW;
              const barH = 22, pad = 4, chartW = W - labelW - valW;
              const maxV = Math.max(...data.map(d => d.value), 0.001);
              const H = data.length * (barH + pad) + 16;
              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 400 }}>
                  {data.map((d,i) => {
                    const y=i*(barH+pad)+8, bw=(d.value/maxV)*chartW;
                    return (
                      <g key={i}>
                        <text x={labelW-5} y={y+barH/2+4} textAnchor="end" fontSize="10" fill="#374151" fontStyle="italic">{d.label}</text>
                        <rect x={labelW} y={y} width={Math.max(bw,2)} height={barH} fill={color} rx="3" opacity="0.82">
                          <title>{d.label}: {d.value.toFixed(3)}</title>
                        </rect>
                        <text x={labelW+bw+5} y={y+barH/2+4} textAnchor="start" fontSize="9" fill="#1e293b" fontFamily="monospace">{d.value.toFixed(3)}</text>
                      </g>
                    );
                  })}
                </svg>
              );
            };

            const VBar = ({ data, color }: { data: { label: string; cpueN: number }[]; color: string }) => {
              const W=500, H=200, PL=55, PR=20, PT=20, PB=50;
              const pw=W-PL-PR, ph=H-PT-PB;
              const maxV=Math.max(...data.map(d=>d.cpueN), 0.001);
              const bw=Math.max(10, Math.floor(pw/data.length)-6);
              const pts=data.map((d,i)=>({ x: PL+(i+0.5)*(pw/data.length), y: PT+ph-(d.cpueN/maxV)*ph }));
              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[200px]">
                  {[.25,.5,.75,1].map(t=><line key={t} x1={PL} x2={W-PR} y1={PT+ph*(1-t)} y2={PT+ph*(1-t)} stroke="#e5e7eb" strokeWidth=".7" strokeDasharray="3,3"/>)}
                  <line x1={PL} x2={W-PR} y1={H-PB} y2={H-PB} stroke="#9ca3af" strokeWidth="1"/>
                  <line x1={PL} x2={PL} y1={PT} y2={H-PB} stroke="#9ca3af" strokeWidth="1"/>
                  {data.map((d,i) => {
                    const cx=PL+(i+0.5)*(pw/data.length), bh=(d.cpueN/maxV)*ph, y=PT+ph-bh;
                    return (
                      <g key={i}>
                        <rect x={cx-bw/2} y={y} width={bw} height={bh} fill={color} rx="2" opacity="0.82">
                          <title>{d.label}: {d.cpueN.toFixed(3)}</title>
                        </rect>
                        <text x={cx} y={y-4} textAnchor="middle" fontSize="8" fill="#0f172a" fontFamily="monospace">{d.cpueN.toFixed(2)}</text>
                        <text x={cx} y={H-PB+14} textAnchor="middle" fontSize="8" fill="#6b7280">{d.label.length>10?d.label.slice(0,9)+"…":d.label}</text>
                      </g>
                    );
                  })}
                  {[0,.5,1].map(t=><text key={t} x={PL-4} y={PT+ph*(1-t)+3} textAnchor="end" fontSize="8" fill="#9ca3af">{(maxV*t).toFixed(2)}</text>)}
                  {data.length>=3 && <polyline points={pts.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4,3" opacity=".7"/>}
                </svg>
              );
            };

            // ── Cross-table: rows = primaryKey, columns = method ─────────────────
            const MatrixTable = ({ rows, rowLabel, italic }: { rows: MRowFinal[]; rowLabel: string; italic?: boolean }) => (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold sticky left-0 bg-slate-50">{rowLabel}</th>
                      {allMethods.map((met, i) => (
                        <th key={met} className="px-3 py-2 text-center font-semibold whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: METHOD_PAL[i%METHOD_PAL.length] }}/>
                            {met}
                          </span>
                        </th>
                      ))}
                      {hasWeightData && <th className="px-3 py-2 text-center font-semibold text-teal-700 whitespace-nowrap">Biomassa</th>}
                      <th className="px-3 py-2 text-center font-semibold text-muted-foreground">N total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.label} className={i%2===0?"bg-white":"bg-slate-50/50"}>
                        <td className={`px-3 py-1.5 font-medium sticky left-0 ${i%2===0?"bg-white":"bg-slate-50/50"} ${italic?"italic":""}`}>{r.label}</td>
                        {allMethods.map((met, j) => {
                          const v = r.byMethod[met];
                          return (
                            <td key={met} className="px-3 py-1.5 tabular-nums text-center">
                              {v && v.cpueN > 0
                                ? <span className="font-semibold" style={{ color: METHOD_PAL[j%METHOD_PAL.length] }}>{v.cpueN.toFixed(3)}</span>
                                : <span className="text-muted-foreground/30">—</span>}
                            </td>
                          );
                        })}
                        {hasWeightData && (
                          <td className="px-3 py-1.5 tabular-nums text-center text-teal-700">
                            {(() => { const w=Object.values(r.byMethod).reduce((s,v)=>s+v.cpueW,0); return w>0?w.toFixed(3):"—"; })()}
                          </td>
                        )}
                        <td className="px-3 py-1.5 tabular-nums text-center text-muted-foreground">{r.totN}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

            return (
              <div className="flex flex-col gap-4">
                {/* Alert IAR mode */}
                {!hasEsforco && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                    <span>
                      <strong>Modo IAR — Fórmula:</strong> IAR = ΣN ÷ nº de campanhas amostradas (por UA × método). Para CPUE real, inclua as colunas <strong>ESFORÇO AMOSTRAL</strong> (ex: 100) e <strong>UNIDADE DE ESFORÇO</strong> (ex: "rede-hora", "anzol-hora") na planilha.
                    </span>
                  </div>
                )}

                {/* Aviso de registros sem esforço excluídos */}
                {hasEsforco && nSkipped > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-xs text-orange-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-500" />
                    <span>
                      <strong>{nSkipped} registro(s)</strong> sem Esforço Amostral preenchido foram excluídos do cálculo da CPUE. Preencha o campo <strong>ESFORÇO AMOSTRAL</strong> nesses registros para incluí-los.
                    </span>
                  </div>
                )}

                {/* Fórmula + aviso metodológico */}
                <div className={`rounded-lg px-4 py-2 text-xs flex flex-wrap items-center gap-x-3 gap-y-1 ${hasEsforco ? "bg-cyan-50 border border-cyan-200 text-cyan-800" : "bg-slate-50 border border-slate-200 text-slate-700"}`}>
                  {hasEsforco
                    ? <><span className="font-semibold">Fórmula CPUE:</span><span className="font-mono">CPUEn = (ΣN / ΣE) × 100</span><span className="text-cyan-600">estimador de razão por método × célula</span></>
                    : <><span className="font-semibold">Fórmula IAR:</span><span className="font-mono">IAR = ΣN ÷ campanhas</span><span className="text-slate-500">(média de indivíduos por campanha amostrada)</span></>
                  }
                  <span className="font-semibold text-amber-700">⚠ Separada por método — métodos distintos não são somáveis.</span>
                </div>

                {/* KPI cards — one per method */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {methodTotals.map(({ met, totN, totE, cpueTotal, color }) => (
                    <div key={met} className="rounded-lg p-3 border" style={{ background: color+"12", borderColor: color+"50" }}>
                      <div className="text-lg font-bold tabular-nums truncate" style={{ color }}>{cpueTotal.toFixed(3)}</div>
                      <div className="text-[11px] font-semibold mt-0.5 truncate" style={{ color }} title={met}>{met}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {hasEsforco ? `CPUE · N=${totN} · E=${totE.toFixed(1)} ${effortUnit}` : `IAR · N=${totN} · ${totE} eventos`}
                      </div>
                    </div>
                  ))}
                  <div className="rounded-lg p-3 border bg-slate-50 border-slate-200">
                    <div className="text-lg font-bold tabular-nums text-slate-600">{cpueSource.reduce((s,r)=>s+getN(r),0)}</div>
                    <div className="text-[11px] font-semibold mt-0.5 text-slate-500">Total capturado (N)</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{matrixUA.length} UAs · {matrixCamp.length} campanhas</div>
                  </div>
                </div>

                {/* Chart 1 — CPUE por UA × Método */}
                {matrixUA.length > 0 && (
                  <Card className="border-cyan-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                        📍 {cpueLabel} por Unidade Amostral · por Método
                        <Badge variant="outline" className="text-xs">{matrixUA.length} UAs</Badge>
                        <AiAnalysisBtn tipo="CPUE por Unidade Amostral" contexto={`CPUE = N/f (${effortUnit}). Análise por UA × Método.\n` + matrixUA.slice(0,10).map(r => `${r.label}: ` + Object.entries(r.byMethod).map(([m,v]) => `${m} CPUEn=${v.cpueN.toFixed(3)} (N=${v.N}, esforço=${v.effort.toFixed(0)})`).join("; ")).join("\n")} />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {allMethods.map((met, i) => {
                        const bars = matrixUA
                          .filter(r => r.byMethod[met] && r.byMethod[met].cpueN > 0)
                          .map(r => ({ label: r.label, value: r.byMethod[met].cpueN }))
                          .sort((a,b) => b.value - a.value);
                        if (!bars.length) return null;
                        return (
                          <div key={met}>
                            <p className="text-xs font-semibold mb-1 flex items-center gap-1.5">
                              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: METHOD_PAL[i%METHOD_PAL.length] }}/>
                              {met}
                              <span className="text-muted-foreground font-normal">— {bars.length} UA(s)</span>
                            </p>
                            <div className="overflow-x-auto" data-chart-title={`CPUE por UA — ${met}`}>
                              <SvgFigure name={`cpue_ua_${met.toLowerCase().replace(/[^a-z0-9]+/g,"_")}`}>
                                <HBar data={bars} color={METHOD_PAL[i%METHOD_PAL.length]} />
                              </SvgFigure>
                            </div>
                          </div>
                        );
                      })}
                      <details open>
                        <summary className="text-xs font-semibold text-muted-foreground cursor-pointer select-none mb-2">Tabela cruzada UA × Método</summary>
                        <MatrixTable rows={matrixUA} rowLabel="Unidade Amostral" />
                      </details>
                    </CardContent>
                  </Card>
                )}

                {/* Contrastes estatísticos — GLM Poisson com offset log(esforço) */}
                {hasEsforco && matrixUA.length >= 2 && (
                  <Card className="border-cyan-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                        📐 Contrastes estatísticos — GLM Poisson (CPUE por UA)
                        <Badge variant="outline" className="text-xs">ref. = {matrixUA[0].label}</Badge>
                        <AiAnalysisBtn tipo="GLM Poisson CPUE" contexto={`Contrastes de razão de taxas (rate ratio) por método, GLM Poisson com offset log(esforço). Referência = ${matrixUA[0].label}. Métodos: ${allMethods.join(", ")}. ${matrixUA.length} UAs.`} />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Modelo: <span className="font-mono">log(N) = β₀ + βᵢ·UAᵢ + offset(log(esforço))</span>.
                        β em escala log; razão de taxas (RR) = e<sup>β</sup> &gt; 1 indica CPUE maior que a referência.
                        SE pelo método delta: <span className="font-mono">√(1/Nᵢ + 1/N_ref)</span>.
                      </p>
                      {allMethods.map((met, mi) => {
                        const rows = matrixUA
                          .map(r => ({ label: r.label, N: r.byMethod[met]?.N ?? 0, E: r.byMethod[met]?.effort ?? 0 }))
                          .filter(r => r.N > 0 && r.E > 0);
                        if (rows.length < 2) return null;
                        const ref = rows[0];
                        const rateRef = ref.N / ref.E;
                        return (
                          <div key={met}>
                            <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: METHOD_PAL[mi%METHOD_PAL.length] }}/>
                              {met}
                              <span className="text-muted-foreground font-normal">— {rows.length} UAs · ref. = {ref.label} (N={ref.N}, esforço={ref.E.toFixed(1)})</span>
                            </p>
                            <div className="overflow-x-auto rounded border border-cyan-100">
                              <table className="w-full text-[11px]">
                                <thead className="bg-cyan-50/60 text-cyan-900">
                                  <tr>
                                    <th className="px-2 py-1.5 text-left font-semibold">Contraste (ref. = {ref.label})</th>
                                    <th className="px-2 py-1.5 text-right font-semibold">β (log)</th>
                                    <th className="px-2 py-1.5 text-right font-semibold">Erro-padrão</th>
                                    <th className="px-2 py-1.5 text-right font-semibold">z-valor</th>
                                    <th className="px-2 py-1.5 text-right font-semibold">p-valor</th>
                                    <th className="px-2 py-1.5 text-right font-semibold">Razão de taxas (e<sup>β</sup>)</th>
                                    <th className="px-2 py-1.5 text-right font-semibold">IC 95 % da razão</th>
                                  </tr>
                                </thead>
                                <tbody className="font-mono">
                                  {rows.slice(1).map((row, ri) => {
                                    const rate = row.N / row.E;
                                    const beta = Math.log(rate / rateRef);
                                    const se   = Math.sqrt(1/row.N + 1/ref.N);
                                    const z    = beta / se;
                                    // Normal CDF via erf approximation (Abramowitz & Stegun 7.1.26)
                                    const erf = (x: number) => {
                                      const s = Math.sign(x); x = Math.abs(x);
                                      const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
                                      const t = 1/(1+p*x);
                                      const y = 1 - (((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
                                      return s*y;
                                    };
                                    const pval = 2 * (1 - 0.5*(1+erf(Math.abs(z)/Math.SQRT2)));
                                    const RR   = Math.exp(beta);
                                    const lo   = Math.exp(beta - 1.96*se);
                                    const hi   = Math.exp(beta + 1.96*se);
                                    const sig  = pval < 0.001 ? "***" : pval < 0.01 ? "**" : pval < 0.05 ? "*" : "";
                                    const sigClr = pval < 0.05 ? "text-rose-700 font-bold" : "text-slate-700";
                                    return (
                                      <tr key={ri} className={ri%2 ? "bg-white" : "bg-cyan-50/20"}>
                                        <td className="px-2 py-1 font-sans">{row.label} <span className="text-muted-foreground">vs {ref.label}</span></td>
                                        <td className="px-2 py-1 text-right">{beta.toFixed(3)}</td>
                                        <td className="px-2 py-1 text-right">{se.toFixed(3)}</td>
                                        <td className="px-2 py-1 text-right">{z.toFixed(2)}</td>
                                        <td className={`px-2 py-1 text-right ${sigClr}`}>{pval < 0.001 ? "<0.001" : pval.toFixed(3)} {sig}</td>
                                        <td className="px-2 py-1 text-right font-semibold">{RR.toFixed(3)}</td>
                                        <td className="px-2 py-1 text-right text-slate-600">[{lo.toFixed(3)}; {hi.toFixed(3)}]</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-[10px] text-muted-foreground italic">
                        Significância: * p&lt;0,05 · ** p&lt;0,01 · *** p&lt;0,001. Teste de Wald bilateral. Para sobre-dispersão (variância &gt; média), considere quasi-Poisson ou binomial negativa.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Chart 2 — CPUE por Campanha × Método */}
                {matrixCamp.length > 0 && (
                  <Card className="border-cyan-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                        📅 {cpueLabel} por Campanha · por Método
                        <Badge variant="outline" className="text-xs">{matrixCamp.length} campanhas</Badge>
                        <AiAnalysisBtn tipo="CPUE por Campanha" contexto={`CPUE = N/f (${effortUnit}). Tendência temporal por campanha × método.\n` + matrixCamp.slice(0,15).map(r => `${r.label}: ` + Object.entries(r.byMethod).map(([m,v]) => `${m} CPUEn=${v.cpueN.toFixed(3)} (N=${v.N})`).join("; ")).join("\n")} />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {allMethods.map((met, i) => {
                        const bars = matrixCamp
                          .map(r => ({ label: r.label, cpueN: r.byMethod[met]?.cpueN ?? 0 }))
                          .filter(d => d.cpueN > 0);
                        if (!bars.length) return null;
                        return (
                          <div key={met}>
                            <p className="text-xs font-semibold mb-1 flex items-center gap-1.5">
                              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: METHOD_PAL[i%METHOD_PAL.length] }}/>
                              {met}
                            </p>
                            <div className="overflow-x-auto" data-chart-title={`CPUE por Campanha — ${met}`}>
                              <SvgFigure name={`cpue_campanha_${met.toLowerCase().replace(/[^a-z0-9]+/g,"_")}`}>
                                <VBar data={bars} color={METHOD_PAL[i%METHOD_PAL.length]} />
                              </SvgFigure>
                            </div>
                          </div>
                        );
                      })}
                      {matrixCamp.length >= 3 && (
                        <p className="text-[10px] text-muted-foreground">Linha vermelha tracejada = tendência temporal da CPUE por método.</p>
                      )}
                      <details open>
                        <summary className="text-xs font-semibold text-muted-foreground cursor-pointer select-none mb-2">Tabela cruzada Campanha × Método</summary>
                        <MatrixTable rows={matrixCamp} rowLabel="Campanha" />
                      </details>
                    </CardContent>
                  </Card>
                )}

                {/* Chart 3 — CPUE por Espécie × Método */}
                {matrixSp.length > 0 && (
                  <Card className="border-cyan-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2 w-full">
                        🐟 {cpueLabel} por Espécie · por Método
                        <Badge variant="outline" className="text-xs">top {matrixSp.length}</Badge>
                        <AiAnalysisBtn tipo="CPUE por Espécie" contexto={`CPUE = N/f (${effortUnit}). Top ${matrixSp.length} espécies.\n` + matrixSp.slice(0,15).map(r => `${r.label}: ` + Object.entries(r.byMethod).map(([m,v]) => `${m} CPUEn=${v.cpueN.toFixed(3)} (N=${v.N})`).join("; ")).join("\n")} />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {allMethods.map((met, i) => {
                        const bars = matrixSp
                          .filter(r => r.byMethod[met] && r.byMethod[met].cpueN > 0)
                          .map(r => ({ label: r.label, value: r.byMethod[met].cpueN }))
                          .sort((a,b) => b.value - a.value);
                        if (!bars.length) return null;
                        return (
                          <div key={met}>
                            <p className="text-xs font-semibold italic mb-1 flex items-center gap-1.5">
                              <span className="inline-block w-2.5 h-2.5 rounded-full not-italic" style={{ background: METHOD_PAL[i%METHOD_PAL.length] }}/>
                              {met}
                            </p>
                            <div className="overflow-x-auto" data-chart-title={`CPUE por Espécie — ${met}`}>
                              <SvgFigure name={`cpue_especie_${met.toLowerCase().replace(/[^a-z0-9]+/g,"_")}`}>
                                <HBar data={bars} color={METHOD_PAL[i%METHOD_PAL.length]} />
                              </SvgFigure>
                            </div>
                          </div>
                        );
                      })}
                      <details open>
                        <summary className="text-xs font-semibold text-muted-foreground cursor-pointer select-none mb-2">Tabela cruzada Espécie × Método</summary>
                        <MatrixTable rows={matrixSp} rowLabel="Espécie" italic />
                      </details>
                    </CardContent>
                  </Card>
                )}

                <p className="text-[10px] text-muted-foreground pb-2">
                  {hasEsforco
                    ? `CPUE (Captura Por Unidade de Esforço) = Σ(N/E)×100, calculada independentemente para cada método. CPUEs de métodos diferentes não devem ser comparadas diretamente pois têm unidades de esforço distintas.`
                    : 'IAR (Índice de Abundância Relativa) = ΣN por evento de amostragem, separado por método. Para CPUE real inclua ESFORÇO AMOSTRAL e UNIDADE DE ESFORÇO (ex: "rede-hora", "anzol-hora", "km").'}
                </p>
              </div>
            );
          })()}

          </div>) : (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3 border-2 border-dashed border-muted rounded-xl">
              <Leaf className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum registro de campo recebido ainda</p>
              <p className="text-xs text-muted-foreground/60 max-w-sm">Os gráficos e índices de biodiversidade aparecerão aqui assim que o aplicativo de campo enviar dados via API.</p>
            </div>
          )}
        </>}

      {/* ── Filtros da tabela de registros ── */}
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input ref={searchRef} placeholder="Buscar por espécie, campanha, unidade amostral…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {/* Date range filters */}
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Input type="date" className="h-9 w-36 text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Data inicial" />
            <span className="text-muted-foreground text-xs">–</span>
            <Input type="date" className="h-9 w-36 text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} title="Data final" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-muted-foreground hover:text-foreground text-xs px-1.5 py-0.5 rounded border hover:border-foreground/30 transition-colors">✕</button>
            )}
          </div>
        </div>
        {/* Group filter chip */}
        {filterGrupo !== "todos" && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 text-xs font-semibold w-fit"
            style={{ borderColor: getGrupoColor(filterGrupo, unknownGroups), color: getGrupoColor(filterGrupo, unknownGroups), backgroundColor: getGrupoColor(filterGrupo, unknownGroups) + "15" }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: getGrupoColor(filterGrupo, unknownGroups) }} />
            {GRUPO_CONFIG[filterGrupo]?.label || filterGrupo}
            <button onClick={() => setFilterGrupo("todos")} className="ml-1 opacity-60 hover:opacity-100">✕</button>
          </div>
        )}
      </div>

      {/* ── Tabela de registros ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold">
              Registros ({pagedData.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, tableData.length)} de ` : ""}{tableData.length}{tableData.length !== registros.length ? ` de ${registros.length} total` : ""})
              {selectedEmp && <span className="text-muted-foreground font-normal ml-2">— {selectedEmp.nome}</span>}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs gap-1 border-blue-400 text-blue-700 hover:bg-blue-50"
                disabled={backfillMutation.isPending}
                onClick={() => {
                  if (confirm("Preencher automaticamente IUCN, MMA, CITES e PAN para todos os registros com nome científico?\n\nIsso não sobrescreve valores já preenchidos.")) {
                    backfillMutation.mutate();
                  }
                }}>
                {backfillMutation.isPending
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Preenchendo...</>
                  : <><ShieldAlert className="w-3.5 h-3.5" /> Completar automaticamente</>}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-emerald-400 text-emerald-700 hover:bg-emerald-50" onClick={() => setIsNewRecordOpen(true)}>
                <PlusCircle className="w-3.5 h-3.5" /> Novo Registro
              </Button>
              {selectedIds.size > 0 && (
                <>
                  <span className="text-xs text-muted-foreground">{selectedIds.size} selecionado(s)</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs gap-1"
                    disabled={bulkDeleteMutation.isPending}
                    onClick={() => {
                      if (confirm(`Excluir ${selectedIds.size} registro(s) selecionado(s)?`)) {
                        bulkDeleteMutation.mutate([...selectedIds]);
                      }
                    }}>
                    {bulkDeleteMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Excluir selecionados
                  </Button>
                </>
              )}
              {isLoading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2 px-2 pb-1">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-20 ml-auto" />
              </div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-1.5 border-b border-slate-100">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16 ml-auto" />
                </div>
              ))}
            </div>
          ) : tableData.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground space-y-2">
              <Database className="w-12 h-12 mx-auto opacity-20" />
              <p className="font-medium">{selectedEmp ? `Nenhum registro para "${selectedEmp.nome}"` : "Aguardando dados do campo"}</p>
              <p className="text-xs">Os registros aparecerão aqui automaticamente conforme o app de campo sincronizar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2.5 w-8">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 cursor-pointer"
                        checked={tableData.length > 0 && selectedIds.size === tableData.length}
                        onChange={toggleSelectAll}
                        title="Selecionar todos"
                      />
                    </th>
                    {([
                      { label: "ID", col: "id" },
                      { label: "Empreendimento", col: "empreendimentoId" },
                      { label: "Grupo", col: "grupoTaxonomico" },
                      { label: "Nome Científico", col: "nomeCientifico" },
                      { label: "Nome Comum", col: "nomeComum" },
                      { label: "Campanha", col: "campanha" },
                      { label: "Data", col: "data" },
                      { label: "UA", col: "unidadeAmostral" },
                      { label: "GPS", col: null },
                      { label: "IUCN", col: "iucn" },
                      { label: "MMA", col: "ibamaMma" },
                      { label: "CITES", col: "cites" },
                      { label: "PAN", col: "pan" },
                      { label: "", col: null },
                    ] as { label: string; col: string | null }[]).map(({ label, col }) => (
                      <th
                        key={label || "actions"}
                        className={`px-3 py-2.5 text-left font-medium text-xs text-muted-foreground whitespace-nowrap select-none ${col ? "cursor-pointer hover:text-foreground hover:bg-muted/30 transition-colors" : ""}`}
                        onClick={col ? () => { if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("asc"); } } : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {col && sortCol === col && (
                            <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                          )}
                          {col && sortCol !== col && label && (
                            <span className="text-[10px] opacity-20">⇅</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedData.map(r => {
                    const cfg = GRUPO_CONFIG[r.grupoTaxonomico];
                    const isSelected = selectedIds.has(r.id);
                    return (
                      <tr key={r.id} className={`border-t transition-colors ${isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-muted/20"}`}>
                        <td className="px-3 py-2.5 w-8">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 cursor-pointer"
                            checked={isSelected}
                            onChange={() => toggleSelect(r.id)}
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">#{r.id}</td>
                        <td className="px-3 py-2.5">
                          {getEmpNome(r.empreendimentoId)
                            ? <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium"><Building2 className="w-3 h-3" /><span className="truncate max-w-[110px]">{getEmpNome(r.empreendimentoId)}</span></span>
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5"><Badge className={`text-xs ${cfg?.bg || "bg-gray-100 text-gray-700"}`}>{cfg?.label || r.grupoTaxonomico}</Badge></td>
                        <td className="px-3 py-2.5 italic text-xs">{r.nomeCientifico ? formatSpeciesName(r.nomeCientifico) : "—"}</td>
                        <td className="px-3 py-2.5 text-xs">{r.nomeComum || "—"}</td>
                        <td className="px-3 py-2.5 text-xs">{r.campanha || "—"}</td>
                        <td className="px-3 py-2.5 text-xs">{r.data}</td>
                        <td className="px-3 py-2.5 text-xs">{r.unidadeAmostral || "—"}</td>
                        <td className="px-3 py-2.5">
                          {r.latitude && r.longitude
                            ? (() => {
                                const a = parseFloat(String(r.latitude).replace(",","."));
                                const b = parseFloat(String(r.longitude).replace(",","."));
                                const isUtmCoord = Math.abs(a) > 180 || Math.abs(b) > 180;
                                if (isUtmCoord) {
                                  return <span className="flex items-center gap-1 text-amber-600 text-xs" title={`UTM: E${r.latitude} N${r.longitude}`}>
                                    <MapPin className="w-3 h-3" />UTM
                                  </span>;
                                }
                                return <span className="flex items-center gap-1 text-emerald-600 text-xs">
                                  <MapPin className="w-3 h-3" />{a.toFixed(4)}, {b.toFixed(4)}
                                </span>;
                              })()
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {(() => { const s = toIucnSigla(r.iucn); return s ? <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: IUCN_COLORS[s] || "#94a3b8" }}>{s}</span> : <span className="text-xs text-muted-foreground">—</span>; })()}
                        </td>
                        <td className="px-3 py-2.5">
                          {(() => { const s = toMmaSigla(r.ibamaMma); return s ? <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold bg-orange-600">{s}</span> : <span className="text-xs text-muted-foreground">—</span>; })()}
                        </td>
                        <td className="px-3 py-2.5">
                          {(() => { const s = toCitesSigla(r.cites); return s ? <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold bg-violet-600">Ap.{s}</span> : <span className="text-xs text-muted-foreground">—</span>; })()}
                        </td>
                        <td className="px-3 py-2.5">
                          {(() => { const p = getPanName(r.pan); return p ? <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200 truncate max-w-[90px] block" title={p}>{p.length > 12 ? p.slice(0, 11) + "…" : p}</span> : <span className="text-xs text-muted-foreground">—</span>; })()}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6" title="Visualizar" onClick={() => setViewingRecord(r)}><Eye className="w-3 h-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-500 hover:text-blue-700" title="Editar" onClick={() => openEdit(r)}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-600" title="Excluir" onClick={() => { if (confirm(`Excluir #${r.id}?`)) deleteMutation.mutate(r.id); }}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
            <span>Página {page + 1} de {totalPages} · {tableData.length} registros</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(0)} disabled={page === 0} className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-muted transition-colors">«</button>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-muted transition-colors">‹</button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const mid = Math.min(Math.max(page, 3), totalPages - 4);
                const p = totalPages <= 7 ? i : i + Math.max(0, mid - 3);
                if (p >= totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-2 py-1 rounded border transition-colors ${p === page ? "font-bold text-foreground bg-background" : "hover:bg-muted"}`}>
                    {p + 1}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-muted transition-colors">›</button>
              <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-muted transition-colors">»</button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Índice de Biodiversidade — Modal Informativo ── */}
      {activeIndexInfo && INDEX_INFO[activeIndexInfo] && (() => {
        const info = INDEX_INFO[activeIndexInfo];
        return (
          <Dialog open onOpenChange={() => setActiveIndexInfo(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <span className="text-2xl">{info.emoji}</span>
                  <span>{info.label}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-1">
                {/* Grupo */}
                <div>
                  <Badge variant="outline" className="text-xs" style={{ borderColor: BRAND.blue2 + "60", color: BRAND.blue1 }}>
                    {info.grupo}
                  </Badge>
                </div>

                {/* Descrição */}
                <div className="rounded-lg p-3" style={{ backgroundColor: BRAND.blue2 + "08", borderLeft: `3px solid ${BRAND.blue2}` }}>
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">O que é</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{info.descricao}</p>
                </div>

                {/* Fórmula */}
                <div className="rounded-lg p-3 bg-slate-50 border border-slate-200">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">Fórmula</p>
                  <p className="font-mono text-sm font-semibold" style={{ color: BRAND.blue1 }}>{info.formula}</p>
                </div>

                {/* Interpretação */}
                <div className="rounded-lg p-3" style={{ backgroundColor: BRAND.orange1 + "0d", borderLeft: `3px solid ${BRAND.orange1}` }}>
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">Como interpretar</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{info.interpretacao}</p>
                </div>

                {/* Citação */}
                <div className="rounded-lg p-3 bg-muted/40 border border-muted">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                    <span>📚</span> Referência
                  </p>
                  <p className="text-xs text-slate-600 italic leading-relaxed">{info.citacao}</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Record Detail Dialog ── */}
      {viewingRecord && (
        <Dialog open={!!viewingRecord} onOpenChange={() => setViewingRecord(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 flex-wrap">
                <Badge className={GRUPO_CONFIG[viewingRecord.grupoTaxonomico]?.bg || ""}>{GRUPO_CONFIG[viewingRecord.grupoTaxonomico]?.label}</Badge>
                <span className="italic">{viewingRecord.nomeCientifico ? formatSpeciesName(viewingRecord.nomeCientifico) : `Registro #${viewingRecord.id}`}</span>
                {(() => { const s = toIucnSigla(viewingRecord.iucn); return s ? <span className="px-2 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: IUCN_COLORS[s] || "#94a3b8" }}>IUCN: {s}</span> : null; })()}
              </DialogTitle>
            </DialogHeader>
            {viewingRecord.empreendimentoId && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <Building2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Empreendimento</p>
                  <p className="text-sm font-semibold text-emerald-800">{getEmpNome(viewingRecord.empreendimentoId)}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {([
                ["Nome Comum", viewingRecord.nomeComum], ["Campanha", viewingRecord.campanha],
                ["Data", viewingRecord.data], ["Horário", viewingRecord.horario],
                ["Período", viewingRecord.periodo], ["UA", viewingRecord.unidadeAmostral],
                ["Filo", viewingRecord.filo], ["Classe", viewingRecord.classe],
                ["Ordem", viewingRecord.ordem], ["Família", viewingRecord.familia],
                ["Sexo", viewingRecord.sexo], ["Idade", viewingRecord.idade],
                ["Método", viewingRecord.metodo], ["Status", viewingRecord.statusRegistro],
                ["IBAMA/MMA", toMmaSigla(viewingRecord.ibamaMma) || undefined], ["CITES", toCitesSigla(viewingRecord.cites) ? `Apêndice ${toCitesSigla(viewingRecord.cites)}` : undefined],
                ["PAN", getPanName(viewingRecord.pan) || undefined],
                ["Endemismo", viewingRecord.endemismo], ["Dieta", viewingRecord.dieta],
                ["Coletor", viewingRecord.nomeColetor],
              ] as [string, string | undefined][]).filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="bg-muted/40 rounded p-2">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium mt-0.5 text-sm">{value}</p>
                </div>
              ))}
            </div>
            {viewingRecord.observacoes && (
              <div className="bg-muted/40 rounded p-2">
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="mt-0.5 text-sm">{viewingRecord.observacoes}</p>
              </div>
            )}
            {/* ── Galeria de Fotos ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fotos ({viewingRecord.fotos?.length || 0})</p>
                <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" disabled={uploadingFoto}
                  onClick={() => fotoFileRef.current?.click()}>
                  {uploadingFoto ? <><Loader2 className="w-3 h-3 animate-spin" /> Enviando...</> : <><PlusCircle className="w-3 h-3" /> Adicionar Fotos</>}
                </Button>
                <input ref={fotoFileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => handleFotoUpload(viewingRecord.id, e.target.files)} />
              </div>
              {viewingRecord.fotos?.length ? (
                <div className="grid grid-cols-3 gap-2">
                  {viewingRecord.fotos.map(f => {
                    const viewUrl = `/api/campo/fotos/${f.id}/view`;
                    return (
                      <div key={f.id} className="relative group rounded-lg overflow-hidden border border-muted">
                        <img src={viewUrl} alt="foto" className="object-cover w-full h-28 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setLightboxUrl(viewUrl)}
                          onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='1.5'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5L5 21'/%3E%3C/svg%3E"; }} />
                        <button
                          className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleFotoDelete(f.id, viewingRecord.id)} title="Remover foto">
                          <X className="w-3 h-3" />
                        </button>
                        <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] px-1 py-0.5 truncate">
                          {f.nomeArquivo} {f.tamanho ? `(${(f.tamanho / 1024).toFixed(0)}KB)` : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                  Nenhuma foto vinculada. Clique em "Adicionar Fotos" para enviar.
                </p>
              )}
            </div>
            {viewingRecord.latitude && viewingRecord.longitude && (
              <div className="bg-emerald-50 rounded-lg p-3 flex items-center gap-3">
                <MapPin className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-emerald-700 font-medium">Coordenadas GPS</p>
                  <p className="font-mono text-sm">{viewingRecord.latitude}, {viewingRecord.longitude}</p>
                  <a href={`https://www.google.com/maps?q=${viewingRecord.latitude},${viewingRecord.longitude}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 underline">Abrir no Google Maps</a>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
          <DialogContent className="max-w-4xl p-2 bg-black/95">
            <img src={lightboxUrl} alt="foto ampliada" className="w-full max-h-[85vh] object-contain rounded" />
            <div className="flex justify-between items-center mt-1 px-1">
              <a href={lightboxUrl} download target="_blank" rel="noreferrer"
                className="text-xs text-white/70 hover:text-white underline flex items-center gap-1">
                <Download className="w-3 h-3" /> Baixar original
              </a>
              <Button size="sm" variant="ghost" className="text-white/60 hover:text-white h-7"
                onClick={() => setLightboxUrl(null)}>
                <X className="w-4 h-4" /> Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Edit Dialog ── */}
      {editingRecord && (
        <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar Registro #{editingRecord.id}
              </DialogTitle>
            </DialogHeader>

            <CampoAuditLogPanel registroId={editingRecord.id} />

            <div className="grid grid-cols-2 gap-3 text-sm">
              {/* Grupo taxonômico */}
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground font-medium block mb-1">Grupo Taxonômico</label>
                <Select
                  value={GRUPO_CONFIG[editForm.grupoTaxonomico || ""] ? (editForm.grupoTaxonomico || "") : "outro"}
                  onValueChange={v => {
                    if (v === "outro") {
                      setEditForm(f => ({ ...f, grupoTaxonomico: "" }));
                    } else {
                      setEditForm(f => ({ ...f, grupoTaxonomico: v }));
                    }
                  }}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GRUPO_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                    <SelectItem value="outro">Outro (personalizado)</SelectItem>
                  </SelectContent>
                </Select>
                {/* Show text input when group is custom/unknown */}
                {(!GRUPO_CONFIG[editForm.grupoTaxonomico || ""] || editForm.grupoTaxonomico === "") && (
                  <Input
                    className="h-8 text-sm mt-1.5"
                    placeholder="Ex: mastofauna, herpetologia, fitossociologia..."
                    value={GRUPO_CONFIG[editForm.grupoTaxonomico || ""] ? "" : (editForm.grupoTaxonomico || "")}
                    onChange={e => setEditForm(f => ({ ...f, grupoTaxonomico: e.target.value }))}
                  />
                )}
              </div>

              {/* Nome Científico */}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Nome Científico</label>
                <Input className="h-8 text-sm italic" value={editForm.nomeCientifico || ""} onChange={e => setEditForm(f => ({ ...f, nomeCientifico: e.target.value }))} />
              </div>

              {/* Nome Comum */}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Nome Comum</label>
                <Input className="h-8 text-sm" value={editForm.nomeComum || ""} onChange={e => setEditForm(f => ({ ...f, nomeComum: e.target.value }))} />
              </div>

              {/* Campanha */}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Campanha</label>
                <Input className="h-8 text-sm" value={editForm.campanha || ""} onChange={e => setEditForm(f => ({ ...f, campanha: e.target.value }))} />
              </div>

              {/* Data */}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Data</label>
                <Input className="h-8 text-sm" type="date" value={editForm.data || ""} onChange={e => setEditForm(f => ({ ...f, data: e.target.value }))} />
              </div>

              {/* Unidade Amostral */}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Unidade Amostral</label>
                <Input className="h-8 text-sm" value={editForm.unidadeAmostral || ""} onChange={e => setEditForm(f => ({ ...f, unidadeAmostral: e.target.value }))} />
              </div>

              {/* Método */}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Método</label>
                <Input className="h-8 text-sm" value={editForm.metodo || ""} onChange={e => setEditForm(f => ({ ...f, metodo: e.target.value }))} />
              </div>

              {/* Latitude */}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Latitude</label>
                <Input className="h-8 text-sm font-mono" value={editForm.latitude || ""} onChange={e => setEditForm(f => ({ ...f, latitude: e.target.value }))} placeholder="-00.000000" />
              </div>

              {/* Longitude */}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Longitude</label>
                <Input className="h-8 text-sm font-mono" value={editForm.longitude || ""} onChange={e => setEditForm(f => ({ ...f, longitude: e.target.value }))} placeholder="-00.000000" />
              </div>

              {/* Coletor */}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Coletor</label>
                <Input className="h-8 text-sm" value={editForm.nomeColetor || ""} onChange={e => setEditForm(f => ({ ...f, nomeColetor: e.target.value }))} />
              </div>

              {/* Status */}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Status do Registro</label>
                <Select
                  value={editForm.statusRegistro || ""}
                  onValueChange={v => setEditForm(f => ({ ...f, statusRegistro: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="provavel">Provável</SelectItem>
                    <SelectItem value="possivel">Possível</SelectItem>
                    <SelectItem value="duvidoso">Duvidoso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Separador conservação */}
              <div className="col-span-2 border-t pt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status de Conservação</p>
              </div>

              {/* IUCN */}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">IUCN Global</label>
                <Select
                  value={editForm.iucn || "__none__"}
                  onValueChange={v => setEditForm(f => ({ ...f, iucn: v === "__none__" ? undefined : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {["EX","EW","CR","EN","VU","NT","LC","DD"].map(c => (
                      <SelectItem key={c} value={c}><span style={{ color: IUCN_COLORS[c] }} className="font-bold">{c}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* MMA/IBAMA */}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">MMA/IBAMA</label>
                <Select
                  value={editForm.ibamaMma || "__none__"}
                  onValueChange={v => setEditForm(f => ({ ...f, ibamaMma: v === "__none__" ? undefined : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {["CR","EN","VU","NT","LC","DD"].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* CITES */}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">CITES</label>
                <Select
                  value={editForm.cites || "__none__"}
                  onValueChange={v => setEditForm(f => ({ ...f, cites: v === "__none__" ? undefined : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="I">Apêndice I</SelectItem>
                    <SelectItem value="II">Apêndice II</SelectItem>
                    <SelectItem value="III">Apêndice III</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* PAN */}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">PAN</label>
                <Input className="h-8 text-sm" value={editForm.pan || ""} onChange={e => setEditForm(f => ({ ...f, pan: e.target.value }))} placeholder="Nome do PAN..." />
              </div>

              {/* Observações */}
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground font-medium block mb-1">Observações</label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={3}
                  value={editForm.observacoes || ""}
                  onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))}
                />
              </div>

              {/* Galeria de Fotos */}
              <div className="col-span-2 border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Fotos ({editFotos.length})
                  </p>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-7 text-xs border-violet-300 text-violet-700 hover:bg-violet-50"
                      disabled={iaLoading}
                      onClick={() => iaFotoRef.current?.click()}
                      title="Tirar uma foto e deixar a IA sugerir a espécie"
                    >
                      {iaLoading
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Identificando...</>
                        : <><Sparkles className="w-3 h-3" /> Identificar com IA</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-7 text-xs"
                      disabled={uploadingFoto}
                      onClick={() => editFotoFileRef.current?.click()}
                    >
                      {uploadingFoto
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Enviando...</>
                        : <><PlusCircle className="w-3 h-3" /> Adicionar Fotos</>}
                    </Button>
                  </div>
                  <input
                    ref={editFotoFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => handleEditFotoUpload(e.target.files)}
                  />
                  <input
                    ref={iaFotoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleIdentifyPhoto(f); if (iaFotoRef.current) iaFotoRef.current.value = ""; }}
                  />
                </div>

                {editFotos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {editFotos.map((f: any) => {
                      const viewUrl = `/api/campo/fotos/${f.id}/view`;
                      return (
                        <div key={f.id} className="relative group rounded-lg overflow-hidden border border-muted">
                          <img
                            src={viewUrl}
                            alt="foto"
                            className="object-cover w-full h-24 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setLightboxUrl(viewUrl)}
                            onError={e => {
                              (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='1.5'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5L5 21'/%3E%3C/svg%3E";
                            }}
                          />
                          <button
                            className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleEditFotoDelete(f.id)}
                            title="Remover foto"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] px-1 py-0.5 truncate">
                            {f.nomeArquivo} {f.tamanho ? `(${(f.tamanho / 1024).toFixed(0)}KB)` : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 text-center cursor-pointer hover:border-[#1E6146]/40 hover:bg-green-50/30 transition-colors"
                    onClick={() => editFotoFileRef.current?.click()}
                  >
                    <PlusCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">Clique para adicionar fotos</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">JPG, PNG, HEIC • Múltiplas fotos suportadas</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => { setEditingRecord(null); setEditFotos([]); }}>Cancelar</Button>
              <Button
                size="sm"
                className="bg-[#1E6146] hover:bg-[#174f38] text-white"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ id: editingRecord.id, data: editForm })}>
                {updateMutation.isPending ? <><RefreshCw className="w-3 h-3 animate-spin mr-1" /> Salvando...</> : "Salvar alterações"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── F7: Dialog de sugestões IA ── */}
      {iaOpen && (
        <Dialog open onOpenChange={setIaOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600" />
                Identificação por IA
              </DialogTitle>
            </DialogHeader>
            {iaLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                <p className="text-sm text-muted-foreground">Analisando foto e consultando base taxonômica…</p>
              </div>
            ) : iaSuggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhuma sugestão retornada.</p>
            ) : (
              <div className="space-y-2 py-2">
                <p className="text-xs text-muted-foreground">Top {iaSuggestions.length} espécies prováveis. Selecione para preencher o registro:</p>
                {iaSuggestions.map((s, i) => (
                  <div key={i} className="rounded-md border border-muted bg-muted/20 p-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm italic font-semibold">{s.nomeCientifico || "—"}</p>
                        {s.nomeComum && <p className="text-xs text-muted-foreground">{s.nomeComum}</p>}
                        {s.justificativa && <p className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-2">{s.justificativa}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        {typeof s.confianca === "number" && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            s.confianca >= 70 ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                            s.confianca >= 40 ? "bg-amber-100 text-amber-800 border-amber-300" :
                                                "bg-muted text-muted-foreground border-border"
                          }`}>{s.confianca}%</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="mt-2 h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white w-full"
                      onClick={() => {
                        setEditForm(f => ({ ...f, nomeCientifico: s.nomeCientifico, nomeComum: s.nomeComum || f.nomeComum }));
                        setIaOpen(false);
                        toast({ title: "Espécie preenchida", description: s.nomeCientifico });
                      }}
                    >
                      Usar esta espécie
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* ── F9: Dialog de Outliers Ecológicos ── */}
      {outliersOpen && (
        <Dialog open onOpenChange={setOutliersOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" aria-describedby="outliers-desc">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Outliers ecológicos — alerta de identificação suspeita
              </DialogTitle>
              <p id="outliers-desc" className="text-xs text-muted-foreground mt-1">
                Registros geograficamente fora do range esperado da espécie (≥ 5 ocorrências, distância &gt; 3σ ou &gt; 300km do centróide).
                Pode indicar identificação equivocada, erro de coordenada ou registro de fato excepcional — vale revisar.
              </p>
            </DialogHeader>
            {outliersLoading && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" /> Analisando ocorrências…
              </div>
            )}
            {!outliersLoading && outliersError && (
              <div className="border border-red-300 bg-red-50 rounded-lg p-4 text-sm text-red-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">Não foi possível carregar os outliers</div>
                  <div className="text-xs mt-1">{outliersError}</div>
                  <button onClick={fetchOutliers} className="mt-2 text-xs px-2 py-1 rounded border border-red-400 text-red-700 hover:bg-red-100">Tentar novamente</button>
                </div>
              </div>
            )}
            {!outliersLoading && !outliersError && outliersData && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap text-xs">
                  <Badge variant="outline" className="text-amber-700 border-amber-300">{outliersData.total} outliers detectados</Badge>
                  <Badge variant="outline">{outliersData.speciesAnalisadas} espécies analisadas (≥ {outliersData.params.minOcorrencias} ocorrências)</Badge>
                  <span className="text-muted-foreground">Threshold: {outliersData.params.sigma}σ ou {outliersData.params.distanciaMinimaKm}km (o que for maior)</span>
                </div>
                {outliersData.total === 0 ? (
                  <div className="border-2 border-dashed border-emerald-200 bg-emerald-50 rounded-lg p-6 text-center text-sm text-emerald-700">
                    <Sigma className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                    Nenhum outlier detectado — todos os registros estão dentro do range geográfico esperado de cada espécie.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mb-2">
                      <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
                        <input
                          type="checkbox"
                          checked={showOutliersOnMap}
                          onChange={(e) => setShowOutliersOnMap(e.target.checked)}
                          className="w-3.5 h-3.5 accent-amber-600"
                        />
                        <span>Destacar outliers no mapa de ocorrências (anel pulsante laranja com <b>!</b>)</span>
                      </div>
                      <span className="text-[10px] text-amber-700 dark:text-amber-300">{outliersData.outliers.length} pontos</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[55vh] overflow-y-auto pr-1">
                      {outliersData.outliers.map((o: any) => {
                        const grupo = GRUPO_CONFIG[o.grupoTaxonomico];
                        const groupColor = grupo?.color || "#6b7280";
                        const severityRatio = o.thresholdKm > 0 ? (o.distanciaKm / o.thresholdKm) : 1;
                        const severityClass = severityRatio >= 3
                          ? "from-red-500 to-rose-600 text-white"
                          : severityRatio >= 2
                          ? "from-orange-500 to-amber-600 text-white"
                          : "from-amber-400 to-yellow-500 text-amber-950";
                        return (
                          <div
                            key={o.registroId}
                            className="relative border border-amber-200 dark:border-amber-800 rounded-xl bg-gradient-to-br from-white to-amber-50/40 dark:from-zinc-900 dark:to-amber-950/20 p-3 hover:shadow-md hover:border-amber-400 transition-all"
                          >
                            <div className="flex items-start gap-2.5">
                              <div
                                className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-white text-lg shadow-sm"
                                style={{ background: `linear-gradient(135deg, ${groupColor}, ${groupColor}cc)` }}
                                title={grupo?.label || o.grupoTaxonomico}
                              >
                                {grupo?.icon || "•"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="italic text-sm font-medium truncate">{o.nomeCientifico}</div>
                                    {o.nomeComum && <div className="text-[11px] text-muted-foreground truncate">{o.nomeComum}</div>}
                                  </div>
                                  <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">#{o.registroId}</span>
                                </div>
                                <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gradient-to-r ${severityClass}`}>
                                  <AlertTriangle className="w-3 h-3" />
                                  {o.distanciaKm} km do centróide
                                  <span className="opacity-80 font-normal">({severityRatio.toFixed(1)}× threshold)</span>
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                  <span>UA: <b className="text-foreground">{o.unidadeAmostral || "—"}</b></span>
                                  <span>Threshold: <b className="text-foreground">{o.thresholdKm} km</b></span>
                                  <span>n = <b className="text-foreground">{o.ocorrenciasDaEspecie}</b></span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <button
                                    onClick={() => {
                                      setShowOutliersOnMap(true);
                                      setMapFocus({ id: o.registroId, nonce: Date.now() });
                                      setOutliersOpen(false);
                                      setTimeout(() => {
                                        document.querySelector('[data-campo-map]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      }, 50);
                                    }}
                                    className="text-[11px] px-2 py-1 rounded border border-amber-400 bg-white dark:bg-zinc-900 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/40 inline-flex items-center gap-1 font-medium"
                                    title="Centralizar o mapa neste ponto"
                                  >
                                    <Crosshair className="w-3 h-3" /> Ver no mapa
                                  </button>
                                  <button
                                    onClick={() => {
                                      const r = registros.find((x: any) => x.id === o.registroId);
                                      if (r) { setOutliersOpen(false); openEdit(r); }
                                    }}
                                    className="text-[11px] px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-1"
                                  >
                                    Revisar registro
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setOutliersOpen(false)}>Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── F10: Dialog de Alertas Inteligentes ── */}
      {alertasOpen && (
        <Dialog open onOpenChange={setAlertasOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" aria-describedby="alertas-desc">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-rose-600" />
                Alertas inteligentes
              </DialogTitle>
              <p id="alertas-desc" className="text-xs text-muted-foreground mt-1">
                8 tipos de alerta ecológico: espécie ausente, queda de riqueza, espécie nova, dominância excessiva, UA ausente, lacuna temporal, abundância anômala e ameaçada em declínio.
              </p>
            </DialogHeader>
            {alertasLoading && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" /> Analisando histórico de campanhas…
              </div>
            )}
            {!alertasLoading && alertasError && (
              <div className="border border-red-300 bg-red-50 rounded-lg p-4 text-sm text-red-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">Não foi possível carregar os alertas</div>
                  <div className="text-xs mt-1">{alertasError}</div>
                  <button onClick={fetchAlertas} className="mt-2 text-xs px-2 py-1 rounded border border-red-400 text-red-700 hover:bg-red-100">Tentar novamente</button>
                </div>
              </div>
            )}
            {!alertasLoading && !alertasError && alertasData && (
              <div className="space-y-3">
                {/* Summary badges */}
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <Badge variant="outline" className="text-rose-700 border-rose-300 font-semibold">{alertasData.total} alertas</Badge>
                  {alertasData.contagens.alta > 0 && <Badge variant="outline" className="text-red-700 border-red-300">{alertasData.contagens.alta} alta</Badge>}
                  {alertasData.contagens.media > 0 && <Badge variant="outline" className="text-amber-700 border-amber-300">{alertasData.contagens.media} média</Badge>}
                  {alertasData.contagens.info > 0 && <Badge variant="outline" className="text-emerald-700 border-emerald-300">{alertasData.contagens.info} info</Badge>}
                </div>
                {/* Type breakdown */}
                {alertasData.total > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground">
                    {alertasData.contagens.ameacadaDeclinio > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">⬇ {alertasData.contagens.ameacadaDeclinio} ameaçada declínio</span>}
                    {alertasData.contagens.especieAusente > 0 && <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">∑ {alertasData.contagens.especieAusente} ausente</span>}
                    {alertasData.contagens.quedaRiqueza > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">↘ {alertasData.contagens.quedaRiqueza} queda riqueza</span>}
                    {alertasData.contagens.dominanciaExcessiva > 0 && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">◕ {alertasData.contagens.dominanciaExcessiva} dominância</span>}
                    {alertasData.contagens.uaAusente > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">📍 {alertasData.contagens.uaAusente} UA ausente</span>}
                    {alertasData.contagens.abundanciaAnomala > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">↑ {alertasData.contagens.abundanciaAnomala} pico anômalo</span>}
                    {alertasData.contagens.lacunaTemporal > 0 && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">⏱ {alertasData.contagens.lacunaTemporal} lacuna temporal</span>}
                    {alertasData.contagens.especieNova > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">✦ {alertasData.contagens.especieNova} espécie nova</span>}
                  </div>
                )}
                {alertasData.total === 0 ? (
                  <div className="border-2 border-dashed border-emerald-200 bg-emerald-50 rounded-lg p-6 text-center text-sm text-emerald-700">
                    <Sigma className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                    Nenhum alerta inteligente — monitoramento estável em todos os indicadores analisados.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alertasData.alertas.map((a: any, i: number) => {
                      // Appearance config per type
                      const typeConfig: Record<string, { label: string; icon: React.ReactNode; cardCls: string; badgeCls: string; sevLabel: string }> = {
                        especie_ausente:      { label: 'Espécie ausente',       icon: <Sigma className="w-4 h-4 text-rose-700" />,                 cardCls: a.severidade === 'alta' ? 'border-red-400 bg-red-50' : 'border-amber-300 bg-amber-50',       badgeCls: a.severidade === 'alta' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white',       sevLabel: a.severidade === 'alta' ? 'ALTA' : 'MÉDIA' },
                        queda_riqueza:        { label: 'Queda de riqueza',      icon: <TrendingUp className="w-4 h-4 text-amber-700 rotate-180" />, cardCls: a.severidade === 'alta' ? 'border-red-400 bg-red-50' : 'border-amber-300 bg-amber-50',       badgeCls: a.severidade === 'alta' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white',       sevLabel: a.severidade === 'alta' ? 'ALTA' : 'MÉDIA' },
                        especie_nova:         { label: 'Espécie nova',          icon: <Sparkles className="w-4 h-4 text-emerald-600" />,           cardCls: 'border-emerald-300 bg-emerald-50',                                                           badgeCls: 'bg-emerald-600 text-white',                                                         sevLabel: 'INFO'  },
                        dominancia_excessiva: { label: 'Dominância excessiva',  icon: <FlaskConical className="w-4 h-4 text-orange-600" />,        cardCls: a.severidade === 'alta' ? 'border-red-400 bg-red-50' : 'border-orange-300 bg-orange-50',     badgeCls: a.severidade === 'alta' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white',      sevLabel: a.severidade === 'alta' ? 'ALTA' : 'MÉDIA' },
                        ua_ausente:           { label: 'UA ausente',            icon: <MapPinOff className="w-4 h-4 text-blue-600" />,             cardCls: a.severidade === 'alta' ? 'border-red-400 bg-red-50' : 'border-blue-300 bg-blue-50',         badgeCls: a.severidade === 'alta' ? 'bg-red-600 text-white' : 'bg-blue-500 text-white',        sevLabel: a.severidade === 'alta' ? 'ALTA' : 'MÉDIA' },
                        lacuna_temporal:      { label: 'Lacuna temporal',       icon: <Clock className="w-4 h-4 text-slate-600" />,                cardCls: a.severidade === 'alta' ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-slate-50',       badgeCls: a.severidade === 'alta' ? 'bg-red-600 text-white' : 'bg-slate-500 text-white',       sevLabel: a.severidade === 'alta' ? 'ALTA' : 'MÉDIA' },
                        abundancia_anomala:   { label: 'Pico anômalo',          icon: <TrendingUp className="w-4 h-4 text-purple-600" />,          cardCls: a.severidade === 'alta' ? 'border-red-400 bg-red-50' : 'border-purple-300 bg-purple-50',     badgeCls: a.severidade === 'alta' ? 'bg-red-600 text-white' : 'bg-purple-500 text-white',      sevLabel: a.severidade === 'alta' ? 'ALTA' : 'MÉDIA' },
                        ameacada_declinio:    { label: 'Ameaçada em declínio',  icon: <AlertTriangle className="w-4 h-4 text-red-700" />,          cardCls: 'border-red-500 bg-red-50',                                                                   badgeCls: 'bg-red-700 text-white',                                                             sevLabel: 'ALTA'  },
                      };
                      const cfg = typeConfig[a.tipo] || { label: a.tipo, icon: <AlertTriangle className="w-4 h-4" />, cardCls: 'border-gray-300 bg-gray-50', badgeCls: 'bg-gray-500 text-white', sevLabel: a.severidade?.toUpperCase() || '?' };
                      return (
                        <div key={i} className={`border rounded-lg p-3 ${cfg.cardCls}`}>
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.badgeCls}`}>{cfg.sevLabel}</span>
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white border text-muted-foreground">{cfg.label}</span>
                                {a.ameacada && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-700 text-white">Ameaçada</span>}
                                {a.iucn && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-mono">IUCN: {a.iucn}</span>}
                                {a.mma && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-mono">MMA: {a.mma}</span>}
                                {(a.tipo === 'especie_ausente' || a.tipo === 'especie_nova' || a.tipo === 'dominancia_excessiva' || a.tipo === 'abundancia_anomala' || a.tipo === 'ameacada_declinio') && a.grupoTaxonomico && (
                                  <Badge className={`text-[10px] ${GRUPO_CONFIG[a.grupoTaxonomico]?.bg || 'bg-gray-100 text-gray-700'}`}>
                                    {GRUPO_CONFIG[a.grupoTaxonomico]?.label || a.grupoTaxonomico}
                                  </Badge>
                                )}
                              </div>
                              <div className={`text-sm font-semibold mt-1 break-words ${a.tipo === 'especie_ausente' || a.tipo === 'especie_nova' || a.tipo === 'ameacada_declinio' ? 'italic' : ''}`}>
                                {a.titulo}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">{a.detalhe}</div>
                              {/* Extra detail line per type */}
                              {a.tipo === 'queda_riqueza' && (
                                <div className="text-[11px] text-muted-foreground mt-1">
                                  Riqueza atual: <span className="font-semibold text-foreground">{a.riquezaAtual}</span>
                                  {' · '}Baseline ({a.campanhasComparadas} campanhas): <span className="font-semibold text-foreground">{a.riquezaBaseline}</span>
                                </div>
                              )}
                              {a.tipo === 'dominancia_excessiva' && (
                                <div className="text-[11px] text-muted-foreground mt-1">
                                  <span className="font-semibold text-foreground">{a.dominanciaPct}%</span> dos {a.totalRegistros} registros
                                  {' · '}{a.totalEspecies} espécie(s) detectada(s)
                                </div>
                              )}
                              {a.tipo === 'abundancia_anomala' && (
                                <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                                  N={a.contagem} · μ={a.media} · σ={a.desvioPadrao} · z={a.zScore}σ
                                </div>
                              )}
                              {a.tipo === 'ameacada_declinio' && (
                                <div className="text-[11px] text-muted-foreground mt-1">
                                  {a.declineStreak} campanhas em queda · atual: <span className="font-semibold text-foreground">{a.contagemAtual}</span> · pico: <span className="font-semibold text-foreground">{a.contagemPico}</span>
                                </div>
                              )}
                              {a.tipo === 'lacuna_temporal' && (
                                <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                                  {a.dataPrev} → {a.dataAtual} ({a.gapDias} dias)
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setAlertasOpen(false)}>Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Comparação entre Campanhas / Empreendimentos ── */}
      {compareOpen && (
        <Dialog open onOpenChange={setCompareOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-600" /> Comparação de Diversidade
              </DialogTitle>
            </DialogHeader>

            {/* Mode toggle */}
            <div className="flex rounded-lg border overflow-hidden text-xs font-medium w-fit">
              <button onClick={() => setCompareMode("campanhas")}
                className={`px-3 py-1.5 transition-colors ${compareMode === "campanhas" ? "bg-amber-600 text-white" : "hover:bg-muted text-muted-foreground"}`}>
                Entre Campanhas
              </button>
              <button onClick={() => setCompareMode("empreendimentos")}
                className={`px-3 py-1.5 transition-colors ${compareMode === "empreendimentos" ? "bg-blue-600 text-white" : "hover:bg-muted text-muted-foreground"}`}>
                Entre Empreendimentos
              </button>
            </div>

            {/* Selectors */}
            {compareMode === "campanhas" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Campanha A</label>
                  <Select value={compareCampA} onValueChange={setCompareCampA}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as campanhas</SelectItem>
                      {campanhas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Campanha B</label>
                  <Select value={compareCampB} onValueChange={setCompareCampB}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as campanhas</SelectItem>
                      {campanhas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Empreendimento A</label>
                  <Select value={compareEmpA} onValueChange={setCompareEmpA}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {empreendimentos.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Empreendimento B</label>
                  <Select value={compareEmpB} onValueChange={setCompareEmpB}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {empreendimentos.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Table */}
            {compareBioStats && (
              <div className="overflow-y-auto flex-1 rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 border-b sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Métrica</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-amber-700">
                        {compareMode === "campanhas"
                          ? (compareCampA === "todas" ? "Todas" : compareCampA)
                          : (compareEmpA === "todos" ? "Todos" : (empreendimentos.find(e => String(e.id) === compareEmpA)?.nome || compareEmpA))}
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-700">
                        {compareMode === "campanhas"
                          ? (compareCampB === "todas" ? "Todas" : compareCampB)
                          : (compareEmpB === "todos" ? "Todos" : (empreendimentos.find(e => String(e.id) === compareEmpB)?.nome || compareEmpB))}
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Δ (B−A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Section: Amostragem */}
                    <tr className="bg-muted/30">
                      <td colSpan={4} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Amostragem</td>
                    </tr>
                    {([
                      { label: "Registros totais (N)", va: compareBioStats.a?.N, vb: compareBioStats.b?.N, fmt: (v: number) => String(Math.round(v)) },
                      { label: "Riqueza observada (Sobs)", va: compareBioStats.a?.Sobs, vb: compareBioStats.b?.Sobs, fmt: (v: number) => String(Math.round(v)) },
                      { label: "Unidades Amostrais", va: compareBioStats.a?.nUAs, vb: compareBioStats.b?.nUAs, fmt: (v: number) => String(Math.round(v)) },
                      { label: "Campanhas", va: compareBioStats.a?.nCamps, vb: compareBioStats.b?.nCamps, fmt: (v: number) => String(Math.round(v)) },
                      { label: "Singletons (F1)", va: compareBioStats.a?.f1, vb: compareBioStats.b?.f1, fmt: (v: number) => String(Math.round(v)) },
                      { label: "Doubletons (F2)", va: compareBioStats.a?.f2, vb: compareBioStats.b?.f2, fmt: (v: number) => String(Math.round(v)) },
                    ] as { label: string; va: number | undefined; vb: number | undefined; fmt: (v: number) => string }[]).map(({ label, va, vb, fmt }) => {
                      const delta = va != null && vb != null ? vb - va : null;
                      const dc = delta == null ? "" : delta > 0 ? "text-green-600" : delta < 0 ? "text-red-500" : "text-muted-foreground";
                      return (
                        <tr key={label} className="border-t hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium text-xs">{label}</td>
                          <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-amber-700 font-semibold">{va != null ? fmt(va) : "—"}</td>
                          <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-blue-700 font-semibold">{vb != null ? fmt(vb) : "—"}</td>
                          <td className={`px-3 py-2 text-center font-mono text-xs tabular-nums font-bold ${dc}`}>
                            {delta != null ? (delta > 0 ? "+" : "") + fmt(delta) : "—"}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Section: Diversidade Alpha */}
                    <tr className="bg-muted/30">
                      <td colSpan={4} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Diversidade Alfa (α)</td>
                    </tr>
                    {([
                      { label: "Shannon (H')", va: compareBioStats.a?.H, vb: compareBioStats.b?.H, fmt: (v: number) => v.toFixed(3) },
                      { label: "Simpson (1-D)", va: compareBioStats.a?.D, vb: compareBioStats.b?.D, fmt: (v: number) => v.toFixed(3) },
                      { label: "Pielou — equitabilidade (J')", va: compareBioStats.a?.J, vb: compareBioStats.b?.J, fmt: (v: number) => v.toFixed(3) },
                      { label: "Berger-Parker — dominância", va: compareBioStats.a?.berger, vb: compareBioStats.b?.berger, fmt: (v: number) => v.toFixed(3), invertDelta: true },
                      { label: "Margalef (d)", va: compareBioStats.a?.margalef, vb: compareBioStats.b?.margalef, fmt: (v: number) => v.toFixed(3) },
                      { label: "Menhinick (d₂)", va: compareBioStats.a?.menhinick, vb: compareBioStats.b?.menhinick, fmt: (v: number) => v.toFixed(3) },
                    ] as { label: string; va: number | undefined; vb: number | undefined; fmt: (v: number) => string; invertDelta?: boolean }[]).map(({ label, va, vb, fmt, invertDelta }) => {
                      const delta = va != null && vb != null ? vb - va : null;
                      const positive = invertDelta ? delta != null && delta < 0 : delta != null && delta > 0;
                      const negative = invertDelta ? delta != null && delta > 0 : delta != null && delta < 0;
                      const dc = delta == null ? "" : positive ? "text-green-600" : negative ? "text-red-500" : "text-muted-foreground";
                      return (
                        <tr key={label} className="border-t hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium text-xs">{label}</td>
                          <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-amber-700 font-semibold">{va != null ? fmt(va) : "—"}</td>
                          <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-blue-700 font-semibold">{vb != null ? fmt(vb) : "—"}</td>
                          <td className={`px-3 py-2 text-center font-mono text-xs tabular-nums font-bold ${dc}`}>
                            {delta != null ? (delta > 0 ? "+" : "") + fmt(delta) : "—"}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Section: Estimadores */}
                    <tr className="bg-muted/30">
                      <td colSpan={4} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estimadores de Riqueza</td>
                    </tr>
                    {([
                      { label: "Chao1 (abundância)", va: compareBioStats.a?.chao1, vb: compareBioStats.b?.chao1, fmt: (v: number) => v.toFixed(1) },
                      { label: "Chao2 (incidência)", va: compareBioStats.a?.chao2, vb: compareBioStats.b?.chao2, fmt: (v: number) => v.toFixed(1) },
                      { label: "Cobertura Amostral", va: compareBioStats.a?.coverage, vb: compareBioStats.b?.coverage, fmt: (v: number) => v.toFixed(1) + "%" },
                    ] as { label: string; va: number | undefined; vb: number | undefined; fmt: (v: number) => string }[]).map(({ label, va, vb, fmt }) => {
                      const delta = va != null && vb != null ? vb - va : null;
                      const dc = delta == null ? "" : delta > 0 ? "text-green-600" : delta < 0 ? "text-red-500" : "text-muted-foreground";
                      return (
                        <tr key={label} className="border-t hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium text-xs">{label}</td>
                          <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-amber-700 font-semibold">{va != null ? fmt(va) : "—"}</td>
                          <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-blue-700 font-semibold">{vb != null ? fmt(vb) : "—"}</td>
                          <td className={`px-3 py-2 text-center font-mono text-xs tabular-nums font-bold ${dc}`}>
                            {delta != null ? (delta > 0 ? "+" : "") + fmt(delta) : "—"}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Section: Conservação */}
                    <tr className="bg-muted/30">
                      <td colSpan={4} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conservação</td>
                    </tr>
                    {([
                      { label: "Espécies ameaçadas (CR/EN/VU/EX/EW)", va: compareBioStats.a?.threatened, vb: compareBioStats.b?.threatened, fmt: (v: number) => String(Math.round(v)) },
                      { label: "Espécies CITES listadas", va: compareBioStats.a?.citesN, vb: compareBioStats.b?.citesN, fmt: (v: number) => String(Math.round(v)) },
                    ] as { label: string; va: number | undefined; vb: number | undefined; fmt: (v: number) => string }[]).map(({ label, va, vb, fmt }) => {
                      const delta = va != null && vb != null ? vb - va : null;
                      const dc = delta == null ? "" : delta > 0 ? "text-amber-600" : delta < 0 ? "text-green-600" : "text-muted-foreground";
                      return (
                        <tr key={label} className="border-t hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium text-xs">{label}</td>
                          <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-amber-700 font-semibold">{va != null ? fmt(va) : "—"}</td>
                          <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-blue-700 font-semibold">{vb != null ? fmt(vb) : "—"}</td>
                          <td className={`px-3 py-2 text-center font-mono text-xs tabular-nums font-bold ${dc}`}>
                            {delta != null ? (delta > 0 ? "+" : "") + fmt(delta) : "—"}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Section: Diversidade Beta */}
                    {compareBioStats.jaccard != null && (
                      <>
                        <tr className="bg-muted/30">
                          <td colSpan={4} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Diversidade Beta (similaridade A↔B)</td>
                        </tr>
                        <tr className="border-t hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium text-xs">Jaccard (similaridade)</td>
                          <td colSpan={3} className="px-3 py-2 text-center font-mono text-xs tabular-nums font-semibold text-violet-700">
                            {(compareBioStats.jaccard * 100).toFixed(1)}%
                            <span className="ml-2 text-muted-foreground font-normal text-[10px]">(0% = nenhuma sp. comum · 100% = idênticas)</span>
                          </td>
                        </tr>
                        <tr className="border-t hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium text-xs">Sørensen (similaridade)</td>
                          <td colSpan={3} className="px-3 py-2 text-center font-mono text-xs tabular-nums font-semibold text-violet-700">
                            {((compareBioStats.sorensen ?? 0) * 100).toFixed(1)}%
                            <span className="ml-2 text-muted-foreground font-normal text-[10px]">(sensível a riqueza relativa)</span>
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end pt-1">
              <Button variant="outline" size="sm" onClick={() => setCompareOpen(false)}>Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Novo Registro Manual ── */}
      {isNewRecordOpen && (
        <Dialog open onOpenChange={setIsNewRecordOpen}>
          <DialogContent
            className="max-w-2xl max-h-[90vh] overflow-y-auto"
            onKeyDown={(e) => {
              // F3: Ctrl/Cmd+S → salvar
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                if (!createMutation.isPending && newForm.nomeCientifico && newForm.data) {
                  createMutation.mutate(newForm);
                }
              }
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-600" /> Novo Registro Manual
              </DialogTitle>
            </DialogHeader>
            {draftRestored && (
              <div className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 text-amber-800">
                  <RefreshCw className="w-3 h-3" />
                  <span><strong>Rascunho restaurado.</strong> Continue de onde parou ou descarte.</span>
                </div>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-amber-700 hover:bg-amber-100"
                  onClick={() => {
                    try { localStorage.removeItem(DRAFT_KEY); } catch {}
                    setNewForm({ grupoTaxonomico: "aves", data: new Date().toISOString().split("T")[0] });
                    setDraftRestored(false);
                    toast({ title: "Rascunho descartado" });
                  }}>
                  Descartar
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Grupo Taxonômico *</label>
                <Select value={newForm.grupoTaxonomico || ""} onValueChange={v => setNewForm(f => ({ ...f, grupoTaxonomico: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(GRUPO_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Empreendimento</label>
                <Select value={String(newForm.empreendimentoId || "__none__")} onValueChange={v => setNewForm(f => ({ ...f, empreendimentoId: v === "__none__" ? undefined : Number(v) }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {empreendimentos.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Nome Científico *</label>
                <Input className="h-8 text-sm italic" value={newForm.nomeCientifico || ""} onChange={e => setNewForm(f => ({ ...f, nomeCientifico: e.target.value }))} placeholder="Genus species" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Nome Comum</label>
                <Input className="h-8 text-sm" value={newForm.nomeComum || ""} onChange={e => setNewForm(f => ({ ...f, nomeComum: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Campanha</label>
                <Input className="h-8 text-sm" value={newForm.campanha || ""} onChange={e => setNewForm(f => ({ ...f, campanha: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Data *</label>
                <Input className="h-8 text-sm" type="date" value={newForm.data || ""} onChange={e => setNewForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Unidade Amostral</label>
                <Input className="h-8 text-sm" value={newForm.unidadeAmostral || ""} onChange={e => setNewForm(f => ({ ...f, unidadeAmostral: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Método</label>
                <Input className="h-8 text-sm" value={newForm.metodo || ""} onChange={e => setNewForm(f => ({ ...f, metodo: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Abundância</label>
                <Input className="h-8 text-sm" type="number" min={1} value={newForm.abundancia ?? ""} onChange={e => setNewForm(f => ({ ...f, abundancia: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Sexo</label>
                <Select value={newForm.sexo || "__none__"} onValueChange={v => setNewForm(f => ({ ...f, sexo: v === "__none__" ? undefined : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="macho">Macho</SelectItem>
                    <SelectItem value="femea">Fêmea</SelectItem>
                    <SelectItem value="indefinido">Indefinido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Latitude</label>
                <Input className="h-8 text-sm font-mono" value={newForm.latitude || ""} onChange={e => setNewForm(f => ({ ...f, latitude: e.target.value }))} placeholder="-00.000000" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Longitude</label>
                <Input className="h-8 text-sm font-mono" value={newForm.longitude || ""} onChange={e => setNewForm(f => ({ ...f, longitude: e.target.value }))} placeholder="-00.000000" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Coletor</label>
                <Input className="h-8 text-sm" value={newForm.nomeColetor || ""} onChange={e => setNewForm(f => ({ ...f, nomeColetor: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Status do Registro</label>
                <Select value={newForm.statusRegistro || "__none__"} onValueChange={v => setNewForm(f => ({ ...f, statusRegistro: v === "__none__" ? undefined : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="provavel">Provável</SelectItem>
                    <SelectItem value="possivel">Possível</SelectItem>
                    <SelectItem value="duvidoso">Duvidoso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Sazonalidade</label>
                <Select value={(newForm as any).sazonalidade || "__none__"} onValueChange={v => setNewForm(f => ({ ...f, sazonalidade: v === "__none__" ? undefined : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="Chuva">🌧 Chuva</SelectItem>
                    <SelectItem value="Seca">☀️ Seca</SelectItem>
                    <SelectItem value="Transição">🌤 Transição</SelectItem>
                    <SelectItem value="Pré-chuva">🌦 Pré-chuva</SelectItem>
                    <SelectItem value="Pós-chuva">🌤 Pós-chuva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 border-t pt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status de Conservação (opcional)</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">IUCN Global</label>
                <Select value={newForm.iucn || "__none__"} onValueChange={v => setNewForm(f => ({ ...f, iucn: v === "__none__" ? undefined : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {["EX","EW","CR","EN","VU","NT","LC","DD"].map(c => (
                      <SelectItem key={c} value={c}><span style={{ color: IUCN_COLORS[c] }} className="font-bold">{c}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">MMA/IBAMA</label>
                <Select value={newForm.ibamaMma || "__none__"} onValueChange={v => setNewForm(f => ({ ...f, ibamaMma: v === "__none__" ? undefined : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {["CR","EN","VU","NT","LC","DD"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground font-medium block mb-1">Observações</label>
                <textarea className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" rows={2}
                  value={newForm.observacoes || ""} onChange={e => setNewForm(f => ({ ...f, observacoes: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                💾 Rascunho salvo automaticamente · <kbd className="px-1 py-0.5 bg-muted rounded border text-[10px]">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-muted rounded border text-[10px]">S</kbd> para salvar · <kbd className="px-1 py-0.5 bg-muted rounded border text-[10px]">Esc</kbd> para fechar
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsNewRecordOpen(false)}>Cancelar</Button>
                <Button
                  size="sm"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white"
                  disabled={createMutation.isPending || !newForm.nomeCientifico || !newForm.data}
                  onClick={() => createMutation.mutate(newForm)}>
                  {createMutation.isPending ? <><RefreshCw className="w-3 h-3 animate-spin mr-1" /> Salvando...</> : <><PlusCircle className="w-3 h-3 mr-1" /> Criar Registro</>}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {importCampoOpen && (
        <Suspense fallback={null}>
          <ImportCampoDialog
            open={importCampoOpen}
            onClose={() => setImportCampoOpen(false)}
            onImportSuccess={() => {
              setImportCampoOpen(false);
              queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
            }}
            empreendimentos={empreendimentos}
            sysCampanhas={sysCampanhas}
            defaultEmpId={selectedEmpId !== "todos" ? Number(selectedEmpId) : undefined}
          />
        </Suspense>
      )}

      {/* ── F3: Dialog de atalhos de teclado ── */}
      {shortcutsHelpOpen && (
        <Dialog open onOpenChange={setShortcutsHelpOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-emerald-600" /> Atalhos de Teclado
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-1 text-sm">
              {[
                { key: "/",          desc: "Focar na busca de registros" },
                { key: "n",          desc: "Abrir formulário de novo registro" },
                { key: "i",          desc: "Abrir importação de planilha" },
                { key: "Ctrl + E",   desc: "Exportar para Excel (5 abas)" },
                { key: "Ctrl + S",   desc: "Salvar (dentro de um formulário)" },
                { key: "?",          desc: "Mostrar esta tela de atalhos" },
                { key: "Esc",        desc: "Fechar dialog aberto" },
              ].map(({ key, desc }) => (
                <div key={key} className="flex items-center justify-between gap-3 py-1.5 border-b border-muted last:border-0">
                  <span className="text-muted-foreground text-xs">{desc}</span>
                  <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-mono font-semibold text-foreground shadow-sm whitespace-nowrap">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Atalhos de letra única (<kbd className="font-mono text-[10px] bg-muted border rounded px-1">n</kbd>, <kbd className="font-mono text-[10px] bg-muted border rounded px-1">i</kbd>, <kbd className="font-mono text-[10px] bg-muted border rounded px-1">/</kbd>) ficam desativados enquanto você digita em campos de formulário.
            </p>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
