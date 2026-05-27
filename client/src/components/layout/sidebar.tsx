import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogout, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { NotificationsCenter } from "@/components/notifications-center";
import { useUnidade } from "@/contexts/UnidadeContext";
import { 
  Building2, 
  LayoutDashboard, 
  User, 
  Building, 
  ClipboardList, 
  DollarSign, 
  Car, 
  Wrench, 
  Users, 
  Database,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
  Calendar,
  CalendarDays,
  UserCog,
  CheckSquare,
  MessageCircle,
  FileText,
  Settings,
  Briefcase,
  FolderOpen,
  FileSpreadsheet,
  FlaskConical,
  Truck,
  GraduationCap,
  BookOpen,
  Phone,
  Link2,
  FileSearch,
  Cloud,
  Bot,
  Sparkles,
  Microscope,
  ScrollText,
  BellRing,
  Globe,
  Mail,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Logo from "@/components/layout/logo";

interface NavCategory {
  label: string;
  icon: any;
  items: NavItem[];
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  testid: string;
  adminOnly?: boolean;
}

export default function Sidebar() {
  const [location] = useLocation();
  const logout = useLogout();
  const { toast } = useToast();
  const { getNomeUnidade } = useUnidade();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout.mutateAsync();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message ?? "Erro ao fazer logout. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const [expandedCategories, setExpandedCategories] = useState<string[]>(["dashboard", "projetos", "equipe"]);

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const NAV_CATEGORIES: NavCategory[] = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      items: [
        { href: "/", label: "Visão Geral", icon: LayoutDashboard, testid: "nav-dashboard" },
        { href: "/dashboard-coordenador", label: "Meu Painel", icon: User, testid: "nav-dashboard-coordenador" },
        { href: "/mapa-3d", label: "Mapa 3D", icon: Globe, testid: "nav-mapa-3d" },
      ]
    },
    {
      label: "Projetos",
      icon: Briefcase,
      items: [
        { href: "/empreendimentos", label: "Empreendimentos", icon: Building, testid: "nav-projects" },
        { href: "/demandas", label: "Demandas", icon: ClipboardList, testid: "nav-demandas" },
        { href: "/calendario", label: "Calendário", icon: Calendar, testid: "nav-calendario" },
        { href: "/cronograma", label: "Cronograma", icon: CalendarDays, testid: "nav-cronograma" },
      ]
    },
    {
      label: "Equipe",
      icon: Users,
      items: [
        { href: "/gestao-equipe", label: "Gestão de Equipe", icon: UserCog, testid: "nav-gestao-equipe" },
        { href: "/minhas-tarefas", label: "Minhas Tarefas", icon: CheckSquare, testid: "nav-minhas-tarefas" },
        { href: "/rh", label: "RH", icon: Users, testid: "nav-rh" },
      ]
    },
    {
      label: "Financeiro",
      icon: DollarSign,
      items: [
        { href: "/financeiro", label: "Lançamentos", icon: DollarSign, testid: "nav-financeiro" },
        { href: "/propostas-comerciais", label: "Propostas Comerciais", icon: FileSpreadsheet, testid: "nav-propostas" },
      ]
    },
    {
      label: "Recursos",
      icon: Car,
      items: [
        { href: "/frota", label: "Frota", icon: Car, testid: "nav-frota" },
        { href: "/equipamentos", label: "Equipamentos", icon: Wrench, testid: "nav-equipamentos" },
        { href: "/fornecedores", label: "Fornecedores", icon: Truck, testid: "nav-fornecedores" },
        { href: "/ramais-contatos", label: "Ramais e Contatos", icon: Phone, testid: "nav-ramais-contatos" },
      ]
    },
    {
      label: "Amostras e Campo",
      icon: FlaskConical,
      items: [
        { href: "/amostras", label: "Gestão de Amostras", icon: FlaskConical, testid: "nav-amostras" },
        { href: "/campo", label: "Monitoramento de Campo", icon: Microscope, testid: "nav-campo" },
      ]
    },
    {
      label: "Capacitação",
      icon: GraduationCap,
      items: [
        { href: "/cursos-treinamentos", label: "Cursos e Treinamentos", icon: GraduationCap, testid: "nav-cursos-treinamentos" },
      ]
    },
    {
      label: "Documentos",
      icon: FolderOpen,
      items: [
        { href: "/gestao-dados", label: "Gestão de Dados", icon: Database, testid: "nav-gestao-dados" },
        { href: "/base-conhecimento", label: "Base de Conhecimento", icon: BookOpen, testid: "nav-base-conhecimento" },
        { href: "/publicacoes", label: "Publicações Científicas", icon: ScrollText, testid: "nav-publicacoes" },
        { href: "/links-uteis", label: "Links Úteis", icon: Link2, testid: "nav-links-uteis" },
      ]
    },
    {
      label: "Segurança do Trabalho",
      icon: ShieldCheck,
      items: [
        { href: "/seguranca-trabalho", label: "SST", icon: ShieldCheck, testid: "nav-seguranca-trabalho" },
      ]
    },

    {
      label: "Sistema",
      icon: Settings,
      items: [
        { href: "/ia", label: "Assistente IA", icon: Bot, testid: "nav-ia" },
        { href: "/alertas", label: "Alertas & WhatsApp", icon: BellRing, testid: "nav-alertas" },
        { href: "/processos-monitorados", label: "Processos SEIA", icon: FileSearch, testid: "nav-processos-monitorados" },
        { href: "/email-automacao", label: "Email com IA", icon: Mail, testid: "nav-email-automacao" },
        { href: "/relatorios-automaticos", label: "Relatórios Auto", icon: FileText, testid: "nav-relatorios-automaticos" },
        { href: "/onedrive-backups", label: "Backup & Google Drive", icon: Cloud, testid: "nav-onedrive-backups" },
        { href: "/admin/usuarios", label: "Gerenciar Usuários", icon: UserCog, testid: "nav-admin-usuarios" },
      ]
    },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#06100E]/70 backdrop-blur-xl border-r border-white/5">
      <div className={cn("p-4 border-b border-white/5 flex items-center justify-center", collapsed && "px-1")}>
        <Link
          href="/"
          aria-label="Ir para o início"
          className="flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
        >
          <Logo variant="360" size="sm" collapsed={collapsed} showSubtitle={false} />
        </Link>
      </div>

      <div className={cn("px-3 py-2 border-b border-white/5", collapsed && "px-1")}>
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-accent to-primary/80 text-white shadow-sm font-condensed tracking-wide uppercase text-[9px]",
          collapsed && "justify-center px-1"
        )}>
          <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-white" />
          {!collapsed && <span className="font-bold truncate">{getNomeUnidade()}</span>}
        </div>
      </div>

      <div className={cn("px-3 py-2 border-b border-white/5", collapsed && "px-1")}>
        {!collapsed && <GlobalSearch />}
      </div>

      <nav className="flex-1 px-2 py-2 overflow-y-auto" role="navigation" aria-label="Navegação principal">
        <div className="space-y-1.5">
          {NAV_CATEGORIES.map((category) => {
            const CategoryIcon = category.icon;
            const categoryKey = category.label.toLowerCase().replace(/\s/g, '-');
            const isExpanded = expandedCategories.includes(categoryKey);
            const hasActiveItem = category.items.some(item => isActive(item.href));
            
            return (
              <div key={categoryKey} className="space-y-0.5">
                <button
                  onClick={() => toggleCategory(categoryKey)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 border-none",
                    hasActiveItem 
                      ? "bg-primary/10 text-primary font-bold shadow-sm" 
                      : "text-white/50 hover:bg-white/[0.04] hover:text-white/90",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <CategoryIcon className={cn(
                    "h-4 w-4 flex-shrink-0 transition-colors",
                    hasActiveItem ? "text-primary" : "text-white/40 group-hover:text-white/70"
                  )} />
                  {!collapsed && (
                    <>
                      <span className="text-[10px] font-bold uppercase tracking-widest flex-1 text-left font-condensed">
                        {category.label}
                      </span>
                      <ChevronDown className={cn(
                        "h-3.5 w-3.5 transition-transform duration-300 opacity-60",
                        isExpanded && "rotate-180"
                      )} />
                    </>
                  )}
                </button>
                
                {(isExpanded || collapsed) && (
                  <div className={cn("mt-1 space-y-1", !collapsed && "ml-4 border-l-2 border-white/5 pl-3")}>
                    {category.items.filter(item => !item.adminOnly || isAdmin).map((item) => {
                      const Icon = item.icon;
                      if (item.href === "/ia") {
                        return (
                          <button
                            key={item.href}
                            data-testid={item.testid}
                            className="w-full text-left mt-1 mb-1"
                            onClick={() => { setMobileOpen(false); document.dispatchEvent(new CustomEvent("open-ai-chat")); }}
                          >
                            <div className={cn(
                              "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer text-xs border-none",
                              "bg-gradient-to-r from-primary/10 to-transparent hover:from-primary/20 text-white/90 font-medium",
                              collapsed && "justify-center px-1 bg-primary/10"
                            )}>
                              <Icon className="h-3.5 w-3.5 flex-shrink-0 text-primary animate-pulse" />
                              {!collapsed && <span>{item.label}</span>}
                            </div>
                          </button>
                        );
                      }
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          data-testid={item.testid}
                          onClick={() => setMobileOpen(false)}
                        >
                          <div
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer border-none text-xs group",
                              isActive(item.href)
                                ? "bg-primary/15 text-primary font-bold shadow-sm"
                                : "text-white/50 hover:bg-white/[0.04] hover:text-white/90",
                              collapsed && "justify-center px-1"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon className={cn("h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110", isActive(item.href) ? "text-primary" : "text-white/40")} />
                              {!collapsed && <span className="group-hover:translate-x-0.5 transition-transform duration-150">{item.label}</span>}
                            </div>
                            {isActive(item.href) && !collapsed && (
                              <ChevronRight className="h-3.5 w-3.5 text-primary" />
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className={cn("px-3 py-3 border-t border-white/5 space-y-1.5", collapsed && "px-1")}>
          <button
            onClick={() => document.dispatchEvent(new CustomEvent("open-ai-chat"))}
            className={cn(
              "w-full flex items-center gap-2 rounded-xl px-2 py-2.5 text-xs uppercase tracking-wider font-bold transition-all",
              "bg-gradient-to-r from-[#1e6146] to-[#2dd4bf] text-white hover:brightness-110 shadow-[0_0_20px_rgba(45,212,191,0.25)] border border-primary/20 hover:shadow-[0_0_25px_rgba(45,212,191,0.4)] hover:scale-[1.02] active:scale-95 transition-all duration-300",
              collapsed && "justify-center px-1"
            )}
            data-testid="nav-ia-button"
          >
            <Bot className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <span className="flex items-center gap-1 font-condensed">
                Assistente IA
                <Sparkles className="h-3 w-3 text-yellow-300 animate-bounce" />
              </span>
            )}
          </button>
      </div>

      <div className={cn("px-3 py-2 border-t border-white/5 space-y-1", collapsed && "px-1")}>
        <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "justify-between")}>
          <NotificationsCenter />
          <ThemeToggle />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={cn(
            "w-full h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            collapsed && "px-1"
          )}
          data-testid="button-logout"
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-1.5 text-xs">{isLoggingOut ? "Saindo..." : "Sair"}</span>}
        </Button>
      </div>

      <div className="hidden md:block px-2 py-1 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full h-6"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <aside 
        className={cn(
          "hidden md:flex flex-col h-screen bg-card border-r border-border fixed left-0 top-0 z-40 transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="flex items-center">
            <Logo variant="360" size="sm" showSubtitle={false} />
          </Link>
          <div className="flex items-center gap-2">
            <NotificationsCenter />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <aside 
            className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-16 flex flex-col flex-1 min-h-0 overflow-hidden">
              <SidebarContent />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
