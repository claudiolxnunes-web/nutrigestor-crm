import { useState, useCallback } from "react";
import { z } from "zod";
import { BarChart3 } from "lucide-react";
import { CrudPage } from "@/components/crm/CrudPage";
import { PageHeader } from "@/components/layout/AppLayout";
import { HistoricoClienteDialog } from "@/components/crm/HistoricoClienteDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { useClientes } from "@/hooks/crm/useClientes";
 import { useOrg } from "@/hooks/useOrg";

const schema = z.object({
  codigo: z.string().trim().max(50).optional().or(z.literal("")),
  razao_social: z.string().trim().min(1, "Razão social é obrigatória").max(200),
  cnpj: z.string().trim().max(20).optional().or(z.literal("")),
  cidade: z.string().trim().max(120).optional().or(z.literal("")),
  estado: z.string().trim().max(2).optional().or(z.literal("")),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(255).optional().or(z.literal("")),
  representante: z.string().trim().max(120).optional().or(z.literal("")),
  cod_rc: z.string().trim().max(50).optional().or(z.literal("")),
  cod_gestor: z.string().trim().max(50).optional().or(z.literal("")),
  segmento: z.string().trim().max(20).optional().or(z.literal("")),
  linha_principal: z.string().trim().max(120).optional().or(z.literal("")),
  ultima_compra: z.string().trim().max(10).optional().or(z.literal("")),
});

 const Clientes = () => {
   const { orgId } = useOrg();
   const [hist, setHist] = useState<{ nome: string; codigo?: string | null } | null>(null);
   const {
     filtroStatus,
     setFiltroStatus,
     filtroRep,
     setFiltroRep,
     enrichRows,
     filterRows
   } = useClientes(orgId);

  const extraFilters = useCallback((rows: any[]) => {
    const reps = Array.from(new Set(rows.map((r: any) => r.representante).filter(Boolean))).sort();
    return (
      <>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
            <SelectItem value="prospecto">Prospecto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroRep} onValueChange={setFiltroRep}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Representante" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos representantes</SelectItem>
            {reps.map((r) => <SelectItem key={r as string} value={r as string}>{r as string}</SelectItem>)}
          </SelectContent>
        </Select>
      </>
    );
  }, [filtroStatus, filtroRep]);

  return (
    <>
    <PageHeader title="Clientes" subtitle="Gestão da carteira de clientes" />
    <CrudPage
      table="clientes"
      itemLabel="Cliente"
      schema={schema}
      enrichRows={enrichRows}
      filterRows={filterRows}
      extraFilters={extraFilters}
      extraRowAction={{
        icon: <BarChart3 className="h-4 w-4 text-primary" />,
        title: "Histórico de vendas",
        onClick: (row: any) => setHist({ nome: row.razao_social, codigo: row.codigo }),
      }}
      fields={[
        { name: "codigo", label: "Código Cliente" },
        { name: "razao_social", label: "Razão Social", required: true },
        { name: "cnpj", label: "CNPJ" },
        { name: "cidade", label: "Cidade" },
        { name: "estado", label: "UF" },
        { name: "telefone", label: "Telefone" },
        { name: "email", label: "E-mail", type: "email" },
        { name: "cod_rc", label: "Código RC" },
        { name: "cod_gestor", label: "Código Gestor" },
        { name: "representante", label: "Representante (Nome)" },
        { name: "segmento", label: "Segmento (A/B/C/D)" },
        { name: "linha_principal", label: "Linha de produto" },
        { name: "ultima_compra", label: "Última compra (AAAA-MM-DD)" },
      ]}
      columns={[
        { key: "codigo", label: "Código" },
        { key: "razao_social", label: "Razão Social" },
        { key: "cidade", label: "Cidade" },
        { key: "estado", label: "UF" },
        { key: "segmento", label: "Segm." },
        { key: "linha_principal", label: "Linha" },
        { key: "ultima_compra", label: "Última compra", format: "date" },
        { key: "cod_rc", label: "Cód. RC" },
        { key: "cod_gestor", label: "Cód. Gestor" },
        { key: "status_cliente", label: "Status" },
      ]}
    />
    {hist && (
      <HistoricoClienteDialog
        open={!!hist}
        onClose={() => setHist(null)}
        clienteNome={hist.nome}
        codCliente={hist.codigo}
      />
    )}
    </>
  );
};

export default Clientes;