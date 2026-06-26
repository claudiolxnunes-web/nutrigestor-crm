/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Agro CRM'

interface WelcomeTrialProps {
  nome_gestor?: string
  nome_empresa?: string
  trial_expira_em?: string
  login_url?: string
}

function formatDate(iso?: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

const WelcomeTrialEmail = ({
  nome_gestor,
  nome_empresa,
  trial_expira_em,
  login_url,
}: WelcomeTrialProps) => {
  const greeting = nome_gestor ? `Olá, ${nome_gestor}!` : 'Olá!'
  const empresaTxt = nome_empresa ? ` da ${nome_empresa}` : ''
  const expiraTxt = formatDate(trial_expira_em)
  const cta = login_url || 'https://app.bpfconsult.com.br'

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Sua conta está pronta — comece seu trial de 14 dias no {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{greeting}</Heading>
          <Text style={text}>
            Sua conta{empresaTxt} foi criada com sucesso e seu <strong>trial de 14 dias</strong> está ativo.
            Você já pode acessar o {SITE_NAME} e começar a configurar sua equipe.
          </Text>

          <Section style={card}>
            <Heading as="h2" style={h2}>Resumo do seu trial</Heading>
            <Text style={textTight}>✓ Plano: <strong>Trial Gratuito</strong></Text>
            <Text style={textTight}>✓ Duração: <strong>14 dias</strong></Text>
            {expiraTxt && (
              <Text style={textTight}>✓ Expira em: <strong>{expiraTxt}</strong></Text>
            )}
            <Text style={textTight}>✓ Acesso completo: gestão de equipe, importação de vendas, metas, alertas e insights de IA</Text>
          </Section>

          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={cta} style={button}>Acessar minha conta</Button>
          </Section>

          <Heading as="h2" style={h2}>Próximos passos</Heading>
          <Text style={text}>
            <strong>1.</strong> Cadastre seus representantes em <em>Representantes</em>.<br />
            <strong>2.</strong> Importe seu histórico de vendas em <em>Importações</em>.<br />
            <strong>3.</strong> Defina as metas mensais e acompanhe os insights no painel <em>Gerencial</em>.
          </Text>

          <Hr style={hr} />
          <Text style={footer}>
            Precisa de ajuda? Responda este e-mail e nosso time entra em contato.
          </Text>
          <Text style={footer}>— Equipe {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: WelcomeTrialEmail,
  subject: (data: Record<string, any>) =>
    data?.nome_gestor
      ? `Bem-vindo ao ${SITE_NAME}, ${data.nome_gestor}! Seu trial de 14 dias está ativo`
      : `Bem-vindo ao ${SITE_NAME}! Seu trial de 14 dias está ativo`,
  displayName: 'Boas-vindas — Trial 14 dias',
  previewData: {
    nome_gestor: 'Carlos',
    nome_empresa: 'Empresa Demo',
    trial_expira_em: '2026-05-07',
    login_url: 'https://app.bpfconsult.com.br',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
}
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: 'hsl(222, 25%, 15%)',
  margin: '0 0 16px',
}
const h2 = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: 'hsl(199, 63%, 20%)',
  margin: '24px 0 10px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(215, 16%, 35%)',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const textTight = {
  fontSize: '14px',
  color: 'hsl(215, 16%, 35%)',
  lineHeight: '1.5',
  margin: '4px 0',
}
const card = {
  backgroundColor: 'hsl(200, 30%, 96%)',
  borderLeft: '4px solid hsl(199, 63%, 20%)',
  padding: '16px 20px',
  borderRadius: '8px',
  margin: '20px 0',
}
const button = {
  backgroundColor: 'hsl(199, 63%, 20%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold',
  padding: '14px 28px',
  borderRadius: '14px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#eaeaea', margin: '32px 0 16px' }
const footer = {
  fontSize: '12px',
  color: '#999999',
  margin: '4px 0',
  lineHeight: '1.5',
}