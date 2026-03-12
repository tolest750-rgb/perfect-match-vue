

## Diagnosis

The `generate-image` edge function source code calls the Gemini API directly with user-provided API keys, but the **deployed** version is different -- it routes through the Lovable AI Gateway, which returns `402: Payment Required` when there are no workspace credits.

Evidence: Edge function logs show **no logs at all**, and the error message specifically mentions `"Payment required. Please add credits to your Lovable workspace."` -- this comes from the gateway, not from the Gemini API.

## Plan

### 1. Redeploy the `generate-image` edge function
Force-redeploy the existing source code so the live version matches the repository. The current source already calls `generativelanguage.googleapis.com` directly with the user's API key -- no gateway involved.

### 2. Redeploy `upscale-image` and `analyze-layout` as well
These may also be out of sync. Redeploy all three edge functions to ensure consistency.

No code changes are needed -- the source is correct. This is purely a deployment sync issue.

