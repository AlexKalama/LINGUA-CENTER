import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Wallet,
  AlertCircle,
  Search,
  Download
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { dataService } from '../services/dataService';
import { buildReceiptNumber, downloadReceiptPdf } from '../lib/receiptPdf';

interface Transaction {
  id: string;
  enrollmentId: string;
  student: string;
  studentEmail: string;
  courseName: string;
  programName: string;
  level: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
  status: string;
  totalFee: number;
  feeBalance: number;
}

export default function Financials() {
  const [stats, setStats] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<{ name: string; revenue: number }[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [s, r, t] = await Promise.all([
          dataService.getGlobalStats(),
          dataService.getRevenueData(),
          dataService.getRecentTransactions(100)
        ]);
        setStats(s);
        setRevenueData(r);
        setTransactions(t);
      } catch (error) {
        console.error('Error fetching financial stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading || !stats) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy"></div>
      </div>
    );
  }

  const currentMonthRevenue = revenueData.length > 0 ? revenueData[revenueData.length - 1].revenue : 0;
  const totalCollected = stats.totalRevenue;
  const totalExpected = stats.totalRevenue + stats.totalOutstanding;
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredTransactions = normalizedSearch
    ? transactions.filter((tx) =>
        [
          tx.id,
          tx.student,
          tx.programName,
          tx.courseName,
          tx.level,
          tx.date,
          tx.method,
          tx.reference,
          tx.status,
          String(tx.amount)
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)
      )
    : transactions;

  const downloadTransactionReceipt = (tx: Transaction) => {
    const totalFee = Number(tx.totalFee || 0);
    const balance = Math.max(Number(tx.feeBalance || 0), 0);
    const paidToDate = Math.max(totalFee - balance, 0);
    downloadReceiptPdf({
      receiptNumber: buildReceiptNumber(tx.date, tx.id),
      studentName: String(tx.student || 'Unknown Student'),
      studentEmail: String(tx.studentEmail || ''),
      programName: String(tx.programName || ''),
      courseName: String(tx.courseName || ''),
      level: String(tx.level || ''),
      enrollmentId: String(tx.enrollmentId || ''),
      transactionId: String(tx.id || ''),
      transactionDate: String(tx.date || ''),
      paymentMethod: String(tx.method || ''),
      reference: String(tx.reference || ''),
      amountPaid: Number(tx.amount || 0),
      totalFee,
      totalPaidToDate: paidToDate,
      outstandingBalance: balance,
      paymentStatus: String(tx.status || 'PENDING')
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-serif text-charcoal mb-2">Financial Systems</h1>
          <p className="text-charcoal/50">Live revenue and payment records from the database.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-navy/10 text-navy">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-xs font-bold text-charcoal/40 uppercase tracking-widest mb-1">Total Collected</p>
          <p className="text-2xl font-serif text-charcoal">Ksh {stats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-sage/10 text-sage">
              <Wallet size={24} />
            </div>
          </div>
          <p className="text-xs font-bold text-charcoal/40 uppercase tracking-widest mb-1">Current Month Revenue</p>
          <p className="text-2xl font-serif text-charcoal">Ksh {currentMonthRevenue.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-danger-muted/10 text-danger-muted">
              <AlertCircle size={24} />
            </div>
          </div>
          <p className="text-xs font-bold text-charcoal/40 uppercase tracking-widest mb-1">Outstanding Balances</p>
          <p className="text-2xl font-serif text-charcoal">Ksh {stats.totalOutstanding.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-warning-muted/10 text-warning-muted">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-xs font-bold text-charcoal/40 uppercase tracking-widest mb-1">Collection Rate</p>
          <p className="text-2xl font-serif text-charcoal">{collectionRate}%</p>
        </div>
      </div>

      <div className="glass-card p-8">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-serif text-charcoal">Revenue Performance (Last 6 Months)</h3>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E293B" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#1E293B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#1A1A1A', opacity: 0.5, fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#1A1A1A', opacity: 0.5, fontSize: 12 }}
                tickFormatter={(value) => `Ksh ${value / 1000}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  border: 'none',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value: number) => [`Ksh ${value.toLocaleString()}`, 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#1E293B"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorRev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-charcoal/5 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <h3 className="text-xl font-serif text-charcoal">Recent Transactions</h3>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/30" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student, reference, transaction ID..."
              className="input-field pl-10"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-charcoal/[0.02]">
                <th className="table-header">Transaction ID</th>
                <th className="table-header">Student</th>
                <th className="table-header">Course</th>
                <th className="table-header">Date</th>
                <th className="table-header">Method</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Reference</th>
                <th className="table-header text-right">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-charcoal/[0.01] transition-colors">
                  <td className="table-cell font-mono text-xs font-bold text-navy">{tx.id}</td>
                  <td className="table-cell font-semibold text-charcoal">{tx.student}</td>
                  <td className="table-cell text-charcoal/60">{tx.courseName}</td>
                  <td className="table-cell text-charcoal/50 font-mono text-xs">{tx.date}</td>
                  <td className="table-cell text-charcoal/60 text-xs">{tx.method}</td>
                  <td className="table-cell font-bold text-charcoal">Ksh {tx.amount.toLocaleString()}</td>
                  <td className="table-cell">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest ${
                      tx.status === 'PAID' ? 'bg-success-muted/10 text-success-muted' :
                      tx.status === 'PARTIAL' ? 'bg-warning-muted/10 text-warning-muted' :
                      'bg-danger-muted/10 text-danger-muted'
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="table-cell text-right text-charcoal/50 text-xs">
                    {tx.reference || '-'}
                  </td>
                  <td className="table-cell text-right">
                    <button
                      onClick={() => downloadTransactionReceipt(tx)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-navy hover:bg-navy/5 rounded transition-all"
                      title="Download receipt"
                    >
                      <Download size={14} />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td className="table-cell text-center text-charcoal/40" colSpan={9}>
                    {normalizedSearch
                      ? 'No transactions match your search.'
                      : 'No payment transactions found in the database.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
