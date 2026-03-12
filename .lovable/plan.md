

## Diagnosis

The `generate-image` edge function calls `gemini-2.0-flash-exp` directly via `generativelanguage.googleapis.com`. This model has been deprecated/removed by Google, causing a **404 error**.

## Plan

### Update `generate-image` to use Lovable AI Gateway

Instead of calling the Google API directly with the user's API key (which requires tracking model name changes), switch to the **Lovable AI Gateway** using `LOVABLE_API_KEY` (already available as a secret). This gives access to current image generation models without requiring user-provided API keys.

**Changes to `supabase/functions/generate-image/index.ts`:**

1. Replace the direct `generativelanguage.googleapis.com` call with a call to `https://ai.gateway.lovable.dev/v1/chat/completions`
2. Use `LOVABLE_API_KEY` (from `Deno.env.get`) instead of user-provided `geminiApiKey`
3. Use model `google/gemini-2.5-flash-image` with `modalities: ["image", "text"]`
4. Handle the gateway response format: extract image from `data.choices[0].message.images[0].image_url.url`
5. Handle face reference images via the `image_url` content type in messages
6. Properly handle 429 and 402 gateway errors

**Changes to `src/lib/gemini.ts`:**
- Remove `geminiApiKey` from the request body (no longer needed)
- Simplify: no more cascading key logic from `loadApiConfig`/`getOrderedGeminiKeys`

**Changes to `src/components/Sidebar.tsx`:**
- Remove the Gemini API key configuration UI (no longer needed since we use the auto-provisioned gateway key)

This eliminates the dependency on user-provided API keys and the deprecated model name issue.

