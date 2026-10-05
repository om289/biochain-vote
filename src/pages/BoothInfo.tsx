import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Users, Vote, ShieldCheck, QrCode, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

export default function BoothInfoPage() {
  const [searchParams] = useSearchParams();
  const boothId = searchParams.get('booth');
  const voterId = searchParams.get('voter');
  const did = searchParams.get('did');

  const [booth, setBooth] = useState<any>(null);
  const [elections, setElections] = useState<any[]>([]);
  const [voterAssigned, setVoterAssigned] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        if (boothId) {
          // Load booth info
          const { data: boothData } = await supabase
            .from('booths')
            .select('*')
            .eq('id', boothId)
            .single();
          setBooth(boothData);

          // Load elections assigned to this booth
          const { data: beData } = await supabase
            .from('booth_elections')
            .select('election_id')
            .eq('booth_id', boothId);

          if (beData && beData.length > 0) {
            const electionIds = beData.map((r: any) => r.election_id);
            const { data: elecData } = await supabase
              .from('elections')
              .select('*')
              .in('id', electionIds);
            setElections(elecData || []);
          }

          // Check if voter is assigned to this booth
          if (voterId) {
            const { data: bvData } = await supabase
              .from('booth_voters')
              .select('voter_id')
              .eq('voter_id', voterId)
              .eq('booth_id', boothId)
              .single();
            setVoterAssigned(!!bvData);
          }
        } else if (did) {
          // Identity QR — show voter identity verification page
          setBooth(null);
        } else {
          setError('Invalid QR code — no booth or identity information found.');
        }
      } catch (err) {
        setError('Could not load booth information. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [boothId, voterId, did]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
          <p className="text-muted-foreground text-sm">Loading booth information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-6 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-foreground font-medium">Invalid QR Code</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Identity QR — DID verification
  if (did && !boothId) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm w-full space-y-4">
          <Card className="border-primary/30">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <ShieldCheck className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-lg">BioChain Voter Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-center">
              <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                ✓ Valid Digital Identity
              </Badge>
              <div className="bg-muted/30 rounded-lg p-3 text-left space-y-2">
                <p className="text-xs text-muted-foreground">Decentralized Identifier</p>
                <p className="font-mono text-xs text-primary break-all">{decodeURIComponent(did)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                This QR was issued by the BioChain Vote system. Scan at the polling booth for verification.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Booth QR
  return (
    <div className="min-h-screen bg-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto space-y-4 pt-8">

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Booth Voting Pass</h1>
          <p className="text-sm text-muted-foreground">BioChain Vote — Official Polling Booth</p>
        </div>

        {/* Booth Info */}
        {booth && (
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{booth.name}</p>
                  <p className="text-sm text-muted-foreground">{booth.constituency}</p>
                </div>
              </div>
              <div className="bg-muted/20 rounded-lg px-3 py-2">
                <p className="text-xs text-muted-foreground">Booth ID</p>
                <p className="font-mono text-sm text-foreground uppercase">{booth.id}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Voter Assignment Status */}
        {voterId && (
          <Card className={voterAssigned
            ? 'border-green-500/30 bg-green-500/5'
            : 'border-red-500/30 bg-red-500/5'
          }>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                voterAssigned ? 'bg-green-500/10' : 'bg-red-500/10'
              }`}>
                {voterAssigned
                  ? <ShieldCheck className="w-5 h-5 text-green-600" />
                  : <AlertCircle className="w-5 h-5 text-red-500" />
                }
              </div>
              <div>
                <p className={`font-semibold text-sm ${voterAssigned ? 'text-green-700' : 'text-red-600'}`}>
                  {voterAssigned ? 'Voter Assigned to This Booth' : 'Voter Not Assigned to This Booth'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {voterAssigned
                    ? 'This voter is registered at this polling station.'
                    : 'Please report to the election officer.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Elections at this booth */}
        {elections.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Vote className="w-4 h-4 text-primary" /> Elections at This Booth
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {elections.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">{e.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {e.start_date ? new Date(e.start_date).toLocaleDateString('en-IN') : 'TBD'}
                    </p>
                  </div>
                  <Badge className={
                    e.status === 'active' ? 'bg-green-500/10 text-green-600 border-green-500/30' :
                    e.status === 'upcoming' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' :
                    'bg-muted text-muted-foreground'
                  }>
                    {e.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">
          Powered by BioChain Vote — Blockchain-based Secure Voting System
        </p>
      </motion.div>
    </div>
  );
}
