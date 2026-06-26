import { CrudPage } from "@/components/crm/CrudPage";
import { PageHeader } from "@/components/layout/AppLayout";
import { z } from "zod";

const schema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(200),
  contato: z.string().trim().max(100).optional().or(z.literal("")),
  origem: z.string().trim().max(100).optional().or(z.literal("")),
  status: z.string().trim().min(1, "Status é obrigatório").default("novo"),
  observacoes: z.string().trim().optional().or(z.literal("")),
});

const Leads = () => {
  return (
    <>
      <PageHeader 
        title="Leads" 
        subtitle="Gerenciamento de leads e novas oportunidades" 
      />
      <CrudPage
        table="leads"
        itemLabel="Lead"
        schema={schema}
        fields={[
          { name: "nome", label: "Nome do Lead", required: true },
          { name: "contato", label: "Contato (Telefone/E-mail)" },
          { name: "origem", label: "Origem (Indicação, Site, Evento, etc)" },
          { 
            name: "status", 
            label: "Status", 
            type: "select", 
            options: [
              { label: "Novo", value: "novo" },
              { label: "Em Qualificação", value: "qualificacao" },
              { label: "Contato Realizado", value: "contatado" },
              { label: "Oportunidade", value: "oportunidade" },
              { label: "Descartado", value: "descartado" },
            ]
          },
          { name: "observacoes", label: "Observações", type: "textarea" },
        ]}
        columns={[
          { key: "nome", label: "Nome" },
          { key: "contato", label: "Contato" },
          { key: "origem", label: "Origem" },
          { key: "status", label: "Status" },
          { key: "created_at", label: "Criado em", format: "date" },
        ]}
      />
    </>
  );
};

export default Leads;
