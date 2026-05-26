
import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight,
  Loader2, Table2, Waves, Layers, Volume2, Leaf, Bird,
} from "lucide-react";

// ── Tipos de monitoramento disponíveis ────────────────────────────────────────
const TIPOS_MONITORAMENTO = [
  { value: "fauna",         label: "Fauna",            icon: Bird,    color: "emerald",  desc: "Avifauna, mastofauna, herpetofauna, ictiofauna e invertebrados" },
  { value: "flora",         label: "Flora",             icon: Leaf,    color: "green",    desc: "Fitossociologia e levantamento florístico" },
  { value: "qualidade_agua",label: "Qualidade da Água", icon: Waves,   color: "cyan",     desc: "pH, OD, turbidez, condutividade, DBO e demais parâmetros hídricos" },
  { value: "solo",          label: "Solo",              icon: Layers,  color: "yellow",   desc: "pH, matéria orgânica, macronutrientes (N, P, K, Ca, Mg) e textura" },
  { value: "ruido",         label: "Ruído",             icon: Volume2, color: "orange",   desc: "Leq, Lmax, Lmin, L90, L10 — monitoramento acústico/sonoro" },
] as const;

type TipoMonitoramento = typeof TIPOS_MONITORAMENTO[number]["value"];

const GRUPOS_FAUNA = [
  { value: "avifauna",     label: "Avifauna (Aves)" },
  { value: "herpetofauna", label: "Herpetofauna (Répteis e Anfíbios)" },
  { value: "mastofauna",   label: "Mastofauna (Mamíferos)" },
  { value: "quiropteros",  label: "Quirópteros (Morcegos)" },
  { value: "ictiofauna",   label: "Ictiofauna (Peixes)" },
  { value: "invertebrados",label: "Invertebrados" },
];

