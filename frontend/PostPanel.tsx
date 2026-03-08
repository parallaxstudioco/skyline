/* eslint-disable @next/next/no-img-element */
import {
  Bookmark,
  Calendar,
  Eye,
  ExternalLink,
  Film,
  Heart,
  Image as ImageIcon,
  Layers,
  MessageCircle,
  Share2,
  X,
} from 'lucide-react';
import { buildInstagramMediaProxyUrl } from '@lib/instagramMedia';
import { AccountMetrics, CarouselMediaData, CommentData, PostData } from '@lib/types';

interface SelectedPost {
  account: AccountMetrics;
  floorIndex: number;
  post: PostData;
}

interface PostPanelProps {
  selection: SelectedPost | null;
  onClose: () => void;
}

function formatMetric(value: number | null): string {
  return value === null ? 'Unavailable' : value.toLocaleString();
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Unknown date';
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return timestamp.toLocaleString();
}

function getMediaTypeLabel(post: PostData): string {
  if (post.mediaType === 'CAROUSEL_ALBUM') {
    return 'Carousel';
  }

  if (post.mediaType === 'VIDEO') {
    return post.mediaProductType === 'REELS' ? 'Reel' : 'Video';
  }

  if (post.mediaType === 'IMAGE') {
    return 'Photo';
  }

  return post.mediaType ?? 'Post';
}

function renderMediaAsset(
  asset: {
    mediaType: string | null;
    mediaUrl: string | null;
    thumbnailUrl: string | null;
  },
  key: string
) {
  const previewUrl = asset.mediaUrl ?? asset.thumbnailUrl;
  const proxiedPreviewUrl = buildInstagramMediaProxyUrl(previewUrl);
  const proxiedPosterUrl = buildInstagramMediaProxyUrl(asset.thumbnailUrl);

  if (!previewUrl) {
    return (
      <div
        key={key}
        className="flex aspect-square items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-gray-500"
      >
        Media unavailable
      </div>
    );
  }

  if (asset.mediaType === 'VIDEO') {
    return (
      <video
        key={key}
        className="aspect-square w-full rounded-2xl border border-white/10 bg-black object-cover"
        controls
        playsInline
        preload="metadata"
        poster={proxiedPosterUrl ?? asset.thumbnailUrl ?? undefined}
        src={asset.mediaUrl ?? undefined}
      />
    );
  }

  return (
    <img
      key={key}
      alt=""
      className="aspect-square w-full rounded-2xl border border-white/10 bg-white/5 object-cover"
      referrerPolicy="no-referrer"
      src={proxiedPreviewUrl ?? previewUrl}
    />
  );
}

function MediaPreview({ post }: { post: PostData }) {
  if (post.carouselChildren.length > 0) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {post.carouselChildren.map((child: CarouselMediaData) =>
          renderMediaAsset(child, child.id)
        )}
      </div>
    );
  }

  return renderMediaAsset(
    {
      mediaType: post.mediaType,
      mediaUrl: post.mediaUrl,
      thumbnailUrl: post.thumbnailUrl,
    },
    post.id
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function CommentRow({ comment }: { comment: CommentData }) {
  const canOpen = Boolean(comment.url);

  const content = (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-blue-400/30 hover:bg-blue-400/5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="truncate text-sm font-semibold text-white">
          {comment.username ? `@${comment.username}` : 'Comment'}
        </div>
        <div className="flex items-center gap-1 text-xs text-amber-300">
          <Heart size={12} />
          <span>{comment.likeCount.toLocaleString()}</span>
        </div>
      </div>
      <div className="text-sm leading-6 text-gray-300">
        {comment.text ?? 'Comment text is unavailable from the current Instagram response.'}
      </div>
    </div>
  );

  if (!canOpen) {
    return content;
  }

  return (
    <a href={comment.url ?? undefined} rel="noreferrer" target="_blank">
      {content}
    </a>
  );
}

export function PostPanel({ selection, onClose }: PostPanelProps) {
  if (!selection) {
    return null;
  }

  const { account, floorIndex, post } = selection;
  const mediaLabel = getMediaTypeLabel(post);
  const visibleComments = post.comments.slice(0, 60);
  const hasHiddenComments = post.comments.length > visibleComments.length;

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-full w-full max-w-[440px] flex-col border-l border-white/10 bg-black/95 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">
            @{account.username}
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {mediaLabel} on Floor {floorIndex + 1}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <div className="space-y-4">
          <MediaPreview post={post} />

          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.25em] text-gray-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              {post.mediaType === 'VIDEO' ? <Film size={14} /> : <ImageIcon size={14} />}
              {mediaLabel}
            </span>
            {post.mediaProductType && (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <Layers size={14} />
                {post.mediaProductType}
              </span>
            )}
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <Calendar size={14} />
              {formatTimestamp(post.timestamp)}
            </span>
          </div>

          {post.permalink && (
            <a
              className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-200 transition-colors hover:bg-blue-500/20"
              href={post.permalink}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink size={16} />
              Open post on Instagram
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard icon={<Eye size={14} />} label="Views" value={formatMetric(post.views)} />
          <MetricCard icon={<Heart size={14} />} label="Likes" value={post.likeCount.toLocaleString()} />
          <MetricCard
            icon={<MessageCircle size={14} />}
            label="Comments"
            value={post.commentsCount.toLocaleString()}
          />
          <MetricCard icon={<Share2 size={14} />} label="Shares" value={formatMetric(post.shares)} />
          <MetricCard icon={<Bookmark size={14} />} label="Saves" value={formatMetric(post.saves)} />
          <MetricCard icon={<Layers size={14} />} label="Reach" value={formatMetric(post.reach)} />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">
            Caption
          </div>
          <div className="whitespace-pre-wrap text-sm leading-7 text-gray-200">
            {post.caption ?? 'No caption was available from the current Instagram response.'}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">
              Comment Targets
            </div>
            <div className="text-xs text-gray-500">
              Clicking a lit window opens the post or comment target available for this media.
            </div>
          </div>

          <div className="space-y-3">
            {post.comments.length > 0 ? (
              <>
                {visibleComments.map((comment) => (
                  <CommentRow key={comment.id} comment={comment} />
                ))}
                {hasHiddenComments && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400">
                    Showing the first {visibleComments.length.toLocaleString()} comment targets
                    for this post.
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400">
                No comment records were returned for this post.
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
