import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import RepoCard from "@/components/RepoCard";
import SummaryCard from "@/components/SummaryCard";
import ChatWindow from "@/components/ChatWindow";
import { fetchRepository, fetchRepositoryContents, fetchContributors, fetchLanguages } from "@/lib/github";
import { generateRepoSummary } from "@/lib/gemini";

interface DashboardPageProps {
  searchParams: { repo?: string };
}

export default function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const repoParam = searchParams.repo;
  
  if (!repoParam) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-3xl font-bold">GitHub Repository Analysis</h1>
          <p className="text-muted-foreground">
            Enter a GitHub repository URL on the home page to analyze it with AI.
          </p>
        </div>
      </div>
    );
  }
  
  // Extract owner and repo name from the parameter
  const [owner, repo] = repoParam.split('/');
  
  if (!owner || !repo) {
    notFound();
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">
        Repository Analysis: <span className="text-primary">{owner}/{repo}</span>
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Suspense fallback={<RepositorySkeleton />}>
          <RepositorySection owner={owner} repo={repo} />
        </Suspense>
        
        <Suspense fallback={<SummarySkeleton />}>
          <SummarySection owner={owner} repo={repo} />
        </Suspense>
        
        <div>
          <ChatWindow />
        </div>
      </div>
    </div>
  );
}

async function RepositorySection({ owner, repo }: { owner: string; repo: string }) {
  try {
    const [repository, contents, contributors, languages] = await Promise.all([
      fetchRepository(owner, repo),
      fetchRepositoryContents(owner, repo),
      fetchContributors(owner, repo),
      fetchLanguages(owner, repo),
    ]);
    
    return <RepoCard repository={repository} contents={contents} contributors={contributors} languages={languages} />;
  } catch (error) {
    return (
      <div className="bg-destructive/10 p-6 rounded-lg border border-destructive text-destructive">
        <h3 className="font-bold mb-2">Error Fetching Repository</h3>
        <p className="text-sm">
          {error instanceof Error ? error.message : "Failed to load repository data"}
        </p>
      </div>
    );
  }
}

async function SummarySection({ owner, repo }: { owner: string; repo: string }) {
  try {
    const [repository, contents, languages, contributors] = await Promise.all([
      fetchRepository(owner, repo),
      fetchRepositoryContents(owner, repo),
      fetchLanguages(owner, repo),
      fetchContributors(owner, repo),
    ]);
    
    const summary = await generateRepoSummary(repository, contents, languages, contributors);
    
    return <SummaryCard summary={summary} />;
  } catch (error) {
    return (
      <div className="bg-destructive/10 p-6 rounded-lg border border-destructive text-destructive">
        <h3 className="font-bold mb-2">Error Generating Summary</h3>
        <p className="text-sm">
          {error instanceof Error ? error.message : "Failed to generate repository summary"}
        </p>
      </div>
    );
  }
}

function RepositorySkeleton() {
  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="space-y-2 pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}