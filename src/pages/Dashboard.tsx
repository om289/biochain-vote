import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Vote, ShieldCheck, BarChart3, Clock, CheckCircle2, AlertCircle, ArrowRight, Fingerprint, User, MapPin, Hash, Server, TrendingUp, Activity, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAppStore } from '@/store/useAppStore';
import { apiService } from '@/services/apiService';
import { useNavigate } from 'react-router-dom';
import type { ElectionRecord } from '@/services/dbService';

const statusConfig = {
  active: { label: 'Active', color: 'bg-biochain-success/20 text-biochain-success border-biochain-success/30' },
  upcoming: { label: 'Upcoming', color: 'bg-biochain-warning/20 text-biochain-warning border-biochain-warning/30' },
  completed: { label: 'Completed', color: 'bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30' },
};

function VoterInfoCard({ voter }: { voter: any }) {
  const [boothInfo, setBoothInfo] = useState<string | null>(null);

  useEffect(() => {
    if (voter?.id) {
      apiService.getVoterBooth(voter.id).then(res => {
        if (res?.assigned && res.booth_id) {
          setBoothInfo(res.booth_id);
        }
      });
    }
  }, [voter?.id]);

  return (
    <Card className="glass border-border/50 overflow-hidden shadow-lg">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-primary to-green-600 opacity-70" />
      <CardContent className="p-5">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 glow-primary">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1 space-y-3 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-display font-bold text-foreground">{voter.name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="bg-biochain-success/10 text-biochain-success border-biochain-success/30 text-[10px]">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Biometric Verified
                  </Badge>
                  {voter.hasVoted && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                      <Vote className="w-3 h-3 mr-1" />
                      Voted
                    </Badge>
                  )}
                </div>
              </div>

              {/* Polling Station Tag */}
              {boothInfo ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/30 text-xs">
                  <Server className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="text-[11px] text-muted-foreground font-mono">Booth: <strong className="text-primary font-semibold">{boothInfo}</strong></span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/30 border border-border text-xs text-muted-foreground">
                  <Server className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-[10px]">Master Chain Node</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Hash className="w-3.5 h-3.5 flex-shrink-0 text-primary/70" />
                <span>Voter ID: <span className="text-foreground font-mono">{voter.voterIdNumber || 'N/A'}</span></span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-primary/70" />
                <span>{voter.constituency || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Fingerprint className="w-3.5 h-3.5 flex-shrink-0 text-primary/70" />
                <span>{voter.fingerprint ? 'Enrolled (Hardware/Sim)' : 'Pending'}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ElectionCard({ election, index, votedElections }: { election: ElectionRecord; index: number; votedElections: Set<string> }) {
  const navigate = useNavigate();
  const [voteCount, setVoteCount] = useState(0);

  useEffect(() => {
    apiService.getVoteCountByElection(election.id).then(setVoteCount);
  }, [election.id]);

  const cfg = statusConfig[election.status];
  const hasVoted = votedElections.has(election.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="glass border-border/50 hover:border-primary/30 transition-all group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base font-display">{election.title}</CardTitle>
            <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{election.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">{election.type.replace('-', ' ').toUpperCase().slice(0, 8)}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Type</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{voteCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Votes Cast</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{election.constituency.slice(0, 10)}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Constituency</p>
            </div>
          </div>

          {election.status === 'active' && !hasVoted && (
            <Button
              onClick={() => navigate('/vote')}
              className="w-full bg-primary hover:bg-primary/90"
              aria-label={`Cast vote for ${election.title}`}
            >
              Cast Your Vote <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {election.status === 'active' && hasVoted && (
            <div className="flex items-center justify-center gap-2 py-2 text-biochain-success">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Vote Recorded</span>
            </div>
          )}
          {election.status === 'completed' && (
            <Button
              variant="outline"
              onClick={() => navigate('/audit')}
              className="w-full"
            >
              View Results <BarChart3 className="w-4 h-4 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

const Dashboard = () => {
  const { currentVoter, elections, setElections, voteReceipts } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [blockCount, setBlockCount] = useState(0);
  const [chainValid, setChainValid] = useState(true);
  const [votedElections, setVotedElections] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const [turnout, setTurnout] = useState<{ totalVoters: number; totalVotes: number; byElection: { title: string; votes: number; status: string }[] }>({
    totalVoters: 0, totalVotes: 0, byElection: [],
  });

  useEffect(() => {
    const load = async () => {
      const allElections = await apiService.getElections();
      setElections(allElections);

      // Fetch blockchain status from the local IndexedDB blockchain
      try {
        const status = await apiService.getBlockchainStatus();
        setBlockCount(status.blockCount);
        setChainValid(status.isValid);
      } catch (e) {
        console.warn('Failed to fetch blockchain status:', e);
        setBlockCount(0);
        setChainValid(false);
      }

      // Check which elections the voter has already voted in
      if (currentVoter) {
        const voterVotes = await apiService.getVotesByVoter(currentVoter.id);
        setVotedElections(new Set(voterVotes.map(v => v.electionId)));
      }

      setLoading(false);
    };
    load();
  }, [setElections, currentVoter]);

  const loadTurnout = useCallback(async () => {
    try {
      const allVoters = await apiService.getVoters();
      const allElections = await apiService.getElections();
      let totalVotes = 0;
      const byElection: { title: string; votes: number; status: string }[] = [];
      for (const e of allElections) {
        const count = await apiService.getVoteCountByElection(e.id);
        totalVotes += count;
        byElection.push({ title: e.title, votes: count, status: e.status });
      }
      setTurnout({ totalVoters: allVoters.length, totalVotes, byElection });
    } catch (e) {
      console.warn('Turnout load failed:', e);
    }
  }, []);

  useEffect(() => {
    loadTurnout();
  }, [loadTurnout]);

  // Auto-refresh turnout every 15 seconds when there is an active election
  useEffect(() => {
    const hasActiveElection = elections.some(e => e.status === 'active');
    if (!hasActiveElection) return;
    const id = setInterval(loadTurnout, 15_000);
    return () => clearInterval(id);
  }, [elections, loadTurnout]);

  // Filter elections relevant to the voter
  const relevantElections = currentVoter
    ? elections.filter(e => e.constituency === currentVoter.constituency || e.state === currentVoter.state)
    : elections;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
          Welcome, <span className="text-gradient">{currentVoter?.name || 'Voter'}</span>
        </h1>
        <p className="text-sm text-muted-foreground">Your secure voting dashboard — {currentVoter?.state || 'India'}</p>
      </motion.div>

      {/* Voter Info Card */}
      {currentVoter && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <VoterInfoCard voter={currentVoter} />
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Vote, label: 'Cast Vote', to: '/vote', color: 'text-primary' },
          { icon: ShieldCheck, label: 'Verify Vote', to: '/verify', color: 'text-biochain-success' },
          { icon: BarChart3, label: 'Results', to: '/audit', color: 'text-biochain-warning' },
          { icon: Fingerprint, label: 'Identity', to: '/identity', color: 'text-biochain-cyber' },
        ].map((action, i) => (
          <motion.div key={action.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }}>
            <Button
              variant="outline"
              onClick={() => navigate(action.to)}
              className="w-full h-auto py-4 flex flex-col items-center gap-2 border-border hover:border-primary/40 hover:bg-accent/50"
              aria-label={action.label}
            >
              <action.icon className={`w-6 h-6 ${action.color}`} />
              <span className="text-xs font-medium">{action.label}</span>
            </Button>
          </motion.div>
        ))}
      </motion.div>

      {/* Blockchain Status */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="glass border-border/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${chainValid ? 'bg-biochain-success/10' : 'bg-destructive/10'} flex items-center justify-center`}>
                {chainValid ? (
                  <CheckCircle2 className="w-5 h-5 text-biochain-success" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-destructive" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {chainValid ? 'Blockchain Verified' : 'Chain Integrity Issue!'}
                </p>
                <p className="text-xs text-muted-foreground">{blockCount} blocks • SHA-256 linked • Tamper-proof</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${chainValid ? 'bg-biochain-success' : 'bg-destructive'} animate-pulse`} />
              <span className="text-xs text-foreground">Offline Secure</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Live Turnout Widget */}
      {turnout.totalVoters > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="glass border-border/50 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-biochain-cyber to-biochain-success" />
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Live Turnout</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-biochain-success" />
                  <span className="text-[10px] text-biochain-success">Live</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground font-mono">{turnout.totalVotes}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Votes Cast</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground font-mono">{turnout.totalVoters}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Registered</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary font-mono">
                    {turnout.totalVoters > 0 ? Math.round((turnout.totalVotes / turnout.totalVoters) * 100) : 0}%
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Turnout</p>
                </div>
              </div>
              <Progress
                value={turnout.totalVoters > 0 ? (turnout.totalVotes / turnout.totalVoters) * 100 : 0}
                className="h-2 mb-3"
              />
              {turnout.byElection.length > 0 && (
                <div className="space-y-1.5">
                  {turnout.byElection.map(e => (
                    <div key={e.title} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[60%]">{e.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-foreground">{e.votes} votes</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          e.status === 'active' ? 'bg-biochain-success/20 text-biochain-success' :
                          e.status === 'upcoming' ? 'bg-biochain-warning/20 text-biochain-warning' :
                          'bg-muted text-muted-foreground'
                        }`}>{e.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Elections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-semibold text-foreground">Your Elections</h2>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{relevantElections.length} election(s)</span>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="glass border-border/50 h-48 animate-pulse" />
            ))}
          </div>
        ) : relevantElections.length === 0 ? (
          <Card className="glass border-border/50">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No elections available for your constituency.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {relevantElections.map((election, i) => (
              <ElectionCard key={election.id} election={election} index={i} votedElections={votedElections} />
            ))}
          </div>
        )}
      </div>

      {/* Vote History */}
      <div className="space-y-4">
        <h2 className="text-lg font-display font-semibold text-foreground">Vote History</h2>
        {voteReceipts.length === 0 ? (
          <Card className="glass border-border/50">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No votes cast yet. Participate in an active election!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {voteReceipts.map((receipt) => (
              <Card key={receipt.id} className="glass border-border/50">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-biochain-success" />
                    <div>
                      <p className="text-sm font-medium">{receipt.electionTitle}</p>
                      <p className="text-xs text-muted-foreground font-mono">{receipt.transactionHash.slice(0, 16)}...</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-biochain-success/10 text-biochain-success border-biochain-success/30">
                    {receipt.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
