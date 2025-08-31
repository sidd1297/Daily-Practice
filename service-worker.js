chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ANALYZE_CONTENT') {
    analyzeContent(request.content, sender.tab.id);
    return true;
  }
});

function cleanAndParseJson(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonString = match ? match[1] : text;
  return JSON.parse(jsonString);
}

async function analyzeContent(articleText, tabId) {
  try {
    const { apiKey } = await chrome.storage.sync.get('apiKey');
    if (!apiKey) {
      throw { type: 'API_KEY_MISSING', message: 'Gemini API key is not set. Please add it in the settings.' };
    }

    const LLM_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';

    const ANALYSIS_PROMPT_TEMPLATE = `
      Analyze the following article content for reliability, summary, and potential misinformation.
      Your entire response must be a single, raw JSON object, without any markdown formatting, code blocks (like \`\`\`json), or explanatory text.
      The JSON object must strictly follow this exact format:
      {
        "summary": "A 3-4 line neutral summary of the article.",
        "confidenceScore": A number between 0 and 100 representing the factual reliability of the content. 80-100 is high, 50-79 is medium, below 50 is low.,
        "misinformationCheck": {
          "containsMisinformation": boolean,
          "points": [
            "A specific point from the article that might be misleading or unverified.",
            "Another specific point if applicable."
          ]
        }
      }

      Here is the article content:
      ---
      ${articleText}
      ---
    `;

    const response = await fetch(LLM_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: ANALYSIS_PROMPT_TEMPLATE }] }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw { type: 'API_ERROR', message: `API request failed with status ${response.status}.\n\nResponse:\n${errorBody}` };
    }

    const data = await response.json();
    
    let rawText;
    try {
      rawText = data.candidates[0].content.parts[0].text;
      const parsedData = cleanAndParseJson(rawText);
      chrome.tabs.sendMessage(tabId, { type: 'ANALYSIS_COMPLETE', data: parsedData });
    } catch (e) {
      throw { type: 'PARSING_ERROR', message: 'Failed to parse the JSON response from the AI. This can happen if the model does not follow the format instructions.', rawResponse: rawText || 'No text content found in response.' };
    }

  } catch (error) {
    console.error('Analysis failed:', error);
    chrome.tabs.sendMessage(tabId, { type: 'ANALYSIS_ERROR', error: error });
  }
}

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content-script.js'],
  });
});