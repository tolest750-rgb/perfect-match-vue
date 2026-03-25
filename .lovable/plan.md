

## Diagnóstico

Os logs confirmam repetidamente: `Gateway error 402: {"type":"payment_required","message":"Not enough credits"}`. As 3 edge functions (`generate-image`, `upscale-image`, `analyze-layout`) usam o Lovable AI Gateway com `LOVABLE_API_KEY`, que requer créditos no workspace.

A solução é migrar de volta para chamadas diretas à API do Google Gemini usando uma chave de API própria do usuário.

## Plano

### 1. Solicitar a chave de API do Google Gemini
Usar a ferramenta `add_secret` para pedir ao usuário sua chave `GEMINI_API_KEY` (obtida em [aistudio.google.com](https://aistudio.google.com/apikey)).

### 2. Atualizar `supabase/functions/generate-image/index.ts`
- Trocar endpoint de `ai.gateway.lovable.dev` para `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent` → usar modelo válido atual: **`gemini-2.0-flash-exp-image-generation`** (suporta geração de imagem via API direta)
- Autenticação via query param `?key=${GEMINI_API_KEY}` em vez de `Bearer LOVABLE_API_KEY`
- Adaptar formato de request/response para o formato nativo do Gemini (não OpenAI-compatible)
- Manter tratamento de face reference via `inlineData`

### 3. Atualizar `supabase/functions/upscale-image/index.ts`
- Mesma migração: endpoint direto do Gemini com `GEMINI_API_KEY`
- Modelo: `gemini-2.0-flash-exp-image-generation`
- Adaptar request/response para formato nativo

### 4. Atualizar `supabase/functions/analyze-layout/index.ts`
- Migrar para `gemini-2.0-flash` (texto/visão, sem geração de imagem)
- Endpoint direto com `GEMINI_API_KEY`

### 5. Reimplantar as 3 edge functions

### 6. Remover dependência do `LOVABLE_API_KEY` nas edge functions
Nenhuma mudança no frontend necessária — `src/lib/gemini.ts` e `Sidebar.tsx` já não enviam API key.

### Detalhes técnicos

**Formato de request do Gemini nativo (geração de imagem):**
```json
{
  "contents": [{"parts": [{"text": "prompt"}, {"inlineData": {"mimeType": "image/jpeg", "data": "base64..."}}]}],
  "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}
}
```

**Formato de response:**
```json
{
  "candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "image/png", "data": "base64..."}}]}}]
}
```

A imagem retorna como base64 inline, que será convertida para data URL `data:image/png;base64,...`.

