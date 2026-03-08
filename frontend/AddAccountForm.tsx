'use client';

import { FormEvent, useState } from 'react';
import { AtSign, Loader2, Plus, UserPlus, X } from 'lucide-react';
import type { AccountMetrics } from '@lib/types';

interface AddAccountFormProps {
  onAccountAdded: (account: AccountMetrics) => void;
  onError: (message: string | null) => void;
}

export function AddAccountForm({ onAccountAdded, onError }: AddAccountFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedUsername = username.trim().replace(/^@+/, '');
    if (!normalizedUsername) {
      onError('Enter an Instagram username.');
      return;
    }

    setIsLoading(true);
    onError(null);

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          username: normalizedUsername,
        }),
      });

      const payload = (await response.json()) as {
        account?: AccountMetrics;
        error?: string;
      };

      if (!response.ok || !payload.account) {
        throw new Error(payload.error ?? 'Unable to add that Instagram username.');
      }

      onAccountAdded(payload.account);
      setUsername('');
      setIsOpen(false);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to add account.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        id="add-account-trigger"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-10 right-10 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-black shadow-[0_0_30px_rgba(13,204,242,0.3)] transition-all hover:scale-110 hover:bg-primary-hover active:scale-95"
      >
        <Plus size={32} />
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-panel fixed bottom-10 right-10 z-40 w-96 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-bottom-10"
    >
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-2xl font-black uppercase tracking-tight text-white">Add Account</h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-full p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm leading-relaxed text-white/70">
        <div className="mb-2 flex items-center gap-2 font-bold text-primary">
          <UserPlus size={18} />
          <span className="uppercase tracking-widest text-[10px]">Architectural Sync</span>
        </div>
        Username-based account tracking. We'll build a skyscraper based on your profile metrics in realtime.
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-3">
            Instagram Username
          </label>
          <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 transition-focus-within:border-primary/50">
            <AtSign size={18} className="text-primary/50" />
            <input
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full bg-transparent px-3 py-4 text-lg font-medium text-white outline-none placeholder:text-white/20"
              disabled={isLoading}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. zuck"
              spellCheck={false}
              value={username}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center rounded-2xl bg-primary py-4 text-lg font-black uppercase tracking-widest text-black transition-all hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 size={24} className="animate-spin" /> : 'Begin' }
        </button>
      </div>
    </form>
  );
}
