import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Download, Trash2, ChevronLeft, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAppStore } from '@/store/useAppStore';
import { activityLogDB } from '@/services/dbService';
import type { ActivityLogRecord, ActivityCategory } from '@/services/dbService';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 50;
const MAX_RECORDS = 500;

const SEVERITY_STYLES: Record<string, string> = {
  info:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  success: 'bg-biochain-success/15 text-biochain-success border-biochain-success/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  error:   'bg-destructive/15 text-destructive border-destructive/30',
};

const CATEGORIES: Array<ActivityCategory | 'all'> = [
  'all', 'auth', 'vote', 'blockchain', 'admin', 'booth', 'election', 'system',
];

export default function ActivityLogPage() {
  const { isAdmin } = useAppStore();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ActivityLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<ActivityCategory | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const all = await activityLogDB.getAll(); // already sorted newest-first
      setLogs(all.slice(0, MAX_RECORDS));
    } catch (e) {
      console.error('Failed to load activity logs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Apply client-side filters
  const filtered = logs.filter(log => {
    if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
    if (dateFrom && log.timestamp < dateFrom) return false;
    if (dateTo) {
      // dateTo is YYYY-MM-DD; include the entire day by comparing with end-of-day
      const endOfDay = dateTo + 'T23:59:59.999Z';
      if (log.timestamp > endOfDay) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRecords = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0); }, [categoryFilter, dateFrom, dateTo]);

  const handleExportCSV = () => {
    const header = ['timestamp', 'category', 'severity', 'action', 'actor', 'detail'];
    const rows = filtered.map(log => [
      log.timestamp,
      log.category,
      log.severity,
      log.action,
      log.actor,
      log.detail ?? '',
    ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biochain-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await activityLogDB.clear();
      await loadLogs();
      setClearDialogOpen(false);
    } catch (e) {
      console.error('Failed to clear logs:', e);
    } finally {
      setClearing(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-4 md:p-8 max-w-xl mx-auto text-center py-20 space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-xl font-display font-bold text-foreground">Admin Access Required</h2>
        <p className="text-sm text-muted-foreground">You must be logged in as an admin to view the activity log.</p>
        <Button onClick={() => navigate('/admin')}>Go to Admin</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <ScrollText className="w-7 h-7 text-primary" /> Activity Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Last {MAX_RECORDS} system events — admin view</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5" disabled={filtered.length === 0}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setClearDialogOpen(true)} className="gap-1.5" disabled={logs.length === 0}>
            <Trash2 className="w-4 h-4" /> Clear All Logs
          </Button>
        </div>
      </motion.div>

      {/* Filters */}
      <Card className="glass border-border/50">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Category</Label>
            <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v as ActivityCategory | 'all')}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c === 'all' ? 'All Categories' : c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">From Date</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">To Date</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9" />
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          {filtered.length} event{filtered.length !== 1 ? 's' : ''} matched
          {logs.length < MAX_RECORDS ? ` (${logs.length} total)` : ` (showing latest ${MAX_RECORDS})`}
        </span>
        {totalPages > 1 && (
          <span>Page {page + 1} of {totalPages}</span>
        )}
      </div>

      {/* Table */}
      <Card className="glass border-border/50">
        <CardHeader className="pb-0 border-b border-border/50">
          <CardTitle className="text-sm font-medium text-muted-foreground">Events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : pageRecords.length === 0 ? (
            <div className="py-12 text-center">
              <ScrollText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No activity log entries found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Category</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Severity</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Action</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Actor</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRecords.map((log, i) => (
                    <tr key={log.id ?? i} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {log.category}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className={`text-[10px] capitalize ${SEVERITY_STYLES[log.severity] || ''}`}>
                          {log.severity}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-foreground font-medium">{log.action}</td>
                      <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground max-w-[120px] truncate" title={log.actor}>
                        {log.actor}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground max-w-[280px] truncate" title={log.detail}>
                        {log.detail ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="gap-1"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Clear Confirmation Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" /> Clear All Activity Logs
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all {logs.length} activity log entries from the local database. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setClearDialogOpen(false)} disabled={clearing}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleClearAll} disabled={clearing}>
              {clearing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Clear All
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
