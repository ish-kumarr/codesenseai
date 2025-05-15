// app/api/chat/route.ts
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

// Client-side message format
interface ClientMessage {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date; // Or string if you serialize it
}

// Gemini's expected message format for history
interface GeminiMessageForApi {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface ChatRequestPayload {
  owner: string;
  repoName: string; // Short name like 'my-repo'
  question: string;
  chatHistory: ClientMessage[];
}

function transformClientHistoryToGemini(clientHistory: ClientMessage[]): GeminiMessageForApi[] {
  return clientHistory.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ChatRequestPayload;
    const { owner, repoName, question, chatHistory } = payload;

    if (!owner || !repoName || !question) {
      return NextResponse.json({ error: 'Missing owner, repoName, or question' }, { status: 400 });
    }

    // Fetch all necessary GitHub data
    // These are cached by Next.js fetch (revalidate: 3600 in lib/github.ts)
    let repoData: Repository;
    let contents: RepositoryContent[];
    let languages: GithubLanguage[];
    let contributors: GithubContributor[];

    try {
      // Parallelize GitHub data fetching
      [repoData, contents, languages, contributors] = await Promise.all([
        fetchRepository(owner, repoName),
        fetchRepositoryContents(owner, repoName, ''), // Root contents
        fetchLanguages(owner, repoName),
        fetchContributors(owner, repoName)
      ]);
    } catch (githubError: any) {
      console.error("API Route: Error fetching GitHub data:", githubError);
      return NextResponse.json({ 
        answer: `I encountered an issue fetching data for ${owner}/${repoName} from GitHub: ${githubError.message}. Please ensure the repository exists and is accessible.`,
        error: `GitHub fetch error: ${githubError.message}` 
      }, { status: 500 });
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

    // If Gemini itself had an error but provided some text (e.g. its own error message)
    if (geminiResult.error && geminiResult.text) {
        return NextResponse.json({ answer: geminiResult.text, error: geminiResult.error }, { status: 200 });
    }
    // If Gemini had an error and no text
    if (geminiResult.error) {
        return NextResponse.json({ answer: "An error occurred with the AI assistant.", error: geminiResult.error }, { status: 500 });
    }

    return NextResponse.json({ answer: geminiResult.text });

  } catch (error: any) {
    console.error('API chat route general error:', error);
    return NextResponse.json({ 
        answer: `An internal server error occurred: ${error.message}`,
        error: `Internal server error: ${error.message}` 
    }, { status: 500 });
  }
}