import { Switch, Route, Redirect, useLocation } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { UnidadeProvider } from "@/contexts/UnidadeContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { useAuth } from "./lib/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Sidebar from "./components/layout/sidebar";
import ColaboradorLayout from "./components/layout/colaborador-layout";
import { PermissionGate } from "./components/PermissionGate";
import ClienteSidebar from "./components/layout/cliente-sidebar";
import NotFound from "@/pages/not-found";

// ── All pages lazy-loaded to isolate heavy CJS libs (jspdf, html2canvas, leaflet, chart.js)
// into separate chunks and avoid Rollup minification naming conflicts in production.
const Login                    = lazy(() => import("./pages/login"));
const Register                 = lazy(() => import("./pages/register"));
const SelecionarUnidade        = lazy(() => import("./pages/selecionar-unidade"));
const Dashboard                = lazy(() => import("./pages/dashboard"));
const DashboardExecutivo       = lazy(() => import("./pages/dashboard-executivo"));
const DashboardCoordenador     = lazy(() => import("./pages/dashboard-coordenador"));
const EcoAssistente            = lazy(() => import("./pages/ecoassistente"));
const FloatingAIChat           = lazy(() => import("./components/FloatingAIChat"));
const Projects                 = lazy(() => import("./pages/projects"));
const NewProject               = lazy(() => import("./pages/new-project"));
const EditProject              = lazy(() => import("./pages/edit-project"));
const ProjectDetail            = lazy(() => import("./pages/project-detail"));
const NewLicense               = lazy(() => import("./pages/new-license"));
const EditLicense              = lazy(() => import("./pages/edit-license"));
const AlertConfig              = lazy(() => import("./pages/alert-config"));
const LicencasAtivas           = lazy(() => import("./pages/licencas-ativas"));
const LicencasVencer           = lazy(() => import("./pages/licencas-vencer"));
const LicencasVencidas         = lazy(() => import("./pages/licencas-vencidas"));
const LicencasEmRenovacao      = lazy(() => import("./pages/licencas-em-renovacao"));
const LicenseDetail            = lazy(() => import("./pages/license-detail"));
const CondicionantesPendentes  = lazy(() => import("./pages/condicionantes-pendentes"));
const EntregasMes              = lazy(() => import("./pages/entregas-mes"));
const Demandas                 = lazy(() => import("./pages/demandas"));
const Financeiro               = lazy(() => import("./pages/financeiro"));
const Frota                    = lazy(() => import("./pages/frota"));
const Equipamentos             = lazy(() => import("./pages/equipamentos"));
const Amostras                 = lazy(() => import("./pages/amostras"));
const CampoMonitoramento       = lazy(() => import("./pages/campo"));
const Fornecedores             = lazy(() => import("./pages/fornecedores"));
const Rh                       = lazy(() => import("./pages/rh"));
const Treinamentos             = lazy(() => import("./pages/treinamentos"));
const Projetos                 = lazy(() => import("./pages/projetos"));
const GestaoDados              = lazy(() => import("./pages/gestaoDados"));
const SegurancaTrabalho        = lazy(() => import("./pages/segurancaTrabalho"));
const RelatoriosAutomaticos    = lazy(() => import("./pages/relatorios-automaticos"));
const PainelIntegrado          = lazy(() => import("./pages/painel-integrado"));
const MapaEmpreendimentos      = lazy(() => import("./pages/mapa"));
const Mapa3D                   = lazy(() => import("./pages/mapa-3d"));
const Calendario               = lazy(() => import("./pages/calendario"));
const Cronograma               = lazy(() => import("./pages/cronograma"));
const GestaoEquipe             = lazy(() => import("./pages/gestao-equipe"));
const Gamificacao              = lazy(() => import("./pages/gamificacao"));
const PortalColaborador        = lazy(() => import("./pages/portal-colaborador"));
const MinhasTarefasSimples     = lazy(() => import("./pages/minhas-tarefas-simples"));
const PropostasComerciais      = lazy(() => import("./pages/propostas-comerciais"));
const BaseConhecimento         = lazy(() => import("./pages/base-conhecimento"));
const Publicacoes              = lazy(() => import("./pages/publicacoes"));
const Comunicacao              = lazy(() => import("./pages/comunicacao"));
const ConformidadeISO          = lazy(() => import("./pages/conformidade-iso"));
const RamaisContatos           = lazy(() => import("./pages/ramais-contatos"));
const LinksUteis               = lazy(() => import("./pages/links-uteis"));
const ProcessosMonitorados     = lazy(() => import("./pages/processos-monitorados"));
const Newsletter               = lazy(() => import("./pages/newsletter"));
const OneDriveBackups          = lazy(() => import("./pages/onedrive-backups"));
const AtivarAdmin              = lazy(() => import("./pages/ativar-admin"));
const BlogPublic               = lazy(() => import("./pages/blog-public"));
const BlogArtigo               = lazy(() => import("./pages/blog-artigo"));
const BlogAdmin                = lazy(() => import("./pages/blog-admin"));
const AdminUsuarios            = lazy(() => import("./pages/admin-usuarios"));
const EmailAutomacao           = lazy(() => import("./pages/email-automacao"));
const Landing                  = lazy(() => import("./pages/landing"));
const ClienteLogin             = lazy(() => import("./pages/cliente/login"));
const ClienteDashboard         = lazy(() => import("./pages/cliente/dashboard"));
const ClienteEmpreendimentoDetail = lazy(() => import("./pages/cliente/empreendimento-detail"));
const ClienteDocumentos        = lazy(() => import("./pages/cliente/documentos"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-muted-foreground">Carregando...</div>
  </div>
);

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();

  if (isLoading) {
    return <PageLoader />;
  }

  // Portal do Cliente - rotas públicas e autenticadas separadas
  if (location.startsWith("/cliente")) {
    if (location === "/cliente/login") {
      return (
        <Suspense fallback={<PageLoader />}>
          <ClienteLogin />
        </Suspense>
      );
    }
    return (
      <div className="flex min-h-screen">
        <ClienteSidebar />
        <main className="flex-1 min-w-0 md:ml-64 pt-16 md:pt-0 transition-all duration-300 overflow-x-hidden">
          <Suspense fallback={<PageLoader />}>
            <Switch>
              <Route path="/cliente" component={ClienteDashboard} />
              <Route path="/cliente/empreendimentos/:id" component={ClienteEmpreendimentoDetail} />
              <Route path="/cliente/documentos" component={ClienteDocumentos} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </main>
      </div>
    );
  }

  // Páginas públicas do blog (acessíveis sem autenticação)
  if (location === "/blog" || location.startsWith("/blog/")) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/blog" component={BlogPublic} />
          <Route path="/blog/:slug" component={BlogArtigo} />
        </Switch>
      </Suspense>
    );
  }

  // Redireciona /register para /login (registro desabilitado)
  if (location === "/register") {
    setLocation("/login");
    return null;
  }

  // Permite acesso à página de login sem autenticação
  if (!isAuthenticated && location === "/login") {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/login" component={Login} />
        </Switch>
      </Suspense>
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    );
  }

  if (!user) {
    return <PageLoader />;
  }

  // Portal exclusivo para colaboradores - layout simplificado
  const isColaborador = user.cargo === "colaborador";

  if (isColaborador) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ColaboradorLayout>
          <MinhasTarefasSimples />
        </ColaboradorLayout>
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Switch>
        <Route path="/selecionar-unidade">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <SelecionarUnidade />
            </Suspense>
          )}
        </Route>
        <Route path="/mapa-3d">
          {() => (
            <Suspense fallback={<PageLoader />}>
              <Mapa3D />
            </Suspense>
          )}
        </Route>
        <Route>
          {() => (
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 min-w-0 md:ml-64 pt-16 md:pt-0 transition-all duration-300 overflow-x-hidden" id="main">
                <PermissionGate>
                  <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <Switch>
                        <Route path="/" component={Dashboard} />
                        <Route path="/dashboard" component={Dashboard} />
                        <Route path="/dashboard-executivo" component={DashboardExecutivo} />
                        <Route path="/dashboard-coordenador" component={DashboardCoordenador} />
                        <Route path="/ia" component={EcoAssistente} />
                        <Route path="/mapa"><Redirect to="/mapa-3d" /></Route>
                        <Route path="/calendario" component={Calendario} />
                        <Route path="/cronograma" component={Cronograma} />
                        <Route path="/empreendimentos" component={Projects} />
                        <Route path="/empreendimentos/novo" component={NewProject} />
                        <Route path="/empreendimentos/:id/editar" component={EditProject} />
                        <Route path="/empreendimentos/:id" component={ProjectDetail} />
                        <Route path="/empreendimentos/:id/licencas/nova" component={NewLicense} />
                        <Route path="/licencas/:id/editar" component={EditLicense} />
                        <Route path="/alertas" component={AlertConfig} />
                        <Route path="/licencas/ativas" component={LicencasAtivas} />
                        <Route path="/licencas/vencer" component={LicencasVencer} />
                        <Route path="/licencas/vencidas" component={LicencasVencidas} />
                        <Route path="/licencas/em-renovacao" component={LicencasEmRenovacao} />
                        <Route path="/licencas/:id" component={LicenseDetail} />
                        <Route path="/condicionantes/pendentes" component={CondicionantesPendentes} />
                        <Route path="/entregas/mes" component={EntregasMes} />
                        <Route path="/painel" component={PainelIntegrado} />
                        <Route path="/demandas" component={Demandas} />
                        <Route path="/financeiro" component={Financeiro} />
                        <Route path="/frota" component={Frota} />
                        <Route path="/equipamentos" component={Equipamentos} />
                        <Route path="/amostras" component={Amostras} />
                        <Route path="/campo" component={CampoMonitoramento} />
                        <Route path="/fornecedores" component={Fornecedores} />
                        <Route path="/ramais-contatos" component={RamaisContatos} />
                        <Route path="/links-uteis" component={LinksUteis} />
                        <Route path="/rh" component={Rh} />
                        <Route path="/cursos-treinamentos" component={Treinamentos} />
                        <Route path="/treinamentos" component={Treinamentos} />
                        <Route path="/projetos" component={Projetos} />
                        <Route path="/gestao-dados" component={GestaoDados} />
                        <Route path="/seguranca-trabalho" component={SegurancaTrabalho} />
                        <Route path="/relatorios-automaticos" component={RelatoriosAutomaticos} />
                        <Route path="/gestao-equipe" component={GestaoEquipe} />
                        <Route path="/gamificacao" component={Gamificacao} />
                        <Route path="/minhas-tarefas" component={PortalColaborador} />
                        <Route path="/propostas-comerciais" component={PropostasComerciais} />
                        <Route path="/base-conhecimento" component={BaseConhecimento} />
                        <Route path="/publicacoes" component={Publicacoes} />
                        <Route path="/comunicacao" component={Comunicacao} />
                        <Route path="/conformidade-iso" component={ConformidadeISO} />
                        <Route path="/processos-monitorados" component={ProcessosMonitorados} />
                        <Route path="/newsletter" component={Newsletter} />
                        <Route path="/email-automacao" component={EmailAutomacao} />
                        <Route path="/blog-admin" component={BlogAdmin} />
                        <Route path="/admin/usuarios" component={AdminUsuarios} />
                        <Route path="/onedrive-backups" component={OneDriveBackups} />
                        <Route path="/ativar-admin" component={AtivarAdmin} />
                        <Route component={NotFound} />
                      </Switch>
                    </Suspense>
                  </ErrorBoundary>
                </PermissionGate>
              </main>
              <Suspense fallback={null}>
                <FloatingAIChat />
              </Suspense>
            </div>
          )}
        </Route>
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="licenca-facil-theme">
        <UnidadeProvider>
          <PermissionProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </PermissionProvider>
        </UnidadeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
