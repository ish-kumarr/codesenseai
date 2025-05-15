// lib/gemini.ts
import {
  fetchFileContent,
  Repository,
  RepositoryContent,
  Language as GithubLanguage,
  Contributor as GithubContributor
} from './github';

export interface GeminiResponse {
  text: string;
  error?: string;
}

// Gemini's expected message format
interface GeminiMessagePart {
  text?: string;
  functionCall?: { // For when Gemini wants to call a function
    name: string;
    args: Record<string, any>;
  };
  functionResponse?: { // For when we provide the result of a function call
    name: string;
    response: Record<string, any>; // This 'response' contains { name: string, content: object }
  };
}

interface GeminiMessage {
  role: 'user' | 'model' | 'tool'; // 'tool' is for function responses
  parts: GeminiMessagePart[];
}

const MAX_FILES_TO_BROWSE = 3;
const MAX_FILE_CONTENT_LENGTH = 25000; // Chars per file
const MAX_CHAT_HISTORY_MESSAGES = 10; // Number of user/model turns

const getFileContentFunctionDeclaration = {
  name: 'get_file_content',
  description: `Get the content of up to ${MAX_FILES_TO_BROWSE} specific files from the repository. Use this to examine key source code files if the metadata and current context are insufficient. Provide a list of file paths.`,
  parameters: {
    type: 'object',
    properties: {
      filePaths: {
        type: 'array',
        description: `An array of up to ${MAX_FILES_TO_BROWSE} full paths to the files in the repository (e.g., ["src/main.js", "README.md"]). Choose files that are most relevant to the user's query or for understanding the project.`,
        items: { type: 'string' }
      },
    },
    required: ['filePaths'],
  },
};

function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  const TRUNCATION_MESSAGE = "\n... (content truncated due to length) ...";
  let cutPoint = content.lastIndexOf('\n', maxLength - TRUNCATION_MESSAGE.length);
  if (cutPoint === -1 || cutPoint < maxLength / 2) {
    cutPoint = maxLength - TRUNCATION_MESSAGE.length;
  }
  return content.substring(0, Math.max(0, cutPoint)) + TRUNCATION_MESSAGE;
}

async function makeGeminiApiCall(
    apiKey: string,
    contents: GeminiMessage[],
    useFunctionCalling: boolean = false
): Promise<any> { // Returns the raw Gemini API response data
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const body: any = {
        contents,
        generationConfig: {
            temperature: 0.3, // Balanced
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096, // Generous for summaries and chat
        },
    };
    if (useFunctionCalling) {
        body.tools = [{ functionDeclarations: [getFileContentFunctionDeclaration] }];
    }

    const response = await fetch(geminiApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API call failed:', JSON.stringify(errorData, null, 2));
        throw new Error(`Gemini API Error: ${errorData.error?.message || response.statusText}`);
    }
    return response.json();
}


