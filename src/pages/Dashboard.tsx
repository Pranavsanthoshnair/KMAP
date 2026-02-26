import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getLocalProfile, saveLocalProfile } from '@/lib/indexeddb';
import { BookOpen, FlaskConical, Languages } from 'lucide-react';

const SUBJECTS = [
  { id: 'math', label: 'Math', icon: BookOpen },
  { id: 'science', label: 'Science', icon: FlaskConical },
  { id: 'english', label: 'English', icon: Languages },
];

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
      return;
    }
    getLocalProfile().then((p) => {
      if (p?.subjects?.length) setSelectedSubjects(p.subjects);
      setInitialized(true);
    });
  }, [user, loading, navigate]);

  const toggleSubject = async (id: string) => {
    const next = selectedSubjects.includes(id)
      ? selectedSubjects.filter((s) => s !== id)
      : [...selectedSubjects, id];
    setSelectedSubjects(next);
    const profile = await getLocalProfile();
    if (profile) {
      await saveLocalProfile({ ...profile, subjects: next });
    }
  };

  if (loading || !initialized) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-10">
        <div className="animate-fade-in">
          <h1 className="font-brand text-xl font-bold text-foreground">Subjects</h1>
          <p className="mt-1 text-sm text-muted-foreground">Select subjects to start learning</p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SUBJECTS.map(({ id, label, icon: Icon }) => {
              const active = selectedSubjects.includes(id);
              return (
                <Card
                  key={id}
                  className={`cursor-pointer border-2 p-5 text-center transition-colors ${
                    active ? 'border-primary bg-accent' : 'border-border hover:border-primary/30'
                  }`}
                  onClick={() => toggleSubject(id)}
                >
                  <Icon className={`mx-auto h-6 w-6 ${active ? 'text-accent-foreground' : 'text-muted-foreground'}`} />
                  <p className={`mt-2 font-brand text-sm font-medium ${active ? 'text-accent-foreground' : 'text-foreground'}`}>
                    {label}
                  </p>
                </Card>
              );
            })}
          </div>

          {selectedSubjects.length > 0 && (
            <div className="mt-8">
              <h2 className="font-brand text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Your Subjects
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {selectedSubjects.map((s) => (
                  <Button
                    key={s}
                    variant="outline"
                    className="font-brand capitalize"
                    onClick={() => navigate(`/capsules/${s}`)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
