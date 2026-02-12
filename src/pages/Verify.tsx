import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';

export default function VerifyPage() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20 space-y-4">
        <Construction className="w-12 h-12 text-biochain-success mx-auto" />
        <h1 className="text-2xl font-display font-bold text-foreground">Vote Verification</h1>
        <p className="text-muted-foreground text-sm">Blockchain explorer-style vote verification with Merkle proof — coming next.</p>
      </motion.div>
    </div>
  );
}
