import { NextResponse } from 'next/server';
import {
    fetchRepository,
    fetchRepositoryContents,
    fetchLanguages,
    fetchContributors,
    Repository,
    RepositoryContent,
    Language as GithubLanguage,
    Contributor as GithubContributor
} from '@/lib/github';
import { getChatResponse, GeminiResponse } from '@/lib/gemini';

interface ClientMessage {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
}

interface GeminiMessageForApi {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface ChatRequestPayload {
  owner: string;
  repoName: string;
  question: string;
  chatHistory: ClientMessage[];
}

function transformClientHistoryToGemini(clientHistory: ClientMessage[]): GeminiMessageForApi[] {
  return clientHistory.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
}

export const runtime = 'edge';

export async function POST(request: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { 
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const payload = await request.json() as ChatRequestPayload;
    const { owner, repoName, question, chatHistory } = payload;

    if (!owner || !repoName || !question) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing owner, repoName, or question' }),
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    let repoData: Repository;
    let contents: RepositoryContent[];
    let languages: GithubLanguage[];
    let contributors: GithubContributor[];

    try {
      [repoData, contents, languages, contributors] = await Promise.all([
        fetchRepository(owner, repoName),
        fetchRepositoryContents(owner, repoName, ''),
        fetchLanguages(owner, repoName),
        fetchContributors(owner, repoName)
      ]);
    } catch (githubError: any) {
      console.error("API Route: Error fetching GitHub data:", githubError);
      return new NextResponse(
        JSON.stringify({
          answer: `I encountered an issue fetching data for ${owner}/${repoName} from GitHub: ${githubError.message}. Please ensure the repository exists and is accessible.`,
          error: `GitHub fetch error: ${githubError.message}`
        }),
        { 
          status: 500,
          headers: corsHeaders
        }
      );
    }
    
    const geminiCompatibleHistory = transformClientHistoryToGemini(chatHistory || []);

    const geminiResult: GeminiResponse = await getChatResponse(
      repoData,
      contents,
      languages,
      contributors,
      question,
      geminiCompatibleHistory
    );

    if (geminiResult.error && geminiResult.text) {
      return new NextResponse(
        JSON.stringify({ answer: geminiResult.text, error: geminiResult.error }),
        { 
          status: 200,
          headers: corsHeaders
        }
      );
    }

    if (geminiResult.error) {
      return new NextResponse(
        JSON.stringify({ answer: "An error occurred with the AI assistant.", error: geminiResult.error }),
        { 
          status: 500,
          headers: corsHeaders
        }
      );
    }

    return new NextResponse(
      JSON.stringify({ answer: geminiResult.text }),
      { 
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (error: any) {
    console.error('API chat route general error:', error);
    return new NextResponse(
      JSON.stringify({
        answer: `An internal server error occurred: ${error.message}`,
        error: `Internal server error: ${error.message}`
      }),
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}