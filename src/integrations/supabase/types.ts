export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acoes_gestor: {
        Row: {
          concluida_em: string | null
          created_at: string
          data_alvo: string | null
          descricao: string | null
          gestor_id: string
          id: string
          organizacao_id: string
          prioridade: string
          rc_nome: string | null
          rc_user_id: string
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          data_alvo?: string | null
          descricao?: string | null
          gestor_id: string
          id?: string
          organizacao_id: string
          prioridade?: string
          rc_nome?: string | null
          rc_user_id: string
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          data_alvo?: string | null
          descricao?: string | null
          gestor_id?: string
          id?: string
          organizacao_id?: string
          prioridade?: string
          rc_nome?: string | null
          rc_user_id?: string
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acoes_gestor_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          organizacao_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          organizacao_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_api_keys_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_email_analyses: {
        Row: {
          category: string | null
          created_at: string
          email_summary: string
          id: string
          identified_client_id: string | null
          organizacao_id: string
          payload: Json | null
          priority: string | null
          processed_at: string | null
          received_at: string | null
          status: string
          suggested_action: string | null
          urgency_score: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          email_summary: string
          id?: string
          identified_client_id?: string | null
          organizacao_id: string
          payload?: Json | null
          priority?: string | null
          processed_at?: string | null
          received_at?: string | null
          status?: string
          suggested_action?: string | null
          urgency_score?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          email_summary?: string
          id?: string
          identified_client_id?: string | null
          organizacao_id?: string
          payload?: Json | null
          priority?: string | null
          processed_at?: string | null
          received_at?: string | null
          status?: string
          suggested_action?: string | null
          urgency_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_email_analyses_identified_client_id_fkey"
            columns: ["identified_client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_email_analyses_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_rc: {
        Row: {
          acao_gestor_id: string | null
          cidade: string | null
          cliente_id: string | null
          cliente_nome: string
          cod_cliente: string | null
          cod_rc: string | null
          created_at: string
          data_prevista_visita: string | null
          descricao: string | null
          fechado_em: string | null
          fechado_por: string | null
          id: string
          linha: string | null
          mes_referencia: string
          motivo_categoria: string | null
          motivo_detalhe: string | null
          observacao_rc: string | null
          organizacao_id: string
          planejamento_id: string | null
          plano_acao: string | null
          prazo_resposta: string | null
          rc_nome: string | null
          respondido_em: string | null
          resultado_final: string | null
          severidade: string
          status: string
          tipo: string
          titulo: string
          ultima_compra: string | null
          updated_at: string
          user_id: string
          valor_referencia: number | null
        }
        Insert: {
          acao_gestor_id?: string | null
          cidade?: string | null
          cliente_id?: string | null
          cliente_nome: string
          cod_cliente?: string | null
          cod_rc?: string | null
          created_at?: string
          data_prevista_visita?: string | null
          descricao?: string | null
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          linha?: string | null
          mes_referencia: string
          motivo_categoria?: string | null
          motivo_detalhe?: string | null
          observacao_rc?: string | null
          organizacao_id: string
          planejamento_id?: string | null
          plano_acao?: string | null
          prazo_resposta?: string | null
          rc_nome?: string | null
          respondido_em?: string | null
          resultado_final?: string | null
          severidade?: string
          status?: string
          tipo: string
          titulo: string
          ultima_compra?: string | null
          updated_at?: string
          user_id: string
          valor_referencia?: number | null
        }
        Update: {
          acao_gestor_id?: string | null
          cidade?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          cod_cliente?: string | null
          cod_rc?: string | null
          created_at?: string
          data_prevista_visita?: string | null
          descricao?: string | null
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          linha?: string | null
          mes_referencia?: string
          motivo_categoria?: string | null
          motivo_detalhe?: string | null
          observacao_rc?: string | null
          organizacao_id?: string
          planejamento_id?: string | null
          plano_acao?: string | null
          prazo_resposta?: string | null
          rc_nome?: string | null
          respondido_em?: string | null
          resultado_final?: string | null
          severidade?: string
          status?: string
          tipo?: string
          titulo?: string
          ultima_compra?: string | null
          updated_at?: string
          user_id?: string
          valor_referencia?: number | null
        }
        Relationships: []
      }
      campanhas_positivacao: {
        Row: {
          clientes_positivados: number | null
          clientes_restantes: number | null
          cod_rc: string
          configuracoes_ia: Json | null
          created_at: string | null
          id: string
          mes_referencia: string
          meta_positivacao_pct: number | null
          organizacao_id: string
          status: string | null
          total_clientes_ativos: number | null
          updated_at: string | null
        }
        Insert: {
          clientes_positivados?: number | null
          clientes_restantes?: number | null
          cod_rc: string
          configuracoes_ia?: Json | null
          created_at?: string | null
          id?: string
          mes_referencia: string
          meta_positivacao_pct?: number | null
          organizacao_id: string
          status?: string | null
          total_clientes_ativos?: number | null
          updated_at?: string | null
        }
        Update: {
          clientes_positivados?: number | null
          clientes_restantes?: number | null
          cod_rc?: string
          configuracoes_ia?: Json | null
          created_at?: string | null
          id?: string
          mes_referencia?: string
          meta_positivacao_pct?: number | null
          organizacao_id?: string
          status?: string | null
          total_clientes_ativos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_positivacao_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cidade: string | null
          cnpj: string | null
          cod_gestor: string | null
          cod_rc: string | null
          codigo: string | null
          created_at: string
          email: string | null
          estado: string | null
          gestor_id: string | null
          id: string
          lat: number | null
          linha_principal: string | null
          lng: number | null
          organizacao_id: string
          probabilidade_churn: number | null
          razao_social: string
          representante: string | null
          segmento: string | null
          telefone: string | null
          ultima_compra: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cidade?: string | null
          cnpj?: string | null
          cod_gestor?: string | null
          cod_rc?: string | null
          codigo?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          gestor_id?: string | null
          id?: string
          lat?: number | null
          linha_principal?: string | null
          lng?: number | null
          organizacao_id: string
          probabilidade_churn?: number | null
          razao_social: string
          representante?: string | null
          segmento?: string | null
          telefone?: string | null
          ultima_compra?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cidade?: string | null
          cnpj?: string | null
          cod_gestor?: string | null
          cod_rc?: string | null
          codigo?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          gestor_id?: string | null
          id?: string
          lat?: number | null
          linha_principal?: string | null
          lng?: number | null
          organizacao_id?: string
          probabilidade_churn?: number | null
          razao_social?: string
          representante?: string | null
          segmento?: string | null
          telefone?: string | null
          ultima_compra?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_clientes_org"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      dias_trabalho: {
        Row: {
          check_in: string | null
          check_out: string | null
          cod_rc: string | null
          created_at: string
          data: string
          id: string
          observacao: string | null
          organizacao_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          cod_rc?: string | null
          created_at?: string
          data: string
          id?: string
          observacao?: string | null
          organizacao_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          cod_rc?: string | null
          created_at?: string
          data?: string
          id?: string
          observacao?: string | null
          organizacao_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dias_trabalho_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      follow_ups_planejados: {
        Row: {
          campanha_id: string | null
          cliente_id: string | null
          cliente_nome: string
          cod_rc: string | null
          created_at: string
          criado_por: string | null
          data_planejada: string
          etapa_positivacao: string | null
          id: string
          mensagem_sugerida: string | null
          organizacao_id: string
          planejamento_id: string | null
          prioridade: number | null
          status: string
          tipo_contato: string
          updated_at: string
        }
        Insert: {
          campanha_id?: string | null
          cliente_id?: string | null
          cliente_nome: string
          cod_rc?: string | null
          created_at?: string
          criado_por?: string | null
          data_planejada: string
          etapa_positivacao?: string | null
          id?: string
          mensagem_sugerida?: string | null
          organizacao_id: string
          planejamento_id?: string | null
          prioridade?: number | null
          status?: string
          tipo_contato: string
          updated_at?: string
        }
        Update: {
          campanha_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          cod_rc?: string | null
          created_at?: string
          criado_por?: string | null
          data_planejada?: string
          etapa_positivacao?: string | null
          id?: string
          mensagem_sugerida?: string | null
          organizacao_id?: string
          planejamento_id?: string | null
          prioridade?: number | null
          status?: string
          tipo_contato?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_planejados_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_positivacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_planejados_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_planejados_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "planejamento_ia"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_queue: {
        Row: {
          completed_at: string | null
          contexto: Json | null
          created_at: string
          error_message: string | null
          id: string
          insight: string | null
          mes: string
          modo: string
          organizacao_id: string
          provider: string
          status: Database["public"]["Enums"]["insight_queue_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          contexto?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          insight?: string | null
          mes: string
          modo?: string
          organizacao_id: string
          provider: string
          status?: Database["public"]["Enums"]["insight_queue_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          contexto?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          insight?: string | null
          mes?: string
          modo?: string
          organizacao_id?: string
          provider?: string
          status?: Database["public"]["Enums"]["insight_queue_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interacoes: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          cod_gestor: string | null
          cod_rc: string | null
          concorrente_perda: string | null
          convertido_em: string | null
          created_at: string
          data: string
          etapa_atualizada_em: string | null
          etapa_pipeline: string | null
          id: string
          linha: string | null
          motivo_perda: string | null
          motivo_perda_outro: string | null
          observacao: string | null
          organizacao_id: string
          probabilidade: number | null
          proxima_data: string | null
          proximo_passo: string | null
          status_pedido: string | null
          tipo: string
          titulo_oportunidade: string | null
          updated_at: string
          user_id: string
          valor: number | null
          volume_kg: number | null
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome?: string | null
          cod_gestor?: string | null
          cod_rc?: string | null
          concorrente_perda?: string | null
          convertido_em?: string | null
          created_at?: string
          data?: string
          etapa_atualizada_em?: string | null
          etapa_pipeline?: string | null
          id?: string
          linha?: string | null
          motivo_perda?: string | null
          motivo_perda_outro?: string | null
          observacao?: string | null
          organizacao_id: string
          probabilidade?: number | null
          proxima_data?: string | null
          proximo_passo?: string | null
          status_pedido?: string | null
          tipo: string
          titulo_oportunidade?: string | null
          updated_at?: string
          user_id: string
          valor?: number | null
          volume_kg?: number | null
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string | null
          cod_gestor?: string | null
          cod_rc?: string | null
          concorrente_perda?: string | null
          convertido_em?: string | null
          created_at?: string
          data?: string
          etapa_atualizada_em?: string | null
          etapa_pipeline?: string | null
          id?: string
          linha?: string | null
          motivo_perda?: string | null
          motivo_perda_outro?: string | null
          observacao?: string | null
          organizacao_id?: string
          probabilidade?: number | null
          proxima_data?: string | null
          proximo_passo?: string | null
          status_pedido?: string | null
          tipo?: string
          titulo_oportunidade?: string | null
          updated_at?: string
          user_id?: string
          valor?: number | null
          volume_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_interacoes_org"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          contato: string | null
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          organizacao_id: string
          origem: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contato?: string | null
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          organizacao_id: string
          origem?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contato?: string | null
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          organizacao_id?: string
          origem?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          cod_gestor: string | null
          cod_rc: string
          created_at: string
          id: string
          linha: string | null
          mes_ano: string
          meta_faturamento: number | null
          meta_volume: number | null
          organizacao_id: string
          representante: string | null
          solucao: string | null
          subsolucao: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cod_gestor?: string | null
          cod_rc: string
          created_at?: string
          id?: string
          linha?: string | null
          mes_ano: string
          meta_faturamento?: number | null
          meta_volume?: number | null
          organizacao_id: string
          representante?: string | null
          solucao?: string | null
          subsolucao?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cod_gestor?: string | null
          cod_rc?: string
          created_at?: string
          id?: string
          linha?: string | null
          mes_ano?: string
          meta_faturamento?: number | null
          meta_volume?: number | null
          organizacao_id?: string
          representante?: string | null
          solucao?: string | null
          subsolucao?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_metas_org"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_positivacao: {
        Row: {
          cod_rc: string
          criado_at: string | null
          id: string
          mes_referencia: string
          meta_positivacao_pct: number
          num_clientes_alvo: number | null
          organizacao_id: string
          updated_at: string | null
        }
        Insert: {
          cod_rc: string
          criado_at?: string | null
          id?: string
          mes_referencia: string
          meta_positivacao_pct: number
          num_clientes_alvo?: number | null
          organizacao_id: string
          updated_at?: string | null
        }
        Update: {
          cod_rc?: string
          criado_at?: string | null
          id?: string
          mes_referencia?: string
          meta_positivacao_pct?: number
          num_clientes_alvo?: number | null
          organizacao_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_positivacao_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      objetivos_smart: {
        Row: {
          atingivel: string | null
          cod_gestor: string | null
          cod_rc: string | null
          created_at: string
          especifico: string
          id: string
          mensuravel: string | null
          mes_ano: string
          meta_unidade: string | null
          meta_valor: number | null
          organizacao_id: string
          prazo: string | null
          progresso: number
          relevante: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          atingivel?: string | null
          cod_gestor?: string | null
          cod_rc?: string | null
          created_at?: string
          especifico: string
          id?: string
          mensuravel?: string | null
          mes_ano: string
          meta_unidade?: string | null
          meta_valor?: number | null
          organizacao_id: string
          prazo?: string | null
          progresso?: number
          relevante?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          atingivel?: string | null
          cod_gestor?: string | null
          cod_rc?: string | null
          created_at?: string
          especifico?: string
          id?: string
          mensuravel?: string | null
          mes_ano?: string
          meta_unidade?: string | null
          meta_valor?: number | null
          organizacao_id?: string
          prazo?: string | null
          progresso?: number
          relevante?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "objetivos_smart_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      organizacao_configuracoes: {
        Row: {
          criado_at: string | null
          dias_alerta_risco: number | null
          dias_inativacao: number | null
          id: string
          meta_positivacao_global: number | null
          organizacao_id: string
          updated_at: string | null
        }
        Insert: {
          criado_at?: string | null
          dias_alerta_risco?: number | null
          dias_inativacao?: number | null
          id?: string
          meta_positivacao_global?: number | null
          organizacao_id: string
          updated_at?: string | null
        }
        Update: {
          criado_at?: string | null
          dias_alerta_risco?: number | null
          dias_inativacao?: number | null
          id?: string
          meta_positivacao_global?: number | null
          organizacao_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizacao_configuracoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: true
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      organizacao_membros: {
        Row: {
          created_at: string
          id: string
          organizacao_id: string
          papel: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organizacao_id: string
          papel?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organizacao_id?: string
          papel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizacao_membros_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      organizacoes: {
        Row: {
          created_at: string
          data_expiracao: string | null
          id: string
          nome: string
          observacoes: string | null
          plano: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_expiracao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          plano?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_expiracao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          plano?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pedidos_aberto: {
        Row: {
          bloqueio: string | null
          categoria: string | null
          cliente_nome: string | null
          cod_cliente: string | null
          cod_gestor: string | null
          cod_produto: string | null
          cod_rc: string | null
          created_at: string
          data_inclusao: string | null
          data_snapshot: string
          eh_vef: string | null
          entrega_solicitada: string | null
          filial: string | null
          id: string
          linha: string | null
          motivo_bloqueio_fin: string | null
          motivo_bloqueio_presc: string | null
          organizacao_id: string
          pedido: string
          prev_faturamento: string | null
          produto: string | null
          rc_nome: string | null
          segmento: string | null
          status_tracking: string | null
          updated_at: string
          user_id: string
          valor: number | null
          volume: number | null
        }
        Insert: {
          bloqueio?: string | null
          categoria?: string | null
          cliente_nome?: string | null
          cod_cliente?: string | null
          cod_gestor?: string | null
          cod_produto?: string | null
          cod_rc?: string | null
          created_at?: string
          data_inclusao?: string | null
          data_snapshot?: string
          eh_vef?: string | null
          entrega_solicitada?: string | null
          filial?: string | null
          id?: string
          linha?: string | null
          motivo_bloqueio_fin?: string | null
          motivo_bloqueio_presc?: string | null
          organizacao_id: string
          pedido: string
          prev_faturamento?: string | null
          produto?: string | null
          rc_nome?: string | null
          segmento?: string | null
          status_tracking?: string | null
          updated_at?: string
          user_id: string
          valor?: number | null
          volume?: number | null
        }
        Update: {
          bloqueio?: string | null
          categoria?: string | null
          cliente_nome?: string | null
          cod_cliente?: string | null
          cod_gestor?: string | null
          cod_produto?: string | null
          cod_rc?: string | null
          created_at?: string
          data_inclusao?: string | null
          data_snapshot?: string
          eh_vef?: string | null
          entrega_solicitada?: string | null
          filial?: string | null
          id?: string
          linha?: string | null
          motivo_bloqueio_fin?: string | null
          motivo_bloqueio_presc?: string | null
          organizacao_id?: string
          pedido?: string
          prev_faturamento?: string | null
          produto?: string | null
          rc_nome?: string | null
          segmento?: string | null
          status_tracking?: string | null
          updated_at?: string
          user_id?: string
          valor?: number | null
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pedidos_aberto_org"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_aberto_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      planejamento_gerencial: {
        Row: {
          atingivel: string | null
          cod_gestor: string | null
          cod_rc: string | null
          created_at: string
          especifico: string
          gestor_id: string
          id: string
          mensuravel: string | null
          mes_ano: string
          meta_unidade: string | null
          meta_valor: number | null
          observacoes: string | null
          organizacao_id: string
          pilar: string
          prazo: string | null
          progresso: number
          rc_nome: string | null
          rc_user_id: string | null
          relevante: string | null
          status: string
          updated_at: string
        }
        Insert: {
          atingivel?: string | null
          cod_gestor?: string | null
          cod_rc?: string | null
          created_at?: string
          especifico: string
          gestor_id: string
          id?: string
          mensuravel?: string | null
          mes_ano: string
          meta_unidade?: string | null
          meta_valor?: number | null
          observacoes?: string | null
          organizacao_id: string
          pilar?: string
          prazo?: string | null
          progresso?: number
          rc_nome?: string | null
          rc_user_id?: string | null
          relevante?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          atingivel?: string | null
          cod_gestor?: string | null
          cod_rc?: string | null
          created_at?: string
          especifico?: string
          gestor_id?: string
          id?: string
          mensuravel?: string | null
          mes_ano?: string
          meta_unidade?: string | null
          meta_valor?: number | null
          observacoes?: string | null
          organizacao_id?: string
          pilar?: string
          prazo?: string | null
          progresso?: number
          rc_nome?: string | null
          rc_user_id?: string | null
          relevante?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planejamento_gerencial_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      planejamento_ia: {
        Row: {
          cod_rc: string | null
          contexto_json: Json | null
          created_at: string
          id: string
          mes_referencia: string
          metadados: Json | null
          organizacao_id: string
          plano_markdown: string
          provider: string | null
          semana_ano: number
          tipo_usuario: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cod_rc?: string | null
          contexto_json?: Json | null
          created_at?: string
          id?: string
          mes_referencia: string
          metadados?: Json | null
          organizacao_id: string
          plano_markdown: string
          provider?: string | null
          semana_ano: number
          tipo_usuario: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cod_rc?: string | null
          contexto_json?: Json | null
          created_at?: string
          id?: string
          mes_referencia?: string
          metadados?: Json | null
          organizacao_id?: string
          plano_markdown?: string
          provider?: string | null
          semana_ano?: number
          tipo_usuario?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planejamento_ia_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      planejamento_semanal: {
        Row: {
          cidade: string | null
          cliente_id: string | null
          cliente_nome: string
          cod_gestor: string | null
          cod_rc: string | null
          created_at: string
          dia_semana: number
          id: string
          local_insights: Json | null
          objetivo: string | null
          ordem: number
          organizacao_id: string
          semana_inicio: string
          updated_at: string
          user_id: string
          visitado: boolean
        }
        Insert: {
          cidade?: string | null
          cliente_id?: string | null
          cliente_nome: string
          cod_gestor?: string | null
          cod_rc?: string | null
          created_at?: string
          dia_semana: number
          id?: string
          local_insights?: Json | null
          objetivo?: string | null
          ordem?: number
          organizacao_id: string
          semana_inicio: string
          updated_at?: string
          user_id: string
          visitado?: boolean
        }
        Update: {
          cidade?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          cod_gestor?: string | null
          cod_rc?: string | null
          created_at?: string
          dia_semana?: number
          id?: string
          local_insights?: Json | null
          objetivo?: string | null
          ordem?: number
          organizacao_id?: string
          semana_inicio?: string
          updated_at?: string
          user_id?: string
          visitado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "planejamento_semanal_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_visita_spin: {
        Row: {
          cliente_id: string | null
          cliente_nome: string
          cod_rc: string | null
          consequencias: string | null
          created_at: string
          data_visita: string | null
          fatos_descobrir: string | null
          id: string
          necessidades_potenciais: string | null
          objetivo_visita: string | null
          organizacao_id: string
          perguntas_consequencias: string | null
          perguntas_insatisfacao: string | null
          perguntas_valor: string | null
          planejamento_id: string | null
          possiveis_insatisfacoes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome: string
          cod_rc?: string | null
          consequencias?: string | null
          created_at?: string
          data_visita?: string | null
          fatos_descobrir?: string | null
          id?: string
          necessidades_potenciais?: string | null
          objetivo_visita?: string | null
          organizacao_id: string
          perguntas_consequencias?: string | null
          perguntas_insatisfacao?: string | null
          perguntas_valor?: string | null
          planejamento_id?: string | null
          possiveis_insatisfacoes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string
          cod_rc?: string | null
          consequencias?: string | null
          created_at?: string
          data_visita?: string | null
          fatos_descobrir?: string | null
          id?: string
          necessidades_potenciais?: string | null
          objetivo_visita?: string | null
          organizacao_id?: string
          perguntas_consequencias?: string | null
          perguntas_insatisfacao?: string | null
          perguntas_valor?: string | null
          planejamento_id?: string | null
          possiveis_insatisfacoes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_visita_spin_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_visita_spin_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "planejamento_semanal"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          categoria: string | null
          codigo: string
          created_at: string
          id: string
          nome: string
          organizacao_id: string
          preco: number | null
          preco_medio_venda: number | null
          unidade: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string | null
          codigo: string
          created_at?: string
          id?: string
          nome: string
          organizacao_id: string
          preco?: number | null
          preco_medio_venda?: number | null
          unidade?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string | null
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          organizacao_id?: string
          preco?: number | null
          preco_medio_venda?: number | null
          unidade?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_produtos_org"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      representantes: {
        Row: {
          auth_user_id: string | null
          cod_gestor: string | null
          cod_rc: string | null
          created_at: string
          email: string | null
          id: string
          meta_mensal: number | null
          nome: string
          organizacao_id: string
          regiao: string | null
          status: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_user_id?: string | null
          cod_gestor?: string | null
          cod_rc?: string | null
          created_at?: string
          email?: string | null
          id?: string
          meta_mensal?: number | null
          nome: string
          organizacao_id: string
          regiao?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_user_id?: string | null
          cod_gestor?: string | null
          cod_rc?: string | null
          created_at?: string
          email?: string | null
          id?: string
          meta_mensal?: number | null
          nome?: string
          organizacao_id?: string
          regiao?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_representantes_org"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representantes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      social_proof_assets: {
        Row: {
          anonimizar_dados: boolean | null
          categoria: string | null
          cidade: string | null
          cliente_id: string | null
          consentimento_divulgacao: boolean | null
          created_at: string
          descricao: string | null
          estado: string | null
          id: string
          image_url: string
          lat: number | null
          lng: number | null
          organizacao_id: string
          resultado_valor: string | null
          titulo: string | null
          user_id: string
          visita_id: string | null
        }
        Insert: {
          anonimizar_dados?: boolean | null
          categoria?: string | null
          cidade?: string | null
          cliente_id?: string | null
          consentimento_divulgacao?: boolean | null
          created_at?: string
          descricao?: string | null
          estado?: string | null
          id?: string
          image_url: string
          lat?: number | null
          lng?: number | null
          organizacao_id: string
          resultado_valor?: string | null
          titulo?: string | null
          user_id: string
          visita_id?: string | null
        }
        Update: {
          anonimizar_dados?: boolean | null
          categoria?: string | null
          cidade?: string | null
          cliente_id?: string | null
          consentimento_divulgacao?: boolean | null
          created_at?: string
          descricao?: string | null
          estado?: string | null
          id?: string
          image_url?: string
          lat?: number | null
          lng?: number | null
          organizacao_id?: string
          resultado_valor?: string | null
          titulo?: string | null
          user_id?: string
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_proof_assets_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_proof_assets_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_proof_assets_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "interacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tarefas: {
        Row: {
          cliente_id: string | null
          created_at: string
          descricao: string | null
          id: string
          oportunidade_id: string | null
          organizacao_id: string
          prioridade: string | null
          responsavel_id: string | null
          status: string | null
          titulo: string
          updated_at: string
          vencimento: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          oportunidade_id?: string | null
          organizacao_id: string
          prioridade?: string | null
          responsavel_id?: string | null
          status?: string | null
          titulo: string
          updated_at?: string
          vencimento?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          oportunidade_id?: string | null
          organizacao_id?: string
          prioridade?: string | null
          responsavel_id?: string | null
          status?: string | null
          titulo?: string
          updated_at?: string
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "interacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendas: {
        Row: {
          bonificacao: number | null
          categoria: string | null
          cod_cfop: string | null
          cod_cliente: string | null
          cod_filial: string | null
          cod_gestor: string | null
          cod_grupo: string | null
          cod_grupo_produto: string | null
          cod_produto: string | null
          cod_rc: string | null
          cofins_total: number | null
          comissao_pct: number | null
          comissao_realizada: number | null
          created_at: string
          custo_brill_total: number | null
          customizado: string | null
          data_nf: string | null
          data_pedido: string | null
          desconto_pct: number | null
          desp_comercial: number | null
          faturamento_realizado: number | null
          faturamento_sem_encargos: number | null
          filial: string | null
          fl_vef: string | null
          frete_carga: number | null
          gnv: string | null
          grupo_cliente: string | null
          grupo_produto: string | null
          grv: string | null
          icms_total: number | null
          id: string
          linha: string | null
          mb_cb_pct: number | null
          mb_cb_total: number | null
          mes: string | null
          mes_ano: string | null
          ml_cb_pct: number | null
          ml_cb_total: number | null
          moeda: string | null
          municipio: string | null
          nome_cliente: string | null
          nome_produto: string | null
          nota_fiscal: string | null
          organizacao_id: string
          pedido: string | null
          pis_total: number | null
          pmr: number | null
          preco_kg: number | null
          preco_saco: number | null
          qtde_sacos: number | null
          regiao: string | null
          representante: string | null
          segmentacao: string | null
          solucao: string | null
          subsolucao: string | null
          tipo_operacao: string | null
          uf: string | null
          updated_at: string
          user_id: string
          volume_convertido: number | null
          volume_kg: number | null
        }
        Insert: {
          bonificacao?: number | null
          categoria?: string | null
          cod_cfop?: string | null
          cod_cliente?: string | null
          cod_filial?: string | null
          cod_gestor?: string | null
          cod_grupo?: string | null
          cod_grupo_produto?: string | null
          cod_produto?: string | null
          cod_rc?: string | null
          cofins_total?: number | null
          comissao_pct?: number | null
          comissao_realizada?: number | null
          created_at?: string
          custo_brill_total?: number | null
          customizado?: string | null
          data_nf?: string | null
          data_pedido?: string | null
          desconto_pct?: number | null
          desp_comercial?: number | null
          faturamento_realizado?: number | null
          faturamento_sem_encargos?: number | null
          filial?: string | null
          fl_vef?: string | null
          frete_carga?: number | null
          gnv?: string | null
          grupo_cliente?: string | null
          grupo_produto?: string | null
          grv?: string | null
          icms_total?: number | null
          id?: string
          linha?: string | null
          mb_cb_pct?: number | null
          mb_cb_total?: number | null
          mes?: string | null
          mes_ano?: string | null
          ml_cb_pct?: number | null
          ml_cb_total?: number | null
          moeda?: string | null
          municipio?: string | null
          nome_cliente?: string | null
          nome_produto?: string | null
          nota_fiscal?: string | null
          organizacao_id: string
          pedido?: string | null
          pis_total?: number | null
          pmr?: number | null
          preco_kg?: number | null
          preco_saco?: number | null
          qtde_sacos?: number | null
          regiao?: string | null
          representante?: string | null
          segmentacao?: string | null
          solucao?: string | null
          subsolucao?: string | null
          tipo_operacao?: string | null
          uf?: string | null
          updated_at?: string
          user_id: string
          volume_convertido?: number | null
          volume_kg?: number | null
        }
        Update: {
          bonificacao?: number | null
          categoria?: string | null
          cod_cfop?: string | null
          cod_cliente?: string | null
          cod_filial?: string | null
          cod_gestor?: string | null
          cod_grupo?: string | null
          cod_grupo_produto?: string | null
          cod_produto?: string | null
          cod_rc?: string | null
          cofins_total?: number | null
          comissao_pct?: number | null
          comissao_realizada?: number | null
          created_at?: string
          custo_brill_total?: number | null
          customizado?: string | null
          data_nf?: string | null
          data_pedido?: string | null
          desconto_pct?: number | null
          desp_comercial?: number | null
          faturamento_realizado?: number | null
          faturamento_sem_encargos?: number | null
          filial?: string | null
          fl_vef?: string | null
          frete_carga?: number | null
          gnv?: string | null
          grupo_cliente?: string | null
          grupo_produto?: string | null
          grv?: string | null
          icms_total?: number | null
          id?: string
          linha?: string | null
          mb_cb_pct?: number | null
          mb_cb_total?: number | null
          mes?: string | null
          mes_ano?: string | null
          ml_cb_pct?: number | null
          ml_cb_total?: number | null
          moeda?: string | null
          municipio?: string | null
          nome_cliente?: string | null
          nome_produto?: string | null
          nota_fiscal?: string | null
          organizacao_id?: string
          pedido?: string | null
          pis_total?: number | null
          pmr?: number | null
          preco_kg?: number | null
          preco_saco?: number | null
          qtde_sacos?: number | null
          regiao?: string | null
          representante?: string | null
          segmentacao?: string | null
          solucao?: string | null
          subsolucao?: string | null
          tipo_operacao?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string
          volume_convertido?: number | null
          volume_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_vendas_org"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas: {
        Row: {
          categoria_spin: string | null
          cidade: string | null
          cliente_id: string | null
          cliente_nome: string
          cod_cliente: string | null
          cod_gestor: string | null
          cod_rc: string | null
          concorrente_perda: string | null
          created_at: string
          data_visita: string
          duracao_minutos: number | null
          etapa_pipeline: string | null
          foto_url: string | null
          gerou_pedido: boolean
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          lat: number | null
          linha: string | null
          lng: number | null
          motivo_perda: string | null
          motivo_perda_outro: string | null
          objetivo: string | null
          observacao: string | null
          organizacao_id: string
          planejamento_id: string | null
          proxima_data: string | null
          proximo_passo: string | null
          rc_nome: string | null
          resultado: string | null
          spin_implicacao: string | null
          spin_necessidade: string | null
          spin_problema: string | null
          spin_situacao: string | null
          status: string
          uf: string | null
          updated_at: string
          user_id: string
          valor_estimado: number | null
        }
        Insert: {
          categoria_spin?: string | null
          cidade?: string | null
          cliente_id?: string | null
          cliente_nome: string
          cod_cliente?: string | null
          cod_gestor?: string | null
          cod_rc?: string | null
          concorrente_perda?: string | null
          created_at?: string
          data_visita?: string
          duracao_minutos?: number | null
          etapa_pipeline?: string | null
          foto_url?: string | null
          gerou_pedido?: boolean
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          lat?: number | null
          linha?: string | null
          lng?: number | null
          motivo_perda?: string | null
          motivo_perda_outro?: string | null
          objetivo?: string | null
          observacao?: string | null
          organizacao_id: string
          planejamento_id?: string | null
          proxima_data?: string | null
          proximo_passo?: string | null
          rc_nome?: string | null
          resultado?: string | null
          spin_implicacao?: string | null
          spin_necessidade?: string | null
          spin_problema?: string | null
          spin_situacao?: string | null
          status?: string
          uf?: string | null
          updated_at?: string
          user_id: string
          valor_estimado?: number | null
        }
        Update: {
          categoria_spin?: string | null
          cidade?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          cod_cliente?: string | null
          cod_gestor?: string | null
          cod_rc?: string | null
          concorrente_perda?: string | null
          created_at?: string
          data_visita?: string
          duracao_minutos?: number | null
          etapa_pipeline?: string | null
          foto_url?: string | null
          gerou_pedido?: boolean
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          lat?: number | null
          linha?: string | null
          lng?: number | null
          motivo_perda?: string | null
          motivo_perda_outro?: string | null
          objetivo?: string | null
          observacao?: string | null
          organizacao_id?: string
          planejamento_id?: string | null
          proxima_data?: string | null
          proximo_passo?: string | null
          rc_nome?: string | null
          resultado?: string | null
          spin_implicacao?: string | null
          spin_necessidade?: string | null
          spin_problema?: string | null
          spin_situacao?: string | null
          status?: string
          uf?: string | null
          updated_at?: string
          user_id?: string
          valor_estimado?: number | null
        }
        Relationships: []
      }
      webhooks_config: {
        Row: {
          created_at: string
          events: string[] | null
          id: string
          is_active: boolean | null
          organizacao_id: string
          platform: string
          secret: string | null
          url: string
        }
        Insert: {
          created_at?: string
          events?: string[] | null
          id?: string
          is_active?: boolean | null
          organizacao_id: string
          platform: string
          secret?: string | null
          url: string
        }
        Update: {
          created_at?: string
          events?: string[] | null
          id?: string
          is_active?: boolean | null
          organizacao_id?: string
          platform?: string
          secret?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_config_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vendas_rc: {
        Row: {
          bonificacao: number | null
          categoria: string | null
          cod_cliente: string | null
          cod_produto: string | null
          cod_rc: string | null
          data_nf: string | null
          data_pedido: string | null
          desconto_pct: number | null
          faturamento_realizado: number | null
          faturamento_sem_encargos: number | null
          filial: string | null
          gnv: string | null
          grv: string | null
          id: string | null
          linha: string | null
          mes: string | null
          mes_ano: string | null
          municipio: string | null
          nome_cliente: string | null
          nome_produto: string | null
          nota_fiscal: string | null
          pedido: string | null
          pmr: number | null
          preco_kg: number | null
          preco_saco: number | null
          qtde_sacos: number | null
          regiao: string | null
          representante: string | null
          segmentacao: string | null
          solucao: string | null
          subsolucao: string | null
          tipo_operacao: string | null
          uf: string | null
          user_id: string | null
          volume_convertido: number | null
          volume_kg: number | null
        }
        Insert: {
          bonificacao?: number | null
          categoria?: string | null
          cod_cliente?: string | null
          cod_produto?: string | null
          cod_rc?: string | null
          data_nf?: string | null
          data_pedido?: string | null
          desconto_pct?: number | null
          faturamento_realizado?: number | null
          faturamento_sem_encargos?: number | null
          filial?: string | null
          gnv?: string | null
          grv?: string | null
          id?: string | null
          linha?: string | null
          mes?: string | null
          mes_ano?: string | null
          municipio?: string | null
          nome_cliente?: string | null
          nome_produto?: string | null
          nota_fiscal?: string | null
          pedido?: string | null
          pmr?: number | null
          preco_kg?: number | null
          preco_saco?: number | null
          qtde_sacos?: number | null
          regiao?: string | null
          representante?: string | null
          segmentacao?: string | null
          solucao?: string | null
          subsolucao?: string | null
          tipo_operacao?: string | null
          uf?: string | null
          user_id?: string | null
          volume_convertido?: number | null
          volume_kg?: number | null
        }
        Update: {
          bonificacao?: number | null
          categoria?: string | null
          cod_cliente?: string | null
          cod_produto?: string | null
          cod_rc?: string | null
          data_nf?: string | null
          data_pedido?: string | null
          desconto_pct?: number | null
          faturamento_realizado?: number | null
          faturamento_sem_encargos?: number | null
          filial?: string | null
          gnv?: string | null
          grv?: string | null
          id?: string | null
          linha?: string | null
          mes?: string | null
          mes_ano?: string | null
          municipio?: string | null
          nome_cliente?: string | null
          nome_produto?: string | null
          nota_fiscal?: string | null
          pedido?: string | null
          pmr?: number | null
          preco_kg?: number | null
          preco_saco?: number | null
          qtde_sacos?: number | null
          regiao?: string | null
          representante?: string | null
          segmentacao?: string | null
          solucao?: string | null
          subsolucao?: string | null
          tipo_operacao?: string | null
          uf?: string | null
          user_id?: string | null
          volume_convertido?: number | null
          volume_kg?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      atualizar_precos_medios_produtos: {
        Args: { _organizacao_id: string }
        Returns: undefined
      }
      check_data_consistency: {
        Args: { _cod_rcs?: string[]; _meses: string[]; _organizacao_id: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      escalar_alertas_sla_vencido: { Args: { _org_id: string }; Returns: Json }
      fechar_alertas_recuperados: { Args: { _org_id: string }; Returns: Json }
      gerar_alertas_inatividade_automatica: { Args: never; Returns: undefined }
      gerar_alertas_rc: {
        Args: { _mes_ano: string; _org_id: string }
        Returns: Json
      }
      get_ai_insights: {
        Args: { _cod_cliente: string; _organizacao_id: string }
        Returns: Json
      }
      get_churn_risk_alerts: {
        Args: { _mes_atual: string; _organizacao_id: string }
        Returns: {
          avg_3m_volume: number
          cliente_id: string
          cliente_nome: string
          cod_rc: string
          current_month_volume: number
          drop_pct: number
          representante: string
          risk_level: string
        }[]
      }
      get_dashboard_stats: {
        Args: {
          _cod_gestor?: string
          _cod_rcs?: string[]
          _organizacao_id: string
        }
        Returns: Json
      }
      get_last_vendas_dates: {
        Args: { _organizacao_id: string }
        Returns: {
          cod_cliente: string
          max_data_nf: string
          nome_cliente: string
        }[]
      }
      get_user_org: { Args: { _user_id: string }; Returns: string }
      get_user_rc_code: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      listar_membros_org: {
        Args: { _org_id: string }
        Returns: {
          created_at: string
          email: string
          papel: string
          user_id: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      org_is_active: { Args: { _org_id: string }; Returns: boolean }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "gestor" | "rc" | "super_admin"
      insight_queue_status: "pending" | "processing" | "completed" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["gestor", "rc", "super_admin"],
      insight_queue_status: ["pending", "processing", "completed", "failed"],
    },
  },
} as const
