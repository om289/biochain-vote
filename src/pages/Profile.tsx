import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Fingerprint, MapPin, CreditCard, Hash, Calendar, Shield, LogOut, Moon, Sun, CheckCircle2, AlertCircle, Clock, Vote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAppStore } from '@/store/useAppStore';
import { apiService } from '@/services/apiService';
import { useNavigate } from 'react-router-dom';
import type { VoteRecord } from '@/services/dbService';

export default function ProfilePage() {
  const { currentVoter, currentTheme, toggleTheme, logout, voteReceipts } = useAppStore();
  const navigate = useNavigate();
  const [voterVotes, setVoterVotes] = useState<VoteRecord[]>([]);

  useEffect(() => {
    if (currentVoter) {
      apiService.getVotesByVoter(currentVoter.id).then(setVoterVotes);
    }
  }, [currentVoter]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!currentVoter) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto text-center py-20 space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
        <p className="text-foreground">Please authenticate first.</p>
        <Button onClick={() => navigate('/')}>Go to Login</Button>
      </div>
    );
  }

  const maskedAadhaar = `XXXX-XXXX-${currentVoter.aadhaarNumber.slice(-4)}`;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Profile & Settings</h1>
        <p className="text-sm text-muted-foreground">Your voter profile and system settings</p>
      </motion.div>

      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="glass border-border/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-white to-green-600 opacity-60" />
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <User className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-foreground">{currentVoter.name}</h2>
                <p className="text-sm text-muted-foreground">{currentVoter.constituency}, {currentVoter.state}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="bg-biochain-success/10 text-biochain-success border-biochain-success/30 text-[10px]">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Verified Voter
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" /> Aadhaar Number</p>
                <p className="text-sm font-mono text-foreground">{maskedAadhaar}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> Voter ID</p>
                <p className="text-sm font-mono text-foreground">{currentVoter.voterIdNumber}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Date of Birth</p>
                <p className="text-sm text-foreground">{new Date(currentVoter.dateOfBirth).toLocaleDateString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Gender</p>
                <p className="text-sm text-foreground capitalize">{currentVoter.gender}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> District</p>
                <p className="text-sm text-foreground">{currentVoter.district}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Registered</p>
                <p className="text-sm text-foreground">{new Date(currentVoter.registeredAt).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Biometric Status */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-primary" /> Biometric Device
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-biochain-success/10 flex items-center justify-center">
                  <Fingerprint className="w-4 h-4 text-biochain-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Fingerprint Sensor</p>
                  <p className="text-xs text-muted-foreground">External USB sensor • Registered</p>
                </div>
              </div>
              <Badge className="bg-biochain-success/20 text-biochain-success border-biochain-success/30">Connected</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Credential ID: <span className="font-mono">{currentVoter.fingerprint}</span>
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Vote History from DB */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Vote className="w-5 h-5 text-biochain-warning" /> Vote History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {voterVotes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No votes cast yet.</p>
            ) : (
              <div className="space-y-2">
                {voterVotes.map(vote => (
                  <div key={vote.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-biochain-success" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Election: {vote.electionId}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">Block #{vote.blockIndex} • {vote.blockHash.slice(0, 16)}...</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(vote.timestamp).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Settings */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-display">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentTheme === 'dark' ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-biochain-warning" />}
                <div>
                  <p className="text-sm font-medium text-foreground">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">Toggle between dark and light themes</p>
                </div>
              </div>
              <Switch checked={currentTheme === 'dark'} onCheckedChange={toggleTheme} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Security Level</p>
                  <p className="text-xs text-muted-foreground">Biometric + blockchain verification</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-biochain-success/10 text-biochain-success">Maximum</Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Logout */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Button variant="outline" onClick={handleLogout} className="w-full border-destructive/30 text-destructive hover:bg-destructive/10">
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </motion.div>
    </div>
  );
}
