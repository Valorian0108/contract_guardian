import React, { useState, useEffect } from 'react';

type ThreatLevel = 'RED' | 'YELLOW' | 'GREEN';

interface AnalysisResult {
  what_leaves: string;
  what_enters: string;
  threat_level: ThreatLevel;
  reason: string;
}

interface EtherscanTx {
  hash: string;
  to: string;
  from: string;
  value: string;
  input: string;
  isError: string;
  timeStamp: string;
}

interface EtherscanTokenTx {
  hash: string;
  to: string;
  from: string;
  value: string;
  tokenSymbol: string;
  tokenName: string;
  contractAddress: string;
  timeStamp: string;
}

interface EtherscanLog {
  address: string;   // token contract that emitted the Approval
  topics: string[];  // [topic0, owner_padded, spender_padded]
  data: string;      // allowance amount
  transactionHash: string;
  timeStamp: string;
}

interface OnchainData {
  recentTxs: EtherscanTx[];
  tokenTransfers: EtherscanTokenTx[];
  approvalLogs: EtherscanLog[];
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const ETHERSCAN_API_KEY = import.meta.env.VITE_ETHERSCAN_API as string | undefined;
const ETHERSCAN_BASE = 'https://api.etherscan.io/api';

// ERC-20 Approval(address indexed owner, address indexed spender, uint256 value)
const APPROVAL_TOPIC0 = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
const UINT256_MAX = 'f'.repeat(64); // unlimited allowance sentinel

const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
];

// ── Wallet address detection ────────────────────────────────────────────────
function isWalletAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(input.trim());
}

// ── Etherscan data fetch ─────────────────────────────────────────────────────
async function fetchEtherscanData(address: string): Promise<OnchainData> {
  const addr = address.toLowerCase();
  const paddedAddr = '0x000000000000000000000000' + addr.slice(2);

  const [txRes, tokenRes, logsRes] = await Promise.all([
    fetch(`${ETHERSCAN_BASE}?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc&apikey=${ETHERSCAN_API_KEY}`),
    fetch(`${ETHERSCAN_BASE}?module=account&action=tokentx&address=${addr}&page=1&offset=20&sort=desc&apikey=${ETHERSCAN_API_KEY}`),
    fetch(`${ETHERSCAN_BASE}?module=logs&action=getLogs&fromBlock=0&toBlock=latest&topic0=${APPROVAL_TOPIC0}&topic0_1_opr=and&topic1=${paddedAddr}&page=1&offset=50&apikey=${ETHERSCAN_API_KEY}`),
  ]);

  const [txData, tokenData, logsData] = await Promise.all([
    txRes.json(),
    tokenRes.json(),
    logsRes.json(),
  ]);

  return {
    recentTxs:      Array.isArray(txData.result)    ? txData.result    : [],
    tokenTransfers: Array.isArray(tokenData.result)  ? tokenData.result  : [],
    approvalLogs:   Array.isArray(logsData.result)   ? logsData.result   : [],
  };
}

