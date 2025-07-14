# MCP Dual-Cycle Reasoner

A Model Context Protocol (MCP) server implementing the **Dual-Cycle Metacognitive Reasoning Framework** for autonomous agents.

## Key Features

- 📊 **Advanced Statistical Analysis** - Entropy-based anomaly detection and time series analysis
- 🧠 **Semantic Text Processing** - NLP-powered belief revision and case similarity
- 🎯 **Multi-Strategy Detection** - Statistical, pattern-based, and hybrid loop detection
- 📈 **Time Series Analysis** - Trend detection and cyclical pattern recognition
- 🔧 **Configurable Detection** - Domain-specific thresholds and progress indicators
- 🚀 **High-Performance Libraries** - Built with simple-statistics, natural, and compromise

## Architecture Overview

Based on the framework described in `DUAL-CYCLE.MD`, this implementation features:

- **Cognitive Cycle (The "Doer")**: Direct interaction with the environment
- **Metacognitive Cycle (The "Thinker")**: Monitors and controls the cognitive cycle

## Installation

```bash
cd mcp-dual-cycle-reasoner
npm install
npm run build
```

### Local Usage

```json
{
  "mcpServers": {
    "dual-cycle-reasoner": {
      "command": "node",
      "args": ["/path/to/mcp-dual-cycle-reasoner/build/index.js"]
    }
  }
}
```

### Using with Claude Desktop

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "dual-cycle-reasoner": {
      "command": "npx",
      "args": ["@cyqlelabs/mcp-dual-cycle-reasoner"]
    }
  }
}
```

### Running the Server

```bash
npm start
```

## Available Tools

### Core Monitoring Tools

- `start_monitoring`: Start metacognitive monitoring of an agent's cognitive process.
- `process_trace_update`: Main monitoring function - process a cognitive trace update from the agent.
- `stop_monitoring`: Stop monitoring and get session summary.

### Loop Detection Tools

- `detect_loop`: Detect if the agent is stuck in a loop using various strategies.
- `configure_detection`: Configure loop detection parameters and domain-specific progress indicators.

### Failure Analysis Tools

- `diagnose_failure`: Diagnose the cause of a detected loop using abductive reasoning.
- `revise_beliefs`: Revise agent beliefs using AGM belief revision principles.

### Recovery Tools

- `generate_recovery_plan`: Generate a recovery plan using case-based reasoning.

### Experience Management

- `store_experience`: Store a case for future case-based reasoning.
- `retrieve_similar_cases`: Retrieve similar cases from the case base.

## Schema Simplifications

The latest version features simplified schemas optimized for LLM usage.

## Advanced Loop Detection Strategies

- **Enhanced Action Trace Analysis**: Entropy-based anomaly detection and autocorrelation analysis.
- **Advanced State Invariance Tracking**: MD5 hash-based state fingerprinting and statistical similarity measurement.

## Recovery Patterns

The system implements five recovery patterns:

1. **Strategic Retreat**: Backtrack to known good state
2. **Context Refresh**: Clear state
3. **Modality Switching**: Switch from DOM to visual interaction
4. **Information Foraging**: Explore page structure systematically
5. **Human Escalation**: Request human intervention

## Theoretical Foundation

This implementation combines cognitive science, AI research, and advanced computational methods.

## Research Applications

This framework enables research in:

- **Autonomous agent robustness**: Preventing and recovering from failure states
- **Metacognitive AI systems**: Self-monitoring and self-regulation in AI agents

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions welcome! Please read the contributing guidelines and ensure all tests pass.

## Support

For issues and questions, please use the GitHub issue tracker.

