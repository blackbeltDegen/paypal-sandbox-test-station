"use client";

interface Props {
  logs: string[];
  onClear: () => void;
}

export default function ScenarioLog({ logs, onClear }: Props) {
  return (
    <section className="rounded-2xl border border-white/10 bg-dark-800 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Scenario Log</h2>
        <button
          onClick={onClear}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          Clear Log
        </button>
      </div>

      <div className="h-48 overflow-y-auto rounded-lg border border-white/5 bg-dark-950 p-3 font-mono text-xs">
        {logs.length === 0 ? (
          <p className="text-white/20">No events yet…</p>
        ) : (
          <div className="space-y-1">
            {logs
              .slice()
              .reverse()
              .map((log, i) => (
                <div key={i} className="text-white/60">
                  <span className="mr-2 text-white/20">
                    {new Date().toLocaleTimeString()}
                  </span>
                  {log}
                </div>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
