import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, imageBase64, mimeType, resultId } = await req.json();
    const fileBase64 = pdfBase64 || imageBase64;
    const fileMediaType = mimeType || "application/pdf";
    if (!fileBase64) throw new Error("No file data provided");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status to processing (RLS enforces ownership)
    if (resultId) {
      await supabase
        .from("lab_results")
        .update({ status: "processing" })
        .eq("id", resultId);
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a medical lab results interpreter. Analyze blood work and lab results from the provided document. Always respond using the provided tool.

For every abnormal result, you MUST provide:
1. A clear explanation of what the abnormal value means for health
2. Specific vitamins, minerals, or supplements that could help (with dosages when appropriate)
3. Dietary changes - specific foods to eat more or avoid
4. Whether the user should see a doctor urgently or schedule a routine visit
5. Additional lab tests that should be ordered to investigate further

Be specific and actionable. Instead of "eat healthier", say "increase iron-rich foods like spinach, red meat, and lentils". Instead of "take supplements", say "consider Vitamin D3 2000-4000 IU daily with K2".

IMPORTANT DISCLAIMER: Always note that this is AI-generated analysis for informational purposes only and should NOT replace professional medical advice. Users should consult their healthcare provider before starting any supplements.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this lab results document thoroughly. Extract ALL biomarkers, identify values outside normal ranges, explain what each means in simple language. For any abnormal results: recommend specific vitamins/supplements with dosages, foods to eat, whether to see a doctor, and what additional tests to request.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${fileMediaType};base64,${fileBase64}`,
                  },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "lab_analysis",
                description: "Return structured lab results analysis",
                parameters: {
                  type: "object",
                  properties: {
                    summary: {
                      type: "string",
                      description: "Brief overall assessment of the lab results",
                    },
                    biomarkers: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          value: { type: "string" },
                          unit: { type: "string" },
                          reference_range: { type: "string" },
                          status: {
                            type: "string",
                            enum: ["normal", "low", "high", "critical"],
                          },
                          explanation: { type: "string" },
                        },
                        required: ["name", "value", "unit", "reference_range", "status", "explanation"],
                      },
                    },
                    recommendations: {
                      type: "array",
                      description: "Specific actionable recommendations",
                      items: {
                        type: "object",
                        properties: {
                          category: {
                            type: "string",
                            enum: ["vitamin", "supplement", "nutrition", "lifestyle", "doctor_visit", "additional_tests"],
                          },
                          priority: {
                            type: "string",
                            enum: ["urgent", "important", "suggested"],
                            description: "How urgently this should be addressed",
                          },
                          text: { type: "string", description: "Specific actionable advice with dosages, food names, or test names" },
                        },
                        required: ["category", "priority", "text"],
                      },
                    },
                    areas_of_concern: {
                      type: "array",
                      items: { type: "string" },
                    },
                    disclaimer: { type: "string" },
                  },
                  required: ["summary", "biomarkers", "recommendations", "areas_of_concern", "disclaimer"],
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "lab_analysis" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (resultId) {
        await supabase
          .from("lab_results")
          .update({ status: "error" })
          .eq("id", resultId);
      }
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI analysis failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No analysis returned");

    const analysis = JSON.parse(toolCall.function.arguments);

    // Save analysis to database
    if (resultId) {
      await supabase
        .from("lab_results")
        .update({ status: "completed", ai_analysis: analysis })
        .eq("id", resultId);
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-labs error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
