import { z } from "zod";
import { CrudPage } from "@/components/crm/CrudPage";
import { PageHeader } from "@/components/layout/AppLayout";

const schema = z.object({
  codigo: z.string().trim().min(1, "Código é obrigatório").max(50),
  nome: z.string().trim().min(1, "Nome é obrigatório").max(200),
  categoria: z.string().trim().max(120).optional().or(z.literal("")),
   unidade: z.string().trim().max(20).optional().or(z.literal("")),
   preco: z.coerce.number().min(0).optional(),
   preco_medio_venda: z.coerce.number().min(0).optional(),
});

const Produtos = () => (
  <>
    <PageHeader title="Produtos" subtitle="Cadastro comercial de produtos" />
    <CrudPage
      table="produtos"
      itemLabel="Produto"
      schema={schema}
      fields={[
        { name: "codigo", label: "Código", required: true },
        { name: "nome", label: "Nome", required: true },
        { name: "categoria", label: "Categoria" },
         { name: "unidade", label: "Unidade (kg, sc, un)" },
         { name: "preco", label: "Preço Tabela (R$)", type: "number" },
         { name: "preco_medio_venda", label: "Preço Médio Venda (R$)", type: "number" },
      ]}
      columns={[
        { key: "codigo", label: "Código" },
        { key: "nome", label: "Nome" },
        { key: "categoria", label: "Categoria" },
          { key: "preco", label: "Preço Tabela", format: "currency" },
          { key: "preco_medio_venda", label: "Preço Médio", format: "currency" },
      ]}
    />
  </>
);

export default Produtos;