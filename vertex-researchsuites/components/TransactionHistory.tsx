'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

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

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('id, reference, amount, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setTransactions(data);
      }
      setLoading(false);
    };

    fetchTransactions();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '16px', color: '#777777', fontSize: '14px' }}>
        Loading transactions...
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div style={{ padding: '16px', color: '#777777', fontSize: '14px' }}>
        No transactions yet.
      </div>
    );
  }

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #EEEEEE',
      borderRadius: '12px',
      padding: '16px',
      marginTop: '16px'
    }}>
      <h3 style={{ color: '#333333', fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
        Transaction History
      </h3>
      {transactions.map((tx) => (
        <div
          key={tx.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0',
            borderBottom: '1px solid #EEEEEE'
          }}
        >
          <div>
            <div style={{ color: '#333333', fontSize: '14px', fontWeight: 500 }}>
              {`\u20A6${tx.amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ color: '#777777', fontSize: '12px' }}>
              {new Date(tx.created_at).toLocaleString('en-NG', {
                dateStyle: 'medium',
                timeStyle: 'short'
              })}
            </div>
          </div>
          <div style={{
            color: tx.status === 'success' ? '#D4AF37' : '#777777',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'capitalize'
          }}>
            {tx.status}
          </div>
        </div>
      ))}
    </div>
  );
}
