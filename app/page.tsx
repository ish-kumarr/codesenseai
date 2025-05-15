'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CodeIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-16 bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-3xl w-full text-center space-y-8">
        <div className="space-y-2">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-2xl bg-primary flex items-center justify-center">
              <CodeIcon className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            <span className="block">
              <span className="text-primary">Code</span>Sense
            </span>
          </h1>
          <p className="text-xl text-muted-foreground md:text-2xl">
            AI-powered GitHub repository analysis and code insights
          </p>
        </div>

        <Card className="border-2 border-muted/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="py-6">
            <form 
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const repo = formData.get('repo') as string;
                if (!repo) return;
                
                // Extract owner/repo from different formats
                let repoPath = repo;
                if (repo.includes('github.com/')) {
                  repoPath = repo.split('github.com/')[1];
                }
                // Remove trailing slashes, .git, etc.
                repoPath = repoPath.replace(/\.git\/?$/, '').replace(/\/$/, '');
                
                router.push(`/dashboard?repo=${repoPath}`);
              }}
            >
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Enter a GitHub repository URL or path</p>
                <Input 
                  name="repo"
                  placeholder="e.g., vercel/next.js or https://github.com/vercel/next.js"
                  className="text-lg h-12" 
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 text-lg"
              >
                Analyze Repository
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col items-center p-4 rounded-lg border bg-card/80">
            <div className="p-2 rounded-full bg-primary/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line></svg>
            </div>
            <h3 className="mt-3 text-lg font-medium">Repository Metadata</h3>
            <p className="text-sm text-muted-foreground text-center">Get detailed insights about stars, forks, contributors and more</p>
          </div>
          
          <div className="flex flex-col items-center p-4 rounded-lg border bg-card/80">
            <div className="p-2 rounded-full bg-primary/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1"></path><path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1"></path></svg>
            </div>
            <h3 className="mt-3 text-lg font-medium">AI Code Summary</h3>
            <p className="text-sm text-muted-foreground text-center">Understand the codebase structure and purpose through AI analysis</p>
          </div>
          
          <div className="flex flex-col items-center p-4 rounded-lg border bg-card/80">
            <div className="p-2 rounded-full bg-primary/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"></path><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"></path></svg>
            </div>
            <h3 className="mt-3 text-lg font-medium">Interactive Q&A</h3>
            <p className="text-sm text-muted-foreground text-center">Ask questions about the repository and get AI-powered answers</p>
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <Button asChild variant="outline">
            <Link href="/dashboard?repo=vercel/next.js">
              Try with an example repository
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}