// ── Mapeamento de colunas da planilha → campo do BD ──────────────────────────
const COL_MAP: Record<string, string> = {
  "grupo taxonômico": "grupoTaxonomico", "grupo taxonomico": "grupoTaxonomico",
  "empreendimento": "empreendimento_nome",
  "campanha": "campanha", "data": "data",
  "horário": "horario", "horario": "horario",
  "período": "periodo", "periodo": "periodo",
  "unidade amostral": "unidadeAmostral",
  "zona utm": "zonaUtm", "zona": "zonaUtm", "fuso": "zonaUtm", "fuso utm": "zonaUtm", "utm zone": "zonaUtm", "zone": "zonaUtm",
  "latitude": "latitude", "latitute": "latitude", "latitide": "latitude", "latude": "latitude", "latitute (graus)": "latitude",
  "longitude": "longitude", "longitute": "longitude", "logitude": "longitude", "longitute (graus)": "longitude",
  // UTM easting aliases
  "easting": "latitude", "leste": "latitude", "e": "latitude",
  "coord e": "latitude", "coordenada e": "latitude", "coordenada_e": "latitude",
  "utm e": "latitude", "utm_e": "latitude", "coord_e": "latitude",
  "x": "latitude", "x utm": "latitude", "x (m)": "latitude",
  // UTM northing aliases
  "northing": "longitude", "norte": "longitude", "n": "longitude",
  "coord n": "longitude", "coordenada n": "longitude", "coordenada_n": "longitude",
  "utm n": "longitude", "utm_n": "longitude", "coord_n": "longitude",
  "y": "longitude", "y utm": "longitude", "y (m)": "longitude",
  "filo": "filo", "classe": "classe", "ordem": "ordem",
  "família": "familia", "familia": "familia",
  "nome científico": "nomeCientifico", "nome cientifico": "nomeCientifico",
  "espécie": "nomeCientifico", "especie": "nomeCientifico",
  "nome da espécie": "nomeCientifico", "nome da especie": "nomeCientifico",
  "nome especie": "nomeCientifico", "nome da sp": "nomeCientifico",
  "sp.": "nomeCientifico", "táxon": "nomeCientifico", "taxon": "nomeCientifico",
  "táxon / espécie": "nomeCientifico", "taxon / especie": "nomeCientifico",
  "espécie (nome científico)": "nomeCientifico", "especie (nome cientifico)": "nomeCientifico",
  "binômio": "nomeCientifico", "binomio": "nomeCientifico",
  "scientific name": "nomeCientifico", "species": "nomeCientifico",
  "identificação": "nomeCientifico", "identificacao": "nomeCientifico",
  "nome comum": "nomeComum", "nome popular": "nomeComum", "nome vulgar": "nomeComum",
  "nome vernacular": "nomeComum", "common name": "nomeComum",
  "sazonalidade": "sazonalidade", "estação": "sazonalidade", "estacao": "sazonalidade",
  "season": "sazonalidade", "seca/chuva": "sazonalidade",
  "sexo": "sexo", "idade": "idade",
  "método": "metodo", "metodo": "metodo",
  "modo de registro": "modoRegistro", "modo registro": "modoRegistro",
  "caracterizacao": "caracterizacao", "caracterização": "caracterizacao",
  "malha": "malha", "malha (mm)": "malha", "tamanho de malha": "malha", "tamanho da malha": "malha",
  "densidade": "densidade",
  "estagio de desenvolvimento": "estagioDesenvolvimento", "estagio desenvolvimento": "estagioDesenvolvimento",
  "estadio de desenvolvimento": "estagioDesenvolvimento",
  "numero etiqueta campo": "numeroEtiquetaCampo", "n etiqueta campo": "numeroEtiquetaCampo",
  "etiqueta campo": "numeroEtiquetaCampo", "numero etiqueta": "numeroEtiquetaCampo",
  "ponto de escuta": "pontoEscuta",
  "descrição do esforço": "descricaoEsforco", "descricao do esforco": "descricaoEsforco",
  "duração da amostragem": "duracaoAmostragem", "duracao da amostragem": "duracaoAmostragem",
  "distância percorrida": "distanciaPercorrida", "distancia percorrida": "distanciaPercorrida",
  "status do registro": "statusRegistro",
  "condição meteorológica": "condicaoMeteorologica", "condicao meteorologica": "condicaoMeteorologica",
  "ambiente preferencial": "ambientePreferencial",
  "estágio reprodutivo": "estagioReprodutivo", "estagio reprodutivo": "estagioReprodutivo",
  "distribuição": "distribuicao", "distribuicao": "distribuicao",
  "dieta": "dieta", "habitat": "habitat", "fitofisionomia": "fitofisionomia",
  "iucn": "iucn", "ibama/mma": "ibamaMma", "ibama mma": "ibamaMma",
  "cites": "cites", "lista estadual": "listaEstadual", "pan": "pan",
  "uso do habitat": "usoHabitat", "sensibilidade": "sensibilidade",
  "locomoção": "locomocao", "locomocao": "locomocao",
  "migração": "migracao", "migracao": "migracao", "migratoria": "migracao",
  "bioindicador": "bioindicador", "endemismo": "endemismo",
  "peso (g)": "pesoG",
  "ct (mm)": "ctMm", "comprimento total (mm)": "ctMm",
  "lc (mm)": "lcMm", "comprimento padrão (mm)": "lcMm",
  "cc (mm)": "ccMm", "comprimento da cabeça (mm)": "ccMm",
  "ac (mm)": "acMm", "altura do corpo (mm)": "acMm",
  "do (mm)": "doMm", "diâmetro ocular (mm)": "doMm", "diametro ocular (mm)": "doMm",
  "tipo corpo d'agua": "tipoCorpoAgua", "tipo de corpo d'agua": "tipoCorpoAgua", "tipo corpo dagua": "tipoCorpoAgua",
  "tipo corpo d`agua": "tipoCorpoAgua", "tipo de corpo d`agua": "tipoCorpoAgua",
  "estrato vertical": "estratoVertical",
  "tipo da marcação": "tipoMarcacao", "tipo da marcacao": "tipoMarcacao",
  "número da marcação": "numeroMarcacao", "numero da marcacao": "numeroMarcacao",
  "número de tombamento": "numeroTombamento", "numero de tombamento": "numeroTombamento",
  "instituição de tombamento": "instituicaoTombamento", "instituicao de tombamento": "instituicaoTombamento",
  "nome do coletor": "nomeColetor",
  "observações": "observacoes", "observacoes": "observacoes",
  // CPUE — effort
  "esforco": "esforcoAmostral", "esforço": "esforcoAmostral",
  "esforco amostral": "esforcoAmostral", "esforço amostral": "esforcoAmostral",
  "esforco_amostral": "esforcoAmostral", "esforco (h)": "esforcoAmostral",
  "esforco (horas)": "esforcoAmostral", "esforco (km)": "esforcoAmostral",
  "esforco (rede-hora)": "esforcoAmostral", "esforco (anzol-hora)": "esforcoAmostral",
  "sampling effort": "esforcoAmostral", "effort": "esforcoAmostral",
  "effort (h)": "esforcoAmostral", "cpue effort": "esforcoAmostral",
  "esforco de captura": "esforcoAmostral", "esforço de captura": "esforcoAmostral",
  // CPUE — effort unit
  "unidade de esforco": "unidadeEsforco", "unidade de esforço": "unidadeEsforco",
  "unidade esforco": "unidadeEsforco", "unidade esforço": "unidadeEsforco",
  "unidade_esforco": "unidadeEsforco", "unit of effort": "unidadeEsforco",
  "effort unit": "unidadeEsforco", "unidade do esforco": "unidadeEsforco",
  // Abundance / catch count
  "n individuos": "abundancia", "n_individuos": "abundancia",
  "numero de individuos": "abundancia", "número de indivíduos": "abundancia",
  "captura": "abundancia", "captura total": "abundancia",
  "n capturado": "abundancia", "total capturado": "abundancia",
  "abundance": "abundancia", "quantidade": "abundancia",
  "qtd": "abundancia", "n (ind)": "abundancia", "n (individuos)": "abundancia",
  "asa (mm)": "asaMm", "tarso direito (mm)": "tarsoDireitoMm",
  "diâmetro do tarso (mm": "diametroTarsoMm", "diametro do tarso (mm": "diametroTarsoMm",
  "altura do bico (mm)": "alturaBicoMm", "comprimento do bico (mm)": "comprimentoBicoMm",
  "comprimento da cauda (mm)": "comprimentoCaudaMm", "largura do olho (mm)": "larguraOlhoMm",
  "total (mm)": "totalMm", "plumagem": "plumagem",
};

// ── Mapas de parâmetros para cada tipologia ───────────────────────────────────
const PARAMS_RUIDO: Record<string, string> = {
  "leq": "Leq", "nível equivalente": "Leq", "nivel equivalente": "Leq",
  "laeq": "Leq", "la,eq": "Leq", "la eq": "Leq", "nível de pressão sonora equivalente": "Leq",
  "db(a)": "Leq", "dba": "Leq", "nivel de pressao sonora": "Leq",
  "lmax": "Lmax", "nível máximo": "Lmax", "nivel maximo": "Lmax",
  "lmin": "Lmin", "nível mínimo": "Lmin", "nivel minimo": "Lmin",
  "l90": "L90", "nível l90": "L90", "nivel l90": "L90",
  "l10": "L10", "nível l10": "L10", "nivel l10": "L10",
  "l50": "L50", "nível l50": "L50",
  "periodo": "periodo", "período (diurno/noturno)": "periodo",
  "duracao": "duracao", "duração (min)": "duracao", "tempo de medicao": "duracao",
  "temperatura": "temperatura", "temp (°c)": "temperatura",
  "umidade": "umidade", "umidade relativa": "umidade",
};

