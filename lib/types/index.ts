export interface CommentData {
  id: string;
  text: string | null;
  username: string | null;
  timestamp: string | null;
  likeCount: number;
  url: string | null;
}

export interface CarouselMediaData {
  id: string;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
}

export interface PostData {
  id: string;
  caption: string | null;
  commentsCount: number;
  comments: CommentData[];
  commentLikeCounts: number[];
  maxCommentLikeCount: number; // Likes on the most-liked comment (0 if unknown)
  likeCount: number;
  mediaProductType: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
  views: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  carouselChildren: CarouselMediaData[];
}

export interface AccountMetrics {
  accountKey: string;
  username: string;
  followers: number;
  following: number;
  posts: number;
  avgLikes: number;
  cachedAt: string;
  engagementSummary: {
    sampledPosts: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    views: number | null; // Changed from number to number | null
  };
  postsData: PostData[]; // Per-post data, one entry per floor
  isPending?: boolean; // Optional flag for background loading state
}

export interface SessionLocation {
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  source: 'edge-headers' | 'ip-geolocation';
}
