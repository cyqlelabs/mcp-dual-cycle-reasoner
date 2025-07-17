# MCP Dual-Cycle Reasoner

[![CI](https://github.com/cyqlelabs/mcp-dual-cycle-reasoner/actions/workflows/ci.yml/badge.svg)](https://github.com/cyqlelabs/mcp-dual-cycle-reasoner/actions/workflows/ci.yml)

A Model Context Protocol (MCP) server implementing the **Dual-Cycle Metacognitive Reasoning Framework** for autonomous agents.
This tool empowers Agents with greater self-awareness and reliability through intelligent loop detection and experience acquisition.

## Key Features

- 📊 **Advanced Statistical Analysis** - Entropy-based anomaly detection and time series analysis
- 🧠 **Enhanced Case-Based Reasoning** - Semantic similarity matching with NLI-based text analysis
- 🎯 **Multi-Strategy Detection** - Statistical, pattern-based, and hybrid loop detection
- 📈 **Time Series Analysis** - Trend detection and cyclical pattern recognition
- 🔧 **Configurable Detection** - Domain-specific thresholds and progress indicators
- 🎨 **Intelligent Case Management** - Quality scoring, deduplication, and usage-based optimization
- 🚀 **High-Performance Libraries** - Built with simple-statistics, natural, compromise, and HuggingFace Transformers

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
  semantic_intents?: string[]              // Domain-specific action intents for semantic analysis (default: generic intents)
}
```

**Output:** Configuration confirmation with current settings

### Enhanced Experience Management

#### `store_experience`

Store a case for future case-based reasoning with enhanced metadata and quality scoring.

**Input Schema:**

```typescript
{
  problem_description: string;          // Simple description of the problem
  solution: string;                     // What action resolved the issue
  outcome: boolean;                     // Whether the solution was successful
  context?: string;                     // Context in which this case occurred
  goal_type?: string;                   // Type of goal this case relates to
  difficulty_level?: "low" | "medium" | "high";  // Difficulty level of the case
}
```

**Features:**

- Automatic semantic feature extraction (intents, sentiment, keywords)
- Quality scoring and validation
- Duplicate detection and case merging
- Confidence scoring based on description quality

**Output:** Confirmation message with case ID and quality metrics

#### `retrieve_similar_cases`

Retrieve similar cases using advanced semantic matching and filtering.

**Input Schema:**

```typescript
{
  problem_description: string;          // Simple description of the problem
  max_results?: number;                 // Maximum number of cases to return (default: 5)
  context_filter?: string;              // Filter cases by context
  goal_type_filter?: string;            // Filter cases by goal type
  difficulty_filter?: "low" | "medium" | "high";  // Filter by difficulty level
  outcome_filter?: boolean;             // Filter by success/failure
  min_similarity?: number;              // Minimum similarity threshold (0-1, default: 0.1)
}
```

**Features:**

- **Multi-modal similarity scoring**: Combines semantic (50%), traditional NLP (30%), and feature-based (20%) similarity
- **Advanced filtering**: Context, goal type, difficulty, and outcome filters
- **Usage-based ranking**: Prioritizes cases with proven track records
- **Quality-weighted results**: Higher quality cases rank higher

**Output:** Array of ranked similar cases with comprehensive similarity metrics

### System Tools

#### `get_monitoring_status`

Get current monitoring status and statistics.

**Input Schema:** `{}` (no parameters)

**Output:** Current monitoring status with metrics

#### `reset_engine`

Reset the dual-cycle engine state.

**Input Schema:** `{}` (no parameters)

**Output:** Reset confirmation message

## Example Usage Scenario

Here's a complete example showing how to use the dual-cycle reasoner to monitor an autonomous agent and build up experience over time:

### 1. Initial Setup and Configuration

```typescript
// Configure detection parameters for your domain
await configure_detection({
  progress_indicators: ['page_loaded', 'form_submitted', 'data_extracted'],
  min_actions_for_detection: 3,
  alternating_threshold: 0.6,
  repetition_threshold: 0.3,
  semantic_intents: [
    'navigating to page',
    'clicking element',
    'filling form field',
    'submitting form',
    'validating input',
    'handling popup',
    'extracting data',
    'waiting for response',
  ],
});

// Start monitoring the agent's goal
await start_monitoring({
  goal: 'Complete user registration process on website',
});
```

### 2. Monitoring Agent Actions

```typescript
// Monitor each action the agent takes
await process_trace_update({
  last_action: 'click_signup_button',
  current_context: 'homepage',
  goal: 'Complete user registration process on website',
});

await process_trace_update({
  last_action: 'fill_email_field',
  current_context: 'registration_form',
  goal: 'Complete user registration process on website',
});

await process_trace_update({
  last_action: 'click_submit_button',
  current_context: 'registration_form',
  goal: 'Complete user registration process on website',
});

// Agent gets stuck clicking submit repeatedly
await process_trace_update({
  last_action: 'click_submit_button',
  current_context: 'registration_form',
  goal: 'Complete user registration process on website',
});
// Returns: {
//   intervention_required: true,
//   loop_detected: {
//     detected: true,
//     type: "action_repetition",
//     confidence: 0.85,
//     details: "Loop detected via parameter_repetition: 57% anomaly score...",
//     actions_involved: ["click_submit_button"]
//   }
// }
```

### 3. Storing Experience Cases

```typescript
// Store successful experiences
await store_experience({
  problem_description: 'Email validation error blocking form submission',
  solution: 'Check email format and retry with valid email address',
  outcome: true,
  context: 'registration_form',
  goal_type: 'user_registration',
  difficulty_level: 'medium',
});

// Store failed attempts for learning
await store_experience({
  problem_description: 'Submit button unresponsive after multiple clicks',
  solution: 'Refresh page and start over',
  outcome: false,
  context: 'registration_form',
  goal_type: 'user_registration',
  difficulty_level: 'high',
});
```

### 4. Retrieving Similar Cases for Recovery

```typescript
// When a loop is detected, retrieve similar cases
const similarCases = await retrieve_similar_cases({
  problem_description: 'Form submission button not responding to clicks',
  max_results: 3,
  context_filter: 'registration_form',
  outcome_filter: true, // Only successful cases
  min_similarity: 0.3,
});

// Returns cases ranked by similarity with comprehensive metrics:
// [
//   {
//     id: "case_123",
//     problem_description: "Email validation error blocking form submission",
//     solution: "Check email format and retry with valid email address",
//     outcome: true,
//     context: "registration_form",
//     success_rate: 0.85,
//     usage_count: 12,
//     similarity_metrics: {
//       semantic_similarity: 0.72,
//       combined_similarity: 0.78
//     }
//   }
// ]
```

### 5. Advanced Loop Detection

```typescript
// Use standalone loop detection for analysis
const loopResult = await detect_loop({
  current_context: 'registration_form',
  goal: 'Complete user registration process on website',
  detection_method: 'hybrid',
});

// Returns detailed analysis:
// {
//   detected: true,
//   type: "action_repetition",
//   confidence: 0.85,
//   details: "Detected repeated 'click_submit_button' actions",
//   statistical_metrics: {
//     entropy_score: 0.2,
//     variance_score: 0.1
//   }
// }
```

### 6. Building Domain Expertise Over Time

```typescript
// As the agent encounters more scenarios, store diverse cases
await store_experience({
  problem_description: 'CAPTCHA verification required after form submission',
  solution: 'Detect CAPTCHA element and request human assistance',
  outcome: true,
  context: 'registration_form',
  goal_type: 'user_registration',
  difficulty_level: 'high',
});

// Later retrievals become more intelligent with larger case base
const expertCases = await retrieve_similar_cases({
  problem_description: 'Security verification blocking registration',
  context_filter: 'registration_form',
  difficulty_filter: 'high',
  max_results: 5,
});

// System now returns highly relevant cases based on:
// - Semantic similarity (CAPTCHA ≈ security verification)
// - Context matching (registration_form)
// - Difficulty level filtering
// - Success rate weighting
// - Usage frequency boosting
```

### 7. Monitoring and Cleanup

```typescript
// Check system status
const status = await get_monitoring_status();
// Returns: { is_monitoring: true, intervention_count: 3, trace_length: 15 }

// Stop monitoring when done
await stop_monitoring();
// Returns summary of session

// Reset for new session if needed
await reset_engine();
```

### Key Benefits Demonstrated

1. **Proactive Loop Detection**: Catches repetitive behaviors before they waste resources
2. **Intelligent Case Matching**: Finds relevant solutions using semantic similarity, not just keyword matching
3. **Quality-Aware Learning**: Prioritizes proven solutions and filters out low-quality cases
4. **Context-Aware Retrieval**: Matches cases based on situation context, not just problem description
5. **Continuous Improvement**: Case base becomes more valuable over time with usage statistics and success rates

This example shows how the dual-cycle reasoner transforms a simple autonomous agent into a self-aware, learning system that can detect when it's stuck and recover using past experience.

## Technical Implementation

### Advanced Loop Detection Strategies

- **Enhanced Action Trace Analysis**: Entropy-based anomaly detection and autocorrelation analysis
- **Advanced State Invariance Tracking**: MD5 hash-based state fingerprinting and statistical similarity measurement
- **Multi-Method Detection**: Statistical, pattern-based, and hybrid approaches with configurable thresholds

### Enhanced Case-Based Reasoning

- **Semantic Similarity Matching**: NLI-based bidirectional text analysis using HuggingFace Transformers
- **Multi-Modal Scoring**: Combines semantic, traditional NLP, and feature-based similarity metrics
- **Quality Management**: Automatic case validation, confidence scoring, and duplicate detection
- **Intelligent Indexing**: Hierarchical case organization by context and goal type for faster retrieval
- **Usage-Based Optimization**: Proven cases receive priority through success rate and usage tracking
- **Memory Management**: Intelligent case base pruning maintains optimal performance with quality-based selection

## Research Applications

This framework enables research in:

- **Autonomous agent robustness**: Preventing and recovering from failure states
- **Metacognitive AI systems**: Self-monitoring and self-regulation in AI agents
- **Case-based reasoning**: Advanced semantic similarity matching and quality-aware case management
- **Cognitive architecture**: Dual-cycle processing with enhanced experience learning

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions welcome! Please read the contributing guidelines and ensure all tests pass.

## Support

For issues and questions, please use the GitHub issue tracker.
