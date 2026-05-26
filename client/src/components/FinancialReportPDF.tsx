import { useState } from "react";
import { FileDown, Loader2, ChevronDown, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FinancialStats {
  totalReceitas: number;
  totalDespesas: number;
  totalPendente: number;
  saldoAtual: number;
  porCategoria: Array<{ categoria: string; valor: number; tipo: string; unidade?: string }>;
  porEmpreendimento: Array<{ empreendimento: string; empreendimentoId: number; receitas: number; despesas: number; lucro: number; unidade?: string }>;
  porProjeto?: Array<{ projeto: string; projetoId: number; receitas: number; despesas: number; lucro: number }>;
  porCampanha?: Array<{ campanha: string; campanhaId: number; receitas: number; despesas: number; lucro: number }>;
  evolucaoMensal: Array<{ mes: string; receitas: number; despesas: number; lucro: number }>;
  empreendimentoNome?: string;
}

const UNIDADES_CONFIG: { [key: string]: { label: string; sigla: string } } = {
  salvador: { label: "Salvador (BA)", sigla: "BA" },
  goiania: { label: "Goiânia (GO)", sigla: "GO" },
  lem: { label: "Luís Eduardo Magalhães (LEM)", sigla: "LEM" }
};

interface Empreendimento {
  id: number;
  nome: string;
}

interface FinancialReportPDFProps {
  stats: FinancialStats | undefined;
  empreendimentos: Empreendimento[];
  lineChartRef?: React.RefObject<any>;
  pieChartRef?: React.RefObject<any>;
  barChartRef?: React.RefObject<any>;
  expenseEvolutionChartRef?: React.RefObject<any>;
}

// ── SGAI Brand Colors ─────────────────────────────────────────────────────────
const ECOBRASIL_COLORS = {
  green:      [30, 97, 70]    as [number, number, number], // #1E6146 forest green
  yellow:     [245, 168, 0]   as [number, number, number], // amber
  blue:       [0, 89, 156]    as [number, number, number], // #00599C primary blue
  darkGreen:  [10, 28, 50]    as [number, number, number], // dark navy
  lightGreen: [235, 247, 241] as [number, number, number], // light green bg
  red:        [215, 58, 58]   as [number, number, number], // red
};
const SECONDARY_FIN = [178, 205, 225] as [number, number, number];

type PeriodType = "all" | "this_week" | "this_month" | "last_month" | "last_3_months" | "last_6_months" | "last_12_months" | "custom";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "all", label: "Todo o período" },
  { value: "this_week", label: "Esta semana" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês anterior" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_12_months", label: "Últimos 12 meses" },
  { value: "custom", label: "Período personalizado" },
];

