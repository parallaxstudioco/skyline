import { X, Users, Image as ImageIcon, Heart } from 'lucide-react';
import { AccountMetrics } from '@lib/types';

interface AccountPanelProps {
  account: AccountMetrics | null;
  onClose: () => void;
}

export function AccountPanel({ account, onClose }: AccountPanelProps) {
  if (!account) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-black/95 border-l border-white/10 text-white p-6 shadow-2xl backdrop-blur-xl transition-transform transform translate-x-0">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold tracking-tight">@{account.username}</h2>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
          <div className="flex items-center text-gray-400 mb-2">
            <Users size={16} className="mr-2" />
            <span className="text-sm uppercase tracking-wider font-semibold">Followers</span>
          </div>
          <div className="text-3xl font-light">
            {account.followers.toLocaleString()}
          </div>
        </div>

        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
          <div className="flex items-center text-gray-400 mb-2">
            <Users size={16} className="mr-2" />
            <span className="text-sm uppercase tracking-wider font-semibold">Following</span>
          </div>
          <div className="text-3xl font-light">
            {account.following.toLocaleString()}
          </div>
        </div>

        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
          <div className="flex items-center text-gray-400 mb-2">
            <Heart size={16} className="mr-2" />
            <span className="text-sm uppercase tracking-wider font-semibold">Avg Likes</span>
          </div>
          <div className="text-3xl font-light">
            {account.avgLikes.toLocaleString()}
          </div>
        </div>

        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
          <div className="flex items-center text-gray-400 mb-2">
            <ImageIcon size={16} className="mr-2" />
            <span className="text-sm uppercase tracking-wider font-semibold">Posts</span>
          </div>
          <div className="text-3xl font-light">
            {account.posts.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
