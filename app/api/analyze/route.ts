import { NextRequest, NextResponse } from "next/server";
import { fetchRepository, fetchRepositoryContents, fetchContributors, fetchLanguages } from "@/lib/github";
import { generateRepoSummary } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Missing required parameters: owner and repo" },
        { status: 400 }
      );
    }

    // Fetch all data in parallel
    const [repository, contents, contributors, languages] = await Promise.all([
      fetchRepository(owner, repo),
      fetchRepositoryContents(owner, repo),
      fetchContributors(owner, repo),
      fetchLanguages(owner, repo),
    ]);

    // Generate AI summary
    const summary = await generateRepoSummary(
      repository,
      contents,
      languages,
      contributors
    );

    return NextResponse.json({
      repository,
      contents,
      contributors,
      languages,
      summary,
    });
  } catch (error) {
    console.error("Error analyzing repository:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to analyze repository", 
        message: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}