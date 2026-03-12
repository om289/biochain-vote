import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, PieChart as PieChartIcon, Trophy, Users, TrendingUp, CheckCircle2, AlertCircle, Hash, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiService } from '@/services/apiService';
import { localBlockchain } from '@/services/localBlockchain';
import type { ElectionRecord, CandidateRecord } from '@/services/dbService';
import type { Block } from '@/services/localBlockchain';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function AuditPage() {
  const [elections, setElections] = useState<ElectionRecord[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string>('');
  const [results, setResults] = useState<{ candidate: CandidateRecord; voteCount: number; percentage: number }[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [blockCount, setBlockCount] = useState(0);
  const [chainValid, setChainValid] = useState(true);
  const [voteBlocks, setVoteBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const allElections = await apiService.getElections();
      setElections(allElections);

      const bc = await localBlockchain.getBlockCount();
      setBlockCount(bc);
      const v = await localBlockchain.verifyChain();
      setChainValid(v.valid);

      // Default to first completed election
      const completed = allElections.filter(e => e.status === 'completed');
      if (completed.length > 0) {
        setSelectedElectionId(completed[0].id);
      } else if (allElections.length > 0) {
        setSelectedElectionId(allElections[0].id);
      }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedElectionId) return;
    const loadResults = async () => {
      const r = await apiService.getElectionResults(selectedElectionId);
      setResults(r);
      const total = r.reduce((s, x) => s + x.voteCount, 0);
      setTotalVotes(total);

      const blocks = await localBlockchain.getVoteBlocksByElection(selectedElectionId);
      setVoteBlocks(blocks);
    };
    loadResults();
  }, [selectedElectionId]);

  const selectedElection = elections.find(e => e.id === selectedElectionId);
  const winner = results.length > 0 ? results[0] : null;
  const turnoutPercent = totalVotes > 0 ? 100 : 0; // in a real system, divide by total registered voters

  const pieData = results.map(r => ({
    name: `${r.candidate.partySymbol} ${r.candidate.name}`,
    value: r.voteCount,
    party: r.candidate.partyName,
  }));

  const barData = results.map(r => ({
    name: r.candidate.name.split(' ').slice(-1)[0],
    votes: r.voteCount,
    party: r.candidate.partyName,
    fullName: r.candidate.name,
  }));

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Election Results & Analytics</h1>
          <p className="text-sm text-muted-foreground">Comprehensive election analysis dashboard</p>
        </div>
        <Select value={selectedElectionId} onValueChange={setSelectedElectionId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select election" />
          </SelectTrigger>
          <SelectContent>
            {elections.map(e => (
              <SelectItem key={e.id} value={e.id}>
                {e.title} ({e.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Stats Cards */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass border-border/50">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalVotes}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Total Votes</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4 text-center">
            <Trophy className="w-6 h-6 text-biochain-warning mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground truncate">{winner?.candidate.name || '-'}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Winner</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 text-biochain-success mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{winner ? `${winner.percentage.toFixed(1)}%` : '-'}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Winner Share</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4 text-center">
            <Hash className="w-6 h-6 text-biochain-cyber mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{blockCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Blockchain Blocks</p>
          </CardContent>
        </Card>
      </motion.div>

      {results.length === 0 ? (
        <Card className="glass border-border/50">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No votes recorded for this election yet.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Pie Chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="glass border-border/50">
                <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><PieChartIcon className="w-4 h-4 text-primary" /> Vote Share Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name.slice(0, 10)} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(214 80% 10%)', border: '1px solid hsl(214 40% 18%)', borderRadius: '8px', color: '#fff' }}
                        formatter={(value: number, name: string) => [`${value} votes`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Bar Chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="glass border-border/50">
                <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><BarChart3 className="w-4 h-4 text-biochain-warning" /> Votes Per Candidate</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 40% 18%)" />
                      <XAxis dataKey="name" stroke="hsl(215 20% 55%)" fontSize={12} />
                      <YAxis stroke="hsl(215 20% 55%)" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(214 80% 10%)', border: '1px solid hsl(214 40% 18%)', borderRadius: '8px', color: '#fff' }}
                        formatter={(value: number) => [`${value} votes`]}
                        labelFormatter={(label) => {
                          const item = barData.find(d => d.name === label);
                          return item ? `${item.fullName} (${item.party})` : label;
                        }}
                      />
                      <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
                        {barData.map((_, index) => (
                          <Cell key={`bar-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Results Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="text-base font-display">Detailed Results — {selectedElection?.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.map((r, i) => (
                    <div key={r.candidate.id} className={`flex items-center justify-between p-3 rounded-lg ${i === 0 ? 'bg-biochain-warning/5 border border-biochain-warning/20' : 'bg-muted/30'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: `${COLORS[i % COLORS.length]}20` }}>
                          {r.candidate.partySymbol}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {i === 0 && <Trophy className="w-3.5 h-3.5 inline text-biochain-warning mr-1" />}
                            {r.candidate.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{r.candidate.partyName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">{r.voteCount}</p>
                        <p className="text-xs text-muted-foreground">{r.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Blockchain Explorer */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="glass border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-display">Blockchain Explorer</CardTitle>
                  <Badge variant="outline" className={chainValid ? 'bg-biochain-success/10 text-biochain-success border-biochain-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}>
                    {chainValid ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Chain Valid</> : <><AlertCircle className="w-3 h-3 mr-1" /> Tampered!</>}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {voteBlocks.slice(-10).reverse().map(block => (
                    <div key={block.index} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-primary font-bold">#{block.index}</span>
                        <span className="font-mono text-muted-foreground truncate max-w-[120px]">{block.hash.slice(0, 16)}...</span>
                      </div>
                      <div className="text-right text-muted-foreground">
                        <span>{new Date(block.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                  {voteBlocks.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-4">No vote blocks for this election.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
}
