import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, ShieldCheck, QrCode, CheckCircle2, AlertCircle, Copy, Key, Globe, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/useAppStore';
import { useNavigate } from 'react-router-dom';

export default function IdentityPage() {
  const { currentVoter } = useAppStore();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!currentVoter) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto text-center py-20 space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
        <p className="text-foreground">Please authenticate first.</p>
        <Button onClick={() => navigate('/')}>Go to Login</Button>
      </div>
    );
  }

  const handleCopyDID = () => {
    navigator.clipboard.writeText(currentVoter.did);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskedAadhaar = `XXXX-XXXX-${currentVoter.aadhaarNumber.slice(-4)}`;
  const qrData = `biochain://verify/${currentVoter.did}`;

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
                <p className="font-mono text-sm text-primary mt-1 break-all">{currentVoter.did}</p>
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
                <p className="text-xs text-muted-foreground">Aadhaar (Masked)</p>
                <p className="text-sm font-mono text-foreground">{maskedAadhaar}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Voter ID</p>
                <p className="text-sm font-mono text-foreground">{currentVoter.voterIdNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Constituency</p>
                <p className="text-sm text-foreground">{currentVoter.constituency}</p>
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
                  <p className="text-xs text-muted-foreground">Fingerprint registered & verified</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-biochain-success/10 text-biochain-success border-biochain-success/30">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Active
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
                  <p className="text-sm font-medium text-foreground">Aadhaar Link Verification</p>
                  <p className="text-xs text-muted-foreground">UIDAI • Aadhaar linked to DID</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-biochain-success/10 text-biochain-success border-biochain-success/30">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Linked
              </Badge>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* QR Code section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" /> Identity QR Code
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            {/* Simple QR representation */}
            <div className="mx-auto w-40 h-40 bg-white rounded-xl p-3 flex items-center justify-center">
              <div className="w-full h-full border-4 border-black rounded-lg flex items-center justify-center relative">
                <div className="absolute top-1 left-1 w-6 h-6 border-4 border-black" />
                <div className="absolute top-1 right-1 w-6 h-6 border-4 border-black" />
                <div className="absolute bottom-1 left-1 w-6 h-6 border-4 border-black" />
                <QrCode className="w-8 h-8 text-black" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{qrData}</p>
            <p className="text-xs text-muted-foreground">
              Share this QR code for identity verification at polling booths
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Metadata */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="glass border-border/50">
          <CardContent className="p-4 grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Registered: {new Date(currentVoter.registeredAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="w-3.5 h-3.5" />
              <span>Network: BioChain Local (Offline)</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
