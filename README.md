# Harbinger

**Harbinger** is an advanced agentic AI framework designed to execute complex, multi-step tasks by orchestrating specialized microservices. It features a central planner that coordinates agents for file system operations, web browsing, email management, and data processing, all accessible through a unified API and seamless integration with Claude Desktop via the Model Context Protocol (MCP).

## 🚀 Features

*   **Multi-Agent Architecture**: A suite of specialized gRPC microservices, including:
    *   **OS Agent**: Control local files, folders, and applications.
    *   **Browser Agent**: Automate web browsing and research.
    *   **Gmail Agent**: Read and send emails.
    *   **Calendar Agent**: Manage schedule and events.
    *   **Excel Agent**: Read and write spreadsheet data.
    *   **Memory Agent**: Long-term memory storage and retrieval.
    *   **Planner & Orchestrator**: Break down complex goals into executable plans.
*   **MCP Bridge**: Native support for the **Model Context Protocol (MCP)**, allowing LLMs (like Claude Desktop) to directly discover and control local tools without custom integration code.
*   **Unified API Gateway**: A single entry point for external applications to interact with the agent mesh.
*   **Desktop Integration**: Includes an Electron-based desktop app and Chrome Extension for deep system and browser integration.

> [!NOTE]
> The browser extension and fully functional desktop app are currently under development.

##  Architecture

Harbinger follows a microservices pattern:

1.  **Agents**: Standalone Node.js/Python services communicating via gRPC.
2.  **API Gateway**: Exposes agent capabilities via REST/HTTP.
3.  **MCP Server**: Acts as a bridge, translating MCP requests from Claude into gRPC calls to the agents.
4.  **Orchestrator**: Manages task dependencies and execution flow.

## 🛠️ Getting Started

### Prerequisites

*   **Node.js** (v18+ recommended)
*   **npm** or **yarn**
*   **Python** (for specific agents if applicable)
*   **Git**

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/harbinger.git
    cd harbinger
    ```

2.  **Install Dependencies**:
    Run the setup script to install dependencies for all agents and services:
    ```powershell
    .\setup-agents.bat
    ```
    *(Or manually run `npm install` in each agent directory)*

3.  **Environment Setup**:
    *   Copy `.env.example` to `.env` in the root and relevant agent folders.
    *   Configure your API keys (OpenAI, Google, etc.) in the `.env` files.

## 🚦 Usage

### 1. Starting the System
You can start all agents simultaneously using the provided batch script:

```powershell
.\start-agents.bat
```

This will launch each agent in its own process/window.

### 2. Using with Claude Desktop (MCP)
Harbinger is designed to work with Claude Desktop.

1.  **Configure Claude**:
    Add the following to your `claude_desktop_config.json` (typically in `%APPDATA%\Claude\`):

    ```json
    {
      "mcpServers": {
        "harbinger": {
          "command": "node",
          "args": ["C:/path/to/harbinger/mcp-server/index.js"]
        }
      }
    }
    ```
    *Note: Update the path to match your local installation.*

2.  **Restart Claude Desktop**.

3.  **Interact**:
    You can now ask Claude to perform tasks like:
    *   "Check my unread emails"
    *   "Open the 'Project Alpha' folder on my desktop"
    *   "Create a calendar event for meeting tomorrow at 2 PM"
    *   "Read the data from `sales.xlsx`"

### 3. Stopping Agents
To stop all running agents:

```powershell
.\stop-agents.bat
```

## 📂 Project Structure

*   `/agents`: Source code for individual agents (gmail, os, browser, etc.).
*   `/mcp-server`: The bridge implementation for Model Context Protocol.
*   `/api-gateway`: REST API gateway for the system.
*   `/libs`: Shared libraries and Protocol Buffer definitions (`task.proto`).
*   `/desktop-app`: Electron application code.
*   `/chrome-extension`: Browser extension for web automation.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

[MIT](LICENSE)
