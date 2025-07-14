# MCP Dual-Cycle Reasoner

A Model Context Protocol (MCP) server implementing the **Dual-Cycle Metacognitive Reasoning Framework** for autonomous agents. This server provides tools for agents to monitor their own cognition, detect when they're stuck in loops, diagnose failures, and generate recovery plans.

**Latest Updates:**

- ✨ **Configurable Detection Parameters** - Customize loop detection thresholds and progress indicators
- 🎯 **Simplified Schema Structure** - Streamlined APIs optimized for LLM usage
- 📊 **Domain-Specific Customization** - Configure progress indicators for different task domains
- 🔧 **Enhanced Loop Detection** - Improved accuracy with configurable sensitivity settings

## 🧠 Architecture Overview

Based on the framework described in `DUAL-CYCLE.MD`, this implementation features:

### Dual-Cycle Architecture

- **Cognitive Cycle (The "Doer")**: Direct interaction with the environment
- **Metacognitive Cycle (The "Thinker")**: Monitors and controls the cognitive cycle

### Core Components

#### 🔍 Sentinel (Monitoring)

Implements three loop detection strategies:

1. **Action Trace Analysis**: Statistical anomaly detection in action sequences
2. **State Invariance Tracking**: Detects when agents return to previously visited states
3. **Progress Heuristic Evaluation**: Monitors quantitative progress metrics for stagnation

#### ⚖️ Adjudicator (Control)

Implements failure diagnosis and recovery:

1. **Belief Revision**: AGM-based logical consistency maintenance
2. **Abductive Reasoning**: Failure diagnosis through hypothesis generation
3. **Case-Based Reasoning**: Recovery plan generation from past experiences

## 🚀 Quick Start

### Installation

```bash
cd mcp-dual-cycle-reasoner
npm install
npm run build
```

### Running the Server

```bash
npm start
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

## 🛠️ Available Tools

### Core Monitoring Tools

#### `start_monitoring`

Start metacognitive monitoring of an agent's cognitive process.

```json
{
  "goal": "Complete the checkout process",
  "initial_beliefs": ["The checkout button is clickable", "User is on the correct page"]
}
```

#### `process_trace_update`

Main monitoring function - process a cognitive trace update from the agent.

```json
{
  "trace": {
    "recent_actions": ["scroll_down", "click_element", "wait"],
    "current_context": "checkout page",
    "goal": "Complete checkout",
    "step_count": 5
  },
  "window_size": 10
}
```

#### `stop_monitoring`

Stop monitoring and get session summary.

### Loop Detection Tools

#### `detect_loop`

Detect if the agent is stuck in a loop using various strategies.

```json
{
  "trace": {
    "recent_actions": ["click_element", "click_element", "scroll_down", "click_element"],
    "current_context": "checkout page",
    "goal": "Complete checkout",
    "step_count": 8
  },
  "detection_method": "statistical"
}
```

#### `configure_detection`

Configure loop detection parameters and domain-specific progress indicators.

```json
{
  "progress_indicators": ["success", "complete", "found", "loaded"],
  "min_actions_for_detection": 5,
  "alternating_threshold": 0.5,
  "repetition_threshold": 0.4,
  "progress_threshold_adjustment": 0.2
}
```

### Failure Analysis Tools

#### `diagnose_failure`

Diagnose the cause of a detected loop using abductive reasoning.

```json
{
  "loop_result": {
    "detected": true,
    "type": "action_repetition",
    "confidence": 0.85,
    "details": "High repetition pattern detected",
    "actions_involved": ["click_element", "scroll_down"]
  },
  "trace": {
    "recent_actions": ["click_element", "click_element", "scroll_down"],
    "current_context": "checkout page",
    "goal": "Complete checkout"
  }
}
```

#### `revise_beliefs`

Revise agent beliefs using AGM belief revision principles.

```json
{
  "current_beliefs": ["The checkout button is clickable", "The page has loaded correctly"],
  "contradicting_evidence": "Button click action failed repeatedly",
  "trace": {
    "recent_actions": ["click_element", "click_element"],
    "goal": "Complete checkout"
  }
}
```

### Configuration Tools

#### `configure_detection`

Configure loop detection parameters and domain-specific progress indicators.

```json
{
  "progress_indicators": ["success", "complete", "found", "loaded"],
  "min_actions_for_detection": 5,
  "alternating_threshold": 0.5,
  "repetition_threshold": 0.4,
  "progress_threshold_adjustment": 0.2
}
```

### Recovery Tools

#### `generate_recovery_plan`

Generate a recovery plan using case-based reasoning.

```json
{
  "diagnosis": {
    "primary_hypothesis": "element_state_error",
    "confidence": 0.8,
    "evidence": ["Element not clickable errors detected"],
    "suggested_actions": ["Check element visibility"]
  },
  "trace": {
    "recent_actions": ["click_element", "click_element"],
    "current_context": "checkout page",
    "goal": "Complete checkout"
  },
  "available_patterns": ["strategic_retreat", "context_refresh"]
}
```

### Experience Management

#### `store_experience`

Store a case for future case-based reasoning.

```json
{
  "case": {
    "problem_description": "Button click repeatedly failed on checkout page",
    "solution": "Switched to visual mode and used coordinate clicking",
    "outcome": true
  }
}
```

#### `retrieve_similar_cases`

Retrieve similar cases from the case base.

```json
{
  "problem_description": "Button interaction failing repeatedly",
  "max_results": 5
}
```

### Utility Tools

#### `get_monitoring_status`

Get current monitoring status and statistics.

#### `update_recovery_outcome`

Update the outcome of a recovery plan for learning.

```json
{
  "successful": true,
  "explanation": "Recovery plan worked - agent resumed progress"
}
```

#### `reset_engine`

Reset the dual-cycle engine state.

## 🎯 Schema Simplifications

The latest version features simplified schemas optimized for LLM usage:

### Cognitive Trace Structure

```typescript
{
  recent_actions: string[];     // Simple action names instead of complex objects
  current_context?: string;     // Optional context description
  goal: string;                // Current goal
  step_count: number;          // Number of steps taken (default: 1)
}
```

### Key Simplifications

- **Actions as strings**: `["scroll_down", "click_element"]` instead of complex action objects
- **Beliefs as strings**: Simple belief statements instead of structured objects with confidence scores
- **Default values**: Most parameters have sensible defaults to reduce required input
- **Optional fields**: Many fields are now optional to ease integration

## 📊 Loop Detection Strategies

### 1. Action Trace Analysis (Default)

- Detects repetitive action patterns using statistical methods
- Configurable repetition threshold (default: 0.4)
- Identifies oscillating behaviors (A-B-A-B patterns)
- Configurable alternating threshold (default: 0.5)

### 2. State Invariance Tracking

- Monitors environment state changes
- Uses hashing for state fingerprinting
- Detects when agents revisit identical states

### 3. Progress Heuristic Evaluation

- Tracks quantitative progress metrics:
  - **Information Gain**: Discovery of new elements/information
  - **Goal Proximity**: Distance to target goal
  - **Task Completion**: Percentage of subtasks completed
- Detects stagnation and regression patterns

### Configuration Options

#### Progress Indicators

Define action patterns that indicate positive progress to reduce false positives:

```json
{
  "progress_indicators": ["success", "complete", "found", "loaded", "next_page"]
}
```

#### Detection Thresholds

- **min_actions_for_detection**: Minimum actions before loop detection starts (default: 5)
- **repetition_threshold**: Sensitivity for repetitive patterns (0.0-1.0, default: 0.4)
- **alternating_threshold**: Sensitivity for A-B-A-B patterns (0.0-1.0, default: 0.5)
- **progress_threshold_adjustment**: How much to increase thresholds when progress is detected (default: 0.2)

## 🔧 Recovery Patterns

The system implements five recovery patterns:

1. **Strategic Retreat**: Backtrack to known good state
2. **Context Refresh**: Clear state
3. **Modality Switching**: Switch from DOM to visual interaction
4. **Information Foraging**: Explore page structure systematically
5. **Human Escalation**: Request human intervention

## 🧪 Example Usage

```typescript
// Configure detection for e-commerce domain
await callTool('configure_detection', {
  progress_indicators: ['success', 'complete', 'added', 'loaded', 'redirect'],
  min_actions_for_detection: 5,
  repetition_threshold: 0.3, // More sensitive for shopping flows
  alternating_threshold: 0.4,
});