const PARAMS_AGUA: Record<string, string> = {
  "ph": "pH", "potencial hidrogeniônico": "pH",
  "od": "OD", "o.d.": "OD", "oxigênio dissolvido": "OD", "oxigenio dissolvido": "OD",
  "saturacao od": "satOD", "saturação od": "satOD", "saturação de od (%)": "satOD",
  "turbidez": "turbidez", "turbidity": "turbidez", "turbidez (ntu)": "turbidez",
  "condutividade": "condutividade", "cond. (µs/cm)": "condutividade", "cond (us/cm)": "condutividade",
  "temperatura": "temperatura", "temp": "temperatura", "temp (°c)": "temperatura",
  "dbo": "DBO", "dbo5": "DBO", "dbo 5": "DBO", "dbo5,20": "DBO",
  "dqo": "DQO", "dqo (mg/l)": "DQO",
  "nitrato": "nitrato", "no3": "nitrato", "n-nitrato": "nitrato",
  "nitrito": "nitrito", "no2": "nitrito",
  "nitrogênio total": "Ntotal", "nitrogenio total": "Ntotal",
  "fosfato": "fosfato", "po4": "fosfato", "fósforo total": "fosfato", "fosforo total": "fosfato",
  "sst": "SST", "sólidos totais": "SST", "solidos totais": "SST", "sólidos suspensos totais": "SST",
  "coliformes termotolerantes": "coliTermo", "e. coli": "coliTermo", "e.coli": "coliTermo",
  "coliformes totais": "coliTotal",
  "cor": "cor", "cor (pt-co)": "cor", "cor aparente": "cor",
  "salinidade": "salinidade",
  "profundidade": "profundidade", "prof (m)": "profundidade",
};

const PARAMS_SOLO: Record<string, string> = {
  "ph": "pH", "ph (h2o)": "pH", "ph h2o": "pH", "reacao do solo": "pH",
  "mo": "MO", "matéria orgânica": "MO", "materia organica": "MO", "m.o.": "MO", "mo (dag/kg)": "MO",
  "n": "N", "nitrogênio": "N", "nitrogenio": "N", "n total": "N", "n (dag/kg)": "N",
  "p": "P", "fósforo": "P", "fosforo": "P", "p resin": "P", "p (mg/dm³)": "P", "p disponivel": "P",
  "k": "K", "potássio": "K", "potassio": "K", "k (mg/dm³)": "K",
  "ca": "Ca", "cálcio": "Ca", "calcio": "Ca", "ca (cmolc/dm³)": "Ca",
  "mg": "Mg", "magnésio": "Mg", "magnesio": "Mg", "mg (cmolc/dm³)": "Mg",
  "al": "Al", "alumínio": "Al", "aluminio": "Al", "al (cmolc/dm³)": "Al",
  "h+al": "HAl", "h al": "HAl", "acidez potencial": "HAl",
  "sb": "SB", "soma de bases": "SB", "sb (cmolc/dm³)": "SB",
  "ctc": "CTC", "ctc (t)": "CTC", "ctc efetiva": "CTCefet",
  "v": "V", "v (%)": "V", "saturação de bases": "V", "saturacao de bases": "V",
  "m": "m", "saturação de alumínio": "m", "m (%)": "m",
  "argila": "argila", "silte": "silte", "areia": "areia",
  "argila (%)": "argila", "silte (%)": "silte", "areia (%)": "areia",
  "profundidade": "profundidade", "prof (cm)": "profundidade",
};

// ── Colunas base universais (para todos os tipos) ──────────────────────────────
const COLS_BASE: Record<string, string> = {
  "campanha": "campanha", "data": "data",
  "horário": "horario", "horario": "horario",
  "unidade amostral": "unidadeAmostral", "ponto": "unidadeAmostral",
  "ponto de monitoramento": "unidadeAmostral", "estação": "unidadeAmostral",
  "estacao": "unidadeAmostral", "ponto amostral": "unidadeAmostral",
  "latitude": "latitude", "latitute": "latitude", "latitide": "latitude", "latude": "latitude",
  "longitude": "longitude", "longitute": "longitude", "logitude": "longitude",
  "metodo": "metodo", "método": "metodo",
  "observações": "observacoes", "observacoes": "observacoes",
  "nome do coletor": "nomeColetor", "responsável": "nomeColetor",
  "condição meteorológica": "condicaoMeteorologica", "condicao meteorologica": "condicaoMeteorologica",
};

