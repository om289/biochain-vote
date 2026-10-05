import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Search, Loader2, ArrowRight, CheckCircle2, XCircle, ChevronRight, Fingerprint, Network, Fingerprint as FingerprintIcon, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/useAppStore';
import { apiService } from '@/services/apiService';
import { blockchainService, type MerkleVerificationResult } from '@/services/blockchainService';
import { type VoteRecord } from '@/services/dbService';

export default function VerifyPage() {
  const { currentVoter, voteReceipts } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [verificationResult, setVerificationResult] = useState<MerkleVerificationResult | null>(null);
  const [error, setError] = useState('');
  const [myVotes, setMyVotes] = useState<VoteRecord[]>([]);
  const [isLoadingVotes, setIsLoadingVotes] = useState(false);

  useEffect(() => {
    const loadMyVotes = async () => {
      if (!currentVoter) return;
      setIsLoadingVotes(true);
      try {
        const votes = await apiService.getVotesByVoter(currentVoter.id);
        setMyVotes(votes);
      } catch (err) {
        console.error("Failed to load user votes:", err);
      } finally {
        setIsLoadingVotes(false);
      }
    };
    loadMyVotes();
  }, [currentVoter]);

  const handleVerify = async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setError('');
    setVerificationResult(null);

    try {
      // Small simulated network delay to show the animation (since local DB is too fast)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const result = await blockchainService.verifyVote(query.trim());
      setVerificationResult(result);
      if (!result.included) {
        setError('Vote not found. This may mean the vote was cast on a different browser/device where IndexedDB is stored, or the local chain has been cleared. Check the "Your Recent Votes" section below to verify directly.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. The local blockchain could not verify this hash.');
      setVerificationResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto w-16 h-16 rounded-2xl bg-biochain-success/10 flex items-center justify-center mb-6"
        >
          <ShieldCheck className="w-8 h-8 text-biochain-success" />
        </motion.div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
          Verify Your Vote
        </h1>
        <p className="text-lg text-muted-foreground">
          Enter your Transaction Hash to cryptographically verify your vote's inclusion in the offline blockchain.
        </p>
      </div>

      <Card className="glass border-primary/20 shadow-2xl max-w-3xl mx-auto">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Enter Transaction Hash (e.g., 8f4e...)"
                className="h-14 pl-12 text-lg bg-background/50 border-border focus:border-primary font-mono text-foreground"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify(searchQuery)}
              />
            </div>
            <Button 
              onClick={() => handleVerify(searchQuery)} 
              disabled={isSearching || !searchQuery.trim()}
              className="h-14 px-8 text-lg bg-primary hover:bg-primary/90"
            >
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify'}
            </Button>
          </div>

          <AnimatePresence mode="wait">
            {error && !isSearching && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3"
              >
                <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Verification Failed</p>
                  <p className="text-sm text-destructive/80 mt-1">{error}</p>
                </div>
              </motion.div>
            )}

            {verificationResult && !isSearching && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-8 space-y-6"
              >
                <div className={`p-6 rounded-2xl border ${verificationResult.included ? 'bg-biochain-success/5 border-biochain-success/20' : 'bg-destructive/5 border-destructive/20'}`}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${verificationResult.included ? 'bg-biochain-success/20 text-biochain-success' : 'bg-destructive/20 text-destructive'}`}>
                      {verificationResult.included ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">
                        {verificationResult.included ? 'Vote Verified' : 'Vote Not Found'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {verificationResult.included 
                          ? 'Cryptographically proven to be in the local blockchain.' 
                          : 'This transaction hash could not be verified locally.'}
                      </p>
                    </div>
                  </div>

                  {verificationResult.included && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-background/50 rounded-lg p-4 border border-border">
                          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Transaction Hash (Leaf)</p>
                          <p className="font-mono text-sm text-foreground break-all">{verificationResult.leafHash}</p>
                        </div>
                        <div className="bg-background/50 rounded-lg p-4 border border-border">
                          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Merkle Root</p>
                          <p className="font-mono text-sm text-foreground break-all">{verificationResult.merkleRoot}</p>
                        </div>
                      </div>
                      
                      <div className="bg-background/50 rounded-lg p-4 border border-border">
                        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                          <Network className="w-4 h-4" /> Client-Side Merkle Proof
                        </p>
                        <div className="space-y-2">
                          {verificationResult.proof.map((step, idx) => (
                            <div key={idx} className="flex items-center gap-3 text-xs font-mono">
                              <span className="text-muted-foreground w-4">{idx + 1}.</span>
                              <Badge variant="outline" className={step.position === 'left' ? 'text-blue-400' : 'text-purple-400'}>
                                {step.position.toUpperCase()}
                              </Badge>
                              <span className="text-muted-foreground truncate">{step.hash}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-sm text-biochain-success">
                          <CheckCircle2 className="w-4 h-4" /> 
                          Proof validated locally using SHA-256
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Recent Votes / Receipts (Offline) */}
      {currentVoter && (
        <div className="max-w-3xl mx-auto pt-8">
          <h2 className="text-xl font-display font-bold text-foreground mb-4">Your Recent Votes</h2>
          
          {isLoadingVotes ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : myVotes.length > 0 ? (
            <div className="space-y-3">
              {myVotes.map((vote) => (
                <Card 
                  key={vote.id} 
                  className="glass border-border/50 hover:border-primary/30 transition-all cursor-pointer"
                  onClick={() => {
                    setSearchQuery(vote.blockHash);
                    handleVerify(vote.blockHash);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-primary/5 text-primary">Local Chain</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(vote.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="font-mono text-sm text-foreground mb-1 break-all">
                        {vote.blockHash}
                      </p>
                    </div>
                  <div className="flex items-center gap-2">
                      <Button
                        variant="ghost" size="sm"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(vote.blockHash); }}
                        title="Copy hash"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="shrink-0 group"
                        onClick={() => { setSearchQuery(vote.blockHash); handleVerify(vote.blockHash); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      >
                        Verify <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </Button>
                  </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
             <Card className="glass border-border/50">
              <CardContent className="p-8 text-center text-muted-foreground flex flex-col items-center">
                <FingerprintIcon className="w-12 h-12 mb-3 opacity-20" />
                <p>No votes found for your identity on the local blockchain.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
