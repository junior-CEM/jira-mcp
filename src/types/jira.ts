export interface CleanComment {
  id: string;
  body: string;
  author: string | undefined;
  created: string;
  updated: string;
  mentions: NonNullable<CleanJiraIssue["relatedIssues"]>;
}

export interface CleanJiraIssue {
  id: string;
  key: string;
  summary: string | undefined;
  status: string | undefined;
  created: string | undefined;
  updated: string | undefined;
  description: string;
  storyPoints?: number | null;
  comments?: CleanComment[];
  parent?: {
    id: string;
    key: string;
    summary?: string;
  };
  children?: {
    id: string;
    key: string;
    summary?: string;
  }[];
  epicLink?: {
    id: string;
    key: string;
    summary?: string;
  };
  relatedIssues: {
    key: string;
    summary?: string;
    type: "mention" | "link";
    relationship?: string; // For formal issue links e.g. "blocks", "relates to"
    source: "description" | "comment";
    commentId?: string;
  }[];
}

export interface SearchIssuesResponse {
  total: number;
  issues: CleanJiraIssue[];
}

// Basic Atlassian Document Format (ADF) structure for a simple paragraph
export interface AdfDoc {
  version: 1;
  type: "doc";
  content: AdfNode[];
}

export type AdfNodeType = "paragraph" | "text"; // Add other types as needed

export interface AdfNode {
  type: AdfNodeType;
  content?: AdfNode[];
  text?: string;
}

// Response structure from JIRA API after adding a comment
export interface JiraCommentResponse {
  id: string;
  self: string; // URL to the comment
  author: {
    displayName: string;
    // ... other author details
  };
  body: AdfDoc; // JIRA returns the comment body in ADF
  created: string;
  updated: string;
  // ... other fields
}

// Cleaned response for the MCP tool
export interface AddCommentResponse {
  id: string;
  author: string;
  created: string;
  updated: string;
  body: string; // Return plain text for simplicity
}
