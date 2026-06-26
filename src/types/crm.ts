 export type Cliente = {
   id: string;
   codigo: string | null;
   razao_social: string;
   cnpj: string | null;
   cidade: string | null;
   estado: string | null;
   cod_rc: string | null;
   representante: string | null;
   segmento: string | null;
   ultima_compra: string | null;
 };
 export type Venda = {
   id: string;
   cod_rc: string | null;
   representante: string | null;
   linha: string | null;
   solucao: string | null;
   subsolucao: string | null;
   cod_cliente: string | null;
   nome_cliente: string | null;
   mes_ano: string | null;
   data_nf: string | null;
   nota_fiscal: string | null;
   nome_produto: string | null;
   cod_produto: string | null;
   faturamento_realizado: number | null;
   faturamento_sem_encargos: number | null;
   mb_cb_total: number | null;
   mb_cb_pct: number | null;
   ml_cb_total: number | null;
   ml_cb_pct: number | null;
   volume_kg: number | null;
   comissao_realizada: number | null;
   desconto_pct: number | null;
   municipio?: string | null;
   uf?: string | null;
   segmentacao?: string | null;
 };
 
 export type Meta = {
   id: string;
   cod_rc: string;
   representante: string | null;
   linha: string;
   solucao: string | null;
   subsolucao: string | null;
   mes_ano: string;
   meta_faturamento: number | null;
   meta_volume: number | null;
 };
 
 export type Rep = {
   id: string;
   nome: string;
   cod_rc: string | null;
   auth_user_id: string | null;
   status: string;
   email?: string | null;
   telefone?: string | null;
   regiao?: string | null;
   meta_mensal?: number | null;
 };
 
 export type PedidoAberto = {
   id?: string;
   pedido: string;
   cod_rc: string | null;
   rc_nome?: string | null;
   linha: string | null;
   valor: number | null;
   volume: number | null;
   data_snapshot: string | null;
   prev_faturamento: string | null;
    cod_produto?: string | null;
    cod_cliente?: string | null;
    cliente_nome?: string | null;
 };