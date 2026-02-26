'use client';

import { useState, useEffect } from 'react';

export default function ResourceTest() {
    const [filter, setFilter] = useState('0100000000000000'); // 'cell_structure' is index 0
    const [level, setLevel] = useState(2);
    const [gradeBand, setGradeBand] = useState<number | null>(null);
    const [resources, setResources] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('grade_band');
        if (stored) {
            setGradeBand(parseInt(stored, 10));
        }
    }, []);

    const fetchResources = async () => {
        console.log('Fetching resources with:', { filter, level, gradeBand });
        if (!gradeBand) {
            setError('Please select a grade band first on the home page.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filter,
                    level,
                    grade_band: gradeBand
                })
            });
            console.log('Response status:', res.status);
            const data = await res.json();
            console.log('Response data:', data);
            if (data.error) {
                setError(data.error);
            } else {
                setResources(data.modules || []);
            }
        } catch (err: any) {
            console.error('Fetch error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold">Resource Engine Test</h1>

            <div className="bg-card p-4 rounded-lg border space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Filter (Binary String):</label>
                    <input
                        type="text"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="w-full p-2 border rounded font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Hint: index 0 = `cell_structure`, index 3 = `fractions`.</p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Level (1-3):</label>
                    <input
                        type="number"
                        value={level}
                        onChange={e => setLevel(parseInt(e.target.value))}
                        min={1} max={3}
                        className="w-full p-2 border rounded"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Grade Band (1-4):</label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={gradeBand || 2}
                            onChange={e => setGradeBand(parseInt(e.target.value))}
                            min={1} max={4}
                            className="flex-1 p-2 border rounded"
                        />
                        <div className="p-2 border rounded bg-muted text-xs flex items-center">
                            {localStorage.getItem('grade_band') ? `Saved: ${localStorage.getItem('grade_band')}` : 'Not saved yet'}
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">If not set, select here manually or visit the home page.</p>
                </div>

                <button
                    onClick={fetchResources}
                    disabled={loading}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium w-full disabled:opacity-50"
                >
                    {loading ? 'Fetching...' : 'Fetch Modules'}
                </button>
            </div>

            {error && (
                <div className="text-red-500 p-4 border border-red-200 bg-red-50 rounded">
                    Error: {error}
                </div>
            )}

            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Results:</h2>
                {resources.length === 0 ? (
                    <p className="text-muted-foreground">No modules found or not fetched yet.</p>
                ) : (
                    resources.map(mod => (
                        <div key={mod.id} className="p-4 border rounded-lg bg-card">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-xs text-blue-500 font-medium mb-1">{mod.subject} / {mod.topic}</div>
                                    <h3 className="text-lg font-bold">{mod.title}</h3>
                                    <p className="text-muted-foreground">{mod.description}</p>
                                </div>
                                <div className="text-right text-sm text-muted-foreground">
                                    <div>Level {mod.level}</div>
                                    <div>Grade Band {mod.grade_band}</div>
                                    <div>{Math.round(mod.size_bytes / 1024)} KB</div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
