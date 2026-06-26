import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/AppLayout";
import { Seo } from "@/components/Seo";
import { motion } from "framer-motion";
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Bot, 
  FileText, 
  Webhook, 
  Settings, 
  ShieldCheck,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOrg } from "@/hooks/useOrg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const IntegracoesIA = () => {
  const { orgId } = useOrg();
  const [keys, setKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (orgId) fetchKeys();
  }, [orgId]);

  const fetchKeys = async () => {
    const { data } = await supabase
      .from("ai_api_keys")
      .select("*")
      .eq("organizacao_id", orgId)
      .order("created_at", { ascending: false });
    setKeys(data || []);
  };

  const createKey = async () => {
    if (!newKeyName) return toast.error("Dê um nome para a chave");
    setLoading(true);
    try {
      const rawKey = `sk_ai_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
      const { error } = await supabase.from("ai_api_keys").insert({
        name: newKeyName,
        key_hash: rawKey, // Simple storage for this prototype, in production use hashing
        organizacao_id: orgId
      });

      if (error) throw error;
      
      setGeneratedKey(rawKey);
      setNewKeyName("");
      fetchKeys();
      toast.success("Chave de API gerada com sucesso!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteKey = async (id: string) => {
    const { error } = await supabase.from("ai_api_keys").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Chave removida");
      fetchKeys();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copiado!");
  };

  return (
    <>
      <Seo title="Integração IA" description="Configure seu Agente Python externo e APIs de IA." path="/integracoes-ia" />
      <PageHeader 
        title="Integração com Agentes de IA" 
        subtitle="Conecte seu Agente Python externo ao CRM via API REST segura." 
      />

      <div className="flex flex-col gap-8">
        <Tabs defaultValue="api" className="w-full">
          <TabsList className="bg-white/5 p-1 rounded-2xl mb-6">
            <TabsTrigger value="api" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Key className="w-4 h-4 mr-2" />
              Chaves de API
            </TabsTrigger>
            <TabsTrigger value="docs" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="w-4 h-4 mr-2" />
              Documentação
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Webhook className="w-4 h-4 mr-2" />
              Webhooks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-6">
                <Card className="rounded-[32px] border-white/5 bg-white/5 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" />
                      Gerar Nova Chave
                    </CardTitle>
                    <CardDescription>Use esta chave para autenticar seu Agente Python.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-white/40">Nome do Agente</label>
                      <Input 
                        placeholder="Ex: Agente Python Vendas" 
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        className="bg-white/5 border-white/10 rounded-xl"
                      />
                    </div>
                    <Button 
                      onClick={createKey} 
                      disabled={loading}
                      className="w-full rounded-xl font-bold uppercase tracking-widest text-[10px]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Gerar Token Bearer
                    </Button>
                  </CardContent>
                </Card>

                {generatedKey && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 rounded-[32px] bg-primary/10 border border-primary/20 space-y-4"
                  >
                    <div className="flex items-center gap-2 text-primary">
                      <ShieldCheck className="w-5 h-5" />
                      <span className="text-sm font-bold">Chave Gerada</span>
                    </div>
                    <p className="text-xs text-white/60">Copie agora, ela não será exibida novamente por segurança.</p>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-black/20 p-3 rounded-xl font-mono text-xs break-all border border-white/5">
                        {generatedKey}
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => copyToClipboard(generatedKey)}>
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="lg:col-span-2">
                <Card className="rounded-[32px] border-white/5 bg-white/5 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-lg">Chaves Ativas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {keys.length === 0 ? (
                        <div className="text-center py-12 text-white/20">
                          <Bot className="w-12 h-12 mx-auto mb-4 opacity-10" />
                          <p>Nenhuma chave de API configurada.</p>
                        </div>
                      ) : (
                        keys.map((k) => (
                          <div key={k.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 group">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-primary/10 rounded-xl">
                                <Key className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-bold text-sm">{k.name}</p>
                                <p className="text-[10px] text-white/40 uppercase tracking-widest">
                                  Criada em: {new Date(k.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => deleteKey(k.id)} className="text-white/20 hover:text-rose-500">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="docs">
            <Card className="rounded-[32px] border-white/5 bg-white/5 backdrop-blur-md overflow-hidden">
              <CardHeader className="bg-white/5">
                <CardTitle>Documentação da API REST</CardTitle>
                <CardDescription>Integre via HTTP usando JSON e Bearer Token.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 prose prose-invert max-w-none">
                <div className="space-y-8">
                  <section>
                    <h3 className="text-primary flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Configuração Geral
                    </h3>
                    <div className="bg-black/40 p-4 rounded-xl font-mono text-sm border border-white/10 mt-4">
                      <p><span className="text-emerald-500">Base URL:</span> https://uzdrslqdgbsxeotfzijl.supabase.co/functions/v1/crm-external-api</p>
                      <p><span className="text-emerald-500">Header:</span> Authorization: Bearer YOUR_API_KEY</p>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-white">Principais Endpoints</h3>
                    
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded">POST</span>
                          <span className="font-mono text-sm">/email-analysis</span>
                        </div>
                        <p className="text-xs text-white/60 mb-4">Envia análise de IA para criar interações e tarefas automáticas.</p>
                        <pre className="text-[11px] bg-black/40 p-4 rounded-lg overflow-x-auto border border-white/5">
{`{
  "email_summary": "Cliente solicita orçamento de 500kg de fertilizante",
  "category": "venda",
  "priority": "alta",
  "urgency_score": 85,
  "suggested_action": "Criar oportunidade e agendar ligação"
}`}
                        </pre>
                      </div>

                      <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded">POST</span>
                          <span className="font-mono text-sm">/clients</span>
                        </div>
                        <p className="text-xs text-white/60 mb-4">Cria um novo cliente identificado pela IA.</p>
                        <pre className="text-[11px] bg-black/40 p-4 rounded-lg overflow-x-auto border border-white/5">
{`{
  "razao_social": "Fazenda Modelo LTDA",
  "cnpj": "12.345.678/0001-99",
  "email": "contato@fazenda.com",
  "cidade": "Ribeirão Preto",
  "estado": "SP"
}`}
                        </pre>
                      </div>
                    </div>
                  </section>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default IntegracoesIA;
