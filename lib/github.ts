// lib/github.ts

export interface Repository {
  name: string; // Short name, e.g., 'my-repo'
  full_name: string; // e.g., 'owner/my-repo'
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  html_url: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  language: string; // Primary language
  updated_at: string;
  topics: string[];
  default_branch: string;
  license?: {
    name: string;
  };
  open_issues_count: number;
}

export interface RepositoryContent {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
  html_url: string;
  download_url: string | null;
  // For base64 encoded content directly from API
  content?: string;
  encoding?: 'base64';
}

export interface Contributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

export interface Language {
  name: string;
  percentage: number;
  color: string;
}

const languageColors: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Python: "#3572A5",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#ffac45",
  Go: "#00ADD8",
  Rust: "#dea584",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Shell: "#89e051",
  Lua: "#000080",
  "Objective-C": "#438eff",
  // Add more as needed
  Other: "#8B8B8B", // Default for unknown/other
};

async function githubFetch(url: string, errorMessagePrefix: string) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    console.warn("GITHUB_TOKEN is not set. API calls might be rate-limited or fail for private repos.");
  }

  const response = await fetch(url, {
    headers: {
      ...(GITHUB_TOKEN && { Authorization: `Bearer ${GITHUB_TOKEN}` }),
      Accept: 'application/vnd.github.v3+json',
    },
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!response.ok) {
    let errorBody = 'Could not read error body.';
    try {
        errorBody = await response.text();
    } catch (e) { /* ignore */ }
    console.error(`${errorMessagePrefix}: ${response.status} ${response.statusText}`, errorBody);
    throw new Error(`${errorMessagePrefix}: ${response.statusText}`);
  }
  return response.json();
}


export async function fetchRepository(owner: string, repo: string): Promise<Repository> {
  return githubFetch(`https://api.github.com/repos/${owner}/${repo}`, 'Failed to fetch repository');
}

export async function fetchRepositoryContents(owner: string, repo: string, path = ''): Promise<RepositoryContent[]> {
  return githubFetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, `Failed to fetch repository contents for path "${path}"`);
}

export async function fetchContributors(owner: string, repo: string): Promise<Contributor[]> {
  // Fetch more contributors for better context, e.g., top 20. Capped at 100 by default by GitHub if no per_page.
  return githubFetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=20`, 'Failed to fetch contributors');
}

export async function fetchLanguages(owner: string, repo: string): Promise<Language[]> {
  const data = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/languages`, 'Failed to fetch languages');
  
  const total = Object.values(data).reduce((sum, bytes) => sum + (bytes as number), 0);

  if (total === 0) return [{ name: "N/A", percentage: 100, color: languageColors.Other }];

  return Object.entries(data)
    .map(([name, bytes]) => ({
      name,
      percentage: Math.round(((bytes as number) / total) * 100),
      color: languageColors[name] || languageColors.Other,
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .filter(lang => lang.percentage > 0); // Only include languages with some percentage
}

export async function fetchFileContent(owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const headers: HeadersInit = {
        Accept: 'application/vnd.github.v3.raw', // Try to get raw content directly
    };
    if (GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }

    // Attempt 1: Fetch raw content (often works for public and private with token)
    let response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers,
      next: { revalidate: 3600 },
    });

    if (response.ok) {
        const contentType = response.headers.get('content-type');
        // Check if it's likely text-based. GitHub might return octet-stream for binaries even with .raw.
        if (contentType && (contentType.includes('text') || contentType.includes('json') || contentType.includes('javascript'))) {
            return await response.text();
        }
        // If it's not clearly text, it might be binary, or we got metadata instead of raw.
        // Fall through to metadata check.
    }

    // Attempt 2: Fetch metadata to check size, type, and use download_url or base64 content
    // This is more reliable for determining if we should even try.
    const metadataHeaders: HeadersInit = {
        Accept: 'application/vnd.github.v3+json',
    };
    if (GITHUB_TOKEN) {
        metadataHeaders['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }

    response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers: metadataHeaders,
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.error(`Failed to fetch file metadata for ${path}: ${response.status} ${response.statusText}`);
      return `// Error: Could not fetch metadata for file ${path}. Status: ${response.status}`;
    }

    const fileData: RepositoryContent = await response.json();

    if (fileData.type !== 'file') {
      console.warn(`${path} is not a file, it's a ${fileData.type}.`);
      return `// Info: Path ${path} is a ${fileData.type}, not a file. Cannot fetch content.`;
    }

    if (fileData.size === 0) {
        return `// Info: File ${path} is empty.`;
    }

    const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
    if (fileData.size > MAX_FILE_SIZE_BYTES) {
        console.warn(`File ${path} is too large (${fileData.size} bytes).`);
        return `// Info: File content for ${path} is too large (${fileData.size} bytes / ${MAX_FILE_SIZE_BYTES} limit) to display.`;
    }
    
    if (fileData.encoding === 'base64' && fileData.content) {
        if (typeof Buffer !== 'undefined') { // Node.js
            return Buffer.from(fileData.content, 'base64').toString('utf-8');
        } else if (typeof atob !== 'undefined') { // Browser (less likely server-side)
            return atob(fileData.content);
        } else {
            return `// Error: No base64 decoding method (Buffer/atob) for ${path}.`;
        }
    } else if (fileData.download_url) {
        // download_url might not need auth for public, but good to include if available
        const contentResponse = await fetch(fileData.download_url, { headers: GITHUB_TOKEN ? { 'Authorization': `Bearer ${GITHUB_TOKEN}` } : {} });
        if (!contentResponse.ok) {
            console.error(`Failed to download file content for ${path} from ${fileData.download_url}: ${contentResponse.statusText}`);
            return `// Error: Could not download file content for ${path}. Status: ${contentResponse.status}`;
        }
        return await contentResponse.text();
    } else {
        return `// Info: Could not retrieve content for ${path}. No direct content or download_url. Type: ${fileData.type}, Size: ${fileData.size}`;
    }

  } catch (error) {
    console.error(`Unhandled error fetching file content for ${path}:`, error);
    return `// Error: Exception occurred while fetching content for ${path}.`;
  }
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch (e) {
    return "Invalid Date";
  }
}