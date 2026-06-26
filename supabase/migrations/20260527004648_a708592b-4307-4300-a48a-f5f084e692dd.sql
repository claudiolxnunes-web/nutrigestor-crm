-- Add consent and anonymization fields to Social Proof Assets
ALTER TABLE public.social_proof_assets 
ADD COLUMN IF NOT EXISTS consentimento_divulgacao BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS anonimizar_dados BOOLEAN DEFAULT FALSE;

-- Update RLS to ensure only authorized or anonymized data can be viewed by others in the future
-- (Current policies already limit to same org, but this adds a safety layer)
CREATE POLICY "Only authorized or anonymized social proof is viewable" 
ON public.social_proof_assets FOR SELECT 
USING (consentimento_divulgacao = TRUE OR anonimizar_dados = TRUE);
