import { useState } from "react";
import { FileDown, Loader2, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { UnlockDialog, isModuleUnlocked } from "@/components/UnlockDialog";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { User } from "@shared/schema";

// ── SGAI Brand Colors ─────────────────────────────────────────────────────────
const ECOBRASIL_COLORS = {
  green:      [30, 97, 70]    as [number, number, number], // #1E6146 forest green
  yellow:     [245, 168, 0]   as [number, number, number], // amber
  blue:       [0, 89, 156]    as [number, number, number], // #00599C primary blue
  darkGreen:  [10, 28, 50]    as [number, number, number], // dark navy
  lightGreen: [235, 247, 241] as [number, number, number], // light green bg
  red:        [215, 58, 58]   as [number, number, number], // red
  purple:     [10, 106, 122]  as [number, number, number], // #0a6a7a teal
  orange:     [245, 168, 0]   as [number, number, number], // amber (alias)
};

const C = ECOBRASIL_COLORS; // shorthand
const SECONDARY = [178, 205, 225] as [number, number, number]; // #B2CDE1

const CHART_COLORS = [
  [0, 89, 156],   // primary blue
  [30, 97, 70],   // forest green
  [245, 168, 0],  // amber
  [215, 58, 58],  // red
  [10, 106, 122], // teal
  [93, 156, 213], // light blue
  [76, 153, 117], // light green
  [178, 128, 0],  // dark amber
  [149, 82, 82],  // muted red
  [67, 136, 160], // medium teal
];

const MARGINS = { left: 15, right: 15, top: 16, bottom: 12 };

interface PlatformReportPDFProps {
  buttonVariant?: "default" | "outline" | "ghost";
  buttonSize?: "default" | "sm" | "lg" | "icon";
}

export function PlatformReportPDF({ buttonVariant = "default", buttonSize = "default" }: PlatformReportPDFProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const { toast } = useToast();
  
  // Buscar usuário logado para verificar role
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });
  
  // Verifica se o usuário é diretor ou admin (não precisa de senha)
  const isDirectorOrAdmin = currentUser?.role === 'diretor' || currentUser?.role === 'admin';
  
  // Verifica se o módulo de relatórios está desbloqueado na sessão
  const isReportUnlocked = isModuleUnlocked('relatorios');
  
  // Pode acessar se for diretor/admin OU se tiver desbloqueado com senha
  const canAccessReport = isDirectorOrAdmin || isReportUnlocked;

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const translateStatus = (status: string | null | undefined) => {
    const statusMap: Record<string, string> = {
      'ativo': 'Ativo',
      'inativo': 'Inativo',
      'disponivel': 'Disponível',
      'em_uso': 'Em Uso',
      'manutencao': 'Manutenção',
      'aberta': 'Aberta',
      'em_andamento': 'Em Andamento',
      'concluida': 'Concluída',
      'concluido': 'Concluído',
      'cancelada': 'Cancelada',
      'ferias': 'Férias',
      'afastado': 'Afastado',
      'vigente': 'Vigente',
      'vencida': 'Vencida',
      'suspensa': 'Suspensa',
      'pendente': 'Pendente',
      'planejamento': 'Planejamento',
      'ativa': 'Ativa',
    };
    return statusMap[status || ''] || status || '-';
  };

  const generatePDF = async () => {
    setIsExporting(true);

    try {
      console.log('Iniciando geração do relatório 360°...');
      
      const response = await fetch('/api/relatorio-plataforma', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na resposta do servidor:', response.status, errorText);
        throw new Error(`Falha ao buscar dados do relatório: ${response.status}`);
      }

      const data = await response.json();
      console.log('Dados do relatório recebidos:', Object.keys(data));

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
      const coverBg = await fetchImgBase64('/images/pdf-cover-avifauna.png');

      // ── Pre-fetch intercorrência photos as base64 ─────────────────────────
      const intercFotoMap: Record<string, string> = {};
      if (data.intercorrencias?.lista) {
        const allKeys: string[] = [];
        for (const ic of data.intercorrencias.lista) {
          if (Array.isArray(ic.imagens)) allKeys.push(...ic.imagens);
        }
        const uniqueKeys = [...new Set(allKeys)];
        await Promise.all(uniqueKeys.map(async (key: string) => {
          const b64 = await fetchImgBase64(`/api/intercorrencias/imagem?key=${encodeURIComponent(key)}`);
          if (b64) intercFotoMap[key] = b64;
        }));
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const contentWidth = pageWidth - MARGINS.left - MARGINS.right;
      let yPos = MARGINS.top;

      const STRIP_H = 24;                        // photo strip height on inner pages (mm)
      const INNER_TOP = 13 + STRIP_H + 6;       // content start y on all inner pages (= 43)

      // Layout helper functions
      // ── Premium page header ────────────────────────────────────────────────
      const addPageHeader = (sectionName: string = '') => {
        doc.setFillColor(...C.blue);
        doc.rect(0, 0, pageWidth, 11, 'F');
        doc.setFillColor(...C.green);
        doc.rect(0, 11, pageWidth, 2, 'F');
        doc.setFontSize(7.5);
        doc.setFont(undefined as any, 'bold');
        doc.setTextColor(255, 255, 255);
        const logoImg = new Image();
        logoImg.src = '/logo.png';
        try { doc.addImage(logoImg, 'PNG', MARGINS.left, 1, 16, 9); } catch {}
        if (sectionName) {
          doc.setFont(undefined as any, 'normal');
          doc.setTextColor(...SECONDARY);
          doc.text(` › ${sectionName}`, MARGINS.left + 20, 7.5);
        }
        doc.setFont(undefined as any, 'normal');
      };

      // ── Decorative nature photo strip + white content canvas ──────────────
      const addInnerPageDeco = () => {
        // Draw full photo from y=13 — only top STRIP_H mm will be visible
        if (coverBg) {
          doc.addImage(coverBg, 'PNG', 0, 13, pageWidth, 118);
        } else {
          doc.setFillColor(...C.darkGreen);
          doc.rect(0, 13, pageWidth, STRIP_H, 'F');
        }
        // White content area — covers everything below the strip
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 13 + STRIP_H, pageWidth, pageHeight - (13 + STRIP_H), 'F');
        // Dark accent bar at strip/content boundary
        doc.setFillColor(...C.darkGreen);
        doc.rect(0, 13 + STRIP_H - 2, pageWidth, 2, 'F');
      };

      let currentSection = '';
      const checkNewPage = (requiredSpace: number): boolean => {
        if (yPos + requiredSpace > pageHeight - MARGINS.bottom - 10) {
          doc.addPage();
          addPageHeader(currentSection);
          addInnerPageDeco();
          yPos = INNER_TOP;
          return true;
        }
        return false;
      };

      // ── Section title with left accent bar + tinted background ───────────────
      const addSectionTitle = (title: string, color: [number, number, number] = C.blue) => {
        checkNewPage(28);
        const lightBg: [number, number, number] =
          color === C.red     ? [255, 242, 242] :
          color === C.yellow  ? [255, 251, 232] :
          color === C.green   ? [234, 246, 239] :
          color === C.purple  ? [230, 245, 248] :
                                [234, 244, 253]; // blue default
        doc.setFillColor(...color);
        doc.rect(MARGINS.left, yPos, 3.5, 11, 'F');
        doc.setFillColor(...lightBg);
        doc.rect(MARGINS.left + 3.5, yPos, contentWidth - 3.5, 11, 'F');
        doc.setFontSize(10.5);
        doc.setFont(undefined as any, 'bold');
        doc.setTextColor(...color);
        doc.text(title, MARGINS.left + 8, yPos + 7.5);
        doc.setFont(undefined as any, 'normal');
        yPos += 16;
      };

      const addSubtitle = (text: string) => {
        doc.setFontSize(8.5);
        doc.setTextColor(100, 112, 128);
        doc.text(text, MARGINS.left, yPos);
        yPos += 6;
      };

      // Chart drawing functions
      const drawBarChart = (
        x: number, y: number, width: number, height: number,
        data: { label: string; value1: number; value2?: number }[],
        title: string,
        legend?: { label1: string; label2?: string; color1: number[]; color2?: number[] }
      ): number => {
        if (!data || data.length === 0) return y;

        const hasSecondValue = data.some(d => d.value2 !== undefined);
        const maxValue = Math.max(...data.flatMap(d => [d.value1, d.value2 || 0, 1]));
        const chartAreaHeight = height - 35;
        const chartAreaWidth = width - 30;
        const barWidth = hasSecondValue ? (chartAreaWidth / data.length) * 0.35 : (chartAreaWidth / data.length) * 0.6;
        const startX = x + 25;
        const startY = y + 18;

        // Title
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text(title, x + width / 2, y + 8, { align: 'center' });

        // Y-axis and gridlines
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(startX, startY, startX, startY + chartAreaHeight);
        doc.line(startX, startY + chartAreaHeight, startX + chartAreaWidth, startY + chartAreaHeight);

        doc.setFontSize(6);
        doc.setTextColor(120, 120, 120);
        for (let i = 0; i <= 4; i++) {
          const yLine = startY + (chartAreaHeight * i) / 4;
          const value = maxValue * (1 - i / 4);
          doc.setDrawColor(235, 235, 235);
          doc.line(startX, yLine, startX + chartAreaWidth, yLine);
          const formattedValue = value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0);
          doc.text(formattedValue, startX - 2, yLine + 1.5, { align: 'right' });
        }

        // Bars
        const groupWidth = chartAreaWidth / data.length;
        data.forEach((item, index) => {
          const groupX = startX + index * groupWidth + (groupWidth - (hasSecondValue ? barWidth * 2 + 2 : barWidth)) / 2;

          // First bar
          const height1 = maxValue > 0 ? (item.value1 / maxValue) * chartAreaHeight : 0;
          doc.setFillColor(legend?.color1[0] || 34, legend?.color1[1] || 139, legend?.color1[2] || 34);
          doc.rect(groupX, startY + chartAreaHeight - height1, barWidth, height1, 'F');

          // Second bar (if exists)
          if (hasSecondValue && item.value2 !== undefined) {
            const height2 = maxValue > 0 ? (item.value2 / maxValue) * chartAreaHeight : 0;
            doc.setFillColor(legend?.color2?.[0] || 200, legend?.color2?.[1] || 50, legend?.color2?.[2] || 50);
            doc.rect(groupX + barWidth + 1, startY + chartAreaHeight - height2, barWidth, height2, 'F');
          }

          // X-axis label
          doc.setFontSize(5);
          doc.setTextColor(100, 100, 100);
          const labelText = item.label.length > 6 ? item.label.substring(0, 5) + '..' : item.label;
          doc.text(labelText, groupX + (hasSecondValue ? barWidth : barWidth / 2), startY + chartAreaHeight + 5, { align: 'center' });
        });

        // Legend
        if (legend) {
          const legendY = startY + chartAreaHeight + 12;
          doc.setFillColor(legend.color1[0], legend.color1[1], legend.color1[2]);
          doc.rect(x + width / 2 - 35, legendY, 6, 4, 'F');
          doc.setFontSize(7);
          doc.setTextColor(60, 60, 60);
          doc.text(legend.label1, x + width / 2 - 27, legendY + 3);

          if (legend.label2 && legend.color2) {
            doc.setFillColor(legend.color2[0], legend.color2[1], legend.color2[2]);
            doc.rect(x + width / 2 + 10, legendY, 6, 4, 'F');
            doc.text(legend.label2, x + width / 2 + 18, legendY + 3);
          }
        }

        return y + height + 5;
      };

      const drawPieChart = (
        x: number, y: number, radius: number,
        data: { label: string; value: number }[],
        title: string
      ): number => {
        if (!data || data.length === 0) return y;

        const total = data.reduce((sum, d) => sum + d.value, 0);
        if (total === 0) return y;

        // Title
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text(title, x + radius, y + 8, { align: 'center' });

        const centerX = x + radius;
        const centerY = y + 18 + radius;
        let startAngle = -Math.PI / 2;

        // Draw pie slices
        data.slice(0, 8).forEach((item, index) => {
          const sliceAngle = (item.value / total) * 2 * Math.PI;
          const endAngle = startAngle + sliceAngle;

          const color = CHART_COLORS[index % CHART_COLORS.length];
          doc.setFillColor(color[0], color[1], color[2]);

          const segments = Math.max(3, Math.ceil(sliceAngle * 20));
          for (let i = 0; i < segments; i++) {
            const angle1 = startAngle + (sliceAngle * i) / segments;
            const angle2 = startAngle + (sliceAngle * (i + 1)) / segments;
            doc.triangle(
              centerX, centerY,
              centerX + Math.cos(angle1) * radius, centerY + Math.sin(angle1) * radius,
              centerX + Math.cos(angle2) * radius, centerY + Math.sin(angle2) * radius,
              'F'
            );
          }

          startAngle = endAngle;
        });

        // Legend
        let legendY = centerY + radius + 8;
        const legendItems = data.slice(0, 6);
        doc.setFontSize(6);

        legendItems.forEach((item, index) => {
          const color = CHART_COLORS[index % CHART_COLORS.length];
          doc.setFillColor(color[0], color[1], color[2]);
          doc.rect(x, legendY, 5, 3, 'F');

          doc.setTextColor(60, 60, 60);
          const percentage = ((item.value / total) * 100).toFixed(1);
          const labelText = item.label.length > 12 ? item.label.substring(0, 10) + '..' : item.label;
          doc.text(`${labelText}: ${percentage}%`, x + 7, legendY + 2.5);
          legendY += 5;
        });

        return legendY + 3;
      };

      const drawHorizontalBarChart = (
        x: number, y: number, width: number, height: number,
        data: { label: string; value: number; color?: number[] }[],
        title: string
      ): number => {
        if (!data || data.length === 0) return y;

        const maxValue = Math.max(...data.map(d => d.value), 1);
        const labelArea = Math.min(58, width * 0.30);
        const valArea   = 14;
        const barAreaW  = width - labelArea - valArea - 6;
        const items     = data.slice(0, 10);
        const barHeight = Math.min(15, Math.max(8, (height - 28) / items.length));

        // Title
        doc.setFontSize(10.5);
        doc.setFont(undefined as any, 'bold');
        doc.setTextColor(...C.darkGreen);
        doc.text(title, x + width / 2, y + 8, { align: 'center' });
        doc.setFont(undefined as any, 'normal');

        // Chart background
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, y + 12, width, height - 12, 2, 2, 'F');

        let barY = y + 20;
        items.forEach((item, index) => {
          // Alternating row bg
          if (index % 2 === 0) {
            doc.setFillColor(238, 244, 250);
            doc.rect(x, barY - 1, width, barHeight + 1, 'F');
          }
          // Label
          doc.setFontSize(7.5);
          doc.setTextColor(40, 40, 70);
          const maxChars = Math.floor(labelArea / 2.1);
          const lbl = item.label.length > maxChars ? item.label.substring(0, maxChars - 2) + '..' : item.label;
          doc.text(lbl, x + 3, barY + barHeight / 2 + 1.5);

          // Bar
          const bw = maxValue > 0 ? (item.value / maxValue) * barAreaW : 0;
          const color = item.color || CHART_COLORS[index % CHART_COLORS.length];
          doc.setFillColor(color[0], color[1], color[2]);
          doc.roundedRect(x + labelArea, barY, Math.max(bw, 1), barHeight - 2, 1, 1, 'F');

          // Value
          doc.setFontSize(7);
          doc.setTextColor(50, 50, 50);
          doc.text(item.value.toString(), x + labelArea + bw + 3, barY + barHeight / 2 + 1.5);

          barY += barHeight + 1;
        });

        return barY + 6;
      };

      // ═══════════════════════════════════════════════════════════════════════
      // COVER PAGE — AmbientIA Clean White Design
      // ═══════════════════════════════════════════════════════════════════════

      // 1. White background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // 2. Blue header band (top)
      doc.setFillColor(...C.blue);
      doc.rect(0, 0, pageWidth, 55, 'F');

      // 3. Green accent stripe below header
      doc.setFillColor(...C.green);
      doc.rect(0, 55, pageWidth, 3, 'F');

      // 4. Logo inside header (left-aligned)
      try {
        const logoImg2 = new Image();
        logoImg2.src = '/logo.png';
        doc.addImage(logoImg2, 'PNG', 18, 8, 56, 24);
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

      // 6. Report type label (green, below header)
      doc.setFontSize(8);
      doc.setFont(undefined as any, 'bold');
      doc.setTextColor(...C.green);
      doc.setCharSpace(1.5);
      doc.text('RELATÓRIO 360° DA PLATAFORMA', 20, 72);
      doc.setCharSpace(0);

      // 7. Report title — large, dark navy
      doc.setFontSize(26);
      doc.setFont(undefined as any, 'bold');
      doc.setTextColor(10, 28, 50);
      doc.text('Relatório Gerencial Completo', 20, 87);

      // 8. Horizontal divider
      doc.setFillColor(...C.blue);
      doc.rect(20, 93, pageWidth - 40, 0.8, 'F');

      // 9. Metadata
      const unidadeLabel = data.unidade === 'goiania' ? 'Goiânia' :
                           data.unidade === 'salvador' ? 'Salvador' :
                           data.unidade === 'luiz-eduardo-magalhaes' ? 'Luiz Eduardo Magalhães' :
                           (data.unidade || 'Todas');
      const geradoEm = format(new Date(data.geradoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      const metaItems = [
        { label: 'UNIDADE', value: unidadeLabel },
        { label: 'GERADO EM', value: geradoEm },
      ];
      const mdBaseY = 102;
      metaItems.forEach((md, i) => {
        const mx = 20 + i * 95;
        doc.setFontSize(6);
        doc.setFont(undefined as any, 'bold');
        doc.setTextColor(120, 130, 140);
        doc.text(md.label, mx, mdBaseY);
        doc.setFontSize(10);
        doc.setFont(undefined as any, 'bold');
        doc.setTextColor(10, 28, 50);
        doc.text(md.value, mx, mdBaseY + 7);
      });

      // 10. Left green accent bar
      doc.setFillColor(...C.green);
      doc.rect(0, 58, 5, pageHeight - 68, 'F');

      // 11. Cover footer bar
      doc.setFillColor(...C.green);
      doc.rect(0, pageHeight - 10, pageWidth, 1.5, 'F');
      doc.setFillColor(...C.blue);
      doc.rect(0, pageHeight - 8.5, pageWidth, 8.5, 'F');
      doc.setFontSize(7);
      doc.setFont(undefined as any, 'normal');
      doc.setTextColor(178, 205, 225);
      doc.text('AmbientIA — Plataforma Inteligente de Gestão para Consultorias Ambientais',
        pageWidth / 2, pageHeight - 3.5, { align: 'center' });

      // === PAGE 2: EXECUTIVE SUMMARY ===
      currentSection = 'Resumo Executivo';
      doc.addPage();
      addPageHeader(currentSection);
      addInnerPageDeco();
      yPos = INNER_TOP;

      doc.setFontSize(15);
      doc.setFont(undefined as any, 'bold');
      doc.setTextColor(...C.darkGreen);
      doc.text('Resumo Executivo', pageWidth / 2, yPos, { align: 'center' });
      doc.setFont(undefined as any, 'normal');
      yPos += 12;

      // KPI Cards Grid (2 rows x 4 columns)
      const kpiData = [
        { label: 'Empreendimentos', value: data.resumoGeral.totalEmpreendimentos, color: ECOBRASIL_COLORS.green },
        { label: 'Licenças', value: data.resumoGeral.totalLicencas, color: ECOBRASIL_COLORS.blue },
        { label: 'Demandas', value: data.resumoGeral.totalDemandas, color: ECOBRASIL_COLORS.yellow },
        { label: 'Projetos', value: data.resumoGeral.totalProjetos, color: ECOBRASIL_COLORS.purple },
        { label: 'Veículos', value: data.resumoGeral.totalVeiculos, color: ECOBRASIL_COLORS.orange },
        { label: 'Equipamentos', value: data.resumoGeral.totalEquipamentos, color: ECOBRASIL_COLORS.blue },
        { label: 'Funcionários', value: data.resumoGeral.totalFuncionarios, color: ECOBRASIL_COLORS.green },
        { label: 'Contratos', value: data.resumoGeral.totalContratos, color: ECOBRASIL_COLORS.red },
      ];

      const cardWidth = 42;
      const cardHeight = 22;
      const cardGap = 5;
      const cardsPerRow = 4;
      const gridStartX = (pageWidth - (cardWidth * cardsPerRow + cardGap * (cardsPerRow - 1))) / 2;

      kpiData.forEach((kpi, idx) => {
        const row = Math.floor(idx / cardsPerRow);
        const col = idx % cardsPerRow;
        const cardX = gridStartX + col * (cardWidth + cardGap);
        const cardY = yPos + row * (cardHeight + cardGap);

        doc.setFillColor(248, 250, 248);
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'F');
        doc.setDrawColor(...kpi.color);
        doc.setLineWidth(0.5);
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'S');

        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(kpi.label, cardX + cardWidth / 2, cardY + 8, { align: 'center' });

        doc.setFontSize(14);
        doc.setTextColor(...kpi.color);
        doc.text(kpi.value.toString(), cardX + cardWidth / 2, cardY + 17, { align: 'center' });
      });

      yPos += Math.ceil(kpiData.length / cardsPerRow) * (cardHeight + cardGap) + 12;

      // Financial Summary Cards
      addSectionTitle('Resumo Financeiro', ECOBRASIL_COLORS.green);

      const finCards = [
        { label: 'Total Receitas', value: formatCurrency(data.financeiro?.totalReceitas || 0), color: ECOBRASIL_COLORS.green },
        { label: 'Total Despesas', value: formatCurrency(data.financeiro?.totalDespesas || 0), color: ECOBRASIL_COLORS.red },
        { label: 'Saldo Atual', value: formatCurrency(data.financeiro?.saldoAtual || 0), color: (data.financeiro?.saldoAtual || 0) >= 0 ? ECOBRASIL_COLORS.green : ECOBRASIL_COLORS.red },
        { label: 'Pendente', value: formatCurrency(data.financeiro?.totalPendente || 0), color: ECOBRASIL_COLORS.yellow },
      ];

      const finCardWidth = 43;
      const finStartX = (pageWidth - (finCardWidth * 4 + cardGap * 3)) / 2;

      finCards.forEach((card, idx) => {
        const cardX = finStartX + idx * (finCardWidth + cardGap);

        doc.setFillColor(252, 252, 252);
        doc.roundedRect(cardX, yPos, finCardWidth, 20, 2, 2, 'F');

        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(card.label, cardX + finCardWidth / 2, yPos + 7, { align: 'center' });

        doc.setFontSize(9);
        doc.setTextColor(...card.color);
        doc.text(card.value, cardX + finCardWidth / 2, yPos + 15, { align: 'center' });
      });

      yPos += 30;

      // Alerts Summary
      addSectionTitle('Alertas e Pendências', ECOBRASIL_COLORS.red);

      const alertItems = [
        { label: 'Licenças Vencidas', value: data.licencas?.vencidas || 0, color: ECOBRASIL_COLORS.red },
        { label: 'Licenças Próx. Vencer (30d)', value: data.licencas?.proximasVencer || 0, color: ECOBRASIL_COLORS.yellow },
        { label: 'Demandas Atrasadas', value: data.demandas?.atrasadas || 0, color: ECOBRASIL_COLORS.red },
        { label: 'Contratos Vencendo (30d)', value: data.contratos?.vencendo || 0, color: ECOBRASIL_COLORS.yellow },
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['Alerta', 'Quantidade', 'Prioridade']],
        body: alertItems.map(a => [
          a.label,
          a.value.toString(),
          a.value > 0 ? 'ATENÇÃO' : 'OK'
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: ECOBRASIL_COLORS.red, textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'center' },
        },
        didParseCell: (cellData: any) => {
          if (cellData.section === 'body' && cellData.column.index === 2) {
            const value = alertItems[cellData.row.index]?.value || 0;
            cellData.cell.styles.textColor = value > 0 ? ECOBRASIL_COLORS.red : ECOBRASIL_COLORS.green;
            cellData.cell.styles.fontStyle = 'bold';
          }
        },
        margin: { left: MARGINS.left, right: MARGINS.right },
      });
      yPos = (doc as any).lastAutoTable.finalY + 15;

      // === PAGE 3: OPERATIONAL CHARTS ===
      currentSection = 'Análise Operacional';
      doc.addPage();
      addPageHeader(currentSection);
      addInnerPageDeco();
      yPos = INNER_TOP;

      doc.setFontSize(15);
      doc.setFont(undefined as any, 'bold');
      doc.setTextColor(...C.darkGreen);
      doc.text('Análise Operacional', pageWidth / 2, yPos, { align: 'center' });
      doc.setFont(undefined as any, 'normal');
      yPos += 10;

      // ── Full-width single-column charts ──────────────────────────────────
      const licenseStatusData = [
        { label: 'Vigentes',       value: data.licencas?.vigentes || 0,        color: ECOBRASIL_COLORS.green },
        { label: 'Próx. Vencer',   value: data.licencas?.proximasVencer || 0,  color: ECOBRASIL_COLORS.yellow },
        { label: 'Vencidas',       value: data.licencas?.vencidas || 0,        color: ECOBRASIL_COLORS.red },
      ].filter(d => d.value > 0);

      const demandStatusData = [
        { label: 'Abertas',     value: data.demandas?.abertas || 0,    color: ECOBRASIL_COLORS.blue },
        { label: 'Concluídas',  value: data.demandas?.concluidas || 0, color: ECOBRASIL_COLORS.green },
        { label: 'Atrasadas',   value: data.demandas?.atrasadas || 0,  color: ECOBRASIL_COLORS.red },
      ].filter(d => d.value > 0);

      const fleetStatusData = [
        { label: 'Veículos Disponíveis', value: data.frota?.disponiveis || 0,     color: ECOBRASIL_COLORS.green },
        { label: 'Veículos Em Uso',      value: data.frota?.emUso || 0,           color: ECOBRASIL_COLORS.blue },
        { label: 'Veículos Manutenção',  value: data.frota?.emManutencao || 0,    color: ECOBRASIL_COLORS.red },
        { label: 'Equipamentos Ativos',  value: data.equipamentos?.ativos || 0,   color: ECOBRASIL_COLORS.purple },
        { label: 'Equip. Manutenção',    value: data.equipamentos?.emManutencao || 0, color: ECOBRASIL_COLORS.orange },
      ].filter(d => d.value > 0);

      const rhProjectData = [
        { label: 'RH Ativos',       value: data.rh?.ativos || 0,             color: ECOBRASIL_COLORS.green },
        { label: 'RH Férias',       value: data.rh?.ferias || 0,             color: ECOBRASIL_COLORS.yellow },
        { label: 'RH Afastados',    value: data.rh?.afastados || 0,          color: ECOBRASIL_COLORS.red },
        { label: 'Proj. Andamento', value: data.projetos?.emAndamento || 0,  color: ECOBRASIL_COLORS.blue },
        { label: 'Proj. Concluídos',value: data.projetos?.concluidos || 0,   color: ECOBRASIL_COLORS.purple },
      ].filter(d => d.value > 0);

      if (licenseStatusData.length > 0) {
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 68, licenseStatusData, 'Status das Licenças Ambientais');
        yPos += 8;
      }
      checkNewPage(80);
      if (demandStatusData.length > 0) {
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 68, demandStatusData, 'Status das Demandas');
        yPos += 8;
      }
      checkNewPage(80);
      if (fleetStatusData.length > 0) {
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 85, fleetStatusData, 'Frota e Equipamentos');
        yPos += 8;
      }
      checkNewPage(80);
      if (rhProjectData.length > 0) {
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 85, rhProjectData, 'Recursos Humanos e Projetos');
        yPos += 8;
      }

      // === PAGE 4: PROJECTS ANALYSIS ===
      currentSection = 'Análise de Projetos';
      doc.addPage();
      addPageHeader(currentSection);
      addInnerPageDeco();
      yPos = INNER_TOP;

      doc.setFontSize(15);
      doc.setFont(undefined as any, 'bold');
      doc.setTextColor(...C.darkGreen);
      doc.text('Análise de Projetos', pageWidth / 2, yPos, { align: 'center' });
      doc.setFont(undefined as any, 'normal');
      yPos += 12;

      // Project KPI Cards
      const projectKpis = [
        { label: 'Total', value: data.projetos?.total || 0, color: ECOBRASIL_COLORS.blue },
        { label: 'Em Andamento', value: data.projetos?.emAndamento || 0, color: ECOBRASIL_COLORS.green },
        { label: 'Concluídos', value: data.projetos?.concluidos || 0, color: ECOBRASIL_COLORS.darkGreen },
        { label: 'Planejamento', value: data.projetos?.planejamento || 0, color: ECOBRASIL_COLORS.yellow },
        { label: 'Atrasados', value: data.projetos?.atrasados || 0, color: ECOBRASIL_COLORS.red },
      ];

      const projKpiWidth = 34;
      const projKpiStartX = (pageWidth - (projKpiWidth * 5 + 4 * 4)) / 2;

      projectKpis.forEach((kpi, idx) => {
        const kpiX = projKpiStartX + idx * (projKpiWidth + 4);
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(kpiX, yPos, projKpiWidth, 22, 2, 2, 'F');
        doc.setDrawColor(...kpi.color);
        doc.setLineWidth(0.5);
        doc.roundedRect(kpiX, yPos, projKpiWidth, 22, 2, 2, 'S');

        doc.setFontSize(6);
        doc.setTextColor(100, 100, 100);
        doc.text(kpi.label, kpiX + projKpiWidth / 2, yPos + 7, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(...kpi.color);
        doc.text(kpi.value.toString(), kpiX + projKpiWidth / 2, yPos + 17, { align: 'center' });
      });

      yPos += 30;

      // ── Full-width project charts ────────────────────────────────────────
      const fullProjectStatusData = Object.entries(data.projetos?.porStatus || {}).map(([status, count]) => ({
        label: status === 'em_andamento' ? 'Em Andamento' :
               status === 'concluido' ? 'Concluído' :
               status === 'planejamento' ? 'Planejamento' :
               status === 'cancelado' ? 'Cancelado' :
               status === 'pausado' ? 'Pausado' : status,
        value: count as number,
        color: CHART_COLORS[Object.keys(data.projetos?.porStatus || {}).indexOf(status) % CHART_COLORS.length],
      })).filter(d => d.value > 0);

      if (fullProjectStatusData.length > 0) {
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 75, fullProjectStatusData, 'Projetos por Status');
        yPos += 8;
      }
      checkNewPage(80);

      const projectTypeData = Object.entries(data.projetos?.porTipo || {}).map(([tipo, count]) => ({
        label: tipo || 'Outros',
        value: count as number,
        color: CHART_COLORS[Object.keys(data.projetos?.porTipo || {}).indexOf(tipo) % CHART_COLORS.length],
      })).filter(d => d.value > 0);

      if (projectTypeData.length > 0) {
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 80, projectTypeData, 'Projetos por Tipo');
        yPos += 8;
      }
      checkNewPage(60);

      // Project Details Table
      addSectionTitle('Detalhes dos Projetos', ECOBRASIL_COLORS.purple);

      if (data.projetos?.lista && data.projetos.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Tipo', 'Status', 'Início', 'Fim Previsto']],
          body: data.projetos.lista.slice(0, 12).map((p: any) => [
            p.nome || '-',
            p.tipo || '-',
            translateStatus(p.status),
            formatDate(p.dataInicio),
            formatDate(p.dataFim),
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.purple, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [250, 245, 255] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === PAGE 5: FINANCIAL ANALYSIS ===
      currentSection = 'Análise Financeira';
      doc.addPage();
      addPageHeader(currentSection);
      addInnerPageDeco();
      yPos = INNER_TOP;

      doc.setFontSize(15);
      doc.setFont(undefined as any, 'bold');
      doc.setTextColor(...C.darkGreen);
      doc.text('Análise Financeira', pageWidth / 2, yPos, { align: 'center' });
      doc.setFont(undefined as any, 'normal');
      yPos += 10;

      // ── Full-width monthly evolution bar chart ───────────────────────────
      if (data.financeiro?.evolucaoMensal && data.financeiro.evolucaoMensal.length > 0) {
        const barChartData = data.financeiro.evolucaoMensal.slice(-12).map((m: any) => ({
          label: m.mes || '',
          value1: m.receitas || 0,
          value2: m.despesas || 0,
        }));

        yPos = drawBarChart(
          MARGINS.left, yPos, contentWidth, 100,
          barChartData,
          'Evolução Mensal: Receitas x Despesas',
          { label1: 'Receitas', label2: 'Despesas', color1: [30, 97, 70], color2: [215, 58, 58] }
        );
        yPos += 8;
      }

      // ── Full-width despesas por categoria ────────────────────────────────
      if (data.financeiro?.porCategoria && data.financeiro.porCategoria.length > 0) {
        checkNewPage(85);
        const catData = data.financeiro.porCategoria.map((c: any, i: number) => ({
          label: c.categoria || 'Outros',
          value: c.total || c.valor || 0,
          color: CHART_COLORS[i % CHART_COLORS.length],
        }));
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 85, catData, 'Despesas por Categoria');
        yPos += 8;
      }

      // ── Full-width receitas por empreendimento ────────────────────────────
      if (data.financeiro?.porEmpreendimento && data.financeiro.porEmpreendimento.length > 0) {
        checkNewPage(85);
        const empData = data.financeiro.porEmpreendimento.slice(0, 8).map((e: any, i: number) => ({
          label: e.nome || e.empreendimento || 'N/A',
          value: e.receitas || e.total || 0,
          color: CHART_COLORS[i % CHART_COLORS.length],
        }));
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 85, empData, 'Receitas por Empreendimento');
        yPos += 8;
      }

      // Monthly Financial Table
      if (data.financeiro?.evolucaoMensal && data.financeiro.evolucaoMensal.length > 0) {
        checkNewPage(60);
        addSectionTitle('Tabela Financeira Mensal', ECOBRASIL_COLORS.green);

        autoTable(doc, {
          startY: yPos,
          head: [['Mês', 'Receitas', 'Despesas', 'Resultado']],
          body: data.financeiro.evolucaoMensal.slice(-6).map((m: any) => {
            const resultado = (m.receitas || 0) - (m.despesas || 0);
            return [
              m.mes,
              formatCurrency(m.receitas || 0),
              formatCurrency(m.despesas || 0),
              formatCurrency(resultado),
            ];
          }),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 252, 248] },
          columnStyles: {
            1: { halign: 'right', textColor: ECOBRASIL_COLORS.green },
            2: { halign: 'right', textColor: ECOBRASIL_COLORS.red },
            3: { halign: 'right' },
          },
          didParseCell: (cellData: any) => {
            if (cellData.section === 'body' && cellData.column.index === 3) {
              const m = data.financeiro.evolucaoMensal.slice(-6)[cellData.row.index];
              const resultado = (m?.receitas || 0) - (m?.despesas || 0);
              cellData.cell.styles.textColor = resultado >= 0 ? ECOBRASIL_COLORS.green : ECOBRASIL_COLORS.red;
            }
          },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Expenses by Category Table
      if (data.financeiro?.porCategoria && data.financeiro.porCategoria.length > 0) {
        checkNewPage(50);
        addSectionTitle('Despesas por Categoria', ECOBRASIL_COLORS.red);

        const totalDespesas = data.financeiro.totalDespesas || 1;
        autoTable(doc, {
          startY: yPos,
          head: [['Categoria', 'Valor', '% do Total']],
          body: data.financeiro.porCategoria.slice(0, 8).map((c: any) => {
            const valor = c.total || c.valor || 0;
            const pct = ((valor / totalDespesas) * 100).toFixed(1);
            return [c.categoria || 'Outros', formatCurrency(valor), `${pct}%`];
          }),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.red, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 248, 248] },
          columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
          },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === PAGE: MONITORAMENTO DE CAMPO ===
      currentSection = 'Monitoramento de Campo';
      doc.addPage();
      addPageHeader(currentSection);
      addInnerPageDeco();
      yPos = INNER_TOP;

      doc.setFontSize(15);
      doc.setFont(undefined as any, 'bold');
      doc.setTextColor(...C.darkGreen);
      doc.text('Monitoramento de Campo', pageWidth / 2, yPos, { align: 'center' });
      doc.setFont(undefined as any, 'normal');
      yPos += 8;

      doc.setFontSize(9);
      doc.setTextColor(80, 100, 80);
      doc.text(
        'Registros biológicos coletados em campo por grupo taxonômico, campanha e unidade amostral.',
        pageWidth / 2, yPos, { align: 'center' }
      );
      yPos += 10;

      // KPI strip
      const campoKpis = [
        { label: 'Total de Registros', value: data.campo?.total || 0, color: C.green },
        { label: 'Campanhas',          value: data.campo?.campanhas || 0, color: C.blue },
        { label: 'Espécies Ameaçadas', value: data.campo?.ameacadas || 0, color: C.red },
      ];
      const campoKpiW = contentWidth / campoKpis.length;
      campoKpis.forEach((kpi, i) => {
        const kx = MARGINS.left + i * campoKpiW;
        doc.setFillColor(248, 252, 248);
        doc.roundedRect(kx, yPos, campoKpiW - 4, 22, 2, 2, 'F');
        doc.setDrawColor(...kpi.color);
        doc.setLineWidth(0.6);
        doc.roundedRect(kx, yPos, campoKpiW - 4, 22, 2, 2, 'S');
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(kpi.label, kx + (campoKpiW - 4) / 2, yPos + 7, { align: 'center' });
        doc.setFontSize(14);
        doc.setFont(undefined as any, 'bold');
        doc.setTextColor(...kpi.color);
        doc.text(kpi.value.toString(), kx + (campoKpiW - 4) / 2, yPos + 18, { align: 'center' });
        doc.setFont(undefined as any, 'normal');
      });
      yPos += 30;

      // Chart: by taxonomic group
      const campoByGroupArr = Object.entries(data.campo?.porGrupo || {})
        .map(([label, value], i) => ({ label, value: value as number, color: CHART_COLORS[i % CHART_COLORS.length] }))
        .sort((a, b) => b.value - a.value);
      if (campoByGroupArr.length > 0) {
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 80, campoByGroupArr, 'Registros por Grupo Taxonômico');
        yPos += 8;
      }

      // Chart: by campaign
      const campoByCampArr = Object.entries(data.campo?.porCampanha || {})
        .map(([label, value], i) => ({ label, value: value as number, color: CHART_COLORS[i % CHART_COLORS.length] }))
        .sort((a, b) => b.value - a.value);
      checkNewPage(85);
      if (campoByCampArr.length > 0) {
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 85, campoByCampArr, 'Registros por Campanha');
        yPos += 8;
      }

      // Table: recent field records
      checkNewPage(55);
      addSectionTitle('Registros Recentes de Campo', C.green);
      if (data.campo?.lista && data.campo.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Grupo', 'Campanha', 'Espécie Científica', 'Nome Comum', 'UA', 'Data', 'IUCN']],
          body: data.campo.lista.slice(0, 20).map((r: any) => [
            r.grupoTaxonomico || '-',
            r.campanha || '-',
            r.nomeCientifico || '-',
            r.nomeComum || '-',
            r.unidadeAmostral || '-',
            formatDate(r.data),
            r.iucn || '-',
          ]),
          styles: { fontSize: 6.5, cellPadding: 1.5 },
          headStyles: { fillColor: C.green, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 252, 248] },
          columnStyles: {
            6: { textColor: C.red, fontStyle: 'bold' },
          },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Intercorrências
      checkNewPage(60);
      addSectionTitle('Intercorrências nas Campanhas de Campo', C.red);
      addSubtitle(`Total de intercorrências registradas: ${data.intercorrencias?.total || 0}`);

      const intercByTypeArr = Object.entries(data.intercorrencias?.porTipo || {})
        .map(([label, value], i) => ({ label, value: value as number, color: CHART_COLORS[i % CHART_COLORS.length] }));
      if (intercByTypeArr.length > 0) {
        checkNewPage(70);
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 60, intercByTypeArr, 'Intercorrências por Tipo');
        yPos += 8;
      }

      if (data.intercorrencias?.lista && data.intercorrencias.lista.length > 0) {
        checkNewPage(50);
        autoTable(doc, {
          startY: yPos,
          head: [['Data', 'Tipo', 'Título', 'Descrição']],
          body: data.intercorrencias.lista.slice(0, 15).map((i: any) => [
            formatDate(i.data),
            i.tipo || '-',
            i.titulo || '-',
            i.descricao || '-',
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: C.red, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 248, 248] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // ── Fotos das Intercorrências (quadro 2 colunas, 6×8 cm) ──────────────
      {
        const IMG_W = 60;   // 6 cm
        const IMG_H = 80;   // 8 cm
        const GAP   = 10;   // gap between columns
        const COL_X = [MARGINS.left, MARGINS.left + IMG_W + GAP] as const;
        const CAPTION_H = 12; // space below image for title+tipo caption

        // Collect every (key, title, tipo) for images that loaded successfully
        const photoEntries: { b64: string; fmt: string; title: string; tipo: string }[] = [];
        if (data.intercorrencias?.lista) {
          for (const ic of data.intercorrencias.lista as any[]) {
            if (!Array.isArray(ic.imagens)) continue;
            for (const key of ic.imagens) {
              const b64 = intercFotoMap[key];
              if (!b64) continue;
              const fmt = b64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
              photoEntries.push({ b64, fmt, title: ic.titulo || '', tipo: ic.tipo || '' });
            }
          }
        }

        if (photoEntries.length > 0) {
          checkNewPage(20);
          // Section label
          doc.setFontSize(9);
          doc.setFont(undefined as any, 'bold');
          doc.setTextColor(...C.red);
          doc.text('Registros Fotográficos das Intercorrências', MARGINS.left, yPos);
          doc.setFont(undefined as any, 'normal');
          yPos += 7;

          for (let idx = 0; idx < photoEntries.length; idx++) {
            const col = idx % 2;
            if (col === 0) {
              // Start of a new row — ensure space for the full row
              checkNewPage(IMG_H + CAPTION_H + 4);
            }
            const x = COL_X[col];
            const y = yPos;

            // Light border behind image
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.rect(x, y, IMG_W, IMG_H);

            try {
              const { b64, fmt } = photoEntries[idx];
              doc.addImage(b64, fmt, x, y, IMG_W, IMG_H, undefined, 'FAST');
            } catch { /* skip broken images */ }

            // Caption below image
            const { title, tipo } = photoEntries[idx];
            doc.setFontSize(6.5);
            doc.setTextColor(80, 80, 80);
            const caption = [tipo && `[${tipo}]`, title].filter(Boolean).join(' ');
            doc.text(caption || '-', x + IMG_W / 2, y + IMG_H + 5, { align: 'center', maxWidth: IMG_W });

            // Advance yPos only after placing right column (or last image)
            if (col === 1 || idx === photoEntries.length - 1) {
              yPos += IMG_H + CAPTION_H + 4;
            }
          }
        }
      }

      // === PAGE 6+: DETAILED LISTS ===
      currentSection = 'Dados Detalhados';
      doc.addPage();
      addPageHeader(currentSection);
      addInnerPageDeco();
      yPos = INNER_TOP;

      doc.setFontSize(15);
      doc.setFont(undefined as any, 'bold');
      doc.setTextColor(...C.darkGreen);
      doc.text('Dados Detalhados', pageWidth / 2, yPos, { align: 'center' });
      doc.setFont(undefined as any, 'normal');
      yPos += 15;

      // Licenses Table
      addSectionTitle('Licenças Ambientais', ECOBRASIL_COLORS.green);
      addSubtitle(`Total: ${data.licencas?.total || 0} | Vigentes: ${data.licencas?.vigentes || 0} | Próx. Vencer: ${data.licencas?.proximasVencer || 0} | Vencidas: ${data.licencas?.vencidas || 0}`);

      if (data.licencas?.lista && data.licencas.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Tipo', 'Órgão Emissor', 'Emissão', 'Vencimento', 'Status']],
          body: data.licencas.lista.slice(0, 12).map((l: any) => [
            l.tipo || '-',
            l.orgaoEmissor || '-',
            formatDate(l.dataEmissao),
            formatDate(l.dataVencimento),
            translateStatus(l.status),
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 252, 248] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Demands Table
      checkNewPage(50);
      addSectionTitle('Demandas', ECOBRASIL_COLORS.yellow);
      addSubtitle(`Total: ${data.demandas?.total || 0} | Abertas: ${data.demandas?.abertas || 0} | Concluídas: ${data.demandas?.concluidas || 0} | Atrasadas: ${data.demandas?.atrasadas || 0}`);

      if (data.demandas?.lista && data.demandas.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Título', 'Status', 'Prioridade', 'Prazo']],
          body: data.demandas.lista.slice(0, 10).map((d: any) => [
            d.titulo || '-',
            translateStatus(d.status),
            d.prioridade ? d.prioridade.charAt(0).toUpperCase() + d.prioridade.slice(1) : '-',
            formatDate(d.prazo),
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.yellow, textColor: [50, 50, 50], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 252, 245] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Fleet Table
      checkNewPage(50);
      addSectionTitle('Frota de Veículos', ECOBRASIL_COLORS.blue);
      addSubtitle(`Total: ${data.frota?.total || 0} | Disponíveis: ${data.frota?.disponiveis || 0} | Em Uso: ${data.frota?.emUso || 0} | Manutenção: ${data.frota?.emManutencao || 0}`);

      if (data.frota?.lista && data.frota.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Modelo', 'Placa', 'Status', 'Km']],
          body: data.frota.lista.slice(0, 10).map((v: any) => [
            v.modelo || '-',
            v.placa || '-',
            translateStatus(v.status),
            v.quilometragem ? `${Number(v.quilometragem).toLocaleString('pt-BR')}` : '-',
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.blue, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 255] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Equipment Table
      checkNewPage(50);
      addSectionTitle('Equipamentos', ECOBRASIL_COLORS.green);
      addSubtitle(`Total: ${data.equipamentos?.total || 0} | Ativos: ${data.equipamentos?.ativos || 0} | Manutenção: ${data.equipamentos?.emManutencao || 0}`);

      if (data.equipamentos?.lista && data.equipamentos.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Tipo', 'Status']],
          body: data.equipamentos.lista.slice(0, 10).map((e: any) => [
            e.nome || '-',
            e.tipo || '-',
            translateStatus(e.status),
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 252, 248] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // RH Table
      checkNewPage(50);
      addSectionTitle('Recursos Humanos', ECOBRASIL_COLORS.blue);
      addSubtitle(`Total: ${data.rh?.total || 0} | Ativos: ${data.rh?.ativos || 0} | Férias: ${data.rh?.ferias || 0} | Afastados: ${data.rh?.afastados || 0}`);

      if (data.rh?.lista && data.rh.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Cargo', 'Status']],
          body: data.rh.lista.slice(0, 10).map((r: any) => [
            r.nome || '-',
            r.cargo || '-',
            translateStatus(r.status),
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.blue, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 255] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Contracts Table
      checkNewPage(50);
      addSectionTitle('Contratos', ECOBRASIL_COLORS.yellow);
      addSubtitle(`Total: ${data.contratos?.total || 0} | Ativos: ${data.contratos?.ativos || 0} | Vencendo: ${data.contratos?.vencendo || 0} | Valor Total: ${formatCurrency(data.contratos?.valorTotal || 0)}`);

      if (data.contratos?.lista && data.contratos.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Número', 'Tipo', 'Valor', 'Status', 'Vigência']],
          body: data.contratos.lista.slice(0, 10).map((c: any) => [
            c.numero || '-',
            c.tipo || '-',
            formatCurrency(Number(c.valor) || 0),
            translateStatus(c.status),
            `${formatDate(c.dataInicio)} - ${formatDate(c.dataFim)}`,
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.yellow, textColor: [50, 50, 50], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 252, 245] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Projects Table
      checkNewPage(50);
      addSectionTitle('Projetos', ECOBRASIL_COLORS.green);
      addSubtitle(`Total: ${data.projetos?.total || 0} | Em Andamento: ${data.projetos?.emAndamento || 0} | Concluídos: ${data.projetos?.concluidos || 0}`);

      if (data.projetos?.lista && data.projetos.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Status', 'Início', 'Fim']],
          body: data.projetos.lista.slice(0, 10).map((p: any) => [
            p.nome || '-',
            translateStatus(p.status),
            formatDate(p.dataInicio),
            formatDate(p.dataFim),
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 252, 248] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Campaigns Table
      checkNewPage(50);
      addSectionTitle('Campanhas', ECOBRASIL_COLORS.blue);
      addSubtitle(`Total: ${data.campanhas?.total || 0} | Ativas: ${data.campanhas?.ativas || 0} | Concluídas: ${data.campanhas?.concluidas || 0}`);

      if (data.campanhas?.lista && data.campanhas.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Tipo', 'Status', 'Período']],
          body: data.campanhas.lista.slice(0, 10).map((c: any) => [
            c.nome || '-',
            c.tipo || '-',
            translateStatus(c.status),
            `${formatDate(c.dataInicio)} - ${formatDate(c.dataFim)}`,
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.blue, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 255] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Empreendimentos Table
      checkNewPage(50);
      addSectionTitle('Empreendimentos', ECOBRASIL_COLORS.darkGreen);
      addSubtitle(`Total: ${data.empreendimentos?.total || 0}`);

      if (data.empreendimentos?.lista && data.empreendimentos.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Tipo', 'Município', 'UF']],
          body: data.empreendimentos.lista.slice(0, 12).map((e: any) => [
            e.nome || '-',
            e.tipo || '-',
            e.municipio || '-',
            e.uf || '-',
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.darkGreen, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 252, 248] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // ── Amostras ──────────────────────────────────────────────────────────
      checkNewPage(50);
      addSectionTitle('Amostras de Monitoramento', C.purple);
      addSubtitle(`Total: ${data.amostras?.total || 0} amostras registradas`);

      const amostByTypeArr = Object.entries(data.amostras?.porTipo || {})
        .map(([label, value], i) => ({ label, value: value as number, color: CHART_COLORS[i % CHART_COLORS.length] }));
      if (amostByTypeArr.length > 0) {
        checkNewPage(65);
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 60, amostByTypeArr, 'Amostras por Tipo');
        yPos += 6;
      }
      if (data.amostras?.lista && data.amostras.lista.length > 0) {
        checkNewPage(45);
        autoTable(doc, {
          startY: yPos,
          head: [['Código', 'Tipo', 'Status', 'Data Coleta', 'Laboratório']],
          body: data.amostras.lista.slice(0, 15).map((a: any) => [
            a.codigo || '-',
            a.tipo || '-',
            translateStatus(a.status),
            formatDate(a.dataColeta),
            a.laboratorio || '-',
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: C.purple, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 252, 255] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // ── Fornecedores ──────────────────────────────────────────────────────
      checkNewPage(50);
      addSectionTitle('Banco de Fornecedores', C.blue);
      addSubtitle(`Total: ${data.fornecedores?.total || 0} fornecedores cadastrados`);

      const fornByTypeArr = Object.entries(data.fornecedores?.porTipo || {})
        .map(([label, value], i) => ({ label, value: value as number, color: CHART_COLORS[i % CHART_COLORS.length] }));
      const fornByRatingArr = Object.entries(data.fornecedores?.porAvaliacao || {})
        .map(([label, value], i) => ({ label, value: value as number, color: CHART_COLORS[i % CHART_COLORS.length] }));
      if (fornByTypeArr.length > 0) {
        checkNewPage(65);
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 60, fornByTypeArr, 'Fornecedores por Tipo');
        yPos += 6;
      }
      if (fornByRatingArr.length > 0) {
        checkNewPage(65);
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 60, fornByRatingArr, 'Fornecedores por Avaliação');
        yPos += 6;
      }
      if (data.fornecedores?.lista && data.fornecedores.lista.length > 0) {
        checkNewPage(45);
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Tipo', 'Avaliação', 'Status', 'E-mail']],
          body: data.fornecedores.lista.slice(0, 15).map((f: any) => [
            f.nome || '-',
            f.tipo || '-',
            f.avaliacao ? `${f.avaliacao}/5 ★` : '-',
            translateStatus(f.status),
            f.email || '-',
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: C.blue, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 255] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // ── Treinamentos ──────────────────────────────────────────────────────
      checkNewPage(50);
      addSectionTitle('Treinamentos e Capacitações', C.green);
      addSubtitle(`Total: ${data.treinamentos?.total || 0} treinamentos | Concluídos: ${(data.treinamentos?.porStatus as any)?.concluido || 0}`);

      const treinByTypeArr = Object.entries(data.treinamentos?.porTipo || {})
        .map(([label, value], i) => ({ label, value: value as number, color: CHART_COLORS[i % CHART_COLORS.length] }));
      if (treinByTypeArr.length > 0) {
        checkNewPage(65);
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 65, treinByTypeArr, 'Treinamentos por Tipo');
        yPos += 6;
      }
      if (data.treinamentos?.lista && data.treinamentos.lista.length > 0) {
        checkNewPage(45);
        autoTable(doc, {
          startY: yPos,
          head: [['Título', 'Tipo', 'Modalidade', 'Status', 'Período', 'CH']],
          body: data.treinamentos.lista.slice(0, 15).map((t: any) => [
            t.titulo || '-',
            t.tipo || '-',
            t.modalidade || '-',
            translateStatus(t.status),
            `${formatDate(t.dataInicio)} - ${formatDate(t.dataFim)}`,
            t.cargaHoraria ? `${t.cargaHoraria}h` : '-',
          ]),
          styles: { fontSize: 6.5, cellPadding: 1.5 },
          headStyles: { fillColor: C.green, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 252, 248] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // ── Propostas Comerciais ───────────────────────────────────────────────
      checkNewPage(50);
      addSectionTitle('Propostas Comerciais', C.yellow);
      addSubtitle(`Total: ${data.propostas?.total || 0} | Valor Total: ${formatCurrency(data.propostas?.valorTotal || 0)}`);

      const propByStatusArr = Object.entries(data.propostas?.porStatus || {})
        .map(([label, value], i) => ({ label, value: value as number, color: CHART_COLORS[i % CHART_COLORS.length] }));
      if (propByStatusArr.length > 0) {
        checkNewPage(65);
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 65, propByStatusArr, 'Propostas por Status');
        yPos += 6;
      }
      if (data.propostas?.lista && data.propostas.lista.length > 0) {
        checkNewPage(45);
        autoTable(doc, {
          startY: yPos,
          head: [['Título', 'Cliente', 'Valor Total', 'Margem', 'Status', 'Data']],
          body: data.propostas.lista.slice(0, 15).map((p: any) => [
            p.titulo || '-',
            p.clienteNome || '-',
            formatCurrency(Number(p.valorTotal) || 0),
            p.margemLucro ? `${p.margemLucro}%` : '-',
            translateStatus(p.status),
            formatDate(p.dataProposta),
          ]),
          styles: { fontSize: 6.5, cellPadding: 1.5 },
          headStyles: { fillColor: C.yellow, textColor: [40, 40, 40], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 252, 245] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // ── Publicações Científicas ────────────────────────────────────────────
      checkNewPage(50);
      addSectionTitle('Publicações Científicas', C.darkGreen);
      addSubtitle(`Total: ${data.publicacoes?.total || 0} publicações | Publicadas: ${(data.publicacoes?.porStatus as any)?.publicado || 0}`);

      const pubByTypeArr = Object.entries(data.publicacoes?.porTipo || {})
        .map(([label, value], i) => ({ label, value: value as number, color: CHART_COLORS[i % CHART_COLORS.length] }));
      const pubByAnoArr = Object.entries(data.publicacoes?.porAno || {})
        .map(([label, value]) => ({ label, value: value as number, color: C.blue }))
        .sort((a, b) => b.label.localeCompare(a.label)).slice(0, 8);
      if (pubByTypeArr.length > 0) {
        checkNewPage(65);
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 65, pubByTypeArr, 'Publicações por Tipo');
        yPos += 6;
      }
      if (pubByAnoArr.length > 0) {
        checkNewPage(65);
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 65, pubByAnoArr, 'Publicações por Ano');
        yPos += 6;
      }
      if (data.publicacoes?.lista && data.publicacoes.lista.length > 0) {
        checkNewPage(45);
        autoTable(doc, {
          startY: yPos,
          head: [['Título', 'Autores', 'Tipo', 'Status', 'Ano', 'DOI/Revista']],
          body: data.publicacoes.lista.slice(0, 15).map((p: any) => [
            p.titulo || '-',
            p.autores || '-',
            p.tipo || '-',
            translateStatus(p.status),
            p.anoPublicacao || '-',
            p.doi || p.revista || '-',
          ]),
          styles: { fontSize: 6.5, cellPadding: 1.5 },
          headStyles: { fillColor: C.darkGreen, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 252, 248] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // ── Processos Monitorados ─────────────────────────────────────────────
      checkNewPage(50);
      addSectionTitle('Monitoramento de Processos Ambientais', C.red);
      addSubtitle(`Total de processos monitorados: ${data.processosMonitorados?.total || 0}`);

      const procByOrgaoArr = Object.entries(data.processosMonitorados?.porOrgao || {})
        .map(([label, value], i) => ({ label, value: value as number, color: CHART_COLORS[i % CHART_COLORS.length] }));
      if (procByOrgaoArr.length > 0) {
        checkNewPage(65);
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 60, procByOrgaoArr, 'Processos por Órgão');
        yPos += 6;
      }
      if (data.processosMonitorados?.lista && data.processosMonitorados.lista.length > 0) {
        checkNewPage(45);
        autoTable(doc, {
          startY: yPos,
          head: [['Nº Processo', 'Órgão', 'Tipo', 'Status Atual', 'Última Movimentação', 'Município']],
          body: data.processosMonitorados.lista.slice(0, 15).map((p: any) => [
            p.numeroProcesso || '-',
            p.orgao || '-',
            p.tipoProcesso || '-',
            p.statusAtual || '-',
            p.ultimaMovimentacao || '-',
            p.municipio || '-',
          ]),
          styles: { fontSize: 6.5, cellPadding: 1.5 },
          headStyles: { fillColor: C.red, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 248, 248] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // ── Base de Conhecimento ──────────────────────────────────────────────
      checkNewPage(50);
      addSectionTitle('Base de Conhecimento', C.purple);
      addSubtitle(`Total de documentos: ${data.baseConhecimento?.total || 0}`);

      const bcByTypeArr = Object.entries(data.baseConhecimento?.porTipo || {})
        .map(([label, value], i) => ({ label, value: value as number, color: CHART_COLORS[i % CHART_COLORS.length] }));
      const bcByCatArr = Object.entries(data.baseConhecimento?.porCategoria || {})
        .map(([label, value], i) => ({ label, value: value as number, color: CHART_COLORS[i % CHART_COLORS.length] }));
      if (bcByTypeArr.length > 0) {
        checkNewPage(65);
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 60, bcByTypeArr, 'Documentos por Tipo');
        yPos += 6;
      }
      if (bcByCatArr.length > 0) {
        checkNewPage(65);
        yPos = drawHorizontalBarChart(MARGINS.left, yPos, contentWidth, 60, bcByCatArr, 'Documentos por Categoria');
        yPos += 6;
      }
      if (data.baseConhecimento?.lista && data.baseConhecimento.lista.length > 0) {
        checkNewPage(45);
        autoTable(doc, {
          startY: yPos,
          head: [['Título', 'Tipo', 'Categoria', 'Status', 'Versão', 'Visualizações']],
          body: data.baseConhecimento.lista.slice(0, 15).map((b: any) => [
            b.titulo || '-',
            b.tipo || '-',
            b.categoria || '-',
            translateStatus(b.status),
            b.versao || '1.0',
            b.visualizacoes || 0,
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: C.purple, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 252, 255] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === ADD FOOTERS TO ALL PAGES (skip cover = page 1) ===
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 2; i <= totalPages; i++) {
        doc.setPage(i);
        // Forest accent line
        doc.setFillColor(...C.green);
        doc.rect(0, pageHeight - 10, pageWidth, 1.5, 'F');
        // Blue footer bar
        doc.setFillColor(...C.blue);
        doc.rect(0, pageHeight - 8.5, pageWidth, 8.5, 'F');
        doc.setFontSize(6.5);
        doc.setFont(undefined as any, 'normal');
        doc.setTextColor(...SECONDARY);
        doc.text('AmbientIA — Plataforma Inteligente de Gestão para Consultorias Ambientais', MARGINS.left, pageHeight - 4);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - MARGINS.right, pageHeight - 4, { align: 'right' });
      }

      // Save the PDF
      const fileName = `Relatorio_360_AmbientIA_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
      doc.save(fileName);

      setIsDialogOpen(false);
      toast({
        title: "Relatório gerado com sucesso!",
        description: `O arquivo ${fileName} foi baixado.`,
      });

    } catch (error: any) {
      console.error('Error generating report:', error);
      const errorMessage = error?.message || "Não foi possível gerar o relatório. Tente novamente.";
      toast({
        title: "Erro ao gerar relatório",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handler para abrir o diálogo - verifica se precisa de senha primeiro
  const handleOpenDialog = () => {
    if (canAccessReport) {
      setIsDialogOpen(true);
    } else {
      setShowUnlockDialog(true);
    }
  };

  return (
    <>
      <Button 
        variant={buttonVariant} 
        size={buttonSize} 
        disabled={isExporting} 
        onClick={handleOpenDialog}
        data-testid="button-relatorio-plataforma"
      >
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4 mr-2" />
            Relatório 360°
            {!isDirectorOrAdmin && !isReportUnlocked && <Lock className="h-3 w-3 ml-1" />}
          </>
        )}
      </Button>

      {/* Diálogo de senha para usuários não-diretores */}
      <UnlockDialog
        open={showUnlockDialog}
        onOpenChange={setShowUnlockDialog}
        moduleName="relatorios"
        onSuccess={() => {
          setShowUnlockDialog(false);
          setIsDialogOpen(true);
        }}
        onCancel={() => setShowUnlockDialog(false)}
      />

      {/* Diálogo principal do relatório */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !isExporting && setIsDialogOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-green-600" />
              Relatório Completo da Plataforma
            </DialogTitle>
            <DialogDescription>
              Gere um relatório PDF completo com todos os dados da plataforma EcoGestor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">O relatório incluirá:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Resumo executivo com KPIs gerais</li>
                <li>• Licenças, demandas, frota e equipamentos</li>
                <li>• Análise financeira com evolução mensal</li>
                <li>• Projetos, contratos e recursos humanos</li>
                <li>• Monitoramento de campo e intercorrências</li>
                <li>• Campanhas, amostras e fornecedores</li>
                <li>• Treinamentos e propostas comerciais</li>
                <li>• Publicações científicas e processos ambientais</li>
                <li>• Base de conhecimento e empreendimentos</li>
                <li>• Gráficos e tabelas detalhadas por módulo</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              O relatório será gerado em formato PDF com a identidade visual do SGAI.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isExporting}>
              Cancelar
            </Button>
            <Button
              onClick={generatePDF}
              disabled={isExporting}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-gerar-relatorio"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4 mr-2" />
                  Gerar Relatório
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
