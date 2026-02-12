import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Vote, ShieldCheck, BarChart3, Clock, Users, CheckCircle2, AlertCircle, ArrowRight, Fingerprint } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAppStore } from '@/store/useAppStore';
import { apiService } from '@/services/apiService';
import { useNavigate } from 'react-router-dom';
import type { Election } from '@/store/useAppStore';

const statusConfig = {
  active: { label: 'Active', color: 'bg-biochain-success/20 text-biochain-success border-biochain-success/30' },
  upcoming: { label: 'Upcoming', color: 'bg-biochain-warning/20 text-biochain-warning border-biochain-warning/30' },
  completed: { label: 'Completed', color: 'bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30' },
};

function ElectionCard({ election, index }: { election: Election; index: number }) {
  const navigate = useNavigate();
  const progress = election.totalVoters > 0 ? (election.votesCast / election.totalVoters) * 100 : 0;
  const cfg = statusConfig[election.status];

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
              <p className="text-lg font-bold text-foreground">{election.candidateCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Candidates</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{(election.votesCast / 1000).toFixed(0)}k</p>
              <p className="text-[10px] text-muted-foreground uppercase">Votes Cast</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{progress.toFixed(1)}%</p>
              <p className="text-[10px] text-muted-foreground uppercase">Turnout</p>
            </div>
          </div>
          <Progress value={progress} className="h-1.5 bg-muted" />
          {election.status === 'active' && (
            <Button
              onClick={() => navigate('/vote')}
              className="w-full bg-primary hover:bg-primary/90"
              aria-label={`Cast vote for ${election.title}`}
            >
              Cast Your Vote <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

const Dashboard = () => {
  const { user, elections, setElections, voteReceipts } = useAppStore();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiService.getElections().then((data) => {
      setElections(data);
      setLoading(false);
    });
  }, [setElections]);

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } },
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
          Welcome back, <span className="text-gradient">{user?.name || 'Voter'}</span>
        </h1>
        <p className="text-sm text-muted-foreground">Your secure voting dashboard</p>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Vote, label: 'Cast Vote', to: '/vote', color: 'text-primary' },
          { icon: ShieldCheck, label: 'Verify Vote', to: '/verify', color: 'text-biochain-success' },
          { icon: BarChart3, label: 'View Audit', to: '/audit', color: 'text-biochain-warning' },
          { icon: Fingerprint, label: 'Identity', to: '/identity', color: 'text-biochain-cyber' },
        ].map((action, i) => (
          <motion.div key={action.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
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

      {/* Identity Status */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass border-border/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-biochain-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-biochain-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Voter Identity Verified</p>
                <p className="text-xs text-muted-foreground">DID: {user?.did || 'did:biochain:...'}</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-biochain-success/10 text-biochain-success border-biochain-success/30">
              {user?.verificationLevel || 'Verified'}
            </Badge>
          </CardContent>
        </Card>
      </motion.div>

      {/* Elections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-semibold text-foreground">Elections</h2>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Live updates</span>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="glass border-border/50 h-48 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {elections.map((election, i) => (
              <ElectionCard key={election.id} election={election} index={i} />
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
