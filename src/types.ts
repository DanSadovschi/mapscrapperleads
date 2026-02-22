export interface Lead {
  businessName: string;
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  description?: string;
  /** Optional custom instruction for post generation */
  customPrompt?: string;
}

export interface PostResult {
  success: boolean;
  lead: string;
  content?: string;
  postId?: string;
  error?: string;
}

export interface LinkedInConfig {
  accessToken: string;
  /** urn:li:person:{id}  OR  urn:li:organization:{id} */
  authorUrn: string;
}

export interface AgentOptions {
  dryRun?: boolean;
  verbose?: boolean;
}
