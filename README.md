# MCP Dual-Cycle Reasoner

[![CI](https://github.com/cyqlelabs/mcp-dual-cycle-reasoner/actions/workflows/ci.yml/badge.svg)](https://github.com/cyqlelabs/mcp-dual-cycle-reasoner/actions/workflows/ci.yml)

A Model Context Protocol (MCP) server implementing the **Dual-Cycle Metacognitive Reasoning Framework** for autonomous agents.
This tool empowers Agents with greater self-awareness and reliability through intelligent loop detection.

## Key Features

- 📊 **Advanced Statistical Analysis** - Entropy-based anomaly detection and time series analysis
- 🧠 **Semantic Text Processing** - NLP-powered case similarity analysis
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
      "args": ["/path/to/mcp-dual-cycle-reasoner/build/index.js"] // Add --stdio for stdio transport
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
      "args": ["@cyqlelabs/mcp-dual-cycle-reasoner"] // Add --stdio for stdio transport
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

#### `start_monitoring`

Initialize metacognitive monitoring of an agent's cognitive process.

**Input Schema:**

```typescript
{
  goal: string; // Current goal being pursued
}
```

**Output:** Success message with monitoring confirmation

#### `process_trace_update`

Main monitoring function - processes cognitive trace updates from the agent.

**Input Schema:**

```typescript
{
  last_action: string            // Latest action name to be added to the accumulated action history
  current_context?: string       // Current environment context or state, in low dash format. Example: adding_product_item
  goal: string                   // Current goal being pursued
  window_size?: number           // Size of the monitoring window (default: 10)
}
```

**Output:** JSON object with intervention details including loop detection and recovery recommendations

#### `stop_monitoring`

Stop metacognitive monitoring and get session summary.

**Input Schema:** `{}` (no parameters)

**Output:** Session summary with goal, intervention count, and trace length

### Loop Detection Tools

#### `detect_loop`

Detect if the agent is stuck in a loop using various strategies.

**Input Schema:**

```typescript
{
  current_context?: string       // Current environment context or state, in low dash format. Example: sending_email
  goal: string                   // Current goal being pursued
  detection_method?: "statistical" | "pattern" | "hybrid"  // Loop detection method (default: "hybrid")
}
```

**Output:** Loop detection result with confidence, type, and statistical metrics

#### `configure_detection`

Configure loop detection parameters and domain-specific progress indicators.

**Input Schema:**

```typescript
{
  progress_indicators?: string[]           // Action patterns that indicate positive task progress (default: [])
  min_actions_for_detection?: number       // Minimum number of actions required before loop detection (default: 5)
  alternating_threshold?: number           // Threshold for detecting alternating action patterns (default: 0.5)
  repetition_threshold?: number            // Threshold for detecting repetitive action patterns (default: 0.4)
  progress_threshold_adjustment?: number   // How much to increase thresholds when progress indicators are present (default: 0.2)
}
```

**Output:** Configuration confirmation with current settings

### Experience Management

#### `store_experience`

Store a case for future case-based reasoning.

**Input Schema:**

```typescript
{
  problem_description: string; // Simple description of the problem
  solution: string; // What action resolved the issue
  outcome: boolean; // Whether the solution was successful
}
```

**Output:** Confirmation message with case ID

#### `retrieve_similar_cases`

Retrieve similar cases from the case base.

**Input Schema:**

```typescript
{
  problem_description: string    // Simple description of the problem
  max_results?: number           // Maximum number of cases to return (default: 5)
}
```

**Output:** Array of similar cases with similarity metrics

### System Tools

#### `get_monitoring_status`

Get current monitoring status and statistics.

**Input Schema:** `{}` (no parameters)

**Output:** Current monitoring status with metrics

#### `reset_engine`

Reset the dual-cycle engine state.

**Input Schema:** `{}` (no parameters)

**Output:** Reset confirmation message

## Technical Implementation

### Advanced Loop Detection Strategies

- **Enhanced Action Trace Analysis**: Entropy-based anomaly detection and autocorrelation analysis
- **Advanced State Invariance Tracking**: MD5 hash-based state fingerprinting and statistical similarity measurement
- **Multi-Method Detection**: Statistical, pattern-based, and hybrid approaches with configurable thresholds

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
