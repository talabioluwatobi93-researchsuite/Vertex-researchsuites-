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

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('id, reference, amount, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) setTransactions(data);
      setLoading(false);
    };
    fetchTransactions();
  }, []);

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        style={{
          background: '#FFFFFF',
          border: '1px solid #EEEEEE',
          borderRadius: '12px',
          padding: '16px',
          marginTop: '16px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <div style={{ color: '#333333', fontSize: '16px', fontWeight: 600 }}>
            Transaction History
          </div>
          <div style={{ color: '#777777', fontSize: '12px', marginTop: '4px' }}>
            {loading ? 'Loading...' : `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div style={{ color: '#D4AF37', fontSize: '13px', fontWeight: 600 }}>
          View All &rsaquo;
        </div>
      </div>

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center', zIndex: 100
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#F9F9F9', width: '100%', maxWidth: '480px',
              maxHeight: '80vh', overflowY: 'auto', borderRadius: '18px 18px 0 0',
              padding: '20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#333333', fontSize: '18px', fontWeight: 700, margin: 0 }}>
                All Transactions
              </h3>
              <div onClick={() => setShowModal(false)} style={{ color: '#777777', fontSize: '20px', cursor: 'pointer' }}>
                &times;
              </div>
            </div>

            {loading && (
              <div style={{ color: '#777777', fontSize: '14px', padding: '16px 0' }}>Loading...</div>
            )}
            {!loading && transactions.length === 0 && (
              <div style={{ color: '#777777', fontSize: '14px', padding: '16px 0' }}>No transactions yet.</div>
            )}

            {transactions.map((tx) => (
              <div
                key={tx.id}
                style={{
                  background: '#FFFFFF', border: '1px solid #EEEEEE', borderRadius: '12px',
                  padding: '14px', marginBottom: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ color: '#333333', fontSize: '15px', fontWeight: 600 }}>
                      {`\u20A6${tx.amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </div>
                    <div style={{ color: '#777777', fontSize: '12px', marginTop: '4px' }}>
                      {formatFull(tx.created_at)}
                    </div>
                    <div style={{ color: '#AAAAAA', fontSize: '11px', marginTop: '2px' }}>
                      Ref: {tx.reference}
                    </div>
                  </div>
                  <div style={{
                    color: tx.status === 'success' ? '#D4AF37' : tx.status === 'pending' ? '#E67E22' : '#777777',
                    fontSize: '12px', fontWeight: 700, textTransform: 'capitalize',
                    background: tx.status === 'success' ? '#FBF3DD' : '#F0F0F0',
                    padding: '4px 10px', borderRadius: '20px'
                  }}>
                    {tx.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
