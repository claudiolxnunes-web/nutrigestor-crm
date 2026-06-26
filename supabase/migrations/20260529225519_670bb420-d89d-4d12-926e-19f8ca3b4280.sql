-- Grant permissions if not already granted
GRANT SELECT, INSERT, DELETE ON public.ai_api_keys TO authenticated;

-- Add INSERT policy
CREATE POLICY "Users can insert their organization's AI keys"
ON public.ai_api_keys
FOR INSERT
WITH CHECK (
  organizacao_id = get_user_org(auth.uid())
);

-- Add DELETE policy
CREATE POLICY "Users can delete their organization's AI keys"
ON public.ai_api_keys
FOR DELETE
USING (
  organizacao_id = get_user_org(auth.uid())
);