// ── Build enriched Gemini prompt from real on-chain data ─────────────────────
function buildWalletPayload(address: string, data: OnchainData): string {
  // Classify each approval log
  const approvals = data.approvalLogs.map((log) => {
    const spender = log.topics[2] ? '0x' + log.topics[2].slice(26) : 'unknown';
    const rawValue = log.data.replace('0x', '').toLowerCase().padStart(64, '0');
    const isUnlimited = rawValue === UINT256_MAX;
    const date = new Date(parseInt(log.timeStamp, 16) * 1000).toISOString().split('T')[0];
    return { tokenContract: log.address, spender, isUnlimited, date, txHash: log.transactionHash };
  });

  const unlimitedCount = approvals.filter((a) => a.isUnlimited).length;

  // Summarise recent transactions (selector only for contract calls)
  const txSummary = data.recentTxs.slice(0, 10).map((tx) => ({
    to: tx.to,
    valueETH: (parseInt(tx.value) / 1e18).toFixed(6),
    selector: tx.input && tx.input !== '0x' ? tx.input.slice(0, 10) : 'native transfer',
    failed: tx.isError === '1',
    date: new Date(parseInt(tx.timeStamp) * 1000).toISOString().split('T')[0],
  }));

  // Summarise token transfers
  const tokenSummary = data.tokenTransfers.slice(0, 10).map((t) => ({
    token: t.tokenSymbol,
    from: t.from,
    to: t.to,
    value: t.value,
    date: new Date(parseInt(t.timeStamp) * 1000).toISOString().split('T')[0],
  }));

  return `WALLET ADDRESS RISK ANALYSIS
Address: ${address}

=== LIVE ON-CHAIN DATA (Etherscan) ===

TOKEN APPROVALS (${approvals.length} total, ${unlimitedCount} UNLIMITED):
${approvals.length > 0 ? JSON.stringify(approvals, null, 2) : 'None found.'}

RECENT TRANSACTIONS (last ${txSummary.length}):
${txSummary.length > 0 ? JSON.stringify(txSummary, null, 2) : 'No transactions found.'}

RECENT ERC-20 TRANSFERS (last ${tokenSummary.length}):
${tokenSummary.length > 0 ? JSON.stringify(tokenSummary, null, 2) : 'No token transfers found.'}

=== END ON-CHAIN DATA ===

Analyse the above REAL on-chain data for Wallet Compromise & Approval Risk. Pay close attention to unlimited approvals, their spender contracts, and any patterns suggesting phishing or drain risk.`;
}

// ────────────────────────────────────────────────────────────────────────────
function cleanAndParseJSON(raw: string): Record<string, unknown> {
  // 1. Strip leading/trailing whitespace
  let text = raw.trim();

  // 2. Remove fenced code blocks: ```json ... ``` or ``` ... ```
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  // 3. Extract the first {...} block in case the model prefixes prose
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    text = text.slice(braceStart, braceEnd + 1);
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Graceful fallback — return a safe caution object instead of crashing
    return {
      what_leaves: 'Could not parse model output.',
      what_enters: 'Could not parse model output.',
      threat_level: 'YELLOW',
      reason: 'The AI response was not valid JSON. Treat this transaction with caution.',
    };
  }
}

const SYSTEM_INSTRUCTION = `You are ContractGuardian, an elite onchain security agent. The user may provide one of the following inputs:
  1. Raw Solidity smart contract source code.
  2. A public wallet address (starting with "0x", typically 42 hex characters).
  3. A raw hex transaction string or calldata snippet.

--- INPUT TYPE: SMART CONTRACT CODE ---
Analyze the Solidity source for hidden security vulnerabilities, malicious permissions, and fund drainage functions. Look for:
  - Unrestricted mint or burn functions.
  - Owner-only backdoors or selfdestruct calls.
  - Proxy upgrade traps or delegatecall abuse.
  - Fee-on-transfer tricks, honeypot sell locks, or hidden tax mechanisms.
  - Reentrancy, flash-loan attack vectors, or oracle manipulation surfaces.

--- INPUT TYPE: WALLET ADDRESS or TRANSACTION SNIPPET ---
When the input looks like a wallet address (0x followed by 40 hex characters) or a short hex blob that is not full Solidity source, perform a "Wallet Compromise & Approval Risk" evaluation. Reason about the following known risk patterns, even if you cannot fetch live chain data:
  - Lingering unlimited token allowances: the wallet may have previously approved a malicious or now-compromised contract via approve(spender, type(uint256).max), leaving all tokens of that type perpetually exposed.
  - Proxy or meta-transaction spending risks: relayer or forwarder contracts that hold a standing allowance can drain funds at any time without a further on-chain prompt from the owner.
  - Suspicious contract interactions that could cause centralized exchanges (CEXes) to classify the address as a Smart Contract (CA) origin or a high-risk destination, potentially freezing withdrawals or deposits.
  - Address patterns associated with known approval-phishing campaigns, Permit2 signature harvesting, or wallet-drainer front-ends.
  - For transaction snippets: identify function selectors (first 4 bytes), check whether the callee is a known approval or permit function, and flag unlimited allowance values (0xffffffff... or uint256 max).

Classify the wallet or address risk as:
  - GREEN: No known red flags. Allowances appear bounded or absent. No suspicious interaction history inferred.
  - YELLOW: Minor cautions — one or more potentially unlimited allowances to contracts whose risk is unclear, or patterns that might trigger CEX compliance flags.
  - RED: Severe risk — unlimited allowances to contracts with known drain history, approval-phishing signatures, Permit2 misuse, or strong indicators of wallet compromise.

--- OUTPUT FORMAT (ALL INPUT TYPES) ---
You MUST respond strictly with a valid JSON object and nothing else:
{
  "what_leaves": "<Plain-English description of potential asset drain risks, lingering allowances, or dangerous permissions. Use bullet points separated by \\n if multiple items.>",
  "what_enters": "<Plain-English description of what the wallet or contract receives, or 'None' if nothing enters.>",
  "threat_level": "GREEN" | "YELLOW" | "RED",
  "reason": "<Concise plain-English explanation of why this input triggered this threat level.>"
}
Do not include markdown code block formatting like \`\`\`json or any conversational prose. Return raw JSON text only.`;

