import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Pencil, Trash2, Search, Vote, Vote as VoteIcon, Calendar, MapPin, ArrowLeft, X, Save, Loader2, Fingerprint, Lock, QrCode, Server, UserPlus, UserMinus, CheckCircle2, XCircle, Database, GitFork, GitMerge, ShieldCheck, ShieldAlert, Copy, Check, RefreshCw, Layers, Link as LinkIcon, Network, Download, Upload, HardDrive, FileText, AlertTriangle, Activity, TrendingUp, BarChart2, Wifi, WifiOff, Play, StopCircle, Zap, ChevronRight, Clock, Award, Signal } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/store/useAppStore';
import { apiService } from '@/services/apiService';
import { fingerprintEnroll, isFingerprintServiceAvailable } from '@/services/biometricService';
import { useNavigate } from 'react-router-dom';
import { generateQRDataURL, generateVoterQRDataURL } from '@/utils/qrGenerator';
import type { Voter, ElectionRecord, CandidateRecord } from '@/services/dbService';
import type { BoothChainSummary } from '@/services/localBlockchain';

// All operations are offline-first using IndexedDB — no Flask backend needed

export default function AdminPage() {
  const { isAdmin, setAdmin, isAuthenticated, dbInitialized, setDbInitialized } = useAppStore();
  const navigate = useNavigate();
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [authed, setAuthed] = useState(isAdmin);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!dbInitialized) {
        await apiService.initialize();
        setDbInitialized(true);
      }
    };
    init();
  }, [dbInitialized, setDbInitialized]);

  const handleAdminLogin = async () => {
    setLoading(true);
    const valid = await apiService.verifyAdminPin(adminPin);
    if (valid) {
      setAuthed(true);
      setAdmin(true);
      setPinError('');
    } else {
      setPinError('Invalid admin PIN');
    }
    setLoading(false);
  };

  if (!authed) {
    return (
      <div className="p-4 md:p-8 max-w-md mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6 py-12">
          <div className="mx-auto w-16 h-16 rounded-xl bg-biochain-warning/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-biochain-warning" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Enter admin PIN to continue</p>
          <Input
            type="password"
            value={adminPin}
            onChange={e => { setAdminPin(e.target.value); setPinError(''); }}
            placeholder="Admin PIN"
            className="text-center text-lg h-14 bg-card border-border max-w-[200px] mx-auto"
            onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
          />
          {pinError && <p className="text-destructive text-xs">{pinError}</p>}
          <Button onClick={handleAdminLogin} className="w-full max-w-[200px] bg-biochain-warning text-black" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Login'}
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage voters, candidates, elections & booths</p>
        </div>
        <Badge variant="outline" className="bg-biochain-warning/20 text-biochain-warning border-biochain-warning/30">
          <Users className="w-3 h-3 mr-1" /> Admin
        </Badge>
      </motion.div>

      {/* Tamper-Evidence Monitor Banner */}
      <TamperMonitor />

      <Tabs defaultValue="voters" className="space-y-4">
        <TabsList className="bg-card border border-border flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="voters">
            <Users className="w-4 h-4 mr-1" /> Voters
          </TabsTrigger>
          <TabsTrigger value="elections">
            <Calendar className="w-4 h-4 mr-1" /> Elections
          </TabsTrigger>
          <TabsTrigger value="lifecycle">
            <Activity className="w-4 h-4 mr-1" /> Lifecycle
          </TabsTrigger>
          <TabsTrigger value="candidates">
            <Vote className="w-4 h-4 mr-1" /> Candidates
          </TabsTrigger>
          <TabsTrigger value="booths">
            <Server className="w-4 h-4 mr-1" /> Booths
          </TabsTrigger>
          <TabsTrigger value="chain-sync">
            <Signal className="w-4 h-4 mr-1" /> Chain Sync
          </TabsTrigger>
          <TabsTrigger value="localdb">
            <Database className="w-4 h-4 mr-1" /> Local DB
          </TabsTrigger>
        </TabsList>

        <TabsContent value="voters">
          <VoterManager />
        </TabsContent>
        <TabsContent value="elections">
          <ElectionManager />
        </TabsContent>
        <TabsContent value="lifecycle">
          <ElectionLifecyclePanel />
        </TabsContent>
        <TabsContent value="candidates">
          <CandidateManager />
        </TabsContent>
        <TabsContent value="booths">
          <BoothManager />
        </TabsContent>
        <TabsContent value="chain-sync">
          <BoothSyncPanel />
        </TabsContent>
        <TabsContent value="localdb">
          <LocalDBViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ====== VOTER MANAGER ======

function VoterManager() {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editVoter, setEditVoter] = useState<Voter | null>(null);
  const [loading, setLoading] = useState(true);
  const [scannerAvailable, setScannerAvailable] = useState<boolean | null>(null);
  const [registeringFor, setRegisteringFor] = useState<string | null>(null);
  const [enrollStatus, setEnrollStatus] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [qrVoter, setQrVoter] = useState<Voter | null>(null);
  const [voterQrDataUrl, setVoterQrDataUrl] = useState<string>('');

  // Generate voter QR whenever qrVoter changes
  useEffect(() => {
    if (!qrVoter) { setVoterQrDataUrl(''); return; }
    generateVoterQRDataURL(qrVoter.id, qrVoter.name, qrVoter.constituency || '', 220)
      .then(setVoterQrDataUrl)
      .catch(() => {});
  }, [qrVoter]);

  const load = async () => {
    const data = await apiService.getVoters();
    setVoters(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    isFingerprintServiceAvailable().then(setScannerAvailable);
  }, []);

  const filtered = voters.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.voterIdNumber || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.constituency || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    await apiService.deleteVoter(id);
    load();
  };

  const handleEdit = (voter: Voter) => {
    setEditVoter(voter);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditVoter(null);
    setDialogOpen(true);
  };

  const handleRegisterFingerprint = async (voter: Voter) => {
    setRegisteringFor(voter.id);
    setEnrollStatus({ id: voter.id, msg: 'Place finger on scanner...', ok: true });
    const result = await fingerprintEnroll(voter.id);
    if (result.success) {
      setEnrollStatus({ id: voter.id, msg: result.simulated ? 'Enrolled (simulated)' : 'Fingerprint enrolled successfully', ok: true });
    } else {
      setEnrollStatus({ id: voter.id, msg: result.error || 'Enrollment failed.', ok: false });
    }
    setRegisteringFor(null);
    setTimeout(() => setEnrollStatus(null), 4000);
    load();
  };

  const hasRegisteredFingerprint = (voter: Voter) =>
    !!(voter.fingerprint && (voter.fingerprint.startsWith('NITGEN:') || voter.fingerprint.startsWith('SIM:')));

  const [quickAssignVoter, setQuickAssignVoter] = useState<Voter | null>(null);
  const [booths, setBooths] = useState<any[]>([]);
  const [assigningTo, setAssigningTo] = useState<string | null>(null);

  const loadBooths = async () => {
    const b = await apiService.getBoothDetails();
    setBooths(b);
  };

  const handleQuickAssign = async (boothId: string) => {
    if (!quickAssignVoter) return;
    setAssigningTo(boothId);
    await apiService.assignVoterToBooth(boothId, quickAssignVoter.id);
    setAssigningTo(null);
    setQuickAssignVoter(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name, Voter ID, constituency..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card" />
        </div>
        <Button onClick={handleAdd} className="bg-primary">
          <Plus className="w-4 h-4 mr-1" /> Add Voter
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(voter => {
            return (
              <Card key={voter.id} className={`glass border-border/50`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {voter.photoUrl ? (
                      <img src={voter.photoUrl} alt={voter.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-border" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{voter.name}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                      <span>Voter ID: {voter.voterIdNumber || 'N/A'}</span>
                      <span>{voter.constituency || 'No constituency'}</span>
                      <span className="text-[10px] flex items-center gap-1">{voter.fingerprint ? <><CheckCircle2 className="w-3 h-3 text-biochain-success" /> Fingerprint enrolled</> : <><XCircle className="w-3 h-3 text-destructive" /> No fingerprint</>}</span>
                    </div>
                    {hasRegisteredFingerprint(voter) && (
                      <p className="text-[10px] text-biochain-success mt-1">Fingerprint enrolled</p>
                    )}
                    {enrollStatus?.id === voter.id && (
                      <p className={`text-[10px] mt-1 ${enrollStatus.ok ? 'text-biochain-success' : 'text-destructive'}`}>{enrollStatus.msg}</p>
                    )}
                  </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="outline" size="icon" onClick={() => setQrVoter(voter)} title="Show QR">
                      <QrCode className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      title="Quick-assign to booth"
                      onClick={() => { setQuickAssignVoter(voter); loadBooths(); }}
                      className="border-biochain-cyber/30 text-biochain-cyber hover:bg-biochain-cyber/10"
                    >
                      <UserPlus className="w-4 h-4" />
                    </Button>
                    {scannerAvailable !== false && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRegisterFingerprint(voter)}
                        disabled={registeringFor === voter.id}
                        className={`text-xs ${hasRegisteredFingerprint(voter)
                          ? 'border-biochain-success/30 text-biochain-success hover:bg-biochain-success/10'
                          : 'border-primary/30 text-primary hover:bg-primary/10'
                          }`}
                      >
                        {registeringFor === voter.id ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning...</>
                        ) : (
                          <><Fingerprint className="w-3.5 h-3.5 mr-1" /> {hasRegisteredFingerprint(voter) ? 'Re-enroll' : 'Enroll'}</>
                        )}
                      </Button>
                    )}
                    <Button variant="outline" size="icon" onClick={() => handleEdit(voter)} title="Edit voter">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(voter.id)} title="Delete voter">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">No voters found.</p>
          )}
        </div>
      )}

      <VoterDialog open={dialogOpen} onClose={() => setDialogOpen(false)} voter={editVoter} onSaved={load} />

      {/* QR Dialog */}
      <Dialog open={!!qrVoter} onOpenChange={() => setQrVoter(null)}>
        <DialogContent className="max-w-sm bg-card border-border text-center">
          <DialogHeader>
            <DialogTitle>Voter QR Code</DialogTitle>
            <DialogDescription>{qrVoter?.name} — {qrVoter?.voterIdNumber || 'N/A'}</DialogDescription>
          </DialogHeader>
          {qrVoter && (
            <div className="space-y-3">
              {voterQrDataUrl ? (
                <img
                  src={voterQrDataUrl}
                  alt="Voter QR"
                  className="mx-auto rounded-lg border border-border"
                />
              ) : (
                <div className="mx-auto w-[220px] h-[220px] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                </div>
              )}
              <p className="text-[10px] text-muted-foreground font-mono break-all">
                biochain://voter/{qrVoter.id}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick-Assign to Booth Dialog */}
      <Dialog open={!!quickAssignVoter} onOpenChange={() => setQuickAssignVoter(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-biochain-cyber" /> Quick-Assign to Booth
            </DialogTitle>
            <DialogDescription>
              Assign <strong>{quickAssignVoter?.name}</strong> to a polling station.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {booths.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No booths configured yet.</p>
            )}
            {booths.map(b => (
              <div key={b.booth_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <p className="text-sm font-medium">{b.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{b.booth_id} · {b.assigned_voters?.length || 0} voters</p>
                </div>
                <Button
                  size="sm"
                  className="bg-biochain-cyber/20 text-biochain-cyber hover:bg-biochain-cyber/30 border border-biochain-cyber/30"
                  onClick={() => handleQuickAssign(b.booth_id)}
                  disabled={assigningTo === b.booth_id}
                >
                  {assigningTo === b.booth_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><ChevronRight className="w-3.5 h-3.5 mr-0.5" />Assign</>}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VoterDialog({ open, onClose, voter, onSaved }: { open: boolean; onClose: () => void; voter: Voter | null; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: '', voterIdNumber: '', constituency: '',
    state: '', district: '', dateOfBirth: '',
    gender: '' as '' | 'male' | 'female' | 'other',
    photoUrl: '',
  });

  useEffect(() => {
    if (voter) {
      setForm({
        name: voter.name,
        voterIdNumber: voter.voterIdNumber || '',
        constituency: voter.constituency || '',
        state: voter.state || '',
        district: voter.district || '',
        dateOfBirth: voter.dateOfBirth || '',
        gender: (voter.gender as '' | 'male' | 'female' | 'other') || '',
        photoUrl: voter.photoUrl || '',
      });
    } else {
      setForm({ name: '', voterIdNumber: '', constituency: '', state: '', district: '', dateOfBirth: '', gender: '', photoUrl: '' });
    }
  }, [voter, open]);

  const handleSave = async () => {
    if (!form.name.trim()) return;

    // Deduplication check — only for new voters
    if (!voter && form.voterIdNumber.trim()) {
      const allVoters = await apiService.getVoters();
      const duplicate = allVoters.find(
        v => v.voterIdNumber.trim().toLowerCase() === form.voterIdNumber.trim().toLowerCase()
      );
      if (duplicate) {
        toast.error('Duplicate Voter ID', {
          description: `Voter ID "${form.voterIdNumber}" is already registered to ${duplicate.name}.`,
          duration: 6000,
        });
        return;
      }
    }

    const data: Voter = {
      id: voter?.id || crypto.randomUUID(),
      name: form.name.trim(),
      voterIdNumber: form.voterIdNumber.trim(),
      constituency: form.constituency.trim(),
      state: form.state.trim(),
      district: form.district.trim(),
      dateOfBirth: form.dateOfBirth,
      gender: form.gender || undefined,
      photoUrl: form.photoUrl || '',
      fingerprint: voter?.fingerprint || '',
      hasVoted: voter?.hasVoted || false,
    };
    await apiService.saveVoter(data);
    onSaved();
    onClose();
  };

  const INDIAN_STATES = [
    'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
    'Uttarakhand', 'West Bengal',
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{voter ? 'Edit Voter' : 'Add New Voter'}</DialogTitle>
          <DialogDescription>
            {voter ? 'Update voter details.' : 'Register a new voter for the election.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Full Name *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rajesh Kumar" />
          </div>
          <div>
            <Label>Voter ID Number</Label>
            <Input value={form.voterIdNumber} onChange={e => setForm({ ...form, voterIdNumber: e.target.value })} placeholder="e.g. DL/04/001/123456" />
          </div>
          <div>
            <Label>Constituency (Location)</Label>
            <Input value={form.constituency} onChange={e => setForm({ ...form, constituency: e.target.value })} placeholder="e.g. New Delhi" />
          </div>
          <div>
            <Label>State</Label>
            <Select value={form.state} onValueChange={v => setForm({ ...form, state: v })}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>District</Label>
            <Input value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} placeholder="e.g. South Delhi" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date of Birth</Label>
              <Input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} />
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={v => setForm({ ...form, gender: v as 'male' | 'female' | 'other' | '' })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Photo (optional)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onloadend = () => setForm(f => ({ ...f, photoUrl: reader.result as string }));
                reader.readAsDataURL(file);
              }}
            />
            {form.photoUrl && (
              <img src={form.photoUrl} alt="Preview" className="mt-2 w-10 h-10 rounded-full object-cover border border-border" />
            )}
          </div>
          <Button onClick={handleSave} className="w-full bg-primary mt-2" disabled={!form.name.trim()}>
            <Save className="w-4 h-4 mr-1" /> {voter ? 'Update' : 'Add Voter'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ====== ELECTION LIFECYCLE PANEL ======

function ElectionLifecyclePanel() {
  const [elections, setElections] = useState<ElectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishResults, setPublishResults] = useState<Record<string, any>>({});
  const [confirmDialog, setConfirmDialog] = useState<{ election: ElectionRecord; newStatus: ElectionRecord['status'] } | null>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    const data = await apiService.getElections();
    setElections(data);
    const counts: Record<string, number> = {};
    for (const e of data) {
      counts[e.id] = await apiService.getVoteCountByElection(e.id);
    }
    setVoteCounts(counts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleTransition = async (election: ElectionRecord, newStatus: ElectionRecord['status']) => {
    await apiService.saveElection({ ...election, status: newStatus });
    setConfirmDialog(null);
    load();
  };

  const handlePublish = async (election: ElectionRecord) => {
    setPublishing(election.id);
    try {
      const result = await apiService.publishResults(election.id);
      setPublishResults(prev => ({ ...prev, [election.id]: result }));
      await apiService.saveElection({ ...election, status: 'completed' });
      load();
    } catch (e: any) {
      setPublishResults(prev => ({ ...prev, [election.id]: { error: e.message } }));
    }
    setPublishing(null);
  };

  const statusFlow: Record<string, { label: string; next: ElectionRecord['status'] | null; nextLabel: string; color: string; icon: any }> = {
    upcoming: { label: 'Upcoming', next: 'active', nextLabel: 'Activate', color: 'text-biochain-warning bg-biochain-warning/10 border-biochain-warning/30', icon: Clock },
    active:   { label: 'Active',   next: 'completed', nextLabel: 'Close Voting', color: 'text-biochain-success bg-biochain-success/10 border-biochain-success/30', icon: Play },
    completed:{ label: 'Closed',   next: null, nextLabel: '', color: 'text-muted-foreground bg-muted/20 border-border', icon: StopCircle },
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-semibold">Election Lifecycle Manager</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Control the state of each election — from draft to published results</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Flow diagram */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-muted/20 border border-border text-xs text-muted-foreground">
        {['Upcoming', 'Active', 'Closed', 'Published'].map((s, i, arr) => (
          <>
            <span key={s} className={`px-2 py-0.5 rounded font-medium ${
              s === 'Upcoming' ? 'bg-biochain-warning/20 text-biochain-warning' :
              s === 'Active' ? 'bg-biochain-success/20 text-biochain-success' :
              s === 'Closed' ? 'bg-muted text-foreground' :
              'bg-primary/20 text-primary'
            }`}>{s}</span>
            {i < arr.length - 1 && <ChevronRight className="w-3 h-3" />}
          </>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
      ) : elections.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No elections. Create one in the Elections tab.</div>
      ) : (
        <div className="space-y-3">
          {elections.map((election, i) => {
            const flow = statusFlow[election.status];
            const FlowIcon = flow.icon;
            const pub = publishResults[election.id];
            const votes = voteCounts[election.id] || 0;

            return (
              <motion.div key={election.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="glass border-border/50 overflow-hidden">
                  {/* Status stripe */}
                  <div className={`h-1 w-full ${
                    election.status === 'active' ? 'bg-gradient-to-r from-biochain-success to-emerald-400' :
                    election.status === 'upcoming' ? 'bg-gradient-to-r from-biochain-warning to-amber-400' :
                    'bg-muted'
                  }`} />
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${flow.color}`}>
                            <FlowIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{election.title}</p>
                            <p className="text-xs text-muted-foreground">{election.constituency} · {election.type}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs">
                              <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${flow.color}`}>{flow.label}</span>
                              <span className="text-muted-foreground flex items-center gap-1">
                                <BarChart2 className="w-3 h-3" /> {votes} votes cast
                              </span>
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Ends {new Date(election.endDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        {flow.next && (
                          <Button
                            variant="outline"
                            size="sm"
                            className={`text-xs ${flow.color} hover:opacity-80`}
                            onClick={() => setConfirmDialog({ election, newStatus: flow.next! })}
                          >
                            <ChevronRight className="w-3.5 h-3.5 mr-1" />
                            {flow.nextLabel}
                          </Button>
                        )}
                        {election.status === 'completed' && (
                          <Button
                            size="sm"
                            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                            onClick={() => handlePublish(election)}
                            disabled={publishing === election.id}
                          >
                            {publishing === election.id ? (
                              <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Publishing...</>
                            ) : (
                              <><Zap className="w-3.5 h-3.5 mr-1" /> Publish & Seal Results</>
                            )}
                          </Button>
                        )}
                        {election.status === 'upcoming' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-destructive"
                            onClick={() => setConfirmDialog({ election, newStatus: 'active' })}
                          >
                            Force Activate
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Publish result feedback */}
                    {pub && (
                      <div className={`mt-3 p-3 rounded-lg text-xs font-mono ${
                        pub.error ? 'bg-destructive/10 border border-destructive/30 text-destructive' :
                        'bg-biochain-success/10 border border-biochain-success/30 text-biochain-success'
                      }`}>
                        {pub.error ? (
                          <span>⚠ {pub.error}</span>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Results Sealed & Published
                            </div>
                            <p>Votes sealed: {pub.publishedVotes}</p>
                            {pub.mergeBlock && <p className="truncate">Merge hash: {pub.mergeBlock.hash?.slice(0,24)}…</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Confirm transition dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <DialogDescription>
              Move <strong>{confirmDialog?.election.title}</strong> to&nbsp;
              <strong className="capitalize">{confirmDialog?.newStatus}</strong>?
              This action affects live voting — proceed carefully.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button
              className="flex-1 bg-biochain-warning text-black"
              onClick={() => confirmDialog && handleTransition(confirmDialog.election, confirmDialog.newStatus)}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====== BOOTH SYNC PANEL ======

function BoothSyncPanel() {
  const [booths, setBooths] = useState<any[]>([]);
  const [chainSummaries, setChainSummaries] = useState<Record<string, any>>({});
  const [masterVerification, setMasterVerification] = useState<{ valid: boolean; totalBlocks: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, { valid: boolean; blockCount: number }>>({});
  const [forkingBooth, setForkingBooth] = useState<string | null>(null);
  const [elections, setElections] = useState<ElectionRecord[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const boothDetails = await apiService.getBoothDetails();
      setBooths(boothDetails);
      const elecs = await apiService.getElections();
      setElections(elecs);

      const summaries: Record<string, any> = {};
      for (const b of boothDetails) {
        try {
          summaries[b.booth_id] = await apiService.getBoothChainSummary(b.booth_id);
        } catch {}
      }
      setChainSummaries(summaries);

      try {
        const mv = await apiService.verifyMasterChain();
        setMasterVerification(mv);
      } catch {}
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleVerify = async (boothId: string) => {
    setVerifying(boothId);
    try {
      const r = await apiService.verifyBoothChain(boothId);
      setVerifyResults(prev => ({ ...prev, [boothId]: r }));
    } catch {
      setVerifyResults(prev => ({ ...prev, [boothId]: { valid: false, blockCount: 0 } }));
    }
    setVerifying(null);
  };

  const handleFork = async (boothId: string) => {
    setForkingBooth(boothId);
    try {
      const booth = booths.find(b => b.booth_id === boothId);
      const electionId = (booth?.assigned_elections || [])[0];
      await apiService.forkBoothChain(boothId, electionId);
      await load();
    } catch (e: any) {
      console.error('Fork failed:', e);
    }
    setForkingBooth(null);
  };

  const getChainHealth = (boothId: string): 'healthy' | 'empty' | 'invalid' | 'unknown' => {
    const vr = verifyResults[boothId];
    const summary = chainSummaries[boothId];
    if (vr) return vr.valid ? 'healthy' : 'invalid';
    if (summary?.blockCount === 0 || !summary?.blockCount) return 'empty';
    return 'unknown';
  };

  const healthConfig = {
    healthy: { color: 'border-biochain-success/40 bg-biochain-success/5', badge: 'bg-biochain-success/20 text-biochain-success', label: 'Verified' },
    empty:   { color: 'border-muted bg-muted/10', badge: 'bg-muted/30 text-muted-foreground', label: 'No blocks' },
    invalid: { color: 'border-destructive/40 bg-destructive/5', badge: 'bg-destructive/20 text-destructive', label: 'Invalid!' },
    unknown: { color: 'border-border bg-card', badge: 'bg-primary/10 text-primary', label: 'Unverified' },
  };

  return (
    <div className="space-y-5">
      {/* Master Chain Status */}
      <Card className="glass border-border/50 overflow-hidden">
        <div className={`h-1 w-full ${ masterVerification?.valid ? 'bg-gradient-to-r from-biochain-success to-emerald-400' : 'bg-destructive' }`} />
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                masterVerification?.valid ? 'bg-biochain-success/10 border border-biochain-success/30' : 'bg-destructive/10 border border-destructive/30'
              }`}>
                {masterVerification?.valid
                  ? <ShieldCheck className="w-5 h-5 text-biochain-success" />
                  : <ShieldAlert className="w-5 h-5 text-destructive" />
                }
              </div>
              <div>
                <p className="font-semibold text-sm">Master Chain</p>
                <p className="text-xs text-muted-foreground">
                  {masterVerification ? `${masterVerification.totalBlocks} blocks · ${
                    masterVerification.valid ? 'Integrity OK' : 'INTEGRITY VIOLATION'
                  }` : 'Loading...'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Booth Chain Grid */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Network className="w-4 h-4 text-primary" /> Polling Station Sub-Chains
        </h3>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
        ) : booths.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No booths configured. Create booths in the Booths tab.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {booths.map((booth, i) => {
              const summary = chainSummaries[booth.booth_id];
              const vr = verifyResults[booth.booth_id];
              const health = getChainHealth(booth.booth_id);
              const hCfg = healthConfig[health];
              const assignedElection = elections.find(e => (booth.assigned_elections || []).includes(e.id));

              return (
                <motion.div key={booth.booth_id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                  <Card className={`border ${hCfg.color} overflow-hidden transition-all`}>
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-primary flex-shrink-0" />
                            <p className="font-semibold text-sm">{booth.name}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{booth.booth_id}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${hCfg.badge}`}>
                          {health === 'healthy' && <CheckCircle2 className="w-3 h-3 mr-0.5" />}
                          {health === 'invalid' && <AlertTriangle className="w-3 h-3 mr-0.5" />}
                          {hCfg.label}
                        </Badge>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-muted/30 rounded-lg p-2">
                          <p className="text-lg font-bold font-mono text-foreground">{summary?.blockCount ?? '—'}</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Blocks</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <p className="text-lg font-bold font-mono text-foreground">{summary?.voteCount ?? '—'}</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Votes</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <p className="text-lg font-bold font-mono text-foreground">{booth.assigned_voters?.length ?? 0}</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Voters</p>
                        </div>
                      </div>

                      {/* Merkle root chip */}
                      {summary?.merkleRoot && summary.merkleRoot !== '0'.repeat(64) && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/5 border border-primary/20">
                          <Layers className="w-3 h-3 text-primary flex-shrink-0" />
                          <span className="text-[10px] font-mono text-primary truncate">{summary.merkleRoot.slice(0, 32)}…</span>
                        </div>
                      )}

                      {/* Assigned election */}
                      {assignedElection && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{assignedElection.title}</span>
                        </div>
                      )}

                      {/* Verify result */}
                      {vr && (
                        <div className={`text-[10px] font-mono px-2 py-1 rounded ${
                          vr.valid ? 'bg-biochain-success/10 text-biochain-success' : 'bg-destructive/10 text-destructive'
                        }`}>
                          {vr.valid ? `✓ Chain valid (${vr.blockCount} blocks verified)` : '✗ Chain verification FAILED'}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => handleVerify(booth.booth_id)}
                          disabled={verifying === booth.booth_id}
                        >
                          {verifying === booth.booth_id
                            ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Verifying…</>
                            : <><ShieldCheck className="w-3 h-3 mr-1" />Verify</>}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs border-primary/30 text-primary hover:bg-primary/10"
                          onClick={() => handleFork(booth.booth_id)}
                          disabled={forkingBooth === booth.booth_id}
                        >
                          {forkingBooth === booth.booth_id
                            ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Forking…</>
                            : <><GitFork className="w-3 h-3 mr-1" />Fork</>}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => apiService.exportBoothPackage(booth.booth_id).then(pkg => {
                            const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
                            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                            a.download = `booth-${booth.booth_id}-chain.json`; a.click();
                          })}
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ====== ELECTION MANAGER ======

function getElectionTitle(id: string) {
  // Try to find it, else return id
  return id;
}

function LocalDBViewer() {
  const [tables, setTables] = useState<string[]>(['blocks', 'booth_chains', 'offline_sync_queue', 'elections', 'candidates', 'booths', 'boothVoters', 'boothElections', 'admins', 'zkCommitments']);
  const [selectedTable, setSelectedTable] = useState('blocks');
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async (storeName: string) => {
    setLoading(true);
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('biochain-vote');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => {
        setTableData(request.result);
        setLoading(false);
      };
      request.onerror = () => {
        setTableData([]);
        setLoading(false);
      };
    } catch (e) {
      console.error(e);
      setTableData([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedTable);
  }, [selectedTable]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {tables.map(t => (
          <Button
            key={t}
            variant={selectedTable === t ? "default" : "outline"}
            onClick={() => setSelectedTable(t)}
            className="text-xs"
          >
            {t}
          </Button>
        ))}
      </div>
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex justify-between items-center">
            <span>IndexedDB: {selectedTable}</span>
            <Badge variant="outline">{tableData.length} records</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : tableData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-4">No records found</p>
          ) : (
            <div className="bg-background/50 rounded-md overflow-auto max-h-[500px] border border-border/50">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-muted/50 sticky top-0 backdrop-blur-md z-10">
                  <tr>
                    {Array.from(new Set(tableData.flatMap(Object.keys))).map((key) => (
                      <th key={key} className="p-3 border-b border-border/50 font-medium text-muted-foreground uppercase tracking-wider">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      {Array.from(new Set(tableData.flatMap(Object.keys))).map((key) => (
                        <td key={key} className="p-3 border-b border-border/50 font-mono break-all text-foreground/80 max-w-[300px]">
                          {typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ElectionManager() {
  const [elections, setElections] = useState<ElectionRecord[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editElection, setEditElection] = useState<ElectionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrElection, setQrElection] = useState<ElectionRecord | null>(null);
  const [electionQrDataUrl, setElectionQrDataUrl] = useState<string>('');

  // Generate election QR whenever qrElection changes
  useEffect(() => {
    if (!qrElection) { setElectionQrDataUrl(''); return; }
    generateQRDataURL(`biochain://election/${qrElection.id}`, 220)
      .then(setElectionQrDataUrl)
      .catch(() => {});
  }, [qrElection]);

  const load = async () => {
    const data = await apiService.getElections();
    setElections(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await apiService.deleteElection(id);
    load();
  };

  const handleStatusChange = async (election: ElectionRecord, newStatus: ElectionRecord['status']) => {
    await apiService.saveElection({ ...election, status: newStatus });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditElection(null); setDialogOpen(true); }} className="bg-primary">
          <Plus className="w-4 h-4 mr-1" /> Create Election
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {elections.map(election => (
            <Card key={election.id} className="glass border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{election.title}</p>
                    <p className="text-xs text-muted-foreground">{election.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                      <span><MapPin className="w-3 h-3 inline mr-0.5" />{election.constituency}, {election.state}</span>
                      <span>Type: {election.type}</span>
                      <span>Start: {new Date(election.startDate).toLocaleDateString()}</span>
                      <span>End: {new Date(election.endDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setQrElection(election)} title="Show QR">
                      <QrCode className="w-4 h-4" />
                    </Button>
                    <Select value={election.status} onValueChange={v => handleStatusChange(election, v as any)}>
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => { setEditElection(election); setDialogOpen(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(election.id)} className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ElectionDialog open={dialogOpen} onClose={() => setDialogOpen(false)} election={editElection} onSaved={load} />

      {/* Election QR Dialog */}
      <Dialog open={!!qrElection} onOpenChange={() => setQrElection(null)}>
        <DialogContent className="max-w-sm bg-card border-border text-center">
          <DialogHeader>
            <DialogTitle>Election QR Code</DialogTitle>
            <DialogDescription>{qrElection?.title}</DialogDescription>
          </DialogHeader>
          {qrElection && (
            <div className="space-y-3">
              {electionQrDataUrl ? (
                <img
                  src={electionQrDataUrl}
                  alt="Election QR"
                  className="mx-auto rounded-lg border border-border"
                />
              ) : (
                <div className="mx-auto w-[220px] h-[220px] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                </div>
              )}
              <p className="text-[10px] text-muted-foreground font-mono break-all">
                biochain://election/{qrElection.id}
              </p>
              <p className="text-xs text-muted-foreground">Display this QR at the polling booth entrance</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ElectionDialog({ open, onClose, election, onSaved }: { open: boolean; onClose: () => void; election: ElectionRecord | null; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: '', description: '', type: 'lok-sabha' as ElectionRecord['type'], status: 'upcoming' as ElectionRecord['status'],
    startDate: '', endDate: '', constituency: '', state: '',
  });

  useEffect(() => {
    if (election) {
      setForm({
        title: election.title, description: election.description, type: election.type, status: election.status,
        startDate: election.startDate.slice(0, 10), endDate: election.endDate.slice(0, 10),
        constituency: election.constituency, state: election.state,
      });
    } else {
      setForm({ title: '', description: '', type: 'lok-sabha', status: 'upcoming', startDate: '', endDate: '', constituency: '', state: '' });
    }
  }, [election, open]);

  const handleSave = async () => {
    const data: ElectionRecord = {
      id: election?.id || `elec-${Date.now()}`,
      ...form,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      createdAt: election?.createdAt || new Date().toISOString(),
    };
    await apiService.saveElection(data);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>{election ? 'Edit Election' : 'Create Election'}</DialogTitle>
          <DialogDescription>Configure election details below.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lok-sabha">Lok Sabha</SelectItem>
                  <SelectItem value="vidhan-sabha">Vidhan Sabha</SelectItem>
                  <SelectItem value="municipal">Municipal</SelectItem>
                  <SelectItem value="panchayat">Panchayat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Constituency</Label><Input value={form.constituency} onChange={e => setForm({ ...form, constituency: e.target.value })} /></div>
            <div><Label>State</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
          </div>
          <Button onClick={handleSave} className="w-full bg-primary mt-2">
            <Save className="w-4 h-4 mr-1" /> {election ? 'Update' : 'Create'} Election
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ====== CANDIDATE MANAGER ======

function CandidateManager() {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [elections, setElections] = useState<ElectionRecord[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCandidate, setEditCandidate] = useState<CandidateRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const elecs = await apiService.getElections();
    setElections(elecs);
    if (selectedElectionId) {
      const cands = await apiService.getCandidates(selectedElectionId);
      setCandidates(cands);
    } else {
      const allCands = await apiService.getAllCandidates();
      setCandidates(allCands);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedElectionId]);

  const handleDelete = async (id: string) => {
    await apiService.deleteCandidate(id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selectedElectionId} onValueChange={setSelectedElectionId}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="All elections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Elections</SelectItem>
            {elections.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => { setEditCandidate(null); setDialogOpen(true); }} className="bg-primary">
          <Plus className="w-4 h-4 mr-1" /> Add Candidate
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {candidates.map(cand => {
            const elec = elections.find(e => e.id === cand.electionId);
            return (
              <Card key={cand.id} className="glass border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
                      {cand.partySymbol}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{cand.name}</p>
                      <p className="text-xs text-primary">{cand.partyName}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{cand.manifesto.slice(0, 60)}...</p>
                      {elec && <p className="text-[10px] text-muted-foreground">Election: {elec.title}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditCandidate(cand); setDialogOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(cand.id)} className="text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {candidates.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8 col-span-2">No candidates found.</p>
          )}
        </div>
      )}

      <CandidateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} candidate={editCandidate} elections={elections} onSaved={load} />
    </div>
  );
}

function CandidateDialog({ open, onClose, candidate, elections, onSaved }: { open: boolean; onClose: () => void; candidate: CandidateRecord | null; elections: ElectionRecord[]; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: '', partyName: '', partySymbol: '⭐', age: 30, qualification: '', manifesto: '', electionId: '', photoUrl: '',
  });

  useEffect(() => {
    if (candidate) {
      setForm({
        name: candidate.name, partyName: candidate.partyName, partySymbol: candidate.partySymbol,
        age: candidate.age, qualification: candidate.qualification, manifesto: candidate.manifesto,
        electionId: candidate.electionId, photoUrl: candidate.photoUrl || '',
      });
    } else {
      setForm({ name: '', partyName: '', partySymbol: '⭐', age: 30, qualification: '', manifesto: '', electionId: elections[0]?.id || '', photoUrl: '' });
    }
  }, [candidate, open, elections]);

  const handleSave = async () => {
    const data: CandidateRecord = {
      id: candidate?.id || `cand-${Date.now()}`,
      ...form,
      photoUrl: form.photoUrl || '',
    };
    await apiService.saveCandidate(data);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{candidate ? 'Edit Candidate' : 'Add Candidate'}</DialogTitle>
          <DialogDescription>Fill in candidate details below.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Election</Label>
            <Select value={form.electionId} onValueChange={v => setForm({ ...form, electionId: v })}>
              <SelectTrigger><SelectValue placeholder="Select election" /></SelectTrigger>
              <SelectContent>
                {elections.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Full Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Party Name</Label><Input value={form.partyName} onChange={e => setForm({ ...form, partyName: e.target.value })} /></div>
            <div><Label>Party Symbol (emoji)</Label><Input value={form.partySymbol} onChange={e => setForm({ ...form, partySymbol: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Age</Label><Input type="number" value={form.age} onChange={e => setForm({ ...form, age: parseInt(e.target.value) || 0 })} /></div>
            <div><Label>Qualification</Label><Input value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} /></div>
          </div>
          <div><Label>Manifesto</Label><Input value={form.manifesto} onChange={e => setForm({ ...form, manifesto: e.target.value })} /></div>
          <div>
            <Label>Candidate Photo (optional)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onloadend = () => setForm(f => ({ ...f, photoUrl: reader.result as string }));
                reader.readAsDataURL(file);
              }}
            />
            {form.photoUrl && (
              <img src={form.photoUrl} alt="Preview" className="mt-2 w-16 h-16 rounded-lg object-cover border border-border" />
            )}
          </div>
          <Button onClick={handleSave} className="w-full bg-primary mt-2">
            <Save className="w-4 h-4 mr-1" /> {candidate ? 'Update' : 'Add'} Candidate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ====== BOOTH MANAGER (Offline-First — IndexedDB) ======

function BoothManager() {
  const [booths, setBooths] = useState<any[]>([]);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [elections, setElections] = useState<ElectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [assignElectionOpen, setAssignElectionOpen] = useState<string | null>(null);
  const [newBooth, setNewBooth] = useState({ booth_id: '', name: '', constituency: '' });

  // Distributed sub-chain and consensus merge state
  const [chainSummaries, setChainSummaries] = useState<Record<string, BoothChainSummary>>({});
  const [masterBlocks, setMasterBlocks] = useState<any[]>([]);
  const [masterVerification, setMasterVerification] = useState<{ valid: boolean; totalBlocks: number }>({ valid: true, totalBlocks: 0 });
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeElectionId, setMergeElectionId] = useState<string>('');
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<any | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [forkingBooth, setForkingBooth] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = async () => {
    setLoading(true);
    const boothDetails = await apiService.getBoothDetails();
    setBooths(boothDetails);
    const v = await apiService.getVoters();
    setVoters(v);
    const elecs = await apiService.getElections();
    setElections(elecs);
    if (elecs.length > 0 && !mergeElectionId) {
      setMergeElectionId(elecs[0].id);
    }

    try {
      const mChain = await apiService.getMasterChain();
      setMasterBlocks(mChain);
      const mVerify = await apiService.verifyMasterChain();
      setMasterVerification(mVerify);
    } catch (e) {
      console.warn('Failed to load master chain:', e);
    }

    const summaries: Record<string, BoothChainSummary> = {};
    for (const b of boothDetails) {
      try {
        summaries[b.booth_id] = await apiService.getBoothChainSummary(b.booth_id);
      } catch (e) {
        console.warn(`Failed to get chain summary for ${b.booth_id}:`, e);
      }
    }
    setChainSummaries(summaries);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreateBooth = async () => {
    if (!newBooth.booth_id || !newBooth.name) return;
    await apiService.saveBooth({
      id: newBooth.booth_id,
      name: newBooth.name,
      constituency: newBooth.constituency,
    });
    setNewBooth({ booth_id: '', name: '', constituency: '' });
    setCreateOpen(false);
    load();
  };

  const handleAssign = async (boothId: string, voterId: string) => {
    await apiService.assignVoterToBooth(boothId, voterId);
    load();
  };

  const handleUnassign = async (_boothId: string, voterId: string) => {
    await apiService.unassignVoterFromBooth(voterId);
    load();
  };

  const handleAssignElection = async (boothId: string, electionId: string) => {
    await apiService.assignElectionToBooth(boothId, electionId);
    load();
  };

  const handleUnassignElection = async (boothId: string, electionId: string) => {
    await apiService.unassignElectionFromBooth(boothId, electionId);
    load();
  };

  const handleForkBooth = async (boothId: string) => {
    setForkingBooth(boothId);
    try {
      const targetBooth = booths.find(b => b.booth_id === boothId);
      const electionId = (targetBooth?.assigned_elections || [])[0];
      await apiService.forkBoothChain(boothId, electionId);
      await load();
    } catch (e: any) {
      alert(`Fork failed: ${e.message}`);
    } finally {
      setForkingBooth(null);
    }
  };

  const handleExecuteMerge = async () => {
    if (!mergeElectionId) return;
    setMerging(true);
    setMergeError(null);
    setMergeResult(null);
    try {
      const res = await apiService.mergeBoothChains(mergeElectionId);
      setMergeResult(res);
      await load();
    } catch (e: any) {
      setMergeError(e.message || 'Consensus merge failed');
    } finally {
      setMerging(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleExportBoothPackage = async (boothId: string) => {
    try {
      const pkg = await apiService.exportBoothPackage(boothId);
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${boothId}-airgap-ledger.biochain`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    }
  };

  const handleImportPackageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await apiService.importBoothPackage(parsed);
      setImportStatus({
        msg: `Successfully imported booth "${res.boothId}": ${res.importedBlocks} blocks, ${res.voteCount} votes. Cryptographic seal & chain verified!`,
        ok: true,
      });
      await load();
    } catch (err: any) {
      setImportStatus({
        msg: `Import failed: ${err.message}`,
        ok: false,
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getVoterName = (voterId: string) => {
    const v = voters.find(vt => vt.id === voterId);
    return v ? v.name : voterId.slice(0, 8) + '...';
  };

  const getElectionTitle = (electionId: string) => {
    const e = elections.find(el => el.id === electionId);
    return e ? e.title : electionId.slice(0, 8) + '...';
  };

  const handleDeleteBooth = async (boothId: string) => {
    if (window.confirm(`Are you sure you want to remove polling booth "${boothId}"? This will unassign any assigned voters.`)) {
      await apiService.deleteBooth(boothId);
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-4 rounded-xl border border-border/60">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" /> Polling Station Terminals (EVM)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage decentralized electronic voting booths and terminal assignments</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90 shadow-md">
          <Plus className="w-4 h-4 mr-1.5" /> Deploy New Booth
        </Button>
      </div>

      {/* Master Chain Consensus & Topology Matrix */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-card/90 via-card/60 to-primary/5 border border-primary/25 space-y-3 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />
              <h3 className="font-display text-sm font-bold text-foreground">
                Distributed Chain Architecture (Fork & Merge Consensus)
              </h3>
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                IndexedDB v6
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Independent polling booth sub-chains branch offline and reconcile cryptographically via Merkle tree merge into the master chain.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              className="text-xs h-8 border-primary/40 text-primary hover:bg-primary/10 shadow-sm font-medium"
              title="Import air-gapped sub-chain package (.biochain) from physical USB"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" /> Import USB Package
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportPackageFile}
              accept=".biochain,.json"
              className="hidden"
            />
            <Button
              onClick={() => { setMergeResult(null); setMergeError(null); setMergeOpen(true); }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 shadow-sm font-medium"
            >
              <GitMerge className="w-3.5 h-3.5 mr-1.5" /> Consensus Merge
            </Button>
            <Button
              onClick={load}
              variant="outline"
              size="sm"
              className="text-xs h-8 border-border"
              title="Refresh chains"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {importStatus && (
          <div className={`p-2.5 rounded-lg text-xs flex items-center justify-between gap-2 border ${importStatus.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-destructive/10 border-destructive/30 text-destructive'}`}>
            <span className="font-medium">{importStatus.msg}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-current hover:bg-transparent" onClick={() => setImportStatus(null)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1 border-t border-border/40">
          <div className="p-2 rounded-lg bg-background/50 border border-border/30">
            <p className="text-base font-bold text-foreground font-mono">{masterBlocks.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Master Blocks</p>
          </div>
          <div className="p-2 rounded-lg bg-background/50 border border-border/30">
            <p className="text-base font-bold text-foreground font-mono">
              {masterBlocks.filter(b => b.data?.type === 'booth_fork').length}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Forks</p>
          </div>
          <div className="p-2 rounded-lg bg-background/50 border border-border/30">
            <p className="text-base font-bold text-foreground font-mono">
              {masterBlocks.filter(b => b.data?.type === 'merge').length}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Merge Blocks</p>
          </div>
          <div className="p-2 rounded-lg bg-background/50 border border-border/30">
            <div className="flex items-center justify-center gap-1 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-bold font-mono">{masterVerification.valid ? 'Verified' : 'Invalid'}</span>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Master Integrity</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
      ) : booths.length === 0 ? (
        <Card className="glass border-border/50 text-center py-12">
          <CardContent className="space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-2 glow-primary">
              <Server className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground">No Polling Booths Deployed</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Create an offline polling station terminal to allocate voters and authorize ballot elections.
            </p>
            <Button onClick={() => setCreateOpen(true)} variant="outline" className="mt-2 text-xs border-primary/40 text-primary">
              <Plus className="w-3.5 h-3.5 mr-1" /> Deploy First Booth
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {booths.map((booth: any) => (
            <Card key={booth.booth_id} className="glass border-border/60 hover:border-primary/40 transition-all shadow-lg overflow-hidden group">
              {/* Top EVM Terminal Gradient Accent */}
              <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-primary to-emerald-500 opacity-80" />

              <CardContent className="p-5 space-y-4">
                {/* Booth Terminal Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border/40">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0 glow-primary">
                      <Server className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-base font-bold text-foreground">{booth.name}</span>
                        <Badge variant="outline" className="font-mono text-[10px] bg-background/60 border-border text-muted-foreground">
                          ID: {booth.booth_id}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                        <span>Constituency: <strong className="text-foreground font-medium">{booth.constituency}</strong></span>
                      </p>
                    </div>
                  </div>

                  {/* Status & Controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-biochain-success/10 text-biochain-success border-biochain-success/30 text-xs py-1 px-2.5">
                      <div className="w-2 h-2 rounded-full bg-biochain-success animate-pulse mr-1.5" />
                      EVM Online
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={`text-xs h-8 ${assignElectionOpen === booth.booth_id ? 'bg-primary/15 text-primary border-primary' : 'bg-background/40'}`} 
                      onClick={() => { setAssignOpen(null); setAssignElectionOpen(assignElectionOpen === booth.booth_id ? null : booth.booth_id); }}
                    >
                      <VoteIcon className="w-3.5 h-3.5 mr-1 text-primary" /> 
                      Ballots ({(booth.assigned_elections || []).length})
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={`text-xs h-8 ${assignOpen === booth.booth_id ? 'bg-primary/15 text-primary border-primary' : 'bg-background/40'}`} 
                      onClick={() => { setAssignElectionOpen(null); setAssignOpen(assignOpen === booth.booth_id ? null : booth.booth_id); }}
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1 text-biochain-cyber" /> 
                      Voters ({(booth.assigned_voters || []).length})
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                      title="Delete Polling Booth"
                      onClick={() => handleDeleteBooth(booth.booth_id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Telemetry Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <div className="p-2.5 rounded-lg bg-background/40 border border-border/40">
                    <p className="text-lg font-bold text-foreground font-mono">{booth.total_votes || 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Votes Cast</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background/40 border border-border/40">
                    <p className="text-lg font-bold text-foreground font-mono">{booth.blocks || 1}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Blocks Height</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background/40 border border-border/40">
                    <p className="text-lg font-bold text-foreground font-mono">{(booth.assigned_voters || []).length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Voter Roster</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background/40 border border-border/40">
                    <p className="text-lg font-bold text-foreground font-mono">{(booth.assigned_elections || []).length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Authorized Ballots</p>
                  </div>
                </div>

                {/* Assigned Elections Tag Cloud */}
                {booth.assigned_elections && booth.assigned_elections.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mr-1">Ballots:</span>
                    {booth.assigned_elections.map((eid: string) => (
                      <Badge key={eid} variant="outline" className="text-xs py-0.5 pl-2 pr-1 border-primary/30 text-primary bg-primary/10 font-medium">
                        {getElectionTitle(eid)}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-4 h-4 ml-1.5 text-muted-foreground hover:text-destructive rounded-full" 
                          onClick={() => handleUnassignElection(booth.booth_id, eid)}
                          title="Revoke ballot authorization"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Assigned Voters Tag Cloud */}
                {booth.assigned_voters && booth.assigned_voters.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mr-1">Roster:</span>
                    {booth.assigned_voters.map((vid: string) => (
                      <Badge key={vid} variant="outline" className="text-xs py-0.5 pl-2 pr-1 border-biochain-cyber/30 text-biochain-cyber bg-biochain-cyber/10 font-medium">
                        {getVoterName(vid)}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-4 h-4 ml-1.5 text-muted-foreground hover:text-destructive rounded-full" 
                          onClick={() => handleUnassign(booth.booth_id, vid)}
                          title="Remove voter from booth"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Sub-Chain Ledger & Cryptographic Integrity */}
                <div className="rounded-xl bg-card/60 border border-primary/20 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <GitFork className="w-4 h-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Decentralized Sub-Chain Ledger
                      </span>
                      {chainSummaries[booth.booth_id]?.isValid ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-medium py-0 px-2 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Chain Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-destructive/15 text-destructive border-destructive/30 font-medium py-0 px-2 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> Unverified
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                        onClick={() => handleExportBoothPackage(booth.booth_id)}
                        title="Export this station's sub-chain onto USB for air-gapped tallying"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Export USB
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 border-primary/40 text-primary hover:bg-primary/10"
                        onClick={() => handleForkBooth(booth.booth_id)}
                        disabled={forkingBooth === booth.booth_id}
                        title="Create or anchor a sub-chain for this booth from current master chain tip"
                      >
                        <GitFork className="w-3 h-3 mr-1" />
                        {forkingBooth === booth.booth_id ? 'Anchoring...' : 'Fork / Anchor'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-background/50 border border-border/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Booth Merkle Root</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopy(chainSummaries[booth.booth_id]?.merkleRoot || '', `mr-${booth.booth_id}`)}
                          title="Copy Merkle Root"
                        >
                          {copiedHash === `mr-${booth.booth_id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                      <p className="font-mono text-[11px] text-foreground truncate select-all">
                        {chainSummaries[booth.booth_id]?.merkleRoot || '0'.repeat(64)}
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-background/50 border border-border/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Sub-Chain Tip Hash</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopy(chainSummaries[booth.booth_id]?.tipHash || '', `tip-${booth.booth_id}`)}
                          title="Copy Tip Hash"
                        >
                          {copiedHash === `tip-${booth.booth_id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                      <p className="font-mono text-[11px] text-foreground truncate select-all">
                        {chainSummaries[booth.booth_id]?.tipHash || 'Pending genesis'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Voter Assignment Drawer Panel */}
                {assignOpen === booth.booth_id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="border-t border-border/60 pt-3.5 space-y-2.5 mt-2 bg-muted/15 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Assign Voters to {booth.name}:</p>
                      <span className="text-[11px] text-muted-foreground">Click voter name to enroll</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {voters
                        .filter(v => !(booth.assigned_voters || []).includes(v.id))
                        .map(v => (
                          <Button key={v.id} variant="outline" size="sm" className="text-xs justify-start h-8 hover:bg-biochain-cyber/10 hover:border-biochain-cyber/40" onClick={() => handleAssign(booth.booth_id, v.id)}>
                            <UserPlus className="w-3.5 h-3.5 mr-1.5 text-biochain-cyber" /> {v.name}
                          </Button>
                        ))}
                      {voters.filter(v => !(booth.assigned_voters || []).includes(v.id)).length === 0 && (
                        <p className="text-xs text-muted-foreground col-span-3 py-2 italic text-center">All available voters are already assigned to this booth.</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Election Assignment Drawer Panel */}
                {assignElectionOpen === booth.booth_id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="border-t border-border/60 pt-3.5 space-y-2.5 mt-2 bg-muted/15 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Authorize Elections for {booth.name}:</p>
                      <span className="text-[11px] text-muted-foreground">Click election to authorize</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {elections
                        .filter(e => !(booth.assigned_elections || []).includes(e.id))
                        .map(e => (
                          <Button key={e.id} variant="outline" size="sm" className="text-xs justify-start h-9 border-primary/30 text-foreground hover:bg-primary/10" onClick={() => handleAssignElection(booth.booth_id, e.id)}>
                            <Plus className="w-3.5 h-3.5 mr-1.5 text-primary" /> {e.title}
                          </Button>
                        ))}
                      {elections.filter(e => !(booth.assigned_elections || []).includes(e.id)).length === 0 && (
                        <p className="text-xs text-muted-foreground col-span-2 py-2 italic text-center">All registered elections are already authorized for this booth.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Consensus Merge Dialog */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-emerald-500" /> Multi-Booth Consensus Merge
            </DialogTitle>
            <DialogDescription>
              Collect offline sub-chains from all polling stations for an election, verify their cryptographic hashes, calculate per-booth Merkle roots, and commit a single immutable MERGE block with a master Merkle root to the master blockchain.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-medium">Target Election</Label>
              <Select value={mergeElectionId} onValueChange={setMergeElectionId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select election to merge" />
                </SelectTrigger>
                <SelectContent>
                  {elections.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview Participating Booths */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Participating Polling Stations</Label>
              <div className="rounded-lg border border-border/60 bg-muted/15 p-2.5 max-h-48 overflow-y-auto space-y-1.5 text-xs">
                {booths
                  .filter(b => (b.assigned_elections || []).includes(mergeElectionId))
                  .map(b => (
                    <div key={b.booth_id} className="flex items-center justify-between p-2 rounded bg-background/50 border border-border/30">
                      <div>
                        <p className="font-semibold text-foreground">{b.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">ID: {b.booth_id}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/25">
                          {b.total_votes || 0} votes
                        </Badge>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          Root: {(chainSummaries[b.booth_id]?.merkleRoot || '').slice(0, 10)}...
                        </p>
                      </div>
                    </div>
                  ))}
                {booths.filter(b => (b.assigned_elections || []).includes(mergeElectionId)).length === 0 && (
                  <p className="text-center text-muted-foreground py-3 text-xs italic">
                    No polling stations assigned to this election yet.
                  </p>
                )}
              </div>
            </div>

            {mergeError && (
              <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-xs">
                {mergeError}
              </div>
            )}

            {mergeResult && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-1 text-xs font-mono">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Consensus Merge Successful!</span>
                </div>
                <p>Master Block: #{mergeResult.index}</p>
                <p className="truncate">Hash: {mergeResult.hash}</p>
                <p className="truncate">Master Merkle Root: {mergeResult.data?.payload?.masterMerkleRoot}</p>
                <p>Total Votes Merged: {mergeResult.data?.payload?.totalVotes}</p>
              </div>
            )}

            <Button
              onClick={handleExecuteMerge}
              disabled={merging || !mergeElectionId}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md"
            >
              {merging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying & Merging Booth Chains...
                </>
              ) : (
                <>
                  <GitMerge className="w-4 h-4 mr-1.5" /> Execute Cryptographic Consensus Merge
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Booth Dialog */}
      <Dialog open={createOpen} onOpenChange={() => setCreateOpen(false)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" /> Deploy New Polling Station (EVM)
            </DialogTitle>
            <DialogDescription>
              Initialize an independent, tamper-evident electronic voting terminal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <div>
              <Label className="text-xs font-medium">Terminal / Booth ID</Label>
              <Input 
                value={newBooth.booth_id} 
                onChange={e => setNewBooth({ ...newBooth, booth_id: e.target.value })} 
                placeholder="e.g. booth-001" 
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Station Name</Label>
              <Input 
                value={newBooth.name} 
                onChange={e => setNewBooth({ ...newBooth, name: e.target.value })} 
                placeholder="e.g. Ward 5 - Central Station A" 
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Constituency / District</Label>
              <Input 
                value={newBooth.constituency} 
                onChange={e => setNewBooth({ ...newBooth, constituency: e.target.value })} 
                placeholder="e.g. New Delhi" 
                className="mt-1"
              />
            </div>
            <Button onClick={handleCreateBooth} className="w-full bg-primary mt-3 shadow-md" disabled={!newBooth.booth_id || !newBooth.name}>
              <Plus className="w-4 h-4 mr-1.5" /> Initialize & Deploy Station
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
