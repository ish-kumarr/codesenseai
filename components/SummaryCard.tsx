'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Lightbulb, SparklesIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import { GeminiResponse } from "@/lib/gemini";

interface SummaryCardProps {
  summary: GeminiResponse | null;
  isLoading?: boolean;
}

export default function SummaryCard({ summary, isLoading = false }: SummaryCardProps) {
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/5 dark:to-purple-500/5">
        <div className="flex items-center gap-2 mb-1">
          <SparklesIcon className="h-5 w-5 text-indigo-500" />
          <CardTitle>AI Analysis</CardTitle>
        </div>
        <CardDescription>
          AI-generated summary of the repository structure and purpose
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6 overflow-y-auto max-h-[calc(100vh-14rem)]">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[80%]" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-4 w-[90%]" />
          </div>
        ) : summary?.error ? (
          <Alert className="mb-4" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error generating summary</AlertTitle>
            <AlertDescription>
              {summary.error}. Showing a basic summary instead.
            </AlertDescription>
          </Alert>
        ) : null}

        {summary && !isLoading && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>
              {summary.text}
            </ReactMarkdown>
          </div>
        )}

        {!summary && !isLoading && (
          <Alert className="mb-4" variant="default">
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>No summary available</AlertTitle>
            <AlertDescription>
              Enter a GitHub repository URL on the home page to generate an AI analysis.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}