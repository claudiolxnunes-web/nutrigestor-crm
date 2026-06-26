import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { initGA, usePageTracking } from "@/lib/analytics";
import { useEffect, lazy, Suspense } from "react";
import * as Sentry from "@sentry/react";

// Lazy loading for better initial load performance
const Index = lazy(() => import("./pages/Index.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe.tsx"));
const Representantes = lazy(() => import("./pages/crm/Representantes.tsx"));
const Clientes = lazy(() => import("./pages/crm/Clientes.tsx"));
const Leads = lazy(() => import("./pages/crm/Leads.tsx"));
const Produtos = lazy(() => import("./pages/crm/Produtos.tsx"));
const Placeholder = lazy(() => import("./pages/crm/Placeholder.tsx"));
const Importacoes = lazy(() => import("./pages/crm/Importacoes.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Metas = lazy(() => import("./pages/crm/Metas.tsx"));
const Gerencial = lazy(() => import("./pages/crm/Gerencial.tsx"));
const MeuPainel = lazy(() => import("./pages/crm/MeuPainel.tsx"));
const Campo = lazy(() => import("./pages/crm/Campo.tsx"));
const Visitas = lazy(() => import("./pages/crm/Visitas.tsx"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin.tsx"));
const PlanejamentoGerencial = lazy(() => import("./pages/crm/PlanejamentoGerencial.tsx"));
const PedidosAberto = lazy(() => import("./pages/crm/PedidosAberto.tsx"));
const Oportunidades = lazy(() => import("./pages/crm/Oportunidades.tsx"));
const Relatorios = lazy(() => import("./pages/crm/Relatorios.tsx"));
const Configuracoes = lazy(() => import("./pages/crm/Configuracoes.tsx"));
const IntegracoesIA = lazy(() => import("./pages/IntegracoesIA.tsx"));
const AlertasEmail = lazy(() => import("./pages/crm/AlertasEmail.tsx"));
const PlanejamentoIAPage = lazy(() => import("./pages/crm/PlanejamentoIA.tsx"));
const Acessos = lazy(() => import("./pages/crm/Acessos.tsx"));
const RevisaoInativos = lazy(() => import("./pages/crm/RevisaoInativos.tsx"));

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-medium text-slate-500 animate-pulse">Carregando Agro_RC...</p>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30,   // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AnalyticsTracker = () => {
  usePageTracking();
  return null;
};

const AnalyticsApp = () => {
  useEffect(() => {
    initGA();
  }, []);

  return (
    <>
      <AnalyticsTracker />
      <AuthProvider>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/representantes" element={<Representantes />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/produtos" element={<Produtos />} />
              <Route path="/smart" element={<Placeholder title="Planejamento SMART" subtitle="Planejamento de visitas e objectives" description="Em breve: planejamento SMART com objetivo, meta mensurável, prazo e próxima ação." />} />
              <Route path="/visitas" element={<Visitas />} />
              <Route path="/gerencial" element={<Gerencial />} />
              <Route path="/planejamento-gerencial" element={<PlanejamentoGerencial />} />
              <Route path="/metas" element={<Metas />} />
              <Route path="/meu-painel" element={<MeuPainel />} />
              <Route path="/campo" element={<Campo />} />
              <Route path="/importacoes" element={<Importacoes />} />
              <Route path="/pedidos-aberto" element={<PedidosAberto />} />
              <Route path="/oportunidades" element={<Oportunidades />} />
              <Route path="/super-admin" element={<SuperAdmin />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/integracoes-ia" element={<IntegracoesIA />} />
              <Route path="/alertas-email" element={<AlertasEmail />} />
              <Route path="/planejamento-ia" element={<PlanejamentoIAPage />} />
              <Route path="/acessos" element={<Acessos />} />
              <Route path="/revisao-inativos" element={<RevisaoInativos />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </>
  );
};

const App = () => (
  <Sentry.ErrorBoundary fallback={<p>Algo deu errado. O erro foi reportado.</p>} showDialog>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AnalyticsApp />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </Sentry.ErrorBoundary>
);

export default App;
