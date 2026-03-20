import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Wallet,
  AlertCircle,
  Search,
  Download,
  Edit2,
  Trash2
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
  studentPhone: string;
  courseName: string;
  programName: string;
  level: string;
  registrationNumber: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
  status: string;
  totalFee: number;
  feeBalance: number;
}

interface MiscExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
}

export default function Financials() {
  const [stats, setStats] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<{ name: string; revenue: number }[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [miscExpenses, setMiscExpenses] = useState<MiscExpense[]>([]);
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: '',
    reference: ''
  });
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseDateFrom, setExpenseDateFrom] = useState('');
  const [expenseDateTo, setExpenseDateTo] = useState('');
  const [editingExpense, setEditingExpense] = useState<MiscExpense | null>(null);
  const [editForm, setEditForm] = useState({
    description: '',
    category: '',
    amount: '',
    date: '',
    method: '',
    reference: ''
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MiscExpense | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [s, r, t, m] = await Promise.all([
          dataService.getGlobalStats(),
          dataService.getRevenueData(),
          dataService.getRecentTransactions(100),
          dataService.getMiscExpenditures(50)
        ]);
        setStats(s);
        setRevenueData(r);
        setTransactions(t);
        setMiscExpenses(m);
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
  const totalExpenses = stats.totalExpenses || 0;
  const netRevenue = stats.netRevenue ?? (totalCollected - totalExpenses);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredTransactions = normalizedSearch
    ? transactions.filter((tx) =>
        [
          tx.id,
          tx.student,
          tx.programName,
          tx.courseName,
          tx.level,
          tx.registrationNumber,
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
      studentPhone: String(tx.studentPhone || ''),
      programName: String(tx.programName || ''),
      courseName: String(tx.courseName || ''),
      level: String(tx.level || ''),
      enrollmentId: String(tx.enrollmentId || ''),
      registrationNumber: String(tx.registrationNumber || ''),
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

  const totalMiscSpend = miscExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const normalizedExpenseSearch = expenseSearch.trim().toLowerCase();
  const filteredExpenses = miscExpenses.filter((row) => {
    const date = String(row.date || '');
    if (expenseDateFrom && date < expenseDateFrom) return false;
    if (expenseDateTo && date > expenseDateTo) return false;
    if (!normalizedExpenseSearch) return true;
    return [
      row.description,
      row.category,
      row.method,
      row.reference,
      row.date,
      String(row.amount)
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedExpenseSearch);
  });
  const filteredMiscSpend = filteredExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const handleAddExpense = async () => {
    try {
      setExpenseSaving(true);
      setExpenseError(null);
      const saved = await dataService.addMiscExpenditure({
        description: expenseForm.description,
        category: expenseForm.category,
        amount: Number(expenseForm.amount || 0),
        date: expenseForm.date,
        method: expenseForm.method,
        reference: expenseForm.reference
      });
      setMiscExpenses((prev) => [saved, ...prev]);
      setExpenseForm({
        description: '',
        category: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        method: '',
        reference: ''
      });
    } catch (error: any) {
      setExpenseError(error?.message || 'Failed to save expense.');
    } finally {
      setExpenseSaving(false);
    }
  };

  const openEditExpense = (row: MiscExpense) => {
    setEditingExpense(row);
    setEditForm({
      description: row.description || '',
      category: row.category || '',
      amount: String(row.amount ?? ''),
      date: row.date || new Date().toISOString().split('T')[0],
      method: row.method || '',
      reference: row.reference || ''
    });
    setEditError(null);
  };

  const closeEditExpense = () => {
    setEditingExpense(null);
    setEditError(null);
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense) return;
    try {
      setEditSaving(true);
      setEditError(null);
      const updated = await dataService.updateMiscExpenditure(editingExpense.id, {
        description: editForm.description,
        category: editForm.category,
        amount: Number(editForm.amount || 0),
        date: editForm.date,
        method: editForm.method,
        reference: editForm.reference
      });
      setMiscExpenses((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      closeEditExpense();
    } catch (error: any) {
      setEditError(error?.message || 'Failed to update expense.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteSaving(true);
      await dataService.deleteMiscExpenditure(deleteTarget.id);
      setMiscExpenses((prev) => prev.filter((row) => row.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error: any) {
      setExpenseError(error?.message || 'Failed to delete expense.');
    } finally {
      setDeleteSaving(false);
    }
  };

  const exportMiscExpenses = () => {
    const escapeHtml = (value: unknown) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const currency = (amount: number) => `Ksh ${Number(amount || 0).toLocaleString('en-KE')}`;
    const generatedAt = new Date().toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    const filteredTotal = filteredExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Calibri, Arial, sans-serif; color: #1f2937; margin: 24px; }
    h1 { margin: 0; font-size: 26px; color: #0f172a; }
    .muted { color: #6b7280; font-size: 12px; }
    .summary { border-collapse: collapse; margin-top: 14px; width: 100%; max-width: 720px; }
    .summary th, .summary td { border: 1px solid #d1d5db; padding: 9px 12px; text-align: left; }
    .summary th { background: #f3f4f6; width: 260px; font-weight: 700; color: #111827; }
    .sheet { border-collapse: collapse; width: 100%; margin-top: 18px; }
    .sheet th, .sheet td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 12px; }
    .sheet th { background: #0f172a; color: #ffffff; text-transform: uppercase; letter-spacing: .03em; }
    .sheet tr:nth-child(even) td { background: #f8fafc; }
    .amount { text-align: right; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Lingua Center Miscellaneous Expenditure</h1>
  <div class="muted">Generated: ${escapeHtml(generatedAt)}</div>

  <table class="summary">
    <tr><th>Total Recorded</th><td>${escapeHtml(currency(totalMiscSpend))}</td></tr>
    <tr><th>Filtered Total</th><td>${escapeHtml(currency(filteredTotal))}</td></tr>
  </table>

  <table class="sheet">
    <thead>
      <tr>
        <th>Date</th>
        <th>Description</th>
        <th>Category</th>
        <th>Method</th>
        <th>Reference</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${filteredExpenses.length === 0
        ? '<tr><td colspan="6">No expenses in this filter.</td></tr>'
        : filteredExpenses.map((row) => `
            <tr>
              <td>${escapeHtml(row.date || '')}</td>
              <td>${escapeHtml(row.description || '')}</td>
              <td>${escapeHtml(row.category || '')}</td>
              <td>${escapeHtml(row.method || '')}</td>
              <td>${escapeHtml(row.reference || '')}</td>
              <td class="amount">${escapeHtml(currency(row.amount || 0))}</td>
            </tr>
          `).join('')}
    </tbody>
  </table>
</body>
</html>`;

    const blob = new Blob([`\uFEFF${html}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `misc-expenditures-${new Date().toISOString().slice(0,10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif text-charcoal mb-2">Financial Systems</h1>
          <p className="text-charcoal/50">Live revenue and payment records from the database.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="glass-card p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 rounded-xl bg-navy/10 text-navy">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-xs font-bold text-charcoal/40 uppercase tracking-widest mb-1">Total Collected</p>
          <p className="text-xl font-serif text-charcoal">Ksh {stats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 rounded-xl bg-sage/10 text-sage">
              <Wallet size={24} />
            </div>
          </div>
          <p className="text-xs font-bold text-charcoal/40 uppercase tracking-widest mb-1">Current Month Revenue</p>
          <p className="text-xl font-serif text-charcoal">Ksh {currentMonthRevenue.toLocaleString()}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 rounded-xl bg-danger-muted/10 text-danger-muted">
              <AlertCircle size={24} />
            </div>
          </div>
          <p className="text-xs font-bold text-charcoal/40 uppercase tracking-widest mb-1">Outstanding Balances</p>
          <p className="text-xl font-serif text-charcoal">Ksh {stats.totalOutstanding.toLocaleString()}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 rounded-xl bg-warning-muted/10 text-warning-muted">
              <AlertCircle size={24} />
            </div>
          </div>
          <p className="text-xs font-bold text-charcoal/40 uppercase tracking-widest mb-1">Total Expenses</p>
          <p className="text-xl font-serif text-charcoal">Ksh {Number(totalExpenses).toLocaleString()}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 rounded-xl bg-navy/10 text-navy">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-xs font-bold text-charcoal/40 uppercase tracking-widest mb-1">Net Revenue</p>
          <p className="text-xl font-serif text-charcoal">Ksh {Number(netRevenue).toLocaleString()}</p>
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
        <div className="md:hidden divide-y divide-charcoal/5">
          {filteredTransactions.map((tx) => (
            <div key={tx.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-charcoal">{tx.student}</p>
                  <p className="text-xs text-charcoal/40">{tx.studentEmail || '-'}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest ${
                  tx.status === 'PAID' ? 'bg-success-muted/10 text-success-muted' :
                  tx.status === 'PARTIAL' ? 'bg-warning-muted/10 text-warning-muted' :
                  'bg-danger-muted/10 text-danger-muted'
                }`}>
                  {tx.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-charcoal/60">
                <div>
                  <p className="uppercase tracking-wider text-[10px] text-charcoal/40">Reg No</p>
                  <p className="font-semibold text-charcoal">{tx.registrationNumber || '—'}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wider text-[10px] text-charcoal/40">Course</p>
                  <p className="font-semibold text-charcoal">{tx.courseName}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wider text-[10px] text-charcoal/40">Date</p>
                  <p className="font-medium text-charcoal">{tx.date}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wider text-[10px] text-charcoal/40">Method</p>
                  <p className="font-medium text-charcoal">{tx.method}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wider text-[10px] text-charcoal/40">Reference</p>
                  <p className="font-medium text-charcoal">{tx.reference || '-'}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wider text-[10px] text-charcoal/40">Amount</p>
                  <p className="font-semibold text-charcoal">Ksh {tx.amount.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex justify-between items-center text-[11px] text-charcoal/40">
                <span className="font-mono">TX: {tx.id}</span>
                <button
                  onClick={() => downloadTransactionReceipt(tx)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-navy hover:bg-navy/5 rounded transition-all"
                  title="Download receipt"
                >
                  <Download size={14} />
                  Download
                </button>
              </div>
            </div>
          ))}
          {filteredTransactions.length === 0 && (
            <div className="p-4 text-center text-sm text-charcoal/40">
              {normalizedSearch
                ? 'No transactions match your search.'
                : 'No payment transactions found in the database.'}
            </div>
          )}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-charcoal/[0.02]">
                <th className="table-header">Transaction ID</th>
                <th className="table-header">Student</th>
                <th className="table-header">Reg No</th>
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
                  <td className="table-cell font-semibold text-charcoal">
                    <div className="flex flex-col">
                      <span>{tx.student}</span>
                      <span className="text-[11px] text-charcoal/40">{tx.studentEmail || '-'}</span>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-navy/10 text-navy text-[11px] font-semibold">
                      {tx.registrationNumber || '—'}
                    </span>
                  </td>
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
                  <td className="table-cell text-center text-charcoal/40" colSpan={10}>
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

      <div className="glass-card p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl font-serif text-charcoal">Miscellaneous Expenditure</h3>
            <p className="text-sm text-charcoal/50">Track non-tuition expenses and petty cash outlays.</p>
          </div>
          <div className="text-sm text-charcoal/60">
            Total Recorded: <span className="font-semibold text-charcoal">Ksh {totalMiscSpend.toLocaleString()}</span>
            {(expenseSearch || expenseDateFrom || expenseDateTo) && (
              <span className="ml-3 text-charcoal/40">
                Filtered: <span className="font-semibold text-charcoal">Ksh {filteredMiscSpend.toLocaleString()}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/30" size={16} />
            <input
              type="text"
              value={expenseSearch}
              onChange={(e) => setExpenseSearch(e.target.value)}
              placeholder="Search description, category, ref..."
              className="input-field pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="date"
              className="input-field text-xs"
              value={expenseDateFrom}
              onChange={(e) => setExpenseDateFrom(e.target.value)}
            />
            <span className="text-xs text-charcoal/40">to</span>
            <input
              type="date"
              className="input-field text-xs"
              value={expenseDateTo}
              onChange={(e) => setExpenseDateTo(e.target.value)}
            />
            <button onClick={exportMiscExpenses} className="btn-secondary text-xs">
              Export Report
            </button>
          </div>
        </div>

        {expenseError && (
          <div className="p-3 rounded-xl bg-danger-muted/10 text-danger-muted text-sm">
            {expenseError}
          </div>
        )}

        <div className="p-4 rounded-2xl bg-charcoal/[0.02] border border-charcoal/5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Description</label>
              <input
                type="text"
                className="input-field"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="Stationery, repairs, transport..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Category</label>
              <input
                type="text"
                className="input-field"
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                placeholder="Petty Cash"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Amount (Ksh)</label>
              <input
                type="number"
                className="input-field"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                min={0}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Date</label>
              <input
                type="date"
                className="input-field"
                value={expenseForm.date}
                onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Method / Ref</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-field"
                  value={expenseForm.method}
                  onChange={(e) => setExpenseForm({ ...expenseForm, method: e.target.value })}
                  placeholder="Cash, Mpesa..."
                />
                <input
                  type="text"
                  className="input-field"
                  value={expenseForm.reference}
                  onChange={(e) => setExpenseForm({ ...expenseForm, reference: e.target.value })}
                  placeholder="Ref"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleAddExpense}
              disabled={expenseSaving}
              className="btn-primary disabled:opacity-50"
            >
              {expenseSaving ? 'Saving...' : 'Add Expenditure'}
            </button>
          </div>
        </div>

        <div className="md:hidden divide-y divide-charcoal/5">
          {filteredExpenses.map((row) => (
            <div key={row.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-charcoal">{row.description}</p>
                  <p className="text-xs text-charcoal/40">{row.category || '-'}</p>
                </div>
                <p className="text-sm font-semibold text-charcoal">Ksh {Number(row.amount || 0).toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-charcoal/60">
                <div>
                  <p className="uppercase tracking-wider text-[10px] text-charcoal/40">Date</p>
                  <p className="font-medium text-charcoal">{row.date}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wider text-[10px] text-charcoal/40">Method</p>
                  <p className="font-medium text-charcoal">{row.method || '-'}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wider text-[10px] text-charcoal/40">Reference</p>
                  <p className="font-medium text-charcoal">{row.reference || '-'}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => openEditExpense(row)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-navy hover:bg-navy/5 rounded transition-all"
                  title="Edit expenditure"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(row)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-danger-muted hover:bg-danger-muted/10 rounded transition-all"
                  title="Delete expenditure"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          ))}
          {filteredExpenses.length === 0 && (
            <div className="p-4 text-center text-sm text-charcoal/40">
              No miscellaneous expenditure recorded for this filter.
            </div>
          )}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-charcoal/[0.02]">
                <th className="table-header">Date</th>
                <th className="table-header">Description</th>
                <th className="table-header">Category</th>
                <th className="table-header">Method</th>
                <th className="table-header">Reference</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((row) => (
                <tr key={row.id} className="hover:bg-charcoal/[0.01] transition-colors">
                  <td className="table-cell text-charcoal/50 text-xs">{row.date}</td>
                  <td className="table-cell font-medium text-charcoal">{row.description}</td>
                  <td className="table-cell text-charcoal/60">{row.category || '-'}</td>
                  <td className="table-cell text-charcoal/60 text-xs">{row.method || '-'}</td>
                  <td className="table-cell text-charcoal/50 text-xs">{row.reference || '-'}</td>
                  <td className="table-cell text-right font-bold text-charcoal">Ksh {Number(row.amount || 0).toLocaleString()}</td>
                  <td className="table-cell text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => openEditExpense(row)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-navy hover:bg-navy/5 rounded transition-all"
                        title="Edit expenditure"
                      >
                        <Edit2 size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(row)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-danger-muted hover:bg-danger-muted/10 rounded transition-all"
                        title="Delete expenditure"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td className="table-cell text-center text-charcoal/40" colSpan={7}>
                    No miscellaneous expenditure recorded for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {editingExpense && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <div onClick={closeEditExpense} className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-lg modal-surface rounded-2xl shadow-2xl p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-serif text-charcoal">Edit Expenditure</h3>
                <button onClick={closeEditExpense} className="p-2 hover:bg-charcoal/5 rounded-full">
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>
              {editError && (
                <div className="p-3 rounded-xl bg-danger-muted/10 text-danger-muted text-sm mb-4">
                  {editError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Description</label>
                  <input
                    type="text"
                    className="input-field"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Category</label>
                  <input
                    type="text"
                    className="input-field"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Amount (Ksh)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    min={0}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Method</label>
                  <input
                    type="text"
                    className="input-field"
                    value={editForm.method}
                    onChange={(e) => setEditForm({ ...editForm, method: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-charcoal/40 uppercase tracking-widest">Reference</label>
                  <input
                    type="text"
                    className="input-field"
                    value={editForm.reference}
                    onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={closeEditExpense} className="btn-secondary">Cancel</button>
                <button
                  onClick={handleUpdateExpense}
                  disabled={editSaving || !editForm.description.trim() || Number(editForm.amount || 0) <= 0}
                  className="btn-primary disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <div onClick={() => setDeleteTarget(null)} className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-md modal-surface rounded-2xl shadow-2xl p-8">
              <h3 className="text-2xl font-serif text-charcoal mb-3">Delete Expenditure</h3>
              <p className="text-sm text-charcoal/60">
                Delete "{deleteTarget.description}" for Ksh {Number(deleteTarget.amount || 0).toLocaleString()}?
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Cancel</button>
                <button
                  onClick={handleDeleteExpense}
                  disabled={deleteSaving}
                  className="btn-primary bg-danger-muted hover:bg-danger-muted/90 disabled:opacity-50"
                >
                  {deleteSaving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
