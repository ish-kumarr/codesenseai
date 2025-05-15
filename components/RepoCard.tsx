import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  GitForkIcon,
  StarIcon,
  CalendarIcon,
  CircleIcon,
  GlobeIcon,
  BookIcon,
  AlertCircleIcon,
  UsersIcon,
  FileIcon,
  FolderIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Repository, 
  Contributor, 
  RepositoryContent,
  Language,
  formatDate
} from "@/lib/github";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

interface RepoCardProps {
  repository: Repository;
  contents: RepositoryContent[];
  contributors: Contributor[];
  languages: Language[];
}

export default function RepoCard({ repository, contents, contributors, languages }: RepoCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <CardTitle className="text-xl font-bold">
              <Link href={repository.html_url} className="hover:underline" target="_blank">
                {repository.name}
              </Link>
            </CardTitle>
            <CardDescription className="line-clamp-2 mt-1">
              {repository.description || "No description provided"}
            </CardDescription>
          </div>
          <Avatar className="h-10 w-10">
            <AvatarImage src={repository.owner.avatar_url} alt={repository.owner.login} />
            <AvatarFallback>{repository.owner.login.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-3">
          {repository.topics.slice(0, 5).map((topic) => (
            <Badge key={topic} variant="secondary" className="text-xs">
              {topic}
            </Badge>
          ))}
          {repository.topics.length > 5 && (
            <Badge variant="outline" className="text-xs">
              +{repository.topics.length - 5} more
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <StarIcon className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">{repository.stargazers_count.toLocaleString()} stars</span>
          </div>
          <div className="flex items-center gap-2">
            <GitForkIcon className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">{repository.forks_count.toLocaleString()} forks</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">Updated {formatDate(repository.updated_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">{repository.open_issues_count.toLocaleString()} issues</span>
          </div>
        </div>

        <Separator />
        
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <CircleIcon className="h-3 w-3 fill-current" /> Languages
          </h3>
          <div className="space-y-2">
            {languages.slice(0, 4).map((language) => (
              <div key={language.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{language.name}</span>
                  <span>{language.percentage}%</span>
                </div>
                <Progress value={language.percentage} className="h-1.5" style={{
                  backgroundColor: 'rgba(var(--muted), 0.2)',
                  '& > div': { backgroundColor: language.color }
                }} />
              </div>
            ))}
          </div>
        </div>
        
        <Separator />
        
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <FolderIcon className="h-3 w-3" /> Repository Structure
          </h3>
          <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-2">
            {contents.map((item) => (
              <Link 
                key={item.path}
                href={item.html_url} 
                target="_blank"
                className="flex items-center gap-2 text-sm p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                {item.type === "dir" ? (
                  <FolderIcon className="h-4 w-4 text-blue-500" />
                ) : (
                  <FileIcon className="h-4 w-4 text-gray-500" />
                )}
                <span className="truncate">{item.name}</span>
              </Link>
            ))}
          </div>
        </div>
        
        <Separator />
        
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <UsersIcon className="h-3 w-3" /> Top Contributors
          </h3>
          <div className="flex flex-wrap gap-2">
            {contributors.slice(0, 8).map((contributor) => (
              <Link 
                key={contributor.login} 
                href={contributor.html_url}
                target="_blank"
                className="group"
              >
                <Avatar className="h-8 w-8 ring-2 ring-background group-hover:ring-primary transition-all">
                  <AvatarImage src={contributor.avatar_url} alt={contributor.login} />
                  <AvatarFallback>{contributor.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                  <span className="sr-only">{contributor.login}</span>
                </Avatar>
              </Link>
            ))}
            {contributors.length > 8 && (
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs">
                +{contributors.length - 8}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}