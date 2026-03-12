import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Search, CheckCircle2, AlertCircle, Hash, Clock, Link2, Loader2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { localBlockchain } from '@/services/localBlockchain';
import type { Block } from '@/services/localBlockchain';

export default function VerifyPage() {
  const [searchHash, setSearchHash] = useState('');
  const [block, setBlock] = useState<Block | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searching, setSearching] = useState(false);
  const [chainStatus, setChainStatus] = useState<{ valid: boolean; totalBlocks: number; error?: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleSearch = async () => {
    if (!searchHash.trim()) return;
    setSearching(true);
    setNotFound(false);
    setBlock(null);

    const found = await localBlockchain.getBlockByHash(searchHash.trim());
    if (found) {
      setBlock(found);
    } else {
      // Try by block index
      const idx = parseInt(searchHash.trim().replace('#', ''));
      if (!isNaN(idx)) {
        const byIdx = await localBlockchain.getBlockByIndex(idx);
        if (byIdx) {
          setBlock(byIdx);
        } else {
          setNotFound(true);
        }
      } else {
        setNotFound(true);
      }
    }
    setSearching(false);
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    const result = await localBlockchain.verifyChain();
    setChainStatus(result);
    setVerifying(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Vote Verification</h1>
        <p className="text-sm text-muted-foreground">Verify your vote on the blockchain using transaction hash or block number</p>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter block hash or block number (e.g. #5)"
                  value={searchHash}
                  onChange={e => setSearchHash(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="pl-9 bg-card"
                />
              </div>
              <Button onClick={handleSearch} disabled={searching} className="bg-primary">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 mr-1" /> Search</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Block Details */}
      {block && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass border-biochain-success/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-biochain-success" />
                  Block #{block.index}
                </CardTitle>
                <Badge variant="outline" className="bg-biochain-success/10 text-biochain-success border-biochain-success/30">
                  Verified
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="flex justify-between items-start p-3 rounded-lg bg-muted/20">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Block Index</span>
                  <span className="font-mono text-sm text-foreground font-bold">{block.index}</span>
                </div>
                <div className="flex justify-between items-start p-3 rounded-lg bg-muted/20">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Hash</span>
                  <span className="font-mono text-xs text-foreground break-all max-w-[300px] text-right">{block.hash}</span>
                </div>
                <div className="flex justify-between items-start p-3 rounded-lg bg-muted/20">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Previous Hash</span>
                  <span className="font-mono text-xs text-muted-foreground break-all max-w-[300px] text-right">{block.previousHash}</span>
                </div>
                <div className="flex justify-between items-start p-3 rounded-lg bg-muted/20">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Timestamp</span>
                  <span className="text-sm text-foreground">{new Date(block.timestamp).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-start p-3 rounded-lg bg-muted/20">
                  <span className="text-sm text-muted-foreground">Type</span>
                  <Badge variant="outline">{block.data.type}</Badge>
                </div>
                <div className="flex justify-between items-start p-3 rounded-lg bg-muted/20">
                  <span className="text-sm text-muted-foreground">Nonce</span>
                  <span className="font-mono text-sm text-foreground">{block.nonce}</span>
                </div>
              </div>

              {block.data.type === 'vote' && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm font-medium text-foreground mb-2">Vote Details (Privacy-Preserved)</p>
                  <div className="grid gap-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Voter Hash</span>
                      <span className="font-mono truncate max-w-[200px]">{block.data.payload.voterHash}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Election ID</span>
                      <span className="font-mono">{block.data.payload.electionId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Candidate ID</span>
                      <span className="font-mono">{block.data.payload.candidateId}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {notFound && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass border-destructive/30">
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
              <p className="text-sm text-foreground">No block found with that hash or index.</p>
              <p className="text-xs text-muted-foreground mt-1">Make sure you entered the correct transaction hash from your vote receipt.</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Chain Verification */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Full Chain Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Verify the integrity of the entire blockchain. This checks every block's hash and link to detect any tampering.
            </p>
            <Button onClick={handleVerifyChain} disabled={verifying} className="w-full bg-primary">
              {verifying ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying Chain...</>
              ) : (
                <><ShieldCheck className="w-4 h-4 mr-2" /> Verify Entire Blockchain</>
              )}
            </Button>

            {chainStatus && (
              <div className={`p-4 rounded-lg ${chainStatus.valid ? 'bg-biochain-success/5 border border-biochain-success/20' : 'bg-destructive/5 border border-destructive/20'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {chainStatus.valid ? (
                    <CheckCircle2 className="w-5 h-5 text-biochain-success" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  )}
                  <p className="font-medium text-foreground">
                    {chainStatus.valid ? 'Blockchain Integrity Verified ✓' : 'Chain Integrity Compromised!'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total blocks: {chainStatus.totalBlocks}
                  {chainStatus.error && <span className="text-destructive block mt-1">{chainStatus.error}</span>}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
