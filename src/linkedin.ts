import type { LinkedInConfig } from "./types.js";

const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";

interface UgcPostPayload {
  author: string;
  lifecycleState: "PUBLISHED";
  specificContent: {
    "com.linkedin.ugc.ShareContent": {
      shareCommentary: { text: string };
      shareMediaCategory: "NONE";
    };
  };
  visibility: {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC";
  };
}

export interface LinkedInPostResponse {
  id: string;
}

export async function publishToLinkedIn(
  config: LinkedInConfig,
  content: string
): Promise<LinkedInPostResponse> {
  const payload: UgcPostPayload = {
    author: config.authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: content },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const response = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `LinkedIn API error [${response.status}]: ${errorBody}`
    );
  }

  const result = (await response.json()) as { id: string };
  return { id: result.id };
}

/** Retrieve the authenticated member's profile URN */
export async function getMyProfileUrn(accessToken: string): Promise<string> {
  const response = await fetch(`${LINKEDIN_API_BASE}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `LinkedIn /me error [${response.status}]: ${errorBody}`
    );
  }

  const data = (await response.json()) as { id: string };
  return `urn:li:person:${data.id}`;
}
