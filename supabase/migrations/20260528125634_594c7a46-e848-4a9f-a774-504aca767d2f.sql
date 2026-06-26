-- Add status and processed_at columns
ALTER TABLE public.ai_email_analyses 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

-- Add index for status
CREATE INDEX IF NOT EXISTS idx_email_analyses_status ON public.ai_email_analyses(status);

-- Update RLS policies to allow updating status
CREATE POLICY "Users can update their own organization email analyses"
ON public.ai_email_analyses
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND organizacao_id = ai_email_analyses.organizacao_id
  )
);