// --- generateRepoSummary (for initial page load) ---
export async function generateRepoSummary(
  repoData: Repository,
  repoDirContents: RepositoryContent[],
  repoLanguages: GithubLanguage[],
  repoContributors: GithubContributor[]
): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { text: "Gemini API key not configured.", error: "API key missing" };

  const repoInfoForPrompt = {
    name: repoData.full_name,
    description: repoData.description,
    primaryLanguage: repoData.language,
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
    openIssues: repoData.open_issues_count,
    topics: repoData.topics,
    availableFiles: repoDirContents.map(item => ({
      path: item.path, type: item.type, size: item.size
    })).slice(0, 50),
    detectedLanguages: repoLanguages.slice(0, 5).map(l => l.name),
    contributorsCount: repoContributors.length,
  };

  const initialPrompt = `
    You are CodeSense, an AI assistant specialized in analyzing GitHub repositories.
    Analyze this GitHub repository information:
    ${JSON.stringify(repoInfoForPrompt, null, 2)}
    
    Your task is to provide a comprehensive summary. If needed, use the 'get_file_content' function to inspect up to ${MAX_FILES_TO_BROWSE} key files to deepen your analysis.
    
    Your final analysis should be in Markdown format and include:
    1. Overall purpose and main functionality.
    2. Key architectural patterns and code organization.
    3. Main technologies used and their roles.
    4. Important features and components (highlighting those from browsed files if any).
    5. Potential use cases.
    Keep it factual, detailed, and developer-focused.
  `;

  let conversationHistory: GeminiMessage[] = [{ role: 'user', parts: [{ text: initialPrompt }] }];

  try {
    console.log("GEMINI (Summary): Initial call for summary / file selection...");
    let apiResponseData = await makeGeminiApiCall(apiKey, conversationHistory, true);

    if (!apiResponseData.candidates?.[0]?.content) {
      return provideFallbackSummary(repoInfoForPrompt, "No valid initial response from AI for summary.");
    }
    let currentAiContent = apiResponseData.candidates[0].content;
    conversationHistory.push(currentAiContent); // Add AI's response

    const functionCallParts = currentAiContent.parts?.filter((p: GeminiMessagePart) => p.functionCall) || [];

    if (functionCallParts.length > 0) {
      console.log(`GEMINI (Summary): Detected ${functionCallParts.length} function call(s).`);
      const toolResponses: GeminiMessagePart[] = [];

      for (const part of functionCallParts) {
        const { name, args } = part.functionCall!;
        if (name === 'get_file_content' && args?.filePaths && Array.isArray(args.filePaths)) {
          const filesToFetch = args.filePaths.slice(0, MAX_FILES_TO_BROWSE);
          const fetchedFileResults: any[] = [];
          for (const filePath of filesToFetch) {
            const content = await fetchFileContent(repoData.owner.login, repoData.name, filePath);
            fetchedFileResults.push({
              filePath,
              content: content ? truncateContent(content, MAX_FILE_CONTENT_LENGTH) : `// File not found or error fetching: ${filePath}`,
              status: content ? "Success" : "Error/Not Found"
            });
          }
          toolResponses.push({
            functionResponse: {
              name: 'get_file_content',
              response: { name: 'get_file_content', content: { results: fetchedFileResults } }
            }
          });
        }
      }
      if (toolResponses.length > 0) {
        conversationHistory.push({ role: 'tool', parts: toolResponses });
        console.log("GEMINI (Summary): Making second call with file contents...");
        apiResponseData = await makeGeminiApiCall(apiKey, conversationHistory, false); // No function calling in final summary
        if (!apiResponseData.candidates?.[0]?.content) {
          return provideFallbackSummary(repoInfoForPrompt, "No valid final response from AI after file fetch for summary.");
        }
        currentAiContent = apiResponseData.candidates[0].content;
      }
    }

    let summaryText = currentAiContent.parts?.map((p: GeminiMessagePart) => p.text).join("") || "";
    if (!summaryText.trim()) {
      return provideFallbackSummary(repoInfoForPrompt, "AI summary was empty.");
    }
    return { text: summaryText.trim() };

  } catch (error: any) {
    console.error("Error in generateRepoSummary:", error);
    return provideFallbackSummary(repoInfoForPrompt, `Error generating summary: ${error.message}`);
  }
}

function provideFallbackSummary(repoInfo: any, reason?: string): GeminiResponse {
  const summaryText = `
# Repository Analysis: ${repoInfo.name || 'N/A'}
${reason ? `*Fallback triggered: ${reason}*\n` : ''}
## Overview
${repoInfo.description || 'No description available.'}
This is a ${repoInfo.primaryLanguage || 'multi-language'} project.
Stars: ${repoInfo.stars || 0}, Forks: ${repoInfo.forks || 0}, Open Issues: ${repoInfo.openIssues || 'N/A'}
Topics: ${repoInfo.topics?.join(', ') || 'N/A'}
## Fallback Note
This is a basic summary based on metadata. For a more detailed AI analysis, please try again.
  `;
  return { text: summaryText.trim(), error: `Used fallback summary${reason ? `: ${reason}` : ''}` };
}


