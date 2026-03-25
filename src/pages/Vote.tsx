import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Vote as VoteIcon, Fingerprint, CheckCircle2, ArrowRight, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/useAppStore';
import { apiService } from '@/services/apiService';
import { biometricService } from '@/services/biometricService';
import type { ElectionRecord, CandidateRecord } from '@/services/dbService';
import { useNavigate } from 'react-router-dom';

type Step = 'select-election' | 'select-candidate' | 'confirm' | 'verify-fingerprint' | 'success';

export default function VotePage() {
  const { currentVoter, addVoteReceipt } = useAppStore();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('select-election');
  const [elections, setElections] = useState<ElectionRecord[]>([]);
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [selectedElection, setSelectedElection] = useState<ElectionRecord | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null);
  const [votedElections, setVotedElections] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voteResult, setVoteResult] = useState<{ blockHash: string; blockIndex: number } | null>(null);
  const [assignedBooth, setAssignedBooth] = useState<{ booth_id: string; assigned: boolean } | null>(null);

  const FLASK_URL = `http://${window.location.hostname}:5000`;

  useEffect(() => {
    const load = async () => {
      if (!currentVoter) return;
      
      // 1. Fetch voter's assigned booth
      let boothAssigned = false;
      let boothId = null;
      let boothElections: string[] = [];
      try {
        const boothRes = await fetch(`${FLASK_URL}/api/voter/${currentVoter.id}/booth`);
        const boothData = await boothRes.json();
        setAssignedBooth(boothData);
        boothAssigned = boothData.assigned;
        boothId = boothData.booth_id;

        // 2. Fetch elections for that booth
        if (boothAssigned && boothId) {
            const elecRes = await fetch(`${FLASK_URL}/api/booths`);
            const boothesData = await elecRes.json();
            const myBooth = boothesData.booths?.find((b: any) => b.booth_id === boothId);
            if (myBooth) {
                boothElections = myBooth.assigned_elections || [];
            }
        }
      } catch (e) {
        console.error("Failed to fetch booth info", e);
      }

      // 3. Fetch all elections and filter
      const allElections = await apiService.getElections();
      
      if (!boothAssigned) {
        setElections([]); // Can't vote if not assigned to a booth
      } else {
        const active = allElections.filter(
          e => e.status === 'active' && boothElections.includes(e.id)
        );
        setElections(active);
      }

      const voterVotes = await apiService.getVotesByVoter(currentVoter.id);
      setVotedElections(new Set(voterVotes.map(v => v.electionId)));
      setLoading(false);
    };
    load();
  }, [currentVoter]);

  const handleSelectElection = async (election: ElectionRecord) => {
    setSelectedElection(election);
    const cands = await apiService.getCandidates(election.id);
    setCandidates(cands);
    setStep('select-candidate');
  };

  const handleSelectCandidate = (candidate: CandidateRecord) => {
    setSelectedCandidate(candidate);
    setStep('confirm');
  };

  const handleConfirm = () => {
    setStep('verify-fingerprint');
  };

  const handleFingerprintVerify = async () => {
    if (!currentVoter || !selectedElection || !selectedCandidate) return;
    setScanning(true);
    setError('');

    try {
      const result = await biometricService.reVerify(currentVoter.id);
      if (!result.success) {
        setError(result.error || 'Fingerprint verification failed');
        setScanning(false);
        return;
      }

      // Cast the vote
      const vote = await apiService.castVote(
        selectedElection.id, 
        currentVoter.id, 
        selectedCandidate.id, 
        selectedCandidate.name,
        assignedBooth?.booth_id
      );

      setVoteResult({ blockHash: vote.blockHash, blockIndex: vote.blockIndex });

      addVoteReceipt({
        id: vote.id,
        electionId: selectedElection.id,
        electionTitle: selectedElection.title,
        candidateId: selectedCandidate.id,
        candidateName: selectedCandidate.name,
        transactionHash: vote.blockHash,
        blockNumber: vote.blockIndex,
        timestamp: vote.timestamp,
        status: 'confirmed',
      });

      setStep('success');
    } catch (e: any) {
      setError(e.message || 'Vote casting failed');
    } finally {
      setScanning(false);
    }
  };

  if (!currentVoter) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto text-center py-20">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <p className="text-foreground">Please authenticate first.</p>
        <Button onClick={() => navigate('/')} className="mt-4">Go to Login</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Step indicator */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        {['Select Election', 'Choose Candidate', 'Confirm', 'Verify', 'Done'].map((s, i) => {
          const stepIndex = ['select-election', 'select-candidate', 'confirm', 'verify-fingerprint', 'success'].indexOf(step);
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i <= stepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {i + 1}
              </div>
              <span className={i <= stepIndex ? 'text-foreground' : ''}>{s}</span>
              {i < 4 && <div className={`w-4 h-0.5 ${i < stepIndex ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          );
        })}
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 'select-election' && (
          <motion.div key="select-election" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-display font-bold text-foreground">Select Election</h1>
              <p className="text-sm text-muted-foreground">Choose an active election in your constituency</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : !assignedBooth?.assigned ? (
              <Card className="glass border-border/50">
                <CardContent className="p-8 text-center space-y-3">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-2">
                    <AlertCircle className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-foreground font-medium">Not Assigned to a Booth</p>
                  <p className="text-sm text-muted-foreground">You must be assigned to a polling booth by an election officer before you can vote.</p>
                </CardContent>
              </Card>
            ) : elections.length === 0 ? (
              <Card className="glass border-border/50">
                <CardContent className="p-8 text-center space-y-3">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-2">
                    <AlertCircle className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-foreground font-medium">No Active Elections</p>
                  <p className="text-sm text-muted-foreground">There are no active elections assigned to your current polling booth.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {elections.map(election => {
                  const hasVoted = votedElections.has(election.id);
                  return (
                    <Card
                      key={election.id}
                      className={`glass border-border/50 transition-all cursor-pointer ${hasVoted ? 'opacity-50' : 'hover:border-primary/40'}`}
                      onClick={() => !hasVoted && handleSelectElection(election)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{election.title}</p>
                          <p className="text-xs text-muted-foreground">{election.description}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{election.constituency}, {election.state}</p>
                        </div>
                        {hasVoted ? (
                          <Badge className="bg-biochain-success/20 text-biochain-success border-biochain-success/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Voted
                          </Badge>
                        ) : (
                          <ArrowRight className="w-5 h-5 text-muted-foreground" />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {step === 'select-candidate' && selectedElection && (
          <motion.div key="select-candidate" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Button variant="ghost" onClick={() => setStep('select-election')} className="text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>

            <div className="text-center mb-4">
              <h1 className="text-2xl font-display font-bold text-foreground">Choose Candidate</h1>
              <p className="text-sm text-muted-foreground">{selectedElection.title}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {candidates.map(candidate => (
                <Card
                  key={candidate.id}
                  className="glass border-border/50 hover:border-primary/40 transition-all cursor-pointer group"
                  onClick={() => handleSelectCandidate(candidate)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                        {candidate.partySymbol}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors">{candidate.name}</p>
                        <p className="text-xs text-primary font-medium">{candidate.partyName}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{candidate.manifesto}</p>
                        <p className="text-[10px] text-muted-foreground">Age: {candidate.age} • {candidate.qualification}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'confirm' && selectedElection && selectedCandidate && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <Button variant="ghost" onClick={() => setStep('select-candidate')} className="text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>

            <div className="text-center">
              <h1 className="text-2xl font-display font-bold text-foreground">Confirm Your Vote</h1>
              <p className="text-sm text-muted-foreground">Please review your selection carefully</p>
            </div>

            <Card className="glass border-primary/30">
              <CardContent className="p-6 space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Election</p>
                  <p className="font-display font-bold text-foreground">{selectedElection.title}</p>
                </div>

                <div className="border-t border-border/50 pt-4 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center text-3xl">
                    {selectedCandidate.partySymbol}
                  </div>
                  <div>
                    <p className="font-bold text-lg text-foreground">{selectedCandidate.name}</p>
                    <p className="text-sm text-primary">{selectedCandidate.partyName}</p>
                  </div>
                </div>

                <div className="text-center text-xs text-muted-foreground bg-destructive/5 rounded-lg p-3 border border-destructive/20">
                  <AlertCircle className="w-4 h-4 text-destructive inline mr-1" />
                  Once confirmed, your vote cannot be changed. This action is irreversible.
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('select-candidate')} className="flex-1">
                Change Selection
              </Button>
              <Button onClick={handleConfirm} className="flex-1 bg-primary">
                Confirm & Verify <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'verify-fingerprint' && (
          <motion.div key="verify-fingerprint" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center space-y-6">
            <h1 className="text-2xl font-display font-bold text-foreground">Biometric Re-Verification</h1>
            <p className="text-sm text-muted-foreground">Use Touch ID or fingerprint to authorize this vote</p>

            {/* Scanner */}
            <div className="relative mx-auto w-40 h-40">
              <div className={`absolute inset-0 rounded-full border-2 border-primary/30 ${scanning ? 'animate-scanner-pulse' : ''}`} />
              <div className="absolute inset-6 rounded-full bg-primary/5 flex items-center justify-center">
                <Fingerprint className={`w-14 h-14 transition-colors duration-500 ${scanning ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              {scanning && (
                <div className="absolute inset-6 rounded-full overflow-hidden">
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
                </div>
              )}
            </div>

            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}

            <div className="space-y-3">
              <Button onClick={handleFingerprintVerify} disabled={scanning} className="w-full h-12 bg-primary">
                {scanning ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Verifying & Recording Vote...
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5 mr-2" />
                    Verify & Submit Vote
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={() => setStep('confirm')} disabled={scanning} className="text-muted-foreground">
                Go back
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'success' && voteResult && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="mx-auto w-20 h-20 rounded-full bg-biochain-success/10 flex items-center justify-center glow-success"
            >
              <CheckCircle2 className="w-10 h-10 text-biochain-success" />
            </motion.div>

            <div className="space-y-2">
              <h1 className="text-2xl font-display font-bold text-foreground">Vote Recorded!</h1>
              <p className="text-sm text-muted-foreground">Your vote has been securely recorded on the blockchain.</p>
            </div>

            <Card className="glass border-biochain-success/30">
              <CardContent className="p-4 space-y-3 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Block Number</span>
                  <span className="font-mono text-foreground">#{voteResult.blockIndex}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Block Hash</span>
                  <span className="font-mono text-foreground text-xs">{voteResult.blockHash.slice(0, 20)}...</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className="bg-biochain-success/20 text-biochain-success">Confirmed</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Candidate</span>
                  <span className="text-foreground">{selectedCandidate?.partySymbol} {selectedCandidate?.name}</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/verify')} className="flex-1">
                Verify Vote
              </Button>
              <Button onClick={() => navigate('/dashboard')} className="flex-1 bg-primary">
                Back to Dashboard
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