// Descrições do template esperado por tipologia
const TEMPLATE_INFO: Record<TipoMonitoramento, { colunas: string[]; limite?: string }> = {
  fauna: {
    colunas: ["GRUPO TAXONÔMICO", "NOME CIENTÍFICO", "NOME COMUM", "DATA", "CAMPANHA", "UNIDADE AMOSTRAL", "LATITUDE", "LONGITUDE", "MÉTODO", "IUCN", "IBAMA/MMA"],
  },
  flora: {
    colunas: ["NOME CIENTÍFICO", "FAMÍLIA", "DATA", "CAMPANHA", "UNIDADE AMOSTRAL", "FITOFISIONOMIA", "HABITAT", "MÉTODO"],
  },
  qualidade_agua: {
    colunas: ["DATA", "CAMPANHA", "UNIDADE AMOSTRAL", "pH", "OD", "TURBIDEZ", "CONDUTIVIDADE", "TEMPERATURA", "DBO", "DQO"],
    limite: "CONAMA 357/2005",
  },
  solo: {
    colunas: ["DATA", "CAMPANHA", "UNIDADE AMOSTRAL", "pH", "MO", "N", "P", "K", "Ca", "Mg", "Al", "CTC", "V (%)"],
    limite: "EMBRAPA — Manual de Análises Químicas",
  },
  ruido: {
    colunas: ["DATA", "CAMPANHA", "UNIDADE AMOSTRAL", "Leq", "Lmax", "Lmin", "L90", "L10", "PERÍODO"],
    limite: "CONAMA 001/90 · ABNT NBR 10151",
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseDate(v: any): string {
  if (v === undefined || v === null || String(v).trim() === "") return "";
  // Excel serial number
  if (typeof v === "number" && v > 1 && v < 200000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // dd/mm/yyyy  or  dd-mm-yyyy
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split(/[\/\-]/);
    const candidate = `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
    if (!isNaN(new Date(candidate).getTime())) return candidate;
  }
  // yyyy-mm-dd or yyyy/mm/dd
  if (/^\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(s)) return s.slice(0, 10).replace(/\//g, "-");
  // dd.mm.yyyy
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split(".");
    const candidate = `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
    if (!isNaN(new Date(candidate).getTime())) return candidate;
  }
  // JS date parse (handles ISO strings, long-form dates, etc.)
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return ""; // unparseable — let server use today as fallback
}

function normalizeKey(h: string): string {
  return h.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

// Columns to silently ignore (metadata, not scientific data)
const IGNORE_COLS = new Set(["id", "#", "seq", "num", "numero", "n"]);

function mapRowFauna(row: Record<string, any>, grupoForcado?: string): Record<string, any> {
  const out: Record<string, any> = {};
  const extras: Record<string, string> = {};

  for (const [rawKey, val] of Object.entries(row)) {
    const norm = normalizeKey(rawKey);
    if (IGNORE_COLS.has(norm)) continue;
    if (val === undefined || val === null || String(val).trim() === "") continue;
    const strVal = String(val).trim();

    const dbField = COL_MAP[norm];
    if (dbField && dbField !== "empreendimento_nome") {
      // Numeric fields — parse to number, fall back to string on failure
      if (dbField === "esforcoAmostral") {
        const n = parseFloat(strVal.replace(",", "."));
        out[dbField] = isNaN(n) ? null : n;
      } else if (dbField === "abundancia") {
        const n = parseInt(strVal.replace(",", "."), 10);
        out[dbField] = isNaN(n) ? null : n;
      } else {
        out[dbField] = dbField === "data" ? parseDate(val) : strVal;
      }
    } else if (!dbField) {
      // Unknown column → store in parametros using original (trimmed) key
      extras[rawKey.trim()] = strVal;
    }
  }

  if (Object.keys(extras).length > 0) {
    out.parametros = { ...(out.parametros as object || {}), ...extras };
  }
  if (grupoForcado) out.grupoTaxonomico = grupoForcado;
  return out;
}

function mapRowParametrico(
  row: Record<string, any>,
  grupoTaxonomico: string,
  paramsMap: Record<string, string>
): Record<string, any> {
  const out: Record<string, any> = {};
  const parametros: Record<string, number | string> = {};

  for (const [rawKey, val] of Object.entries(row)) {
    const norm = normalizeKey(rawKey);
    if (val === undefined || val === null || String(val).trim() === "") continue;
    const strVal = String(val).trim();

    // First try base universal fields
    const baseField = COLS_BASE[norm] || COL_MAP[norm];
    if (baseField && baseField !== "empreendimento_nome") {
      out[baseField] = baseField === "data" ? parseDate(val) : strVal;
      continue;
    }

    // Then try parametric fields
    const paramKey = paramsMap[norm];
    if (paramKey) {
      const numVal = parseFloat(strVal.replace(",", "."));
      parametros[paramKey] = isNaN(numVal) ? strVal : numVal;
    }
  }

  if (Object.keys(parametros).length > 0) out.parametros = parametros;
  out.grupoTaxonomico = grupoTaxonomico;
  return out;
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface ImportResult {
  empId: string; campanha: string; grupo: string; count: number;
}
interface Props {
  open: boolean; onClose: () => void;
  onImportSuccess?: (result: ImportResult) => void;
  empreendimentos: { id: number; nome: string }[];
  sysCampanhas?: { id: number; nome: string }[];
  defaultEmpId?: string;
}
type Step = "upload" | "config" | "preview" | "done";

export function ImportCampoDialog({ open, onClose, onImportSuccess, empreendimentos, sysCampanhas = [], defaultEmpId }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep]   = useState<Step>("upload");
  const [fileName, setFileName]         = useState("");
  const [rawRows, setRawRows]           = useState<Record<string, any>[]>([]);
  const [headers, setHeaders]           = useState<string[]>([]);
  const [tipo, setTipo]                 = useState<TipoMonitoramento>("fauna");
  const [grupoFauna, setGrupoFauna]     = useState("avifauna");
  const [selectedEmpId, setSelectedEmpId] = useState(defaultEmpId || "");
  const [campaignOverride, setCampaignOverride] = useState("");
  const [mappedRows, setMappedRows]     = useState<Record<string, any>[]>([]);
  const [errors, setErrors]             = useState<string[]>([]);
  const [speciesEnrich, setSpeciesEnrich] = useState<Record<string,{iucn:string;mma:string;cites:string;pan:string;nomeVernacular:string}>>({});
  const [enrichLoading, setEnrichLoading] = useState(false);

  const { data: dialogCampanhas = [] } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ["/api/empreendimentos", selectedEmpId, "campanhas"],
    queryFn: async () => {
      if (!selectedEmpId || selectedEmpId === "none") return [];
      const res = await fetch(`/api/empreendimentos/${selectedEmpId}/campanhas`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!selectedEmpId && selectedEmpId !== "none",
  });

  const availableCampanhas = dialogCampanhas.length > 0 ? dialogCampanhas : sysCampanhas;

  const importMutation = useMutation({
    mutationFn: async (registros: any[]) => {
      const res = await apiRequest("POST", "/api/campo/import", { registros });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campo/stats/dashboard"] });
      toast({ title: `${data.imported} registros importados com sucesso!` });
      setStep("done");
      if (onImportSuccess) {
        const grupo = tipo === "fauna" ? grupoFauna : tipo;
        const campanha = campaignOverride.trim() || mappedRows[0]?.campanha || "";
        onImportSuccess({ empId: selectedEmpId, campanha, grupo, count: data.imported });
      }
    },
    onError: (e: any) => toast({ title: "Erro na importação", description: e?.message, variant: "destructive" }),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const { read, utils } = await import("xlsx");
        const wb = read(ev.target?.result, { type: "binary", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (rows.length < 2) { toast({ title: "Planilha vazia ou sem dados", variant: "destructive" }); return; }
        const hdrs = (rows[0] as string[]).map(h => String(h).trim()).filter(Boolean);
        const dataRows = rows.slice(1).filter(r => (r as any[]).some(c => c !== "")).map(r => {
          const obj: Record<string, any> = {};
          hdrs.forEach((h, i) => { obj[h] = (r as any[])[i] ?? ""; });
          return obj;
        });
        setHeaders(hdrs);
        setRawRows(dataRows);
        setStep("config");
      } catch {
        toast({ title: "Erro ao ler o arquivo", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const getParamsMap = (): Record<string, string> => {
    if (tipo === "qualidade_agua") return PARAMS_AGUA;
    if (tipo === "solo") return PARAMS_SOLO;
    if (tipo === "ruido") return PARAMS_RUIDO;
    return {};
  };

  const handleBuild = () => {
    const empId = selectedEmpId ? parseInt(selectedEmpId) : undefined;
    const errs: string[] = [];

    const isBio = tipo === "fauna" || tipo === "flora";
    const grupo = tipo === "fauna" ? grupoFauna : tipo;

    const rows = rawRows.map((row, i) => {
      const r = isBio
        ? mapRowFauna(row, grupo)
        : mapRowParametrico(row, grupo, getParamsMap());

      if (!r.data) errs.push(`Linha ${i + 2}: data ausente ou inválida`);
      if (empId) r.empreendimentoId = empId;
      if (campaignOverride.trim()) r.campanha = campaignOverride.trim();
      if (!r.grupoTaxonomico) r.grupoTaxonomico = grupo;

      // For bio types, count parametros captured from non-bio columns
      if (!isBio && (!r.parametros || Object.keys(r.parametros).length === 0)) {
        errs.push(`Linha ${i + 2}: nenhum parâmetro reconhecido — verifique os cabeçalhos`);
      }
      return r;
    });

    setErrors(errs.slice(0, 5));
    setMappedRows(rows);
    setSpeciesEnrich({});
    setStep("preview");

    // Fetch IUCN/MMA/CITES enrichment for all unique species
    if (isBio) {
      const uniqueNames = [...new Set(rows.map(r => r.nomeCientifico).filter(Boolean))] as string[];
      if (uniqueNames.length > 0) {
        setEnrichLoading(true);
        fetch("/api/campo/species-lookup-batch", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names: uniqueNames }),
        })
          .then(r => r.ok ? r.json() : {})
          .then(data => setSpeciesEnrich(data))
          .catch(() => {})
          .finally(() => setEnrichLoading(false));
      }
    }
  };

  const handleImport = () => importMutation.mutate(mappedRows);

  const reset = () => {
    setStep("upload"); setFileName(""); setRawRows([]); setHeaders([]);
    setMappedRows([]); setErrors([]); setTipo("fauna"); setGrupoFauna("avifauna");
    setCampaignOverride(""); setSpeciesEnrich({}); setEnrichLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => { reset(); onClose(); };

  const isBio = tipo === "fauna" || tipo === "flora";
  const paramsMap = getParamsMap();
  const recognizedCount = isBio
    ? headers.filter(h => {
        const n = normalizeKey(h);
        return COL_MAP[n] && COL_MAP[n] !== "empreendimento_nome";
      }).length
    : headers.filter(h => {
        const n = normalizeKey(h);
        return COLS_BASE[n] || COL_MAP[n] || paramsMap[n];
      }).length;
  const extraCount = isBio
    ? headers.filter(h => {
        const n = normalizeKey(h);
        return !COL_MAP[n] && !IGNORE_COLS.has(n);
      }).length
    : 0;
  const tipoInfo = TIPOS_MONITORAMENTO.find(t => t.value === tipo)!;
  const template = TEMPLATE_INFO[tipo];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Importar Planilha de Monitoramento
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {(["upload","config","preview","done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === s ? "bg-emerald-600 text-white" : i < ["upload","config","preview","done"].indexOf(step) ? "bg-emerald-200 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
                {i + 1}
              </span>
              <span className={step === s ? "font-semibold text-foreground" : ""}>
                {["Arquivo","Tipologia","Revisar","Concluído"][i]}
              </span>
              {i < 3 && <ArrowRight className="h-3 w-3" />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
              <p className="font-semibold">Clique para selecionar ou arraste o arquivo</p>
              <p className="text-sm text-muted-foreground mt-1">Excel (.xlsx, .xls) ou CSV (.csv)</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700 space-y-1">
              <p className="font-semibold flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Formatos suportados</p>
              <p>Fauna, Flora, Qualidade da Água, Solo e Ruído/Acústica — cada tipologia é configurada na próxima etapa.</p>
              <p>A primeira linha da planilha deve ser o cabeçalho com os nomes das colunas.</p>
            </div>
          </div>
        )}

        {/* ── Step 2: Config ── */}
        {step === "config" && (
          <div className="space-y-5 py-2">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="font-medium text-sm">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {rawRows.length} linhas · {recognizedCount} mapeadas
                  {extraCount > 0 && <> · <span className="text-blue-600 font-medium">{extraCount} capturadas automaticamente</span></>}
                  {" "}de {headers.length} colunas
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Tipo de monitoramento */}
              <div>
                <label className="text-sm font-medium block mb-2">Tipologia de Monitoramento *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {TIPOS_MONITORAMENTO.map(t => {
                    const Icon = t.icon;
                    const active = tipo === t.value;
                    return (
                      <button key={t.value} type="button" onClick={() => setTipo(t.value)}
                        className={`rounded-xl border-2 p-3 text-left transition-all ${active ? "border-emerald-600 bg-emerald-50" : "border-border hover:border-muted-foreground"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`h-4 w-4 ${active ? "text-emerald-700" : "text-muted-foreground"}`} />
                          <span className={`text-sm font-semibold ${active ? "text-emerald-800" : ""}`}>{t.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subgrupo de fauna */}
              {tipo === "fauna" && (
                <div>
                  <label className="text-sm font-medium block mb-1.5">Grupo de Fauna *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {GRUPOS_FAUNA.map(g => (
                      <button key={g.value} type="button" onClick={() => setGrupoFauna(g.value)}
                        className={`rounded-lg border-2 p-2.5 text-sm font-medium text-left transition-all ${grupoFauna === g.value ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-border hover:border-muted-foreground"}`}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Sobrescreve a coluna GRUPO TAXONÔMICO da planilha.</p>
                </div>
              )}

              {/* Template info for non-bio types */}
              {!isBio && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <tipoInfo.icon className="h-3.5 w-3.5" />
                    Colunas esperadas para {tipoInfo.label}
                    {template.limite && <Badge variant="outline" className="text-[10px] ml-1">{template.limite}</Badge>}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {template.colunas.map(c => (
                      <code key={c} className="text-[10px] bg-background border rounded px-1.5 py-0.5">{c}</code>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Os parâmetros numéricos são armazenados automaticamente. Colunas não reconhecidas são ignoradas.
                  </p>
                </div>
              )}

              {/* Empreendimento + Campanha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Empreendimento</label>
                  <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar empreendimento..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Usar da planilha</SelectItem>
                      {empreendimentos.map(e => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Sobrescreve coluna EMPREENDIMENTO</p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Campanha</label>
                  {availableCampanhas.length > 0 ? (
                    <Select value={campaignOverride || "__planilha__"} onValueChange={v => setCampaignOverride(v === "__planilha__" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar campanha..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__planilha__">Usar da planilha</SelectItem>
                        {availableCampanhas.map(c => (
                          <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <input
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="Deixe em branco para usar da planilha"
                      value={campaignOverride}
                      onChange={e => setCampaignOverride(e.target.value)}
                    />
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Normaliza coluna CAMPANHA</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={handleBuild} className="gap-2">
                Revisar Dados <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 3: Preview ── */}
        {step === "preview" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Table2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-medium text-sm">{mappedRows.length} registros prontos para importar</p>
                  <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground">
                    Tipologia: <Badge variant="outline" className="text-xs">{tipoInfo.label}</Badge>
                    {tipo === "fauna" && <Badge variant="outline" className="text-xs">{grupoFauna}</Badge>}
                  </div>
                </div>
              </div>
              {errors.length > 0 && (
                <Badge variant="outline" className="text-orange-700 border-orange-300 gap-1">
                  <AlertTriangle className="h-3 w-3" /> {errors.length} avisos
                </Badge>
              )}
            </div>

            {errors.length > 0 && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800 space-y-1">
                <p className="font-semibold">Avisos:</p>
                {errors.map((e, i) => <p key={i}>{e}</p>)}
                {errors.length === 5 && <p className="italic">...e possivelmente mais.</p>}
              </div>
            )}

            {/* Show extra/unmapped columns info */}
            {isBio && extraCount > 0 && (() => {
              const extraCols = headers.filter(h => {
                const n = normalizeKey(h);
                return !COL_MAP[n] && !IGNORE_COLS.has(n);
              });
              return (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                  <p className="font-semibold mb-1">✓ {extraCols.length} coluna(s) capturada(s) automaticamente</p>
                  <p className="text-xs text-blue-700 mb-2">As colunas abaixo não têm campo fixo no sistema mas serão salvas integralmente e estarão disponíveis nos dados exportados.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {extraCols.map(c => (
                      <span key={c} className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 border border-blue-300 text-[11px] font-mono">{c}</span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Coordinate warning */}
            {isBio && mappedRows.length > 0 && mappedRows.every(r => !r.latitude && !r.longitude) && (
              <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 text-sm text-amber-800 flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold">Nenhuma coordenada GPS detectada</p>
                  <p className="text-xs mt-0.5">
                    Os registros serão importados sem localização geográfica e não aparecerão no mapa.
                    Adicione colunas <strong>Latitude</strong> / <strong>Longitude</strong> (WGS84) ou{" "}
                    <strong>Easting (X)</strong> / <strong>Northing (Y)</strong> / <strong>Zona UTM</strong> na planilha.
                  </p>
                </div>
              </div>
            )}
            {isBio && mappedRows.length > 0 && mappedRows.some(r => !r.latitude || !r.longitude) && !mappedRows.every(r => !r.latitude && !r.longitude) && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                <div>
                  <p className="font-semibold">{mappedRows.filter(r => !r.latitude || !r.longitude).length} registros sem coordenadas GPS</p>
                  <p className="text-xs mt-0.5">Esses registros não serão exibidos no mapa de ocorrências.</p>
                </div>
              </div>
            )}

            {/* ── Missing date warning ── */}
            {mappedRows.length > 0 && (() => {
              const missing = mappedRows.filter(r => !r.data || String(r.data).trim() === "").length;
              if (!missing) return null;
              return (
                <div className="rounded-lg bg-orange-50 border border-orange-300 p-3 text-sm text-orange-800 flex gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
                  <div>
                    <p className="font-semibold">{missing} registro(s) sem data de coleta</p>
                    <p className="text-xs mt-0.5">
                      A planilha não forneceu data para {missing === mappedRows.length ? "todos os" : "alguns"} registros.
                      Verifique se a coluna <strong>DATA</strong> existe e está preenchida.
                      Os registros sem data serão importados com a data de hoje como fallback.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* ── Enrichment loading indicator ── */}
            {enrichLoading && (
              <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                Consultando base IUCN / MMA / CITES…
              </div>
            )}

            {/* ── F4: Validação por célula (preview até 20 linhas) ── */}
            {(() => {
              const preview20 = mappedRows.slice(0, 20);
              const isNum = (v: any) => v !== undefined && v !== null && v !== "" && !isNaN(Number(v));
              const dateOk = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
              const issues = preview20.map(r => ({
                data: !dateOk(r.data),
                nomeCientifico: !((r.nomeCientifico || "").toString().trim()),
                latitude: r.latitude !== undefined && r.latitude !== "" && !isNum(r.latitude),
                longitude: r.longitude !== undefined && r.longitude !== "" && !isNum(r.longitude),
                pesoG: r.pesoG !== undefined && r.pesoG !== "" && (isNum(r.pesoG) ? Number(r.pesoG) < 0 : true),
              }));
              const totalIssues = issues.reduce((acc, x) => acc + Object.values(x).filter(Boolean).length, 0);
              const rowsWithIssues = issues.filter(x => Object.values(x).some(Boolean)).length;
              if (totalIssues === 0) return null;
              return (
                <div className="rounded-lg bg-red-50 border border-red-300 p-3 text-sm text-red-800">
                  <p className="font-semibold mb-1">⚠ {totalIssues} célula(s) com problemas em {rowsWithIssues} linha(s) (entre as primeiras 20)</p>
                  <p className="text-xs">Células marcadas em vermelho na tabela abaixo precisam de revisão: data inválida, nome científico vazio, latitude/longitude não-numérica, ou peso negativo. Você ainda pode importar — os dados serão salvos como estão.</p>
                </div>
              );
            })()}

            {/* ── Full preview table ── */}
            {(() => {
              const preview = mappedRows.slice(0, 10);

              // F4: Helpers de validação por célula
              const isNum = (v: any) => v !== undefined && v !== null && v !== "" && !isNaN(Number(v));
              const dateOk = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
              const cellBad = (r: any, key: string): boolean => {
                if (key === "data") return !dateOk(r.data);
                if (key === "nomeCientifico") return !((r.nomeCientifico || "").toString().trim());
                if (key === "latitude")  return r.latitude !== undefined && r.latitude !== "" && !isNum(r.latitude);
                if (key === "longitude") return r.longitude !== undefined && r.longitude !== "" && !isNum(r.longitude);
                if (key === "pesoG") return r.pesoG !== undefined && r.pesoG !== "" && (!isNum(r.pesoG) || Number(r.pesoG) < 0);
                return false;
              };
              const badCls = "bg-red-100 text-red-800 font-semibold";

              // Determine which optional columns have any data
              const has = (field: string) => preview.some(r => r[field] && String(r[field]).trim() !== "");

              // IUCN badge colour helper
              const iucnColor = (cat: string) => {
                const c = cat.toUpperCase();
                if (c.startsWith("CR")) return "bg-red-100 text-red-800 border-red-300";
                if (c.startsWith("EN")) return "bg-orange-100 text-orange-800 border-orange-300";
                if (c.startsWith("VU")) return "bg-yellow-100 text-yellow-800 border-yellow-300";
                if (c.startsWith("NT")) return "bg-sky-100 text-sky-800 border-sky-300";
                if (c.startsWith("LC")) return "bg-emerald-100 text-emerald-800 border-emerald-300";
                return "bg-muted text-muted-foreground border-border";
              };

              // Bio columns
              const bioCols: {key:string;label:string;always?:boolean}[] = isBio ? [
                {key:"nomeCientifico",label:"Nome Científico",always:true},
                {key:"nomeComum",     label:"Nome Comum"},
                {key:"grupoTaxonomico",label:"Grupo",always:true},
                {key:"data",         label:"Data",always:true},
                {key:"campanha",     label:"Campanha",always:true},
                {key:"unidadeAmostral",label:"UA",always:true},
                {key:"metodo",       label:"Método"},
                {key:"ctMm",         label:"CT (mm)"},
                {key:"lcMm",         label:"LC (mm)"},
                {key:"ccMm",         label:"CC (mm)"},
                {key:"acMm",         label:"AC (mm)"},
                {key:"doMm",         label:"DO (mm)"},
                {key:"pesoG",        label:"Peso (g)"},
                {key:"sexo",         label:"Sexo"},
                {key:"estadoReprod", label:"Reprod."},
                {key:"malha",        label:"Malha"},
                {key:"densidade",    label:"Densidade"},
                {key:"latitude",     label:"Lat"},
                {key:"longitude",    label:"Lon"},
              ] : [];

              const visibleBioCols = isBio ? bioCols.filter(c => c.always || has(c.key)) : [];

              return (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="text-xs w-full min-w-max">
                    <thead className="bg-muted/80 border-b">
                      <tr>
                        <th className="px-2 py-2 text-left font-semibold sticky left-0 bg-muted/80 z-10">#</th>
                        {isBio ? (
                          <>
                            {visibleBioCols.map(c => (
                              <th key={c.key} className="px-2 py-2 text-left font-semibold whitespace-nowrap">{c.label}</th>
                            ))}
                            {/* Conservation status columns — always show for bio */}
                            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap text-red-700 bg-red-50/50">IUCN</th>
                            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap text-orange-700 bg-orange-50/50">MMA</th>
                            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap text-violet-700 bg-violet-50/50">CITES</th>
                            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap text-teal-700 bg-teal-50/50">PAN</th>
                          </>
                        ) : (
                          <>
                            <th className="px-2 py-2 text-left font-semibold">Grupo</th>
                            <th className="px-2 py-2 text-left font-semibold">Data</th>
                            <th className="px-2 py-2 text-left font-semibold">Campanha</th>
                            <th className="px-2 py-2 text-left font-semibold">UA</th>
                            <th className="px-2 py-2 text-left font-semibold">Parâmetros</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => {
                        const enrich = speciesEnrich[r.nomeCientifico] ?? null;
                        return (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                            <td className="px-2 py-1.5 text-muted-foreground sticky left-0 bg-inherit">{i + 1}</td>
                            {isBio ? (
                              <>
                                {visibleBioCols.map(c => {
                                  const bad = cellBad(r, c.key);
                                  return (
                                  <td key={c.key} className={`px-2 py-1.5 whitespace-nowrap ${bad ? badCls : ""}`}
                                    title={bad ? "Valor inválido — revise antes de importar" : undefined}>
                                    {c.key === "grupoTaxonomico"
                                      ? <Badge variant="outline" className="text-[10px]">{r[c.key] || "—"}</Badge>
                                      : c.key === "nomeCientifico"
                                        ? <span className="italic font-medium">{r[c.key] || (bad ? "✗ vazio" : "—")}</span>
                                        : c.key === "data"
                                          ? (bad ? "✗ data inválida" : r[c.key])
                                          : r[c.key] || <span className="text-muted-foreground/50">—</span>}
                                  </td>
                                ); })}
                                {/* IUCN */}
                                <td className="px-2 py-1.5 bg-red-50/30">
                                  {enrichLoading && !enrich ? (
                                    <span className="text-muted-foreground/40 text-[10px]">…</span>
                                  ) : enrich?.iucn ? (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${iucnColor(enrich.iucn)}`}>{enrich.iucn}</span>
                                  ) : (
                                    <span className="text-muted-foreground/40 text-[10px]">LC / NE</span>
                                  )}
                                </td>
                                {/* MMA */}
                                <td className="px-2 py-1.5 bg-orange-50/30">
                                  {enrich?.mma ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border bg-orange-100 text-orange-800 border-orange-300">{enrich.mma}</span>
                                  ) : (
                                    <span className="text-muted-foreground/40 text-[10px]">—</span>
                                  )}
                                </td>
                                {/* CITES */}
                                <td className="px-2 py-1.5 bg-violet-50/30">
                                  {enrich?.cites ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border bg-violet-100 text-violet-800 border-violet-300">{enrich.cites}</span>
                                  ) : (
                                    <span className="text-muted-foreground/40 text-[10px]">—</span>
                                  )}
                                </td>
                                {/* PAN */}
                                <td className="px-2 py-1.5 bg-teal-50/30 max-w-[140px]">
                                  {enrich?.pan ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border bg-teal-100 text-teal-800 border-teal-300 truncate max-w-[130px]" title={enrich.pan}>{enrich.pan}</span>
                                  ) : (
                                    <span className="text-muted-foreground/40 text-[10px]">—</span>
                                  )}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-2 py-1.5"><Badge variant="outline" className="text-[10px]">{r.grupoTaxonomico || "—"}</Badge></td>
                                <td className="px-2 py-1.5 font-mono">{r.data || <span className="text-red-500">!</span>}</td>
                                <td className="px-2 py-1.5">{r.campanha || "—"}</td>
                                <td className="px-2 py-1.5">{r.unidadeAmostral || "—"}</td>
                                <td className="px-2 py-1.5">
                                  {r.parametros
                                    ? Object.entries(r.parametros).slice(0, 5).map(([k, v]) => (
                                        <span key={k} className="inline-block mr-2 text-[10px] font-mono">
                                          <span className="text-muted-foreground">{k}:</span> {String(v)}
                                        </span>
                                      ))
                                    : <span className="text-red-500 text-[10px]">sem parâmetros</span>}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {mappedRows.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center py-2 border-t">
                      + {mappedRows.length - 10} registros adicionais
                    </p>
                  )}
                </div>
              );
            })()}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("config")}>Voltar</Button>
              <Button onClick={handleImport} disabled={importMutation.isPending}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                {importMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</>
                  : <><Upload className="h-4 w-4" /> Importar {mappedRows.length} registros</>}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === "done" && (
          <div className="text-center py-10 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
            <div>
              <p className="text-xl font-bold">Importação concluída!</p>
              <p className="text-muted-foreground">
                {mappedRows.length} registros de <strong>{tipoInfo.label}</strong> importados com sucesso.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => { reset(); setStep("upload"); }}>
                Importar outro arquivo
              </Button>
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
