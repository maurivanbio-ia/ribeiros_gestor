import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import "leaflet/dist/leaflet.css";
import senaiCimatecLogoUrl from "@assets/image_1778636939719.png";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Globe, Layers, BarChart3, X, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, RotateCcw, Thermometer, Waves, Zap, Compass,
  ArrowLeft, Upload, Eye, EyeOff, MapPin, Info, TrendingUp,
  AlertTriangle, ShieldCheck, Activity, Settings, Trash2, Search,
  Pencil, Maximize2, FolderOpen, ExternalLink, Calendar, Download,
  Ruler, Target, MousePointer2, Columns2, BarChart2, Filter, Radio,
  Microscope, ScanSearch
} from "lucide-react";
import { useLocation } from "wouter";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Empreendimento {
  id: number; nome: string; cliente: string; localizacao: string;
  latitude: string | null; longitude: string | null; status: string;
  tipo: string; municipio: string | null; uf: string | null;
  responsavelInterno: string; unidade: string; logoUrl: string | null;
}
interface LicencaAmbiental {
  id: number; numero: string; tipo: string; status: string;
  dataVencimento: string | null; empreendimentoId: number;
}
interface CampoRegistro {
  id: number; latitude: string | number | null; longitude: string | number | null;
  grupoTaxonomico: string | null; abundancia: number | null;
  nomeCientifico?: string | null; nomeComum?: string | null;
  localColeta?: string | null; dataColeta?: string | null;
  empreendimentoId?: number | null; observacoes?: string | null;
  zonaUtm?: string | null;
  // pre-computed WGS84 after parseCampoCoords()
  _lat?: number; _lng?: number;
}

// ── UTM (SIRGAS2000/WGS84) → Decimal Degrees ──────────────────────────────────
// Handles both Zone 24S (Bahia interior / Cerrado) and decimal-degree records.
function utmToWgs84(E: number, N: number, zone: number, south: boolean): [number, number] {
  const k0 = 0.9996, a = 6378137, eccSq = 0.00669438;
  const e1 = (1 - Math.sqrt(1 - eccSq)) / (1 + Math.sqrt(1 - eccSq));
  const x = E - 500000;
  const y = south ? N - 10000000 : N;
  const lon0 = (zone - 1) * 6 - 180 + 3;
  const ep2 = eccSq / (1 - eccSq);
  const M = y / k0;
  const mu = M / (a * (1 - eccSq / 4 - 3 * eccSq ** 2 / 64 - 5 * eccSq ** 3 / 256));
  const p1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const N1 = a / Math.sqrt(1 - eccSq * Math.sin(p1) ** 2);
  const T1 = Math.tan(p1) ** 2;
  const C1 = ep2 * Math.cos(p1) ** 2;
  const R1 = a * (1 - eccSq) / (1 - eccSq * Math.sin(p1) ** 2) ** 1.5;
  const D = x / (N1 * k0);
  const lat = p1 - (N1 * Math.tan(p1) / R1) * (
    D ** 2 / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6 / 720
  );
  const lon = (D
    - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5 / 120
  ) / Math.cos(p1);
  return [lat * 180 / Math.PI, lon0 + lon * 180 / Math.PI];
}

// Accepts both decimal-degrees and UTM text values stored in DB.
// zonaUtm: value from campo_registros.zona_utm (e.g. "23L", "24K", "23S")
function parseCampoCoords(rawA: any, rawB: any, zonaUtm?: string | null): [number, number] | null {
  const rawLatStr = String(rawA ?? "").replace(",", ".");
  const rawLngStr = String(rawB ?? "").replace(",", ".");
  const a = parseFloat(rawLatStr);
  const b = parseFloat(rawLngStr);
  if (isNaN(a) || isNaN(b)) return null;
  // Already WGS84 decimal degrees
  if (Math.abs(a) <= 180 && Math.abs(b) <= 180 && (Math.abs(a) < 1000 && Math.abs(b) < 1000)) {
    if (Math.abs(a) < 0.001 && Math.abs(b) < 0.001) return null;
    // Genuine decimal degrees: lat must be -90..90, lng -180..180
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [a, b];
  }
  // UTM: latitude col = Easting (~100k–900k), longitude col = Northing (~1M–10M)
  const [E, N] = a < b ? [a, b] : [b, a];
  if (E < 100000 || E > 900000 || N < 1000000) return null;
  // Use zonaUtm from DB (e.g. "23L", "24K") — extract numeric zone
  let zone = 24; // fallback
  if (zonaUtm) {
    const parsed = parseInt(zonaUtm.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(parsed) && parsed >= 18 && parsed <= 25) zone = parsed;
  }
  // Hemisphere: "N" suffix = north, everything else = south (Brazil is south)
  const south = !zonaUtm || !zonaUtm.toUpperCase().endsWith("N");
  return utmToWgs84(E, N, zone, south);
}
interface CamadaGeoespacial {
  id: number; nome: string; descricao: string | null; categoria: string;
  cor: string | null; opacidade: number | null; geojsonUrl: string | null;
  geojsonData: any; fonte: string | null; ano: number | null;
  ativo: boolean | null; visivel: boolean | null; ordem: number | null;
}

// ─── Configs ─────────────────────────────────────────────────────────────────
const TIPO_CONFIG: Record<string, { label: string; icon: string; color: string; radiusKm: number; heightFactor: number }> = {
  hidreletrica:      { label: "Hidrelétrica",         icon: "💧", color: "#3b82f6", radiusKm: 40, heightFactor: 4.5 },
  hidrelétrica:      { label: "Hidrelétrica",         icon: "💧", color: "#3b82f6", radiusKm: 40, heightFactor: 4.5 },
  parque_eolico:     { label: "Parque Eólico",        icon: "🌬️", color: "#10b981", radiusKm: 25, heightFactor: 2.5 },
  parque_eólico:     { label: "Parque Eólico",        icon: "🌬️", color: "#10b981", radiusKm: 25, heightFactor: 2.5 },
  eolico:            { label: "Parque Eólico",        icon: "🌬️", color: "#10b981", radiusKm: 25, heightFactor: 2.5 },
  usina_solar:       { label: "Usina Solar",          icon: "☀️",  color: "#f59e0b", radiusKm: 18, heightFactor: 2.0 },
  solar:             { label: "Usina Solar",          icon: "☀️",  color: "#f59e0b", radiusKm: 18, heightFactor: 2.0 },
  fotovoltaico:      { label: "Solar",                icon: "☀️",  color: "#f59e0b", radiusKm: 18, heightFactor: 2.0 },
  termoeletrica:     { label: "Termelétrica",         icon: "🔥", color: "#ef4444", radiusKm: 30, heightFactor: 3.5 },
  termoelétrica:     { label: "Termelétrica",         icon: "🔥", color: "#ef4444", radiusKm: 30, heightFactor: 3.5 },
  linha_transmissao: { label: "Linha de Transmissão", icon: "⚡", color: "#fbbf24", radiusKm: 15, heightFactor: 2.0 },
  transmissao:       { label: "Linha de Transmissão", icon: "⚡", color: "#fbbf24", radiusKm: 15, heightFactor: 2.0 },
  mina:              { label: "Mineração",            icon: "⛏️", color: "#8b5cf6", radiusKm: 55, heightFactor: 5.5 },
  mineracao:         { label: "Mineração",            icon: "⛏️", color: "#8b5cf6", radiusKm: 55, heightFactor: 5.5 },
  pchs:              { label: "PCH",                  icon: "🏭", color: "#06b6d4", radiusKm: 22, heightFactor: 3.0 },
  pch:               { label: "PCH",                  icon: "🏭", color: "#06b6d4", radiusKm: 22, heightFactor: 3.0 },
  agropecuario:      { label: "Agropecuário",         icon: "🌾", color: "#84cc16", radiusKm: 20, heightFactor: 1.5 },
  industria:         { label: "Indústria",            icon: "🏭", color: "#f97316", radiusKm: 25, heightFactor: 2.5 },
  outro:             { label: "Outro",                icon: "📍", color: "#6b7280", radiusKm: 12, heightFactor: 1.0 },
};

const CATEGORIA_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  // Proteção ambiental
  uc:                    { label: "Unidades de Conservação",    icon: "🌲", color: "#22c55e" },
  terras_indigenas:      { label: "Terras Indígenas",           icon: "🏠", color: "#f59e0b" },
  zona_amortecimento:    { label: "Zona de Amortecimento",      icon: "🔵", color: "#06b6d4" },
  app:                   { label: "APP / Zona Ripária",         icon: "🌊", color: "#0ea5e9" },
  // Uso e cobertura
  uso_solo:              { label: "Uso do Solo",                icon: "🗺️", color: "#8b5cf6" },
  vegetacao:             { label: "Vegetação",                  icon: "🌿", color: "#10b981" },
  antropizacao:          { label: "Antropização / Supressão",   icon: "🚧", color: "#dc2626" },
  // Recursos hídricos
  hidrografia:           { label: "Hidrografia",                icon: "💧", color: "#3b82f6" },
  qualidade_agua:        { label: "Qualidade da Água",          icon: "🧪", color: "#0284c7" },
  // Meio físico
  geologia:              { label: "Geologia / Geomorfologia",   icon: "🪨", color: "#92400e" },
  solo:                  { label: "Solo / Pedologia",           icon: "🟤", color: "#a16207" },
  // Limites e administração
  municipios:            { label: "Municípios",                 icon: "🏙️", color: "#6b7280" },
  estados:               { label: "Estados / UFs",              icon: "🗺️", color: "#475569" },
  // Influência do empreendimento
  area_influencia:       { label: "Área de Influência (AID/AII)", icon: "📐", color: "#f97316" },
  area_afetada:          { label: "Área Diretamente Afetada",   icon: "⚠️", color: "#ef4444" },
  // Infraestrutura
  infraestrutura:        { label: "Infraestrutura Viária",      icon: "🛣️", color: "#64748b" },
  linha_transmissao:     { label: "Linhas de Transmissão",      icon: "⚡", color: "#fbbf24" },
  // Socioeconômico
  socieconomico:         { label: "Socioeconômico",             icon: "👥", color: "#e879f9" },
  patrimonio_cultural:   { label: "Patrimônio Cultural",        icon: "🏛️", color: "#d97706" },
  // Pontos amostrais — fauna/flora (monitoramento de campo)
  pontos_aves:           { label: "Pontos Amostrais — Aves",          icon: "🦅", color: "#f97316" },
  pontos_mamiferos:      { label: "Pontos Amostrais — Mamíferos",     icon: "🦦", color: "#8b5cf6" },
  pontos_herpetofauna:   { label: "Pontos Amostrais — Herpetofauna",  icon: "🦎", color: "#16a34a" },
  pontos_ictiofauna:     { label: "Pontos Amostrais — Ictiofauna",    icon: "🐟", color: "#2563eb" },
  pontos_invertebrados:  { label: "Pontos Amostrais — Invertebrados", icon: "🦋", color: "#db2777" },
  pontos_flora:          { label: "Pontos Amostrais — Flora",         icon: "🌱", color: "#15803d" },
  pontos_ruido:          { label: "Pontos Amostrais — Ruído",         icon: "🔊", color: "#ca8a04" },
  pontos_solo:           { label: "Pontos Amostrais — Solo",          icon: "🔬", color: "#78350f" },
  pontos_agua:           { label: "Pontos Amostrais — Água",          icon: "💧", color: "#0369a1" },
  pontos_ar:             { label: "Pontos Amostrais — Qualidade do Ar", icon: "🌬️", color: "#60a5fa" },
  pontos_vibracao:       { label: "Pontos Amostrais — Vibração",      icon: "📳", color: "#a78bfa" },
  // Metodologia de campo
  transectos:            { label: "Transectos de Monitoramento",      icon: "📏", color: "#fb923c" },
  parcelas:              { label: "Parcelas Fitossociológicas",        icon: "🟩", color: "#4ade80" },
  ponto_escuta:          { label: "Pontos de Escuta — Aves",          icon: "🎵", color: "#f472b6" },
  armadilha_foto:        { label: "Armadilhas Fotográficas",          icon: "📷", color: "#a3e635" },
  grade_amostragem:      { label: "Grade de Amostragem",              icon: "🔲", color: "#94a3b8" },
  // Risco e vulnerabilidade
  risco_inundacao:       { label: "Risco de Inundação",               icon: "🌊", color: "#1d4ed8" },
  risco_deslizamento:    { label: "Risco de Deslizamento",            icon: "⛰️", color: "#92400e" },
  vulnerabilidade_erosao:{ label: "Vulnerabilidade à Erosão",         icon: "🌋", color: "#b45309" },
  areas_risco:           { label: "Áreas de Risco — CEMADEN/IBGE",    icon: "⚠️", color: "#dc2626" },
  cicatriz_incendio:     { label: "Cicatrizes de Incêndio",           icon: "🔥", color: "#ea580c" },
  // Biodiversidade e ecossistemas
  corredores_ecologicos: { label: "Corredores Ecológicos",            icon: "🌿", color: "#059669" },
  areas_prioritarias:    { label: "Áreas Prioritárias p/ Conservação",icon: "🛡️", color: "#065f46" },
  hotspot_biodiversidade:{ label: "Hotspot de Biodiversidade",        icon: "🌡️", color: "#d97706" },
  fitofisionomia:        { label: "Fitofisionomia / Form. Vegetais",  icon: "🌾", color: "#84cc16" },
  especie_ameacada:      { label: "Ocorrência — Espécies Ameaçadas",  icon: "🦁", color: "#b91c1c" },
  // Recursos hídricos (expandido)
  bacia_hidrografica:    { label: "Bacias Hidrográficas",             icon: "🏞️", color: "#0284c7" },
  aquiferos:             { label: "Aquíferos / Zonas de Recarga",     icon: "💎", color: "#38bdf8" },
  areas_umidas:          { label: "Áreas Úmidas / Veredas",           icon: "🌿", color: "#4ade80" },
  nascentes:             { label: "Nascentes e Olhos d'Água",         icon: "💧", color: "#7dd3fc" },
  outorgas:              { label: "Outorgas de Uso de Água",          icon: "📋", color: "#0369a1" },
  // Licenciamento e outorgas
  licencas_ambientais:   { label: "Licenças Ambientais (mapa)",       icon: "📜", color: "#6366f1" },
  autos_infracao:        { label: "Autos de Infração / IBAMA",        icon: "🚫", color: "#dc2626" },
  embargos:              { label: "Embargos / Interdições",           icon: "🔴", color: "#991b1b" },
  car:                   { label: "CAR — Cadastro Ambiental Rural",   icon: "🏡", color: "#65a30d" },
  sinaflor:              { label: "SINAFLOR / Autorização Desmate",   icon: "🪓", color: "#7c3aed" },
  // Passivos e contaminação
  passivo_ambiental:     { label: "Passivos Ambientais",              icon: "☣️", color: "#7f1d1d" },
  area_contaminada:      { label: "Áreas Contaminadas — CETESB/INEA", icon: "⚗️", color: "#b91c1c" },
  aterros:               { label: "Aterros e Lixões",                 icon: "🗑️", color: "#713f12" },
  emissoes:              { label: "Pontos de Emissão Atmosférica",    icon: "🏭", color: "#6b7280" },
  // Comunidades e territórios
  comunidades_quilombolas:{ label: "Comunidades Quilombolas",         icon: "🏘️", color: "#78350f" },
  assentamentos:         { label: "Assentamentos Rurais (INCRA)",     icon: "🌾", color: "#854d0e" },
  aldeias:               { label: "Aldeias Indígenas — Pontos",       icon: "🏕️", color: "#92400e" },
  comunidades_tradicionais:{ label: "Comunidades Tradicionais",       icon: "👥", color: "#b45309" },
  // Energia e mineração
  concessoes_minerarias: { label: "Concessões Minerárias — ANM",      icon: "⛏️", color: "#78716c" },
  oleodutos:             { label: "Oleodutos / Gasodutos",            icon: "🛢️", color: "#713f12" },
  linhas_alta_tensao:    { label: "Linhas de Alta Tensão",            icon: "⚡", color: "#fbbf24" },
  usinas:                { label: "Usinas e Complexos Energéticos",   icon: "🔋", color: "#ca8a04" },
  // Urbanização e zoneamento
  perimetros_urbanos:    { label: "Perímetros Urbanos",               icon: "🏙️", color: "#94a3b8" },
  expansao_urbana:       { label: "Expansão Urbana",                  icon: "🏗️", color: "#64748b" },
  zoneamento:            { label: "Zoneamento Urbano",                icon: "📐", color: "#7c3aed" },
  // Sensoriamento remoto / análise temporal
  cobertura_temporal:    { label: "Cobertura Temporal / Série Hist.", icon: "📅", color: "#0891b2" },
  areas_mineracao_sr:    { label: "Áreas de Mineração Detectadas",    icon: "🛰️", color: "#44403c" },
  // Clima e meteorologia
  pluviometria:          { label: "Pluviometria / Isohietas",         icon: "🌧️", color: "#3b82f6" },
  temperatura:           { label: "Temperatura / Isotermas",          icon: "🌡️", color: "#f97316" },
  clima:                 { label: "Zoneamento Climático",             icon: "☁️", color: "#818cf8" },
  // Áreas de influência — licenciamento ambiental
  zona_ada:              { label: "ADA — Área Diretamente Afetada",   icon: "🔴", color: "#ef4444" },
  zona_aid:              { label: "AID — Área de Influência Direta",  icon: "🟡", color: "#f59e0b" },
  zona_aii:              { label: "AII — Área de Influência Indireta",icon: "🟢", color: "#22c55e" },
  // Genérico
  outro:                 { label: "Outros",                           icon: "📍", color: "#6b7280" },
};

const CAMPO_GRUPO_CONFIG_RAW: Array<{ keys: string[]; label: string; icon: string; color: string }> = [
  { keys: ["fauna aves", "aves", "avifauna"],          label: "Aves",              icon: "🦅", color: "#f97316" },
  { keys: ["mamíferos", "mamiferos", "mastofauna"],    label: "Mamíferos",          icon: "🦦", color: "#8b5cf6" },
  { keys: ["herpetofauna", "herp", "répteis"],         label: "Herpetofauna",       icon: "🦎", color: "#16a34a" },
  { keys: ["ictiofauna", "peixes", "peixe"],           label: "Ictiofauna",         icon: "🐟", color: "#2563eb" },
  { keys: ["invertebrados", "invertebrado"],           label: "Invertebrados",      icon: "🦋", color: "#db2777" },
  { keys: ["flora", "fitossociologia", "vegetação"],   label: "Flora",              icon: "🌱", color: "#15803d" },
  { keys: ["ruído", "ruido", "acústica", "acustica"],  label: "Ruído",              icon: "🔊", color: "#ca8a04" },
  { keys: ["solo", "pedologia", "sedimento"],          label: "Solo",               icon: "🔬", color: "#78350f" },
  { keys: ["qualidade da água", "qualidade de água", "qualidade_agua", "agua", "água", "hidrologia"], label: "Qualidade da Água", icon: "💧", color: "#0369a1" },
];
function getCampoGrupoConfig(grupo: string) {
  const low = (grupo || "").toLowerCase().trim();
  return (
    CAMPO_GRUPO_CONFIG_RAW.find(c => c.keys.some(k => low === k || low.includes(k) || k.includes(low))) ||
    { label: grupo, icon: "📍", color: "#6b7280" }
  );
}

const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo", em_planejamento: "Planejamento", em_execucao: "Em Execução",
  concluido: "Concluído", inativo: "Inativo",
};

