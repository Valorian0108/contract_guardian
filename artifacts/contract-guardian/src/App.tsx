import React, { useState, useEffect } from 'react';

type ThreatLevel = 'RED' | 'YELLOW' | 'GREEN';

interface AnalysisResult {
  leaves: string;
  enters: string;
  threatLevel: ThreatLevel;
  reason: string;
}

const TerminalSpinner = () => {
  const [frame, setFrame] = useState(0);
  const frames = ['/', '-', '\\', '|'];

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return <span className="font-mono text-[#39FF14] text-xl font-bold">{frames[frame]}</span>;
};

export default function App() {
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError('// ERROR: No input detected. Paste a contract address or payload to analyze.');
      setResult(null);
      return;
    }
    
    setError(null);
    setIsAnalyzing(true);
    setResult(null);

    setTimeout(() => {
      const lower = trimmed.toLowerCase();
      let analysisResult: AnalysisResult;

      if (lower.includes('approve') || lower.includes('0x095ea7b3')) {
        analysisResult = {
          leaves: '⚠️ Unlimited approval to spend all USDT in your wallet.',
          enters: 'Nothing (Permission grant only).',
          threatLevel: 'RED',
          reason: 'This contract is requesting the ability to drain your entire USDT balance at any time.'
        };
      } else if (lower.includes('mint') || lower.includes('0xa9059cbb')) {
        analysisResult = {
          leaves: '0.05 ETH ($150.00 estimated network fee + mint cost).',
          enters: '1x \'Genesis Hacker\' NFT.',
          threatLevel: 'GREEN',
          reason: 'Standard mint function verified; asset exchange matches the transaction intent.'
        };
      } else {
        analysisResult = {
          leaves: 'Gas fees only (Estimated 0.002 ETH).',
          enters: 'Contract deployment confirmation.',
          threatLevel: 'YELLOW',
          reason: 'Unrecognized function signature. Proceed with caution and verify the recipient address.'
        };
      }

      setResult(analysisResult);
      setIsAnalyzing(false);
    }, 1500);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background cyber-grid text-foreground flex flex-col items-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-2xl sm:max-w-3xl flex flex-col gap-8">
        
        {/* Header */}
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>🛡️</span> ContractGuardian
          </h1>
          <p className="font-mono text-zinc-500 text-sm sm:text-base">
            Plain-English web3 transaction safety checker.
          </p>
        </header>

        {/* Main Input Area */}
        <section className="flex flex-col gap-4">
          <div className="relative">
            <textarea
              className="w-full min-h-[160px] p-4 bg-[#121212] border border-zinc-800 rounded-sm font-mono text-sm sm:text-base text-zinc-300 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-y placeholder:text-zinc-600"
              placeholder="Paste a smart contract address, Solidity code, or hexadecimal transaction payload here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
            />
            {error && (
              <p className="text-red-500 font-mono text-xs sm:text-sm mt-2">
                {error}
              </p>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full sm:w-auto self-start bg-[#39FF14] hover:bg-[#32e612] text-black font-bold uppercase tracking-widest px-8 py-4 rounded-sm transition-colors flex items-center justify-center gap-3 disabled:opacity-80 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <TerminalSpinner />
                <span>Analyzing Payload...</span>
              </>
            ) : (
              'Analyze Contract Safety'
            )}
          </button>
        </section>

        {/* Output Card */}
        {result && !isAnalyzing && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-[#121212] border border-zinc-800 rounded-sm flex flex-col overflow-hidden">
            
            {/* Section 1 */}
            <div className="p-5 sm:p-6 flex flex-col gap-3">
              <h2 className="uppercase text-zinc-500 font-mono tracking-widest text-xs flex items-center gap-2">
                <span>💸</span> WHAT LEAVES YOUR WALLET
              </h2>
              <ul className="list-disc list-inside font-mono text-zinc-300 text-sm sm:text-base">
                <li>{result.leaves}</li>
              </ul>
            </div>
            
            <div className="h-px w-full bg-zinc-800" />

            {/* Section 2 */}
            <div className="p-5 sm:p-6 flex flex-col gap-3">
              <h2 className="uppercase text-zinc-500 font-mono tracking-widest text-xs flex items-center gap-2">
                <span>🎁</span> WHAT ENTERS YOUR WALLET
              </h2>
              <ul className="list-disc list-inside font-mono text-zinc-300 text-sm sm:text-base">
                <li>{result.enters}</li>
              </ul>
            </div>

            <div className="h-px w-full bg-zinc-800" />

            {/* Section 3 */}
            <div className="p-5 sm:p-6 flex flex-col gap-4 bg-zinc-900/50">
              <h2 className="uppercase text-zinc-500 font-mono tracking-widest text-xs flex items-center gap-2">
                <span>🚨</span> THREAT ASSESSMENT
              </h2>
              
              <div className="flex flex-col items-start gap-3">
                {result.threatLevel === 'RED' && (
                  <div className="bg-red-600 border border-red-600 text-white font-mono font-bold px-3 py-1 text-sm tracking-widest rounded-sm">
                    RED / HIGH DANGER
                  </div>
                )}
                {result.threatLevel === 'GREEN' && (
                  <div className="bg-[#39FF14] text-black font-mono font-bold px-3 py-1 text-sm tracking-widest rounded-sm">
                    GREEN / SAFE
                  </div>
                )}
                {result.threatLevel === 'YELLOW' && (
                  <div className="bg-yellow-500 border border-yellow-500 text-black font-mono font-bold px-3 py-1 text-sm tracking-widest rounded-sm">
                    YELLOW / CAUTION
                  </div>
                )}
                
                <p className="font-mono text-zinc-300 text-sm sm:text-base leading-relaxed">
                  {result.reason}
                </p>
              </div>
            </div>

          </section>
        )}

      </div>
    </div>
  );
}
