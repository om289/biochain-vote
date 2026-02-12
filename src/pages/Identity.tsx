import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';

export default function IdentityPage() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20 space-y-4">
        <Construction className="w-12 h-12 text-biochain-cyber mx-auto" />
        <h1 className="text-2xl font-display font-bold text-foreground">SSI Management</h1>
        <p className="text-muted-foreground text-sm">Self-Sovereign Identity credentials, DID management, and QR code sharing — coming next.</p>
      </motion.div>
    </div>
  );
}