const TILE_LAYERS: Record<string, { url: string; attr: string; noSubdomains?: boolean }> = {
  dark:      { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",             attr: '&copy; OpenStreetMap contributors &copy; CARTO' },
  light:     { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",            attr: '&copy; OpenStreetMap contributors &copy; CARTO' },
  voyager:   { url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",  attr: '&copy; OpenStreetMap contributors &copy; CARTO' },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP',
    noSubdomains: true,
  },
};

function getTipoConfig(tipo: string) {
  if (!tipo) return TIPO_CONFIG.outro;
  const low = tipo.toLowerCase().trim().replace(/\s+/g, "_");
  return TIPO_CONFIG[tipo] || TIPO_CONFIG[low] ||
    Object.entries(TIPO_CONFIG).find(([k]) => low.includes(k) || k.includes(low))?.[1] ||
    TIPO_CONFIG.outro;
}

function computeCompliance(licencas: LicencaAmbiental[]) {
  if (!licencas.length) return { color: "#64748b", label: "Sem Dados", score: 0.5 };
  const today = new Date(); const in90 = new Date(today); in90.setDate(in90.getDate() + 90);
  let expired = 0, expiring = 0, active = 0;
  for (const l of licencas) {
    if (!l.dataVencimento) { active++; continue; }
    const d = new Date(l.dataVencimento);
    if (d < today) expired++; else if (d < in90) expiring++; else active++;
  }
  const t = licencas.length;
  if (expired / t > 0.3)  return { color: "#ef4444", label: "Crítico",  score: 0.2 };
  if (expiring / t > 0.4) return { color: "#f59e0b", label: "Atenção",  score: 0.5 };
  return { color: "#22c55e", label: "Regular", score: 1.0 };
}

// Custom divIcon por tipo
function makeMarkerIcon(
  tc: typeof TIPO_CONFIG[string],
  compColor: string,
  size: number,
  label?: string,
  logoUrl?: string | null,
) {
  const s = Math.max(28, Math.min(48, size));
  const labelHtml = label ? `
    <div style="
      position:absolute;top:${s + 3}px;left:50%;transform:translateX(-50%);
      white-space:nowrap;font-size:9.5px;font-weight:700;line-height:1.2;
      color:#fff;text-shadow:0 1px 3px rgba(0,0,0,1),0 0 8px rgba(0,0,0,0.9),1px 1px 0 rgba(0,0,0,0.8);
      pointer-events:none;letter-spacing:0.01em;text-align:center;max-width:120px;
      overflow:hidden;text-overflow:ellipsis;
    ">${label}</div>` : "";
  const totalH = s + (label ? 18 : 0);
  const innerContent = logoUrl
    ? `<img src="${logoUrl}" alt="" style="
        width:${s - 8}px;height:${s - 8}px;border-radius:50%;
        object-fit:cover;flex-shrink:0;
      " onerror="this.style.display='none';this.nextSibling.style.display='flex';" />
       <span style="display:none;font-size:${s * 0.40}px;line-height:1;">${tc.icon}</span>`
    : `<span style="font-size:${s * 0.40}px;line-height:1;">${tc.icon}</span>`;
  const html = `
    <div style="position:relative;display:inline-block;width:${s}px;height:${totalH}px;">
      <div style="
        width:${s}px;height:${s}px;border-radius:50%;
        background:${compColor};border:3px solid rgba(255,255,255,0.95);
        display:flex;align-items:center;justify-content:center;overflow:hidden;
        font-size:${s * 0.40}px;line-height:1;
        box-shadow:0 2px 12px rgba(0,0,0,0.55),0 0 0 1.5px rgba(0,0,0,0.25);
        cursor:pointer;
      ">${innerContent}</div>
      ${labelHtml}
    </div>`;
  return { html, iconSize: [s, totalH] as [number, number], iconAnchor: [s / 2, s / 2] as [number, number], className: "" };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Mapa3D() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [mapStyle, setMapStyle]   = useState<"dark" | "light" | "voyager" | "satellite">("satellite");
  const [mapCenter, setMapCenter] = useState<{lat:number,lng:number,zoom:number}|null>(null);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"controles" | "camadas" | "analise">("controles");

  const [layerZonas,   setLayerZonas]   = useState(true);
  const [layerMarkers, setLayerMarkers] = useState(true);
  const [layerHeatmap, setLayerHeatmap] = useState(true);
  const [layerArcos,   setLayerArcos]   = useState(false);
  const [campoVisibleGroups, setCampoVisibleGroups] = useState<Set<string>>(new Set());
  const [campoSectionHidden, setCampoSectionHidden] = useState(false);
  const [campoDeleteConfirm, setCampoDeleteConfirm] = useState<string | null>(null); // grupo sendo confirmado p/ exclusão

  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterTipo,   setFilterTipo]   = useState("todos");
  const [raioMulti,    setRaioMulti]    = useState(1.0);
  const [markerMulti,  setMarkerMulti]  = useState(1.0);
  const [mapReady,     setMapReady]     = useState(false);
  const [mapLayerKey,  setMapLayerKey]  = useState(0);

  // Camadas geoespaciais
  const [visibleGeoLayers, setVisibleGeoLayers] = useState<Set<number>>(new Set());

  // PDF Export dialog
  const [showPDFDialog,  setShowPDFDialog]  = useState(false);
  const [pdfLayerSel,    setPdfLayerSel]    = useState<Set<number>>(new Set());
  const [pdfShowEmp,     setPdfShowEmp]     = useState(true);
  const [pdfShowCampo,   setPdfShowCampo]   = useState(true);
  const [pdfShowHeatmap, setPdfShowHeatmap] = useState(true);
  const [pdfShowZones,   setPdfShowZones]   = useState(true);
  const [pdfClientLogo,  setPdfClientLogo]  = useState<string | null>(null);
  const [pdfMapTitle,    setPdfMapTitle]    = useState("Relatório Cartográfico — Mapa de Empreendimentos Ambientais");

  const [uploadOpen,  setUploadOpen]   = useState(false);
  const [uploading,   setUploading]    = useState(false);
  const [uploadFile,  setUploadFile]   = useState<File | null>(null);
  const [uploadNome,  setUploadNome]   = useState("");
  const [uploadCat,   setUploadCat]    = useState("outro");
  const [uploadFonte, setUploadFonte]  = useState("");
  const [uploadCor,   setUploadCor]    = useState("#3b82f6");
  const [layerColors, setLayerColors]  = useState<Record<number, string>>({});

  // Seletor de atributos por camada (quais colunas mostrar no popup)
  const [layerAttrConfig, setLayerAttrConfig] = useState<Record<number, string[]>>({});
  const [configLayerId,   setConfigLayerId]   = useState<number | null>(null);
  const layerAttrConfigRef   = useRef<Record<number, string[]>>({});
  const prevMapStyleRef      = useRef<string | null>(null);
  useEffect(() => { layerAttrConfigRef.current = layerAttrConfig; }, [layerAttrConfig]);

  // Organização de camadas
  const [layerSearch,      setLayerSearch]      = useState("");
  const [editingLayerName, setEditingLayerName] = useState<Record<number, string>>({});
  const [layerOpacities,   setLayerOpacities]   = useState<Record<number, number>>({});

  // ── MapBiomas Alerta ─────────────────────────────────────────────────────────
  const [mbEnabled,       setMbEnabled]       = useState(false);
  const [mbAuthenticated, setMbAuthenticated] = useState(false);
  const [mbSignInOpen,    setMbSignInOpen]    = useState(false);
  const [mbEmail,         setMbEmail]         = useState("");
  const [mbPassword,      setMbPassword]      = useState("");
  const [mbLoggingIn,     setMbLoggingIn]     = useState(false);
  const [mbAlerts,        setMbAlerts]        = useState<any[]>([]);
  const [mbSummary,       setMbSummary]       = useState<any>(null);
  const [mbLoading,       setMbLoading]       = useState(false);
  const [mbError,         setMbError]         = useState<string | null>(null);
  const oneYearAgo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); };
  const [mbStartDate,     setMbStartDate]     = useState(oneYearAgo);
  const [mbEndDate,       setMbEndDate]       = useState(() => new Date().toISOString().slice(0, 10));
  const [mbSources,       setMbSources]       = useState("All");
  const mbMarkersRef    = useRef<any[]>([]);
  const mbPolygonsRef   = useRef<any[]>([]);
  const [mbShowPolygons,    setMbShowPolygons]    = useState(true);
  const [mbPolygonsLoading, setMbPolygonsLoading] = useState(false);
  const [mbPolygonCount,    setMbPolygonCount]    = useState(0);

  // ── Novas funcionalidades ─────────────────────────────────────────────────────
  const [layerBioHeatmap,     setLayerBioHeatmap]     = useState(false);
  const [layerAidConcentrico, setLayerAidConcentrico] = useState(false);
  const [layerCampoCluster,   setLayerCampoCluster]   = useState(false);
  const [campoDateFrom,       setCampoDateFrom]       = useState("");
  const [campoDateTo,         setCampoDateTo]         = useState("");
  const [showStatsPanel,      setShowStatsPanel]      = useState(true);
  const [viewportStats,       setViewportStats]       = useState({ emps: 0, campo: 0, threatened: 0 });
  const [drawModeActive,      setDrawModeActive]      = useState(false);
  const [drawnAreaHa,         setDrawnAreaHa]         = useState<number | null>(null);
  const [drawnPoints,         setDrawnPoints]         = useState<[number, number][]>([]);
  const [compareModeActive,   setCompareModeActive]   = useState(false);

  const mapRef              = useRef<any>(null);
  const containerRef        = useRef<HTMLDivElement>(null);
  const compareContainerRef = useRef<HTMLDivElement>(null);
  const compareMapRef       = useRef<any>(null);
  const compareTileRef      = useRef<any>(null);
  const tileRef             = useRef<any>(null);
  const layersRef           = useRef<any[]>([]);
  const geoLayersRef        = useRef<Map<number, any>>(new Map());
  const campoMarkersRef     = useRef<Map<string, any[]>>(new Map());
  const bioHeatLayersRef    = useRef<any[]>([]);
  const aidZonesRef         = useRef<any[]>([]);
  const conflictLayersRef   = useRef<any[]>([]);
  const clusterLayersRef    = useRef<any[]>([]);
  const drawLayerRef        = useRef<any>(null);
  const drawPointsRef       = useRef<[number, number][]>([]);

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({ queryKey: ["/api/empreendimentos"] });
  const { data: licencas = [] }        = useQuery<LicencaAmbiental[]>({ queryKey: ["/api/licencas-ambientais"] });
  const { data: campoRaw = [], refetch: refetchCampo } = useQuery<CampoRegistro[]>({ queryKey: ["/api/campo"] });
  const { data: camadas = [], refetch: refetchCamadas } = useQuery<CamadaGeoespacial[]>({ queryKey: ["/api/camadas-geoespaciais"] });

  // ── Mutation: excluir pontos de campo em lote ────────────────────────────────
  const deleteCampoMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await apiRequest("DELETE", "/api/campo", { ids });
    },
    onSuccess: (_, ids) => {
      toast({ title: "Pontos excluídos", description: `${ids.length} registro(s) removidos.` });
      queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
      setCampoDeleteConfirm(null);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    },
  });

  const handleDeleteCampoGroup = (grupo: string) => {
    const ids = heatmapData.filter((r: any) => r.grupoTaxonomico === grupo).map((r: any) => r.id);
    if (ids.length) deleteCampoMutation.mutate(ids);
  };

  // ── Derivações ───────────────────────────────────────────────────────────────
  const licByEmp = useMemo(() => {
    const m = new Map<number, LicencaAmbiental[]>();
    for (const l of licencas) {
      if (!m.has(l.empreendimentoId)) m.set(l.empreendimentoId, []);
      m.get(l.empreendimentoId)!.push(l);
    }
    return m;
  }, [licencas]);

  const empsGeo = useMemo(() => empreendimentos.filter(e =>
    e.latitude && e.longitude &&
    Math.abs(parseFloat(e.latitude)) > 0.001 && Math.abs(parseFloat(e.longitude)) > 0.001
  ), [empreendimentos]);

  const empsFiltrados = useMemo(() => empsGeo.filter(e => {
    if (filterStatus !== "todos" && e.status?.toLowerCase() !== filterStatus) return false;
    const tl = (e.tipo || "").toLowerCase().trim().replace(/\s+/g, "_");
    if (filterTipo !== "todos" && tl !== filterTipo && e.tipo?.toLowerCase() !== filterTipo) return false;
    return true;
  }), [empsGeo, filterStatus, filterTipo]);

  const empData = useMemo(() => empsFiltrados.map(e => {
    const lat = parseFloat(e.latitude!), lng = parseFloat(e.longitude!);
    const tc  = getTipoConfig(e.tipo);
    const lics = licByEmp.get(e.id) || [];
    const comp = computeCompliance(lics);
    return { ...e, lat, lng, tc, lics, comp };
  }), [empsFiltrados, licByEmp]);

  const heatmapData = useMemo(() => {
    const out: any[] = [];
    campoRaw.forEach((r: any) => {
      const coords = parseCampoCoords(r.latitude, r.longitude, r.zonaUtm);
      if (coords) out.push({ ...r, _lat: coords[0], _lng: coords[1] });
    });
    return out;
  }, [campoRaw]);

  // ── Filtro temporal para pontos de campo ─────────────────────────────────────
  const heatmapFiltered = useMemo(() => {
    if (!campoDateFrom && !campoDateTo) return heatmapData;
    return heatmapData.filter((r: any) => {
      if (!r.data) return true;
      const d = String(r.data).slice(0, 10);
      if (campoDateFrom && d < campoDateFrom) return false;
      if (campoDateTo   && d > campoDateTo)   return false;
      return true;
    });
  }, [heatmapData, campoDateFrom, campoDateTo]);

  const campoGruposComGeo = useMemo(() => {
    const map = new Map<string, number>();
    heatmapFiltered.forEach((r: any) => {
      const g = r.grupoTaxonomico || "Sem grupo";
      map.set(g, (map.get(g) || 0) + 1);
    });
    return map;
  }, [heatmapFiltered]);

  // Auto-popular grupos visíveis na primeira carga de dados de campo
  const didAutoPopulateGroups = useRef(false);
  useEffect(() => {
    if (!didAutoPopulateGroups.current && campoGruposComGeo.size > 0) {
      didAutoPopulateGroups.current = true;
      setCampoVisibleGroups(new Set(campoGruposComGeo.keys()));
    }
  }, [campoGruposComGeo]);

  const empLogoMap = useMemo(() => {
    const m = new Map<number, string | null>();
    empreendimentos.forEach(e => m.set(e.id, e.logoUrl ?? null));
    return m;
  }, [empreendimentos]);

  const tiposUnicos = useMemo(() => {
    const s = new Set<string>();
    empsGeo.forEach(e => { if (e.tipo) s.add(e.tipo.toLowerCase().trim().replace(/\s+/g, "_")); });
    return Array.from(s);
  }, [empsGeo]);

  const arcLines = useMemo(() => {
    if (!layerArcos) return [];
    const byUnidade = empData.reduce((acc, e) => {
      if (!acc[e.unidade]) acc[e.unidade] = [];
      acc[e.unidade].push(e); return acc;
    }, {} as Record<string, typeof empData>);
    const lines: { positions: [number, number][]; color: string }[] = [];
    Object.values(byUnidade).forEach(group => {
      if (group.length < 2) return;
      const hub = group[0];
      for (let i = 1; i < group.length; i++)
        lines.push({ positions: [[hub.lat, hub.lng], [group[i].lat, group[i].lng]], color: hub.tc.color });
    });
    return lines;
  }, [empData, layerArcos]);

  const kpis = useMemo(() => ({
    total:    empsGeo.length,
    criticos: empData.filter(e => e.comp.label === "Crítico").length,
    atencao:  empData.filter(e => e.comp.label === "Atenção").length,
    regulares:empData.filter(e => e.comp.label === "Regular").length,
  }), [empsGeo, empData]);

  // ── Análise de risco ambiental (scoring avançado) ─────────────────────────
  const riskAnalysis = useMemo(() => {
    const today = new Date();
    const mk = (d: number) => { const x = new Date(today); x.setDate(x.getDate() + d); return x; };
    const in30 = mk(30), in60 = mk(60), in90 = mk(90), in180 = mk(180);

    // Haversine distance (km)
    const hav = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Previsão de vencimentos (todas as licenças)
    const forecast = { expired: 0, d30: 0, d60: 0, d90: 0, d180: 0, ok: 0 };
    licencas.forEach(l => {
      if (!l.dataVencimento) { forecast.ok++; return; }
      const d = new Date(l.dataVencimento);
      if (d < today) forecast.expired++;
      else if (d <= in30) forecast.d30++;
      else if (d <= in60) forecast.d60++;
      else if (d <= in90) forecast.d90++;
      else if (d <= in180) forecast.d180++;
      else forecast.ok++;
    });

    // Score por empreendimento (0–100)
    // Componentes:
    //   licRisk   (0–40): risco de licenças vencidas/a vencer nos próximos 90 dias
    //   typeFactor(0–30): fator de impacto intrínseco do tipo de empreendimento
    //   bioPressure(0–30): pressão de biodiversidade (registros de campo a <50 km)
    const scores = empsGeo
      .map(e => {
        const lat = parseFloat(e.latitude!), lng = parseFloat(e.longitude!);
        const tc  = getTipoConfig(e.tipo);
        const lics = licByEmp.get(e.id) || [];
        const total = lics.length || 1;
        let expired = 0, expiring = 0;
        lics.forEach(l => {
          if (!l.dataVencimento) return;
          const d = new Date(l.dataVencimento);
          if (d < today) expired++;
          else if (d < in90) expiring++;
        });
        const licRisk     = Math.min(40, ((expired * 3 + expiring * 1.5) / total) * 14);
        const typeFactor  = (tc.heightFactor / 5.5) * 30;
        const nearbyBio   = heatmapData.filter((r: any) => r._lat != null && hav(lat, lng, r._lat, r._lng) <= 50).length;
        const bioPressure = Math.min(30, nearbyBio * 2.5);
        const score       = Math.round(Math.min(100, licRisk + typeFactor + bioPressure));
        const riskLabel   = score >= 65 ? "Alto" : score >= 35 ? "Médio" : "Baixo";
        const riskColor   = score >= 65 ? "#ef4444" : score >= 35 ? "#f59e0b" : "#22c55e";
        return {
          id: e.id, nome: e.nome, municipio: e.municipio, localizacao: e.localizacao,
          lat, lng, tc, score, riskLabel, riskColor,
          licRisk: Math.round(licRisk), typeFactor: Math.round(typeFactor),
          bioPressure: Math.round(bioPressure), nearbyBio, licsTotal: lics.length,
        };
      })
      .sort((a, b) => b.score - a.score);

    const maxForecast = Math.max(1, forecast.expired + forecast.d30 + forecast.d60 + forecast.d90 + forecast.d180 + forecast.ok);
    return { scores, forecast, maxForecast };
  }, [empsGeo, licByEmp, licencas, heatmapData]);

  // ── Clustering Geográfico K-Means ─────────────────────────────────────────
  const clusterAnalysis = useMemo(() => {
    if (empsGeo.length < 3) return null;
    const k = Math.min(5, Math.max(2, Math.round(Math.sqrt(empsGeo.length / 2))));
    const dist2 = (a: {lat:number;lng:number}, b: {lat:number;lng:number}) =>
      (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;

    // K-means++ init
    let centroids: {lat:number;lng:number}[] = [{ lat: empsGeo[0].lat, lng: empsGeo[0].lng }];
    while (centroids.length < k) {
      const dists = empsGeo.map(e => Math.min(...centroids.map(c => dist2(e, c))));
      const sum = dists.reduce((a, b) => a + b, 0);
      let r = Math.random() * sum, acc = 0;
      for (let i = 0; i < empsGeo.length; i++) { acc += dists[i]; if (acc >= r) { centroids.push({ lat: empsGeo[i].lat, lng: empsGeo[i].lng }); break; } }
    }
    let assignments: number[] = new Array(empsGeo.length).fill(0);
    for (let iter = 0; iter < 30; iter++) {
      const next = empsGeo.map(e => { let mi = 0, md = Infinity; centroids.forEach((c, i) => { const d = dist2(e, c); if (d < md) { md = d; mi = i; } }); return mi; });
      if (next.every((a, i) => a === assignments[i])) break;
      assignments = next;
      centroids = centroids.map((_, i) => {
        const ms = empsGeo.filter((_, j) => assignments[j] === i);
        if (!ms.length) return centroids[i];
        return { lat: ms.reduce((s, e) => s + e.lat, 0) / ms.length, lng: ms.reduce((s, e) => s + e.lng, 0) / ms.length };
      });
    }
    const COLORS = ["#06b6d4","#f59e0b","#ec4899","#22c55e","#a855f7"];
    const clusters = centroids.map((centroid, i) => {
      const members = empsGeo.filter((_, j) => assignments[j] === i);
      const scores  = members.map(m => riskAnalysis.scores.find(s => s.id === m.id)?.score ?? 0);
      const avgRisk = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      // diameter = max dist from centroid * 2 (km)
      let maxDist = 0;
      const hav2 = (lat1:number,lng1:number,lat2:number,lng2:number) => {
        const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
        const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
        return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
      };
      members.forEach(m => { const d = hav2(centroid.lat, centroid.lng, m.lat, m.lng); if (d > maxDist) maxDist = d; });
      return { id: i, color: COLORS[i % COLORS.length], centroid, members, avgRisk,
        riskLabel: avgRisk >= 65 ? "Alto" : avgRisk >= 35 ? "Médio" : "Baixo",
        riskColor: avgRisk >= 65 ? "#ef4444" : avgRisk >= 35 ? "#f59e0b" : "#22c55e",
        radiusKm: Math.max(10, maxDist), name: `Cluster ${i + 1}` };
    }).filter(c => c.members.length > 0).sort((a, b) => b.avgRisk - a.avgRisk);
    return { clusters, k };
  }, [empsGeo, riskAnalysis.scores]);

  // ── Análise de Sobreposição Espacial (point-in-polygon) ───────────────────
  const overlapAnalysis = useMemo(() => {
    if (!camadas.length || !empsGeo.length) return [];
    const pointInRing = (pLat: number, pLng: number, ring: number[][]): boolean => {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const lngI = ring[i][0], latI = ring[i][1], lngJ = ring[j][0], latJ = ring[j][1];
        if (((latI > pLat) !== (latJ > pLat)) && (pLng < (lngJ - lngI) * (pLat - latI) / (latJ - latI) + lngI))
          inside = !inside;
      }
      return inside;
    };
    const checkFeature = (pLat: number, pLng: number, feature: any): boolean => {
      const g = feature.geometry;
      if (!g) return false;
      if (g.type === "Polygon") return pointInRing(pLat, pLng, g.coordinates[0]);
      if (g.type === "MultiPolygon") return g.coordinates.some((p: any) => pointInRing(pLat, pLng, p[0]));
      return false;
    };
    const results: Array<{emp: typeof empsGeo[0]; camada: typeof camadas[0]; featureName: string}> = [];
    camadas.filter(c => visibleGeoLayers.has(c.id) && c.geojsonData).forEach(camada => {
      const feats = (camada.geojsonData as any)?.features || [];
      empsGeo.forEach(emp => {
        feats.forEach((feat: any) => {
          if (checkFeature(emp.lat, emp.lng, feat)) {
            const p = feat.properties || {};
            results.push({ emp, camada, featureName: p.NOM_UC || p.name || p.Name || p.NOME || camada.nome });
          }
        });
      });
    });
    return results;
  }, [empsGeo, camadas, visibleGeoLayers]);

  const camadasPorCategoria = useMemo(() => {
    const m: Record<string, CamadaGeoespacial[]> = {};
    camadas.forEach(c => { if (!m[c.categoria]) m[c.categoria] = []; m[c.categoria].push(c); });
    return m;
  }, [camadas]);

  // Detecta se alguma camada ativa tem dados de bioma (para exibir legenda)
  const hasBiomeLayers = useMemo(() => {
    return Array.from(visibleGeoLayers).some(id => {
      const c = camadas.find(x => x.id === id);
      if (!c?.geojsonData) return false;
      const features = (c.geojsonData as any).features || [];
      return features.some((f: any) => {
        const p = f.properties || {};
        return p.nom_bioma || p.ds_bioma || p.bioma || p.BIOMA || p.NOM_BIOMA;
      });
    });
  }, [camadas, visibleGeoLayers]);

  // ── Inicializar mapa ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    import("leaflet").then(L => {
      if (!containerRef.current || mapRef.current) return;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      const map = L.map(containerRef.current, {
        center: [-15.7942, -47.8922], zoom: 5, zoomControl: false, attributionControl: true,
      });
      const tile = L.tileLayer(TILE_LAYERS.satellite.url, { attribution: TILE_LAYERS.satellite.attr, maxZoom: 19 });
      tile.addTo(map);
      tileRef.current = tile; mapRef.current = map;
      L.control.zoom({ position: "topright" }).addTo(map);
      L.control.scale({ imperial: false, position: "bottomright", maxWidth: 160 }).addTo(map);
      const updateCenter = () => {
        const c = map.getCenter();
        setMapCenter({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
      };
      map.on("moveend zoomend", updateCenter);
      updateCenter();
      setMapReady(true);
    });
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; setMapReady(false); } };
  }, []);

  // ── Auto-fit: centraliza o mapa nos empreendimentos na primeira carga ─────────
  const didAutoFit = useRef(false);
  useEffect(() => {
    if (!mapReady || !mapRef.current || didAutoFit.current) return;
    const empPts = empData.map(e => [e.lat, e.lng] as [number, number]);
    const campoPts = heatmapFiltered
      .map((r: any) => [r._lat, r._lng] as [number, number])
      .filter(([la, ln]) => la != null && ln != null && !isNaN(la) && !isNaN(ln));
    const allPts = [...empPts, ...campoPts];
    if (allPts.length === 0) return;
    // Aguarda ambos os datasets terminarem de carregar para um único enquadramento ideal
    const empLoaded   = empreendimentos.length > 0 ? empPts.length > 0   : true;
    const campoLoaded = campoRaw.length > 0       ? campoPts.length > 0 : true;
    if (!empLoaded || !campoLoaded) return;
    didAutoFit.current = true;
    import("leaflet").then(L => {
      if (!mapRef.current) return;
      if (allPts.length === 1) {
        mapRef.current.flyTo(allPts[0], 13, { duration: 1.2 });
      } else {
        const bounds = L.latLngBounds(allPts);
        if (bounds.isValid()) mapRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 13, duration: 1.5 });
      }
    });
  }, [mapReady, empData, heatmapFiltered, empreendimentos.length, campoRaw.length]);

  // ── Trocar tile (com crossfade) ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    import("leaflet").then(L => {
      if (!mapRef.current) return;
      const cfg = TILE_LAYERS[mapStyle];
      const isFirst = prevMapStyleRef.current === null;
      prevMapStyleRef.current = mapStyle;

      if (isFirst) {
        // Primeiro carregamento: substituição direta
        if (tileRef.current) mapRef.current.removeLayer(tileRef.current);
        tileRef.current = L.tileLayer(cfg.url, {
          attribution: cfg.attr,
          ...(cfg.noSubdomains ? { subdomains: [] as any } : {}),
          maxZoom: 19,
        });
        tileRef.current.addTo(mapRef.current);
        return;
      }

      // Troca de estilo: fade cruzado — novo tile entra com opacidade 0, sobe para 1
      const oldTile = tileRef.current;
      const newTile = L.tileLayer(cfg.url, {
        attribution: cfg.attr,
        opacity: 0,
        ...(cfg.noSubdomains ? { subdomains: [] as any } : {}),
        maxZoom: 19,
      });
      newTile.addTo(mapRef.current);
      tileRef.current = newTile;
      // Duplo RAF garante que o browser registrou o estado inicial antes de transicionar
      requestAnimationFrame(() => requestAnimationFrame(() => {
        newTile.setOpacity(1);
        setTimeout(() => {
          if (oldTile && mapRef.current) mapRef.current.removeLayer(oldTile);
        }, 650);
      }));
    });
  }, [mapStyle, mapReady]);

  // ── Layers de dados (zonas, heatmap, markers, arcos) ─────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    import("leaflet").then(L => {
      if (!mapRef.current) return;
      layersRef.current.forEach(ly => { try { mapRef.current.removeLayer(ly); } catch (_) {} });
      layersRef.current = [];

      // Helper: fade-in de elemento SVG (path/polyline/circle)
      const fadeInEl = (el: HTMLElement | SVGElement | null, delayMs = 0) => {
        if (!el) return;
        const e = el as HTMLElement;
        e.style.transition = "";
        e.style.opacity = "0";
        setTimeout(() => {
          e.style.transition = "opacity 0.5s ease";
          e.style.opacity = "1";
        }, delayMs + 16);
      };

      arcLines.forEach((line, li) => {
        const pl = L.polyline(line.positions, { color: line.color, weight: 1.5, opacity: 0.5, dashArray: "4 4" });
        pl.addTo(mapRef.current); layersRef.current.push(pl);
        fadeInEl((pl as any)._path, li * 15);
      });

      if (layerZonas) empData.forEach((e, zi) => {
        const c = L.circle([e.lat, e.lng], {
          radius: e.tc.radiusKm * 1000 * raioMulti,
          color: e.tc.color, fillColor: e.tc.color,
          fillOpacity: 0.06, weight: 1, opacity: 0.35, dashArray: "5 5",
        });
        c.addTo(mapRef.current); layersRef.current.push(c);
        fadeInEl((c as any)._path, zi * 20);
      });

      // Heatmap removido — pontos de campo agora são renderizados como marcadores individuais

      empData.forEach((e, empIdx) => {
        const haloPulse = L.circleMarker([e.lat, e.lng], {
          radius: 26, color: "#fbbf24", weight: 2.5, opacity: 1,
          fillColor: "#fbbf24", fillOpacity: 0.12,
        });
        haloPulse.addTo(mapRef.current); layersRef.current.push(haloPulse);
        haloPulse.on("click", () => { setSelectedEmp(e); setInfoPanelOpen(true); });

        const logoUrl = empLogoMap.get(e.id) ?? null;
        const ICO_S = 32;
        const innerIcoContent = logoUrl
          ? `<img src="${logoUrl}" alt="" style="width:${ICO_S - 6}px;height:${ICO_S - 6}px;border-radius:50%;object-fit:cover;display:block;" />`
          : `<span style="font-size:${Math.round(ICO_S * 0.55)}px;line-height:1;display:inline-block;">${e.tc.icon}</span>`;
        const bigIconHtml = `<div style="
            position:relative;width:${ICO_S}px;height:${ICO_S}px;
            display:flex;align-items:center;justify-content:center;
            border-radius:50%;background:#ffffff;
            border:2.5px solid ${e.comp.color};
            box-shadow:0 3px 10px rgba(0,0,0,0.5),0 0 0 2px rgba(251,191,36,0.6);
            overflow:hidden;
          ">${innerIcoContent}</div>`;
        const icon = L.divIcon({
          html: bigIconHtml,
          iconSize: [ICO_S, ICO_S],
          iconAnchor: [ICO_S / 2, ICO_S / 2],
          className: "emp-big-icon",
        });
        const marker = L.marker([e.lat, e.lng], { icon, zIndexOffset: 9999 });
        const logoHtml = logoUrl
          ? `<img src="${logoUrl}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid ${e.comp.color};flex-shrink:0;" />`
          : `<div style="width:32px;height:32px;border-radius:50%;background:${e.comp.color};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${e.tc.icon}</div>`;
        marker.bindPopup(`
          <div style="min-width:210px;font-family:Inter,sans-serif;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              ${logoHtml}
              <div>
                <div style="font-weight:700;font-size:12px;line-height:1.3;">${e.nome}</div>
                <div style="font-size:10px;color:#64748b;">${e.tc.icon} ${e.tc.label}</div>
              </div>
            </div>
            <div style="font-size:11px;color:#64748b;margin-bottom:3px;">📍 ${e.municipio || e.localizacao || "—"}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:3px;">📋 ${e.lics.length} licença(s)</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
              <div style="width:8px;height:8px;border-radius:50%;background:${e.comp.color};"></div>
              <span style="font-size:11px;font-weight:600;">${e.comp.label}</span>
            </div>
          </div>`);
        marker.on("click", () => { setSelectedEmp(e); setInfoPanelOpen(true); });
        marker.addTo(mapRef.current); layersRef.current.push(marker);
        marker.bindTooltip(`<b>${e.nome}</b>`, {
          permanent: true, direction: "top", offset: [0, -32],
          className: "emp-permanent-tooltip", opacity: 1,
        }).openTooltip();
        const iconEl = (marker as any)._icon as HTMLElement | null;
        if (iconEl) {
          iconEl.style.opacity = "1";
          iconEl.style.zIndex = "1000";
          iconEl.style.pointerEvents = "auto";
        }
      });
    });
  }, [mapReady, empData, heatmapData, arcLines, layerZonas, layerMarkers, layerHeatmap, raioMulti, markerMulti, empLogoMap, mapLayerKey]);

  // ── Camadas geoespaciais (GeoJSON) ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    import("leaflet").then(L => {
      if (cancelled || !mapRef.current) return;

      camadas.forEach(camada => {
        const existing = geoLayersRef.current.get(camada.id);
        const shouldShow = visibleGeoLayers.has(camada.id);

        if (shouldShow && !existing && camada.geojsonData) {
          const cor = camada.cor || "#3b82f6";
          const opac = camada.opacidade || 0.35;
          const camadaId = camada.id;
          const camadaRef = camada; // snapshot for closure

          const buildPopupHtml = (props: Record<string, any>): string => {
            try {
              const nome = props.NOM_UC || props.nom_bioma || props.name || props.Name || props.NOME || props.NOMEAR || props.nomear || camadaRef.nome || "—";
              const catCfg = CATEGORIA_CONFIG[camadaRef.categoria] || CATEGORIA_CONFIG["outro"] || { icon: "📍", label: camadaRef.categoria, color: "#6b7280" };
              const selectedAttrs = layerAttrConfigRef.current[camadaId];
              const allEntries = Object.entries(props).filter(([k, v]) => k !== "" && v !== null && v !== undefined && String(v).trim() !== "");
              const visibleEntries = selectedAttrs === undefined
                ? allEntries
                : allEntries.filter(([k]) => selectedAttrs.includes(k));
              const rows = visibleEntries.map(([k, v]) =>
                `<tr>
                  <td style="padding:3px 10px 3px 0;font-weight:600;color:#64748b;white-space:nowrap;vertical-align:top;font-size:11px;">${String(k)}</td>
                  <td style="padding:3px 0;font-size:11px;word-break:break-word;max-width:180px;">${String(v ?? "—").substring(0, 200)}</td>
                </tr>`).join("");
              return `<div style="min-width:240px;max-width:360px;font-family:Inter,sans-serif;overflow:auto;max-height:380px;">
                <div style="font-weight:700;font-size:13px;margin-bottom:2px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;color:#1e293b;">
                  ${catCfg.icon || "📍"} ${nome}
                </div>
                <div style="font-size:10px;color:#94a3b8;margin-bottom:8px;">${catCfg.label || ""}${camadaRef.fonte ? ` · ${camadaRef.fonte}` : ""}${camadaRef.ano ? ` (${camadaRef.ano})` : ""}</div>
                ${rows
                  ? `<table style="width:100%;border-collapse:collapse;">${rows}</table>`
                  : `<p style="font-size:11px;color:#94a3b8;margin:0;">Sem atributos disponíveis.</p>`}
                ${allEntries.length > 0 ? `<div style="margin-top:6px;font-size:9px;color:#cbd5e1;">${allEntries.length} atributo(s) · ${visibleEntries.length} exibido(s)</div>` : ""}
              </div>`;
            } catch (err) {
              return `<div style="font-family:Inter,sans-serif;padding:8px;min-width:200px;">
                <strong style="font-size:12px;">${camadaRef.nome}</strong>
                <p style="font-size:11px;color:#64748b;margin-top:4px;">Categoria: ${camadaRef.categoria}</p>
              </div>`;
            }
          };

          // Per-feature biome color detection
          const getBiomeColor = (props: any): string => {
            const raw = props.nom_bioma || props.ds_bioma || props.ds_sintese ||
                        props.bioma || props.BIOMA || props.NOM_BIOMA || "";
            const n = raw.toLowerCase();
            if (n.includes("amaz"))    return "#1a7f5a"; // Amazônia — verde floresta
            if (n.includes("cerrad"))  return "#d4a017"; // Cerrado — dourado
            if (n.includes("atl"))     return "#2d9b4e"; // Mata Atlântica — verde médio
            if (n.includes("caating")) return "#e07b39"; // Caatinga — laranja
            if (n.includes("pantanal"))return "#1565c0"; // Pantanal — azul
            if (n.includes("pampa"))   return "#95d5b2"; // Pampa — verde claro
            return "";
          };

          const getFeatureStyle = (feature: any) => {
            const p = feature?.properties || {};
            const biomeColor = getBiomeColor(p);
            const fc = biomeColor || cor;
            return { color: fc, weight: 2, opacity: 0.9, fillOpacity: opac, fillColor: fc };
          };

          const geojsonLayer = L.geoJSON(camada.geojsonData, {
            style: (feature) => getFeatureStyle(feature),
            onEachFeature: (feature, layer) => {
              const props = feature.properties || {};
              const nome = props.NOM_UC || props.nom_bioma || props.name || props.Name || props.NOME || camadaRef.nome;
              // Tooltip leve ao passar o mouse
              layer.bindTooltip(`<strong>${nome}</strong>`, { sticky: true, direction: "top", offset: [0, -8] });

              // Popup com atributos ao clicar — string direta (mais confiável que callback)
              const popupContent = buildPopupHtml(props);
              layer.bindPopup(popupContent, { maxWidth: 380, autoPan: true });

              const baseStyle = getFeatureStyle(feature);
              layer.on("mouseover", function() {
                if ((layer as any).setStyle) (layer as any).setStyle({
                  weight: 3, fillOpacity: Math.min(0.75, opac + 0.2),
                  color: baseStyle.color, fillColor: baseStyle.fillColor,
                });
              });
              layer.on("mouseout", function() {
                if ((layer as any).setStyle) (layer as any).setStyle(baseStyle);
              });
            },
          }).addTo(mapRef.current);
          geoLayersRef.current.set(camada.id, geojsonLayer);

          // Fade-in escalonado por feição
          setTimeout(() => {
            let si = 0;
            geojsonLayer.eachLayer((sub: any) => {
              const el = sub._path as HTMLElement | null;
              if (el) {
                el.style.transition = "";
                el.style.opacity = "0";
                const delay = si * 3 + 16;
                setTimeout(() => {
                  el.style.transition = "opacity 0.55s ease";
                  el.style.opacity = "1";
                }, delay);
              }
              si++;
            });
          }, 32);
        } else if (!shouldShow && existing) {
          existing.remove();
          geoLayersRef.current.delete(camada.id);
        }
      });
    });
    return () => { cancelled = true; };
  }, [mapReady, camadas, visibleGeoLayers]);

  // ── Pontos de Monitoramento de Campo ─────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    import("leaflet").then(L => {
      if (cancelled || !mapRef.current) return;

      // Remove TODOS os marcadores anteriores e limpa o ref
      campoMarkersRef.current.forEach(markers => {
        markers.forEach(m => { try { mapRef.current!.removeLayer(m); } catch (_) {} });
      });
      campoMarkersRef.current.clear();

      // SEMPRE plota TODOS os grupos com coordenadas válidas (ignora toggle de visibilidade)
      const todosGrupos = new Set<string>();
      heatmapFiltered.forEach((r: any) => {
        const lat = r._lat; const lng = r._lng;
        if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
          todosGrupos.add(r.grupoTaxonomico || "Sem grupo");
        }
      });
      todosGrupos.forEach(grupo => {
        const cfg = getCampoGrupoConfig(grupo);
        const registros = heatmapFiltered.filter((r: any) => (r.grupoTaxonomico || "Sem grupo") === grupo);
        const markers: any[] = [];

        registros.forEach((r: any) => {
          const lat: number = r._lat;
          const lng: number = r._lng;
          if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;

          const logoUrl: string | null = r.empreendimentoId
            ? (empLogoMap.get(r.empreendimentoId) ?? null)
            : null;

          const S = 34;
          const innerContent = logoUrl
            ? `<img src="${logoUrl}" alt="" style="width:${S - 8}px;height:${S - 8}px;border-radius:50%;object-fit:cover;" />`
            : `<span style="font-size:${Math.round(S * 0.42)}px;line-height:1;">${cfg.icon}</span>`;

          const iconHtml = `<div style="position:relative;width:${S}px;height:${S}px;">
              <div style="position:absolute;inset:0;border-radius:50%;background:rgba(255,255,255,0.15);box-shadow:0 0 0 6px rgba(255,255,255,0.1);"></div>
              <div style="position:absolute;inset:0;border-radius:50%;background:${cfg.color};border:2.5px solid rgba(255,255,255,0.8);box-shadow:0 2px 10px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;overflow:hidden;">${innerContent}</div>
            </div>`;

          const icon = L.divIcon({ html: iconHtml, iconSize: [S, S], iconAnchor: [S / 2, S / 2], className: "" });

          const popupHtml = `
            <div style="font-family:Inter,sans-serif;min-width:190px;max-width:250px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">
                ${logoUrl
                  ? `<img src="${logoUrl}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid ${cfg.color};" />`
                  : `<span style="font-size:20px;">${cfg.icon}</span>`}
                <div>
                  <div style="font-weight:700;font-size:12px;color:${cfg.color};">${cfg.label}</div>
                  ${r.nomeCientifico ? `<div style="font-size:10px;font-style:italic;color:#64748b;">${r.nomeCientifico}</div>` : ""}
                </div>
              </div>
              ${r.nomeComum ? `<div style="font-size:11px;margin-bottom:3px;color:#374151;">📋 Nome comum: <strong>${r.nomeComum}</strong></div>` : ""}
              ${r.abundancia ? `<div style="font-size:11px;color:#374151;margin-bottom:3px;">🔢 Abundância: <strong>${r.abundancia}</strong></div>` : ""}
              ${r.localColeta ? `<div style="font-size:11px;color:#374151;margin-bottom:3px;">📍 ${r.localColeta}</div>` : ""}
              ${r.dataColeta ? `<div style="font-size:11px;color:#374151;margin-bottom:3px;">📅 ${r.dataColeta}</div>` : ""}
              ${r.observacoes ? `<div style="font-size:10px;color:#6b7280;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:4px;">${r.observacoes.substring(0,120)}${r.observacoes.length > 120 ? "…" : ""}</div>` : ""}
              <div style="font-size:10px;color:#9ca3af;margin-top:4px;margin-bottom:8px;">🌐 ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
              <a href="/campo" onclick="event.preventDefault();window.location.href='/campo?highlight=${r.id}';"
                style="display:block;text-align:center;background:${cfg.color};color:#fff;border:none;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;text-decoration:none;">
                🔍 Ver registro
              </a>
            </div>`;

          // SVG circleMarker — garantido visível, independente de CSS/animação
          const dot = L.circleMarker([lat, lng], {
            radius: 7, color: "#ffffff", weight: 2, opacity: 1,
            fillColor: cfg.color, fillOpacity: 1, pane: "markerPane",
          });
          dot.bindPopup(popupHtml, { maxWidth: 270, closeButton: true });
          dot.on("mouseover", function() { (dot as any).openPopup(); });
          dot.addTo(mapRef.current!);
          markers.push(dot);

          const m = L.marker([lat, lng], { icon, zIndexOffset: 500 });
          m.bindPopup(popupHtml, { maxWidth: 270, closeButton: true });
          m.on("mouseover", function() { (m as any).openPopup(); });
          m.addTo(mapRef.current!);
          markers.push(m);
          const mIconEl = (m as any)._icon as HTMLElement | null;
          if (mIconEl) {
            mIconEl.style.opacity = "1";
            mIconEl.style.zIndex = "500";
          }
        });

        if (markers.length > 0) campoMarkersRef.current.set(grupo, markers);
      });
    });
    return () => { cancelled = true; };
  }, [mapReady, heatmapFiltered, empLogoMap]);

  // ── MapBiomas: check auth status on mount ────────────────────────────────────
  useEffect(() => {
    fetch("/api/mapbiomas/status").then(r => r.json()).then(d => {
      setMbAuthenticated(d.authenticated);
    }).catch(() => {});
  }, []);

  // ── MapBiomas: fetch alerts when enabled ──────────────────────────────────────
  useEffect(() => {
    if (!mbEnabled || !mbAuthenticated) return;
    setMbLoading(true); setMbError(null);
    // Compute bbox from all empreendimentos with coords
    const geoEmps = empsGeo;
    let bboxParam = "";
    if (geoEmps.length > 0) {
      const lats = geoEmps.map(e => parseFloat(e.latitude!));
      const lngs = geoEmps.map(e => parseFloat(e.longitude!));
      const minLat = Math.min(...lats) - 1;
      const maxLat = Math.max(...lats) + 1;
      const minLng = Math.min(...lngs) - 1;
      const maxLng = Math.max(...lngs) + 1;
      bboxParam = `${minLng},${minLat},${maxLng},${maxLat}`;
    }
    const params = new URLSearchParams({
      sources: mbSources, startDate: mbStartDate, endDate: mbEndDate, limit: "300",
      ...(bboxParam ? { bbox: bboxParam } : {}),
    });
    fetch(`/api/mapbiomas/alerts?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setMbError(data.error); if (data.error.includes("login")) setMbAuthenticated(false); }
        else { setMbAlerts(data.collection || []); setMbSummary(data.summary || null); }
      })
      .catch(err => setMbError(err.message))
      .finally(() => setMbLoading(false));
  }, [mbEnabled, mbAuthenticated, mbSources, mbStartDate, mbEndDate, empsGeo]);

  // ── MapBiomas: render alert markers on map ────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    mbMarkersRef.current.forEach(m => { try { mapRef.current.removeLayer(m); } catch (_) {} });
    mbMarkersRef.current = [];
    if (!mbEnabled || !mbAlerts.length) return;
    import("leaflet").then(L => {
      if (!mapRef.current) return;
      mbAlerts.forEach(alert => {
        const lat = alert.boundingBox ? (alert.boundingBox.minY + alert.boundingBox.maxY) / 2 : null;
        const lng = alert.boundingBox ? (alert.boundingBox.minX + alert.boundingBox.maxX) / 2 : null;
        if (!lat || !lng) return;
        const area = (alert.areaHa || 0).toFixed(1);
        const sources = (alert.sources || []).join(", ");
        const biomes = (alert.crossedBiomes || []).join(", ") || "—";
        const cities = (alert.crossedCities || []).slice(0, 2).join(", ") || "—";
        const classes = (alert.deforestationClasses || []).join(", ") || "—";
        const detectedAt = alert.detectedAt ? new Date(alert.detectedAt).toLocaleDateString("pt-BR") : "—";
        const color = "#f97316";
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.8);display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 2px 6px rgba(0,0,0,0.5);">🪓</div>`,
          iconSize: [20, 20], iconAnchor: [10, 10],
        });
        const marker = L.marker([lat, lng], { icon });
        marker.bindPopup(`
          <div style="min-width:220px;font-family:Inter,sans-serif;">
            <div style="font-weight:700;font-size:13px;margin-bottom:6px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">
              🪓 Alerta MapBiomas #${alert.alertCode}
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
              <tr><td style="padding:2px 8px 2px 0;color:#64748b;font-weight:600;">Área</td><td>${area} ha</td></tr>
              <tr><td style="padding:2px 8px 2px 0;color:#64748b;font-weight:600;">Detectado</td><td>${detectedAt}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;color:#64748b;font-weight:600;">Fonte</td><td>${sources}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;color:#64748b;font-weight:600;">Bioma</td><td>${biomes}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;color:#64748b;font-weight:600;">Município</td><td>${cities}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;color:#64748b;font-weight:600;">Classe</td><td>${classes}</td></tr>
            </table>
            <div style="margin-top:6px;font-size:9px;color:#94a3b8;">
              <a href="https://plataforma.alerta.mapbiomas.org/alertas/${alert.alertCode}" target="_blank"
                style="color:#f97316;text-decoration:underline;">Ver no MapBiomas ↗</a>
            </div>
          </div>`);
        marker.addTo(mapRef.current);
        mbMarkersRef.current.push(marker);
      });
    });
  }, [mapReady, mbEnabled, mbAlerts]);

  // ── MapBiomas: polígonos reais de desmatamento ───────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    // Limpa camada anterior
    mbPolygonsRef.current.forEach(l => { try { mapRef.current.removeLayer(l); } catch (_) {} });
    mbPolygonsRef.current = [];

    if (!mbEnabled || !mbAuthenticated || !mbShowPolygons) return;

    // Monta bbox a partir dos empreendimentos
    let bboxParam = "";
    if (empsGeo.length > 0) {
      const lats = empsGeo.map(e => parseFloat(e.latitude!)).filter(n => !isNaN(n));
      const lngs = empsGeo.map(e => parseFloat(e.longitude!)).filter(n => !isNaN(n));
      if (lats.length) {
        const minLat = Math.min(...lats) - 1, maxLat = Math.max(...lats) + 1;
        const minLng = Math.min(...lngs) - 1, maxLng = Math.max(...lngs) + 1;
        bboxParam = `&bbox=${minLng},${minLat},${maxLng},${maxLat}`;
      }
    }

    const params = new URLSearchParams({
      sources: mbSources,
      startDate: mbStartDate,
      endDate: mbEndDate,
      limit: "30",
    });
    if (bboxParam) params.set("bbox", bboxParam.replace("&bbox=", ""));

    setMbPolygonsLoading(true);

    fetch(`/api/mapbiomas/alerts-geojson?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then((fc: any) => {
        if (!mapRef.current) return;
        if (!fc || !fc.features) {
          console.warn("[MapBiomas polygons] resposta sem features:", fc);
          return;
        }

        import("leaflet").then(L => {
          if (!mapRef.current) return;

          fc.features.forEach((feature: any) => {
            const p = feature.properties || {};
            const area = (p.areaHa || 0).toFixed(1);
            const detectedAt = p.detectedAt ? new Date(p.detectedAt).toLocaleDateString("pt-BR") : "—";
            const biomes   = p.crossedBiomes  || "—";
            const cities   = p.crossedCities  || "—";
            const states   = p.crossedStates  || "—";
            const classes  = p.deforestationClasses || "—";
            const sources  = p.sources || "—";
            const inTI  = p.crossedIndigenousLands
              ? `<tr><td style="padding:2px 8px 2px 0;color:#dc2626;font-weight:600;">🏠 Terra Indígena</td><td>${p.crossedIndigenousLands}</td></tr>` : "";
            const inUC  = p.crossedConservationUnits
              ? `<tr><td style="padding:2px 8px 2px 0;color:#dc2626;font-weight:600;">🌲 Unid. Conservação</td><td>${p.crossedConservationUnits}</td></tr>` : "";
            const inPPA = p.crossedPpa
              ? `<tr><td style="padding:2px 8px 2px 0;color:#dc2626;font-weight:600;">💧 APP</td><td>${p.crossedPpa} ha</td></tr>` : "";
            const speed = p.deforestationSpeed
              ? `<tr><td style="padding:2px 8px 2px 0;color:#64748b;font-weight:600;">⚡ Velocidade</td><td>${p.deforestationSpeed}</td></tr>` : "";

            const popupHtml = `
              <div style="min-width:260px;max-width:340px;font-family:Inter,sans-serif;">
                <div style="background:#dc2626;color:#fff;padding:8px 10px;margin:-8px -12px 8px;border-radius:6px 6px 0 0;">
                  <div style="font-weight:700;font-size:13px;">🪓 Alerta #${p.alertCode} — ${area} ha</div>
                  <div style="font-size:10px;opacity:0.85;margin-top:2px;">Detectado: ${detectedAt} · ${sources}</div>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:11px;">
                  <tr><td style="padding:3px 8px 3px 0;color:#64748b;font-weight:600;">Bioma</td><td>${biomes}</td></tr>
                  <tr><td style="padding:3px 8px 3px 0;color:#64748b;font-weight:600;">Municípios</td><td>${cities}</td></tr>
                  <tr><td style="padding:3px 8px 3px 0;color:#64748b;font-weight:600;">Estado(s)</td><td>${states}</td></tr>
                  <tr><td style="padding:3px 8px 3px 0;color:#64748b;font-weight:600;">Classe</td><td>${classes}</td></tr>
                  ${speed}${inTI}${inUC}${inPPA}
                </table>
                <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;display:flex;gap:10px;font-size:10px;">
                  <a href="https://plataforma.alerta.mapbiomas.org/alertas/${p.alertCode}" target="_blank"
                     style="color:#dc2626;text-decoration:none;font-weight:600;">Ver laudo completo ↗</a>
                  <a href="https://plataforma.alerta.mapbiomas.org" target="_blank"
                     style="color:#64748b;text-decoration:none;">MapBiomas Alerta ↗</a>
                </div>
              </div>`;

            const geoLayer = L.geoJSON(feature, {
              style: () => ({
                color: "#dc2626",
                weight: 1.5,
                opacity: 0.9,
                fillColor: "#ef4444",
                fillOpacity: 0.25,
                dashArray: "4 2",
              }),
              pointToLayer: (_feat: any, latlng: any) =>
                L.circleMarker(latlng, {
                  radius: 8, color: "#dc2626", weight: 2,
                  fillColor: "#ef4444", fillOpacity: 0.7,
                }),
              onEachFeature: (_f: any, layer: any) => {
                layer.bindPopup(popupHtml, { maxWidth: 380, autoPan: true });
                layer.bindTooltip(`🪓 #${p.alertCode} — ${area} ha`, {
                  sticky: true, direction: "top", offset: [0, -6],
                });
              },
            });

            geoLayer.addTo(mapRef.current);
            mbPolygonsRef.current.push(geoLayer);
          });

          setMbPolygonCount(fc.features.length);
        });
      })
      .catch(err => console.error("[MapBiomas polygons]", err))
      .finally(() => setMbPolygonsLoading(false));

  }, [mapReady, mbEnabled, mbAuthenticated, mbShowPolygons, mbSources, mbStartDate, mbEndDate, empsGeo]);

  // ── Cluster circles no mapa ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    clusterLayersRef.current.forEach(l => l.remove());
    clusterLayersRef.current = [];
    if (!clusterAnalysis) return;
    import("leaflet").then(L => {
      if (!mapRef.current) return;
      clusterAnalysis.clusters.forEach(cl => {
        const circle = L.circle([cl.centroid.lat, cl.centroid.lng], {
          radius: cl.radiusKm * 1000,
          color: cl.color, weight: 1.5, opacity: 0.6,
          fillColor: cl.color, fillOpacity: 0.06, dashArray: "6 4",
        }).addTo(mapRef.current);
        const centMark = L.circleMarker([cl.centroid.lat, cl.centroid.lng], {
          radius: 6, color: cl.color, weight: 2, fillColor: cl.color, fillOpacity: 0.9,
        }).bindTooltip(
          `<strong>${cl.name}</strong><br/>${cl.members.length} empreend. · IRA médio: ${cl.avgRisk}`,
          { direction: "top" }
        ).addTo(mapRef.current);
        clusterLayersRef.current.push(circle, centMark);
      });
    });
  }, [mapReady, clusterAnalysis]);

  // ── Heatmap de Biodiversidade (polígonos de densidade com gradiente) ──────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    bioHeatLayersRef.current.forEach(l => { try { mapRef.current!.removeLayer(l); } catch (_) {} });
    bioHeatLayersRef.current = [];
    if (!layerBioHeatmap) return;
    import("leaflet").then(L => {
      if (!mapRef.current) return;

      const all = heatmapFiltered.filter((r: any) => r._lat != null && r._lng != null);
      if (!all.length) return;

      // Determinar resolução da grade conforme zoom
      const zoom = mapRef.current.getZoom() ?? 5;
      const cellDeg = zoom >= 11 ? 0.02 : zoom >= 8 ? 0.05 : zoom >= 6 ? 0.1 : 0.2;

      // Agrupar pontos em células da grade
      const cells = new Map<string, { lat: number; lng: number; count: number; groups: Set<string> }>();
      all.forEach((r: any) => {
        const latCell = Math.round(r._lat / cellDeg) * cellDeg;
        const lngCell = Math.round(r._lng / cellDeg) * cellDeg;
        const key = `${latCell.toFixed(4)},${lngCell.toFixed(4)}`;
        if (!cells.has(key)) cells.set(key, { lat: latCell, lng: lngCell, count: 0, groups: new Set() });
        const cell = cells.get(key)!;
        cell.count++;
        if (r.grupoTaxonomico) cell.groups.add(r.grupoTaxonomico);
      });

      const maxCount = Math.max(1, ...Array.from(cells.values()).map(c => c.count));

      // Raio base em metros proporcional ao zoom
      const baseRadiusM = zoom >= 11 ? 1500 : zoom >= 8 ? 5000 : zoom >= 6 ? 14000 : 35000;

      // Renderizar do menor para o maior (maior por cima)
      const sorted = Array.from(cells.values()).sort((a, b) => a.count - b.count);

      sorted.forEach((cell, ci) => {
        const intensity = cell.count / maxCount; // 0..1

        // Gradiente HSL: verde(120°) → amarelo(60°) → vermelho(0°)
        const hue = Math.round(120 - intensity * 120);
        const sat = 80 + intensity * 15;
        const lgt = 48 - intensity * 10;
        const fillColor = `hsl(${hue},${sat}%,${lgt}%)`;
        const fillOpacity = 0.18 + intensity * 0.45;

        const radius = baseRadiusM * (0.6 + intensity * 1.4);

        const circle = L.circle([cell.lat, cell.lng], {
          radius,
          fillColor,
          fillOpacity,
          color: fillColor,
          weight: intensity > 0.6 ? 0.8 : 0,
          opacity: 0.5,
        });

        const grupos = Array.from(cell.groups).slice(0, 5).join(", ") || "—";
        circle.bindPopup(`
          <div style="font-family:Inter,sans-serif;min-width:170px;">
            <div style="font-weight:700;font-size:12px;margin-bottom:5px;color:${fillColor};">
              🌿 Área de densidade
            </div>
            <div style="font-size:11px;color:#374151;margin-bottom:3px;">
              Registros: <strong>${cell.count}</strong>
            </div>
            <div style="font-size:11px;color:#374151;margin-bottom:3px;">
              Intensidade: <strong>${(intensity * 100).toFixed(0)}%</strong>
            </div>
            <div style="font-size:10px;color:#6b7280;">Grupos: ${grupos}</div>
            <div style="margin-top:6px;height:8px;border-radius:4px;background:linear-gradient(90deg,#22c55e,#f59e0b,#ef4444);">
              <div style="width:4px;height:8px;background:#fff;border-radius:2px;margin-left:${(intensity*100).toFixed(0)}%;transform:translateX(-50%);box-shadow:0 0 3px rgba(0,0,0,0.5);"></div>
            </div>
          </div>`);

        circle.addTo(mapRef.current!);
        bioHeatLayersRef.current.push(circle);

        // Fade-in escalonado
        const cPath = (circle as any)._path as HTMLElement | null;
        if (cPath) {
          cPath.style.opacity = "0";
          setTimeout(() => {
            cPath.style.transition = "opacity 0.6s ease";
            cPath.style.opacity = "1";
          }, ci * 6 + 16);
        }
      });
    });
  }, [mapReady, layerBioHeatmap, heatmapFiltered]);

  // ── Sincroniza camadas ADA/AID/AII com o toggle ──────────────────────────────
  useEffect(() => {
    const aidCats = new Set(["zona_ada", "zona_aid", "zona_aii"]);
    const aidIds = camadas.filter(c => aidCats.has(c.categoria)).map(c => c.id);
    if (!aidIds.length) return;
    setVisibleGeoLayers(prev => {
      const s = new Set(prev);
      if (layerAidConcentrico) { aidIds.forEach(id => s.add(id)); }
      else                     { aidIds.forEach(id => s.delete(id)); }
      return s;
    });
  }, [layerAidConcentrico, camadas]);

  // ── Zonas ADA / AID / AII por empreendimento ─────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    aidZonesRef.current.forEach(l => { try { mapRef.current.removeLayer(l); } catch (_) {} });
    aidZonesRef.current = [];
    if (!layerAidConcentrico) return;
    // Se existem camadas reais (KMZ/SHP) de ADA/AID/AII, não exibe os círculos gerados
    const aidCats = new Set(["zona_ada", "zona_aid", "zona_aii"]);
    if (camadas.some(c => aidCats.has(c.categoria))) return;
    import("leaflet").then(L => {
      if (!mapRef.current) return;
      empData.forEach((e, ei) => {
        const base = e.tc.radiusKm * 1000 * raioMulti;
        const baseDelay = ei * 45;

        const ada = L.circle([e.lat, e.lng], { radius: base * 0.25, color: "#ef4444", weight: 2, opacity: 0.8, fillColor: "#ef4444", fillOpacity: 0.12 });
        ada.bindTooltip(`ADA – ${e.nome}<br/><small>Área Diretamente Afetada · r=${(base*0.00025).toFixed(1)} km</small>`, { direction:"top" });
        ada.addTo(mapRef.current); aidZonesRef.current.push(ada);
        const adaPath = (ada as any)._path as HTMLElement | null;
        if (adaPath) { adaPath.style.opacity = "0"; adaPath.style.transition = ""; setTimeout(() => { adaPath.style.transition = "opacity 0.5s ease"; adaPath.style.opacity = "1"; }, baseDelay + 16); }

        const aid = L.circle([e.lat, e.lng], { radius: base, color: "#f59e0b", weight: 2, opacity: 0.6, fillOpacity: 0, dashArray: "6 4" });
        aid.bindTooltip(`AID – ${e.nome}<br/><small>Área de Influência Direta · r=${(base/1000).toFixed(1)} km</small>`, { direction:"top" });
        aid.addTo(mapRef.current); aidZonesRef.current.push(aid);
        const aidPath = (aid as any)._path as HTMLElement | null;
        if (aidPath) { aidPath.style.opacity = "0"; aidPath.style.transition = ""; setTimeout(() => { aidPath.style.transition = "opacity 0.5s ease"; aidPath.style.opacity = "1"; }, baseDelay + 80); }

        const aii = L.circle([e.lat, e.lng], { radius: base * 3, color: "#22c55e", weight: 1.5, opacity: 0.4, fillOpacity: 0, dashArray: "10 6" });
        aii.bindTooltip(`AII – ${e.nome}<br/><small>Área de Influência Indireta · r=${(base*0.003).toFixed(1)} km</small>`, { direction:"top" });
        aii.addTo(mapRef.current); aidZonesRef.current.push(aii);
        const aiiPath = (aii as any)._path as HTMLElement | null;
        if (aiiPath) { aiiPath.style.opacity = "0"; aiiPath.style.transition = ""; setTimeout(() => { aiiPath.style.transition = "opacity 0.5s ease"; aiiPath.style.opacity = "1"; }, baseDelay + 150); }
      });
    });
  }, [mapReady, layerAidConcentrico, empData, raioMulti, camadas]);

  // ── Destaque de conflitos territoriais ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    conflictLayersRef.current.forEach(l => { try { mapRef.current.removeLayer(l); } catch (_) {} });
    conflictLayersRef.current = [];
    if (!overlapAnalysis.length) return;
    import("leaflet").then(L => {
      if (!mapRef.current) return;
      const conflictEmpIds = new Set(overlapAnalysis.map(o => o.emp.id));
      empData.filter(e => conflictEmpIds.has(e.id)).forEach((e, ci) => {
        const ring = L.circle([e.lat, e.lng], { radius: 9000, color: "#dc2626", weight: 3, opacity: 0.85, fillOpacity: 0, dashArray: "5 3" });
        const overlaps = overlapAnalysis.filter(o => o.emp.id === e.id);
        ring.bindTooltip(`⚠️ Conflito territorial<br/>${overlaps.map(o => o.featureName).join("<br/>")}`);
        ring.addTo(mapRef.current);
        conflictLayersRef.current.push(ring);
        // Fade-in + pulsação contínua
        const rPath = (ring as any)._path as HTMLElement | null;
        if (rPath) {
          rPath.style.opacity = "0";
          rPath.style.transition = "";
          setTimeout(() => {
            rPath.style.transition = "opacity 0.4s ease";
            rPath.style.opacity = "1";
            setTimeout(() => {
              rPath.style.transition = "";
              rPath.classList.add("eco-conflict-ring");
            }, 450);
          }, ci * 60 + 16);
        }
      });
    });
  }, [mapReady, overlapAnalysis, empData]);

  // ── Estatísticas do viewport ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const update = () => {
      const b = mapRef.current?.getBounds();
      if (!b) return;
      const emps = empData.filter(e => b.contains([e.lat, e.lng])).length;
      const campo = heatmapFiltered.filter((r: any) => r._lat != null && r._lng != null && b.contains([r._lat, r._lng])).length;
      // Espécies ameaçadas: apenas CR / EN / VU (criticamente em perigo, em perigo, vulnerável)
      // NT = Quase Ameaçada, DD = Dados Insuficientes, LC = Menos Preocupante — NÃO contam
      const IUCN_THREATENED = ["CR", "EN", "VU"];
      const threatenedSpecies = new Set(
        heatmapFiltered
          .filter((r: any) =>
            r._lat != null && r._lng != null &&
            b.contains([r._lat, r._lng]) &&
            r.nomeCientifico &&
            (
              IUCN_THREATENED.includes((r.iucn ?? "").trim().toUpperCase()) ||
              (r.ibamaMma && !["-", "", "NE", "LC"].includes((r.ibamaMma as string).trim().toUpperCase()))
            )
          )
          .map((r: any) => (r.nomeCientifico as string).trim().toLowerCase())
      );
      const threatened = threatenedSpecies.size;
      setViewportStats({ emps, campo, threatened });
    };
    update();
    mapRef.current.on("moveend", update);
    mapRef.current.on("zoomend", update);
    return () => { mapRef.current?.off("moveend", update); mapRef.current?.off("zoomend", update); };
  }, [mapReady, empData, heatmapFiltered]);

  // ── Ferramenta de cálculo de área ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (!drawModeActive) {
      drawPointsRef.current = [];
      setDrawnPoints([]);
      if (drawLayerRef.current) { try { mapRef.current.removeLayer(drawLayerRef.current); } catch (_) {} drawLayerRef.current = null; }
      setDrawnAreaHa(null);
      mapRef.current.getContainer().style.cursor = "";
      return;
    }
    mapRef.current.getContainer().style.cursor = "crosshair";
    const onClick = (ev: any) => {
      const { lat, lng } = ev.latlng;
      const newPts: [number, number][] = [...drawPointsRef.current, [lat, lng]];
      drawPointsRef.current = newPts;
      setDrawnPoints([...newPts]);
      import("leaflet").then(L => {
        if (!mapRef.current) return;
        if (drawLayerRef.current) { try { mapRef.current.removeLayer(drawLayerRef.current); } catch (_) {} }
        if (newPts.length >= 2) {
          drawLayerRef.current = L.polygon(newPts, { color: "#06b6d4", fillColor: "#06b6d4", fillOpacity: 0.12, weight: 2 });
          drawLayerRef.current.addTo(mapRef.current);
        }
        if (newPts.length >= 3) {
          const R = 6371000; let area = 0;
          for (let i = 0, j = newPts.length - 1; i < newPts.length; j = i++) {
            const lat1 = newPts[i][0] * Math.PI / 180, lat2 = newPts[j][0] * Math.PI / 180;
            const dLng = (newPts[j][1] - newPts[i][1]) * Math.PI / 180;
            area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
          }
          setDrawnAreaHa(Math.round(Math.abs(area * R * R / 2) / 10000 * 100) / 100);
        }
      });
    };
    mapRef.current.on("click", onClick);
    return () => {
      mapRef.current?.off("click", onClick);
      if (mapRef.current) mapRef.current.getContainer().style.cursor = "";
    };
  }, [mapReady, drawModeActive]);

  // ── Modo de comparação: segundo mapa (satélite) ────────────────────────────────
  useEffect(() => {
    if (!compareModeActive) {
      if (compareMapRef.current) { try { compareMapRef.current.remove(); } catch (_) {} compareMapRef.current = null; }
      return;
    }
    if (!compareContainerRef.current || compareMapRef.current) return;
    import("leaflet").then(L => {
      if (!compareContainerRef.current || compareMapRef.current) return;
      const center = mapRef.current?.getCenter() ?? { lat: -15.79, lng: -47.89 };
      const zoom   = mapRef.current?.getZoom() ?? 5;
      const m2 = L.map(compareContainerRef.current, { center: [center.lat, center.lng], zoom, zoomControl: false, attributionControl: false });
      L.tileLayer(TILE_LAYERS.satellite.url, { attribution: TILE_LAYERS.satellite.attr, maxZoom: 19 }).addTo(m2);
      compareMapRef.current = m2;
      const sync = () => {
        const c = mapRef.current?.getCenter(), z = mapRef.current?.getZoom();
        if (c && z !== undefined && compareMapRef.current) compareMapRef.current.setView([c.lat, c.lng], z, { animate: false });
      };
      mapRef.current?.on("moveend", sync);
      mapRef.current?.on("zoomend", sync);
      return () => { mapRef.current?.off("moveend", sync); mapRef.current?.off("zoomend", sync); };
    });
    return () => {
      if (compareMapRef.current) { try { compareMapRef.current.remove(); } catch (_) {} compareMapRef.current = null; }
    };
  }, [compareModeActive]);

  // ── Funções ───────────────────────────────────────────────────────────────────
  const flyTo = useCallback((e: typeof empData[0]) => {
    if (mapRef.current) mapRef.current.flyTo([e.lat, e.lng], 10, { duration: 1.2 });
    setSelectedEmp(e); setInfoPanelOpen(true);
  }, []);

  const toggleGeoLayer = (id: number) => {
    setVisibleGeoLayers(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleCategoryGeoLayers = (categoria: string, enabled: boolean) => {
    const cat = camadasPorCategoria[categoria] || [];
    setVisibleGeoLayers(prev => {
      const s = new Set(prev);
      cat.forEach(c => { if (enabled) s.add(c.id); else s.delete(c.id); });
      return s;
    });
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadNome) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("nome", uploadNome);
      fd.append("categoria", uploadCat);
      fd.append("cor", uploadCor);
      if (uploadFonte) fd.append("fonte", uploadFonte);
      const res = await fetch("/api/camadas-geoespaciais/upload", { method: "POST", body: fd });
      if (!res.ok) {
        let errMsg = `Erro ${res.status} no upload`;
        try { const j = await res.json(); errMsg = j.error || j.message || errMsg; } catch (_) {}
        throw new Error(errMsg);
      }
      const data = await res.json();
      toast({ title: "Camada carregada!", description: `"${uploadNome}" adicionada ao mapa.` });
      setUploadOpen(false); setUploadFile(null); setUploadNome(""); setUploadCat("outro"); setUploadFonte(""); setUploadCor("#3b82f6");
      await refetchCamadas();
      await queryClient.invalidateQueries({ queryKey: ["/api/camadas-geoespaciais"] });
      if (data.id) setVisibleGeoLayers(prev => new Set(prev).add(data.id));
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const handleDeleteLayer = async (id: number, nome: string) => {
    if (!confirm(`Remover a camada "${nome}"?`)) return;
    try {
      const res = await fetch(`/api/camadas-geoespaciais/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao remover");
      setVisibleGeoLayers(prev => { const s = new Set(prev); s.delete(id); return s; });
      if (configLayerId === id) setConfigLayerId(null);
      await queryClient.invalidateQueries({ queryKey: ["/api/camadas-geoespaciais"] });
      toast({ title: "Camada removida", description: `"${nome}" foi excluída.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleUpdateLayer = async (id: number, patch: { nome?: string; opacidade?: number; categoria?: string; cor?: string }) => {
    try {
      const res = await fetch(`/api/camadas-geoespaciais/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      await queryClient.invalidateQueries({ queryKey: ["/api/camadas-geoespaciais"] });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  };

  const handleZoomToLayer = (camada: CamadaGeoespacial) => {
    if (!mapRef.current) return;
    const data = camada.geojsonData as any;
    if (!data?.features?.length) { toast({ description: "Camada sem geometria para centralizar." }); return; }
    import("leaflet").then(L => {
      if (!mapRef.current) return;
      try {
        const temp = L.geoJSON(data);
        const bounds = temp.getBounds();
        if (bounds.isValid()) mapRef.current.flyToBounds(bounds, { padding: [40, 40], duration: 1.2 });
      } catch (_) {}
    });
  };

  const handleZoomToCampoGrupo = (grupo: string) => {
    if (!mapRef.current) return;
    const pontos = heatmapFiltered.filter((r: any) => r.grupoTaxonomico === grupo && r._lat != null && r._lng != null);
    if (pontos.length === 0) { toast({ description: "Sem pontos com coordenadas para centralizar." }); return; }
    import("leaflet").then(L => {
      if (!mapRef.current) return;
      const lats = pontos.map((r: any) => r._lat as number);
      const lngs = pontos.map((r: any) => r._lng as number);
      const bounds = L.latLngBounds(
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      );
      if (bounds.isValid()) mapRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 14, duration: 1.4 });
    });
  };

  // ── Cálculo de área (fórmula de excesso esférico) ─────────────────────────
  const calcPolygonAreaHa = (pts: [number, number][]): number => {
    if (pts.length < 3) return 0;
    const R = 6371000;
    let area = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const lat1 = pts[i][0] * Math.PI / 180, lat2 = pts[j][0] * Math.PI / 180;
      const dLng = (pts[j][1] - pts[i][1]) * Math.PI / 180;
      area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    return Math.abs(area * R * R / 2) / 10000;
  };

  // ── Proximidade a camadas vetoriais (para painel de detalhes) ────────────
  const getEmpProximity = (empId: number): Array<{ nome: string; camadaNome: string; distKm: number }> => {
    const emp = empData.find(e => e.id === empId);
    if (!emp) return [];
    const R = 6371;
    const hav = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const results: Array<{ nome: string; camadaNome: string; distKm: number }> = [];
    camadas.filter(c => visibleGeoLayers.has(c.id) && c.geojsonData).forEach(camada => {
      const feats = (camada.geojsonData as any)?.features || [];
      feats.slice(0, 50).forEach((feat: any) => {
        const p = feat.properties || {};
        const nome = p.NOM_UC || p.NOME_UC || p.name || p.Name || p.NOME || camada.nome;
        const geom = feat.geometry;
        if (!geom) return;
        let cLat = 0, cLng = 0, n = 0;
        const addCoords = (coords: number[]) => { cLng += coords[0]; cLat += coords[1]; n++; };
        if (geom.type === "Polygon") geom.coordinates[0].slice(0, 20).forEach(addCoords);
        else if (geom.type === "MultiPolygon") geom.coordinates[0][0].slice(0, 20).forEach(addCoords);
        else if (geom.type === "Point") { cLng = geom.coordinates[0]; cLat = geom.coordinates[1]; n = 1; }
        if (!n) return;
        const dist = hav(emp.lat, emp.lng, cLat / n, cLng / n);
        results.push({ nome, camadaNome: camada.nome, distKm: Math.round(dist * 10) / 10 });
      });
    });
    return results.sort((a, b) => a.distKm - b.distKm).slice(0, 5);
  };

  // ── Exportar CSV (pontos visíveis no viewport) ────────────────────────────
  const exportCSV = () => {
    const bounds = mapRef.current?.getBounds();
    const rows = [["ID","Grupo","Nome Científico","Nome Comum","Lat WGS84","Lng WGS84","Data","Campanha","IUCN","MMA/IBAMA"]];
    heatmapFiltered.forEach((r: any) => {
      if (r._lat == null || r._lng == null) return;
      if (bounds && !bounds.contains([r._lat, r._lng])) return;
      rows.push([r.id, r.grupoTaxonomico || "", r.nomeCientifico || "", r.nomeComum || "",
        r._lat.toFixed(6), r._lng.toFixed(6), String(r.data || "").slice(0, 10), r.campanha || "", r.iucn || "", r.ibamaMma || ""]);
    });
    const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })),
      download: `campo_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    toast({ title: "CSV exportado!", description: `${rows.length - 1} registros.` });
  };

  // ── Exportar KML ──────────────────────────────────────────────────────────
  const exportKML = () => {
    const bounds = mapRef.current?.getBounds();
    const placemarks = heatmapFiltered
      .filter((r: any) => r._lat != null && r._lng != null && (!bounds || bounds.contains([r._lat, r._lng])))
      .map((r: any) => `  <Placemark>
    <name>${(r.nomeCientifico || r.grupoTaxonomico || "Registro").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" } as any)[c])}</name>
    <description>${[r.nomeComum, String(r.data || "").slice(0,10), r.campanha, r.iucn].filter(Boolean).join(" | ")}</description>
    <Point><coordinates>${r._lng.toFixed(6)},${r._lat.toFixed(6)},0</coordinates></Point>
  </Placemark>`).join("\n");
    const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>\n<name>Pontos de Campo SGAI</name>\n${placemarks}\n</Document></kml>`;
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([kml], { type: "application/vnd.google-earth.kml+xml" })),
      download: `campo_${new Date().toISOString().slice(0, 10)}.kml`,
    });
    a.click();
    toast({ title: "KML exportado!" });
  };

  // ── Exportar PDF cartográfico profissional ───────────────────────────────
  const exportPDF = async (opts?: {
    layerSel: Set<number>;
    showEmp: boolean; showCampo: boolean;
    showHeatmap: boolean; showZones: boolean;
    clientLogo?: string | null;
    mapTitle?: string;
  }) => {
    const selLayers  = opts?.layerSel    ?? visibleGeoLayers;
    const withEmp    = opts?.showEmp     ?? true;
    const withCampo  = opts?.showCampo   ?? true;
    const withHeat   = opts?.showHeatmap ?? true;
    const withZones  = opts?.showZones   ?? true;
    const clientLogoB64 = opts?.clientLogo ?? null;
    const mapTitle   = opts?.mapTitle ?? "Relatório Cartográfico — Mapa de Empreendimentos Ambientais";

    try {
      toast({ title: "Capturando mapa…", description: "Aguarde alguns segundos." });

      const { jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;

      // Salvar estado original do mapa para restaurar após captura
      const origCenter = mapRef.current?.getCenter() ?? { lat: 0, lng: 0 };
      const origZoom   = mapRef.current?.getZoom() ?? 5;

      // ── Ajustar camadas temporariamente para o PDF ──────────────────────────
      const L_mod = await import("leaflet").then(m => m.default ?? m);
      const tempAdded: any[] = [];
      const hiddenLayers: Array<[number, any]> = [];

      // Adicionar camadas selecionadas que não estão visíveis
      for (const id of selLayers) {
        if (!geoLayersRef.current.has(id) && mapRef.current) {
          const camada = camadas.find(c => c.id === id);
          if (camada?.geojsonData) {
            const cor = layerColors[id] || camada.cor || "#3b82f6";
            const opac = layerOpacities[id] ?? camada.opacidade ?? 0.35;
            const tmpLayer = (L_mod as any).geoJSON(camada.geojsonData, {
              style: { color: cor, fillColor: cor, fillOpacity: opac, weight: 1.5, opacity: 0.9 },
            });
            tmpLayer.addTo(mapRef.current);
            tempAdded.push(tmpLayer);
          }
        }
      }
      // Ocultar camadas visíveis que não estão na seleção
      for (const [id, layer] of geoLayersRef.current) {
        if (!selLayers.has(id)) {
          try { layer.setStyle({ opacity: 0, fillOpacity: 0 }); hiddenLayers.push([id, layer]); } catch (_) {}
        }
      }
      // Ocultar elementos do mapa se não selecionados
      if (!withCampo) campoMarkersRef.current.forEach(ms => ms.forEach(m => { try { m.setOpacity(0); } catch (_) {} }));
      if (!withEmp || !withZones) layersRef.current.forEach(l => { try { l.setStyle?.({ opacity: 0, fillOpacity: 0 }); l.setOpacity?.(0); } catch (_) {} });

      await new Promise(r => setTimeout(r, 400));

      // ── Auto-zoom para PDF: encaixa empreendimentos em zoom 14–17 ───────────
      const geoEmps = empData.filter(e => isFinite(e.lat) && isFinite(e.lng));
      if (geoEmps.length > 0 && mapRef.current) {
        if (geoEmps.length === 1) {
          // Um único empreendimento → zoom 15 centrado nele
          mapRef.current.setView([geoEmps[0].lat, geoEmps[0].lng], 15, { animate: false });
        } else {
          // Vários → fitBounds com maxZoom 17 e minZoom 14
          const lats = geoEmps.map(e => e.lat);
          const lngs = geoEmps.map(e => e.lng);
          mapRef.current.fitBounds(
            [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
            { padding: [50, 50], maxZoom: 17, animate: false }
          );
          const fittedZoom = mapRef.current.getZoom() ?? 14;
          // Garantir mínimo 14
          if (fittedZoom < 14) {
            mapRef.current.setZoom(14, { animate: false });
          }
        }
        // Aguardar tiles carregarem
        await new Promise(r => setTimeout(r, 1200));
      } else {
        await new Promise(r => setTimeout(r, 300));
      }

      // Re-capturar posição após ajuste de zoom (usada no desenho do PDF)
      const center = mapRef.current?.getCenter() ?? origCenter;
      const zoom   = mapRef.current?.getZoom() ?? 14;
      const bounds = mapRef.current?.getBounds();

      // ── Carregar logos ──────────────────────────────────────────────────────
      const loadImgB64 = (url: string): Promise<string> =>
        fetch(url).then(r => r.blob()).then(b => new Promise(res => {
          const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.readAsDataURL(b);
        }));
      let senaiB64 = "";
      try { senaiB64 = await loadImgB64(senaiCimatecLogoUrl); } catch (_) {}

      // ── Capturar mapa (escondendo controles Leaflet) ────────────────────────
      let mapDataUrl: string | null = null;
      if (containerRef.current) {
        try {
          const sidebar   = containerRef.current.parentElement?.querySelector<HTMLElement>(".eco-sidebar-anim");
          const titleBar  = containerRef.current.parentElement?.querySelector<HTMLElement>("[data-titlebar]");
          const zoomCtrl  = containerRef.current.querySelector<HTMLElement>(".leaflet-control-zoom");
          const attrCtrl  = containerRef.current.querySelector<HTMLElement>(".leaflet-control-attribution");
          const scaleCtrl = containerRef.current.querySelector<HTMLElement>(".leaflet-control-scale");
          if (sidebar)   sidebar.style.display   = "none";
          if (titleBar)  titleBar.style.display  = "none";
          if (zoomCtrl)  zoomCtrl.style.display  = "none";
          if (attrCtrl)  attrCtrl.style.display  = "none";
          if (scaleCtrl) scaleCtrl.style.display = "none";
          const canvas = await html2canvas(containerRef.current, {
            useCORS: true, allowTaint: true, scale: 2,
            logging: false, backgroundColor: "#1e293b",
          });
          mapDataUrl = canvas.toDataURL("image/jpeg", 0.88);
          if (sidebar)   sidebar.style.display   = "";
          if (titleBar)  titleBar.style.display  = "";
          if (zoomCtrl)  zoomCtrl.style.display  = "";
          if (attrCtrl)  attrCtrl.style.display  = "";
          if (scaleCtrl) scaleCtrl.style.display = "";
        } catch (e) { console.warn("html2canvas:", e); }
      }

      // ── Restaurar posição/zoom original do mapa ─────────────────────────────
      if (mapRef.current) {
        mapRef.current.setView([origCenter.lat, origCenter.lng], origZoom, { animate: false });
      }

      // ── Restaurar estado do mapa ────────────────────────────────────────────
      tempAdded.forEach(l => { try { mapRef.current?.removeLayer(l); } catch (_) {} });
      hiddenLayers.forEach(([id, layer]) => {
        const camada = camadas.find(c => c.id === id);
        const opac = layerOpacities[id] ?? camada?.opacidade ?? 0.35;
        try { layer.setStyle({ opacity: 0.9, fillOpacity: opac }); } catch (_) {}
      });
      if (!withCampo) campoMarkersRef.current.forEach(ms => ms.forEach(m => { try { m.setOpacity(1); } catch (_) {} }));
      // Sempre re-renderiza marcadores após o export para garantir que ícones reapareçam
      setMapLayerKey(k => k + 1);

      // ═══════════════════════════════════════════════════════════════════════
      // ── PRANCHA CARTOGRÁFICA INSTITUCIONAL — Estilo ABNT / ArcGIS Pro ────────
      // ═══════════════════════════════════════════════════════════════════════
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const PW = 297; const PH = 210;

      // ── Helpers ───────────────────────────────────────────────────────────
      const setFill = (r:number,g:number,b:number) => doc.setFillColor(r,g,b);
      const setDraw = (r:number,g:number,b:number) => doc.setDrawColor(r,g,b);
      const setTxt  = (r:number,g:number,b:number) => doc.setTextColor(r,g,b);
      const hexRgb  = (hex:string):[number,number,number] => {
        const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
        return [isNaN(r)?100:r,isNaN(g)?116:g,isNaN(b)?139:b];
      };

      // ── Paleta institucional (ABNT / ArcGIS Pro) ─────────────────────────
      const C = {
        bgOuter:  [234,234,234] as [number,number,number],
        panel:    [255,255,255] as [number,number,number],
        cartBg:   [248,248,248] as [number,number,number],
        secHdr:   [242,242,242] as [number,number,number],
        border:   [30, 30, 30 ] as [number,number,number],
        borderM:  [120,120,120] as [number,number,number],
        borderL:  [190,190,190] as [number,number,number],
        txt1:     [20, 20, 20 ] as [number,number,number],
        txt2:     [68, 68, 68 ] as [number,number,number],
        txt3:     [120,120,120] as [number,number,number],
        red:      [170,30, 30 ] as [number,number,number],
        amber:    [155,95, 0  ] as [number,number,number],
        green:    [22, 95, 50 ] as [number,number,number],
        ocean:    [195,215,235] as [number,number,number],
        land:     [210,218,195] as [number,number,number],
        landHl:   [135,185,125] as [number,number,number],
      };

      // ── Constantes de layout institucional ──────────────────────────────
      const M   = 5;    // margem externa
      const CH  = 50;   // altura cartouche (faixa inferior)
      const RW  = 90;   // largura painel direito
      const GAP = 2;
      const MX  = M, MY = M;
      const MW  = PW - M*2 - RW - GAP;  // ≈ 195mm
      const MH  = PH - M*2 - CH;         // ≈ 150mm
      const BLY = MY + MH;               // y inicial cartouche
      const PX  = MX + MW + GAP;
      const PH2 = MH;                    // right panel height
      // aliases backward-compat
      const PNW = RW; const BH = CH; const PY = MY;

      // ─────────────────────────────────────────────────────────────────────
      // 0. FUNDO EXTERNO (cinza neutro)
      // ─────────────────────────────────────────────────────────────────────
      setFill(...C.bgOuter); doc.rect(0,0,PW,PH,"F");

      // ─────────────────────────────────────────────────────────────────────
      // 1. IMAGEM DO MAPA PRINCIPAL
      // ─────────────────────────────────────────────────────────────────────
      setFill(...C.panel); doc.rect(MX,MY,MW,MH,"F");
      if (mapDataUrl) {
        doc.addImage(mapDataUrl,"JPEG",MX,MY,MW,MH,undefined,"FAST");
      } else {
        setTxt(...C.txt3); doc.setFontSize(9); doc.setFont("helvetica","italic");
        doc.text("Imagem do mapa indisponível",MX+MW/2,MY+MH/2,{align:"center"});
      }

      // ─────────────────────────────────────────────────────────────────────
      // 2. GRADE DE COORDENADAS sobre o mapa
      // ─────────────────────────────────────────────────────────────────────
      // 2. GRADE DE COORDENADAS (ABNT — ticks e labels na borda do mapa)
      // ─────────────────────────────────────────────────────────────────────
      if (bounds) {
        const N=bounds.getNorth(), S=bounds.getSouth();
        const E=bounds.getEast(),  W2=bounds.getWest();
        const latR=N-S, lngR=E-W2;
        const latSt = latR>15?5:latR>6?2:latR>2?1:latR>0.5?0.5:0.25;
        const lngSt = lngR>15?5:lngR>6?2:lngR>2?1:lngR>0.5?0.5:0.25;

        // Linhas de grade sutis (cinza claro pontilhado)
        const docA = doc as any;
        setDraw(200,200,200); doc.setLineWidth(0.06); docA.setLineDash([0.8,3]);
        for (let lat=Math.ceil(S/latSt)*latSt; lat<=N; lat+=latSt) {
          const yy = MY + MH - ((lat-S)/(N-S))*MH;
          if (yy<MY+2||yy>MY+MH-2) continue;
          doc.line(MX,yy,MX+MW,yy);
        }
        for (let lng=Math.ceil(W2/lngSt)*lngSt; lng<=E; lng+=lngSt) {
          const xx = MX + ((lng-W2)/(E-W2))*MW;
          if (xx<MX+2||xx>MX+MW-2) continue;
          doc.line(xx,MY,xx,MY+MH);
        }
        docA.setLineDash([]);

        // Ticks e labels nas bordas
        doc.setFontSize(4); doc.setFont("helvetica","normal");
        for (let lat=Math.ceil(S/latSt)*latSt; lat<=N; lat+=latSt) {
          const yy = MY + MH - ((lat-S)/(N-S))*MH;
          if (yy<MY+5||yy>MY+MH-5) continue;
          const lbl=`${Math.abs(lat).toFixed(lat===Math.floor(lat)?0:1)}°${lat>=0?"N":"S"}`;
          // Esquerda
          setFill(255,255,255); doc.rect(MX+0.3,yy-2,11,3,"F");
          setDraw(...C.borderM); doc.setLineWidth(0.2); doc.line(MX,yy,MX+2,yy);
          setTxt(...C.txt2); doc.text(lbl,MX+2.5,yy+1);
          // Direita
          setFill(255,255,255); doc.rect(MX+MW-11.3,yy-2,11,3,"F");
          setDraw(...C.borderM); doc.line(MX+MW-2,yy,MX+MW,yy);
          setTxt(...C.txt2); doc.text(lbl,MX+MW-2.5,yy+1,{align:"right"});
        }
        for (let lng=Math.ceil(W2/lngSt)*lngSt; lng<=E; lng+=lngSt) {
          const xx = MX + ((lng-W2)/(E-W2))*MW;
          if (xx<MX+8||xx>MX+MW-8) continue;
          const lbl=`${Math.abs(lng).toFixed(lng===Math.floor(lng)?0:1)}°${lng>=0?"E":"W"}`;
          // Topo
          setFill(255,255,255); doc.rect(xx-7,MY+0.3,14,2.8,"F");
          setDraw(...C.borderM); doc.setLineWidth(0.2); doc.line(xx,MY,xx,MY+2);
          setTxt(...C.txt2); doc.text(lbl,xx,MY+4,{align:"center"});
          // Base
          setFill(255,255,255); doc.rect(xx-7,MY+MH-3.1,14,2.8,"F");
          setDraw(...C.borderM); doc.line(xx,MY+MH-2,xx,MY+MH);
          setTxt(...C.txt2); doc.text(lbl,xx,MY+MH-0.3,{align:"center"});
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 3. PAINEL DIREITO — 3 sub-blocos: Brasil / Regional / Institucional
      // ─────────────────────────────────────────────────────────────────────
      setFill(...C.panel); doc.rect(PX,PY,RW,PH2,"F");
      {
        const LOC1_H = Math.round(PH2*0.37);
        const LOC2_H = Math.round(PH2*0.35);
        const INS_H  = PH2 - LOC1_H - LOC2_H;

        // ── 3.1 Localização Brasil ──────────────────────────────────────
        {
          const bx=PX, by=PY, bw=RW, bh=LOC1_H;
          setFill(...C.secHdr); doc.rect(bx,by,bw,5.5,"F");
          setTxt(...C.txt1); doc.setFontSize(4.8); doc.setFont("helvetica","bold");
          doc.text("LOCALIZAÇÃO NO BRASIL",bx+bw/2,by+3.8,{align:"center"});
          setDraw(...C.borderM); doc.setLineWidth(0.15); doc.line(bx,by+5.5,bx+bw,by+5.5);

          const mx2=bx+2, my2=by+6.5, mw2=bw-4, mh2=bh-8;
          setFill(...C.ocean); doc.rect(mx2,my2,mw2,mh2,"F");

          // Polígono simplificado do Brasil
          const LO1=-74,LO2=-28,LA2=5;
          const scX2=mw2/(LO2-LO1), scY2=mh2/(LA2-(-35));
          const toM2=(lo:number,la:number):[number,number]=>[mx2+(lo-LO1)*scX2, my2+(LA2-la)*scY2];
          const BR:Array<[number,number]>=[
            [-28.8,0.5],[-34.8,-6.5],[-35.5,-9.0],[-38.0,-13.0],
            [-39.6,-19.5],[-40.8,-21.2],[-43.4,-23.5],[-48.6,-28.0],
            [-52.5,-33.8],[-57.5,-30.0],[-58.3,-27.6],[-57.3,-25.2],
            [-53.7,-20.4],[-57.8,-18.2],[-60.5,-13.5],[-67.3,-10.0],
            [-72.9,-9.9],[-73.9,-4.4],[-70.1,-2.0],[-69.7,1.7],
            [-63.4,3.9],[-51.0,4.2],[-50.8,1.3],[-44.7,-2.5],[-28.8,0.5],
          ];
          const brMm = BR.map(([lo,la])=>toM2(lo,la));
          const brDiffs = brMm.slice(1).map(([x,y],i): [number,number] => [x-brMm[i][0],y-brMm[i][1]]);
          setFill(...C.land); setDraw(150,155,140); doc.setLineWidth(0.15);
          doc.lines(brDiffs,brMm[0][0],brMm[0][1],[1,1],"FD",true);

          // Marcador da área
          if (bounds) {
            const [rx1,ry1]=toM2(bounds.getWest(),bounds.getNorth());
            const [rx2,ry2]=toM2(bounds.getEast(),bounds.getSouth());
            setFill(200,20,20); doc.rect(rx1,ry1,Math.max(rx2-rx1,1.5),Math.max(ry2-ry1,1.5),"F");
          } else {
            const [cx,cy]=toM2(center.lng,center.lat);
            setFill(200,20,20); doc.circle(cx,cy,1.5,"F");
          }
          setDraw(...C.borderM); doc.setLineWidth(0.2); doc.rect(mx2,my2,mw2,mh2);
          setDraw(...C.borderL); doc.line(bx,by+bh,bx+bw,by+bh);
        }

        // ── 3.2 Localização Regional ──────────────────────────────────
        {
          const bx=PX, by=PY+LOC1_H, bw=RW, bh=LOC2_H;
          setFill(...C.secHdr); doc.rect(bx,by,bw,5.5,"F");
          setTxt(...C.txt1); doc.setFontSize(4.8); doc.setFont("helvetica","bold");
          doc.text("LOCALIZAÇÃO REGIONAL",bx+bw/2,by+3.8,{align:"center"});
          setDraw(...C.borderM); doc.setLineWidth(0.15); doc.line(bx,by+5.5,bx+bw,by+5.5);

          const mx2=bx+2, my2=by+6.5, mw2=bw-4, mh2=bh-8;
          setFill(220,228,215); doc.rect(mx2,my2,mw2,mh2,"F");
          // Grade de fundo sutil
          setDraw(195,200,188); doc.setLineWidth(0.07);
          for(let i=1;i<5;i++) {
            doc.line(mx2+mw2/5*i,my2,mx2+mw2/5*i,my2+mh2);
            doc.line(mx2,my2+mh2/4*i,mx2+mw2,my2+mh2/4*i);
          }

          if (bounds) {
            const N=bounds.getNorth(), S=bounds.getSouth();
            const E=bounds.getEast(),  W2b=bounds.getWest();
            const pad=Math.max(N-S,E-W2b)*1.5;
            const LO1b=W2b-pad, LO2b=E+pad, LA2b=N+pad, LA1b=S-pad;
            const scXb=mw2/(LO2b-LO1b), scYb=mh2/(LA2b-LA1b);
            const toReg=(lo:number,la:number):[number,number]=>[mx2+(lo-LO1b)*scXb, my2+(LA2b-la)*scYb];
            const [rx1,ry1]=toReg(W2b,N);
            const [rx2,ry2]=toReg(E,S);
            setFill(235,200,200); doc.rect(rx1,ry1,Math.max(rx2-rx1,3),Math.max(ry2-ry1,3),"F");
            setDraw(200,20,20); doc.setLineWidth(0.45);
            doc.rect(rx1,ry1,Math.max(rx2-rx1,3),Math.max(ry2-ry1,3),"S");
            // Labels de coordenadas
            setTxt(...C.txt3); doc.setFontSize(3.2); doc.setFont("helvetica","normal");
            doc.text(`${Math.abs(N).toFixed(2)}°${N>=0?"N":"S"}`,mx2+1,my2+3.5);
            doc.text(`${Math.abs(S).toFixed(2)}°${S>=0?"N":"S"}`,mx2+1,my2+mh2-1);
            doc.text(`${Math.abs(W2b).toFixed(2)}°${W2b>=0?"E":"W"}`,mx2+1,my2+mh2/2);
            doc.text(`${Math.abs(E).toFixed(2)}°${E>=0?"E":"W"}`,mx2+mw2-1,my2+mh2/2,{align:"right"});
          } else {
            const cx=mx2+mw2/2, cy=my2+mh2/2;
            setDraw(200,20,20); doc.setLineWidth(0.4);
            doc.line(cx-4,cy,cx+4,cy); doc.line(cx,cy-4,cx,cy+4);
          }
          setDraw(...C.borderM); doc.setLineWidth(0.2); doc.rect(mx2,my2,mw2,mh2);
          setDraw(...C.borderL); doc.line(bx,by+bh,bx+bw,by+bh);
        }

        // ── 3.3 Painel Institucional ──────────────────────────────────
        {
          const bx=PX, by=PY+LOC1_H+LOC2_H, bw=RW, bh=INS_H;
          setFill(248,248,250); doc.rect(bx,by,bw,bh,"F");
          const lhI=Math.min(bh*0.48,18), lwI=bw/2-5;
          const lx1=bx+2.5, lx2=bx+bw/2+2.5, ly2=by+3;
          setDraw(...C.borderL); doc.setLineWidth(0.12);
          doc.line(bx+bw/2,by+2,bx+bw/2,by+lhI+5);
          if(senaiB64){
            try{ doc.addImage(senaiB64,"PNG",lx1,ly2,lwI,lhI); }
            catch(_){
              setTxt(...C.txt3);doc.setFontSize(3.8);doc.setFont("helvetica","bold");
              doc.text("SENAI CIMATEC",lx1+lwI/2,ly2+lhI/2+1,{align:"center"});
            }
          } else {
            const docB = doc as any;
            setDraw(...C.borderL);docB.setLineDash([1.2,1.2]);
            doc.rect(lx1,ly2,lwI,lhI);docB.setLineDash([]);
            setTxt(...C.txt3);doc.setFontSize(3.5);doc.setFont("helvetica","normal");
            doc.text("LOGO",lx1+lwI/2,ly2+lhI/2+1,{align:"center"});
          }
          if(clientLogoB64){
            try{
              const eL=clientLogoB64.includes("image/png")?"PNG":"JPEG";
              doc.addImage(clientLogoB64,eL,lx2,ly2,lwI,lhI);
            }catch(_){}
          } else {
            const docC = doc as any;
            setDraw(...C.borderL);docC.setLineDash([1.2,1.2]);
            doc.rect(lx2,ly2,lwI,lhI);docC.setLineDash([]);
            setTxt(...C.txt3);doc.setFontSize(3.5);
            doc.text("LOGO",lx2+lwI/2,ly2+lhI/2+1,{align:"center"});
          }
          const tY2=by+lhI+8;
          setTxt(...C.txt2);doc.setFontSize(4);doc.setFont("helvetica","bold");
          doc.text("Responsável técnico:",bx+2.5,tY2);
          doc.setFont("helvetica","normal");
          doc.text("SGAI — Maurivan Gestão",bx+2.5,tY2+4.5);
          doc.setFont("helvetica","bold");
          doc.text("Elaboração:",bx+2.5,tY2+9);
          doc.setFont("helvetica","normal");
          doc.text("Gest. Ambiental Integrada",bx+2.5,tY2+13.5);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 4. MOLDURAS (ABNT dupla)
      // ─────────────────────────────────────────────────────────────────────
      // Borda mapa
      setDraw(...C.border); doc.setLineWidth(0.4); doc.rect(MX,MY,MW,MH);
      // Borda painel direito
      doc.rect(PX,PY,RW,PH2);
      // Frame externo duplo
      setDraw(...C.borderM); doc.setLineWidth(0.25); doc.rect(M,M,PW-M*2,PH-M*2);
      setDraw(...C.border);  doc.setLineWidth(0.8);  doc.rect(1,1,PW-2,PH-2);

      // ─────────────────────────────────────────────────────────────────────
      // 5. CARTOUCHE — faixa horizontal inferior em 3 colunas
      // ─────────────────────────────────────────────────────────────────────
      const CW_TOT = PW - M*2;
      const C1W = Math.round(CW_TOT*0.38);
      const C2W = Math.round(CW_TOT*0.30);
      const C3W = CW_TOT - C1W - C2W;
      const CX1=M, CX2=M+C1W, CX3=M+C1W+C2W;
      const CY0 = BLY;

      setFill(...C.cartBg); doc.rect(M,CY0,CW_TOT,CH,"F");
      setDraw(...C.border); doc.setLineWidth(0.4); doc.rect(M,CY0,CW_TOT,CH);
      setDraw(...C.borderM); doc.setLineWidth(0.2);
      doc.line(CX2,CY0+2,CX2,CY0+CH-2);
      doc.line(CX3,CY0+2,CX3,CY0+CH-2);

      // ── Col 1: LEGENDA ─────────────────────────────────────────────────
      {
        let legY = CY0+6;
        setTxt(...C.txt1); doc.setFontSize(5.2); doc.setFont("helvetica","bold");
        doc.text("LEGENDA",CX1+C1W/2,legY,{align:"center"});
        setDraw(...C.borderM); doc.setLineWidth(0.18);
        doc.line(CX1+5,legY+1.5,CX1+C1W-5,legY+1.5);
        legY += 5;
        const maxLY2 = CY0+CH-4;
        const lPX = CX1+5;
        const lCirc=(rgb:[number,number,number],lbl:string)=>{
          if(legY>maxLY2-3) return;
          setFill(...rgb);doc.circle(lPX,legY-0.8,1.5,"F");
          setDraw(100,100,100);doc.setLineWidth(0.1);doc.circle(lPX,legY-0.8,1.5,"S");
          setTxt(...C.txt1);doc.setFontSize(4.5);doc.setFont("helvetica","normal");
          doc.text(lbl,lPX+4,legY);legY+=5.2;
        };
        const lRect=(rgb:[number,number,number],lbl:string)=>{
          if(legY>maxLY2-3) return;
          setFill(...rgb);doc.rect(lPX-1.5,legY-2.5,4,3.5,"F");
          setDraw(100,100,100);doc.setLineWidth(0.1);doc.rect(lPX-1.5,legY-2.5,4,3.5,"S");
          setTxt(...C.txt1);doc.setFontSize(4.5);doc.setFont("helvetica","normal");
          doc.text(lbl,lPX+4,legY);legY+=5.2;
        };
        const lHdr=(lbl:string)=>{
          if(legY>maxLY2-3) return;
          setTxt(...C.txt2);doc.setFontSize(4);doc.setFont("helvetica","bold");
          doc.text(lbl,lPX-1,legY);legY+=4.5;
        };

        // Empreendimentos
        if(withEmp&&empData.length>0){
          empData.slice(0,8).forEach(e=>{
            const cr=e.comp.color==="#22c55e"?C.green:e.comp.color==="#f59e0b"?C.amber:C.red;
            lCirc(cr,e.nome.length>22?e.nome.slice(0,20)+"…":e.nome);
          });
        }
        // Campo
        if(withCampo){
          const cGrps=[
            {nome:"Fauna Aves",cor:"#0ea5e9"},{nome:"Mamíferos",cor:"#f97316"},
            {nome:"Herpetofauna",cor:"#a855f7"},{nome:"Ictiofauna",cor:"#06b6d4"},
            {nome:"Flora",cor:"#22c55e"},{nome:"Ruído",cor:"#94a3b8"},
          ];
          const actG=cGrps.filter(g=>heatmapFiltered.some((r:any)=>r.grupo===g.nome));
          if(actG.length>0){
            lHdr("Campo");
            actG.forEach(g=>{
              const cnt=heatmapFiltered.filter((r:any)=>r.grupo===g.nome).length;
              lCirc(hexRgb(g.cor),`${g.nome} (${cnt})`);
            });
          }
        }
        // Camadas
        const geoL=camadas.filter(c=>selLayers.has(c.id));
        if(geoL.length>0&&legY<maxLY2-6){
          lHdr("Camadas");
          geoL.slice(0,4).forEach(c=>{
            const catCfg=CATEGORIA_CONFIG[c.categoria]||CATEGORIA_CONFIG["outro"]||{color:"#6b7280"};
            lRect(hexRgb(layerColors[c.id]||c.cor||catCfg.color),c.nome.length>22?c.nome.slice(0,20)+"…":c.nome);
          });
        }
      }

      // ── Col 2: Rosa dos ventos + Escala + Projeção ─────────────────────
      {
        const MID=CX2+C2W/2;
        // Rosa dos ventos (cartográfica clássica, split N/S)
        const NAX=MID, NAY=CY0+16, NAL=9;
        // Metade esquerda (preta) — triângulo apontando para cima (N)
        setFill(...C.border);
        doc.triangle(NAX, NAY-NAL, NAX-3.5, NAY+2, NAX, NAY+2, "F");
        // Metade direita (branca + borda)
        setFill(...C.panel); setDraw(...C.border); doc.setLineWidth(0.3);
        doc.triangle(NAX, NAY-NAL, NAX, NAY+2, NAX+3.5, NAY+2, "FD");
        // Ponteiro sul
        setFill(...C.border);
        doc.triangle(NAX-2, NAY+2, NAX+2, NAY+2, NAX, NAY+NAL*0.6, "F");
        // Círculo central
        setFill(...C.panel); setDraw(...C.border); doc.setLineWidth(0.25);
        doc.circle(NAX,NAY+2,1.5,"FD");
        // "N"
        setTxt(...C.txt1); doc.setFontSize(7.5); doc.setFont("helvetica","bold");
        doc.text("N",NAX,NAY-NAL-1.5,{align:"center"});
        // nota
        setTxt(...C.txt3); doc.setFontSize(3.5); doc.setFont("helvetica","normal");
        doc.text("(Norte Geográfico)",NAX,NAY+NAL*0.6+6,{align:"center"});

        // Escala gráfica
        if(bounds){
          const SBX=CX2+4, SBY=CY0+36, SBH=2.5;
          const latMid=(bounds.getNorth()+bounds.getSouth())/2;
          const kmPerMm=(bounds.getEast()-bounds.getWest())*111.32*Math.cos(latMid*Math.PI/180)/MW;
          const tgtKm=kmPerMm*(C2W-18)*0.5;
          const mag=Math.pow(10,Math.floor(Math.log10(tgtKm||1)));
          const niceKm=[1,2,5,10,25,50,100,200,500,1000];
          const scKm=(niceKm.find(n=>n*mag>=tgtKm*0.5)||tgtKm) as number;
          const scMm=Math.min(scKm/(kmPerMm||1),C2W-16);
          setTxt(...C.txt1); doc.setFontSize(4.2); doc.setFont("helvetica","bold");
          doc.text("ESCALA GRÁFICA",SBX,SBY-2);
          for(let i=0;i<5;i++){
            const sw=scMm/5;
            setFill(i%2===0?20:255,i%2===0?20:255,i%2===0?20:255);
            doc.rect(SBX+i*sw,SBY,sw,SBH,"F");
          }
          setDraw(...C.border); doc.setLineWidth(0.25); doc.rect(SBX,SBY,scMm,SBH);
          setTxt(...C.txt1); doc.setFontSize(3.8); doc.setFont("helvetica","normal");
          doc.text("0",SBX,SBY+SBH+2.5);
          const scLbl=scKm>=1000?`${(scKm/1000).toFixed(0)}.000 m`:`${scKm} km`;
          doc.text(scLbl,SBX+scMm,SBY+SBH+2.5,{align:"right"});
          // Projeção
          setTxt(...C.txt3); doc.setFontSize(3.8); doc.setFont("helvetica","normal");
          doc.text("Proj. UTM · Datum: SIRGAS 2000",SBX,SBY+SBH+7);
          doc.text(`Centro: ${center.lat.toFixed(3)}°, ${center.lng.toFixed(3)}°`,SBX,SBY+SBH+11);
        }
      }

      // ── Col 3: Título + Empreendimento + Fontes ─────────────────────────
      {
        const CCx3=CX3+C3W/2;
        const TY=CY0+9;
        setTxt(...C.txt1); doc.setFontSize(8.5); doc.setFont("helvetica","bold");
        const ct=mapTitle.length>58?mapTitle.slice(0,56)+"…":mapTitle;
        doc.text(ct,CCx3,TY,{align:"center"});
        setDraw(...C.borderM); doc.setLineWidth(0.2);
        doc.line(CX3+4,TY+2,CX3+C3W-4,TY+2);

        setTxt(...C.txt2); doc.setFontSize(5); doc.setFont("helvetica","bold");
        doc.text("EMPREENDIMENTO",CCx3,TY+7,{align:"center"});
        const empN=empData.length===1?empData[0].nome
          :empData.length>1?`${empData[0].nome} + ${empData.length-1}`
          :"Todos os empreendimentos";
        const eLines=doc.splitTextToSize(empN,C3W-8);
        setTxt(...C.txt1); doc.setFontSize(5.5); doc.setFont("helvetica","normal");
        doc.text(eLines[0]||"",CCx3,TY+12,{align:"center"});
        if(eLines[1]) doc.text(eLines[1],CCx3,TY+17,{align:"center"});

        setDraw(...C.borderL); doc.setLineWidth(0.15);
        doc.line(CX3+4,TY+19,CX3+C3W-4,TY+19);

        setTxt(...C.txt3); doc.setFontSize(3.8); doc.setFont("helvetica","normal");
        doc.text("Fontes: Esri, USDA, GeoEye (World Imagery)",CCx3,TY+23,{align:"center"});
        doc.text("Vetores: © OpenStreetMap contributors",CCx3,TY+27,{align:"center"});

        setTxt(...C.txt3); doc.setFontSize(3.5);
        doc.text(`Gerado: ${new Date().toLocaleString("pt-BR")}`,CX3+3,CY0+CH-6);
        doc.text("sgai.maurivangestao.online",CX3+3,CY0+CH-2);
      }

      // ─────────────────────────────────────────────────────────────────────
      // 6. SALVAR
      // ─────────────────────────────────────────────────────────────────────
      doc.save(`SGAI_Mapa_Cartografico_${new Date().toISOString().slice(0,10)}.pdf`);
      toast({ title: "PDF cartográfico gerado!", description: "Arquivo salvo com sucesso." });
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive" });
    }
  };

  // ── Estilo ────────────────────────────────────────────────────────────────────
  const isDark   = mapStyle === "dark" || mapStyle === "satellite";
  const textBase = isDark ? "text-slate-200" : "text-slate-800";
  const panelBg  = isDark ? "bg-slate-900/95 border-slate-700/50" : "bg-white/95 border-slate-200";
  const subText  = isDark ? "text-slate-400" : "text-slate-500";
  const tabBtnCls = (active: boolean) =>
    `flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${active
      ? (isDark ? "bg-slate-700 text-cyan-400" : "bg-slate-200 text-slate-900")
      : subText + " hover:opacity-80"}`;

  const selectedLics = selectedEmp ? (licByEmp.get(selectedEmp.id) || []) : [];
  const selectedComp = selectedEmp ? computeCompliance(selectedLics) : null;
  const selectedTc   = selectedEmp ? getTipoConfig(selectedEmp.tipo) : null;

  return (
    <div className="relative w-full overflow-hidden" style={{ height: "100vh", background: isDark ? "#0f172a" : "#f1f5f9" }}>

      {/* ── Barra de título ── */}
      <div className={`absolute top-0 left-0 right-0 z-[1000] flex items-center justify-between px-4 backdrop-blur-sm border-b ${panelBg}`}
           style={{ height: 44 }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/empreendimentos")}
            className={`flex items-center gap-1.5 text-xs ${subText} hover:opacity-80 px-2 py-1 rounded border
              ${isDark ? "border-slate-700/50 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-100"}`}>
            <ArrowLeft className="w-3.5 h-3.5" /><span className="hidden sm:inline">Voltar</span>
          </button>
          <Globe className="w-5 h-5 text-cyan-500" />
          <span className={`font-bold text-sm tracking-wide ${textBase}`}>Mapa 3D</span>
          <Badge variant="outline" className="text-xs border-cyan-500/40 text-cyan-500 bg-cyan-500/10">
            {empData.length} empreendimentos
          </Badge>
          {empData.length > 0 && (
            <button
              onClick={() => {
                if (mapRef.current && empData[0]) {
                  mapRef.current.flyTo([empData[0].lat, empData[0].lng], 14, { duration: 1.2 });
                }
              }}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border-2 border-amber-400 bg-amber-400/20 text-amber-300 hover:bg-amber-400/40 font-semibold animate-pulse"
              title={`Centralizar em ${empData[0]?.nome}`}
            >
              <span>🎯</span>
              <span className="hidden sm:inline">Ir para empreendimento</span>
            </button>
          )}
          {visibleGeoLayers.size > 0 && (
            <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-500 bg-emerald-500/10">
              {visibleGeoLayers.size} camada{visibleGeoLayers.size !== 1 ? "s" : ""} ativa{visibleGeoLayers.size !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <div className="hidden md:flex items-center gap-4 text-xs">
          {[
            { color: "bg-red-500",     label: `${kpis.criticos} crítico${kpis.criticos !== 1 ? "s" : ""}` },
            { color: "bg-amber-400",   label: `${kpis.atencao} atenção` },
            { color: "bg-emerald-400", label: `${kpis.regulares} regular${kpis.regulares !== 1 ? "es" : ""}` },
          ].map(k => (
            <div key={k.label} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${k.color}`} />
              <span className={subText}>{k.label}</span>
            </div>
          ))}
          <div className="w-px h-4 bg-slate-400/30" />
          <Select value={mapStyle} onValueChange={(v: any) => setMapStyle(v)}>
            <SelectTrigger className="h-7 text-xs w-28 bg-slate-800/80 border-slate-600 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">🌑 Dark</SelectItem>
              <SelectItem value="light">🌕 Light</SelectItem>
              <SelectItem value="voyager">🗺️ Voyager</SelectItem>
              <SelectItem value="satellite">🛰️ Satélite</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <button onClick={() => setPanelOpen(p => !p)}
          className={`flex items-center gap-1 text-xs ${subText} hover:opacity-80 px-2 py-1 rounded`}>
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Controles</span>
          {panelOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
      </div>

      {/* ── Mapa (Leaflet vanilla) ── */}
      <div ref={containerRef} style={{
        position: "absolute", top: 44, bottom: 0, left: 0,
        right: compareModeActive ? "50%" : 0, zIndex: 1,
        transition: "right 0.3s ease",
      }} />

      {/* ── Modo Comparação: segundo mapa satélite ── */}
      {compareModeActive && (
        <div style={{ position: "absolute", top: 44, bottom: 0, right: 0, left: "50%", zIndex: 1 }}>
          <div ref={compareContainerRef} style={{ width: "100%", height: "100%" }} />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
            <div className="backdrop-blur-sm bg-black/60 text-white text-[10px] rounded-full px-3 py-1 flex items-center gap-2">
              <Columns2 className="w-3 h-3" /> Satélite (comparação)
            </div>
          </div>
          <div className="absolute top-2 left-2 z-[100] pointer-events-none">
            <div className="backdrop-blur-sm bg-black/60 text-white text-[10px] rounded-full px-3 py-1">
              Mapa atual ←
            </div>
          </div>
          <button onClick={() => setCompareModeActive(false)}
            className="absolute top-2 right-2 z-[100] w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90 text-xs">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Painel lateral esquerdo ── */}
      {panelOpen && (
        <div className={`eco-sidebar-anim absolute z-[999] overflow-y-auto flex flex-col ${panelBg}`}
             style={{ top: 44, left: 0, bottom: 0, width: 288, borderRight: "1px solid" }}>

          {/* Abas */}
          <div className={`flex gap-1 p-2 border-b ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
            <button className={tabBtnCls(activeTab === "controles")} onClick={() => setActiveTab("controles")}>
              <MapPin className="w-3 h-3 inline mr-1" />Empreend.
            </button>
            <button className={tabBtnCls(activeTab === "camadas")} onClick={() => setActiveTab("camadas")}>
              <Layers className="w-3 h-3 inline mr-1" />Camadas
              {camadas.length > 0 && (
                <span className="ml-1 text-[9px] bg-cyan-500/20 text-cyan-400 rounded px-1">{camadas.length}</span>
              )}
            </button>
            <button className={tabBtnCls(activeTab === "analise")} onClick={() => setActiveTab("analise")}>
              <Activity className="w-3 h-3 inline mr-1" />Análise
            </button>
          </div>

          {/* ── Tab: Controles de empreendimentos ── */}
          {activeTab === "controles" && (
            <>
              <div className="p-4 border-b border-slate-700/30">
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${subText}`}>Filtros</p>
                <div className="flex flex-col gap-2">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os status</SelectItem>
                      <SelectItem value="ativo">✅ Ativo</SelectItem>
                      <SelectItem value="em_execucao">🔵 Em Execução</SelectItem>
                      <SelectItem value="em_planejamento">🟡 Planejamento</SelectItem>
                      <SelectItem value="concluido">⚫ Concluído</SelectItem>
                      <SelectItem value="inativo">🔴 Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterTipo} onValueChange={setFilterTipo}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os tipos</SelectItem>
                      {tiposUnicos.map(t => (
                        <SelectItem key={t} value={t}>{getTipoConfig(t).icon} {getTipoConfig(t).label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-4 border-b border-slate-700/30">
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${subText}`}>Camadas Visíveis</p>
                <div className="flex flex-col gap-3">
                  {[
                    {
                      id: "markers", label: "Marcadores de Impacto", icon: <BarChart3 className="w-3.5 h-3.5" />,
                      val: layerMarkers, set: setLayerMarkers,
                      tip: "Ícones coloridos sobre cada empreendimento. A cor reflete a conformidade das licenças (verde = regular, amarelo = atenção, vermelho = crítico). O ícone representa o tipo (💧 hidrelétrica, ⛏️ mineração, etc.).",
                    },
                    {
                      id: "zonas", label: "Zonas de Influência (AID)", icon: <Waves className="w-3.5 h-3.5" />,
                      val: layerZonas, set: setLayerZonas,
                      tip: "Círculo estimado da Área de Influência Direta (AID) de cada empreendimento, calculado com base no tipo e porte (ex: mineração = 55 km, solar = 18 km). Use o slider 'Raio de impacto' para ajustar a escala.",
                    },
                    {
                      id: "heatmap", label: "Biodiversidade (Campo)", icon: <Thermometer className="w-3.5 h-3.5" />,
                      val: layerHeatmap, set: setLayerHeatmap,
                      tip: "Manchas verdes semitransparentes representando registros de monitoramento de campo (fauna, flora, herpetofauna etc.). A intensidade indica abundância. Sobreposição com empreendimentos indica pressão sobre a biodiversidade.",
                    },
                    {
                      id: "arcos", label: "Conexões por Unidade", icon: <Zap className="w-3.5 h-3.5" />,
                      val: layerArcos, set: setLayerArcos,
                      tip: "Linhas tracejadas conectando empreendimentos da mesma unidade organizacional (filial). Útil para identificar clusters de risco regional e avaliar a carga de gestão por unidade.",
                    },
                    {
                      id: "bioHeatmap", label: "Heatmap de Biodiversidade", icon: <Radio className="w-3.5 h-3.5" />,
                      val: layerBioHeatmap, set: setLayerBioHeatmap,
                      tip: "Círculos coloridos por densidade (verde = baixa, amarelo/vermelho = alta) representando registros de campo. Mostra onde a biodiversidade está concentrada ou sob pressão.",
                    },
                    {
                      id: "aidConcentrico", label: "Zonas ADA / AID / AII", icon: <Target className="w-3.5 h-3.5" />,
                      val: layerAidConcentrico, set: setLayerAidConcentrico,
                      tip: camadas.some(c => ["zona_ada","zona_aid","zona_aii"].includes(c.categoria))
                        ? "Exibindo as zonas reais carregadas via KMZ / Shapefile. Para adicionar ou substituir, use os botões abaixo."
                        : "Sem arquivos carregados — exibindo anéis estimados por empreendimento. Importe um KMZ ou Shapefile com as poligonais reais usando os botões abaixo.",
                    },
                  ].map(item => (
                    <div key={item.id}>
                      <div className="flex items-center justify-between">
                        <div className={`flex items-center gap-2 ${subText}`}>
                          <span className="opacity-60">{item.icon}</span>
                          <span className={`text-xs ${textBase}`}>{item.label}</span>
                        </div>
                        <Switch checked={item.val} onCheckedChange={item.set}
                          className="scale-75 data-[state=checked]:bg-cyan-500" />
                      </div>
                      <p className={`text-[10px] leading-relaxed mt-1 mb-1 pl-5 ${subText} opacity-75`}>{item.tip}</p>
                      {item.id === "aidConcentrico" && (
                        <div className="flex items-center gap-1 mt-1.5 pl-5 flex-wrap">
                          {([
                            { cat: "zona_ada", label: "ADA", color: "#ef4444" },
                            { cat: "zona_aid", label: "AID", color: "#f59e0b" },
                            { cat: "zona_aii", label: "AII", color: "#22c55e" },
                          ] as const).map(z => (
                            <button key={z.cat}
                              onClick={() => { setUploadCat(z.cat); setUploadCor(z.color); setUploadNome(`${z.label} — `); setUploadOpen(true); }}
                              className="text-[9px] px-2 py-0.5 rounded font-mono font-semibold border transition-opacity hover:opacity-90"
                              style={{ borderColor: z.color + "70", color: z.color, backgroundColor: z.color + "18" }}>
                              + {z.label}
                            </button>
                          ))}
                          <span className={`text-[9px] ${subText} opacity-60`}>KMZ / SHP</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-b border-slate-700/30">
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${subText}`}>Escala Visual</p>
                <div className="flex flex-col gap-4">
                  <div>
                    <div className={`flex justify-between text-xs mb-2 ${subText}`}>
                      <span>Tamanho dos marcadores</span>
                      <span className="text-cyan-500 font-mono">{markerMulti.toFixed(1)}×</span>
                    </div>
                    <Slider min={0.3} max={3.0} step={0.1} value={[markerMulti]}
                      onValueChange={([v]) => setMarkerMulti(v)} className="[&>span]:bg-cyan-500" />
                  </div>
                  <div>
                    <div className={`flex justify-between text-xs mb-2 ${subText}`}>
                      <span>Raio de impacto (AID)</span>
                      <span className="text-emerald-500 font-mono">{raioMulti.toFixed(1)}×</span>
                    </div>
                    <Slider min={0.1} max={3.0} step={0.1} value={[raioMulti]}
                      onValueChange={([v]) => setRaioMulti(v)} className="[&>span]:bg-emerald-500" />
                  </div>
                </div>
              </div>

              {/* ── Filtro Temporal de Campo ── */}
              <div className="p-4 border-b border-slate-700/30">
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${subText} flex items-center gap-1.5`}>
                    <Calendar className="w-3 h-3" /> Filtro Temporal
                  </p>
                  {(campoDateFrom || campoDateTo) && (
                    <button onClick={() => { setCampoDateFrom(""); setCampoDateTo(""); }}
                      className="text-[9px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5">
                      <X className="w-2.5 h-2.5" />Limpar
                    </button>
                  )}
                </div>
                <p className={`text-[9px] ${subText} mb-2`}>
                  Filtra pontos de campo por data de coleta.
                  {campoDateFrom || campoDateTo ? ` ${heatmapFiltered.length} de ${heatmapData.length} pontos` : ""}
                </p>
                <div className="flex gap-1.5">
                  <input type="date" value={campoDateFrom} onChange={e => setCampoDateFrom(e.target.value)}
                    className={`flex-1 text-[10px] rounded px-1.5 py-1 border outline-none
                      ${isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-700"}`} />
                  <span className={`text-[10px] ${subText} flex items-center`}>→</span>
                  <input type="date" value={campoDateTo} onChange={e => setCampoDateTo(e.target.value)}
                    className={`flex-1 text-[10px] rounded px-1.5 py-1 border outline-none
                      ${isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-700"}`} />
                </div>
              </div>

              {/* ── Ferramentas de Medição e Exportação ── */}
              <div className="p-4 border-b border-slate-700/30">
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${subText}`}>Ferramentas</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Medir área */}
                  <button onClick={() => setDrawModeActive(v => !v)}
                    className={`flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded-lg border transition-colors
                      ${drawModeActive
                        ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                        : isDark ? "border-slate-600 text-slate-400 hover:border-cyan-500 hover:text-cyan-400" : "border-slate-300 text-slate-500 hover:border-cyan-500 hover:text-cyan-600"}`}>
                    <Ruler className="w-3 h-3" />
                    {drawModeActive ? "Medir (ativo)" : "Medir Área"}
                  </button>
                  {/* Comparar mapas */}
                  <button onClick={() => setCompareModeActive(v => !v)}
                    className={`flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded-lg border transition-colors
                      ${compareModeActive
                        ? "bg-violet-500/20 border-violet-500 text-violet-400"
                        : isDark ? "border-slate-600 text-slate-400 hover:border-violet-500 hover:text-violet-400" : "border-slate-300 text-slate-500 hover:border-violet-500 hover:text-violet-600"}`}>
                    <Columns2 className="w-3 h-3" />
                    {compareModeActive ? "Comparar (on)" : "Comparar"}
                  </button>
                  {/* Exportar CSV */}
                  <button onClick={exportCSV}
                    className={`flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded-lg border transition-colors
                      ${isDark ? "border-slate-600 text-slate-400 hover:border-emerald-500 hover:text-emerald-400" : "border-slate-300 text-slate-500 hover:border-emerald-500 hover:text-emerald-600"}`}>
                    <Download className="w-3 h-3" />Exportar CSV
                  </button>
                  {/* Exportar KML */}
                  <button onClick={exportKML}
                    className={`flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded-lg border transition-colors
                      ${isDark ? "border-slate-600 text-slate-400 hover:border-orange-500 hover:text-orange-400" : "border-slate-300 text-slate-500 hover:border-orange-500 hover:text-orange-600"}`}>
                    <Download className="w-3 h-3" />Exportar KML
                  </button>
                  {/* Exportar PDF */}
                  <button onClick={() => {
                      setPdfLayerSel(new Set(visibleGeoLayers));
                      setPdfShowEmp(true); setPdfShowCampo(true);
                      setPdfShowHeatmap(true); setPdfShowZones(true);
                      setShowPDFDialog(true);
                    }}
                    className={`col-span-2 flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded-lg border transition-colors
                      ${isDark ? "border-slate-600 text-slate-400 hover:border-red-400 hover:text-red-400" : "border-slate-300 text-slate-500 hover:border-red-400 hover:text-red-500"}`}>
                    <Download className="w-3 h-3" />Exportar Relatório PDF
                  </button>
                </div>
                {drawModeActive && (
                  <p className={`text-[9px] mt-2 leading-relaxed ${isDark ? "text-cyan-400/70" : "text-cyan-600"}`}>
                    🖱️ Clique no mapa para adicionar vértices · Cada clique estende o polígono
                    {drawnAreaHa !== null && ` · Área: ${drawnAreaHa.toLocaleString("pt-BR")} ha`}
                  </p>
                )}
              </div>

              {/* ── Stats do viewport (painel informativo) ── */}
              <div className="p-4 border-b border-slate-700/30">
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${subText} flex items-center gap-1.5`}>
                    <BarChart2 className="w-3 h-3" /> Viewport Atual
                  </p>
                  <button onClick={() => setShowStatsPanel(v => !v)}
                    className={`text-[9px] ${showStatsPanel ? "text-cyan-400" : subText} hover:opacity-80`}>
                    {showStatsPanel ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: "Empreend.", value: viewportStats.emps, color: "text-cyan-400" },
                    { label: "Pontos campo", value: viewportStats.campo, color: "text-emerald-400" },
                    { label: "Ameaçadas", value: viewportStats.threatened, color: "text-amber-400" },
                  ].map(s => (
                    <div key={s.label} className={`rounded-lg p-2 text-center ${isDark ? "bg-slate-800/60" : "bg-slate-100"}`}>
                      <p className={`text-base font-bold font-mono ${s.color}`}>{s.value}</p>
                      <p className={`text-[8px] leading-tight ${subText}`}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 flex-1">
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${subText}`}>
                  Empreendimentos ({empData.length})
                </p>
                <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
                  {empData.map(e => (
                    <button key={e.id} onClick={() => flyTo(e)}
                      className={`flex items-center gap-2.5 w-full text-left rounded-lg px-2.5 py-2
                        hover:bg-slate-700/30 transition-colors
                        ${selectedEmp?.id === e.id ? "bg-slate-700/50 ring-1 ring-cyan-500/40" : ""}`}>
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: e.comp.color }} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${textBase}`}>{e.nome}</p>
                        <p className={`text-[10px] truncate ${subText}`}>{e.tc.icon} {e.municipio || e.localizacao}</p>
                      </div>
                      <span className={`text-[9px] ${subText} flex-shrink-0`}>{e.lics.length}lic</span>
                    </button>
                  ))}
                  {empData.length === 0 && (
                    <div className={`text-center py-6 text-xs ${subText}`}>
                      Nenhum empreendimento com coordenadas registradas.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Tab: Análise de Risco Ambiental ── */}
          {activeTab === "analise" && (
            <div className="flex flex-col flex-1 overflow-y-auto">
              {/* Header explicativo */}
              <div className={`p-3 border-b text-[10px] ${subText} ${isDark ? "border-slate-700/40 bg-slate-800/40" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-cyan-500" />
                  <div>
                    <p className="font-semibold text-cyan-500 mb-1">Índice de Risco Ambiental (IRA)</p>
                    <p className="leading-relaxed">Score 0–100 calculado com 3 componentes: <strong>risco de licenças</strong> (vencidas/a vencer, peso 40%), <strong>fator de impacto</strong> do tipo de empreendimento (peso 30%) e <strong>pressão de biodiversidade</strong> — registros de campo a &lt;50 km (peso 30%). Quanto maior o score, maior a prioridade de atenção.</p>
                  </div>
                </div>
              </div>

              {/* KPIs rápidos */}
              <div className={`grid grid-cols-3 gap-0 border-b ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
                {[
                  { label: "Alto Risco",  val: riskAnalysis.scores.filter(s => s.score >= 65).length, color: "#ef4444", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
                  { label: "Médio Risco", val: riskAnalysis.scores.filter(s => s.score >= 35 && s.score < 65).length, color: "#f59e0b", icon: <TrendingUp className="w-3.5 h-3.5" /> },
                  { label: "Baixo Risco", val: riskAnalysis.scores.filter(s => s.score < 35).length, color: "#22c55e", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
                ].map((k, i) => (
                  <div key={k.label} className={`flex flex-col items-center py-3 ${i < 2 ? (isDark ? "border-r border-slate-700/40" : "border-r border-slate-200") : ""}`}>
                    <span style={{ color: k.color }}>{k.icon}</span>
                    <span className={`text-lg font-bold mt-1`} style={{ color: k.color }}>{k.val}</span>
                    <span className={`text-[9px] ${subText}`}>{k.label}</span>
                  </div>
                ))}
              </div>

              {/* Ranking de risco */}
              <div className={`p-3 border-b ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${subText}`}>
                  Ranking por Risco ({riskAnalysis.scores.length})
                </p>
                {riskAnalysis.scores.length === 0 && (
                  <p className={`text-[10px] ${subText} text-center py-3`}>Nenhum empreendimento com coordenadas.</p>
                )}
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                  {riskAnalysis.scores.map((s, idx) => (
                    <button key={s.id} onClick={() => flyTo(s as any)}
                      className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors ${isDark ? "hover:bg-slate-800/60 bg-slate-800/30" : "hover:bg-slate-100 bg-slate-50"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono w-4 flex-shrink-0 ${subText}`}>#{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className={`text-[11px] font-semibold truncate ${textBase}`}>{s.nome}</p>
                            <span className="text-[10px] font-bold flex-shrink-0" style={{ color: s.riskColor }}>{s.score}</span>
                          </div>
                          {/* Barra de score */}
                          <div className={`mt-1 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-slate-700" : "bg-slate-200"}`}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${s.score}%`, background: s.riskColor }} />
                          </div>
                          {/* Componentes */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[9px] ${subText}`} title="Risco de licenças (0–40)">📋 {s.licRisk}</span>
                            <span className={`text-[9px] ${subText}`} title="Fator de impacto do tipo (0–30)">⚡ {s.typeFactor}</span>
                            <span className={`text-[9px] ${subText}`} title="Pressão de biodiversidade (0–30)">🌿 {s.bioPressure}</span>
                            <span className={`text-[9px] flex-shrink-0 font-medium ml-auto px-1.5 py-0.5 rounded`}
                              style={{ background: `${s.riskColor}22`, color: s.riskColor }}>{s.riskLabel}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Previsão de vencimentos */}
              <div className={`p-3 border-b ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${subText}`}>
                  Previsão de Vencimentos de Licenças
                </p>
                <p className={`text-[9px] ${subText} mb-3 leading-relaxed`}>
                  Distribuição temporal das {licencas.length} licenças cadastradas, agrupadas por horizonte de vencimento.
                </p>
                {[
                  { label: "Já vencidas",    val: riskAnalysis.forecast.expired, color: "#ef4444", tip: "Licenças com dataVencimento anterior a hoje — requerem renovação imediata." },
                  { label: "Próx. 30 dias",  val: riskAnalysis.forecast.d30,     color: "#f97316", tip: "Vencimento iminente: prioridade máxima de renovação." },
                  { label: "31 a 60 dias",   val: riskAnalysis.forecast.d60,     color: "#f59e0b", tip: "Prazo curto: iniciar processo de renovação." },
                  { label: "61 a 90 dias",   val: riskAnalysis.forecast.d90,     color: "#eab308", tip: "Planejar renovação com antecedência." },
                  { label: "91 a 180 dias",  val: riskAnalysis.forecast.d180,    color: "#84cc16", tip: "Monitorar e agendar renovação." },
                  { label: "Mais de 180d / sem data", val: riskAnalysis.forecast.ok, color: "#22c55e", tip: "Situação tranquila." },
                ].map(row => (
                  <div key={row.label} title={row.tip} className="mb-2">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className={`text-[10px] ${subText}`}>{row.label}</span>
                      <span className="text-[10px] font-bold" style={{ color: row.color }}>{row.val}</span>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-slate-700" : "bg-slate-200"}`}>
                      <div className="h-full rounded-full"
                        style={{ width: `${(row.val / riskAnalysis.maxForecast) * 100}%`, background: row.color, minWidth: row.val > 0 ? 4 : 0 }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Clustering Geográfico K-Means ── */}
              <div className={`p-3 border-b ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${subText}`}>
                    📊 Clustering Geográfico (K-Means)
                  </p>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">Ativo</span>
                </div>
                <p className={`text-[9px] ${subText} mb-3 leading-relaxed`}>
                  Empreendimentos agrupados por proximidade geográfica. Círculos tracejados visíveis no mapa. Clique num cluster para centralizar.
                </p>
                {!clusterAnalysis ? (
                  <p className={`text-[10px] ${subText} text-center py-2`}>Mínimo 3 empreendimentos com coordenadas.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {clusterAnalysis.clusters.map(cl => (
                      <button key={cl.id}
                        onClick={() => mapRef.current?.flyTo([cl.centroid.lat, cl.centroid.lng], 8, { duration: 1.2 })}
                        className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors
                          ${isDark ? "hover:bg-slate-800/60 bg-slate-800/30" : "hover:bg-slate-100 bg-slate-50"}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cl.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`text-[11px] font-semibold ${textBase}`}>{cl.name}</span>
                              <span className="text-[10px] font-bold" style={{ color: cl.riskColor }}>IRA {cl.avgRisk}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[9px] ${subText}`}>{cl.members.length} empreend.</span>
                              <span className={`text-[9px] ${subText}`}>·</span>
                              <span className={`text-[9px] ${subText}`}>raio ~{Math.round(cl.radiusKm)} km</span>
                              <span className="text-[8px] px-1 py-0.5 rounded ml-auto"
                                style={{ background: `${cl.riskColor}22`, color: cl.riskColor }}>{cl.riskLabel}</span>
                            </div>
                            {/* Membros */}
                            <div className={`text-[9px] mt-1 ${subText} truncate`}>
                              {cl.members.slice(0, 3).map(m => m.nome).join(", ")}
                              {cl.members.length > 3 ? ` +${cl.members.length - 3}` : ""}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Análise de Sobreposição Espacial ── */}
              <div className={`p-3 border-b ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${subText}`}>
                    🗺️ Sobreposição Espacial
                  </p>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-semibold
                    ${visibleGeoLayers.size > 0 ? "bg-emerald-500/20 text-emerald-400" : `${isDark ? "bg-slate-700 text-slate-400" : "bg-slate-200 text-slate-500"}`}`}>
                    {visibleGeoLayers.size > 0 ? "Ativo" : "Ative camadas"}
                  </span>
                </div>
                {visibleGeoLayers.size === 0 ? (
                  <p className={`text-[9px] ${subText} leading-relaxed`}>
                    Ative camadas KMZ/GeoJSON na aba <strong>Camadas</strong> para detectar automaticamente quais empreendimentos estão dentro de UCs, TIs, APPs ou qualquer polígono carregado.
                  </p>
                ) : overlapAnalysis.length === 0 ? (
                  <p className={`text-[10px] ${subText} text-center py-2`}>
                    ✅ Nenhuma sobreposição detectada com as camadas ativas.
                  </p>
                ) : (
                  <>
                    <p className={`text-[9px] ${subText} mb-2 leading-relaxed`}>
                      {overlapAnalysis.length} sobreposição(ões) detectada(s). Empreendimentos dentro de polígonos das camadas ativas:
                    </p>
                    <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                      {overlapAnalysis.map((ov, idx) => {
                        const catCfg = CATEGORIA_CONFIG[ov.camada.categoria] || CATEGORIA_CONFIG.outro;
                        const risk = riskAnalysis.scores.find(s => s.id === ov.emp.id);
                        return (
                          <button key={idx}
                            onClick={() => mapRef.current?.flyTo([ov.emp.lat, ov.emp.lng], 11, { duration: 1.2 })}
                            className={`w-full text-left rounded-lg px-2 py-1.5 transition-colors border
                              ${isDark ? "bg-red-950/20 border-red-900/30 hover:bg-red-950/40" : "bg-red-50 border-red-200 hover:bg-red-100"}`}>
                            <div className="flex items-start gap-1.5">
                              <span className="text-xs flex-shrink-0 mt-0.5">⚠️</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[11px] font-semibold truncate ${textBase}`}>{ov.emp.nome}</p>
                                <p className={`text-[9px] truncate ${subText}`}>
                                  dentro de <span className="font-medium">{ov.featureName}</span>
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className={`text-[8px] px-1 py-0.5 rounded`}
                                    style={{ background: `${ov.camada.cor || catCfg.color}33`, color: ov.camada.cor || catCfg.color }}>
                                    {catCfg.icon} {catCfg.label}
                                  </span>
                                  {risk && (
                                    <span className="text-[8px]" style={{ color: risk.riskColor }}>IRA {risk.score}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* ── MapBiomas Alerta: resumo ── */}
              <div className={`p-3 border-b ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${subText}`}>
                    🪓 Alertas MapBiomas
                  </p>
                  {mbAlerts.length > 0 && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-semibold">
                      {mbAlerts.length} alertas
                    </span>
                  )}
                </div>

                {!mbEnabled ? (
                  <p className={`text-[9px] ${subText} leading-relaxed`}>
                    Ative a camada <strong>MapBiomas Alerta</strong> na aba <strong>Camadas</strong> para visualizar alertas de desmatamento na região dos seus empreendimentos.
                  </p>
                ) : !mbAuthenticated ? (
                  <p className={`text-[9px] ${subText} leading-relaxed`}>
                    Faça login no MapBiomas Alerta na aba <strong>Camadas</strong> para carregar os dados.
                  </p>
                ) : (mbLoading || mbPolygonsLoading) ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                    <span className={`text-[10px] ${subText}`}>
                      {mbPolygonsLoading ? "Carregando polígonos reais…" : "Buscando alertas…"}
                    </span>
                  </div>
                ) : mbError ? (
                  <p className="text-[10px] text-red-400">{mbError}</p>
                ) : mbAlerts.length === 0 ? (
                  <p className={`text-[10px] ${subText} text-center py-2`}>
                    ✅ Nenhum alerta de desmatamento encontrado para a região e período selecionados.
                  </p>
                ) : (
                  <>
                    {mbSummary && (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className={`rounded-lg p-2 ${isDark ? "bg-orange-950/30" : "bg-orange-50"}`}>
                          <p className={`text-[9px] ${subText}`}>Total alertas</p>
                          <p className="text-base font-bold text-orange-500">{mbSummary.total ?? mbAlerts.length}</p>
                        </div>
                        <div className={`rounded-lg p-2 ${isDark ? "bg-orange-950/30" : "bg-orange-50"}`}>
                          <p className={`text-[9px] ${subText}`}>Área afetada</p>
                          <p className="text-base font-bold text-orange-500">
                            {mbSummary.area ? `${(mbSummary.area).toFixed(0)} ha` : "—"}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                      {mbAlerts.slice(0, 25).map((al: any) => {
                        const lat = al.boundingBox ? (al.boundingBox.minY + al.boundingBox.maxY) / 2 : null;
                        const lng = al.boundingBox ? (al.boundingBox.minX + al.boundingBox.maxX) / 2 : null;
                        const detectedAt = al.detectedAt ? new Date(al.detectedAt).toLocaleDateString("pt-BR") : "—";
                        return (
                          <button key={al.alertCode}
                            onClick={() => { if (lat && lng && mapRef.current) mapRef.current.flyTo([lat, lng], 12, { duration: 1 }); }}
                            className={`w-full text-left rounded-lg px-2 py-1.5 transition-colors border
                              ${isDark ? "bg-orange-950/20 border-orange-900/30 hover:bg-orange-950/40" : "bg-orange-50 border-orange-200 hover:bg-orange-100"}`}>
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex-1 min-w-0">
                                <p className={`text-[11px] font-semibold ${textBase}`}>
                                  #<span className="font-mono">{al.alertCode}</span>
                                  <span className="ml-1.5 text-orange-500 font-normal">{(al.areaHa || 0).toFixed(1)} ha</span>
                                </p>
                                <p className={`text-[9px] truncate ${subText}`}>
                                  {(al.crossedCities || []).slice(0, 2).join(", ") || (al.crossedStates || []).join(", ") || "—"} · {detectedAt}
                                </p>
                                <p className={`text-[9px] truncate ${subText}`}>
                                  {(al.sources || []).join(", ")}
                                </p>
                              </div>
                              <span className="text-[9px] text-orange-400 flex-shrink-0 mt-0.5">🗺️</span>
                            </div>
                          </button>
                        );
                      })}
                      {mbAlerts.length > 25 && (
                        <p className={`text-[9px] ${subText} text-center py-1`}>
                          +{mbAlerts.length - 25} alertas não exibidos. Reduza o período para ver mais detalhes.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Análises ainda em desenvolvimento */}
              <div className="p-3">
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${subText}`}>
                  Próximas Análises
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    { icon: "🤖", title: "ML — Predição de Risco", desc: "Modelo preditivo treinado com histórico de vencimentos, tipo e bioma. Exige acumulação de dados históricos ao longo do tempo.", status: "Planejado" },
                    { icon: "📡", title: "Índice de Sensibilidade do Bioma", desc: "Cruzar coordenadas com MapBiomas (bioma, desmatamento) via API pública para calcular sensibilidade ecológica real da AID.", status: "API Externa" },
                    { icon: "⏱️", title: "Série Temporal de Conformidade", desc: "Evolução do índice de conformidade por unidade ao longo dos meses, identificando tendências de melhora ou piora.", status: "Planejado" },
                  ].map(item => (
                    <div key={item.title} className={`rounded-lg p-2.5 ${isDark ? "bg-slate-800/40" : "bg-slate-50"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-semibold ${textBase}`}>{item.title}</p>
                          <p className={`text-[9px] leading-relaxed mt-0.5 ${subText}`}>{item.desc}</p>
                        </div>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded flex-shrink-0 ${isDark ? "bg-slate-700 text-slate-400" : "bg-slate-200 text-slate-500"}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Camadas Geoespaciais ── */}
          {activeTab === "camadas" && (
            <div className="flex flex-col flex-1 overflow-hidden">

              {/* ── MapBiomas Alerta section ── */}
              <div className={`p-3 border-b ${isDark ? "border-slate-700/40 bg-orange-950/10" : "border-orange-200 bg-orange-50/40"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🪓</span>
                    <p className={`text-xs font-semibold ${textBase}`}>MapBiomas Alerta</p>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-semibold
                      ${mbAuthenticated ? "bg-emerald-500/20 text-emerald-400" : `${isDark ? "bg-slate-700 text-slate-400" : "bg-slate-200 text-slate-500"}`}`}>
                      {mbAuthenticated ? "Conectado" : "Desconectado"}
                    </span>
                  </div>
                  <Switch checked={mbEnabled} onCheckedChange={v => {
                    if (v && !mbAuthenticated) { setMbSignInOpen(true); return; }
                    setMbEnabled(v);
                  }} className="scale-75 data-[state=checked]:bg-orange-500" />
                </div>

                <p className={`text-[9px] ${subText} mb-2 leading-relaxed`}>
                  Alertas de desmatamento e degradação florestal no entorno dos seus empreendimentos (raio ~1° lat/lng).
                  Dados da plataforma MapBiomas Alerta — requer conta gratuita.
                </p>

                {/* Login inline */}
                {mbSignInOpen && !mbAuthenticated && (
                  <div className={`rounded-lg p-2.5 mb-2 border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
                    <p className={`text-[10px] font-semibold mb-2 ${textBase}`}>Login MapBiomas Alerta</p>
                    <div className="flex flex-col gap-1.5">
                      <input type="email" value={mbEmail} onChange={e => setMbEmail(e.target.value)}
                        placeholder="E-mail da conta"
                        className={`text-xs rounded px-2 py-1.5 border w-full ${isDark ? "bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500" : "bg-white border-slate-300 text-slate-800"}`} />
                      <input type="password" value={mbPassword} onChange={e => setMbPassword(e.target.value)}
                        placeholder="Senha"
                        className={`text-xs rounded px-2 py-1.5 border w-full ${isDark ? "bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500" : "bg-white border-slate-300 text-slate-800"}`} />
                      <div className="flex gap-1.5 mt-1">
                        <button onClick={async () => {
                          if (!mbEmail || !mbPassword) return;
                          setMbLoggingIn(true);
                          try {
                            const r = await fetch("/api/mapbiomas/signin", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ email: mbEmail, password: mbPassword }),
                            });
                            const d = await r.json();
                            if (d.success) {
                              setMbAuthenticated(true); setMbEnabled(true);
                              setMbSignInOpen(false); setMbPassword("");
                              toast({ title: "MapBiomas conectado!", description: "Alertas serão carregados no mapa." });
                            } else {
                              toast({ title: "Erro de login", description: d.error || "Credenciais inválidas", variant: "destructive" });
                            }
                          } catch (err: any) {
                            toast({ title: "Erro", description: err.message, variant: "destructive" });
                          } finally { setMbLoggingIn(false); }
                        }}
                          disabled={mbLoggingIn || !mbEmail || !mbPassword}
                          className="flex-1 text-xs py-1.5 rounded bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 transition-colors">
                          {mbLoggingIn ? "Entrando…" : "Entrar"}
                        </button>
                        <button onClick={() => setMbSignInOpen(false)}
                          className={`px-3 text-xs py-1.5 rounded ${isDark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}>
                          ✕
                        </button>
                      </div>
                      <a href="https://plataforma.alerta.mapbiomas.org/sign-up" target="_blank" rel="noopener noreferrer"
                        className="text-[9px] text-orange-400 hover:underline text-center">
                        Criar conta gratuita ↗
                      </a>
                    </div>
                  </div>
                )}

                {/* Controles quando autenticado */}
                {mbAuthenticated && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1">
                      <input type="date" value={mbStartDate} onChange={e => setMbStartDate(e.target.value)}
                        className={`flex-1 text-[10px] rounded px-1.5 py-1 border ${isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-700"}`} />
                      <span className={`text-[10px] ${subText} flex items-center`}>→</span>
                      <input type="date" value={mbEndDate} onChange={e => setMbEndDate(e.target.value)}
                        className={`flex-1 text-[10px] rounded px-1.5 py-1 border ${isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-700"}`} />
                    </div>
                    <select value={mbSources} onChange={e => setMbSources(e.target.value)}
                      className={`text-[10px] rounded px-1.5 py-1 border w-full ${isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-700"}`}>
                      <option value="All">Todas as fontes</option>
                      <option value="DeterbAmazonia">DETER Amazônia</option>
                      <option value="DeterCerrado">DETER Cerrado</option>
                      <option value="Glad">GLAD</option>
                      <option value="InemaBa">INEMA Bahia</option>
                      <option value="Sad">SAD</option>
                      <option value="SadCaatinga">SAD Caatinga</option>
                      <option value="SadMataAtlantica">SAD Mata Atlântica</option>
                      <option value="SadCerrado">SAD Cerrado</option>
                      <option value="SadPantanal">SAD Pantanal</option>
                      <option value="ProdesAmazonia">PRODES Amazônia</option>
                      <option value="ProdesCerrado">PRODES Cerrado</option>
                      <option value="SosInpe">SOS/INPE Mata Atlântica</option>
                    </select>
                    {/* Toggle polígonos reais */}
                    <div className={`rounded-lg px-2.5 py-2 border ${isDark ? "bg-red-950/20 border-red-900/30" : "bg-red-50 border-red-200"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <p className={`text-[10px] font-semibold ${textBase}`}>Polígonos reais de desmatamento</p>
                          <p className={`text-[9px] ${subText}`}>
                            {mbPolygonsLoading
                              ? "Carregando geometrias…"
                              : mbPolygonCount > 0
                              ? `${mbPolygonCount} polígono(s) no mapa (top 30)`
                              : "Nenhum polígono carregado"}
                          </p>
                        </div>
                        <Switch checked={mbShowPolygons} onCheckedChange={setMbShowPolygons}
                          className="scale-75 data-[state=checked]:bg-red-600 flex-shrink-0" />
                      </div>
                      <p className={`text-[8px] ${subText} leading-relaxed`}>
                        Exibe os contornos exatos das áreas detectadas. Cada polígono inclui informações de bioma, municípios, APPs e terras indígenas cruzadas.
                      </p>
                    </div>

                    {mbError && (
                      <p className="text-[9px] text-red-400 leading-snug break-all">{mbError}</p>
                    )}
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[9px] ${subText} flex-1`}>
                        {mbLoading
                          ? "Buscando alertas…"
                          : mbError
                          ? "Erro na busca"
                          : mbAlerts.length > 0
                          ? `${mbAlerts.length} marcador(es) no mapa${mbSummary?.total && mbSummary.total > mbAlerts.length ? ` (de ${mbSummary.total} encontrados)` : ""}`
                          : mbSummary?.total === 0
                          ? "Nenhum alerta no Brasil neste período"
                          : "Nenhum alerta encontrado"}
                      </span>
                      <button
                        onClick={() => { setMbEnabled(false); setTimeout(() => setMbEnabled(true), 50); }}
                        disabled={mbLoading}
                        className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${isDark ? "border-slate-600 text-slate-400 hover:border-orange-500 hover:text-orange-400" : "border-slate-300 text-slate-500 hover:border-orange-400 hover:text-orange-500"} disabled:opacity-40`}>
                        ↺
                      </button>
                      <button onClick={() => { setMbAuthenticated(false); setMbEnabled(false); fetch("/api/mapbiomas/signout", { method: "POST" }); }}
                        className={`text-[9px] ${subText} hover:text-red-400 underline`}>Sair</button>
                    </div>
                  </div>
                )}

                {!mbAuthenticated && !mbSignInOpen && (
                  <button onClick={() => setMbSignInOpen(true)}
                    className="w-full text-xs py-1.5 rounded border border-orange-500/50 text-orange-400 hover:bg-orange-500/10 transition-colors">
                    Conectar conta MapBiomas Alerta
                  </button>
                )}
              </div>

              {/* Upload rápido */}
              <div className={`p-3 border-b ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                  <DialogTrigger asChild>
                    <button className={`w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg border-dashed border-2 transition-colors
                      ${isDark ? "border-slate-600 text-slate-400 hover:border-cyan-500 hover:text-cyan-400" : "border-slate-300 text-slate-500 hover:border-cyan-500 hover:text-cyan-600"}`}>
                      <Upload className="w-3.5 h-3.5" />
                      Adicionar KMZ / KML / GeoJSON / Shapefile
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Adicionar Camada Geoespacial</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 pt-2">
                      <div>
                        <Label className="text-xs mb-1 block">Arquivo</Label>
                        <Input type="file" accept=".kmz,.kml,.geojson,.json,.zip,.shp"
                          onChange={e => { const f = e.target.files?.[0]; if (f) { setUploadFile(f); if (!uploadNome) setUploadNome(f.name.replace(/\.[^.]+$/, "")); } }}
                          className="text-xs" />
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {[".kmz",".kml",".geojson",".shp",".zip"].map(ext => (
                            <span key={ext} className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium
                              ${uploadFile?.name.toLowerCase().endsWith(ext)
                                ? "bg-cyan-500/20 text-cyan-400"
                                : isDark ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400"}`}>
                              {ext}
                            </span>
                          ))}
                        </div>
                        {uploadFile?.name.toLowerCase().endsWith('.zip') && (
                          <p className={`text-[9px] mt-1.5 leading-relaxed ${subText}`}>
                            ℹ️ O ZIP deve conter pelo menos o <strong>.shp</strong>. Inclua o <strong>.dbf</strong> para preservar os atributos das feições.
                          </p>
                        )}
                        {uploadFile?.name.toLowerCase().endsWith('.shp') && (
                          <p className={`text-[9px] mt-1.5 leading-relaxed text-amber-400`}>
                            ⚠️ Upload de .shp isolado não inclui atributos. Para preservar campos, compacte .shp + .dbf + .shx em um ZIP.
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Nome da camada</Label>
                        <Input value={uploadNome} onChange={e => setUploadNome(e.target.value)}
                          placeholder="Ex: Área de Influência Direta" className="text-xs h-8" />
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Fonte / Origem dos dados <span className={`${subText} font-normal`}>(opcional)</span></Label>
                        <Input value={uploadFonte} onChange={e => setUploadFonte(e.target.value)}
                          placeholder="Ex: IBGE 2023, SEMA-BA, ANA..." className="text-xs h-8" />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs mb-1 block">Categoria</Label>
                          <Select value={uploadCat} onValueChange={v => {
                            setUploadCat(v);
                            const autoColor: Record<string,string> = { zona_ada:"#ef4444", zona_aid:"#f59e0b", zona_aii:"#22c55e" };
                            if (autoColor[v]) setUploadCor(autoColor[v]);
                          }}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(CATEGORIA_CONFIG).map(([key, cfg]) => (
                                <SelectItem key={key} value={key}>{cfg.icon} {cfg.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">Cor</Label>
                          <div className="relative h-8 w-14">
                            <input type="color" value={uploadCor} onChange={e => setUploadCor(e.target.value)}
                              className="absolute inset-0 w-full h-full cursor-pointer rounded border border-slate-300 dark:border-slate-600 opacity-0" />
                            <div className="h-8 w-14 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center gap-1 text-[10px] font-mono overflow-hidden cursor-pointer"
                              style={{ backgroundColor: uploadCor + "33", borderColor: uploadCor }}>
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: uploadCor }} />
                            </div>
                          </div>
                        </div>
                      </div>
                      <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadNome}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-8">
                        {uploading ? "Processando..." : "Carregar no mapa"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Pontos de Monitoramento de Campo */}
              {campoSectionHidden && (
                <div className={`p-3 border-b ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
                  <button
                    onClick={() => { setCampoSectionHidden(false); refetchCampo(); }}
                    className={`w-full flex items-center justify-center gap-2 text-[10px] py-2 rounded-lg border transition-colors font-medium
                      ${isDark ? "border-slate-700 bg-slate-800/60 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40" : "border-slate-200 bg-slate-50 text-slate-500 hover:text-cyan-600 hover:border-cyan-300"}`}>
                    <Microscope className="w-3.5 h-3.5" />
                    Trazer Pontos de Monitoramento de Campo
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${isDark ? "bg-slate-700 text-slate-500" : "bg-slate-100 text-slate-400"}`}>{heatmapData.length}</span>
                  </button>
                </div>
              )}
              {!campoSectionHidden && (
                <div className={`p-3 border-b ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-[10px] font-semibold uppercase tracking-widest ${subText} flex items-center gap-1.5`}>
                      <Microscope className="w-3 h-3" /> Monitoramento de Campo
                      <span className="font-normal opacity-60">({heatmapData.length})</span>
                    </p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCampoVisibleGroups(new Set(campoGruposComGeo.keys()))}
                        className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${isDark ? "bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-700" : "bg-slate-100 text-slate-500 hover:text-cyan-600 border border-slate-200"}`}
                        title="Mostrar todos">
                        <Eye className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setCampoVisibleGroups(new Set())}
                        className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${isDark ? "bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-700" : "bg-slate-100 text-slate-500 hover:text-amber-500 border border-slate-200"}`}
                        title="Ocultar todos">
                        <EyeOff className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => { setCampoSectionHidden(true); setCampoVisibleGroups(new Set()); }}
                        className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${isDark ? "bg-slate-800 text-red-400/70 hover:text-red-400 border border-slate-700" : "bg-slate-100 text-red-400 hover:text-red-600 border border-slate-200"}`}
                        title="Ocultar painel">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {campoGruposComGeo.size === 0 && (
                      <div className={`text-center py-4 ${subText}`}>
                        <Microscope className="w-5 h-5 mx-auto mb-1.5 opacity-30" />
                        <p className="text-[10px] opacity-60 leading-relaxed">
                          Nenhum registro de campo<br />com coordenadas cadastrado.<br />
                          <a href="/campo" className="underline opacity-80 hover:opacity-100">Ir para Monitoramento de Campo</a>
                        </p>
                      </div>
                    )}
                    {Array.from(campoGruposComGeo.entries()).map(([grupo, count]) => {
                      const cfg = getCampoGrupoConfig(grupo);
                      const vis = campoVisibleGroups.has(grupo);
                      const confirmingThis = campoDeleteConfirm === grupo;
                      const toggleVis = () => setCampoVisibleGroups(prev => {
                        const next = new Set(prev); vis ? next.delete(grupo) : next.add(grupo); return next;
                      });
                      return (
                        <div key={grupo} className="flex flex-col rounded-lg overflow-hidden">
                          <div
                            className={`flex items-center gap-2 px-2.5 py-1.5 transition-colors
                              ${isDark ? "hover:bg-slate-800/60" : "hover:bg-slate-100"}
                              ${vis ? (isDark ? "bg-slate-800/40 ring-1 ring-inset ring-cyan-500/20" : "bg-cyan-50 ring-1 ring-inset ring-cyan-300/50") : ""}`}>
                            <div className="w-3 h-3 rounded-full flex-shrink-0 border border-white/30 cursor-pointer"
                              style={{ backgroundColor: cfg.color }} onClick={toggleVis} />
                            <span className={`text-[10px] flex-1 cursor-pointer ${textBase}`} onClick={toggleVis}>
                              {cfg.icon} {cfg.label}
                            </span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${isDark ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500"}`}>{count}</span>
                            <button title="Centralizar no mapa" onClick={() => handleZoomToCampoGrupo(grupo)}
                              className={`flex-shrink-0 transition-colors rounded p-0.5 ${subText} hover:text-cyan-400`}>
                              <Maximize2 className="w-3 h-3" />
                            </button>
                            {/* Botão excluir grupo */}
                            <button
                              title="Excluir todos os registros deste grupo"
                              onClick={() => setCampoDeleteConfirm(confirmingThis ? null : grupo)}
                              className={`flex-shrink-0 transition-colors rounded p-0.5
                                ${confirmingThis ? "text-red-400" : (isDark ? "text-slate-600 hover:text-red-400" : "text-slate-300 hover:text-red-500")}`}>
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <div className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center cursor-pointer
                              ${vis ? "bg-cyan-500 border-cyan-500" : (isDark ? "border-slate-600" : "border-slate-300")}`}
                              onClick={toggleVis}>
                              {vis && <span className="text-[8px] text-white font-bold">✓</span>}
                            </div>
                          </div>
                          {/* Mini-confirmação inline */}
                          {confirmingThis && (
                            <div className={`px-2.5 py-2 flex items-center gap-2 text-[9px]
                              ${isDark ? "bg-red-950/40 border-t border-red-900/40" : "bg-red-50 border-t border-red-200"}`}>
                              <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                              <span className={isDark ? "text-red-300" : "text-red-600"}>
                                Excluir {count} registro(s) permanentemente?
                              </span>
                              <div className="flex gap-1 ml-auto">
                                <button
                                  onClick={() => setCampoDeleteConfirm(null)}
                                  className={`px-2 py-0.5 rounded text-[9px] font-medium
                                    ${isDark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}>
                                  Não
                                </button>
                                <button
                                  onClick={() => handleDeleteCampoGroup(grupo)}
                                  disabled={deleteCampoMutation.isPending}
                                  className="px-2 py-0.5 rounded text-[9px] font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                                  {deleteCampoMutation.isPending ? "…" : "Sim"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className={`text-[9px] mt-2 leading-relaxed ${subText} opacity-60`}>
                    Pontos georreferenciados do módulo Monitoramento de Campo. Clique para alternar visibilidade.
                  </p>
                </div>
              )}

              {/* Cabeçalho organizador */}
              <div className={`px-3 py-2 border-b flex items-center gap-2 ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
                <div className="relative flex-1">
                  <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${subText}`} />
                  <input
                    value={layerSearch}
                    onChange={e => setLayerSearch(e.target.value)}
                    placeholder="Buscar camada…"
                    className={`w-full text-[10px] pl-6 pr-2 py-1.5 rounded border outline-none
                      ${isDark ? "bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500" : "bg-white border-slate-300 text-slate-700 placeholder-slate-400"}`}
                  />
                  {layerSearch && (
                    <button onClick={() => setLayerSearch("")}
                      className={`absolute right-1.5 top-1/2 -translate-y-1/2 ${subText} hover:opacity-70`}>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {camadas.length > 0 && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button title="Mostrar todas"
                      onClick={() => setVisibleGeoLayers(new Set(camadas.map(c => c.id)))}
                      className={`text-[9px] px-1.5 py-1 rounded transition-colors ${isDark ? "bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-700" : "bg-slate-100 text-slate-500 hover:text-cyan-600 border border-slate-200"}`}>
                      <Eye className="w-3 h-3" />
                    </button>
                    <button title="Ocultar todas"
                      onClick={() => setVisibleGeoLayers(new Set())}
                      className={`text-[9px] px-1.5 py-1 rounded transition-colors ${isDark ? "bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-700" : "bg-slate-100 text-slate-500 hover:text-amber-500 border border-slate-200"}`}>
                      <EyeOff className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Contador */}
              {camadas.length > 0 && (
                <div className={`px-3 py-1 flex items-center justify-between ${isDark ? "border-b border-slate-700/40" : "border-b border-slate-200"}`}>
                  <span className={`text-[9px] ${subText}`}>
                    {camadas.length} camada{camadas.length !== 1 ? "s" : ""}
                    {layerSearch ? ` · ${camadas.filter(c => c.nome.toLowerCase().includes(layerSearch.toLowerCase())).length} resultado(s)` : ""}
                    {" · "}{visibleGeoLayers.size} visível{visibleGeoLayers.size !== 1 ? "is" : ""}
                  </span>
                  <FolderOpen className={`w-3 h-3 ${subText} opacity-40`} />
                </div>
              )}

              {/* Lista de camadas por categoria */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                {camadas.length === 0 && (
                  <div className={`text-center py-8 text-xs ${subText}`}>
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Nenhuma camada cadastrada.<br />
                    Use o botão acima para adicionar KMZ/KML/GeoJSON.
                  </div>
                )}

                {Object.entries(camadasPorCategoria).map(([categoria, camadasCat]) => {
                  const catCfg = CATEGORIA_CONFIG[categoria] || CATEGORIA_CONFIG.outro;

                  // Filtro de busca
                  const camadasFiltradas = layerSearch
                    ? camadasCat.filter(c => c.nome.toLowerCase().includes(layerSearch.toLowerCase()))
                    : camadasCat;
                  if (camadasFiltradas.length === 0) return null;

                  const allVisible = camadasFiltradas.every(c => visibleGeoLayers.has(c.id));
                  const someVisible = camadasFiltradas.some(c => visibleGeoLayers.has(c.id));
                  return (
                    <div key={categoria}>
                      {/* Header categoria */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest ${subText}`}>
                          <span>{catCfg.icon}</span>
                          <span>{catCfg.label}</span>
                          <span className="font-normal opacity-60">({camadasFiltradas.length})</span>
                        </div>
                        <button onClick={() => toggleCategoryGeoLayers(categoria, !allVisible)}
                          className={`text-[10px] px-1.5 py-0.5 rounded transition-colors
                            ${allVisible ? "text-cyan-400 bg-cyan-500/15" : someVisible ? "text-amber-400 bg-amber-500/15" : subText}`}>
                          {allVisible ? "ocultar tudo" : someVisible ? "parcial" : "mostrar tudo"}
                        </button>
                      </div>

                      {/* Camadas da categoria */}
                      <div className="flex flex-col gap-1">
                        {camadasFiltradas.map(camada => {
                          const vis = visibleGeoLayers.has(camada.id);
                          const isConfiguringThis = configLayerId === camada.id;
                          const localOpacity = layerOpacities[camada.id] ?? (camada.opacidade ?? 0.7);
                          const localName = editingLayerName[camada.id] ?? camada.nome;

                          // Detectar todas as chaves de atributos disponíveis na camada
                          const geojsonData = camada.geojsonData as any;
                          const allAttrKeys: string[] = (() => {
                            if (!geojsonData?.features) return [];
                            const keys = new Set<string>();
                            (geojsonData.features as any[]).slice(0, 20).forEach((f: any) => {
                              Object.keys(f.properties || {}).filter(k => k !== "").forEach(k => keys.add(k));
                            });
                            return Array.from(keys);
                          })();

                          const selectedAttrs = layerAttrConfig[camada.id];
                          const hasCustomConfig = selectedAttrs !== undefined;

                          const toggleAttr = (key: string) => {
                            setLayerAttrConfig(prev => {
                              const cur = prev[camada.id] ?? allAttrKeys;
                              const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key];
                              if (next.length === allAttrKeys.length && allAttrKeys.every(k => next.includes(k))) {
                                const { [camada.id]: _, ...rest } = prev; return rest;
                              }
                              return { ...prev, [camada.id]: next };
                            });
                          };

                          const selectAll = () => setLayerAttrConfig(prev => { const { [camada.id]: _, ...rest } = prev; return rest; });
                          const clearAll  = () => setLayerAttrConfig(prev => ({ ...prev, [camada.id]: [] }));

                          return (
                            <div key={camada.id} className="flex flex-col">
                              {/* Row principal */}
                              <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors
                                ${isDark ? "hover:bg-slate-800/60" : "hover:bg-slate-100"}
                                ${vis ? (isDark ? "bg-slate-800/40 ring-1 ring-inset ring-cyan-500/20" : "bg-cyan-50 ring-1 ring-inset ring-cyan-300/50") : ""}
                                ${isConfiguringThis ? "rounded-b-none" : ""}`}>
                                <div className="w-3 h-3 rounded-sm flex-shrink-0 border border-white/20"
                                  style={{ background: camada.cor || catCfg.color }} />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-medium truncate ${textBase}`}>{camada.nome}</p>
                                  {camada.fonte && (
                                    <p className={`text-[9px] truncate ${subText}`}>{camada.fonte}{camada.ano ? ` · ${camada.ano}` : ""}</p>
                                  )}
                                </div>
                                {/* Zoom to layer */}
                                <button title="Centralizar no mapa"
                                  onClick={() => handleZoomToLayer(camada)}
                                  className={`flex-shrink-0 transition-colors rounded p-0.5 ${subText} hover:text-cyan-400`}>
                                  <Maximize2 className="w-3 h-3" />
                                </button>
                                {/* Configurar */}
                                <button
                                  title="Configurar camada"
                                  onClick={() => setConfigLayerId(isConfiguringThis ? null : camada.id)}
                                  className={`flex-shrink-0 transition-colors rounded p-0.5
                                    ${isConfiguringThis
                                      ? "text-amber-400 bg-amber-500/15"
                                      : hasCustomConfig
                                        ? "text-amber-400 hover:text-amber-300"
                                        : `${subText} hover:opacity-80`}`}>
                                  <Settings className="w-3 h-3" />
                                </button>
                                {/* Visibilidade */}
                                <button onClick={() => toggleGeoLayer(camada.id)}
                                  className={`flex-shrink-0 transition-colors ${vis ? "text-cyan-400" : subText + " hover:opacity-80"}`}>
                                  {vis ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                </button>
                              </div>

                              {/* Painel de configuração expandido */}
                              {isConfiguringThis && (
                                <div className={`rounded-b-lg border border-t-0 p-2.5 flex flex-col gap-3
                                  ${isDark ? "bg-slate-800/70 border-slate-700/50" : "bg-slate-50 border-slate-200"}`}>

                                  {/* Renomear */}
                                  <div>
                                    <p className={`text-[10px] font-semibold mb-1 flex items-center gap-1 ${subText}`}>
                                      <Pencil className="w-3 h-3" /> Nome
                                    </p>
                                    <div className="flex gap-1">
                                      <input
                                        value={localName}
                                        onChange={e => setEditingLayerName(prev => ({ ...prev, [camada.id]: e.target.value }))}
                                        onKeyDown={e => {
                                          if (e.key === "Enter" && localName.trim()) {
                                            handleUpdateLayer(camada.id, { nome: localName.trim() });
                                            toast({ description: "Nome atualizado." });
                                          }
                                        }}
                                        className={`flex-1 text-[10px] rounded px-2 py-1 border outline-none
                                          ${isDark ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-800"}`}
                                      />
                                      <button
                                        onClick={() => {
                                          if (localName.trim() && localName.trim() !== camada.nome) {
                                            handleUpdateLayer(camada.id, { nome: localName.trim() });
                                            toast({ description: "Nome atualizado." });
                                          }
                                        }}
                                        className="text-[9px] px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-700 text-white flex-shrink-0">
                                        OK
                                      </button>
                                    </div>
                                  </div>

                                  {/* Cor */}
                                  <div>
                                    <p className={`text-[10px] font-semibold mb-1.5 flex items-center gap-1 ${subText}`}>
                                      <span className="w-3 h-3 inline-block rounded-full border border-current" style={{ backgroundColor: layerColors[camada.id] ?? camada.cor ?? "#3b82f6" }} />
                                      Cor da camada
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <div className="relative flex-shrink-0">
                                        <input
                                          type="color"
                                          value={layerColors[camada.id] ?? camada.cor ?? "#3b82f6"}
                                          onChange={e => {
                                            const c = e.target.value;
                                            setLayerColors(prev => ({ ...prev, [camada.id]: c }));
                                            // Aplica imediatamente no mapa
                                            const gl = geoLayersRef.current.get(camada.id);
                                            if (gl) gl.setStyle?.({ color: c, fillColor: c });
                                          }}
                                          onBlur={e => handleUpdateLayer(camada.id, { cor: e.target.value })}
                                          className="w-8 h-8 rounded cursor-pointer border-0 p-0.5 bg-transparent"
                                        />
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#64748b","#ffffff"].map(c => (
                                          <button key={c} title={c}
                                            onClick={() => {
                                              setLayerColors(prev => ({ ...prev, [camada.id]: c }));
                                              const gl = geoLayersRef.current.get(camada.id);
                                              if (gl) gl.setStyle?.({ color: c, fillColor: c });
                                              handleUpdateLayer(camada.id, { cor: c });
                                            }}
                                            className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-125 flex-shrink-0"
                                            style={{ backgroundColor: c, borderColor: (layerColors[camada.id] ?? camada.cor) === c ? "#fff" : "transparent" }}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Opacidade */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <p className={`text-[10px] font-semibold flex items-center gap-1 ${subText}`}>
                                        <Layers className="w-3 h-3" /> Opacidade
                                      </p>
                                      <span className={`text-[9px] ${subText}`}>{Math.round(localOpacity * 100)}%</span>
                                    </div>
                                    <input
                                      type="range" min={0} max={1} step={0.05}
                                      value={localOpacity}
                                      onChange={e => {
                                        const v = parseFloat(e.target.value);
                                        setLayerOpacities(prev => ({ ...prev, [camada.id]: v }));
                                        // Aplica imediatamente no mapa
                                        const gl = geoLayersRef.current.get(camada.id);
                                        if (gl) gl.setStyle?.({ fillOpacity: v * 0.5, opacity: Math.min(v + 0.3, 1) });
                                      }}
                                      onMouseUp={e => {
                                        const v = parseFloat((e.target as HTMLInputElement).value);
                                        handleUpdateLayer(camada.id, { opacidade: v });
                                      }}
                                      className="w-full accent-cyan-500"
                                    />
                                  </div>

                                  {/* Categoria */}
                                  <div>
                                    <p className={`text-[10px] font-semibold mb-1 flex items-center gap-1 ${subText}`}>
                                      <FolderOpen className="w-3 h-3" /> Categoria
                                    </p>
                                    <select
                                      value={camada.categoria}
                                      onChange={e => handleUpdateLayer(camada.id, { categoria: e.target.value })}
                                      className={`w-full text-[10px] rounded px-2 py-1 border outline-none
                                        ${isDark ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-300 text-slate-800"}`}>
                                      {Object.entries(CATEGORIA_CONFIG).map(([k, v]) => (
                                        <option key={k} value={k}>{v.icon} {v.label}</option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Atributos no popup */}
                                  {allAttrKeys.length > 0 && (
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <p className={`text-[10px] font-semibold flex items-center gap-1 ${subText}`}>
                                          <Settings className="w-3 h-3" /> Atributos no popup
                                          <span className="font-normal opacity-60">
                                            ({selectedAttrs === undefined ? "todos" : selectedAttrs.length === 0 ? "nenhum" : `${selectedAttrs.length}/${allAttrKeys.length}`})
                                          </span>
                                        </p>
                                        <div className="flex gap-1">
                                          <button onClick={selectAll} className={`text-[9px] px-1.5 py-0.5 rounded ${isDark ? "bg-slate-700 text-slate-300" : "bg-white text-slate-600 border border-slate-200"}`}>Todos</button>
                                          <button onClick={clearAll} className={`text-[9px] px-1.5 py-0.5 rounded ${isDark ? "bg-slate-700 text-slate-300" : "bg-white text-slate-600 border border-slate-200"}`}>Nenhum</button>
                                        </div>
                                      </div>
                                      <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto pr-1">
                                        {allAttrKeys.map(key => {
                                          const checked = selectedAttrs === undefined || selectedAttrs.includes(key);
                                          return (
                                            <label key={key} className={`flex items-center gap-2 rounded px-1.5 py-0.5 cursor-pointer transition-colors ${isDark ? "hover:bg-slate-700/60" : "hover:bg-white"}`}>
                                              <input type="checkbox" checked={checked}
                                                onChange={() => {
                                                  if (selectedAttrs === undefined) {
                                                    setLayerAttrConfig(prev => ({ ...prev, [camada.id]: allAttrKeys.filter(k => k !== key) }));
                                                  } else {
                                                    toggleAttr(key);
                                                  }
                                                }}
                                                className="w-3 h-3 accent-cyan-500 flex-shrink-0" />
                                              <span className={`text-[10px] font-mono truncate ${textBase}`}>{key}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Ações */}
                                  <div className={`flex gap-2 pt-1 border-t ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
                                    <button
                                      onClick={() => handleZoomToLayer(camada)}
                                      className={`flex-1 flex items-center justify-center gap-1 text-[10px] py-1.5 rounded transition-colors
                                        ${isDark ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`}>
                                      <Maximize2 className="w-3 h-3" /> Centralizar
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLayer(camada.id, camada.nome)}
                                      className="flex-1 flex items-center justify-center gap-1 text-[10px] py-1.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors">
                                      <Trash2 className="w-3 h-3" /> Excluir
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dica */}
              <div className={`p-3 border-t text-[10px] ${subText} ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
                💡 Carregue KMZ de áreas de influência (AID/AII), UCs, TIs e limites municipais para análise de sobreposição visual com os empreendimentos.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Controles de zoom ── */}
      <div className="absolute bottom-24 right-4 z-[1000] flex flex-col gap-2">
        {[
          { icon: <RotateCcw className="w-4 h-4" />, tip: "Visão geral",
            fn: () => { if (mapRef.current) mapRef.current.flyTo([-15.7942, -47.8922], 5, { duration: 1 }); } },
          { icon: <ZoomIn className="w-4 h-4" />,   tip: "Aproximar",
            fn: () => { if (mapRef.current) mapRef.current.zoomIn(); } },
          { icon: <ZoomOut className="w-4 h-4" />,  tip: "Afastar",
            fn: () => { if (mapRef.current) mapRef.current.zoomOut(); } },
        ].map(btn => (
          <button key={btn.tip} title={btn.tip} onClick={btn.fn}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors shadow-lg
              ${isDark
                ? "bg-slate-800/90 border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:text-white"
                : "bg-white/90 border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
            {btn.icon}
          </button>
        ))}
      </div>

      {/* ── Legenda ── */}
      <div className="absolute bottom-4 right-4 z-[1000]">
        <div className={`backdrop-blur-sm border rounded-xl p-3 text-xs shadow-xl min-w-[140px] ${panelBg}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${subText}`}>Conformidade</p>
          {[
            { color: "#22c55e", label: "Regular"  },
            { color: "#f59e0b", label: "Atenção"  },
            { color: "#ef4444", label: "Crítico"  },
            { color: "#64748b", label: "Sem dados" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color }} />
              <span className={textBase}>{item.label}</span>
            </div>
          ))}
          {/* Legenda de biomas */}
          {hasBiomeLayers && (
            <div className={`border-t pt-1.5 mt-1.5 ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${subText}`}>Biomas</p>
              {[
                { color: "#1a7f5a", label: "Amazônia" },
                { color: "#d4a017", label: "Cerrado" },
                { color: "#2d9b4e", label: "Mata Atlântica" },
                { color: "#e07b39", label: "Caatinga" },
                { color: "#1565c0", label: "Pantanal" },
                { color: "#95d5b2", label: "Pampa" },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-2 rounded-sm flex-shrink-0 opacity-80 border border-white/20" style={{ background: b.color }} />
                  <span className={`text-[9px] ${subText}`}>{b.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Legenda: polígonos MapBiomas */}
          {mbEnabled && mbAuthenticated && mbPolygonCount > 0 && (
            <div className={`border-t pt-1.5 mt-1.5 ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${subText}`}>Desmatamento</p>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-4 h-2 rounded-sm flex-shrink-0 opacity-80 border border-red-300"
                  style={{ background: "rgba(239,68,68,0.35)", borderColor: "#dc2626", borderStyle: "dashed" }} />
                <span className={`text-[9px] ${subText}`}>Alerta MapBiomas</span>
              </div>
              <p className={`text-[8px] text-red-400`}>{mbPolygonCount} polígono(s)</p>
            </div>
          )}

          {visibleGeoLayers.size > 0 && (
            <div className={`border-t pt-1.5 mt-1.5 ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${subText}`}>Camadas ativas</p>
              {Array.from(visibleGeoLayers).map(id => {
                const c = camadas.find(x => x.id === id);
                if (!c) return null;
                const catCfg = CATEGORIA_CONFIG[c.categoria] || CATEGORIA_CONFIG.outro;
                return (
                  <div key={id} className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-2 rounded-sm flex-shrink-0 opacity-70" style={{ background: c.cor || catCfg.color }} />
                    <span className={`text-[9px] truncate ${subText}`}>{c.nome}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Overlay: ferramenta de área ativa ── */}
      {drawModeActive && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1001] pointer-events-none">
          <div className="backdrop-blur-sm bg-cyan-900/90 border border-cyan-500/60 text-cyan-300 text-[11px] rounded-full px-5 py-2 flex items-center gap-2.5 shadow-lg">
            <MousePointer2 className="w-3.5 h-3.5 animate-pulse" />
            <span>
              Modo de medição ativo · Clique para adicionar vértices
              {drawnPoints.length > 0 && ` · ${drawnPoints.length} pontos`}
              {drawnAreaHa !== null && ` · Área: ${drawnAreaHa.toLocaleString("pt-BR")} ha`}
            </span>
            {drawnPoints.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setDrawModeActive(false); }}
                className="pointer-events-auto ml-1 text-cyan-400 hover:text-white text-xs underline">
                Finalizar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Overlay: conflitos detectados (banner) ── */}
      {overlapAnalysis.length > 0 && !infoPanelOpen && (
        <div className="absolute top-14 right-4 z-[1001]">
          <div className={`backdrop-blur-sm border border-red-500/50 rounded-xl px-3 py-2 flex items-center gap-2 shadow-lg
            ${isDark ? "bg-red-950/80 text-red-300" : "bg-red-50 text-red-700"}`}>
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <span className="text-[10px] font-semibold">
              {overlapAnalysis.length} conflito{overlapAnalysis.length !== 1 ? "s" : ""} territorial{overlapAnalysis.length !== 1 ? "is" : ""} detectado{overlapAnalysis.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      {/* ── Overlay flutuante de estatísticas do viewport ── */}
      {showStatsPanel && (
        <div className={`absolute bottom-24 left-${panelOpen ? "78" : "4"} z-[1000]`}
             style={{ left: panelOpen ? 300 : 16 }}>
          <div className={`backdrop-blur-sm border rounded-xl px-3 py-2 text-[10px] shadow-lg flex flex-col gap-1 min-w-[140px] ${panelBg}`}>
            <p className={`font-semibold uppercase tracking-widest ${subText} flex items-center gap-1`}>
              <BarChart2 className="w-3 h-3" /> Viewport
            </p>
            <div className="flex items-center justify-between gap-3">
              <span className={subText}>Empreend.</span>
              <span className="font-bold text-cyan-400 font-mono">{viewportStats.emps}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className={subText}>Campo</span>
              <span className="font-bold text-emerald-400 font-mono">{viewportStats.campo}</span>
            </div>
            {viewportStats.threatened > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className={subText}>Ameaçadas</span>
                <span className="font-bold text-amber-400 font-mono">{viewportStats.threatened}</span>
              </div>
            )}
            {drawnAreaHa !== null && (
              <div className={`border-t pt-1 mt-0.5 ${isDark ? "border-slate-700/40" : "border-slate-200"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className={subText}>Área medida</span>
                  <span className="font-bold text-cyan-400 font-mono">{drawnAreaHa.toLocaleString("pt-BR")} ha</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Seta Norte ── */}
      <div className="absolute z-[1000] pointer-events-none" style={{ top: 104, right: 10 }}>
        <div className={`backdrop-blur-sm border rounded-xl flex flex-col items-center justify-center shadow-lg
          ${isDark ? "bg-slate-900/85 border-slate-700/60" : "bg-white/90 border-slate-300"}`}
          style={{ width: 44, height: 56, padding: "6px 0" }}>
          <svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L17 16H12V2Z" fill={isDark ? "#e2e8f0" : "#1e293b"} />
            <path d="M12 2L7 16H12V2Z" fill={isDark ? "#64748b" : "#94a3b8"} />
            <path d="M12 34L17 20H12V34Z" fill={isDark ? "#64748b" : "#94a3b8"} />
            <path d="M12 34L7 20H12V34Z" fill={isDark ? "#94a3b8" : "#cbd5e1"} />
            <circle cx="12" cy="18" r="2.5" fill={isDark ? "#e2e8f0" : "#1e293b"} />
          </svg>
          <span className={`text-[9px] font-black tracking-widest mt-0.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>N</span>
        </div>
      </div>

      {/* ── Coordenadas do centro ── */}
      {mapCenter && (
        <div className="absolute z-[1000] pointer-events-none" style={{ bottom: 28, left: panelOpen ? 300 : 16 }}>
          <div className={`backdrop-blur-sm border rounded-lg px-2.5 py-1 shadow-md flex items-center gap-2
            ${isDark ? "bg-slate-900/85 border-slate-700/60" : "bg-white/90 border-slate-300"}`}>
            <span className={`font-mono text-[10px] ${isDark ? "text-cyan-400" : "text-cyan-600"}`}>
              {mapCenter.lat >= 0 ? "+" : ""}{mapCenter.lat.toFixed(4)}°,&nbsp;
              {mapCenter.lng >= 0 ? "+" : ""}{mapCenter.lng.toFixed(4)}°
            </span>
            <span className={`text-[9px] ${subText}`}>z{mapCenter.zoom}</span>
          </div>
        </div>
      )}

      {/* ── Dica ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
        <div className={`backdrop-blur-sm border rounded-full px-4 py-1.5 text-[10px] flex items-center gap-2 ${panelBg} ${subText}`}>
          <Compass className="w-3 h-3" />
          {drawModeActive
            ? "Clique para adicionar vértice · Duplo clique ou 'Finalizar' para terminar"
            : "Clique no marcador para detalhes · Scroll para zoom · Arraste para navegar"}
        </div>
      </div>

      {/* ── Painel de detalhes do empreendimento ── */}
      {infoPanelOpen && selectedEmp && selectedComp && selectedTc && (
        <div className={`eco-info-panel absolute z-[1000] overflow-y-auto flex flex-col ${panelBg}`}
             style={{ top: 44, right: 0, bottom: 0, width: 320, borderLeft: "1px solid" }}>
          <div className="p-4 border-b border-slate-700/30">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold leading-tight ${textBase}`}>{selectedEmp.nome}</p>
                <p className={`text-xs mt-1 ${subText}`}>{selectedTc.icon} {selectedTc.label}</p>
                <p className={`text-xs mt-0.5 ${subText}`}>📍 {selectedEmp.municipio || selectedEmp.localizacao}, {selectedEmp.uf}</p>
              </div>
              <button onClick={() => setInfoPanelOpen(false)} className={`${subText} hover:opacity-60 flex-shrink-0`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 rounded-lg px-3 py-2 flex items-center gap-2"
              style={{ background: `${selectedComp.color}22`, border: `1px solid ${selectedComp.color}55` }}>
              <div className="w-3 h-3 rounded-full" style={{ background: selectedComp.color }} />
              <span className="text-sm font-semibold" style={{ color: selectedComp.color }}>
                Conformidade: {selectedComp.label}
              </span>
            </div>
          </div>

          <div className={`p-4 border-b grid grid-cols-2 gap-3 ${isDark ? "border-slate-700/30" : "border-slate-200"}`}>
            {[
              { label: "Status",      value: STATUS_LABELS[selectedEmp.status] || selectedEmp.status },
              { label: "Responsável", value: selectedEmp.responsavelInterno },
              { label: "Latitude",    value: parseFloat(selectedEmp.latitude!).toFixed(5), mono: true, color: "text-cyan-500" },
              { label: "Longitude",   value: parseFloat(selectedEmp.longitude!).toFixed(5), mono: true, color: "text-cyan-500" },
            ].map(item => (
              <div key={item.label} className={`rounded-lg p-3 ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
                <p className={`text-[10px] uppercase tracking-wide mb-1 ${subText}`}>{item.label}</p>
                <p className={`text-xs font-semibold truncate ${(item as any).color || textBase} ${(item as any).mono ? "font-mono" : ""}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className={`p-4 border-b ${isDark ? "border-slate-700/30" : "border-slate-200"}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${subText}`}>Zona de Impacto (AID)</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`rounded-lg p-3 ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
                <p className={`text-[10px] mb-1 ${subText}`}>Raio estimado</p>
                <p className={`font-bold ${textBase}`}>{(selectedTc.radiusKm * raioMulti).toFixed(0)} km</p>
              </div>
              <div className={`rounded-lg p-3 ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
                <p className={`text-[10px] mb-1 ${subText}`}>Fator de Impacto</p>
                <p className={`font-bold ${textBase}`}>{selectedTc.heightFactor.toFixed(1)}×</p>
              </div>
              <div className={`col-span-2 rounded-lg p-3 ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
                <p className={`text-[10px] mb-1 ${subText}`}>Área de Influência (approx.)</p>
                <p className={`font-bold ${textBase}`}>
                  {(Math.PI * Math.pow(selectedTc.radiusKm * raioMulti, 2)).toFixed(0)} km²
                </p>
              </div>
            </div>
          </div>

          {/* ── Conflitos territoriais deste empreendimento ── */}
          {overlapAnalysis.filter(o => o.emp.id === selectedEmp.id).length > 0 && (
            <div className={`p-4 border-b ${isDark ? "border-slate-700/30 bg-red-950/15" : "border-red-200 bg-red-50/40"}`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> Conflitos Territoriais
              </p>
              <div className="flex flex-col gap-1">
                {overlapAnalysis.filter(o => o.emp.id === selectedEmp.id).map((o, i) => (
                  <div key={i} className={`text-[10px] rounded-lg px-2.5 py-1.5 ${isDark ? "bg-red-900/20" : "bg-red-100"}`}>
                    <span className="text-red-400 font-medium">{o.featureName}</span>
                    <span className={`ml-1 ${subText}`}>({o.camada.nome})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Proximidade a camadas vetoriais ── */}
          {(() => {
            const proximity = getEmpProximity(selectedEmp.id);
            if (!proximity.length) return null;
            return (
              <div className={`p-4 border-b ${isDark ? "border-slate-700/30" : "border-slate-200"}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${subText} flex items-center gap-1.5`}>
                  <Target className="w-3 h-3" /> Camadas Próximas
                </p>
                <div className="flex flex-col gap-1">
                  {proximity.map((p, i) => (
                    <div key={i} className={`flex items-center justify-between text-[10px] rounded px-2 py-1 ${isDark ? "bg-slate-800/40" : "bg-slate-50"}`}>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${textBase}`}>{p.nome}</p>
                        <p className={`${subText} opacity-70`}>{p.camadaNome}</p>
                      </div>
                      <span className={`text-xs font-mono font-bold flex-shrink-0 ml-2 ${p.distKm < 5 ? "text-red-400" : p.distKm < 20 ? "text-amber-400" : "text-emerald-400"}`}>
                        {p.distKm} km
                      </span>
                    </div>
                  ))}
                </div>
                <p className={`text-[8px] mt-1.5 ${subText} opacity-60`}>Distância ao centróide das feições das camadas ativas.</p>
              </div>
            );
          })()}

          <div className={`px-4 py-3 border-b ${isDark ? "border-slate-700/30" : "border-slate-200"}`}>
            <button
              onClick={() => navigate(`/empreendimentos/${selectedEmp.id}`)}
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-lg transition-colors bg-cyan-600 hover:bg-cyan-500 text-white shadow-md">
              <ExternalLink className="w-3.5 h-3.5" />
              Visitar Empreendimento
            </button>
          </div>

          <div className="p-4 flex-1">
            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${subText}`}>
              Licenças ({selectedLics.length})
            </p>
            {selectedLics.length === 0 ? (
              <p className={`text-xs ${subText}`}>Nenhuma licença cadastrada.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {selectedLics.map(lic => {
                  const venc  = lic.dataVencimento ? new Date(lic.dataVencimento) : null;
                  const hoje  = new Date(); const in90 = new Date(hoje); in90.setDate(in90.getDate() + 90);
                  const estado = !venc ? "vigente" : venc < hoje ? "vencida" : venc < in90 ? "vencendo" : "vigente";
                  const cor   = estado === "vencida" ? "#ef4444" : estado === "vencendo" ? "#f59e0b" : "#22c55e";
                  return (
                    <div key={lic.id} className={`rounded-lg p-2.5 ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-xs font-medium truncate ${textBase}`}>{lic.tipo}</span>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cor }} />
                      </div>
                      <p className={`text-[10px] ${subText}`}>Nº {lic.numero}</p>
                      {venc && (
                        <p className="text-[10px] mt-0.5" style={{ color: cor }}>
                          {estado === "vencida" ? "⚠ Vencida em " : "📅 Vence em "}
                          {venc.toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          DIALOG — Configurar camadas para o PDF
      ══════════════════════════════════════════════════════════════════ */}
      {showPDFDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-[520px] max-h-[85vh] flex flex-col overflow-hidden">

            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                  <Download className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">Exportar Relatório PDF</p>
                  <p className="text-[10px] text-slate-400">Selecione as camadas e elementos do mapa</p>
                </div>
              </div>
              <button onClick={() => setShowPDFDialog(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Conteúdo scrollável */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Título do mapa */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Título do Mapa</p>
                <input
                  type="text"
                  value={pdfMapTitle}
                  onChange={e => setPdfMapTitle(e.target.value)}
                  placeholder="Ex.: Relatório Cartográfico — Mapa de Empreendimentos"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[12px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>

              {/* Logo do cliente */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Logo do Cliente (opcional)</p>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer hover:border-cyan-500/40 transition-colors group">
                    <svg className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-[11px] text-slate-400 group-hover:text-slate-300 truncate">
                      {pdfClientLogo ? "Logo carregado ✓" : "Clique para enviar PNG/JPG"}
                    </span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const fr = new FileReader();
                        fr.onloadend = () => setPdfClientLogo(fr.result as string);
                        fr.readAsDataURL(f);
                      }} />
                  </label>
                  {pdfClientLogo && (
                    <button onClick={() => setPdfClientLogo(null)}
                      className="p-2 rounded-lg border border-slate-700 hover:border-red-500/50 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                  {pdfClientLogo && (
                    <img src={pdfClientLogo} alt="preview" className="h-8 w-auto rounded border border-slate-600 flex-shrink-0" />
                  )}
                </div>
              </div>

              {/* Elementos do mapa */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Elementos do Mapa</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "emp",     label: "Empreendimentos",      val: pdfShowEmp,     set: setPdfShowEmp     },
                    { key: "campo",   label: "Pontos de Campo",       val: pdfShowCampo,   set: setPdfShowCampo   },
                    { key: "heatmap", label: "Heatmap Biodiversidade",val: pdfShowHeatmap, set: setPdfShowHeatmap },
                    { key: "zones",   label: "Zonas de Influência",   val: pdfShowZones,   set: setPdfShowZones   },
                  ].map(item => (
                    <label key={item.key} className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors select-none
                      ${item.val ? "border-cyan-500/40 bg-cyan-500/10" : "border-slate-700 bg-slate-800/40 hover:border-slate-600"}`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors
                        ${item.val ? "bg-cyan-500" : "bg-slate-700 border border-slate-600"}`}
                        onClick={() => item.set(!item.val)}>
                        {item.val && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className="text-[11px] text-slate-300">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Camadas geoespaciais */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    Camadas Geoespaciais ({camadas.length} disponíveis)
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setPdfLayerSel(new Set(camadas.map(c => c.id)))}
                      className="text-[9px] text-cyan-400 hover:text-cyan-300 transition-colors">Todas</button>
                    <span className="text-slate-700">·</span>
                    <button onClick={() => setPdfLayerSel(new Set())}
                      className="text-[9px] text-slate-400 hover:text-slate-300 transition-colors">Nenhuma</button>
                    <span className="text-slate-700">·</span>
                    <button onClick={() => setPdfLayerSel(new Set(visibleGeoLayers))}
                      className="text-[9px] text-emerald-400 hover:text-emerald-300 transition-colors">Visíveis</button>
                  </div>
                </div>

                {camadas.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    Nenhuma camada geoespacial cadastrada
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
                    {Object.entries(
                      camadas.reduce((acc, c) => {
                        if (!acc[c.categoria]) acc[c.categoria] = [];
                        acc[c.categoria].push(c);
                        return acc;
                      }, {} as Record<string, CamadaGeoespacial[]>)
                    ).map(([cat, layers]) => {
                      const catCfg = CATEGORIA_CONFIG[cat] || { label: cat, icon: "📍", color: "#6b7280" };
                      const allSel = layers.every(l => pdfLayerSel.has(l.id));
                      const someSel = layers.some(l => pdfLayerSel.has(l.id));
                      return (
                        <div key={cat}>
                          {/* Grupo header */}
                          <div className="flex items-center gap-2 px-1 py-1 mb-0.5">
                            <button
                              onClick={() => {
                                const ns = new Set(pdfLayerSel);
                                if (allSel) layers.forEach(l => ns.delete(l.id));
                                else layers.forEach(l => ns.add(l.id));
                                setPdfLayerSel(ns);
                              }}
                              className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center transition-colors
                                ${allSel ? "bg-cyan-500" : someSel ? "bg-cyan-500/40 border border-cyan-500" : "bg-slate-700 border border-slate-600"}`}>
                              {allSel && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              {someSel && !allSel && <div className="w-1.5 h-0.5 bg-cyan-400 rounded" />}
                            </button>
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                              {catCfg.icon} {catCfg.label}
                            </span>
                          </div>
                          {/* Camadas do grupo */}
                          {layers.map(camada => {
                            const isSelected = pdfLayerSel.has(camada.id);
                            const isVisible = visibleGeoLayers.has(camada.id);
                            const cor = layerColors[camada.id] || camada.cor || catCfg.color;
                            return (
                              <label key={camada.id}
                                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ml-4 mb-0.5 select-none
                                  ${isSelected ? "bg-slate-700/60 border border-slate-600/60" : "hover:bg-slate-800/60 border border-transparent"}`}
                                onClick={() => {
                                  const ns = new Set(pdfLayerSel);
                                  if (isSelected) ns.delete(camada.id); else ns.add(camada.id);
                                  setPdfLayerSel(ns);
                                }}>
                                <div className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center transition-colors
                                  ${isSelected ? "bg-cyan-500" : "bg-slate-700 border border-slate-600"}`}>
                                  {isSelected && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <div className="w-3 h-3 rounded-sm flex-shrink-0 border" style={{ background: cor + "66", borderColor: cor }} />
                                <span className="text-[11px] text-slate-200 flex-1 truncate">{camada.nome}</span>
                                {isVisible && (
                                  <span className="text-[8px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full flex-shrink-0">visível</span>
                                )}
                                {camada.fonte && (
                                  <span className="text-[8px] text-slate-500 truncate max-w-[60px]">{camada.fonte}</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé */}
            <div className="px-5 py-4 border-t border-slate-700 bg-slate-800/40 flex items-center justify-between gap-3">
              <p className="text-[10px] text-slate-500">
                {pdfLayerSel.size} camada{pdfLayerSel.size !== 1 ? "s" : ""} selecionada{pdfLayerSel.size !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowPDFDialog(false)}
                  className="px-4 py-2 rounded-lg text-xs text-slate-400 border border-slate-700 hover:border-slate-500 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setShowPDFDialog(false);
                    exportPDF({
                      layerSel: pdfLayerSel,
                      showEmp: pdfShowEmp, showCampo: pdfShowCampo,
                      showHeatmap: pdfShowHeatmap, showZones: pdfShowZones,
                      clientLogo: pdfClientLogo,
                      mapTitle: pdfMapTitle,
                    });
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  Gerar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