// Start monitoring an agent working on a checkout task
await callTool('start_monitoring', {
  goal: 'Complete purchase checkout',
  initial_beliefs: ['Checkout button exists on this page', 'Shopping cart has items'],
});

// Process trace updates as the agent works
const result = await callTool('process_trace_update', {
  trace: {
    recent_actions: ['scroll_down', 'click_element', 'click_element', 'scroll_up'],
    current_context: 'checkout page',
    goal: 'Complete purchase checkout',
    step_count: 12,
  },
  window_size: 10,
});

// The system will automatically detect loops, diagnose issues, and suggest recovery plans
if (result.intervention_required) {
  console.log('Loop detected:', result.loop_detected);
  console.log('Diagnosis:', result.diagnosis);
  console.log('Recovery plan:', result.recovery_plan);
  console.log('Revised beliefs:', result.revised_beliefs);
}
```

## ⚙️ Domain-Specific Configuration Examples

### E-commerce/Shopping Tasks

```typescript
await callTool('configure_detection', {
  progress_indicators: ['added_to_cart', 'checkout_success', 'payment_complete', 'order_confirmed'],
  repetition_threshold: 0.3, // More sensitive due to critical user flows
  min_actions_for_detection: 4,
});
```

### Web Scraping/Data Collection

```typescript
await callTool('configure_detection', {
  progress_indicators: ['data_extracted', 'next_page', 'download_complete', 'parsed'],
  repetition_threshold: 0.5, // Less sensitive, exploration is normal
  alternating_threshold: 0.6,
  min_actions_for_detection: 8,
});
```

### Form Filling/Authentication

```typescript
await callTool('configure_detection', {
  progress_indicators: ['login_success', 'form_submitted', 'validation_passed', 'redirect'],
  repetition_threshold: 0.2, // Very sensitive to failed attempts
  min_actions_for_detection: 3,
});
```

## 📚 Theoretical Foundation

This implementation is based on established cognitive science and AI research:

- **Metacognition**: "Thinking about thinking" - monitoring and controlling cognitive processes
- **Einstellung Effect**: Cognitive bias where familiar solutions prevent seeing better alternatives
- **Functional Fixedness**: Mental block against using tools in novel ways
- **Means-Ends Analysis**: Problem-solving by reducing differences between current and goal states
- **AGM Belief Revision**: Formal framework for rationally updating beliefs
- **Case-Based Reasoning**: Problem-solving by adapting solutions from similar past problems

## 🔬 Research Applications

This framework enables research in:

- **Autonomous agent robustness**: Preventing and recovering from failure states
- **Metacognitive AI systems**: Self-monitoring and self-regulation in AI agents
- **Self-improving agents**: Learning from failures through case-based reasoning
- **Explainable AI**: Transparent failure diagnosis and recovery planning
- **Human-AI collaboration**: Escalation patterns and intervention strategies
- **Domain adaptation**: Customizable detection for different task environments

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please read the contributing guidelines and ensure all tests pass.

## 📞 Support

For issues and questions, please use the GitHub issue tracker.
