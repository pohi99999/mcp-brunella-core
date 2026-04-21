import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import { Button } from '../../dashboard/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../dashboard/components/ui/card.js';
import { useAuth } from './useAuth.js';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(email, password);
    if (!result.ok) setError(result.error ?? 'Hiba');
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050816]">
      <Card className="w-full max-w-sm border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl font-black text-white">P-Sales</CardTitle>
          </div>
          <p className="text-xs text-zinc-500">
            Tesztkörnyezet — bejelentkezési adatok: admin@psales.dev / admin123
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-primary/40"
                placeholder="admin@psales.dev"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Jelszó</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-primary/40"
                required
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Bejelentkezés...' : 'Belépés'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
