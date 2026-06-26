import { PageHeader } from "@/components/layout/AppLayout";
import { Seo } from "@/components/Seo";
import { PlanejamentoIA } from "@/components/crm/gerencial/PlanejamentoIA";
import { FollowUpPlanejadoCard } from "@/components/crm/ai/FollowUpPlanejadoCard";
import { PositivacaoManager } from "@/components/crm/gerencial/PositivacaoManager";
import { Brain, Sparkles, Lightbulb, Target, TrendingUp, CalendarCheck, Zap } from "lucide-react";
import { motion } from "framer-motion";


export default function PlanejamentoIAPage() {
  return (
    <>
      <Seo 
        title="Planejamento da Semana IA" 
        description="Planejamento estratégico semanal gerado por Inteligência Artificial baseado nos dados da sua operação." 
        path="/planejamento-ia" 
      />
      
      <PageHeader 
        title="Inteligência Semanal" 
        subtitle="Sua estratégia personalizada para os próximos 7 dias, gerada automaticamente."
      />

      <div className="space-y-8">
        {/* Programa de Positivação - Novo Destaque */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <PositivacaoManager 
            stats={{
              totalClientes: 800,
              ativos: 250,
              positivados: 100,
              metaPositivacao: 40,
              clientesEmRisco: 80
            }} 
          />
        </motion.div>

        {/* Intro Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-card p-6 rounded-[24px] border border-slate-100 dark:border-white/5 shadow-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-4">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <h4 className="font-bold text-sm mb-1 uppercase tracking-wider">Foco Estratégico</h4>
            <p className="text-xs text-muted-foreground">Identificação de clientes prioritários e produtos com maior potencial de giro.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-card p-6 rounded-[24px] border border-slate-100 dark:border-white/5 shadow-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <h4 className="font-bold text-sm mb-1 uppercase tracking-wider">Recuperação</h4>
            <p className="text-xs text-muted-foreground">Ações específicas para reativar clientes em risco e aproveitar oportunidades perdidas.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-card p-6 rounded-[24px] border border-slate-100 dark:border-white/5 shadow-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mb-4">
              <Lightbulb className="w-5 h-5 text-amber-600" />
            </div>
            <h4 className="font-bold text-sm mb-1 uppercase tracking-wider">Insights de IA</h4>
            <p className="text-xs text-muted-foreground">Análise profunda cruzando comportamento de compra, sazonalidade e metas.</p>
          </motion.div>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-3"
          >
            <PlanejamentoIA />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-2 mb-2">
              <CalendarCheck className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">Agenda de Follow-ups</h3>
            </div>
            <FollowUpPlanejadoCard />
          </motion.div>
        </div>
      </div>
    </>
  );
}