const TerminalSpinner = () => {
  const [frame, setFrame] = useState(0);
  const frames = ['/', '-', '\\', '|'];

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="font-mono text-[#39FF14] text-xl font-bold">
      {frames[frame]}
    </span>
  );
};

async function tryModel(model: string, payload: string): Promise<AnalysisResult> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          parts: [{ text: payload }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let detail = '';
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.error?.message ?? body;
    } catch {
      detail = body;
    }
    // Throw a typed error so the caller can decide whether to retry
    const err = new Error(`${response.status}: ${detail}`.trim()) as Error & { status: number };
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!rawText) {
    throw new Error('// ERROR: Gemini returned an empty response. Try again or refine your input.');
  }

  const obj = cleanAndParseJSON(rawText);

  const threat = String(obj.threat_level ?? '').toUpperCase() as ThreatLevel;
  const validThreat = (['RED', 'YELLOW', 'GREEN'] as const).includes(threat as ThreatLevel)
    ? (threat as ThreatLevel)
    : 'YELLOW';

  return {
    what_leaves: String(obj.what_leaves ?? 'Unable to determine outgoing assets.'),
    what_enters: String(obj.what_enters ?? 'Unable to determine incoming assets.'),
    threat_level: validThreat,
    reason: String(obj.reason ?? 'Response could not be fully parsed; treat with caution.'),
  };
}

