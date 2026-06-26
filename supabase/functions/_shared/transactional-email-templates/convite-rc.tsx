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
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Agro CRM'

interface ConviteRcProps {
  nome_rc?: string
  nome_org?: string
  invite_link?: string
}

const ConviteRcEmail = ({ nome_rc, nome_org, invite_link }: ConviteRcProps) => {
  const greeting = nome_rc ? `Olá, ${nome_rc}!` : 'Olá!'
  const orgTxt = nome_org || 'sua organização'
  const cta = invite_link || 'https://app.bpfconsult.com.br/auth'

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Você foi convidado(a) para o {SITE_NAME} — {orgTxt}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{greeting}</Heading>
          <Text style={text}>
            Você foi convidado(a) para fazer parte da equipe comercial da{' '}
            <strong>{orgTxt}</strong> no {SITE_NAME}.
          </Text>

          <Section style={card}>
            <Heading as="h2" style={h2}>O que você terá acesso</Heading>
            <Text style={textTight}>✓ Seu painel pessoal de vendas e metas</Text>
            <Text style={textTight}>✓ Planejamento semanal de visitas</Text>
            <Text style={textTight}>✓ Pipeline de oportunidades e SPIN</Text>
            <Text style={textTight}>✓ Alertas de carteira em tempo real</Text>
          </Section>

          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={cta} style={button}>
              Definir minha senha e acessar
            </Button>
          </Section>

          <Text style={textSmall}>
            Ou copie e cole este link no seu navegador:
            <br />
            <Link href={cta} style={linkStyle}>
              {cta}
            </Link>
          </Text>

          <Hr style={hr} />
          <Text style={footer}>
            Este link é pessoal e expira em 1 hora. Se você não esperava este convite, ignore este e-mail.
          </Text>
          <Text style={footer}>— Equipe {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ConviteRcEmail,
  subject: (data: Record<string, any>) =>
    data?.nome_org
      ? `Convite para a equipe ${data.nome_org} — ${SITE_NAME}`
      : `Convite para o ${SITE_NAME}`,
  displayName: 'Convite RC',
  previewData: {
    nome_rc: 'João',
    nome_org: 'Empresa Demo',
    invite_link: 'https://app.bpfconsult.com.br/auth?token=exemplo',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
}
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: 'hsl(222, 25%, 15%)', margin: '0 0 16px' }
const h2 = { fontSize: '16px', fontWeight: 'bold', color: 'hsl(199, 63%, 20%)', margin: '24px 0 10px' }
const text = { fontSize: '14px', color: 'hsl(215, 16%, 35%)', lineHeight: '1.6', margin: '0 0 16px' }
const textTight = { fontSize: '14px', color: 'hsl(215, 16%, 35%)', lineHeight: '1.5', margin: '4px 0' }
const textSmall = { fontSize: '12px', color: 'hsl(215, 16%, 45%)', lineHeight: '1.5', margin: '12px 0', wordBreak: 'break-all' as const }
const linkStyle = { color: 'hsl(199, 63%, 30%)', textDecoration: 'underline' }
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
const footer = { fontSize: '12px', color: '#999999', margin: '4px 0', lineHeight: '1.5' }