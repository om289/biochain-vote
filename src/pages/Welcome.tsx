import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Fingerprint, KeyRound, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { biometricService } from '@/services/biometricService';
import { apiService } from '@/services/apiService';

type Screen = 'welcome' | 'biometric' | 'pin';

const Welcome = () => {
  const navigate = useNavigate();
  const { setUser, setAuthenticated } = useAppStore();
  const [screen, setScreen] = useState<Screen>('welcome');
  const [scanning, setScanning] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const handleBiometric = async () => {
    setScanning(true);
    try {
      const result = await biometricService.authenticate();
      if (result.success) {
        const user = await apiService.login(result.credentialId || '');
        setUser(user);
        setAuthenticated(true);
        navigate('/dashboard');
      }
    } catch {
      setScreen('pin');
    } finally {
      setScanning(false);
    }
  };

  const handlePinSubmit = async () => {
    if (pin.length < 4) {
      setPinError('PIN must be at least 4 digits');
      return;
    }
    const result = await biometricService.verifyPin(pin);
    if (result.success) {
      const user = await apiService.login('pin-auth');
      setUser(user);
      setAuthenticated(true);
      navigate('/dashboard');
    } else {
      setPinError('Invalid PIN');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-biochain-glow/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-primary/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-primary/5 rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto px-6">
        <AnimatePresence mode="wait">
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
                  Bridging Blockchain Transparency with Unbreakable Voter Identity
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="space-y-3"
              >
                <Button
                  onClick={() => setScreen('biometric')}
                  className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90"
                  aria-label="Authenticate with fingerprint sensor"
                >
                  <Fingerprint className="w-5 h-5 mr-2" />
                  Authenticate with Biometrics
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setScreen('pin')}
                  className="w-full h-12 text-base border-border"
                  aria-label="Use PIN instead"
                >
                  <KeyRound className="w-5 h-5 mr-2" />
                  Use PIN Instead
                </Button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-xs text-muted-foreground"
              >
                Secured by zero-knowledge proofs &amp; threshold cryptography
              </motion.p>
            </motion.div>
          )}

          {screen === 'biometric' && (
            <motion.div
              key="biometric"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-8"
            >
              <h2 className="text-2xl font-display font-bold text-foreground">Fingerprint Scan</h2>
              <p className="text-sm text-muted-foreground">Place your finger on the external sensor</p>

              {/* Scanner animation */}
              <div className="relative mx-auto w-48 h-48">
                <div className={cn(
                  "absolute inset-0 rounded-full border-2 border-primary/30",
                  scanning && "animate-scanner-pulse"
                )} />
                <div className={cn(
                  "absolute inset-4 rounded-full border border-primary/20",
                  scanning && "animate-scanner-pulse [animation-delay:0.3s]"
                )} />
                <div className="absolute inset-8 rounded-full bg-primary/5 flex items-center justify-center">
                  <Fingerprint className={cn(
                    "w-16 h-16 transition-colors duration-500",
                    scanning ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                {scanning && (
                  <div className="absolute inset-8 rounded-full overflow-hidden">
                    <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleBiometric}
                  disabled={scanning}
                  className="w-full h-12 bg-primary"
                >
                  {scanning ? 'Scanning...' : 'Start Scan'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setScreen('pin')}
                  className="text-muted-foreground"
                >
                  Use PIN fallback
                </Button>
              </div>
            </motion.div>
          )}

          {screen === 'pin' && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-6"
            >
              <div className="mx-auto w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                <KeyRound className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground">Enter PIN</h2>
              <p className="text-sm text-muted-foreground">Enter your secure PIN to continue</p>

              <div className="max-w-[200px] mx-auto">
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => { setPin(e.target.value); setPinError(''); }}
                  placeholder="••••"
                  className="text-center text-2xl tracking-[0.5em] h-14 bg-card border-border"
                  aria-label="PIN input"
                />
                {pinError && <p className="text-destructive text-xs mt-2">{pinError}</p>}
              </div>

              <div className="space-y-3">
                <Button onClick={handlePinSubmit} className="w-full h-12 bg-primary">
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="ghost" onClick={() => setScreen('biometric')} className="text-muted-foreground">
                  Try biometric instead
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
