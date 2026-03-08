import { AccountMetrics } from '@lib/types';

interface TooltipProps {
  visible: boolean;
  x: number;
  y: number;
  account: AccountMetrics | null;
}

export function Tooltip({ visible, x, y, account }: TooltipProps) {
  if (!visible || !account) return null;

  return (
    <div 
      className="fixed z-50 pointer-events-none bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-lg border border-white/10 shadow-xl"
      style={{ left: x + 15, top: y + 15 }}
    >
      <div className="font-bold">{account.username}</div>
      <div className="text-sm text-gray-300">
        {account.followers.toLocaleString()} followers
      </div>
      <div className="text-sm text-gray-400">
        {account.following.toLocaleString()} following
      </div>
    </div>
  );
}
