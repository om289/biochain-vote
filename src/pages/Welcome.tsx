import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Fingerprint, Users, Loader2, CheckCircle2, ArrowRight, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { fingerprintVerify } from '@/services/biometricService';
import { apiService } from '@/services/apiService';

type Screen = 'welcome' | 'voter-select' | 'touchid-verify' | 'admin-pin';

const DEFAULT_PASSWORD = '1234';

const Welcome = () => {
  const navigate = useNavigate();
  const { setCurrentVoter, setAuthenticated, setAdmin, dbInitialized, setDbInitialized } = useAppStore();
  const [screen, setScreen] = useState<Screen>('welcome');
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState(true);
  const [voterList, setVoterList] = useState<any[]>([]);
  const [touchIdAvailable, setTouchIdAvailable] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<any>(null);
  const [touchIdStatus, setTouchIdStatus] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [voterPassword, setVoterPassword] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        if (!dbInitialized) {
          await apiService.initialize();
          setDbInitialized(true);
        }
        // Check if the physical Nitgen fingerprint service is running
        try {
          const res = await fetch('http://127.0.0.1:5000/status', { signal: AbortSignal.timeout(2000) });
          setTouchIdAvailable(res.ok);
        } catch {
          setTouchIdAvailable(false);
        }
      } catch (err) {
        console.warn('[Welcome] Init error (non-fatal):', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [dbInitialized, setDbInitialized]);

  /** Show voter list for selection */
  const handleSelectVoter = async () => {
    const voters = await apiService.getVoters();
    setVoterList(voters);
    setScreen('voter-select');
  };

  /** Voter selected — go to verification screen */
  const handleVoterChosen = (voter: any) => {
    setSelectedVoter(voter);
    setScreen('touchid-verify');
    setTouchIdStatus('idle');
    setPinError('');
    setVoterPassword('');
  };

  /** Complete login */
  const completeLogin = (voter: any) => {
    setCurrentVoter(voter);
    setAuthenticated(true);
    setAdmin(false);
    navigate('/dashboard');
  };

  /** Password-based login */
  const handlePasswordLogin = () => {
    if (!selectedVoter) return;
    if (voterPassword === DEFAULT_PASSWORD) {
      setTouchIdStatus('success');
      setTimeout(() => completeLogin(selectedVoter), 400);
    } else {
      setPinError('Incorrect password. Please try again.');
    }
  };

  /** Trigger fingerprint scan and login */
  const handleTouchIdVerify = async () => {
    if (!selectedVoter) return;
    setTouchIdStatus('scanning');

    const result = await fingerprintVerify(selectedVoter.id);

    if (result.match) {
      setTouchIdStatus('success');
      // Brief pause to show success animation
      await new Promise(r => setTimeout(r, 600));
      completeLogin(selectedVoter);
    } else {
      setTouchIdStatus('failed');
      setPinError(result.error || 'Fingerprint did not match. Please try again or use password.');
    }
  };

  /** Admin login */
  const handleAdminLogin = async () => {
    if (adminPin.length < 4) {
      setPinError('PIN must be at least 4 characters');
      return;
    }
    const valid = await apiService.verifyAdminPin(adminPin);
    if (valid) {
      setAuthenticated(true);
      setAdmin(true);
      setCurrentVoter(null);
      navigate('/admin');
    } else {
      setPinError('Invalid admin PIN');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4"
        >
          <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
          <p className="text-muted-foreground text-sm">Initializing BioChain Vote...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-biochain-glow/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-primary/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-primary/5 rounded-full" />
        {/* India tricolor accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-white to-green-600 opacity-60" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto px-6">
        <AnimatePresence mode="wait">
          {/* -- Welcome Screen -- */}
          {screen === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-8"
            >
              {/* Logo */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="mx-auto w-24 h-24 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center glow-primary"
              >
                <ShieldCheck className="w-12 h-12 text-primary" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="space-y-3"
              >
                <h1 className="text-4xl font-display font-bold text-foreground">
                  Bio<span className="text-gradient">Chain</span> Vote
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                  Decentralized Voting System for India — Tamper-proof, Transparent &amp; Secure
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Powered by Blockchain &amp; Biometric Verification
                </p>
                {touchIdAvailable && (
                  <p className="text-xs text-primary/80 font-medium flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Touch ID detected — biometric verification enabled
                  </p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="space-y-3"
              >
                <Button
                  onClick={handleSelectVoter}
                  className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90"
                  aria-label="Select voter and authenticate"
                >
                  <Fingerprint className="w-5 h-5 mr-2" />
                  {touchIdAvailable ? 'Select Voter & Verify' : 'Select Voter & Login'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setScreen('admin-pin')}
                  className="w-full h-10 text-sm text-muted-foreground"
                  aria-label="Admin login"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Admin Panel Login
                </Button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-xs text-muted-foreground"
              >
                Secured by SHA-256 blockchain &amp; offline tamper-proof ledger
              </motion.p>
            </motion.div>
          )}

          {/* -- Voter Selection Screen -- */}
          {screen === 'voter-select' && (
            <motion.div
              key="voter-select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h2 className="text-2xl font-display font-bold text-foreground">Select Your Identity</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose your voter profile to proceed
                </p>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {voterList.map((voter) => (
                  <Button
                    key={voter.id}
                    variant="outline"
                    onClick={() => handleVoterChosen(voter)}
                    className="w-full h-auto py-3 px-4 text-left flex flex-col items-start border-border hover:border-primary/40"
                  >
                    <span className="font-medium text-foreground">{voter.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {voter.constituency}, {voter.state} — Voter ID: {voter.voterIdNumber}
                    </span>
                  </Button>
                ))}
              </div>

              <Button
                variant="ghost"
                onClick={() => setScreen('welcome')}
                className="w-full text-muted-foreground"
              >
                Back
              </Button>
            </motion.div>
          )}

          {/* -- Verification Screen (Password + Optional Fingerprint) -- */}
          {screen === 'touchid-verify' && selectedVoter && (
            <motion.div
              key="touchid-verify"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-2xl font-display font-bold text-foreground">Verify Identity</h2>
                <p className="text-sm text-muted-foreground">
                  Logging in as <span className="text-foreground font-medium">{selectedVoter.name}</span>
                </p>
              </div>

              {/* Password login */}
              <div className="space-y-3 max-w-[280px] mx-auto">
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={voterPassword}
                    onChange={(e) => { setVoterPassword(e.target.value); setPinError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()}
                    placeholder="Enter password"
                    className="pl-10 h-12 bg-card border-border text-center"
                    aria-label="Voter password"
                    disabled={touchIdStatus === 'success'}
                  />
                </div>
                <Button
                  onClick={handlePasswordLogin}
                  disabled={touchIdStatus === 'scanning' || touchIdStatus === 'success' || !voterPassword}
                  className="w-full h-11 bg-primary"
                >
                  {touchIdStatus === 'success' ? (
                    <><CheckCircle2 className="w-5 h-5 mr-2" /> Verified</>
                  ) : (
                    <><KeyRound className="w-5 h-5 mr-2" /> Login with Password</>
                  )}
                </Button>
              </div>

              {/* Divider */}
              {touchIdAvailable && (
                <div className="flex items-center gap-3 max-w-[280px] mx-auto">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

              {/* Fingerprint option (only when sensor available) */}
              {touchIdAvailable && (
                <div className="space-y-3">
                  {/* Scanner visualization */}
                  <div className="relative mx-auto w-32 h-32">
                    <div className={cn(
                      "absolute inset-0 rounded-full border-2 transition-colors duration-500",
                      touchIdStatus === 'success' ? "border-biochain-success/60" :
                        touchIdStatus === 'failed' ? "border-destructive/60" :
                          touchIdStatus === 'scanning' ? "border-primary/60 animate-scanner-pulse" :
                            "border-primary/30"
                    )} />
                    <div className={cn(
                      "absolute inset-4 rounded-full flex items-center justify-center transition-colors duration-500",
                      touchIdStatus === 'success' ? "bg-biochain-success/10" :
                        touchIdStatus === 'failed' ? "bg-destructive/5" :
                          "bg-primary/5"
                    )}>
                      {touchIdStatus === 'success' ? (
                        <CheckCircle2 className="w-12 h-12 text-biochain-success" />
                      ) : (
                        <Fingerprint className={cn(
                          "w-12 h-12 transition-colors duration-500",
                          touchIdStatus === 'scanning' ? "text-primary animate-pulse" :
                            touchIdStatus === 'failed' ? "text-destructive" :
                              "text-muted-foreground"
                        )} />
                      )}
                    </div>
                    {touchIdStatus === 'scanning' && (
                      <div className="absolute inset-4 rounded-full overflow-hidden">
                        <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleTouchIdVerify}
                    variant="outline"
                    disabled={touchIdStatus === 'scanning' || touchIdStatus === 'success'}
                    className="w-full max-w-[280px] mx-auto h-10"
                  >
                    {touchIdStatus === 'scanning' ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
                    ) : (
                      <><Fingerprint className="w-4 h-4 mr-2" /> Verify with Touch ID</>
                    )}
                  </Button>
                </div>
              )}

              {pinError && (
                <p className="text-destructive text-xs">{pinError}</p>
              )}

              <Button
                variant="ghost"
                onClick={() => { setScreen('voter-select'); setPinError(''); setTouchIdStatus('idle'); setVoterPassword(''); }}
                disabled={touchIdStatus === 'scanning'}
                className="text-muted-foreground"
              >
                Change voter
              </Button>
            </motion.div>
          )}


          {/* -- Admin PIN Screen -- */}
          {screen === 'admin-pin' && (
            <motion.div
              key="admin-pin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-6"
            >
              <div className="mx-auto w-16 h-16 rounded-xl bg-biochain-warning/10 flex items-center justify-center">
                <Users className="w-8 h-8 text-biochain-warning" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground">Admin Login</h2>
              <p className="text-sm text-muted-foreground">Enter admin PIN to access the control panel</p>

              <div className="max-w-[200px] mx-auto">
                <Input
                  type="password"
                  maxLength={20}
                  value={adminPin}
                  onChange={(e) => { setAdminPin(e.target.value); setPinError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                  placeholder="Admin PIN"
                  className="text-center text-lg h-14 bg-card border-border"
                  aria-label="Admin PIN input"
                />
                {pinError && <p className="text-destructive text-xs mt-2">{pinError}</p>}
              </div>

              <div className="space-y-3">
                <Button onClick={handleAdminLogin} className="w-full h-12 bg-biochain-warning text-black hover:bg-biochain-warning/90">
                  Login as Admin
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="ghost" onClick={() => { setScreen('welcome'); setPinError(''); setAdminPin(''); }} className="text-muted-foreground">
                  Back to voter login
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default Welcome;
