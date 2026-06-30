import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// This is the actual "AI" in the platform: it sends the photo to Claude
// and asks for a structured list of safety hazards, mapped to OSHA codes.
// Returning JSON (instead of free text) is what makes this usable by code
// instead of just being a chat response.

const HAZARD_DETECTION_PROMPT = `You are a workplace safety inspector trained in OSHA standards. Analyze this image carefully for safety hazards.

For each hazard you identify, determine:
- The type of hazard
- A brief description of what you see and why it's a hazard
- Severity: "low", "medium", "high", or "critical"
- The most relevant OSHA standard code if applicable (e.g. "1910.132" for PPE issues, "1910.147" for lockout/tagout, "1910.157" for fire extinguishers, "1910.303" for electrical, "1910.22" for walking/working surfaces, "1910.1200" for chemical hazards, "1926.502" for fall protection, "1910.37" for exit routes)

Also provide an overall_risk rating for the scene: "low", "medium", "high", or "critical".

If you see no hazards, return an empty hazards array and overall_risk "low".

Respond with ONLY valid JSON in this exact format, no other text, no markdown code fences:
{
  "overall_risk": "low" | "medium" | "high" | "critical",
  "hazards": [
    {
      "hazard_type": "string",
      "description": "string",
      "severity": "low" | "medium" | "high" | "critical",
      "osha_code": "string or null",
      "osha_description": "brief description of the standard, or null"
    }
  ]
}`;

export type HazardDetectionResult = {
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  hazards: Array<{
    hazard_type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    osha_code: string | null;
    osha_description: string | null;
  }>;
};

export async function analyzeImageForHazards(
  base64Image: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<HazardDetectionResult> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: HAZARD_DETECTION_PROMPT,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Strip markdown code fences if the model adds them despite instructions
  const cleaned = textBlock.text.replace(/```json\n?|\n?```/g, '').trim();

  try {
    return JSON.parse(cleaned) as HazardDetectionResult;
  } catch (err) {
    throw new Error('Failed to parse hazard detection response as JSON: ' + cleaned);
  }
}