export function FinancialReportPDF({ stats, empreendimentos, lineChartRef, pieChartRef, barChartRef, expenseEvolutionChartRef }: FinancialReportPDFProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { toast } = useToast();

  const getDateRange = (): { startDate: Date | null; endDate: Date | null; periodLabel: string } => {
    const now = new Date();
    
    switch (selectedPeriod) {
      case "this_week":
        return { 
          startDate: startOfWeek(now, { locale: ptBR }), 
          endDate: endOfWeek(now, { locale: ptBR }),
          periodLabel: "Esta semana"
        };
      case "this_month":
        return { 
          startDate: startOfMonth(now), 
          endDate: endOfMonth(now),
          periodLabel: format(now, "MMMM 'de' yyyy", { locale: ptBR })
        };
      case "last_month":
        const lastMonth = subMonths(now, 1);
        return { 
          startDate: startOfMonth(lastMonth), 
          endDate: endOfMonth(lastMonth),
          periodLabel: format(lastMonth, "MMMM 'de' yyyy", { locale: ptBR })
        };
      case "last_3_months":
        return { 
          startDate: subMonths(now, 3), 
          endDate: now,
          periodLabel: "Últimos 3 meses"
        };
      case "last_6_months":
        return { 
          startDate: subMonths(now, 6), 
          endDate: now,
          periodLabel: "Últimos 6 meses"
        };
      case "last_12_months":
        return { 
          startDate: subMonths(now, 12), 
          endDate: now,
          periodLabel: "Últimos 12 meses"
        };
      case "custom":
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          const end = new Date(customEndDate);
          return { 
            startDate: start, 
            endDate: end,
            periodLabel: `${format(start, "dd/MM/yyyy")} a ${format(end, "dd/MM/yyyy")}`
          };
        }
        return { startDate: null, endDate: null, periodLabel: "Período inválido" };
      default:
        return { startDate: null, endDate: null, periodLabel: "Todo o período" };
    }
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const generatePDF = async () => {
    setIsExporting(true);
    setIsPopoverOpen(false);
    
    try {
      const { startDate, endDate, periodLabel } = getDateRange();
      
      // Validate custom period
      if (selectedPeriod === "custom" && (!customStartDate || !customEndDate)) {
        toast({
          title: "Período inválido",
          description: "Por favor, informe as datas de início e fim do período.",
          variant: "destructive",
        });
        setIsExporting(false);
        return;
      }

      let reportStats: FinancialStats;
      let reportTitle = 'Relatório Financeiro Consolidado';
      
      // Build query params
      const params = new URLSearchParams();
      if (selectedEmpreendimentoId !== "all") {
        params.append("empreendimentoId", selectedEmpreendimentoId);
      }
      if (startDate) {
        params.append("startDate", startDate.toISOString());
      }
      if (endDate) {
        params.append("endDate", endDate.toISOString());
      }
      
      const queryString = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/financeiro/stats${queryString}`);
      
      if (!response.ok) {
        throw new Error("Falha ao buscar dados financeiros");
      }
      
      reportStats = await response.json();
      
      if (selectedEmpreendimentoId !== "all") {
        const empName = reportStats.empreendimentoNome || empreendimentos.find(e => e.id === parseInt(selectedEmpreendimentoId))?.nome;
        reportTitle = `Relatório Financeiro - ${empName || 'Empreendimento'}`;
      }

      const safeStats = {
        totalReceitas: reportStats.totalReceitas || 0,
        totalDespesas: reportStats.totalDespesas || 0,
        totalPendente: reportStats.totalPendente || 0,
        saldoAtual: reportStats.saldoAtual || 0,
        porCategoria: reportStats.porCategoria || [],
        porEmpreendimento: reportStats.porEmpreendimento || [],
        porProjeto: reportStats.porProjeto || [],
        porCampanha: reportStats.porCampanha || [],
        evolucaoMensal: reportStats.evolucaoMensal || [],
      };

      // ── Fetch cover background image ─────────────────────────────────────
      const fetchImgBase64 = async (url: string): Promise<string | null> => {
        try {
          const r = await fetch(url);
          if (!r.ok) return null;
          const blob = await r.blob();
          return new Promise(res => {
            const fr = new FileReader();
            fr.onloadend = () => res(fr.result as string);
            fr.onerror = () => res(null);
            fr.readAsDataURL(blob);
          });
        } catch { return null; }
      };
      const coverBg = await fetchImgBase64('/images/pdf-cover-environment.png');

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      // ══════════════════════════════════════════════════════════════════════
      // COVER PAGE — AmbientIA Clean White Design
      // ══════════════════════════════════════════════════════════════════════

      // 1. White background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // 2. Blue header band (top)
      doc.setFillColor(...ECOBRASIL_COLORS.blue);
      doc.rect(0, 0, pageWidth, 55, 'F');

      // 3. Green accent stripe below header
      doc.setFillColor(...ECOBRASIL_COLORS.green);
      doc.rect(0, 55, pageWidth, 3, 'F');

      // 4. Logo inside header (left-aligned)
      try {
        const logoFin = new Image();
        logoFin.src = '/logo.png';
        doc.addImage(logoFin, 'PNG', 18, 8, 56, 24);
      } catch {
        doc.setFontSize(22);
        doc.setFont(undefined as any, 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('AmbientIA', 20, 28);
      }

      // 5. Tagline inside header (below logo)
      doc.setFontSize(7);
      doc.setFont(undefined as any, 'normal');
      doc.setTextColor(178, 205, 225);
      doc.text('Plataforma Inteligente de Gestão para Consultorias Ambientais', 18, 40);

      // 6. Report type label (green, below header stripe)
      doc.setFontSize(8);
      doc.setFont(undefined as any, 'bold');
      doc.setTextColor(...ECOBRASIL_COLORS.green);
      doc.setCharSpace(1.5);
      doc.text('RELATÓRIO FINANCEIRO', 20, 72);
      doc.setCharSpace(0);

      // 7. Report title — large, dark navy
      doc.setFontSize(22);
      doc.setFont(undefined as any, 'bold');
      doc.setTextColor(10, 28, 50);
      const maxTitleWidth = pageWidth - 40;
      const titleLines: string[] = doc.splitTextToSize(reportTitle, maxTitleWidth);
      let tY = 85;
      titleLines.forEach((line: string) => {
        doc.text(line, 20, tY);
        tY += 11;
      });

      // 8. Horizontal divider
      doc.setFillColor(...ECOBRASIL_COLORS.blue);
      doc.rect(20, tY + 2, pageWidth - 40, 0.8, 'F');
      tY += 10;

      // 9. Metadata
      [
        { label: 'PERÍODO', value: periodLabel },
        { label: 'GERADO EM', value: new Date().toLocaleDateString('pt-BR') },
      ].forEach((md, i) => {
        const mx = 20 + i * 95;
        doc.setFontSize(6);
        doc.setFont(undefined as any, 'bold');
        doc.setTextColor(120, 130, 140);
        doc.text(md.label, mx, tY);
        doc.setFontSize(10);
        doc.setFont(undefined as any, 'bold');
        doc.setTextColor(10, 28, 50);
        doc.text(md.value, mx, tY + 7);
      });

      // 10. Left green accent bar
      doc.setFillColor(...ECOBRASIL_COLORS.green);
      doc.rect(0, 58, 5, pageHeight - 68, 'F');

      // 11. Cover footer bar
      doc.setFillColor(...ECOBRASIL_COLORS.green);
      doc.rect(0, pageHeight - 10, pageWidth, 1.5, 'F');
      doc.setFillColor(...ECOBRASIL_COLORS.blue);
      doc.rect(0, pageHeight - 8.5, pageWidth, 8.5, 'F');
      doc.setFontSize(7);
      doc.setFont(undefined as any, 'normal');
      doc.setTextColor(178, 205, 225);
      doc.text('AmbientIA — Plataforma Inteligente de Gestão para Consultorias Ambientais', pageWidth / 2, pageHeight - 3.5, { align: 'center' });

      // ── Page 2: Financial Summary ─────────────────────────────────────────
      doc.addPage();

      // Page header band
      doc.setFillColor(...ECOBRASIL_COLORS.blue);
      doc.rect(0, 0, pageWidth, 11, 'F');
      doc.setFillColor(...ECOBRASIL_COLORS.green);
      doc.rect(0, 11, pageWidth, 2, 'F');
      doc.setFontSize(7.5);
      doc.setFont(undefined as any, 'bold');
      doc.setTextColor(255, 255, 255);
      try { const l1 = new Image(); l1.src='/logo.png'; doc.addImage(l1,'PNG',20,1,16,9); } catch {}
      doc.setFont(undefined as any, 'normal');
      doc.setTextColor(...SECONDARY_FIN);
      doc.text(' › Resumo Financeiro', 40, 7.5);

      let yPos = 18;

      doc.setFontSize(13);
      doc.setFont(undefined as any, 'bold');
      doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
      doc.text('Resumo Financeiro', 20, yPos);
      doc.setFont(undefined as any, 'normal');
      yPos += 10;

      const cardWidth = (pageWidth - 50) / 2;
      const cardHeight = 25;
      const margin = 10;

      // Receitas card
      doc.setFillColor(234, 246, 239);
      doc.roundedRect(20, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setFillColor(...ECOBRASIL_COLORS.green);
      doc.rect(20, yPos, cardWidth, 3, 'F');
      doc.setFontSize(8);
      doc.setTextColor(80, 95, 110);
      doc.text('Total Receitas', 25, yPos + 11);
      doc.setFontSize(13);
      doc.setTextColor(...ECOBRASIL_COLORS.green);
      doc.text(formatCurrency(safeStats.totalReceitas), 25, yPos + 20);

      // Despesas card
      doc.setFillColor(255, 241, 241);
      doc.roundedRect(25 + cardWidth + margin, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setFillColor(...ECOBRASIL_COLORS.red);
      doc.rect(25 + cardWidth + margin, yPos, cardWidth, 3, 'F');
      doc.setFontSize(8);
      doc.setTextColor(80, 95, 110);
      doc.text('Total Despesas', 30 + cardWidth + margin, yPos + 11);
      doc.setFontSize(13);
      doc.setTextColor(...ECOBRASIL_COLORS.red);
      doc.text(formatCurrency(safeStats.totalDespesas), 30 + cardWidth + margin, yPos + 20);

      yPos += cardHeight + margin;

      const balanceColor = safeStats.saldoAtual >= 0 ? ECOBRASIL_COLORS.green : ECOBRASIL_COLORS.red;
      // Saldo card
      doc.setFillColor(236, 245, 252);
      doc.roundedRect(20, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setFillColor(...balanceColor as [number, number, number]);
      doc.rect(20, yPos, cardWidth, 3, 'F');
      doc.setFontSize(8);
      doc.setTextColor(80, 95, 110);
      doc.text('Saldo Atual', 25, yPos + 11);
      doc.setFontSize(13);
      doc.setTextColor(...balanceColor as [number, number, number]);
      doc.text(formatCurrency(safeStats.saldoAtual), 25, yPos + 20);

      // Pendente card
      doc.setFillColor(255, 251, 232);
      doc.roundedRect(25 + cardWidth + margin, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setFillColor(...ECOBRASIL_COLORS.yellow);
      doc.rect(25 + cardWidth + margin, yPos, cardWidth, 3, 'F');
      doc.setFontSize(8);
      doc.setTextColor(80, 95, 110);
      doc.text('Pendente', 30 + cardWidth + margin, yPos + 11);
      doc.setFontSize(13);
      doc.setTextColor(...ECOBRASIL_COLORS.yellow);
      doc.text(formatCurrency(safeStats.totalPendente), 30 + cardWidth + margin, yPos + 20);

      yPos += cardHeight + 20;

      if (safeStats.evolucaoMensal.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('Evolução Mensal', 20, yPos);
        yPos += 5;

        autoTable(doc, {
          startY: yPos,
          head: [['Mês', 'Receitas', 'Despesas', 'Lucro/Prejuízo']],
          body: safeStats.evolucaoMensal.map(m => [
            m.mes,
            formatCurrency(m.receitas),
            formatCurrency(m.despesas),
            formatCurrency(m.lucro)
          ]),
          styles: {
            fontSize: 9,
            cellPadding: 4,
          },
          headStyles: {
            fillColor: ECOBRASIL_COLORS.green,
            textColor: 255,
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [245, 250, 245]
          },
          columnStyles: {
            0: { fontStyle: 'bold' },
            1: { textColor: [30, 97, 70], halign: 'right' },
            2: { textColor: [215, 58, 58], halign: 'right' },
            3: { halign: 'right' }
          },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3) {
              const value = safeStats.evolucaoMensal[data.row.index]?.lucro || 0;
              data.cell.styles.textColor = value >= 0 ? [30, 97, 70] : [215, 58, 58];
            }
          },
          margin: { left: 20, right: 20 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = 20;
      }

      if (safeStats.porCategoria.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('Distribuição por Categoria', 20, yPos);
        yPos += 5;

        autoTable(doc, {
          startY: yPos,
          head: [['Categoria', 'Tipo', 'Valor']],
          body: safeStats.porCategoria.map(c => [
            c.categoria,
            c.tipo === 'receita' ? 'Receita' : 'Despesa',
            formatCurrency(c.valor)
          ]),
          styles: {
            fontSize: 9,
            cellPadding: 4,
          },
          headStyles: {
            fillColor: ECOBRASIL_COLORS.yellow,
            textColor: [50, 50, 50],
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [255, 252, 240]
          },
          columnStyles: {
            2: { halign: 'right' }
          },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 1) {
              const tipo = safeStats.porCategoria[data.row.index]?.tipo;
              data.cell.styles.textColor = tipo === 'receita' ? [30, 97, 70] : [215, 58, 58];
            }
            if (data.section === 'body' && data.column.index === 2) {
              const tipo = safeStats.porCategoria[data.row.index]?.tipo;
              data.cell.styles.textColor = tipo === 'receita' ? [30, 97, 70] : [215, 58, 58];
            }
          },
          margin: { left: 20, right: 20 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = 20;
      }

      if (safeStats.porEmpreendimento.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('Resultado por Projeto', 20, yPos);
        yPos += 5;

        autoTable(doc, {
          startY: yPos,
          head: [['Projeto', 'Unidade', 'Receitas', 'Despesas', 'Resultado']],
          body: safeStats.porEmpreendimento.map(e => [
            e.empreendimento.length > 25 ? e.empreendimento.substring(0, 25) + '...' : e.empreendimento,
            UNIDADES_CONFIG[e.unidade || '']?.sigla || e.unidade || '-',
            formatCurrency(e.receitas),
            formatCurrency(e.despesas),
            formatCurrency(e.lucro)
          ]),
          styles: {
            fontSize: 9,
            cellPadding: 4,
          },
          headStyles: {
            fillColor: ECOBRASIL_COLORS.blue,
            textColor: 255,
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [240, 248, 255]
          },
          columnStyles: {
            1: { halign: 'center' },
            2: { textColor: [30, 97, 70], halign: 'right' },
            3: { textColor: [215, 58, 58], halign: 'right' },
            4: { halign: 'right' }
          },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 4) {
              const value = safeStats.porEmpreendimento[data.row.index]?.lucro || 0;
              data.cell.styles.textColor = value >= 0 ? [30, 97, 70] : [215, 58, 58];
            }
          },
          margin: { left: 20, right: 20 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // ── Tabela por Projeto ────────────────────────────────────────────────
      if (safeStats.porProjeto.length > 0) {
        if (yPos > pageHeight - 80) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('Resultado por Projeto', 20, yPos);
        yPos += 5;
        autoTable(doc, {
          startY: yPos,
          head: [['Projeto', 'Receitas', 'Despesas', 'Resultado']],
          body: safeStats.porProjeto.map(p => [
            p.projeto.length > 35 ? p.projeto.substring(0, 35) + '...' : p.projeto,
            formatCurrency(p.receitas),
            formatCurrency(p.despesas),
            formatCurrency(p.lucro),
          ]),
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [10, 106, 122], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [240, 252, 254] },
          columnStyles: {
            1: { textColor: [30, 97, 70], halign: 'right' },
            2: { textColor: [215, 58, 58], halign: 'right' },
            3: { halign: 'right' },
          },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3) {
              const v = safeStats.porProjeto[data.row.index]?.lucro || 0;
              data.cell.styles.textColor = v >= 0 ? [30, 97, 70] : [215, 58, 58];
            }
          },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // ── Tabela por Campanha ───────────────────────────────────────────────
      if (safeStats.porCampanha.length > 0) {
        if (yPos > pageHeight - 80) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('Gastos por Campanha de Monitoramento', 20, yPos);
        yPos += 5;
        autoTable(doc, {
          startY: yPos,
          head: [['Campanha', 'Receitas', 'Despesas', 'Resultado']],
          body: safeStats.porCampanha.map(c => [
            c.campanha.length > 35 ? c.campanha.substring(0, 35) + '...' : c.campanha,
            formatCurrency(c.receitas),
            formatCurrency(c.despesas),
            formatCurrency(c.lucro),
          ]),
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [245, 168, 0], textColor: [40, 40, 40], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 252, 235] },
          columnStyles: {
            1: { textColor: [30, 97, 70], halign: 'right' },
            2: { textColor: [215, 58, 58], halign: 'right' },
            3: { halign: 'right' },
          },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3) {
              const v = safeStats.porCampanha[data.row.index]?.lucro || 0;
              data.cell.styles.textColor = v >= 0 ? [30, 97, 70] : [215, 58, 58];
            }
          },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // ══════════════════════════════════════════════════════════════════════
      // PÁGINA DE GRÁFICOS — desenhados nativamente em jsPDF (sem canvas refs)
      // ══════════════════════════════════════════════════════════════════════
      const hasChartData = safeStats.evolucaoMensal.length > 0 || safeStats.porCategoria.length > 0 || safeStats.porCampanha.length > 0;

      if (hasChartData) {
        doc.addPage();

        // Page header
        doc.setFillColor(...ECOBRASIL_COLORS.blue);
        doc.rect(0, 0, pageWidth, 13, 'F');
        doc.setFillColor(...ECOBRASIL_COLORS.green);
        doc.rect(0, 11, pageWidth, 2, 'F');
        doc.setFontSize(7.5);
        doc.setFont(undefined as any, 'bold');
        doc.setTextColor(255, 255, 255);
        try { const l2 = new Image(); l2.src='/logo.png'; doc.addImage(l2,'PNG',20,1,16,9); } catch {}
        doc.setFont(undefined as any, 'normal');
        doc.setTextColor(...SECONDARY_FIN);
        doc.text(' › Gráficos Financeiros', 40, 7.5);

        yPos = 22;

        doc.setFontSize(13);
        doc.setFont(undefined as any, 'bold');
        doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
        doc.text('Gráficos Financeiros', 20, yPos);
        doc.setFont(undefined as any, 'normal');
        yPos += 10;

        // ── Helper: desenhar gráfico de barras agrupadas ──────────────────
        const drawGroupedBarChart = (
          title: string,
          labels: string[],
          series: Array<{ label: string; color: [number, number, number]; values: number[] }>,
          cx: number, cy: number, cw: number, ch: number
        ) => {
          if (labels.length === 0) return;

          doc.setFontSize(10);
          doc.setFont(undefined as any, 'bold');
          doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
          doc.text(title, cx, cy);
          doc.setFont(undefined as any, 'normal');

          const padL = 28, padB = 16, padT = 6, padR = 4;
          const plotX = cx + padL;
          const plotY = cy + padT;
          const plotW = cw - padL - padR;
          const plotH = ch - padT - padB;

          const allVals = series.flatMap(s => s.values).filter(v => v > 0);
          const maxVal = allVals.length > 0 ? Math.max(...allVals) * 1.1 : 1;

          // Grid lines & Y-axis labels
          const gridCount = 4;
          for (let gi = 0; gi <= gridCount; gi++) {
            const gy = plotY + plotH - (gi / gridCount) * plotH;
            const gv = (gi / gridCount) * maxVal;
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.25);
            doc.line(plotX, gy, plotX + plotW, gy);
            doc.setFontSize(5);
            doc.setTextColor(120, 120, 120);
            const lbl = gv >= 1000000 ? `R$${(gv / 1000000).toFixed(1)}M` : gv >= 1000 ? `R$${(gv / 1000).toFixed(0)}k` : `R$${gv.toFixed(0)}`;
            doc.text(lbl, plotX - 1, gy + 1.2, { align: 'right' });
          }

          // Axis border
          doc.setDrawColor(180, 180, 180);
          doc.setLineWidth(0.4);
          doc.line(plotX, plotY, plotX, plotY + plotH);
          doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);

          // Bars
          const N = labels.length;
          const S = series.length;
          const groupW = plotW / N;
          const totalBarW = groupW * 0.7;
          const barW = totalBarW / S;

          labels.forEach((lbl, i) => {
            series.forEach((s, si) => {
              const v = Math.max(s.values[i] || 0, 0);
              const bH = (v / maxVal) * plotH;
              const bX = plotX + i * groupW + (groupW - totalBarW) / 2 + si * barW;
              const bY = plotY + plotH - bH;
              doc.setFillColor(...s.color);
              doc.rect(bX, bY, barW * 0.9, bH, 'F');
            });
            // X label
            doc.setFontSize(5);
            doc.setTextColor(70, 70, 70);
            const shortLbl = lbl.length > 8 ? lbl.substring(0, 8) + '.' : lbl;
            doc.text(shortLbl, plotX + i * groupW + groupW / 2, plotY + plotH + 4, { align: 'center' });
          });

          // Legend
          let legX = plotX;
          series.forEach((s) => {
            doc.setFillColor(...s.color);
            doc.rect(legX, cy + ch - 3, 4, 3, 'F');
            doc.setFontSize(5.5);
            doc.setTextColor(50, 50, 50);
            doc.text(s.label, legX + 5, cy + ch - 0.5);
            legX += 22;
          });
        };

        // ── Helper: desenhar barras horizontais (categorias) ──────────────
        const drawHorizBars = (
          title: string,
          items: Array<{ label: string; value: number; color: [number, number, number] }>,
          cx: number, cy: number, cw: number, ch: number
        ) => {
          if (items.length === 0) return;

          doc.setFontSize(10);
          doc.setFont(undefined as any, 'bold');
          doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
          doc.text(title, cx, cy);
          doc.setFont(undefined as any, 'normal');

          const padL = 42, padR = 28, padT = 6;
          const plotX = cx + padL;
          const plotW = cw - padL - padR;
          const maxVal = Math.max(...items.map(it => it.value), 1);
          const barH = Math.min((ch - padT) / items.length - 3, 8);

          items.forEach((it, i) => {
            const bY = cy + padT + i * (barH + 3);
            const bW = (it.value / maxVal) * plotW;

            // Label
            doc.setFontSize(5.5);
            doc.setTextColor(60, 60, 60);
            const shortLbl = it.label.length > 16 ? it.label.substring(0, 16) + '.' : it.label;
            doc.text(shortLbl, plotX - 1, bY + barH - 1, { align: 'right' });

            // Bar
            doc.setFillColor(...it.color);
            doc.rect(plotX, bY, bW, barH, 'F');

            // Value
            doc.setFontSize(5);
            doc.setTextColor(50, 50, 50);
            const valLbl = it.value >= 1000000 ? `R$${(it.value / 1000000).toFixed(1)}M` : it.value >= 1000 ? `R$${(it.value / 1000).toFixed(0)}k` : formatCurrency(it.value);
            doc.text(valLbl, plotX + bW + 1, bY + barH - 1);
          });
        };

        // ── Gráfico 1: Evolução Mensal (barras agrupadas) ─────────────────
        if (safeStats.evolucaoMensal.length > 0) {
          const evolLabels = safeStats.evolucaoMensal.map(m => m.mes);
          const evolSeries = [
            { label: 'Receitas', color: [30, 97, 70] as [number, number, number], values: safeStats.evolucaoMensal.map(m => m.receitas) },
            { label: 'Despesas', color: [215, 58, 58] as [number, number, number], values: safeStats.evolucaoMensal.map(m => m.despesas) },
          ];
          drawGroupedBarChart('Evolução Financeira Mensal', evolLabels, evolSeries, 20, yPos, pageWidth - 40, 72);
          yPos += 82;
        }

        if (yPos > pageHeight - 100) { doc.addPage(); yPos = 22; }

        // ── Gráfico 2 + 3 lado a lado ─────────────────────────────────────
        const halfW = (pageWidth - 44) / 2;
        let leftColY = yPos;
        let rightColY = yPos;

        // Categorias de despesa (barras horizontais)
        const despCategorias = safeStats.porCategoria
          .filter(c => c.tipo !== 'receita')
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 8);
        if (despCategorias.length > 0) {
          const horizItems = despCategorias.map(c => ({
            label: c.categoria,
            value: c.valor,
            color: [215, 58, 58] as [number, number, number],
          }));
          drawHorizBars('Despesas por Categoria', horizItems, 20, leftColY, halfW, despCategorias.length * 11 + 12);
          leftColY += despCategorias.length * 11 + 22;
        }

        // Campanhas (barras agrupadas)
        if (safeStats.porCampanha.length > 0) {
          const campLabels = safeStats.porCampanha.map(c => c.campanha);
          const campSeries = [
            { label: 'Receitas', color: [30, 97, 70] as [number, number, number], values: safeStats.porCampanha.map(c => c.receitas) },
            { label: 'Despesas', color: [215, 58, 58] as [number, number, number], values: safeStats.porCampanha.map(c => c.despesas) },
          ];
          drawGroupedBarChart('Gastos por Campanha', campLabels, campSeries, 22 + halfW, rightColY, halfW, 62);
          rightColY += 72;
        }

        // Projetos (barras agrupadas)
        if (safeStats.porProjeto.length > 0) {
          const maxY = Math.max(leftColY, rightColY);
          if (maxY > pageHeight - 90) { doc.addPage(); yPos = 22; leftColY = yPos; }
          const projLabels = safeStats.porProjeto.map(p => p.projeto);
          const projSeries = [
            { label: 'Receitas', color: [30, 97, 70] as [number, number, number], values: safeStats.porProjeto.map(p => p.receitas) },
            { label: 'Despesas', color: [215, 58, 58] as [number, number, number], values: safeStats.porProjeto.map(p => p.despesas) },
          ];
          const projY = Math.max(leftColY, rightColY);
          drawGroupedBarChart('Resultado por Projeto', projLabels, projSeries, 20, projY, pageWidth - 40, 65);
          yPos = projY + 75;
        }
      }

      const totalPages = doc.getNumberOfPages();
      for (let i = 2; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(...ECOBRASIL_COLORS.green);
        doc.rect(0, pageHeight - 10, pageWidth, 1.5, 'F');
        doc.setFillColor(...ECOBRASIL_COLORS.blue);
        doc.rect(0, pageHeight - 8.5, pageWidth, 8.5, 'F');
        doc.setFontSize(6.5);
        doc.setFont(undefined as any, 'normal');
        doc.setTextColor(...SECONDARY_FIN);
        doc.text('AmbientIA — Plataforma Inteligente de Gestão para Consultorias Ambientais', 20, pageHeight - 4);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - 20, pageHeight - 4, { align: 'right' });
      }

      const filename = `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
      toast({
        title: "Relatório gerado com sucesso",
        description: "O relatório financeiro foi baixado.",
      });
      
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro na geração",
        description: error?.message || "Ocorreu um erro ao gerar o relatório financeiro.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const selectedLabel = selectedEmpreendimentoId === "all" 
    ? "Todos os Projetos" 
    : empreendimentos.find(e => e.id === parseInt(selectedEmpreendimentoId))?.nome || "Selecione";

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline"
          disabled={isExporting}
          data-testid="button-gerar-relatorio-financeiro"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4 mr-2" />
              Gerar Relatório PDF
              <ChevronDown className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Configurar Relatório</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Selecione o projeto e o período do relatório
            </p>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium">Projeto</Label>
            <Select 
              value={selectedEmpreendimentoId} 
              onValueChange={setSelectedEmpreendimentoId}
            >
              <SelectTrigger data-testid="select-empreendimento-pdf">
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Projetos (Consolidado)</SelectItem>
                {empreendimentos.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Período
            </Label>
            <Select 
              value={selectedPeriod} 
              onValueChange={(value) => setSelectedPeriod(value as PeriodType)}
            >
              <SelectTrigger data-testid="select-periodo-pdf">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPeriod === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Data Início</Label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  data-testid="input-data-inicio-pdf"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Data Fim</Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  data-testid="input-data-fim-pdf"
                />
              </div>
            </div>
          )}

          <Button 
            className="w-full" 
            onClick={generatePDF}
            disabled={isExporting || (selectedPeriod === "custom" && (!customStartDate || !customEndDate))}
            data-testid="button-confirmar-gerar-pdf"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                Gerar PDF - {selectedLabel}
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
