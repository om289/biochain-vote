import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, ShieldCheck, QrCode, CheckCircle2, AlertCircle, Copy, Key, Globe, Clock, Server, Link2, Database, Boxes } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/useAppStore';
import { useNavigate } from 'react-router-dom';
import { generateQRDataURL } from '@/utils/qrGenerator';

const FLASK_URL = `http://${window.location.hostname}:5000`;

/** Generate a deterministic DID from a voter UUID */
async function generateDID(voterId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(voterId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `did:biochain:${hex.slice(0, 40)}`;
}

export default function IdentityPage() {
  const { currentVoter, isAdmin } = useAppStore();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [did, setDid] = useState('');
  const [chainInfo, setChainInfo] = useState<{ length: number; is_valid: boolean; booths: any[] } | null>(null);
  const [assignedBooth, setAssignedBooth] = useState<{ booth_id: string; booth_name: string; constituency: string; assigned: boolean } | null>(null);

  useEffect(() => {
    // Generate DID for voter
    if (currentVoter) {
      generateDID(currentVoter.id).then(setDid);
    }
    // Fetch blockchain info and assigned booth
    const fetchInfo = async () => {
      if (!currentVoter) return;
      try {
        const [blocksRes, boothsRes, boothAssignmentRes] = await Promise.all([
          fetch(`${FLASK_URL}/api/blocks`).then(r => r.json()).catch(() => null),
          fetch(`${FLASK_URL}/api/booths`).then(r => r.json()).catch(() => ({ booths: [] })),
          fetch(`${FLASK_URL}/api/voter/${currentVoter.id}/booth`).then(r => r.json()).catch(() => ({ assigned: false })),
        ]);
        setChainInfo({
          length: blocksRes?.length || 0,
          is_valid: blocksRes?.is_valid ?? false,
          booths: boothsRes?.booths || [],
        });
        setAssignedBooth(boothAssignmentRes);
      } catch {
        setChainInfo(null);
        setAssignedBooth(null);
      }
    };
    fetchInfo();
  }, [currentVoter]);

  const handleCopyDID = () => {
    navigator.clipboard.writeText(did);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Admin Booth Identity View ──
  if (!currentVoter && isAdmin) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Booth & Chain Identity</h1>
          <p className="text-sm text-muted-foreground">Blockchain Infrastructure Status — Admin View</p>
        </motion.div>

        {/* Master Chain Status */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass border-primary/30 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-white to-green-600 opacity-60" />
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Database className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-display font-bold text-foreground">Master Blockchain</p>
                    <p className="text-xs text-muted-foreground">Central consensus chain for all booths</p>
                  </div>
                </div>
                <Badge className={chainInfo?.is_valid
                  ? 'bg-biochain-success/20 text-biochain-success border-biochain-success/30'
                  : 'bg-destructive/20 text-destructive border-destructive/30'
                }>
                  {chainInfo?.is_valid ? '✓ Valid' : '✗ Invalid'}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/20">
                  <p className="text-2xl font-bold text-foreground">{chainInfo?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Blocks</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/20">
                  <p className="text-2xl font-bold text-foreground">{chainInfo?.booths?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Active Booths</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/20">
                  <p className="text-2xl font-bold text-foreground">{chainInfo?.is_valid ? '✓' : '✗'}</p>
                  <p className="text-xs text-muted-foreground">Integrity</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Registered Booths */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="text-lg font-display font-semibold text-foreground mb-3 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-primary" /> Registered Booths
          </h2>
          {chainInfo?.booths && chainInfo.booths.length > 0 ? (
            <div className="space-y-2">
              {chainInfo.booths.map((booth: any) => (
                <Card key={booth.booth_id} className="glass border-border/50">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-biochain-cyber/10 flex items-center justify-center">
                        <Server className="w-5 h-5 text-biochain-cyber" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{booth.name || booth.booth_id}</p>
                        <p className="text-xs text-muted-foreground">{booth.constituency} • {booth.blocks} blocks</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-biochain-success/10 text-biochain-success border-biochain-success/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass border-border/50">
              <CardContent className="p-8 text-center">
                <Server className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No booths registered yet. Create booths from the Admin panel.</p>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Network Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="glass border-border/50">
            <CardContent className="p-4 grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="w-3.5 h-3.5" />
                <span>Network: BioChain Local (Decentralized)</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Link2 className="w-3.5 h-3.5" />
                <span>Consensus: Proof-of-Work (4-digit)</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Not authenticated at all ──
  if (!currentVoter) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto text-center py-20 space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
        <p className="text-foreground">Please authenticate first.</p>
        <Button onClick={() => navigate('/')}>Go to Login</Button>
      </div>
    );
  }

  // ── Voter Identity View ──
  const qrData = `biochain://verify/${did}`;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Digital Identity</h1>
        <p className="text-sm text-muted-foreground">Your Self-Sovereign Identity (SSI) credentials</p>
      </motion.div>

      {/* DID Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="glass border-primary/30 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-white to-green-600 opacity-60" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Decentralized Identifier (DID)</p>
                <p className="font-mono text-sm text-primary mt-1 break-all">{did || 'Generating...'}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleCopyDID}>
                {copied ? <CheckCircle2 className="w-4 h-4 text-biochain-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="text-sm font-medium text-foreground">{currentVoter.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Voter ID</p>
                <p className="text-sm font-mono text-foreground">{currentVoter.voterIdNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Constituency</p>
                <p className="text-sm text-foreground">{currentVoter.constituency || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Blockchain Blocks</p>
                <p className="text-sm text-foreground">{chainInfo?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Credentials */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-lg font-display font-semibold text-foreground mb-3">Verifiable Credentials</h2>
        <div className="space-y-3">
          <Card className="glass border-border/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-biochain-success/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-biochain-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Voter Identity Credential</p>
                  <p className="text-xs text-muted-foreground">Issued by Election Commission of India</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-biochain-success/10 text-biochain-success border-biochain-success/30">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Valid
              </Badge>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Fingerprint className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Biometric Authentication</p>
                  <p className="text-xs text-muted-foreground">
                    {currentVoter.fingerprint ? 'Fingerprint registered & verified' : 'Not yet enrolled'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={currentVoter.fingerprint
                ? 'bg-biochain-success/10 text-biochain-success border-biochain-success/30'
                : 'bg-destructive/10 text-destructive border-destructive/30'
              }>
                {currentVoter.fingerprint ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Active</> : 'Not Enrolled'}
              </Badge>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-biochain-cyber/10 flex items-center justify-center">
                  <Key className="w-5 h-5 text-biochain-cyber" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Blockchain Verification</p>
                  <p className="text-xs text-muted-foreground">Chain integrity status</p>
                </div>
              </div>
              <Badge variant="outline" className={chainInfo?.is_valid
                ? 'bg-biochain-success/10 text-biochain-success border-biochain-success/30'
                : 'bg-destructive/10 text-destructive border-destructive/30'
              }>
                {chainInfo?.is_valid ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Verified</> : 'Checking...'}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* QR Codes section */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Identity QR */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="glass border-border/50 h-full">
            <CardHeader>
              <CardTitle className="text-base font-display flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" /> Identity QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <div className="mx-auto w-40 h-40 bg-white rounded-xl p-3 flex items-center justify-center">
                <div className="w-full h-full border-4 border-black rounded-lg flex items-center justify-center relative">
                  <div className="absolute top-1 left-1 w-6 h-6 border-4 border-black" />
                  <div className="absolute top-1 right-1 w-6 h-6 border-4 border-black" />
                  <div className="absolute bottom-1 left-1 w-6 h-6 border-4 border-black" />
                  <QrCode className="w-8 h-8 text-black" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono break-all line-clamp-2" title={qrData}>{qrData}</p>
              <p className="text-xs text-muted-foreground">
                Official Digital Identity Verification
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Booth Voting Pass QR */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="glass border-biochain-warning/30 h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-biochain-warning/20 to-transparent pointer-events-none" />
            <CardHeader>
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Server className="w-5 h-5 text-biochain-warning" /> Booth Voting Pass
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              {assignedBooth?.assigned ? (
                <>
                  <img
                    src={generateQRDataURL(`biochain://voter/${currentVoter.id}/booth/${assignedBooth.booth_id}`, 160)}
                    alt="Booth Voting Pass QR"
                    className="mx-auto rounded-lg border border-border bg-white p-2"
                  />
                  <p className="text-sm font-medium text-foreground mt-2">{assignedBooth.booth_name}</p>
                  <p className="text-[10px] text-biochain-warning font-mono break-all uppercase">
                    Booth ID: {assignedBooth.booth_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Show this pass at your designated voting booth
                  </p>
                </>
              ) : (
                <div className="py-8 space-y-3">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Not Assigned</p>
                  <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
                    You have not been assigned to a voting booth yet. Please contact the election officer.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Metadata */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="glass border-border/50">
          <CardContent className="p-4 grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Registered: {currentVoter.registeredAt ? new Date(currentVoter.registeredAt).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="w-3.5 h-3.5" />
              <span>Network: BioChain Decentralized</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