async function analyzeWithGemini(payload: string): Promise<AnalysisResult> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      '// ERROR: VITE_GEMINI_API_KEY is not configured. Set it in your Replit Secrets.',
    );
  }

  let lastError: Error = new Error('// ERROR: No models available to try.');

  for (const model of GEMINI_MODELS) {
    try {
      return await tryModel(model, payload);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const status = (err as { status?: number }).status;
      // Fall through to the next model on 404/400 (model unavailable) or 503 (overloaded)
      if (status === 404 || status === 400 || status === 503) {
        continue;
      }
      // For auth errors, quota errors, or parse failures — surface immediately
      throw lastError;
    }
  }

  throw new Error(
    `// ERROR: All models exhausted. Last error: ${lastError.message}`,
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Analyzing Payload...');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError(
        '// ERROR: No input detected. Paste a contract address, wallet address, or payload to analyze.',
      );
      setResult(null);
      return;
    }

    setError(null);
    setIsAnalyzing(true);
    setResult(null);

    try {
      let payload: string;

      if (isWalletAddress(trimmed)) {
        if (!ETHERSCAN_API_KEY) {
          throw new Error(
            '// ERROR: VITE_ETHERSCAN_API is not configured. Set it in your Replit Secrets.',
          );
        }
        setStatusMessage('Fetching on-chain data...');
        const onchainData = await fetchEtherscanData(trimmed);
        setStatusMessage('Analyzing with AI...');
        payload = buildWalletPayload(trimmed, onchainData);
      } else {
        setStatusMessage('Analyzing Payload...');
        payload = trimmed;
      }

      const analysisResult = await analyzeWithGemini(payload);
      setResult(analysisResult);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : '// ERROR: Unknown failure during analysis.';
      setError(message);
    } finally {
      setIsAnalyzing(false);
      setStatusMessage('Analyzing Payload...');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isAnalyzing) handleAnalyze();
    }
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
            Plain-English web3 transaction safety checker. Powered by Gemini AI.
          </p>
        </header>

        {/* Main Input Area */}
        <section className="flex flex-col gap-4">
          <div className="relative">
            <textarea
              className="w-full min-h-[160px] p-4 bg-[#121212] border border-zinc-800 rounded-sm font-mono text-sm sm:text-base text-zinc-300 focus:outline-none focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] transition-colors resize-y placeholder:text-zinc-600"
              placeholder="Paste a smart contract address, Solidity code, or hexadecimal transaction payload here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              disabled={isAnalyzing}
            />
            {error && (
              <p className="text-red-500 font-mono text-xs sm:text-sm mt-2 break-words">
                {error}
              </p>
            )}
            <p className="text-zinc-700 font-mono text-xs mt-1 text-right select-none">
              Ctrl+Enter to analyze
            </p>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full sm:w-auto self-start bg-[#39FF14] hover:bg-[#32e612] text-black font-bold uppercase tracking-widest px-8 py-4 rounded-sm transition-colors flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <TerminalSpinner />
                <span>{statusMessage}</span>
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
              <ul className="list-disc list-inside font-mono text-zinc-300 text-sm sm:text-base space-y-1">
                {(result.what_leaves ?? '').split('\n').filter(Boolean).map((line, i) => (
                  <li key={i}>{line.replace(/^[-•*]\s*/, '')}</li>
                ))}
              </ul>
            </div>

            <div className="h-px w-full bg-zinc-800" />

            {/* Section 2 */}
            <div className="p-5 sm:p-6 flex flex-col gap-3">
              <h2 className="uppercase text-zinc-500 font-mono tracking-widest text-xs flex items-center gap-2">
                <span>🎁</span> WHAT ENTERS YOUR WALLET
              </h2>
              <ul className="list-disc list-inside font-mono text-zinc-300 text-sm sm:text-base space-y-1">
                {result.what_enters.split('\n').filter(Boolean).map((line, i) => (
                  <li key={i}>{line.replace(/^[-•*]\s*/, '')}</li>
                ))}
              </ul>
            </div>

            <div className="h-px w-full bg-zinc-800" />

            {/* Section 3 */}
            <div className="p-5 sm:p-6 flex flex-col gap-4 bg-zinc-900/50">
              <h2 className="uppercase text-zinc-500 font-mono tracking-widest text-xs flex items-center gap-2">
                <span>🚨</span> THREAT ASSESSMENT
              </h2>

              <div className="flex flex-col items-start gap-3">
                {result.threat_level === 'RED' && (
                  <div className="bg-red-600 border border-red-500 text-white font-mono font-bold px-3 py-1 text-sm tracking-widest rounded-sm">
                    RED / HIGH DANGER
                  </div>
                )}
                {result.threat_level === 'GREEN' && (
                  <div className="bg-[#39FF14] text-black font-mono font-bold px-3 py-1 text-sm tracking-widest rounded-sm">
                    GREEN / SAFE
                  </div>
                )}
                {result.threat_level === 'YELLOW' && (
                  <div className="bg-yellow-400 border border-yellow-400 text-black font-mono font-bold px-3 py-1 text-sm tracking-widest rounded-sm">
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
