import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Pencil, Trash2, Search, Vote, Calendar, MapPin, ArrowLeft, X, Save, Loader2, Fingerprint } from 'lucide-react';
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
import type { Voter, ElectionRecord, CandidateRecord } from '@/services/dbService';

export default function AdminPage() {
  const { isAdmin, isAuthenticated, dbInitialized, setDbInitialized } = useAppStore();
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
          <p className="text-sm text-muted-foreground">Manage voters, candidates & elections</p>
        </div>
        <Badge variant="outline" className="bg-biochain-warning/20 text-biochain-warning border-biochain-warning/30">
          <Users className="w-3 h-3 mr-1" /> Admin
        </Badge>
      </motion.div>

      <Tabs defaultValue="voters" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="voters">
            <Users className="w-4 h-4 mr-1" /> Voters
          </TabsTrigger>
          <TabsTrigger value="elections">
            <Calendar className="w-4 h-4 mr-1" /> Elections
          </TabsTrigger>
          <TabsTrigger value="candidates">
            <Vote className="w-4 h-4 mr-1" /> Candidates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="voters">
          <VoterManager />
        </TabsContent>
        <TabsContent value="elections">
          <ElectionManager />
        </TabsContent>
        <TabsContent value="candidates">
          <CandidateManager />
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

  /** Register a fingerprint for a voter via the NITGEN scanner */
  const handleRegisterFingerprint = async (voter: Voter) => {
    setRegisteringFor(voter.id);
    setEnrollStatus({ id: voter.id, msg: 'Place finger on scanner...', ok: true });
    const result = await fingerprintEnroll(voter.id);
    if (result.success) {
      // Flask already saved the real NITGEN: template directly to Supabase — do NOT overwrite it here.
      // Just reload to show the updated fingerprint status.
      setEnrollStatus({ id: voter.id, msg: result.simulated ? '✓ Enrolled (simulated)' : '✓ Fingerprint enrolled!', ok: true });
    } else {
      setEnrollStatus({ id: voter.id, msg: result.error || 'Enrollment failed.', ok: false });
    }
    setRegisteringFor(null);
    setTimeout(() => setEnrollStatus(null), 4000);
    load();
  };


  /** Check if a voter has a real enrolled fingerprint from the NITGEN scanner */
  const hasRegisteredFingerprint = (voter: Voter) =>
    !!(voter.fingerprint && voter.fingerprint.startsWith('NITGEN:'));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name, Aadhaar, Voter ID, constituency..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card" />
        </div>
        <Button onClick={handleAdd} className="bg-primary">
          <Plus className="w-4 h-4 mr-1" /> Add Voter
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(voter => (
            <Card key={voter.id} className="glass border-border/50">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{voter.name}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                    <span>Voter ID: {voter.voterIdNumber || 'N/A'}</span>
                    <span>{voter.constituency || 'No constituency'}</span>
                    <span className="text-[10px]">{voter.fingerprint ? '🟢 Fingerprint enrolled' : '🔴 No fingerprint'}</span>
                  </div>
                  {hasRegisteredFingerprint(voter) && (
                    <p className="text-[10px] text-biochain-success mt-1">✓ Fingerprint enrolled</p>
                  )}
                  {enrollStatus?.id === voter.id && (
                    <p className={`text-[10px] mt-1 ${enrollStatus.ok ? 'text-biochain-success' : 'text-destructive'}`}>{enrollStatus.msg}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
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
                        <><Fingerprint className="w-3.5 h-3.5 mr-1" /> {hasRegisteredFingerprint(voter) ? 'Re-enroll' : 'Enroll Fingerprint'}</>
                      )}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(voter)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(voter.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">No voters found.</p>
          )}
        </div>
      )}

      <VoterDialog open={dialogOpen} onClose={() => setDialogOpen(false)} voter={editVoter} onSaved={load} />
    </div>
  );
}

function VoterDialog({ open, onClose, voter, onSaved }: { open: boolean; onClose: () => void; voter: Voter | null; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', voterIdNumber: '', constituency: '' });

  useEffect(() => {
    if (voter) {
      setForm({
        name: voter.name,
        voterIdNumber: voter.voterIdNumber || '',
        constituency: voter.constituency || '',
      });
    } else {
      setForm({ name: '', voterIdNumber: '', constituency: '' });
    }
  }, [voter, open]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const data: Voter = {
      id: voter?.id || crypto.randomUUID(),
      name: form.name.trim(),
      voterIdNumber: form.voterIdNumber.trim(),
      constituency: form.constituency.trim(),
      fingerprint: voter?.fingerprint || '',
      hasVoted: voter?.hasVoted || false,
    };
    await apiService.saveVoter(data);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>{voter ? 'Edit Voter' : 'Add New Voter'}</DialogTitle>
          <DialogDescription>
            {voter ? 'Update voter details in Supabase.' : 'This will add the voter to the Supabase voters table.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Full Name *</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Rajesh Kumar"
            />
          </div>
          <div>
            <Label>Voter ID Number</Label>
            <Input
              value={form.voterIdNumber}
              onChange={e => setForm({ ...form, voterIdNumber: e.target.value })}
              placeholder="e.g. DL/04/001/123456"
            />
          </div>
          <div>
            <Label>Constituency (Location)</Label>
            <Input
              value={form.constituency}
              onChange={e => setForm({ ...form, constituency: e.target.value })}
              placeholder="e.g. New Delhi"
            />
          </div>
          <Button onClick={handleSave} className="w-full bg-primary mt-2" disabled={!form.name.trim()}>
            <Save className="w-4 h-4 mr-1" /> {voter ? 'Update' : 'Add to Supabase'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ====== ELECTION MANAGER ======

function ElectionManager() {
  const [elections, setElections] = useState<ElectionRecord[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editElection, setEditElection] = useState<ElectionRecord | null>(null);
  const [loading, setLoading] = useState(true);

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
    name: '', partyName: '', partySymbol: '⭐', age: 30, qualification: '', manifesto: '', electionId: '',
  });

  useEffect(() => {
    if (candidate) {
      setForm({
        name: candidate.name, partyName: candidate.partyName, partySymbol: candidate.partySymbol,
        age: candidate.age, qualification: candidate.qualification, manifesto: candidate.manifesto,
        electionId: candidate.electionId,
      });
    } else {
      setForm({ name: '', partyName: '', partySymbol: '⭐', age: 30, qualification: '', manifesto: '', electionId: elections[0]?.id || '' });
    }
  }, [candidate, open, elections]);

  const handleSave = async () => {
    const data: CandidateRecord = {
      id: candidate?.id || `cand-${Date.now()}`,
      ...form,
      photoUrl: candidate?.photoUrl || '',
    };
    await apiService.saveCandidate(data);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
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
          <Button onClick={handleSave} className="w-full bg-primary mt-2">
            <Save className="w-4 h-4 mr-1" /> {candidate ? 'Update' : 'Add'} Candidate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
