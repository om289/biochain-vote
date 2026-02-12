import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';

export default function AdminPage() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20 space-y-4">
        <Construction className="w-12 h-12 text-biochain-warning mx-auto" />
        <h1 className="text-2xl font-display font-bold text-foreground">Trustee Panel</h1>
        <p className="text-muted-foreground text-sm">Threshold decryption ceremony with key-share management — coming next.</p>
      </motion.div>
    </div>
  );
}
