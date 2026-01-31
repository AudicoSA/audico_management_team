"use client";

import { useState, useEffect } from "react";

interface EnrichmentStats {
  total: number;
  enriched: number;
  pending: number;
  byType: Record<string, number>;
}

interface EnrichmentProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
}

export default function EnrichmentPage() {
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch stats on load
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/enrich");
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEnrichment = async () => {
    setIsRunning(true);
    setError(null);
    setLogs([]);
    setProgress(null);

    addLog("Starting bulk enrichment...");

    try {
      const res = await fetch("/api/admin/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk", batchSize: 50 }),
      });

      const data = await res.json();

      if (data.success) {
        setProgress(data.result);
        addLog(`Enrichment complete!`);
        addLog(`Processed: ${data.result.processed}`);
        addLog(`Successful: ${data.result.successful}`);
        addLog(`Failed: ${data.result.failed}`);
        fetchStats(); // Refresh stats
      } else {
        setError(data.error);
        addLog(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setError(err.message);
      addLog(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const progressPercent = progress
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-[#c8ff00]">
          Product Enrichment Dashboard
        </h1>

        {/* Stats Card */}
        <div className="bg-[#141414] rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Current Status</h2>
          {stats ? (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[#1a1a1a] p-4 rounded">
                <div className="text-3xl font-bold text-[#c8ff00]">
                  {stats.total.toLocaleString()}
                </div>
                <div className="text-gray-400">Total Products</div>
              </div>
              <div className="bg-[#1a1a1a] p-4 rounded">
                <div className="text-3xl font-bold text-green-500">
                  {stats.enriched.toLocaleString()}
                </div>
                <div className="text-gray-400">Enriched</div>
              </div>
              <div className="bg-[#1a1a1a] p-4 rounded">
                <div className="text-3xl font-bold text-yellow-500">
                  {stats.pending.toLocaleString()}
                </div>
                <div className="text-gray-400">Pending</div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400">Loading stats...</div>
          )}

          {/* Type breakdown */}
          {stats && Object.keys(stats.byType).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">By Component Type</h3>
              <div className="grid grid-cols-4 gap-2 text-sm">
                {Object.entries(stats.byType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="bg-[#1a1a1a] p-2 rounded">
                      <span className="text-[#c8ff00]">{count}</span>
                      <span className="text-gray-400 ml-2">{type}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Card */}
        <div className="bg-[#141414] rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Run Enrichment</h2>

          {!isRunning ? (
            <button
              onClick={startEnrichment}
              disabled={stats?.pending === 0}
              className="bg-[#c8ff00] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#b8ef00] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {stats?.pending === 0
                ? "All Products Enriched!"
                : `Start Enrichment (${stats?.pending || 0} pending)`}
            </button>
          ) : (
            <div>
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <span>Processing...</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-[#1a1a1a] rounded-full h-4">
                  <div
                    className="bg-[#c8ff00] h-4 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {progress && (
                  <div className="text-sm text-gray-400 mt-1">
                    {progress.processed} / {progress.total} products
                  </div>
                )}
              </div>

              <div className="animate-pulse text-[#c8ff00]">
                AI is classifying products... This may take a while for{" "}
                {stats?.pending.toLocaleString()} products.
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded text-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Logs Card */}
        <div className="bg-[#141414] rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Logs</h2>
          <div className="bg-black rounded p-4 h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500">No logs yet. Start enrichment to see progress.</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-gray-300">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 text-gray-400 text-sm">
          <h3 className="font-semibold mb-2">How it works:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Click "Start Enrichment" to begin classifying products</li>
            <li>AI (GPT-4o-mini) analyzes each product name and assigns a component type</li>
            <li>Products are processed in batches of 50</li>
            <li>Classification is stored in the <code className="text-[#c8ff00]">component_type</code> column</li>
            <li>New products added via feed will be auto-classified via webhook</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
