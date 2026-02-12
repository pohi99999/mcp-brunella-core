---

title: AI tooling · Cloudflare Style Guide

description: Use the following AI tools to get the most out of Cloudflare (and our docs).

lastUpdated: 2026-02-10T18:49:17.000Z

chatbotDeprioritize: true

source\_url:

&nbsp; html: https://developers.cloudflare.com/style-guide/ai-tooling/

&nbsp; md: https://developers.cloudflare.com/style-guide/ai-tooling/index.md

---



Use the following AI tools to get the most out of Cloudflare (and our docs).



\## llms.txt



We have implemented `llms.txt`, `llms-full.txt` and also created per-page Markdown links as follows:



\* \[`llms.txt`](https://developers.cloudflare.com/llms.txt)

\* \[`llms-full.txt`](https://developers.cloudflare.com/llms-full.txt)

&nbsp; \* We also provide a `llms-full.txt` file on a per-product basis, i.e \[`/workers/llms-full.txt`](https://developers.cloudflare.com/workers/llms-full.txt)

\* \[`/$page/index.md`](index.md)

&nbsp; \* Add `/index.md` to the end of any page to get the Markdown version, i.e \[`/style-guide/index.md`](https://developers.cloudflare.com/style-guide/index.md)



In the top right of this page, you will see a `Page options` button where you can copy the current page as Markdown that can be given to your LLM of choice.



!\[Page options

button](https://developers.cloudflare.com/\_astro/page-options.T2MlgPLy\_1KQRmL.webp)



\## MCP



Cloudflare runs a catalog of managed remote MCP Servers which you can connect to using OAuth on clients like \[Claude](https://modelcontextprotocol.io/quickstart/user), \[Windsurf](https://docs.windsurf.com/windsurf/cascade/mcp), our own \[AI Playground](https://playground.ai.cloudflare.com/) or any \[SDK that supports MCP](https://github.com/cloudflare/agents/tree/main/packages/agents/src/mcp).



\* Cursor



&nbsp; To install in Cursor, use this \[Direct install link](https://cursor.com/en-US/install-mcp?name=cloudflare\\\&config=eyJjb21tYW5kIjoibnB4IG1jcC1yZW1vdGUgaHR0cHM6Ly9kb2NzLm1jcC5jbG91ZGZsYXJlLmNvbS9zc2UifQ%3D%3D).



\* VSCode



&nbsp; To install in VSCode, use this \[Direct install link](vscode:mcp/install?%7B%22name%22%3A%22cloudflare%22%2C%22url%22%3A%22https%3A%2F%2Fdocs.mcp.cloudflare.com%2Fmcp%22%7D).



\* Manually



&nbsp; To install manually, add the following specification to your MCP config:



&nbsp; ```json

&nbsp;   {

&nbsp;     "mcpServers": {

&nbsp;         "cloudflare": {

&nbsp;         "command": "npx",

&nbsp;         "args": \["mcp-remote", "https://docs.mcp.cloudflare.com/mcp"]

&nbsp;       }

&nbsp;     }

&nbsp;   }

&nbsp; ```



Note



For other MCP servers offered by Cloudflare, refer to \[Cloudflare's MCP servers](https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/).



\## Skills



Our docs site also supports \[agent skills](https://agentskills.io/home) that are defined in the \[Cloudflare Skills repo](https://github.com/cloudflare/skills).



To install them:



```sh

$ npx skills add https://developers.cloudflare.com

```



\## AI resources for documentation contributors



The `cloudflare-docs` repository includes an \[`AGENTS.md`](https://github.com/cloudflare/cloudflare-docs/blob/production/AGENTS.md) file that helps AI agents understand the structure, tooling, and conventions of the repository so they can make correct, buildable changes.



AGENTS.md is a simple, open format for guiding coding agents — refer to the \[AGENTS.md](https://agents.md/) website for more information.



The documentation repository also includes specific configuration for the following AI tools:



\* \[OpenCode](https://opencode.ai/)

\* \[Windsurf](https://windsurf.com/)



We provide scripts to set up other AI tools (currently Claude Code, Cursor, and GitHub Copilot) via \[`rulesync`](https://github.com/dyoshikawa/rulesync), a tool for synchronizing AI tool configurations.



If you are a documentation contributor and you would like to use Claude Code, Cursor, or GitHub Copilot, use one of the following scripts:



```bash

\# Configure Claude Code

npm run ai-setup:claudecode





\# Configure Cursor

npm run ai-setup:cursor





\# Configure GitHub Copilot

npm run ai-setup:copilot

```



Each script will import AI tool components (commands and subagents) from the OpenCode configuration committed to the repository and generate back specific configuration files in the expected locations for your selected AI tool.



