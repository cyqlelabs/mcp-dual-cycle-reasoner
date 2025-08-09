# MCP Dual-Cycle Reasoner

[![CI](https://github.com/cyqlelabs/mcp-dual-cycle-reasoner/actions/workflows/ci.yml/badge.svg)](https://github.com/cyqlelabs/mcp-dual-cycle-reasoner/actions/workflows/ci.yml)

A Model Context Protocol (MCP) server implementing the **Dual-Cycle Metacognitive Reasoning Framework** for autonomous agents. This tool empowers agents with greater self-awareness and reliability through intelligent loop detection and experience acquisition.

## Description

The MCP Dual-Cycle Reasoner is a sophisticated tool designed to enhance the autonomy and reliability of AI agents. By implementing a dual-cycle metacognitive framework, it provides agents with the ability to monitor their own cognitive processes, detect when they are stuck in repetitive loops, and learn from past experiences to make better decisions.

The framework consists of two main components:

- **Sentinel**: Monitors the agent's actions and detects anomalies, such as action repetition, state invariance, and progress stagnation.
- **Adjudicator**: Manages a case base of past experiences, allowing the agent to store and retrieve solutions to previously encountered problems.

This server is built with TypeScript and leverages high-performance libraries for statistical analysis, natural language processing, and semantic similarity, enabling advanced features like entropy-based anomaly detection, NLI-based text analysis, and intelligent case management.

## Key Features

- 📊 **Advanced Statistical Analysis**: Entropy-based anomaly detection and time series analysis.
- 🧠 **Enhanced Case-Based Reasoning**: Semantic similarity matching with NLI-based text analysis.
- 🎯 **Multi-Strategy Detection**: Statistical, pattern-based, and hybrid loop detection.
- 📈 **Time Series Analysis**: Trend detection and cyclical pattern recognition.
- 🔧 **Configurable Detection**: Domain-specific thresholds and progress indicators.
- 🎨 **Intelligent Case Management**: Quality scoring, deduplication, and usage-based optimization.
- 🚀 **High-Performance Libraries**: Built with `simple-statistics`, `natural`, `compromise`, and HuggingFace Transformers.

## Tech Stack

- **Language**: TypeScript
- **Framework**: Node.js
- **Server**: FastMCP for SSE transport
- **NLP and Machine Learning**:
  - `@huggingface/transformers`: For NLI-based semantic analysis
  - `natural`: For sentiment analysis and tokenization
  - `compromise`: For natural language processing
- **Statistics**:
  - `simple-statistics`: For statistical calculations
  - `ml-matrix`: For matrix operations
- **Development Tools**:
  - `jest`: For testing
  - `eslint`: For linting
  - `prettier`: For code formatting
  - `zod`: For schema validation

## Installation

To get the project running locally, follow these steps:

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/cyqlelabs/mcp-dual-cycle-reasoner.git
    cd mcp-dual-cycle-reasoner
    ```

2.  **Install dependencies**:

    ```bash
    npm install
    ```

3.  **Build the project**:
    ```bash
    npm run build
    ```

## Usage

### Running the Server

You can run the server in two modes:

1.  **HTTP Stream (Default)**:

    ```bash
    npm start
    ```

    The server will start on port 8080.

2.  **Stdio**:
    ```bash
    npm start -- --stdio
    ```

### Using with Claude Desktop

Add the following to your Claude Desktop MCP configuration:

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

For stdio transport, add the `--stdio` flag to the `args` array.

## Available Tools

### Core Monitoring Tools

#### `start_monitoring`

Initialize metacognitive monitoring of an agent's cognitive process.

**Input Schema**:

```typescript
{
  goal: string; // Current goal being pursued
  initial_beliefs?: string[]; // Initial beliefs about the task
}
```

#### `process_trace_update`

Main monitoring function—processes cognitive trace updates from the agent.

**Input Schema**:

```typescript
{
  last_action: string; // Latest action name
  current_context?: string; // Current environment context
  goal: string; // Current goal being pursued
  window_size?: number; // Monitoring window size (default: 10)
}
```

#### `stop_monitoring`

Stop metacognitive monitoring and get a session summary.

**Input Schema**: `{}`

### Loop Detection Tools

#### `detect_loop`

Detect if the agent is stuck in a loop using various strategies.

**Input Schema**:

```typescript
{
  current_context?: string; // Current environment context
  goal: string; // Current goal being pursued
  detection_method?: "statistical" | "pattern" | "hybrid"; // Detection method (default: "hybrid")
}
```

#### `configure_detection`

Configure loop detection parameters and domain-specific progress indicators.

**Input Schema**:

```typescript
{
  progress_indicators?: string[];
  min_actions_for_detection?: number;
  alternating_threshold?: number;
  repetition_threshold?: number;
  progress_threshold_adjustment?: number;
  semantic_intents?: string[];
}
```

### Enhanced Experience Management

#### `store_experience`

Store a case for future case-based reasoning with enhanced metadata and quality scoring.

**Input Schema**:

```typescript
{
  problem_description: string;
  solution: string;
  outcome: boolean;
  context?: string;
  difficulty_level?: "low" | "medium" | "high";
}
```

#### `retrieve_similar_cases`

Retrieve similar cases using advanced semantic matching and filtering.

**Input Schema**:

```typescript
{
  problem_description: string;
  max_results?: number;
  context_filter?: string;
  difficulty_filter?: "low" | "medium" | "high";
  outcome_filter?: boolean;
  min_similarity?: number;
}
```

### System Tools

#### `get_monitoring_status`

Get the current monitoring status and statistics.

**Input Schema**: `{}`

#### `reset_engine`

Reset the dual-cycle engine state.

**Input Schema**: `{}`

## Example Usage Scenario

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

// ... agent continues actions ...

// Agent gets stuck clicking submit repeatedly
await process_trace_update({
  last_action: 'click_submit_button',
  current_context: 'registration_form',
  goal: 'Complete user registration process on website',
});
// Returns: {
//   "intervention_required": true,
//   "loop_detected": {
//     "detected": true,
//     "type": "action_repetition",
//     "confidence": 0.85,
//     "details": "Loop detected via parameter_repetition: 57% anomaly score...",
//     "actions_involved": ["click_submit_button"]
//   }
// }
```

### 3. Storing and Retrieving Experiences

```typescript
// Store a successful experience
await store_experience({
  problem_description: 'Email validation error blocking form submission',
  solution: 'Check email format and retry with valid email address',
  outcome: true,
  context: 'registration_form',
  difficulty_level: 'medium',
});

// When a loop is detected, retrieve similar cases for recovery
const similarCases = await retrieve_similar_cases({
  problem_description: 'Form submission button not responding to clicks',
  max_results: 3,
  context_filter: 'registration_form',
  outcome_filter: true,
});
```

## Understanding Loop Detection

When the `process_trace_update` tool detects a potential loop, it returns a detailed `loop_detected` object. Understanding the components of this object can help you diagnose and debug agent behavior.

Here's a quick guide to the key metrics:

- **`anomaly score`**: An overall score (0-100%) representing the confidence that the agent's recent actions are part of a loop. It's a weighted average of multiple detection methods.
- **`confidence`**: The final confidence score (0.0-1.0) that a loop has been detected. It is derived from the `anomaly score`.
- **`Semantic`**: The percentage of recent actions that are semantically similar to each other (e.g., `click_button_A` and `click_button_B`).
- **`Parameter`**: The percentage of similarity between the parameters of semantically similar actions.
- **`Exact`**: The percentage of recent actions that are exact, character-for-character duplicates.
- **`Cyclical`**: The score (0-100%) indicating the presence of repeating sequences of actions (e.g., A, B, C, A, B, C).

The `details` string also contains two important metrics:

- **`(X/Y actions involved)`**: Shows how many of the last Y actions were identified as being part of the detected loop.
- **`(X/Y methods agreed)`**: Indicates how many of the three primary detection strategies (`Action Anomalies`, `State Invariance`, `Progress Stagnation`) agreed that a loop was present.

## Contributing

Contributions are welcome! Please read the contributing guidelines and ensure all tests pass before submitting a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

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

// ... agent continues actions ...

// Agent gets stuck clicking submit repeatedly
await process_trace_update({
  last_action: 'click_submit_button',
  current_context: 'registration_form',
  goal: 'Complete user registration process on website',
});
// Returns: {
//   "intervention_required": true,
//   "loop_detected": {
//     "detected": true,
//     "type": "action_repetition",
//     "confidence": 0.85,
//     "details": "Loop detected via parameter_repetition: 57% anomaly score...",
//     "actions_involved": ["click_submit_button"]
//   }
// }
```

### 3. Storing and Retrieving Experiences

```typescript
// Store a successful experience
await store_experience({
  problem_description: 'Email validation error blocking form submission',
  solution: 'Check email format and retry with valid email address',
  outcome: true,
  context: 'registration_form',
  difficulty_level: 'medium',
});

// When a loop is detected, retrieve similar cases for recovery
const similarCases = await retrieve_similar_cases({
  problem_description: 'Form submission button not responding to clicks',
  max_results: 3,
  context_filter: 'registration_form',
  outcome_filter: true,
});
```

## Contributing

Contributions are welcome! Please read the contributing guidelines and ensure all tests pass before submitting a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

