import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Network, Search, Hash, Clock, Database, ShieldCheck, Box, ChevronRight, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { localBlockchain, type Block } from '@/services/localBlockchain';
import { apiService } from '@/services/apiService';
import { format } from 'date-fns';

export default function Explorer() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [elections, setElections] = useState<any[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<string>('');

  useEffect(() => {
    // Load elections list once
    apiService.getElections().then(setElections).catch(() => {});
  }, []);

  useEffect(() => {
    loadChain();
  }, [selectedElectionId]);

  const loadChain = async () => {
    const chain = await localBlockchain.getChain(selectedElectionId || undefined) as Block[];
    // Sort descending (newest blocks first)
    setBlocks(chain.sort((a, b) => b.index - a.index));
    if (chain.length > 0) {
      setSelectedBlock(chain[chain.length - 1]); // Set newest as default
    }
  };

  const filteredBlocks = blocks.filter(b => 
    b.hash.includes(searchQuery) || 
    b.index.toString().includes(searchQuery) ||
    b.data.type.includes(searchQuery)
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center glow-primary">
              <Network className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground">Block Explorer</h1>
          </div>
          <p className="text-muted-foreground">View and verify all tamper-proof records permanently stored on the BioChain ledger.</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search hash, index, type..." 
            className="pl-9 bg-background/50 border-border"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Chain selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground whitespace-nowrap">View chain:</span>
        <Select value={selectedElectionId} onValueChange={setSelectedElectionId}>
          <SelectTrigger className="w-72 bg-background/50 border-border">
            <SelectValue placeholder="Global Audit Chain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Global Audit Chain</SelectItem>
            {elections.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.title} — Master Chain</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="visualizer">Hash Chain Visualizer</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Block List */}
            <Card className="glass border-border/50 lg:col-span-1 flex flex-col h-[600px]">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Ledger Blocks ({blocks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            <div className="flex flex-col">
              {filteredBlocks.map((block) => (
                <button
                  key={block.hash}
                  onClick={() => setSelectedBlock(block)}
                  className={`flex flex-col p-4 border-b border-border/30 text-left transition-colors hover:bg-muted/10 ${
                    selectedBlock?.hash === block.hash ? 'bg-primary/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono font-bold text-foreground">Block #{block.index}</span>
                    <Badge variant="outline" className={block.data.type === 'genesis' ? 'text-biochain-warning border-biochain-warning' : 'text-primary border-primary'}>
                      {block.data.type}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px] mb-1">
                    {block.hash}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(block.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                  </div>
                </button>
              ))}
              {filteredBlocks.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No blocks found</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Block Details */}
        <Card className="glass border-border/50 lg:col-span-2 h-[600px] flex flex-col overflow-hidden">
          {selectedBlock ? (
            <>
              <CardHeader className="border-b border-border/50 bg-muted/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Box className="w-6 h-6 text-primary" />
                    Block #{selectedBlock.index} Details
                  </CardTitle>
                  <Badge className="bg-biochain-success/20 text-biochain-success hover:bg-biochain-success/30">
                    <ShieldCheck className="w-3 h-3 mr-1" /> Verified SHA-256
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timestamp</label>
                    <div className="font-mono text-sm bg-background/50 p-2 rounded border border-border">
                      {format(new Date(selectedBlock.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nonce</label>
                    <div className="font-mono text-sm bg-background/50 p-2 rounded border border-border">
                      {selectedBlock.nonce}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Hash className="w-3 h-3" /> Block Hash
                  </label>
                  <div className="font-mono text-sm break-all bg-background/50 p-3 rounded border border-border text-primary font-bold">
                    {selectedBlock.hash}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Previous Hash
                  </label>
                  <div className="font-mono text-xs break-all bg-muted/30 p-3 rounded border border-border text-muted-foreground">
                    {selectedBlock.previousHash}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payload Data</label>
                  <div className="bg-background/80 border border-border rounded-lg p-4 font-mono text-sm text-foreground overflow-x-auto">
                    <pre>{JSON.stringify(selectedBlock.data, null, 2)}</pre>
                  </div>
                </div>

              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Box className="w-16 h-16 opacity-20 mb-4" />
              <p>Select a block from the ledger to view details</p>
              </div>
            )}
          </Card>
        </div>
      </TabsContent>

        <TabsContent value="visualizer" className="mt-0">
          <Card className="glass border-border/50 min-h-[600px] flex flex-col">
            <CardHeader className="border-b border-border/50 bg-muted/10">
              <CardTitle className="text-xl flex items-center gap-2">
                <Network className="w-5 h-5 text-primary" />
                Cryptographic Hash Chain
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="w-full h-[530px] p-8">
                <div className="flex items-center space-x-6 min-w-max pb-4">
                  {[...blocks].reverse().map((block, i) => (
                    <div key={block.hash} className="flex items-center">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="w-72 bg-card border-2 border-primary/20 rounded-xl p-4 shadow-lg shrink-0 flex flex-col gap-3 relative"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-lg text-primary">Block #{block.index}</span>
                          <Badge variant="outline" className={block.data.type === 'genesis' ? 'border-biochain-warning text-biochain-warning' : 'border-biochain-success text-biochain-success'}>
                            {block.data.type}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Previous Hash</p>
                          <p className="text-xs font-mono truncate text-muted-foreground bg-muted/50 p-1.5 rounded">{block.previousHash}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Block Hash</p>
                          <p className="text-xs font-mono truncate text-primary bg-primary/10 p-1.5 rounded font-medium">{block.hash}</p>
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" /> {format(new Date(block.timestamp), 'HH:mm:ss MMM dd')}
                        </div>
                      </motion.div>
                      {i < blocks.length - 1 && (
                        <div className="w-12 shrink-0 flex items-center justify-center">
                          <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: '100%' }} 
                            transition={{ delay: i * 0.1 + 0.2 }}
                            className="h-1 bg-primary/40 relative flex items-center justify-end"
                          >
                            <ChevronRight className="w-4 h-4 text-primary/60 absolute -right-2" />
                          </motion.div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
