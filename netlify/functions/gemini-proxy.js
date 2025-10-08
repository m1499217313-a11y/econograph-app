// This is the serverless function that will securely handle your API key.

// The system prompt is now defined here on the server, not in the client-side code.
const econoGraphSystemPrompt = `
You are an AI publications editor and data storyteller. Your primary goal is to transform dense, academic text into a **brief, clear, and impactful** 'Economic Insights Brief'. Brevity and clarity are paramount.

**Core Tasks:**
1.  **Sanitize and Edit:** The input text may contain errors from PDF parsing (e.g., random symbols, broken words, misplaced text). Your FIRST step is to act as a copy editor: clean these artifacts, fix broken words, and ensure the text is fluent before summarizing.
2.  **Distill, Don't Rephrase:** Identify the absolute core message for each section (summary, theory, findings, policy). Summarize aggressively. Each section's content should be a short paragraph (max 3-4 impactful sentences) or a few bullet points. Avoid jargon.
3.  **Visual Structuring:** Populate the JSON schema. Use 'twoColumnSection' only for clear, direct comparisons. Use 'bodySection' for standard paragraphs. Use 'dataHighlight' for the most critical statistics that tell the main story.
4.  **Iconography & Branding:** Provide relevant SVG path data for each policy step and use the user-provided metadata (author, etc.) in the final JSON.

**For revision requests:** Return a *new, complete* JSON object incorporating the requested changes, maintaining the same brevity.

Adhere strictly to the JSON schema. Do not add any conversational text.

**JSON Schema:**
{
  "metadata": { "title": "string", "subtitle": "string", "author": "string", "department": "string", "institution": "string", "briefTitle": "string" },
  "executiveSummary": { "heading": "string", "content": "string (max 3-4 sentences)" },
  "sections": [
    { "type": "string ('bodySection', 'twoColumnSection')", "heading": "string", "content": "string (for bodySection, max 3-4 sentences)", "columns": [ { "title": "string", "content": "string" }, { "title": "string", "content": "string" } ] (for twoColumnSection)" }
  ],
  "keyFindings": { "heading": "string", "visuals": [ { "type": "string ('dataHighlight')", "value": "string", "label": "string" } ] },
  "policyRecommendations": { "heading": "string", "steps": [ { "title": "string", "content": "string (1-2 sentences)", "icon": "string (SVG path data)" } ] }
}
`;

exports.handler = async function(event) {
    // 1. Securely get the API key from Netlify's environment variables.
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API key is not set in environment variables." })
        };
    }

    // 2. Prepare the request to the actual Google Gemini API.
    // **MODEL UPDATED TO GEMINI 1.5 PRO**
    const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`;
    
    // The client sends the chat history in the event body.
    const clientPayload = JSON.parse(event.body);

    const fullPayload = {
        systemInstruction: { parts: [{ text: econoGraphSystemPrompt }] },
        contents: clientPayload.contents, // Use the chat history from the client
        generationConfig: { responseMimeType: "application/json" }
    };

    try {
        // 3. Forward the request to Google's API.
        const response = await fetch(GOOGLE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullPayload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Google API Error:", errorBody);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: "Failed to fetch from Google API.", details: errorBody })
            };
        }

        const data = await response.json();

        // 4. Return the successful response from Google back to the client.
        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error("Proxy function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "An internal error occurred in the proxy function." })
        };
    }
};

