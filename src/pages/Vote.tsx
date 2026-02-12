import { useState } from 'react';
import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';

export default function VotePage() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20 space-y-4">
        <Construction className="w-12 h-12 text-primary mx-auto" />
        <h1 className="text-2xl font-display font-bold text-foreground">Vote Casting</h1>
        <p className="text-muted-foreground text-sm">Election selection, candidate list, zk-SNARK proof generation, and wallet connect flow — coming next.</p>
      </motion.div>
    </div>
  );
}
