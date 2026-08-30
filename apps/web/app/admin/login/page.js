'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();

  const [e, setE] = useState('');
  const [p, setP] = useState('');
  const [error, setError] = useState('');

  async function go(x) {
    x.preventDefault();

    const q = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: e,
          password: p,
        }),
      }
    );

    if (q.ok) {
      router.push('/admin');
    } else {
      setError('Invalid email or password.');
    }
  }

  return (
    <main className="login">
      <form className="card fields" onSubmit={go}>
        <p className="eyebrow">Homes by Gurmeet</p>
        <h1>Admin Sign In</h1>

        <input
          type="email"
          placeholder="Email"
          value={e}
          onChange={(x) => setE(x.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={p}
          onChange={(x) => setP(x.target.value)}
        />

        <button className="btn">Sign in</button>

        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