// --- getChatResponse (for chat window) ---
export async function getChatResponse(
  repoData: Repository,
  repoDirContents: RepositoryContent[],
  repoLanguages: GithubLanguage[],
  repoContributors: GithubContributor[],
  userQuestion: string,
  clientChatHistory: GeminiMessage[] // Already in Gemini format
): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { text: "Gemini API key not configured.", error: "API key missing" };

  const repoContext = {
    name: repoData.full_name,
    description: repoData.description,
    primaryLanguage: repoData.language,
    availableFiles: repoDirContents.map(item => ({ path: item.path, type: item.type, size: item.size })).slice(0, 30),
    detectedLanguages: repoLanguages.slice(0, 5).map(l => l.name),
  };

  const systemInstruction = `
    You are CodeSense, an AI assistant helping a developer with the GitHub repository: ${repoContext.name}.
    Repository Context (abbreviated):
    Name: ${repoContext.name}
    Description: ${repoContext.description || "N/A"}
    Primary Language: ${repoContext.primaryLanguage || "N/A"}
    Key Files (first few): ${repoContext.availableFiles.slice(0,5).map(f=>f.path).join(', ') || "N/A"}
    
    The user will ask questions. Review the CHAT HISTORY and the current QUESTION.
    If necessary to answer, use the 'get_file_content' function to inspect up to ${MAX_FILES_TO_BROWSE} files.
    Be concise and helpful.
  `;

  // Construct full conversation: system instruction, (limited) past history, current question
  let conversationHistory: GeminiMessage[] = [
    { role: 'user', parts: [{ text: systemInstruction }] }, // System instruction as first user message
    { role: 'model', parts: [{ text: "Understood. I'm ready to help with this repository. What's your question?" }] }, // AI ack
    ...clientChatHistory.slice(-MAX_CHAT_HISTORY_MESSAGES * 2), // last N pairs
    { role: 'user', parts: [{ text: `QUESTION: ${userQuestion}` }] }
  ];

  try {
    console.log("GEMINI (Chat): Initial call for chat response / file selection...");
    let apiResponseData = await makeGeminiApiCall(apiKey, conversationHistory, true);

    if (!apiResponseData.candidates?.[0]?.content) {
      return { text: "Sorry, I couldn't get an initial response from the AI for your chat message.", error: "No valid initial AI chat response." };
    }
    let currentAiContent = apiResponseData.candidates[0].content;
    conversationHistory.push(currentAiContent);

    const functionCallParts = currentAiContent.parts?.filter((p: GeminiMessagePart) => p.functionCall) || [];

    if (functionCallParts.length > 0) {
      console.log(`GEMINI (Chat): Detected ${functionCallParts.length} function call(s).`);
      const toolResponses: GeminiMessagePart[] = [];
       for (const part of functionCallParts) {
        const { name, args } = part.functionCall!;
        if (name === 'get_file_content' && args?.filePaths && Array.isArray(args.filePaths)) {
          const filesToFetch = args.filePaths.slice(0, MAX_FILES_TO_BROWSE);
          const fetchedFileResults: any[] = [];
          for (const filePath of filesToFetch) {
            const content = await fetchFileContent(repoData.owner.login, repoData.name, filePath);
            fetchedFileResults.push({
              filePath,
              content: content ? truncateContent(content, MAX_FILE_CONTENT_LENGTH) : `// File not found or error fetching: ${filePath}`,
              status: content ? "Success" : "Error/Not Found"
            });
          }
          toolResponses.push({
            functionResponse: {
              name: 'get_file_content',
              response: { name: 'get_file_content', content: { results: fetchedFileResults } }
            }
          });
        }
      }

      if (toolResponses.length > 0) {
        conversationHistory.push({ role: 'tool', parts: toolResponses });
        console.log("GEMINI (Chat): Making second call with file contents...");
        apiResponseData = await makeGeminiApiCall(apiKey, conversationHistory, false); // No function calling for final answer
         if (!apiResponseData.candidates?.[0]?.content) {
          return { text: "Sorry, I couldn't get a final response from the AI after fetching files.", error: "No valid final AI chat response." };
        }
        currentAiContent = apiResponseData.candidates[0].content;
      }
    }
    
    let responseText = currentAiContent.parts?.map((p: GeminiMessagePart) => p.text).join("").trim() || "";
    if (!responseText) {
        return { text: "Sorry, I received an empty response from the AI.", error: "AI response was empty." };
    }
    return { text: responseText };

  } catch (error: any) {
    console.error("Error in getChatResponse:", error);
    return { text: `Sorry, an error occurred: ${error.message}`, error: error.message };
  }
}