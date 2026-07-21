# 🛡️ Contract Guardian

**Analyze smart contracts and token approvals before you trust them.**

Contract Guardian inspects smart contract source code, bytecode, or active on-chain token approvals to detect common attack vectors used by malicious contracts — including wallet drainers, hidden mint functions, and abusive allowance permissions. It returns a clear risk score and a detailed breakdown so you know exactly what you're interacting with.

---

## Features

- **Drainer Detection** — Identifies patterns used by wallet-draining contracts that silently transfer assets out of your wallet.
- **Hidden Mint Function Analysis** — Flags concealed or unrestricted mint functions that allow unlimited token inflation.
- **Malicious Allowance Scanning** — Audits active token approvals for suspicious or unlimited spending permissions.
- **Bytecode Analysis** — Works even without source code by decompiling and inspecting raw EVM bytecode.
- **Risk Score & Breakdown** — Returns a structured risk score (e.g. Low / Medium / High / Critical) with a clear per-finding breakdown.

---

## How It Works

```
Input: Contract address / source code / bytecode / approval list
         ↓
  Static Analysis Engine
  ┌────────────────────────────────────┐
  │  • Opcode pattern matching         │
  │  • Function signature scanning     │
  │  • Allowance permission checks     │
  │  • Hidden mint heuristics          │
  └────────────────────────────────────┘
         ↓
  Risk Scoring Engine
         ↓
Output: Risk Score + Finding Breakdown
```

---

## Example Output

```
Contract: 0xAbC...1234
Network:  Ethereum Mainnet

RISK SCORE: HIGH (78/100)

Findings:
  [CRITICAL] Hidden mint function detected — owner can mint unlimited supply
  [HIGH]     Unlimited token approval granted to 0xDef...5678
  [MEDIUM]   Transfer function includes non-standard balance deduction
  [INFO]     Contract is not verified on Etherscan

Recommendation: Do NOT interact with this contract.
```

---

## Installation

```bash
git clone https://github.com/Valorian0108/contract_guardian.git
cd contract_guardian
pip install -r requirements.txt   # or: npm install
```

> Requires Python 3.9+ (or Node.js 18+ if applicable). See [prerequisites](#prerequisites) below.

---

## Usage

### Analyze a contract by address

```bash
python main.py --address 0xYourContractAddress --network mainnet
```

### Analyze from source code

```bash
python main.py --source ./MyContract.sol
```

### Analyze from bytecode

```bash
python main.py --bytecode 0x608060405234801561001057600080fd...
```

### Scan active token approvals for a wallet

```bash
python main.py --wallet 0xYourWalletAddress --network mainnet
```

### Options

| Flag | Description |
|---|---|
| `--address` | Contract address to analyze |
| `--source` | Path to Solidity source file |
| `--bytecode` | Raw EVM bytecode string |
| `--wallet` | Wallet address to scan approvals for |
| `--network` | Target network (`mainnet`, `polygon`, `bsc`, etc.) |
| `--output` | Output format: `text` (default), `json` |

---

## Prerequisites

- Python 3.9+
- An RPC endpoint (e.g. Infura, Alchemy, or a local node) set as `RPC_URL` in your environment:

```bash
export RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
```

Or copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

---

## Risk Score Reference

| Score | Level | Meaning |
|---|---|---|
| 0–25 | Low | No significant issues found |
| 26–50 | Medium | Some suspicious patterns; review before interacting |
| 51–75 | High | Multiple red flags; proceed with extreme caution |
| 76–100 | Critical | Known malicious patterns detected; do not interact |

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

[MIT](LICENSE)

---

## Disclaimer

Contract Guardian is a security analysis tool and does not guarantee the safety of any contract. Always do your own research and never interact with contracts you do not fully understand.
