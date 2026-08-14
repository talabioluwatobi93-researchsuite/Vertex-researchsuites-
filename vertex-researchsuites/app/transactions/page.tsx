'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Transaction = {
  id: string;
  reference: string;
  amount: number;
  status: string;
  created_at: string;
};

function formatFull(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('id, reference, amount, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) setTransactions(data);
      setLoading(false);
    };
    fetchTransactions();
  }, []);

  return (
    <div style={{ backgroundColor: '#F9F9F9', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <Link href="/dashboard" style={{ color: '#777777', fontSize: '14px', textDecoration: 'none' }}>
          ‹ Back to Dashboard
        </Link>
        <h1 style={{ color: '#333333', fontSize: '22px', fontWeight: 700, margin: '16px 0' }}>
          Transaction History
        </h1>

        {loading && <p style={{ color: '#777777', fontSize: '14px' }}>Loading...</p>}
        {!loading && transactions.length === 0 && (
          <p style={{ color: '#777777', fontSize: '14px' }}>No transactions yet.</p>
        )}

        {transactions.map((tx) => (
          <div
            key={tx.id}
            style={{
              background: '#FFFFFF',
              border: '1px solid #EEEEEE',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <div style={{ color: '#333333', fontSize: '15px', fontWeight: 600 }}>
                {'\u20A6'}{tx.amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#777777', fontSize: '12px', marginTop: '4px' }}>
                {formatFull(tx.created_at)}
              </div>
              <div style={{ color: '#AAAAAA', fontSize: '11px', marginTop: '2px' }}>
                Ref: {tx.reference}
              </div>
            </div>
            <div
              style={{
                color: tx.status === 'success' ? '#D4AF37' : tx.status === 'pending' ? '#E67E22' : '#777777',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'capitalize',
                background: tx.status === 'success' ? '#FBF3DD' : '#F0F0F0',
                padding: '4px 10px',
                borderRadius: '20px',
              }}
            >
              {tx.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
