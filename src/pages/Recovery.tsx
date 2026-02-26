import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getLocalProfile, getRecoveryData, restoreFromRecovery, saveLocalProfile, generateRecoveryKey } from '@/lib/indexeddb';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Download, Upload } from 'lucide-react';

export default function Recovery() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [recoveryKey, setRecoveryKey] = useState('');
  const [restoreKey, setRestoreKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) { navigate('/login'); return; }
    getLocalProfile().then((p) => {
      if (p?.recoveryKey) setRecoveryKey(p.recoveryKey);
      else {
        const key = generateRecoveryKey();
        setRecoveryKey(key);
        if (p) saveLocalProfile({ ...p, recoveryKey: key });
      }
    });
  }, [user, loading, navigate]);

  const handleBackup = async () => {
    setSaving(true);
    try {
      const data = await getRecoveryData();
      await supabase.from('profiles').update({
        recovery_key: recoveryKey,
        recovery_blob: data as any,
      }).eq('user_id', user!.id);
      toast({ title: 'Backup saved', description: 'Your recovery data has been encrypted and stored.' });
    } catch {
      toast({ title: 'Backup failed', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleRestore = async () => {
    if (!restoreKey.trim()) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('recovery_blob')
        .eq('recovery_key', restoreKey.trim())
        .eq('user_id', user!.id)
        .single();

      if (error || !data?.recovery_blob) {
        toast({ title: 'Restore failed', description: 'Invalid recovery key.', variant: 'destructive' });
        return;
      }

      await restoreFromRecovery(data.recovery_blob as any);
      toast({ title: 'Restored', description: 'Your learning data has been restored.' });
    } catch {
      toast({ title: 'Restore failed', variant: 'destructive' });
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(recoveryKey);
    toast({ title: 'Copied', description: 'Recovery key copied to clipboard.' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="container mx-auto max-w-lg px-4 py-10">
        <div className="animate-fade-in">
          <h1 className="font-brand text-xl font-bold text-foreground">Recovery Key</h1>
          <p className="mt-1 text-sm text-muted-foreground">Back up and restore your learning data</p>

          <Card className="mt-6 p-5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Your Recovery Key</Label>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded border border-border bg-secondary px-3 py-2 font-brand text-sm text-foreground">
                {recoveryKey}
              </code>
              <Button variant="outline" size="icon" onClick={copyKey}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Save this key somewhere safe. It allows you to restore your learning data.
            </p>
            <Button onClick={handleBackup} disabled={saving} className="mt-4 w-full" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Backup to Cloud'}
            </Button>
          </Card>

          <Card className="mt-4 p-5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Restore Data</Label>
            <div className="mt-2 flex gap-2">
              <Input
                value={restoreKey}
                onChange={(e) => setRestoreKey(e.target.value)}
                placeholder="Enter recovery key"
                className="font-brand"
              />
              <Button variant="outline" onClick={handleRestore} size="sm">
                <Download className="mr-2 h-4 w-4" /> Restore
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
