/** Random, PG player names built from Claude / Anthropic terms, like "Agentic Haiku" or "Caffeinated Subagent". */

const ADJECTIVES = [
  'Helpful', 'Honest', 'Harmless', 'Agentic', 'Adaptive', 'Aligned', 'Cached', 'Streaming',
  'Thoughtful', 'Curious', 'Multimodal', 'Autonomous', 'Proactive', 'Interpretable',
  'Recursive', 'Parallel', 'Async', 'Tokenized', 'Compacted', 'Prompted', 'Fine-Tuned',
  'Reasoning', 'Caffeinated', 'Headless', 'Sandboxed', 'Verified', 'Grounded', 'Steerable',
  'Frontier', 'Emergent', 'Latent', 'Embedded', 'Vectorized', 'Synthetic', 'Zero-Shot',
  'Few-Shot', 'One-Shot', 'Distilled', 'Quantized', 'Hooked', 'Forked', 'Deployed', 'Shipped',
  'Vibe-Coded', 'Golden Gate', 'Constitutional', 'Benchmarked', 'Overclocked', 'Stochastic',
  'Context-Rich', 'Long-Context', 'Tool-Using', 'Self-Correcting', 'Well-Prompted', 'Elicited',
  'Scalable',
];

const NOUNS = [
  'Claude', 'Haiku', 'Sonnet', 'Opus', 'Fable', 'Mythos', 'Shannon', 'Claudius', 'Artifact',
  'Agent', 'Subagent', 'Prompt', 'Token', 'Tokenizer', 'Transformer', 'Embedding', 'Skill',
  'Hook', 'Plugin', 'Connector', 'Workflow', 'Sandbox', 'Terminal', 'Duet', 'Constitution',
  'Neuron', 'Feature', 'Gradient', 'Checkpoint', 'Benchmark', 'Eval', 'Router', 'Cache',
  'Debugger', 'Linter', 'Commit', 'Diff', 'Repo', 'Kernel', 'Daemon', 'Parser', 'Spark',
  'Tool Call', 'MCP Server', 'Context Window', 'System Prompt', 'Attention Head', 'Weight',
  'Logit', 'Thinking Block', 'Codebase', 'Pull Request', 'Stack Trace', 'Unit Test',
  'Model Card', 'Safety Level',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function randomName(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

/** Returns a name not present in `taken`. Falls back to a numeric suffix if the pool is exhausted. */
export function generateUniqueName(taken: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const name = randomName();
    if (!taken.has(name)) return name;
  }
  const base = randomName();
  for (let n = 2; ; n++) {
    const name = `${base} ${n}`;
    if (!taken.has(name)) return name;
  }
}
