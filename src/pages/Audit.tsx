import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, BarChart3, Loader2, CheckCircle2, AlertCircle, Database, Info, Network, Hash, CloudUpload, Trophy, TrendingUp, Download, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/useAppStore';
import { apiService } from '@/services/apiService';
import type { ElectionRecord } from '@/services/dbService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area } from 'recharts';

// Party colors for charts
const PARTY_COLORS: Record<string, string> = {
  'Bharatiya Janata Party': '#F97316',
  'Indian National Congress': '#3B82F6',
  'Aam Aadmi Party': '#06B6D4',
  'Samajwadi Party': '#EF4444',
  'Bahujan Samaj Party': '#10B981',
  'Shiv Sena': '#F59E0B',
  'Independent': '#8B5CF6',
};
const CHART_COLORS = ['#F97316', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#06B6D4', '#F59E0B'];

function getPartyColor(partyName: string, index: number): string {
  return PARTY_COLORS[partyName] || CHART_COLORS[index % CHART_COLORS.length];
}

export default function AuditPage() {
  const { isAdmin } = useAppStore();
  const [elections, setElections] = useState<ElectionRecord[]>([]);
  const [selectedElection, setSelectedElection] = useState<ElectionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        await apiService.initialize();
        const allElections = await apiService.getElections();
        setElections(allElections);
        // Auto-select the completed election if one exists
        const completed = allElections.find(e => e.status === 'completed');
        setSelectedElection(completed || allElections[0] || null);
      } catch (e) {
        console.error("Failed to load elections", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Auto-analyze when a completed election is selected
  useEffect(() => {
    if (selectedElection?.status === 'completed' && !analytics) {
      handleAnalyze();
    }
  }, [selectedElection]);

  const handleAnalyze = async () => {
    if (!selectedElection) return;
    setAnalyticsLoading(true);
    setError('');
    setPublishSuccess(false);

    try {
      await new Promise(resolve => setTimeout(resolve, 400));
      const data = await apiService.getElectionAnalytics(selectedElection.id);
      setAnalytics(data);
    } catch (e: any) {
      setError(e.message || 'Failed to analyze election data');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedElection) return;
    setPublishing(true);
    setError('');

    try {
      const res = await apiService.publishResults(selectedElection.id);
      if (res.success) {
        setPublishSuccess(true);
      } else {
        setError('No votes to publish or publish failed.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to publish results to Supabase');
    } finally {
      setPublishing(false);
    }
  };

  const handleExportJSON = () => {
    if (!selectedElection || !analytics) return;
    const manifest = {
      manifestType: "BIOCHAIN_CERTIFIED_AUDIT_MANIFEST",
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      election: {
        id: selectedElection.id,
        title: selectedElection.title,
        constituency: selectedElection.constituency,
        state: selectedElection.state,
        status: selectedElection.status,
      },
      blockchain: {
        masterBlocks: analytics.blockchain?.masterBlocks,
        masterValid: analytics.blockchain?.masterValid,
        merkleRoot: analytics.blockchain?.merkleRoot,
        leafCount: analytics.blockchain?.leafCount,
      },
      results: analytics.results,
      winner: analytics.winner,
      runnerUp: analytics.runnerUp,
      margin: analytics.margin,
      boothBreakdown: analytics.boothBreakdown,
      timeSeries: analytics.timeSeries,
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-manifest-${selectedElection.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!selectedElection || !analytics) return;
    const headers = ['Candidate Name', 'Party', 'Vote Count', 'Percentage'];
    const rows = (analytics.results || []).map((r: any) => [
      `"${r.candidateName || r.candidateId}"`,
      `"${r.partyName || 'Independent'}"`,
      r.voteCount,
      `${r.percentage}%`
    ]);
    const csvContent = [headers.join(','), ...rows.map((row: any) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `election-tally-${selectedElection.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  // Prepare chart data
  const pieData = analytics?.results?.map((r: any, i: number) => ({
    name: r.candidateName || r.candidateId,
    value: r.voteCount,
    party: r.partyName || 'Unknown',
    fill: getPartyColor(r.partyName, i),
  })) || [];

  const barData = analytics?.results?.map((r: any, i: number) => ({
    name: (r.candidateName || r.candidateId).split(' ').slice(-1)[0], // Surname
    fullName: r.candidateName || r.candidateId,
    votes: r.voteCount,
    party: r.partyName || 'Unknown',
    fill: getPartyColor(r.partyName, i),
  })) || [];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-primary" />
            Election Analytics
          </h1>
          <p className="text-muted-foreground mt-1">Real-time local blockchain transparency & verification</p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {analytics && (
            <>
              <Button
                variant="outline"
                onClick={handleExportCSV}
                className="gap-1.5 border-border bg-card/60 hover:bg-accent text-xs"
                title="Export Results as CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-biochain-success" />
                CSV Tally
              </Button>
              <Button
                variant="outline"
                onClick={handleExportJSON}
                className="gap-1.5 border-border bg-card/60 hover:bg-accent text-xs"
                title="Download Certified JSON Audit Manifest"
              >
                <Download className="w-4 h-4 text-primary" />
                Audit Manifest (JSON)
              </Button>
            </>
          )}

          {isAdmin && analytics && (
            <Button
              onClick={handlePublish}
              disabled={publishing || publishSuccess || analytics.totalVotes === 0}
              className={`gap-2 ${publishSuccess ? 'bg-biochain-success hover:bg-biochain-success/90' : 'bg-primary'}`}
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : publishSuccess ? <CheckCircle2 className="w-4 h-4" /> : <CloudUpload className="w-4 h-4" />}
              {publishSuccess ? 'Published to Supabase' : 'Publish Results to Supabase'}
            </Button>
          )}
        </div>
      </div>

      <Card className="glass border-border/50 shadow-xl overflow-hidden mb-6">
        <div className="bg-muted/30 p-4 border-b border-border flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full">
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block uppercase tracking-wider">
              Select Election
            </label>
            <select
              className="w-full h-11 bg-background/50 border border-border rounded-md px-3 text-sm focus:ring-2 focus:ring-primary outline-none"
              value={selectedElection?.id || ''}
              onChange={(e) => {
                const el = elections.find(el => el.id === e.target.value) || null;
                setSelectedElection(el);
                setAnalytics(null);
              }}
            >
              {elections.map(e => (
                <option key={e.id} value={e.id}>{e.title} ({e.status})</option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={!selectedElection || analyticsLoading}
            className="w-full md:w-auto h-11 mt-auto"
          >
            {analyticsLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Blockchain...</>
            ) : (
              <><Database className="w-4 h-4 mr-2" /> Analyze Results</>
            )}
          </Button>
        </div>

        {error && (
          <div className="p-4 m-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {publishSuccess && (
          <div className="p-4 m-4 rounded-lg bg-biochain-success/10 border border-biochain-success/20 text-biochain-success flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">Results successfully published to Supabase central database.</p>
          </div>
        )}
      </Card>

      {analytics && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="glass border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Votes</p>
                <p className="text-3xl font-bold font-display text-primary">{analytics.totalVotes}</p>
              </CardContent>
            </Card>

            <Card className="glass border-border/50 col-span-2">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-biochain-success/10 flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6 text-biochain-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Leading Candidate</p>
                  <p className="text-lg font-bold text-foreground leading-tight">
                    {analytics.winner?.candidateName || 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {analytics.winner ? `${analytics.winner.partyName} — ${analytics.winner.voteCount} votes (${analytics.winner.percentage}%)` : '-'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Win Margin</p>
                <p className="text-2xl font-bold font-display text-foreground">{analytics.margin}</p>
                <p className="text-[10px] text-muted-foreground">votes</p>
              </CardContent>
            </Card>

            <Card className="glass border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Chain Status</p>
                {analytics.blockchain.masterValid ? (
                  <Badge className="bg-biochain-success/20 text-biochain-success border-biochain-success/30 mt-1">
                    <ShieldCheck className="w-3 h-3 mr-1" /> Intact
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="mt-1">Compromised</Badge>
                )}
              </CardContent>
            </Card>

            <Card className="glass border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Local Blocks</p>
                <p className="text-2xl font-bold font-display text-foreground">{analytics.blockchain.masterBlocks}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Pie Chart */}
            <Card className="glass border-border/50 lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Vote Share</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                {analytics.totalVotes > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        label={({ name, percent }: any) => `${name?.split(' ').slice(-1)[0]} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: any, name: any) => [`${value} votes`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-sm">No votes cast yet</p>
                )}
              </CardContent>
            </Card>

            {/* Bar Chart */}
            <Card className="glass border-border/50 lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Candidate Votes</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {analytics.totalVotes > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(value: any, _: any, entry: any) => [`${value} votes`, entry.payload.fullName]}
                      />
                      <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
                        {barData.map((entry: any, index: number) => (
                          <Cell key={`bar-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">No vote data</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Time Series Area Chart */}
            <Card className="glass border-border/50 lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Voting Trend</CardTitle>
                <CardDescription>Votes recorded over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {analytics.timeSeries && analytics.timeSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVotes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => val.split(' ')[1] || val} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      />
                      <Area type="monotone" dataKey="votes" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorVotes)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">No time series data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Results Table */}
          <Card className="glass border-border/50">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-lg">Candidate Standings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/20">
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground w-12">Rank</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Candidate</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Party</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">Votes</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">Share %</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground min-w-[150px]">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.results.map((result: any, index: number) => {
                      const isWinner = index === 0 && result.voteCount > 0;
                      return (
                        <tr key={result.candidateId} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                          <td className="py-3 px-4 text-left">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${isWinner ? 'bg-biochain-warning/20 text-biochain-warning' : 'bg-muted text-muted-foreground'}`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{result.partySymbol || '⭐'}</span>
                              <div>
                                <p className="font-medium text-foreground">{result.candidateName}</p>
                                {isWinner && <Badge className="bg-biochain-warning/20 text-biochain-warning border-biochain-warning/30 text-[10px] mt-0.5">Winner</Badge>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs">
                            {result.partyName}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-foreground">
                            {result.voteCount}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {result.percentage}%
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${result.percentage}%` }}
                                  transition={{ duration: 1, ease: 'easeOut' }}
                                  style={{ backgroundColor: getPartyColor(result.partyName, index) }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {analytics.results.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">No candidate data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Booth Breakdown */}
          <Card className="glass border-border/50">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-lg">Polling Booth Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/20">
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Booth ID</th>
                      <th className="py-3 px-4 text-right font-medium text-muted-foreground">Total Votes</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Top Candidate</th>
                      <th className="py-3 px-4 text-left font-medium text-muted-foreground">Breakdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.boothBreakdown.map((booth: any) => {
                      let topCand = 'N/A';
                      let topVotes = 0;
                      Object.entries(booth.candidates).forEach(([cName, count]: [string, any]) => {
                        if (count > topVotes) {
                          topVotes = count;
                          topCand = cName;
                        }
                      });

                      return (
                        <tr key={booth.boothId} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                          <td className="py-3 px-4 font-medium text-foreground">{booth.boothName}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold">{booth.voteCount}</td>
                          <td className="py-3 px-4 text-muted-foreground">{topCand} ({topVotes})</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(booth.candidates).map(([cName, count]: [string, any]) => (
                                <Badge key={cName} variant="outline" className="text-[10px]">
                                  {cName.split(' ').slice(-1)[0]}: {count as number}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {analytics.boothBreakdown.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">No booth data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Blockchain & Merkle Data */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="glass border-primary/20">
              <CardHeader className="pb-3 border-b border-border/50 bg-primary/5">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Network className="w-4 h-4 text-primary" /> Merkle Tree Verification
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Merkle Root Hash (SHA-256)</p>
                  <p className="font-mono text-xs bg-background/50 p-2 rounded border border-border break-all text-biochain-success">
                    {analytics.blockchain.merkleRoot || '0'.repeat(64)}
                  </p>
                </div>
                <div className="flex justify-between items-center text-sm bg-muted/20 p-2 rounded">
                  <span className="text-muted-foreground">Leaf Count (Transactions)</span>
                  <span className="font-mono font-bold text-foreground">{analytics.blockchain.leafCount}</span>
                </div>
                <div className="flex justify-between items-center text-sm bg-muted/20 p-2 rounded">
                  <span className="text-muted-foreground">Total Booths</span>
                  <span className="font-mono font-bold text-foreground">{analytics.blockchain.totalBooths}</span>
                </div>
                <p className="text-xs text-muted-foreground flex gap-2">
                  <Info className="w-4 h-4 shrink-0 text-primary" />
                  The Merkle Root cryptographically proves the integrity of every vote. Any change to any vote will completely change this root hash.
                </p>
              </CardContent>
            </Card>

            <Card className="glass border-border/50">
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" /> SHA-256 Offline Storage
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-sm">
                <p className="text-muted-foreground leading-relaxed">
                  All ballots are recorded offline in the browser's IndexedDB. Each vote is a block
                  in a SHA-256 hash-linked chain — tamper-proof and cryptographically verifiable.
                </p>
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 flex gap-3">
                  <Hash className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-foreground mb-1">How to Access</p>
                    <p className="text-xs text-muted-foreground">
                      Open DevTools → Application → IndexedDB → <code className="text-primary">biochain-vote</code> → <code className="text-primary">blocks</code> to inspect all raw SHA-256 chain data.
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-biochain-success/5 rounded-lg border border-biochain-success/20 flex gap-3">
                  <CloudUpload className="w-5 h-5 text-biochain-success shrink-0" />
                  <div>
                    <p className="font-medium text-foreground mb-1">Publish to Supabase</p>
                    <p className="text-xs text-muted-foreground">
                      Only when admin clicks "Publish Results" are the verified tallies and blocks synced to the central Supabase server for permanent storage.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </motion.div>
      )}
    </div>
  );
}
