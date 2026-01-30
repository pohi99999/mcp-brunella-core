\# Gemini CLI Core: Tools API



The Gemini CLI core (`packages/core`) features a robust system for defining,

registering, and executing tools. These tools extend the capabilities of the

Gemini model, allowing it to interact with the local environment, fetch web

content, and perform various actions beyond simple text generation.



\## Core Concepts



\- \*\*Tool (`tools.ts`):\*\* An interface and base class (`BaseTool`) that defines

&nbsp; the contract for all tools. Each tool must have:

&nbsp; - `name`: A unique internal name (used in API calls to Gemini).

&nbsp; - `displayName`: A user-friendly name.

&nbsp; - `description`: A clear explanation of what the tool does, which is provided

&nbsp;   to the Gemini model.

&nbsp; - `parameterSchema`: A JSON schema defining the parameters that the tool

&nbsp;   accepts. This is crucial for the Gemini model to understand how to call the

&nbsp;   tool correctly.

&nbsp; - `validateToolParams()`: A method to validate incoming parameters.

&nbsp; - `getDescription()`: A method to provide a human-readable description of what

&nbsp;   the tool will do with specific parameters before execution.

&nbsp; - `shouldConfirmExecute()`: A method to determine if user confirmation is

&nbsp;   required before execution (e.g., for potentially destructive operations).

&nbsp; - `execute()`: The core method that performs the tool's action and returns a

&nbsp;   `ToolResult`.



\- \*\*`ToolResult` (`tools.ts`):\*\* An interface defining the structure of a tool's

&nbsp; execution outcome:

&nbsp; - `llmContent`: The factual content to be included in the history sent back to

&nbsp;   the LLM for context. This can be a simple string or a `PartListUnion` (an

&nbsp;   array of `Part` objects and strings) for rich content.

&nbsp; - `returnDisplay`: A user-friendly string (often Markdown) or a special object

&nbsp;   (like `FileDiff`) for display in the CLI.



\- \*\*Returning Rich Content:\*\* Tools are not limited to returning simple text.

&nbsp; The `llmContent` can be a `PartListUnion`, which is an array that can contain

&nbsp; a mix of `Part` objects (for images, audio, etc.) and `string`s. This allows a

&nbsp; single tool execution to return multiple pieces of rich content.



\- \*\*Tool Registry (`tool-registry.ts`):\*\* A class (`ToolRegistry`) responsible

&nbsp; for:

&nbsp; - \*\*Registering Tools:\*\* Holding a collection of all available built-in tools

&nbsp;   (e.g., `ReadFileTool`, `ShellTool`).

&nbsp; - \*\*Discovering Tools:\*\* It can also discover tools dynamically:

&nbsp;   - \*\*Command-based Discovery:\*\* If `tools.discoveryCommand` is configured in

&nbsp;     settings, this command is executed. It's expected to output JSON

&nbsp;     describing custom tools, which are then registered as `DiscoveredTool`

&nbsp;     instances.

&nbsp;   - \*\*MCP-based Discovery:\*\* If `mcp.serverCommand` is configured, the

&nbsp;     registry can connect to a Model Context Protocol (MCP) server to list and

&nbsp;     register tools (`DiscoveredMCPTool`).

&nbsp; - \*\*Providing Schemas:\*\* Exposing the `FunctionDeclaration` schemas of all

&nbsp;   registered tools to the Gemini model, so it knows what tools are available

&nbsp;   and how to use them.

&nbsp; - \*\*Retrieving Tools:\*\* Allowing the core to get a specific tool by name for

&nbsp;   execution.



\## Built-in Tools



The core comes with a suite of pre-defined tools, typically found in

`packages/core/src/tools/`. These include:



\- \*\*File System Tools:\*\*

&nbsp; - `LSTool` (`ls.ts`): Lists directory contents.

&nbsp; - `ReadFileTool` (`read-file.ts`): Reads the content of a single file. It

&nbsp;   takes an `absolute\_path` parameter, which must be an absolute path.

&nbsp; - `WriteFileTool` (`write-file.ts`): Writes content to a file.

&nbsp; - `GrepTool` (`grep.ts`): Searches for patterns in files.

&nbsp; - `GlobTool` (`glob.ts`): Finds files matching glob patterns.

&nbsp; - `EditTool` (`edit.ts`): Performs in-place modifications to files (often

&nbsp;   requiring confirmation).

&nbsp; - `ReadManyFilesTool` (`read-many-files.ts`): Reads and concatenates content

&nbsp;   from multiple files or glob patterns (used by the `@` command in CLI).

\- \*\*Execution Tools:\*\*

&nbsp; - `ShellTool` (`shell.ts`): Executes arbitrary shell commands (requires

&nbsp;   careful sandboxing and user confirmation).

\- \*\*Web Tools:\*\*

&nbsp; - `WebFetchTool` (`web-fetch.ts`): Fetches content from a URL.

&nbsp; - `WebSearchTool` (`web-search.ts`): Performs a web search.

\- \*\*Memory Tools:\*\*

&nbsp; - `MemoryTool` (`memoryTool.ts`): Interacts with the AI's memory.



Each of these tools extends `BaseTool` and implements the required methods for

its specific functionality.



\## Tool Execution Flow



1\.  \*\*Model Request:\*\* The Gemini model, based on the user's prompt and the

&nbsp;   provided tool schemas, decides to use a tool and returns a `FunctionCall`

&nbsp;   part in its response, specifying the tool name and arguments.

2\.  \*\*Core Receives Request:\*\* The core parses this `FunctionCall`.

3\.  \*\*Tool Retrieval:\*\* It looks up the requested tool in the `ToolRegistry`.

4\.  \*\*Parameter Validation:\*\* The tool's `validateToolParams()` method is

&nbsp;   called.

5\.  \*\*Confirmation (if needed):\*\*

&nbsp;   - The tool's `shouldConfirmExecute()` method is called.

&nbsp;   - If it returns details for confirmation, the core communicates this back to

&nbsp;     the CLI, which prompts the user.

&nbsp;   - The user's decision (e.g., proceed, cancel) is sent back to the core.

6\.  \*\*Execution:\*\* If validated and confirmed (or if no confirmation is needed),

&nbsp;   the core calls the tool's `execute()` method with the provided arguments and

&nbsp;   an `AbortSignal` (for potential cancellation).

7\.  \*\*Result Processing:\*\* The `ToolResult` from `execute()` is received by the

&nbsp;   core.

8\.  \*\*Response to Model:\*\* The `llmContent` from the `ToolResult` is packaged as

&nbsp;   a `FunctionResponse` and sent back to the Gemini model so it can continue

&nbsp;   generating a user-facing response.

9\.  \*\*Display to User:\*\* The `returnDisplay` from the `ToolResult` is sent to

&nbsp;   the CLI to show the user what the tool did.



\## Extending with Custom Tools



While direct programmatic registration of new tools by users isn't explicitly

detailed as a primary workflow in the provided files for typical end-users, the

architecture supports extension through:



\- \*\*Command-based Discovery:\*\* Advanced users or project administrators can

&nbsp; define a `tools.discoveryCommand` in `settings.json`. This command, when run

&nbsp; by the Gemini CLI core, should output a JSON array of `FunctionDeclaration`

&nbsp; objects. The core will then make these available as `DiscoveredTool`

&nbsp; instances. The corresponding `tools.callCommand` would then be responsible for

&nbsp; actually executing these custom tools.

\- \*\*MCP Server(s):\*\* For more complex scenarios, one or more MCP servers can be

&nbsp; set up and configured via the `mcpServers` setting in `settings.json`. The

&nbsp; Gemini CLI core can then discover and use tools exposed by these servers. As

&nbsp; mentioned, if you have multiple MCP servers, the tool names will be prefixed

&nbsp; with the server name from your configuration (e.g.,

&nbsp; `serverAlias\_\_actualToolName`).



This tool system provides a flexible and powerful way to augment the Gemini

model's capabilities, making the Gemini CLI a versatile assistant for a wide

range of tasks.



---------



\# Memory Import Processor



The Memory Import Processor is a feature that allows you to modularize your

GEMINI.md files by importing content from other files using the `@file.md`

syntax.



\## Overview



This feature enables you to break down large GEMINI.md files into smaller, more

manageable components that can be reused across different contexts. The import

processor supports both relative and absolute paths, with built-in safety

features to prevent circular imports and ensure file access security.



\## Syntax



Use the `@` symbol followed by the path to the file you want to import:



```markdown

\# Main GEMINI.md file



This is the main content.



@./components/instructions.md



More content here.



@./shared/configuration.md

```



\## Supported Path Formats



\### Relative Paths



\- `@./file.md` - Import from the same directory

\- `@../file.md` - Import from parent directory

\- `@./components/file.md` - Import from subdirectory



\### Absolute Paths



\- `@/absolute/path/to/file.md` - Import using absolute path



\## Examples



\### Basic Import



```markdown

\# My GEMINI.md



Welcome to my project!



@./get-started.md



\## Features



@./features/overview.md

```



\### Nested Imports



The imported files can themselves contain imports, creating a nested structure:



```markdown

\# main.md



@./header.md @./content.md @./footer.md

```



```markdown

\# header.md



\# Project Header



@./shared/title.md

```



\## Safety Features



\### Circular Import Detection



The processor automatically detects and prevents circular imports:



```markdown

\# file-a.md



@./file-b.md



\# file-b.md



@./file-a.md <!-- This will be detected and prevented -->

```



\### File Access Security



The `validateImportPath` function ensures that imports are only allowed from

specified directories, preventing access to sensitive files outside the allowed

scope.



\### Maximum Import Depth



To prevent infinite recursion, there's a configurable maximum import depth

(default: 5 levels).



\## Error Handling



\### Missing Files



If a referenced file doesn't exist, the import will fail gracefully with an

error comment in the output.



\### File Access Errors



Permission issues or other file system errors are handled gracefully with

appropriate error messages.



\## Code Region Detection



The import processor uses the `marked` library to detect code blocks and inline

code spans, ensuring that `@` imports inside these regions are properly ignored.

This provides robust handling of nested code blocks and complex Markdown

structures.



\## Import Tree Structure



The processor returns an import tree that shows the hierarchy of imported files,

similar to Claude's `/memory` feature. This helps users debug problems with

their GEMINI.md files by showing which files were read and their import

relationships.



Example tree structure:



```

Memory Files

&nbsp;L project: GEMINI.md

&nbsp;           L a.md

&nbsp;             L b.md

&nbsp;               L c.md

&nbsp;             L d.md

&nbsp;               L e.md

&nbsp;                 L f.md

&nbsp;           L included.md

```



The tree preserves the order that files were imported and shows the complete

import chain for debugging purposes.



\## Comparison to Claude Code's `/memory` (`claude.md`) Approach



Claude Code's `/memory` feature (as seen in `claude.md`) produces a flat, linear

document by concatenating all included files, always marking file boundaries

with clear comments and path names. It does not explicitly present the import

hierarchy, but the LLM receives all file contents and paths, which is sufficient

for reconstructing the hierarchy if needed.



> \[!NOTE] The import tree is mainly for clarity during development and has

> limited relevance to LLM consumption.



\## API Reference



\### `processImports(content, basePath, debugMode?, importState?)`



Processes import statements in GEMINI.md content.



\*\*Parameters:\*\*



\- `content` (string): The content to process for imports

\- `basePath` (string): The directory path where the current file is located

\- `debugMode` (boolean, optional): Whether to enable debug logging (default:

&nbsp; false)

\- `importState` (ImportState, optional): State tracking for circular import

&nbsp; prevention



\*\*Returns:\*\* Promise\&lt;ProcessImportsResult\&gt; - Object containing processed

content and import tree



\### `ProcessImportsResult`



```typescript

interface ProcessImportsResult {

&nbsp; content: string; // The processed content with imports resolved

&nbsp; importTree: MemoryFile; // Tree structure showing the import hierarchy

}

```



\### `MemoryFile`



```typescript

interface MemoryFile {

&nbsp; path: string; // The file path

&nbsp; imports?: MemoryFile\[]; // Direct imports, in the order they were imported

}

```



\### `validateImportPath(importPath, basePath, allowedDirectories)`



Validates import paths to ensure they are safe and within allowed directories.



\*\*Parameters:\*\*



\- `importPath` (string): The import path to validate

\- `basePath` (string): The base directory for resolving relative paths

\- `allowedDirectories` (string\[]): Array of allowed directory paths



\*\*Returns:\*\* boolean - Whether the import path is valid



\### `findProjectRoot(startDir)`



Finds the project root by searching for a `.git` directory upwards from the

given start directory. Implemented as an \*\*async\*\* function using non-blocking

file system APIs to avoid blocking the Node.js event loop.



\*\*Parameters:\*\*



\- `startDir` (string): The directory to start searching from



\*\*Returns:\*\* Promise\&lt;string\&gt; - The project root directory (or the start

directory if no `.git` is found)



\## Best Practices



1\. \*\*Use descriptive file names\*\* for imported components

2\. \*\*Keep imports shallow\*\* - avoid deeply nested import chains

3\. \*\*Document your structure\*\* - maintain a clear hierarchy of imported files

4\. \*\*Test your imports\*\* - ensure all referenced files exist and are accessible

5\. \*\*Use relative paths\*\* when possible for better portability



\## Troubleshooting



\### Common Issues



1\. \*\*Import not working\*\*: Check that the file exists and the path is correct

2\. \*\*Circular import warnings\*\*: Review your import structure for circular

&nbsp;  references

3\. \*\*Permission errors\*\*: Ensure the files are readable and within allowed

&nbsp;  directories

4\. \*\*Path resolution issues\*\*: Use absolute paths if relative paths aren't

&nbsp;  resolving correctly



\### Debug Mode



Enable debug mode to see detailed logging of the import process:



```typescript

const result = await processImports(content, basePath, true);

```



\# Gemini CLI tools



The Gemini CLI includes built-in tools that the Gemini model uses to interact

with your local environment, access information, and perform actions. These

tools enhance the CLI's capabilities, enabling it to go beyond text generation

and assist with a wide range of tasks.



\## Overview of Gemini CLI tools



In the context of the Gemini CLI, tools are specific functions or modules that

the Gemini model can request to be executed. For example, if you ask Gemini to

"Summarize the contents of `my\_document.txt`," the model will likely identify

the need to read that file and will request the execution of the `read\_file`

tool.



The core component (`packages/core`) manages these tools, presents their

definitions (schemas) to the Gemini model, executes them when requested, and

returns the results to the model for further processing into a user-facing

response.



These tools provide the following capabilities:



\- \*\*Access local information:\*\* Tools allow Gemini to access your local file

&nbsp; system, read file contents, list directories, etc.

\- \*\*Execute commands:\*\* With tools like `run\_shell\_command`, Gemini can run

&nbsp; shell commands (with appropriate safety measures and user confirmation).

\- \*\*Interact with the web:\*\* Tools can fetch content from URLs.

\- \*\*Take actions:\*\* Tools can modify files, write new files, or perform other

&nbsp; actions on your system (again, typically with safeguards).

\- \*\*Ground responses:\*\* By using tools to fetch real-time or specific local

&nbsp; data, Gemini's responses can be more accurate, relevant, and grounded in your

&nbsp; actual context.



\## How to use Gemini CLI tools



To use Gemini CLI tools, provide a prompt to the Gemini CLI. The process works

as follows:



1\.  You provide a prompt to the Gemini CLI.

2\.  The CLI sends the prompt to the core.

3\.  The core, along with your prompt and conversation history, sends a list of

&nbsp;   available tools and their descriptions/schemas to the Gemini API.

4\.  The Gemini model analyzes your request. If it determines that a tool is

&nbsp;   needed, its response will include a request to execute a specific tool with

&nbsp;   certain parameters.

5\.  The core receives this tool request, validates it, and (often after user

&nbsp;   confirmation for sensitive operations) executes the tool.

6\.  The output from the tool is sent back to the Gemini model.

7\.  The Gemini model uses the tool's output to formulate its final answer, which

&nbsp;   is then sent back through the core to the CLI and displayed to you.



You will typically see messages in the CLI indicating when a tool is being

called and whether it succeeded or failed.



\## Security and confirmation



Many tools, especially those that can modify your file system or execute

commands (`write\_file`, `edit`, `run\_shell\_command`), are designed with safety

in mind. The Gemini CLI will typically:



\- \*\*Require confirmation:\*\* Prompt you before executing potentially sensitive

&nbsp; operations, showing you what action is about to be taken.

\- \*\*Utilize sandboxing:\*\* All tools are subject to restrictions enforced by

&nbsp; sandboxing (see \[Sandboxing in the Gemini CLI](/docs/cli/sandbox)). This means

&nbsp; that when operating in a sandbox, any tools (including MCP servers) you wish

&nbsp; to use must be available \_inside\_ the sandbox environment. For example, to run

&nbsp; an MCP server through `npx`, the `npx` executable must be installed within the

&nbsp; sandbox's Docker image or be available in the `sandbox-exec` environment.



It's important to always review confirmation prompts carefully before allowing a

tool to proceed.



\## Learn more about Gemini CLI's tools



Gemini CLI's built-in tools can be broadly categorized as follows:



\- \*\*\[File System Tools](/docs/tools/file-system):\*\* For interacting with files and

&nbsp; directories (reading, writing, listing, searching, etc.).

\- \*\*\[Shell Tool](/docs/tools/shell) (`run\_shell\_command`):\*\* For executing shell

&nbsp; commands.

\- \*\*\[Web Fetch Tool](/docs/tools/web-fetch) (`web\_fetch`):\*\* For retrieving content

&nbsp; from URLs.

\- \*\*\[Web Search Tool](/docs/tools/web-search) (`google\_web\_search`):\*\* For searching

&nbsp; the web.

\- \*\*\[Multi-File Read Tool](/docs/tools/multi-file) (`read\_many\_files`):\*\* A specialized

&nbsp; tool for reading content from multiple files or directories.

\- \*\*\[Memory Tool](/docs/tools/memory) (`save\_memory`):\*\* For saving and recalling

&nbsp; information across sessions.

\- \*\*\[Todo Tool](/docs/tools/todos) (`write\_todos`):\*\* For managing subtasks of complex

&nbsp; requests.



Additionally, these tools incorporate:



\- \*\*\[MCP servers](/docs/tools/mcp-server)\*\*: MCP servers act as a bridge between the

&nbsp; Gemini model and your local environment or other services like APIs.

\- \*\*\[Sandboxing](/docs/cli/sandbox)\*\*: Sandboxing isolates the model and its

&nbsp; changes from your environment to reduce potential risk.



\# Gemini CLI file system tools



The Gemini CLI provides a comprehensive suite of tools for interacting with the

local file system. These tools allow the Gemini model to read from, write to,

list, search, and modify files and directories, all under your control and

typically with confirmation for sensitive operations.



\*\*Note:\*\* All file system tools operate within a `rootDirectory` (usually the

current working directory where you launched the CLI) for security. Paths that

you provide to these tools are generally expected to be absolute or are resolved

relative to this root directory.



\## 1. `list\_directory` (ReadFolder)



`list\_directory` lists the names of files and subdirectories directly within a

specified directory path. It can optionally ignore entries matching provided

glob patterns.



\- \*\*Tool name:\*\* `list\_directory`

\- \*\*Display name:\*\* ReadFolder

\- \*\*File:\*\* `ls.ts`

\- \*\*Parameters:\*\*

&nbsp; - `path` (string, required): The absolute path to the directory to list.

&nbsp; - `ignore` (array of strings, optional): A list of glob patterns to exclude

&nbsp;   from the listing (e.g., `\["\*.log", ".git"]`).

&nbsp; - `respect\_git\_ignore` (boolean, optional): Whether to respect `.gitignore`

&nbsp;   patterns when listing files. Defaults to `true`.

\- \*\*Behavior:\*\*

&nbsp; - Returns a list of file and directory names.

&nbsp; - Indicates whether each entry is a directory.

&nbsp; - Sorts entries with directories first, then alphabetically.

\- \*\*Output (`llmContent`):\*\* A string like:

&nbsp; `Directory listing for /path/to/your/folder:\\n\[DIR] subfolder1\\nfile1.txt\\nfile2.png`

\- \*\*Confirmation:\*\* No.



\## 2. `read\_file` (ReadFile)



`read\_file` reads and returns the content of a specified file. This tool handles

text, images (PNG, JPG, GIF, WEBP, SVG, BMP), and PDF files. For text files, it

can read specific line ranges. Other binary file types are generally skipped.



\- \*\*Tool name:\*\* `read\_file`

\- \*\*Display name:\*\* ReadFile

\- \*\*File:\*\* `read-file.ts`

\- \*\*Parameters:\*\*

&nbsp; - `path` (string, required): The absolute path to the file to read.

&nbsp; - `offset` (number, optional): For text files, the 0-based line number to

&nbsp;   start reading from. Requires `limit` to be set.

&nbsp; - `limit` (number, optional): For text files, the maximum number of lines to

&nbsp;   read. If omitted, reads a default maximum (e.g., 2000 lines) or the entire

&nbsp;   file if feasible.

\- \*\*Behavior:\*\*

&nbsp; - For text files: Returns the content. If `offset` and `limit` are used,

&nbsp;   returns only that slice of lines. Indicates if content was truncated due to

&nbsp;   line limits or line length limits.

&nbsp; - For image and PDF files: Returns the file content as a base64-encoded data

&nbsp;   structure suitable for model consumption.

&nbsp; - For other binary files: Attempts to identify and skip them, returning a

&nbsp;   message indicating it's a generic binary file.

\- \*\*Output:\*\* (`llmContent`):

&nbsp; - For text files: The file content, potentially prefixed with a truncation

&nbsp;   message (e.g.,

&nbsp;   `\[File content truncated: showing lines 1-100 of 500 total lines...]\\nActual file content...`).

&nbsp; - For image/PDF files: An object containing `inlineData` with `mimeType` and

&nbsp;   base64 `data` (e.g.,

&nbsp;   `{ inlineData: { mimeType: 'image/png', data: 'base64encodedstring' } }`).

&nbsp; - For other binary files: A message like

&nbsp;   `Cannot display content of binary file: /path/to/data.bin`.

\- \*\*Confirmation:\*\* No.



\## 3. `write\_file` (WriteFile)



`write\_file` writes content to a specified file. If the file exists, it will be

overwritten. If the file doesn't exist, it (and any necessary parent

directories) will be created.



\- \*\*Tool name:\*\* `write\_file`

\- \*\*Display name:\*\* WriteFile

\- \*\*File:\*\* `write-file.ts`

\- \*\*Parameters:\*\*

&nbsp; - `file\_path` (string, required): The absolute path to the file to write to.

&nbsp; - `content` (string, required): The content to write into the file.

\- \*\*Behavior:\*\*

&nbsp; - Writes the provided `content` to the `file\_path`.

&nbsp; - Creates parent directories if they don't exist.

\- \*\*Output (`llmContent`):\*\* A success message, e.g.,

&nbsp; `Successfully overwrote file: /path/to/your/file.txt` or

&nbsp; `Successfully created and wrote to new file: /path/to/new/file.txt`.

\- \*\*Confirmation:\*\* Yes. Shows a diff of changes and asks for user approval

&nbsp; before writing.



\## 4. `glob` (FindFiles)



`glob` finds files matching specific glob patterns (e.g., `src/\*\*/\*.ts`,

`\*.md`), returning absolute paths sorted by modification time (newest first).



\- \*\*Tool name:\*\* `glob`

\- \*\*Display name:\*\* FindFiles

\- \*\*File:\*\* `glob.ts`

\- \*\*Parameters:\*\*

&nbsp; - `pattern` (string, required): The glob pattern to match against (e.g.,

&nbsp;   `"\*.py"`, `"src/\*\*/\*.js"`).

&nbsp; - `path` (string, optional): The absolute path to the directory to search

&nbsp;   within. If omitted, searches the tool's root directory.

&nbsp; - `case\_sensitive` (boolean, optional): Whether the search should be

&nbsp;   case-sensitive. Defaults to `false`.

&nbsp; - `respect\_git\_ignore` (boolean, optional): Whether to respect .gitignore

&nbsp;   patterns when finding files. Defaults to `true`.

\- \*\*Behavior:\*\*

&nbsp; - Searches for files matching the glob pattern within the specified directory.

&nbsp; - Returns a list of absolute paths, sorted with the most recently modified

&nbsp;   files first.

&nbsp; - Ignores common nuisance directories like `node\_modules` and `.git` by

&nbsp;   default.

\- \*\*Output (`llmContent`):\*\* A message like:

&nbsp; `Found 5 file(s) matching "\*.ts" within src, sorted by modification time (newest first):\\nsrc/file1.ts\\nsrc/subdir/file2.ts...`

\- \*\*Confirmation:\*\* No.



\## 5. `search\_file\_content` (SearchText)



`search\_file\_content` searches for a regular expression pattern within the

content of files in a specified directory. Can filter files by a glob pattern.

Returns the lines containing matches, along with their file paths and line

numbers.



\- \*\*Tool name:\*\* `search\_file\_content`

\- \*\*Display name:\*\* SearchText

\- \*\*File:\*\* `grep.ts`

\- \*\*Parameters:\*\*

&nbsp; - `pattern` (string, required): The regular expression (regex) to search for

&nbsp;   (e.g., `"function\\s+myFunction"`).

&nbsp; - `path` (string, optional): The absolute path to the directory to search

&nbsp;   within. Defaults to the current working directory.

&nbsp; - `include` (string, optional): A glob pattern to filter which files are

&nbsp;   searched (e.g., `"\*.js"`, `"src/\*\*/\*.{ts,tsx}"`). If omitted, searches most

&nbsp;   files (respecting common ignores).

\- \*\*Behavior:\*\*

&nbsp; - Uses `git grep` if available in a Git repository for speed; otherwise, falls

&nbsp;   back to system `grep` or a JavaScript-based search.

&nbsp; - Returns a list of matching lines, each prefixed with its file path (relative

&nbsp;   to the search directory) and line number.

\- \*\*Output (`llmContent`):\*\* A formatted string of matches, e.g.:

&nbsp; ```

&nbsp; Found 3 matches for pattern "myFunction" in path "." (filter: "\*.ts"):

&nbsp; ---

&nbsp; File: src/utils.ts

&nbsp; L15: export function myFunction() {

&nbsp; L22:   myFunction.call();

&nbsp; ---

&nbsp; File: src/index.ts

&nbsp; L5: import { myFunction } from './utils';

&nbsp; ---

&nbsp; ```

\- \*\*Confirmation:\*\* No.



\## 6. `replace` (Edit)



`replace` replaces text within a file. By default, replaces a single occurrence,

but can replace multiple occurrences when `expected\_replacements` is specified.

This tool is designed for precise, targeted changes and requires significant

context around the `old\_string` to ensure it modifies the correct location.



\- \*\*Tool name:\*\* `replace`

\- \*\*Display name:\*\* Edit

\- \*\*File:\*\* `edit.ts`

\- \*\*Parameters:\*\*

&nbsp; - `file\_path` (string, required): The absolute path to the file to modify.

&nbsp; - `old\_string` (string, required): The exact literal text to replace.



&nbsp;   \*\*CRITICAL:\*\* This string must uniquely identify the single instance to

&nbsp;   change. It should include at least 3 lines of context \_before\_ and \_after\_

&nbsp;   the target text, matching whitespace and indentation precisely. If

&nbsp;   `old\_string` is empty, the tool attempts to create a new file at `file\_path`

&nbsp;   with `new\_string` as content.



&nbsp; - `new\_string` (string, required): The exact literal text to replace

&nbsp;   `old\_string` with.

&nbsp; - `expected\_replacements` (number, optional): The number of occurrences to

&nbsp;   replace. Defaults to `1`.



\- \*\*Behavior:\*\*

&nbsp; - If `old\_string` is empty and `file\_path` does not exist, creates a new file

&nbsp;   with `new\_string` as content.

&nbsp; - If `old\_string` is provided, it reads the `file\_path` and attempts to find

&nbsp;   exactly one occurrence of `old\_string`.

&nbsp; - If one occurrence is found, it replaces it with `new\_string`.

&nbsp; - \*\*Enhanced Reliability (Multi-Stage Edit Correction):\*\* To significantly

&nbsp;   improve the success rate of edits, especially when the model-provided

&nbsp;   `old\_string` might not be perfectly precise, the tool incorporates a

&nbsp;   multi-stage edit correction mechanism.

&nbsp;   - If the initial `old\_string` isn't found or matches multiple locations, the

&nbsp;     tool can leverage the Gemini model to iteratively refine `old\_string` (and

&nbsp;     potentially `new\_string`).

&nbsp;   - This self-correction process attempts to identify the unique segment the

&nbsp;     model intended to modify, making the `replace` operation more robust even

&nbsp;     with slightly imperfect initial context.

\- \*\*Failure conditions:\*\* Despite the correction mechanism, the tool will fail

&nbsp; if:

&nbsp; - `file\_path` is not absolute or is outside the root directory.

&nbsp; - `old\_string` is not empty, but the `file\_path` does not exist.

&nbsp; - `old\_string` is empty, but the `file\_path` already exists.

&nbsp; - `old\_string` is not found in the file after attempts to correct it.

&nbsp; - `old\_string` is found multiple times, and the self-correction mechanism

&nbsp;   cannot resolve it to a single, unambiguous match.

\- \*\*Output (`llmContent`):\*\*

&nbsp; - On success:

&nbsp;   `Successfully modified file: /path/to/file.txt (1 replacements).` or

&nbsp;   `Created new file: /path/to/new\_file.txt with provided content.`

&nbsp; - On failure: An error message explaining the reason (e.g.,

&nbsp;   `Failed to edit, 0 occurrences found...`,

&nbsp;   `Failed to edit, expected 1 occurrences but found 2...`).

\- \*\*Confirmation:\*\* Yes. Shows a diff of the proposed changes and asks for user

&nbsp; approval before writing to the file.



These file system tools provide a foundation for the Gemini CLI to understand

and interact with your local project context.



\# Multi File Read Tool (`read\_many\_files`)



This document describes the `read\_many\_files` tool for the Gemini CLI.



\## Description



Use `read\_many\_files` to read content from multiple files specified by paths or

glob patterns. The behavior of this tool depends on the provided files:



\- For text files, this tool concatenates their content into a single string.

\- For image (e.g., PNG, JPEG), PDF, audio (MP3, WAV), and video (MP4, MOV)

&nbsp; files, it reads and returns them as base64-encoded data, provided they are

&nbsp; explicitly requested by name or extension.



`read\_many\_files` can be used to perform tasks such as getting an overview of a

codebase, finding where specific functionality is implemented, reviewing

documentation, or gathering context from multiple configuration files.



\*\*Note:\*\* `read\_many\_files` looks for files following the provided paths or glob

patterns. A directory path such as `"/docs"` will return an empty result; the

tool requires a pattern such as `"/docs/\*"` or `"/docs/\*.md"` to identify the

relevant files.



\### Arguments



`read\_many\_files` takes the following arguments:



\- `paths` (list\[string], required): An array of glob patterns or paths relative

&nbsp; to the tool's target directory (e.g., `\["src/\*\*/\*.ts"]`,

&nbsp; `\["README.md", "docs/\*", "assets/logo.png"]`).

\- `exclude` (list\[string], optional): Glob patterns for files/directories to

&nbsp; exclude (e.g., `\["\*\*/\*.log", "temp/"]`). These are added to default excludes

&nbsp; if `useDefaultExcludes` is true.

\- `include` (list\[string], optional): Additional glob patterns to include. These

&nbsp; are merged with `paths` (e.g., `\["\*.test.ts"]` to specifically add test files

&nbsp; if they were broadly excluded, or `\["images/\*.jpg"]` to include specific image

&nbsp; types).

\- `recursive` (boolean, optional): Whether to search recursively. This is

&nbsp; primarily controlled by `\*\*` in glob patterns. Defaults to `true`.

\- `useDefaultExcludes` (boolean, optional): Whether to apply a list of default

&nbsp; exclusion patterns (e.g., `node\_modules`, `.git`, non image/pdf binary files).

&nbsp; Defaults to `true`.

\- `respect\_git\_ignore` (boolean, optional): Whether to respect .gitignore

&nbsp; patterns when finding files. Defaults to true.



\## How to use `read\_many\_files` with the Gemini CLI



`read\_many\_files` searches for files matching the provided `paths` and `include`

patterns, while respecting `exclude` patterns and default excludes (if enabled).



\- For text files: it reads the content of each matched file (attempting to skip

&nbsp; binary files not explicitly requested as image/PDF) and concatenates it into a

&nbsp; single string, with a separator `--- {filePath} ---` between the content of

&nbsp; each file. Uses UTF-8 encoding by default.

\- The tool inserts a `--- End of content ---` after the last file.

\- For image and PDF files: if explicitly requested by name or extension (e.g.,

&nbsp; `paths: \["logo.png"]` or `include: \["\*.pdf"]`), the tool reads the file and

&nbsp; returns its content as a base64 encoded string.

\- The tool attempts to detect and skip other binary files (those not matching

&nbsp; common image/PDF types or not explicitly requested) by checking for null bytes

&nbsp; in their initial content.



Usage:



```

read\_many\_files(paths=\["Your files or paths here."], include=\["Additional files to include."], exclude=\["Files to exclude."], recursive=False, useDefaultExcludes=false, respect\_git\_ignore=true)

```



\## `read\_many\_files` examples



Read all TypeScript files in the `src` directory:



```

read\_many\_files(paths=\["src/\*\*/\*.ts"])

```



Read the main README, all Markdown files in the `docs` directory, and a specific

logo image, excluding a specific file:



```

read\_many\_files(paths=\["README.md", "docs/\*\*/\*.md", "assets/logo.png"], exclude=\["docs/OLD\_README.md"])

```



Read all JavaScript files but explicitly include test files and all JPEGs in an

`images` folder:



```

read\_many\_files(paths=\["\*\*/\*.js"], include=\["\*\*/\*.test.js", "images/\*\*/\*.jpg"], useDefaultExcludes=False)

```



\## Important notes



\- \*\*Binary file handling:\*\*

&nbsp; - \*\*Image/PDF/Audio/Video files:\*\* The tool can read common image types (PNG,

&nbsp;   JPEG, etc.), PDF, audio (mp3, wav), and video (mp4, mov) files, returning

&nbsp;   them as base64 encoded data. These files \_must\_ be explicitly targeted by

&nbsp;   the `paths` or `include` patterns (e.g., by specifying the exact filename

&nbsp;   like `video.mp4` or a pattern like `\*.mov`).

&nbsp; - \*\*Other binary files:\*\* The tool attempts to detect and skip other types of

&nbsp;   binary files by examining their initial content for null bytes. The tool

&nbsp;   excludes these files from its output.

\- \*\*Performance:\*\* Reading a very large number of files or very large individual

&nbsp; files can be resource-intensive.

\- \*\*Path specificity:\*\* Ensure paths and glob patterns are correctly specified

&nbsp; relative to the tool's target directory. For image/PDF files, ensure the

&nbsp; patterns are specific enough to include them.

\- \*\*Default excludes:\*\* Be aware of the default exclusion patterns (like

&nbsp; `node\_modules`, `.git`) and use `useDefaultExcludes=False` if you need to

&nbsp; override them, but do so cautiously.



\# Shell Tool (`run\_shell\_command`)



This document describes the `run\_shell\_command` tool for the Gemini CLI.



\## Description



Use `run\_shell\_command` to interact with the underlying system, run scripts, or

perform command-line operations. `run\_shell\_command` executes a given shell

command, including interactive commands that require user input (e.g., `vim`,

`git rebase -i`) if the `tools.shell.enableInteractiveShell` setting is set to

`true`.



On Windows, commands are executed with `powershell.exe -NoProfile -Command`

(unless you explicitly point `ComSpec` at another shell). On other platforms,

they are executed with `bash -c`.



\### Arguments



`run\_shell\_command` takes the following arguments:



\- `command` (string, required): The exact shell command to execute.

\- `description` (string, optional): A brief description of the command's

&nbsp; purpose, which will be shown to the user.

\- `directory` (string, optional): The directory (relative to the project root)

&nbsp; in which to execute the command. If not provided, the command runs in the

&nbsp; project root.



\## How to use `run\_shell\_command` with the Gemini CLI



When using `run\_shell\_command`, the command is executed as a subprocess.

`run\_shell\_command` can start background processes using `\&`. The tool returns

detailed information about the execution, including:



\- `Command`: The command that was executed.

\- `Directory`: The directory where the command was run.

\- `Stdout`: Output from the standard output stream.

\- `Stderr`: Output from the standard error stream.

\- `Error`: Any error message reported by the subprocess.

\- `Exit Code`: The exit code of the command.

\- `Signal`: The signal number if the command was terminated by a signal.

\- `Background PIDs`: A list of PIDs for any background processes started.



Usage:



```

run\_shell\_command(command="Your commands.", description="Your description of the command.", directory="Your execution directory.")

```



\## `run\_shell\_command` examples



List files in the current directory:



```

run\_shell\_command(command="ls -la")

```



Run a script in a specific directory:



```

run\_shell\_command(command="./my\_script.sh", directory="scripts", description="Run my custom script")

```



Start a background server:



```

run\_shell\_command(command="npm run dev \&", description="Start development server in background")

```



\## Configuration



You can configure the behavior of the `run\_shell\_command` tool by modifying your

`settings.json` file or by using the `/settings` command in the Gemini CLI.



\### Enabling Interactive Commands



To enable interactive commands, you need to set the

`tools.shell.enableInteractiveShell` setting to `true`. This will use `node-pty`

for shell command execution, which allows for interactive sessions. If

`node-pty` is not available, it will fall back to the `child\_process`

implementation, which does not support interactive commands.



\*\*Example `settings.json`:\*\*



```json

{

&nbsp; "tools": {

&nbsp;   "shell": {

&nbsp;     "enableInteractiveShell": true

&nbsp;   }

&nbsp; }

}

```



\### Showing Color in Output



To show color in the shell output, you need to set the `tools.shell.showColor`

setting to `true`. \*\*Note: This setting only applies when

`tools.shell.enableInteractiveShell` is enabled.\*\*



\*\*Example `settings.json`:\*\*



```json

{

&nbsp; "tools": {

&nbsp;   "shell": {

&nbsp;     "showColor": true

&nbsp;   }

&nbsp; }

}

```



\### Setting the Pager



You can set a custom pager for the shell output by setting the

`tools.shell.pager` setting. The default pager is `cat`. \*\*Note: This setting

only applies when `tools.shell.enableInteractiveShell` is enabled.\*\*



\*\*Example `settings.json`:\*\*



```json

{

&nbsp; "tools": {

&nbsp;   "shell": {

&nbsp;     "pager": "less"

&nbsp;   }

&nbsp; }

}

```



\## Interactive Commands



The `run\_shell\_command` tool now supports interactive commands by integrating a

pseudo-terminal (pty). This allows you to run commands that require real-time

user input, such as text editors (`vim`, `nano`), terminal-based UIs (`htop`),

and interactive version control operations (`git rebase -i`).



When an interactive command is running, you can send input to it from the Gemini

CLI. To focus on the interactive shell, press `ctrl+f`. The terminal output,

including complex TUIs, will be rendered correctly.



\## Important notes



\- \*\*Security:\*\* Be cautious when executing commands, especially those

&nbsp; constructed from user input, to prevent security vulnerabilities.

\- \*\*Error handling:\*\* Check the `Stderr`, `Error`, and `Exit Code` fields to

&nbsp; determine if a command executed successfully.

\- \*\*Background processes:\*\* When a command is run in the background with `\&`,

&nbsp; the tool will return immediately and the process will continue to run in the

&nbsp; background. The `Background PIDs` field will contain the process ID of the

&nbsp; background process.



\## Environment Variables



When `run\_shell\_command` executes a command, it sets the `GEMINI\_CLI=1`

environment variable in the subprocess's environment. This allows scripts or

tools to detect if they are being run from within the Gemini CLI.



\## Command Restrictions



You can restrict the commands that can be executed by the `run\_shell\_command`

tool by using the `tools.core` and `tools.exclude` settings in your

configuration file.



\- `tools.core`: To restrict `run\_shell\_command` to a specific set of commands,

&nbsp; add entries to the `core` list under the `tools` category in the format

&nbsp; `run\_shell\_command(<command>)`. For example,

&nbsp; `"tools": {"core": \["run\_shell\_command(git)"]}` will only allow `git`

&nbsp; commands. Including the generic `run\_shell\_command` acts as a wildcard,

&nbsp; allowing any command not explicitly blocked.

\- `tools.exclude`: To block specific commands, add entries to the `exclude` list

&nbsp; under the `tools` category in the format `run\_shell\_command(<command>)`. For

&nbsp; example, `"tools": {"exclude": \["run\_shell\_command(rm)"]}` will block `rm`

&nbsp; commands.



The validation logic is designed to be secure and flexible:



1\.  \*\*Command Chaining Disabled\*\*: The tool automatically splits commands

&nbsp;   chained with `\&\&`, `||`, or `;` and validates each part separately. If any

&nbsp;   part of the chain is disallowed, the entire command is blocked.

2\.  \*\*Prefix Matching\*\*: The tool uses prefix matching. For example, if you

&nbsp;   allow `git`, you can run `git status` or `git log`.

3\.  \*\*Blocklist Precedence\*\*: The `tools.exclude` list is always checked first.

&nbsp;   If a command matches a blocked prefix, it will be denied, even if it also

&nbsp;   matches an allowed prefix in `tools.core`.



\### Command Restriction Examples



\*\*Allow only specific command prefixes\*\*



To allow only `git` and `npm` commands, and block all others:



```json

{

&nbsp; "tools": {

&nbsp;   "core": \["run\_shell\_command(git)", "run\_shell\_command(npm)"]

&nbsp; }

}

```



\- `git status`: Allowed

\- `npm install`: Allowed

\- `ls -l`: Blocked



\*\*Block specific command prefixes\*\*



To block `rm` and allow all other commands:



```json

{

&nbsp; "tools": {

&nbsp;   "core": \["run\_shell\_command"],

&nbsp;   "exclude": \["run\_shell\_command(rm)"]

&nbsp; }

}

```



\- `rm -rf /`: Blocked

\- `git status`: Allowed

\- `npm install`: Allowed



\*\*Blocklist takes precedence\*\*



If a command prefix is in both `tools.core` and `tools.exclude`, it will be

blocked.



```json

{

&nbsp; "tools": {

&nbsp;   "core": \["run\_shell\_command(git)"],

&nbsp;   "exclude": \["run\_shell\_command(git push)"]

&nbsp; }

}

```



\- `git push origin main`: Blocked

\- `git status`: Allowed



\*\*Block all shell commands\*\*



To block all shell commands, add the `run\_shell\_command` wildcard to

`tools.exclude`:



```json

{

&nbsp; "tools": {

&nbsp;   "exclude": \["run\_shell\_command"]

&nbsp; }

}

```



\- `ls -l`: Blocked

\- `any other command`: Blocked



\## Security Note for `excludeTools`



Command-specific restrictions in `excludeTools` for `run\_shell\_command` are

based on simple string matching and can be easily bypassed. This feature is

\*\*not a security mechanism\*\* and should not be relied upon to safely execute

untrusted code. It is recommended to use `coreTools` to explicitly select

commands that can be executed.



\# Web Fetch Tool (`web\_fetch`)



This document describes the `web\_fetch` tool for the Gemini CLI.



\## Description



Use `web\_fetch` to summarize, compare, or extract information from web pages.

The `web\_fetch` tool processes content from one or more URLs (up to 20) embedded

in a prompt. `web\_fetch` takes a natural language prompt and returns a generated

response.



\### Arguments



`web\_fetch` takes one argument:



\- `prompt` (string, required): A comprehensive prompt that includes the URL(s)

&nbsp; (up to 20) to fetch and specific instructions on how to process their content.

&nbsp; For example:

&nbsp; `"Summarize https://example.com/article and extract key points from https://another.com/data"`.

&nbsp; The prompt must contain at least one URL starting with `http://` or

&nbsp; `https://`.



\## How to use `web\_fetch` with the Gemini CLI



To use `web\_fetch` with the Gemini CLI, provide a natural language prompt that

contains URLs. The tool will ask for confirmation before fetching any URLs. Once

confirmed, the tool will process URLs through Gemini API's `urlContext`.



If the Gemini API cannot access the URL, the tool will fall back to fetching

content directly from the local machine. The tool will format the response,

including source attribution and citations where possible. The tool will then

provide the response to the user.



Usage:



```

web\_fetch(prompt="Your prompt, including a URL such as https://google.com.")

```



\## `web\_fetch` examples



Summarize a single article:



```

web\_fetch(prompt="Can you summarize the main points of https://example.com/news/latest")

```



Compare two articles:



```

web\_fetch(prompt="What are the differences in the conclusions of these two papers: https://arxiv.org/abs/2401.0001 and https://arxiv.org/abs/2401.0002?")

```



\## Important notes



\- \*\*URL processing:\*\* `web\_fetch` relies on the Gemini API's ability to access

&nbsp; and process the given URLs.

\- \*\*Output quality:\*\* The quality of the output will depend on the clarity of

&nbsp; the instructions in the prompt.



\# Web Search Tool (`google\_web\_search`)



This document describes the `google\_web\_search` tool.



\## Description



Use `google\_web\_search` to perform a web search using Google Search via the

Gemini API. The `google\_web\_search` tool returns a summary of web results with

sources.



\### Arguments



`google\_web\_search` takes one argument:



\- `query` (string, required): The search query.



\## How to use `google\_web\_search` with the Gemini CLI



The `google\_web\_search` tool sends a query to the Gemini API, which then

performs a web search. `google\_web\_search` will return a generated response

based on the search results, including citations and sources.



Usage:



```

google\_web\_search(query="Your query goes here.")

```



\## `google\_web\_search` examples



Get information on a topic:



```

google\_web\_search(query="latest advancements in AI-powered code generation")

```



\## Important notes



\- \*\*Response returned:\*\* The `google\_web\_search` tool returns a processed

&nbsp; summary, not a raw list of search results.

\- \*\*Citations:\*\* The response includes citations to the sources used to generate

&nbsp; the summary.



\# Memory Tool (`save\_memory`)



This document describes the `save\_memory` tool for the Gemini CLI.



\## Description



Use `save\_memory` to save and recall information across your Gemini CLI

sessions. With `save\_memory`, you can direct the CLI to remember key details

across sessions, providing personalized and directed assistance.



\### Arguments



`save\_memory` takes one argument:



\- `fact` (string, required): The specific fact or piece of information to

&nbsp; remember. This should be a clear, self-contained statement written in natural

&nbsp; language.



\## How to use `save\_memory` with the Gemini CLI



The tool appends the provided `fact` to a special `GEMINI.md` file located in

the user's home directory (`~/.gemini/GEMINI.md`). This file can be configured

to have a different name.



Once added, the facts are stored under a `## Gemini Added Memories` section.

This file is loaded as context in subsequent sessions, allowing the CLI to

recall the saved information.



Usage:



```

save\_memory(fact="Your fact here.")

```



\### `save\_memory` examples



Remember a user preference:



```

save\_memory(fact="My preferred programming language is Python.")

```



Store a project-specific detail:



```

save\_memory(fact="The project I'm currently working on is called 'gemini-cli'.")

```



\## Important notes



\- \*\*General usage:\*\* This tool should be used for concise, important facts. It

&nbsp; is not intended for storing large amounts of data or conversational history.

\- \*\*Memory file:\*\* The memory file is a plain text Markdown file, so you can

&nbsp; view and edit it manually if needed.

\# Todo Tool (`write\_todos`)



This document describes the `write\_todos` tool for the Gemini CLI.



\## Description



The `write\_todos` tool allows the Gemini agent to create and manage a list of

subtasks for complex user requests. This provides you, the user, with greater

visibility into the agent's plan and its current progress.



\### Arguments



`write\_todos` takes one argument:



\- `todos` (array of objects, required): The complete list of todo items. This

&nbsp; replaces the existing list. Each item includes:

&nbsp; - `description` (string): The task description.

&nbsp; - `status` (string): The current status (`pending`, `in\_progress`,

&nbsp;   `completed`, or `cancelled`).



\## Behavior



The agent uses this tool to break down complex multi-step requests into a clear

plan.



\- \*\*Progress Tracking:\*\* The agent updates this list as it works, marking tasks

&nbsp; as `completed` when done.

\- \*\*Single Focus:\*\* Only one task will be marked `in\_progress` at a time,

&nbsp; indicating exactly what the agent is currently working on.

\- \*\*Dynamic Updates:\*\* The plan may evolve as the agent discovers new

&nbsp; information, leading to new tasks being added or unnecessary ones being

&nbsp; cancelled.



When active, the current `in\_progress` task is displayed above the input box,

keeping you informed of the immediate action. You can toggle the full view of

the todo list at any time by pressing `Ctrl+T`.



Usage example (internal representation):



```javascript

write\_todos({

&nbsp; todos: \[

&nbsp;   { description: 'Initialize new React project', status: 'completed' },

&nbsp;   { description: 'Implement state management', status: 'in\_progress' },

&nbsp;   { description: 'Create API service', status: 'pending' },

&nbsp; ],

});

```



\## Important notes



\- \*\*Enabling:\*\* This tool is disabled by default. To use it, you must enable it

&nbsp; in your `settings.json` file by setting `"useWriteTodos": true`.



\- \*\*Intended Use:\*\* This tool is primarily used by the agent for complex,

&nbsp; multi-turn tasks. It is generally not used for simple, single-turn questions.



\# MCP servers with the Gemini CLI



This document provides a guide to configuring and using Model Context Protocol

(MCP) servers with the Gemini CLI.



\## What is an MCP server?



An MCP server is an application that exposes tools and resources to the Gemini

CLI through the Model Context Protocol, allowing it to interact with external

systems and data sources. MCP servers act as a bridge between the Gemini model

and your local environment or other services like APIs.



An MCP server enables the Gemini CLI to:



\- \*\*Discover tools:\*\* List available tools, their descriptions, and parameters

&nbsp; through standardized schema definitions.

\- \*\*Execute tools:\*\* Call specific tools with defined arguments and receive

&nbsp; structured responses.

\- \*\*Access resources:\*\* Read data from specific resources (though the Gemini CLI

&nbsp; primarily focuses on tool execution).



With an MCP server, you can extend the Gemini CLI's capabilities to perform

actions beyond its built-in features, such as interacting with databases, APIs,

custom scripts, or specialized workflows.



\## Core Integration Architecture



The Gemini CLI integrates with MCP servers through a sophisticated discovery and

execution system built into the core package (`packages/core/src/tools/`):



\### Discovery Layer (`mcp-client.ts`)



The discovery process is orchestrated by `discoverMcpTools()`, which:



1\. \*\*Iterates through configured servers\*\* from your `settings.json`

&nbsp;  `mcpServers` configuration

2\. \*\*Establishes connections\*\* using appropriate transport mechanisms (Stdio,

&nbsp;  SSE, or Streamable HTTP)

3\. \*\*Fetches tool definitions\*\* from each server using the MCP protocol

4\. \*\*Sanitizes and validates\*\* tool schemas for compatibility with the Gemini

&nbsp;  API

5\. \*\*Registers tools\*\* in the global tool registry with conflict resolution



\### Execution Layer (`mcp-tool.ts`)



Each discovered MCP tool is wrapped in a `DiscoveredMCPTool` instance that:



\- \*\*Handles confirmation logic\*\* based on server trust settings and user

&nbsp; preferences

\- \*\*Manages tool execution\*\* by calling the MCP server with proper parameters

\- \*\*Processes responses\*\* for both the LLM context and user display

\- \*\*Maintains connection state\*\* and handles timeouts



\### Transport Mechanisms



The Gemini CLI supports three MCP transport types:



\- \*\*Stdio Transport:\*\* Spawns a subprocess and communicates via stdin/stdout

\- \*\*SSE Transport:\*\* Connects to Server-Sent Events endpoints

\- \*\*Streamable HTTP Transport:\*\* Uses HTTP streaming for communication



\## How to set up your MCP server



The Gemini CLI uses the `mcpServers` configuration in your `settings.json` file

to locate and connect to MCP servers. This configuration supports multiple

servers with different transport mechanisms.



\### Configure the MCP server in settings.json



You can configure MCP servers in your `settings.json` file in two main ways:

through the top-level `mcpServers` object for specific server definitions, and

through the `mcp` object for global settings that control server discovery and

execution.



\#### Global MCP Settings (`mcp`)



The `mcp` object in your `settings.json` allows you to define global rules for

all MCP servers.



\- \*\*`mcp.serverCommand`\*\* (string): A global command to start an MCP server.

\- \*\*`mcp.allowed`\*\* (array of strings): A list of MCP server names to allow. If

&nbsp; this is set, only servers from this list (matching the keys in the

&nbsp; `mcpServers` object) will be connected to.

\- \*\*`mcp.excluded`\*\* (array of strings): A list of MCP server names to exclude.

&nbsp; Servers in this list will not be connected to.



\*\*Example:\*\*



```json

{

&nbsp; "mcp": {

&nbsp;   "allowed": \["my-trusted-server"],

&nbsp;   "excluded": \["experimental-server"]

&nbsp; }

}

```



\#### Server-Specific Configuration (`mcpServers`)



The `mcpServers` object is where you define each individual MCP server you want

the CLI to connect to.



\### Configuration Structure



Add an `mcpServers` object to your `settings.json` file:



```json

{ ...file contains other config objects

&nbsp; "mcpServers": {

&nbsp;   "serverName": {

&nbsp;     "command": "path/to/server",

&nbsp;     "args": \["--arg1", "value1"],

&nbsp;     "env": {

&nbsp;       "API\_KEY": "$MY\_API\_TOKEN"

&nbsp;     },

&nbsp;     "cwd": "./server-directory",

&nbsp;     "timeout": 30000,

&nbsp;     "trust": false

&nbsp;   }

&nbsp; }

}

```



\### Configuration Properties



Each server configuration supports the following properties:



\#### Required (one of the following)



\- \*\*`command`\*\* (string): Path to the executable for Stdio transport

\- \*\*`url`\*\* (string): SSE endpoint URL (e.g., `"http://localhost:8080/sse"`)

\- \*\*`httpUrl`\*\* (string): HTTP streaming endpoint URL



\#### Optional



\- \*\*`args`\*\* (string\[]): Command-line arguments for Stdio transport

\- \*\*`headers`\*\* (object): Custom HTTP headers when using `url` or `httpUrl`

\- \*\*`env`\*\* (object): Environment variables for the server process. Values can

&nbsp; reference environment variables using `$VAR\_NAME` or `${VAR\_NAME}` syntax

\- \*\*`cwd`\*\* (string): Working directory for Stdio transport

\- \*\*`timeout`\*\* (number): Request timeout in milliseconds (default: 600,000ms =

&nbsp; 10 minutes)

\- \*\*`trust`\*\* (boolean): When `true`, bypasses all tool call confirmations for

&nbsp; this server (default: `false`)

\- \*\*`includeTools`\*\* (string\[]): List of tool names to include from this MCP

&nbsp; server. When specified, only the tools listed here will be available from this

&nbsp; server (allowlist behavior). If not specified, all tools from the server are

&nbsp; enabled by default.

\- \*\*`excludeTools`\*\* (string\[]): List of tool names to exclude from this MCP

&nbsp; server. Tools listed here will not be available to the model, even if they are

&nbsp; exposed by the server. \*\*Note:\*\* `excludeTools` takes precedence over

&nbsp; `includeTools` - if a tool is in both lists, it will be excluded.

\- \*\*`targetAudience`\*\* (string): The OAuth Client ID allowlisted on the

&nbsp; IAP-protected application you are trying to access. Used with

&nbsp; `authProviderType: 'service\_account\_impersonation'`.

\- \*\*`targetServiceAccount`\*\* (string): The email address of the Google Cloud

&nbsp; Service Account to impersonate. Used with

&nbsp; `authProviderType: 'service\_account\_impersonation'`.



\### OAuth Support for Remote MCP Servers



The Gemini CLI supports OAuth 2.0 authentication for remote MCP servers using

SSE or HTTP transports. This enables secure access to MCP servers that require

authentication.



\#### Automatic OAuth Discovery



For servers that support OAuth discovery, you can omit the OAuth configuration

and let the CLI discover it automatically:



```json

{

&nbsp; "mcpServers": {

&nbsp;   "discoveredServer": {

&nbsp;     "url": "https://api.example.com/sse"

&nbsp;   }

&nbsp; }

}

```



The CLI will automatically:



\- Detect when a server requires OAuth authentication (401 responses)

\- Discover OAuth endpoints from server metadata

\- Perform dynamic client registration if supported

\- Handle the OAuth flow and token management



\#### Authentication Flow



When connecting to an OAuth-enabled server:



1\. \*\*Initial connection attempt\*\* fails with 401 Unauthorized

2\. \*\*OAuth discovery\*\* finds authorization and token endpoints

3\. \*\*Browser opens\*\* for user authentication (requires local browser access)

4\. \*\*Authorization code\*\* is exchanged for access tokens

5\. \*\*Tokens are stored\*\* securely for future use

6\. \*\*Connection retry\*\* succeeds with valid tokens



\#### Browser Redirect Requirements



\*\*Important:\*\* OAuth authentication requires that your local machine can:



\- Open a web browser for authentication

\- Receive redirects on `http://localhost:7777/oauth/callback`



This feature will not work in:



\- Headless environments without browser access

\- Remote SSH sessions without X11 forwarding

\- Containerized environments without browser support



\#### Managing OAuth Authentication



Use the `/mcp auth` command to manage OAuth authentication:



```bash

\# List servers requiring authentication

/mcp auth



\# Authenticate with a specific server

/mcp auth serverName



\# Re-authenticate if tokens expire

/mcp auth serverName

```



\#### OAuth Configuration Properties



\- \*\*`enabled`\*\* (boolean): Enable OAuth for this server

\- \*\*`clientId`\*\* (string): OAuth client identifier (optional with dynamic

&nbsp; registration)

\- \*\*`clientSecret`\*\* (string): OAuth client secret (optional for public clients)

\- \*\*`authorizationUrl`\*\* (string): OAuth authorization endpoint (auto-discovered

&nbsp; if omitted)

\- \*\*`tokenUrl`\*\* (string): OAuth token endpoint (auto-discovered if omitted)

\- \*\*`scopes`\*\* (string\[]): Required OAuth scopes

\- \*\*`redirectUri`\*\* (string): Custom redirect URI (defaults to

&nbsp; `http://localhost:7777/oauth/callback`)

\- \*\*`tokenParamName`\*\* (string): Query parameter name for tokens in SSE URLs

\- \*\*`audiences`\*\* (string\[]): Audiences the token is valid for



\#### Token Management



OAuth tokens are automatically:



\- \*\*Stored securely\*\* in `~/.gemini/mcp-oauth-tokens.json`

\- \*\*Refreshed\*\* when expired (if refresh tokens are available)

\- \*\*Validated\*\* before each connection attempt

\- \*\*Cleaned up\*\* when invalid or expired



\#### Authentication Provider Type



You can specify the authentication provider type using the `authProviderType`

property:



\- \*\*`authProviderType`\*\* (string): Specifies the authentication provider. Can be

&nbsp; one of the following:

&nbsp; - \*\*`dynamic\_discovery`\*\* (default): The CLI will automatically discover the

&nbsp;   OAuth configuration from the server.

&nbsp; - \*\*`google\_credentials`\*\*: The CLI will use the Google Application Default

&nbsp;   Credentials (ADC) to authenticate with the server. When using this provider,

&nbsp;   you must specify the required scopes.

&nbsp; - \*\*`service\_account\_impersonation`\*\*: The CLI will impersonate a Google Cloud

&nbsp;   Service Account to authenticate with the server. This is useful for

&nbsp;   accessing IAP-protected services (this was specifically designed for Cloud

&nbsp;   Run services).



\#### Google Credentials



```json

{

&nbsp; "mcpServers": {

&nbsp;   "googleCloudServer": {

&nbsp;     "httpUrl": "https://my-gcp-service.run.app/mcp",

&nbsp;     "authProviderType": "google\_credentials",

&nbsp;     "oauth": {

&nbsp;       "scopes": \["https://www.googleapis.com/auth/userinfo.email"]

&nbsp;     }

&nbsp;   }

&nbsp; }

}

```



\#### Service Account Impersonation



To authenticate with a server using Service Account Impersonation, you must set

the `authProviderType` to `service\_account\_impersonation` and provide the

following properties:



\- \*\*`targetAudience`\*\* (string): The OAuth Client ID allowslisted on the

&nbsp; IAP-protected application you are trying to access.

\- \*\*`targetServiceAccount`\*\* (string): The email address of the Google Cloud

&nbsp; Service Account to impersonate.



The CLI will use your local Application Default Credentials (ADC) to generate an

OIDC ID token for the specified service account and audience. This token will

then be used to authenticate with the MCP server.



\#### Setup Instructions



1\. \*\*\[Create](https://cloud.google.com/iap/docs/oauth-client-creation) or use an

&nbsp;  existing OAuth 2.0 client ID.\*\* To use an existing OAuth 2.0 client ID,

&nbsp;  follow the steps in

&nbsp;  \[How to share OAuth Clients](https://cloud.google.com/iap/docs/sharing-oauth-clients).

2\. \*\*Add the OAuth ID to the allowlist for

&nbsp;  \[programmatic access](https://cloud.google.com/iap/docs/sharing-oauth-clients#programmatic\_access)

&nbsp;  for the application.\*\* Since Cloud Run is not yet a supported resource type

&nbsp;  in gcloud iap, you must allowlist the Client ID on the project.

3\. \*\*Create a service account.\*\*

&nbsp;  \[Documentation](https://cloud.google.com/iam/docs/service-accounts-create#creating),

&nbsp;  \[Cloud Console Link](https://console.cloud.google.com/iam-admin/serviceaccounts)

4\. \*\*Add both the service account and users to the IAP Policy\*\* in the

&nbsp;  "Security" tab of the Cloud Run service itself or via gcloud.

5\. \*\*Grant all users and groups\*\* who will access the MCP Server the necessary

&nbsp;  permissions to

&nbsp;  \[impersonate the service account](https://cloud.google.com/docs/authentication/use-service-account-impersonation)

&nbsp;  (i.e., `roles/iam.serviceAccountTokenCreator`).

6\. \*\*\[Enable](https://console.cloud.google.com/apis/library/iamcredentials.googleapis.com)

&nbsp;  the IAM Credentials API\*\* for your project.



\### Example Configurations



\#### Python MCP Server (Stdio)



```json

{

&nbsp; "mcpServers": {

&nbsp;   "pythonTools": {

&nbsp;     "command": "python",

&nbsp;     "args": \["-m", "my\_mcp\_server", "--port", "8080"],

&nbsp;     "cwd": "./mcp-servers/python",

&nbsp;     "env": {

&nbsp;       "DATABASE\_URL": "$DB\_CONNECTION\_STRING",

&nbsp;       "API\_KEY": "${EXTERNAL\_API\_KEY}"

&nbsp;     },

&nbsp;     "timeout": 15000

&nbsp;   }

&nbsp; }

}

```



\#### Node.js MCP Server (Stdio)



```json

{

&nbsp; "mcpServers": {

&nbsp;   "nodeServer": {

&nbsp;     "command": "node",

&nbsp;     "args": \["dist/server.js", "--verbose"],

&nbsp;     "cwd": "./mcp-servers/node",

&nbsp;     "trust": true

&nbsp;   }

&nbsp; }

}

```



\#### Docker-based MCP Server



```json

{

&nbsp; "mcpServers": {

&nbsp;   "dockerizedServer": {

&nbsp;     "command": "docker",

&nbsp;     "args": \[

&nbsp;       "run",

&nbsp;       "-i",

&nbsp;       "--rm",

&nbsp;       "-e",

&nbsp;       "API\_KEY",

&nbsp;       "-v",

&nbsp;       "${PWD}:/workspace",

&nbsp;       "my-mcp-server:latest"

&nbsp;     ],

&nbsp;     "env": {

&nbsp;       "API\_KEY": "$EXTERNAL\_SERVICE\_TOKEN"

&nbsp;     }

&nbsp;   }

&nbsp; }

}

```



\#### HTTP-based MCP Server



```json

{

&nbsp; "mcpServers": {

&nbsp;   "httpServer": {

&nbsp;     "httpUrl": "http://localhost:3000/mcp",

&nbsp;     "timeout": 5000

&nbsp;   }

&nbsp; }

}

```



\#### HTTP-based MCP Server with Custom Headers



```json

{

&nbsp; "mcpServers": {

&nbsp;   "httpServerWithAuth": {

&nbsp;     "httpUrl": "http://localhost:3000/mcp",

&nbsp;     "headers": {

&nbsp;       "Authorization": "Bearer your-api-token",

&nbsp;       "X-Custom-Header": "custom-value",

&nbsp;       "Content-Type": "application/json"

&nbsp;     },

&nbsp;     "timeout": 5000

&nbsp;   }

&nbsp; }

}

```



\#### MCP Server with Tool Filtering



```json

{

&nbsp; "mcpServers": {

&nbsp;   "filteredServer": {

&nbsp;     "command": "python",

&nbsp;     "args": \["-m", "my\_mcp\_server"],

&nbsp;     "includeTools": \["safe\_tool", "file\_reader", "data\_processor"],

&nbsp;     // "excludeTools": \["dangerous\_tool", "file\_deleter"],

&nbsp;     "timeout": 30000

&nbsp;   }

&nbsp; }

}

```



\### SSE MCP Server with SA Impersonation



```json

{

&nbsp; "mcpServers": {

&nbsp;   "myIapProtectedServer": {

&nbsp;     "url": "https://my-iap-service.run.app/sse",

&nbsp;     "authProviderType": "service\_account\_impersonation",

&nbsp;     "targetAudience": "YOUR\_IAP\_CLIENT\_ID.apps.googleusercontent.com",

&nbsp;     "targetServiceAccount": "your-sa@your-project.iam.gserviceaccount.com"

&nbsp;   }

&nbsp; }

}

```



\## Discovery Process Deep Dive



When the Gemini CLI starts, it performs MCP server discovery through the

following detailed process:



\### 1. Server Iteration and Connection



For each configured server in `mcpServers`:



1\. \*\*Status tracking begins:\*\* Server status is set to `CONNECTING`

2\. \*\*Transport selection:\*\* Based on configuration properties:

&nbsp;  - `httpUrl` → `StreamableHTTPClientTransport`

&nbsp;  - `url` → `SSEClientTransport`

&nbsp;  - `command` → `StdioClientTransport`

3\. \*\*Connection establishment:\*\* The MCP client attempts to connect with the

&nbsp;  configured timeout

4\. \*\*Error handling:\*\* Connection failures are logged and the server status is

&nbsp;  set to `DISCONNECTED`



\### 2. Tool Discovery



Upon successful connection:



1\. \*\*Tool listing:\*\* The client calls the MCP server's tool listing endpoint

2\. \*\*Schema validation:\*\* Each tool's function declaration is validated

3\. \*\*Tool filtering:\*\* Tools are filtered based on `includeTools` and

&nbsp;  `excludeTools` configuration

4\. \*\*Name sanitization:\*\* Tool names are cleaned to meet Gemini API

&nbsp;  requirements:

&nbsp;  - Invalid characters (non-alphanumeric, underscore, dot, hyphen) are replaced

&nbsp;    with underscores

&nbsp;  - Names longer than 63 characters are truncated with middle replacement

&nbsp;    (`\_\_\_`)



\### 3. Conflict Resolution



When multiple servers expose tools with the same name:



1\. \*\*First registration wins:\*\* The first server to register a tool name gets

&nbsp;  the unprefixed name

2\. \*\*Automatic prefixing:\*\* Subsequent servers get prefixed names:

&nbsp;  `serverName\_\_toolName`

3\. \*\*Registry tracking:\*\* The tool registry maintains mappings between server

&nbsp;  names and their tools



\### 4. Schema Processing



Tool parameter schemas undergo sanitization for Gemini API compatibility:



\- \*\*`$schema` properties\*\* are removed

\- \*\*`additionalProperties`\*\* are stripped

\- \*\*`anyOf` with `default`\*\* have their default values removed (Vertex AI

&nbsp; compatibility)

\- \*\*Recursive processing\*\* applies to nested schemas



\### 5. Connection Management



After discovery:



\- \*\*Persistent connections:\*\* Servers that successfully register tools maintain

&nbsp; their connections

\- \*\*Cleanup:\*\* Servers that provide no usable tools have their connections

&nbsp; closed

\- \*\*Status updates:\*\* Final server statuses are set to `CONNECTED` or

&nbsp; `DISCONNECTED`



\## Tool Execution Flow



When the Gemini model decides to use an MCP tool, the following execution flow

occurs:



\### 1. Tool Invocation



The model generates a `FunctionCall` with:



\- \*\*Tool name:\*\* The registered name (potentially prefixed)

\- \*\*Arguments:\*\* JSON object matching the tool's parameter schema



\### 2. Confirmation Process



Each `DiscoveredMCPTool` implements sophisticated confirmation logic:



\#### Trust-based Bypass



```typescript

if (this.trust) {

&nbsp; return false; // No confirmation needed

}

```



\#### Dynamic Allow-listing



The system maintains internal allow-lists for:



\- \*\*Server-level:\*\* `serverName` → All tools from this server are trusted

\- \*\*Tool-level:\*\* `serverName.toolName` → This specific tool is trusted



\#### User Choice Handling



When confirmation is required, users can choose:



\- \*\*Proceed once:\*\* Execute this time only

\- \*\*Always allow this tool:\*\* Add to tool-level allow-list

\- \*\*Always allow this server:\*\* Add to server-level allow-list

\- \*\*Cancel:\*\* Abort execution



\### 3. Execution



Upon confirmation (or trust bypass):



1\. \*\*Parameter preparation:\*\* Arguments are validated against the tool's schema

2\. \*\*MCP call:\*\* The underlying `CallableTool` invokes the server with:



&nbsp;  ```typescript

&nbsp;  const functionCalls = \[

&nbsp;    {

&nbsp;      name: this.serverToolName, // Original server tool name

&nbsp;      args: params,

&nbsp;    },

&nbsp;  ];

&nbsp;  ```



3\. \*\*Response processing:\*\* Results are formatted for both LLM context and user

&nbsp;  display



\### 4. Response Handling



The execution result contains:



\- \*\*`llmContent`:\*\* Raw response parts for the language model's context

\- \*\*`returnDisplay`:\*\* Formatted output for user display (often JSON in markdown

&nbsp; code blocks)



\## How to interact with your MCP server



\### Using the `/mcp` Command



The `/mcp` command provides comprehensive information about your MCP server

setup:



```bash

/mcp

```



This displays:



\- \*\*Server list:\*\* All configured MCP servers

\- \*\*Connection status:\*\* `CONNECTED`, `CONNECTING`, or `DISCONNECTED`

\- \*\*Server details:\*\* Configuration summary (excluding sensitive data)

\- \*\*Available tools:\*\* List of tools from each server with descriptions

\- \*\*Discovery state:\*\* Overall discovery process status



\### Example `/mcp` Output



```

MCP Servers Status:



📡 pythonTools (CONNECTED)

&nbsp; Command: python -m my\_mcp\_server --port 8080

&nbsp; Working Directory: ./mcp-servers/python

&nbsp; Timeout: 15000ms

&nbsp; Tools: calculate\_sum, file\_analyzer, data\_processor



🔌 nodeServer (DISCONNECTED)

&nbsp; Command: node dist/server.js --verbose

&nbsp; Error: Connection refused



🐳 dockerizedServer (CONNECTED)

&nbsp; Command: docker run -i --rm -e API\_KEY my-mcp-server:latest

&nbsp; Tools: docker\_\_deploy, docker\_\_status



Discovery State: COMPLETED

```



\### Tool Usage



Once discovered, MCP tools are available to the Gemini model like built-in

tools. The model will automatically:



1\. \*\*Select appropriate tools\*\* based on your requests

2\. \*\*Present confirmation dialogs\*\* (unless the server is trusted)

3\. \*\*Execute tools\*\* with proper parameters

4\. \*\*Display results\*\* in a user-friendly format



\## Status Monitoring and Troubleshooting



\### Connection States



The MCP integration tracks several states:



\#### Server Status (`MCPServerStatus`)



\- \*\*`DISCONNECTED`:\*\* Server is not connected or has errors

\- \*\*`CONNECTING`:\*\* Connection attempt in progress

\- \*\*`CONNECTED`:\*\* Server is connected and ready



\#### Discovery State (`MCPDiscoveryState`)



\- \*\*`NOT\_STARTED`:\*\* Discovery hasn't begun

\- \*\*`IN\_PROGRESS`:\*\* Currently discovering servers

\- \*\*`COMPLETED`:\*\* Discovery finished (with or without errors)



\### Common Issues and Solutions



\#### Server Won't Connect



\*\*Symptoms:\*\* Server shows `DISCONNECTED` status



\*\*Troubleshooting:\*\*



1\. \*\*Check configuration:\*\* Verify `command`, `args`, and `cwd` are correct

2\. \*\*Test manually:\*\* Run the server command directly to ensure it works

3\. \*\*Check dependencies:\*\* Ensure all required packages are installed

4\. \*\*Review logs:\*\* Look for error messages in the CLI output

5\. \*\*Verify permissions:\*\* Ensure the CLI can execute the server command



\#### No Tools Discovered



\*\*Symptoms:\*\* Server connects but no tools are available



\*\*Troubleshooting:\*\*



1\. \*\*Verify tool registration:\*\* Ensure your server actually registers tools

2\. \*\*Check MCP protocol:\*\* Confirm your server implements the MCP tool listing

&nbsp;  correctly

3\. \*\*Review server logs:\*\* Check stderr output for server-side errors

4\. \*\*Test tool listing:\*\* Manually test your server's tool discovery endpoint



\#### Tools Not Executing



\*\*Symptoms:\*\* Tools are discovered but fail during execution



\*\*Troubleshooting:\*\*



1\. \*\*Parameter validation:\*\* Ensure your tool accepts the expected parameters

2\. \*\*Schema compatibility:\*\* Verify your input schemas are valid JSON Schema

3\. \*\*Error handling:\*\* Check if your tool is throwing unhandled exceptions

4\. \*\*Timeout issues:\*\* Consider increasing the `timeout` setting



\#### Sandbox Compatibility



\*\*Symptoms:\*\* MCP servers fail when sandboxing is enabled



\*\*Solutions:\*\*



1\. \*\*Docker-based servers:\*\* Use Docker containers that include all dependencies

2\. \*\*Path accessibility:\*\* Ensure server executables are available in the

&nbsp;  sandbox

3\. \*\*Network access:\*\* Configure sandbox to allow necessary network connections

4\. \*\*Environment variables:\*\* Verify required environment variables are passed

&nbsp;  through



\### Debugging Tips



1\. \*\*Enable debug mode:\*\* Run the CLI with `--debug` for verbose output

2\. \*\*Check stderr:\*\* MCP server stderr is captured and logged (INFO messages

&nbsp;  filtered)

3\. \*\*Test isolation:\*\* Test your MCP server independently before integrating

4\. \*\*Incremental setup:\*\* Start with simple tools before adding complex

&nbsp;  functionality

5\. \*\*Use `/mcp` frequently:\*\* Monitor server status during development



\## Important Notes



\### Security Considerations



\- \*\*Trust settings:\*\* The `trust` option bypasses all confirmation dialogs. Use

&nbsp; cautiously and only for servers you completely control

\- \*\*Access tokens:\*\* Be security-aware when configuring environment variables

&nbsp; containing API keys or tokens

\- \*\*Sandbox compatibility:\*\* When using sandboxing, ensure MCP servers are

&nbsp; available within the sandbox environment

\- \*\*Private data:\*\* Using broadly scoped personal access tokens can lead to

&nbsp; information leakage between repositories



\### Performance and Resource Management



\- \*\*Connection persistence:\*\* The CLI maintains persistent connections to

&nbsp; servers that successfully register tools

\- \*\*Automatic cleanup:\*\* Connections to servers providing no tools are

&nbsp; automatically closed

\- \*\*Timeout management:\*\* Configure appropriate timeouts based on your server's

&nbsp; response characteristics

\- \*\*Resource monitoring:\*\* MCP servers run as separate processes and consume

&nbsp; system resources



\### Schema Compatibility



\- \*\*Property stripping:\*\* The system automatically removes certain schema

&nbsp; properties (`$schema`, `additionalProperties`) for Gemini API compatibility

\- \*\*Name sanitization:\*\* Tool names are automatically sanitized to meet API

&nbsp; requirements

\- \*\*Conflict resolution:\*\* Tool name conflicts between servers are resolved

&nbsp; through automatic prefixing



This comprehensive integration makes MCP servers a powerful way to extend the

Gemini CLI's capabilities while maintaining security, reliability, and ease of

use.



\## Returning Rich Content from Tools



MCP tools are not limited to returning simple text. You can return rich,

multi-part content, including text, images, audio, and other binary data in a

single tool response. This allows you to build powerful tools that can provide

diverse information to the model in a single turn.



All data returned from the tool is processed and sent to the model as context

for its next generation, enabling it to reason about or summarize the provided

information.



\### How It Works



To return rich content, your tool's response must adhere to the MCP

specification for a

\[`CallToolResult`](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#tool-result).

The `content` field of the result should be an array of `ContentBlock` objects.

The Gemini CLI will correctly process this array, separating text from binary

data and packaging it for the model.



You can mix and match different content block types in the `content` array. The

supported block types include:



\- `text`

\- `image`

\- `audio`

\- `resource` (embedded content)

\- `resource\_link`



\### Example: Returning Text and an Image



Here is an example of a valid JSON response from an MCP tool that returns both a

text description and an image:



```json

{

&nbsp; "content": \[

&nbsp;   {

&nbsp;     "type": "text",

&nbsp;     "text": "Here is the logo you requested."

&nbsp;   },

&nbsp;   {

&nbsp;     "type": "image",

&nbsp;     "data": "BASE64\_ENCODED\_IMAGE\_DATA\_HERE",

&nbsp;     "mimeType": "image/png"

&nbsp;   },

&nbsp;   {

&nbsp;     "type": "text",

&nbsp;     "text": "The logo was created in 2025."

&nbsp;   }

&nbsp; ]

}

```



When the Gemini CLI receives this response, it will:



1\.  Extract all the text and combine it into a single `functionResponse` part

&nbsp;   for the model.

2\.  Present the image data as a separate `inlineData` part.

3\.  Provide a clean, user-friendly summary in the CLI, indicating that both text

&nbsp;   and an image were received.



This enables you to build sophisticated tools that can provide rich, multi-modal

context to the Gemini model.



\## MCP Prompts as Slash Commands



In addition to tools, MCP servers can expose predefined prompts that can be

executed as slash commands within the Gemini CLI. This allows you to create

shortcuts for common or complex queries that can be easily invoked by name.



\### Defining Prompts on the Server



Here's a small example of a stdio MCP server that defines prompts:



```ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { z } from 'zod';



const server = new McpServer({

&nbsp; name: 'prompt-server',

&nbsp; version: '1.0.0',

});



server.registerPrompt(

&nbsp; 'poem-writer',

&nbsp; {

&nbsp;   title: 'Poem Writer',

&nbsp;   description: 'Write a nice haiku',

&nbsp;   argsSchema: { title: z.string(), mood: z.string().optional() },

&nbsp; },

&nbsp; ({ title, mood }) => ({

&nbsp;   messages: \[

&nbsp;     {

&nbsp;       role: 'user',

&nbsp;       content: {

&nbsp;         type: 'text',

&nbsp;         text: `Write a haiku${mood ? ` with the mood ${mood}` : ''} called ${title}. Note that a haiku is 5 syllables followed by 7 syllables followed by 5 syllables `,

&nbsp;       },

&nbsp;     },

&nbsp;   ],

&nbsp; }),

);



const transport = new StdioServerTransport();

await server.connect(transport);

```



This can be included in `settings.json` under `mcpServers` with:



```json

{

&nbsp; "mcpServers": {

&nbsp;   "nodeServer": {

&nbsp;     "command": "node",

&nbsp;     "args": \["filename.ts"]

&nbsp;   }

&nbsp; }

}

```



\### Invoking Prompts



Once a prompt is discovered, you can invoke it using its name as a slash

command. The CLI will automatically handle parsing arguments.



```bash

/poem-writer --title="Gemini CLI" --mood="reverent"

```



or, using positional arguments:



```bash

/poem-writer "Gemini CLI" reverent

```



When you run this command, the Gemini CLI executes the `prompts/get` method on

the MCP server with the provided arguments. The server is responsible for

substituting the arguments into the prompt template and returning the final

prompt text. The CLI then sends this prompt to the model for execution. This

provides a convenient way to automate and share common workflows.



\## Managing MCP Servers with `gemini mcp`



While you can always configure MCP servers by manually editing your

`settings.json` file, the Gemini CLI provides a convenient set of commands to

manage your server configurations programmatically. These commands streamline

the process of adding, listing, and removing MCP servers without needing to

directly edit JSON files.



\### Adding a Server (`gemini mcp add`)



The `add` command configures a new MCP server in your `settings.json`. Based on

the scope (`-s, --scope`), it will be added to either the user config

`~/.gemini/settings.json` or the project config `.gemini/settings.json` file.



\*\*Command:\*\*



```bash

gemini mcp add \[options] <name> <commandOrUrl> \[args...]

```



\- `<name>`: A unique name for the server.

\- `<commandOrUrl>`: The command to execute (for `stdio`) or the URL (for

&nbsp; `http`/`sse`).

\- `\[args...]`: Optional arguments for a `stdio` command.



\*\*Options (Flags):\*\*



\- `-s, --scope`: Configuration scope (user or project). \[default: "project"]

\- `-t, --transport`: Transport type (stdio, sse, http). \[default: "stdio"]

\- `-e, --env`: Set environment variables (e.g. -e KEY=value).

\- `-H, --header`: Set HTTP headers for SSE and HTTP transports (e.g. -H

&nbsp; "X-Api-Key: abc123" -H "Authorization: Bearer abc123").

\- `--timeout`: Set connection timeout in milliseconds.

\- `--trust`: Trust the server (bypass all tool call confirmation prompts).

\- `--description`: Set the description for the server.

\- `--include-tools`: A comma-separated list of tools to include.

\- `--exclude-tools`: A comma-separated list of tools to exclude.



\#### Adding an stdio server



This is the default transport for running local servers.



```bash

\# Basic syntax

gemini mcp add <name> <command> \[args...]



\# Example: Adding a local server

gemini mcp add -e API\_KEY=123 my-stdio-server /path/to/server arg1 arg2 arg3



\# Example: Adding a local python server

gemini mcp add python-server python server.py --port 8080

```



\#### Adding an HTTP server



This transport is for servers that use the streamable HTTP transport.



```bash

\# Basic syntax

gemini mcp add --transport http <name> <url>



\# Example: Adding an HTTP server

gemini mcp add --transport http http-server https://api.example.com/mcp/



\# Example: Adding an HTTP server with an authentication header

gemini mcp add --transport http --header "Authorization: Bearer abc123" secure-http https://api.example.com/mcp/

```



\#### Adding an SSE server



This transport is for servers that use Server-Sent Events (SSE).



```bash

\# Basic syntax

gemini mcp add --transport sse <name> <url>



\# Example: Adding an SSE server

gemini mcp add --transport sse sse-server https://api.example.com/sse/



\# Example: Adding an SSE server with an authentication header

gemini mcp add --transport sse --header "Authorization: Bearer abc123" secure-sse https://api.example.com/sse/

```



\### Listing Servers (`gemini mcp list`)



To view all MCP servers currently configured, use the `list` command. It

displays each server's name, configuration details, and connection status.



\*\*Command:\*\*



```bash

gemini mcp list

```



\*\*Example Output:\*\*



```sh

✓ stdio-server: command: python3 server.py (stdio) - Connected

✓ http-server: https://api.example.com/mcp (http) - Connected

✗ sse-server: https://api.example.com/sse (sse) - Disconnected

```



\### Removing a Server (`gemini mcp remove`)



To delete a server from your configuration, use the `remove` command with the

server's name.



\*\*Command:\*\*



```bash

gemini mcp remove <name>

```



\*\*Example:\*\*



```bash

gemini mcp remove my-server

```



This will find and delete the "my-server" entry from the `mcpServers` object in

the appropriate `settings.json` file based on the scope (`-s, --scope`).



\# Package Overview



This monorepo contains two main packages: `@google/gemini-cli` and

`@google/gemini-cli-core`.



\## `@google/gemini-cli`



This is the main package for the Gemini CLI. It is responsible for the user

interface, command parsing, and all other user-facing functionality.



When this package is published, it is bundled into a single executable file.

This bundle includes all of the package's dependencies, including

`@google/gemini-cli-core`. This means that whether a user installs the package

with `npm install -g @google/gemini-cli` or runs it directly with

`npx @google/gemini-cli`, they are using this single, self-contained executable.



\## `@google/gemini-cli-core`



This package contains the core logic for interacting with the Gemini API. It is

responsible for making API requests, handling authentication, and managing the

local cache.



This package is not bundled. When it is published, it is published as a standard

Node.js package with its own dependencies. This allows it to be used as a

standalone package in other projects, if needed. All transpiled js code in the

`dist` folder is included in the package.



\## NPM Workspaces



This project uses

\[NPM Workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) to manage

the packages within this monorepo. This simplifies development by allowing us to

manage dependencies and run scripts across multiple packages from the root of

the project.



\### How it Works



The root `package.json` file defines the workspaces for this project:



```json

{

&nbsp; "workspaces": \["packages/\*"]

}

```



This tells NPM that any folder inside the `packages` directory is a separate

package that should be managed as part of the workspace.



\### Benefits of Workspaces



\- \*\*Simplified Dependency Management\*\*: Running `npm install` from the root of

&nbsp; the project will install all dependencies for all packages in the workspace

&nbsp; and link them together. This means you don't need to run `npm install` in each

&nbsp; package's directory.

\- \*\*Automatic Linking\*\*: Packages within the workspace can depend on each other.

&nbsp; When you run `npm install`, NPM will automatically create symlinks between the

&nbsp; packages. This means that when you make changes to one package, the changes

&nbsp; are immediately available to other packages that depend on it.

\- \*\*Simplified Script Execution\*\*: You can run scripts in any package from the

&nbsp; root of the project using the `--workspace` flag. For example, to run the

&nbsp; `build` script in the `cli` package, you can run

&nbsp; `npm run build --workspace @google/gemini-cli`.



\# Package Overview



This monorepo contains two main packages: `@google/gemini-cli` and

`@google/gemini-cli-core`.



\## `@google/gemini-cli`



This is the main package for the Gemini CLI. It is responsible for the user

interface, command parsing, and all other user-facing functionality.



When this package is published, it is bundled into a single executable file.

This bundle includes all of the package's dependencies, including

`@google/gemini-cli-core`. This means that whether a user installs the package

with `npm install -g @google/gemini-cli` or runs it directly with

`npx @google/gemini-cli`, they are using this single, self-contained executable.



\## `@google/gemini-cli-core`



This package contains the core logic for interacting with the Gemini API. It is

responsible for making API requests, handling authentication, and managing the

local cache.



This package is not bundled. When it is published, it is published as a standard

Node.js package with its own dependencies. This allows it to be used as a

standalone package in other projects, if needed. All transpiled js code in the

`dist` folder is included in the package.



\## NPM Workspaces



This project uses

\[NPM Workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) to manage

the packages within this monorepo. This simplifies development by allowing us to

manage dependencies and run scripts across multiple packages from the root of

the project.



\### How it Works



The root `package.json` file defines the workspaces for this project:



```json

{

&nbsp; "workspaces": \["packages/\*"]

}

```



This tells NPM that any folder inside the `packages` directory is a separate

package that should be managed as part of the workspace.



\### Benefits of Workspaces



\- \*\*Simplified Dependency Management\*\*: Running `npm install` from the root of

&nbsp; the project will install all dependencies for all packages in the workspace

&nbsp; and link them together. This means you don't need to run `npm install` in each

&nbsp; package's directory.

\- \*\*Automatic Linking\*\*: Packages within the workspace can depend on each other.

&nbsp; When you run `npm install`, NPM will automatically create symlinks between the

&nbsp; packages. This means that when you make changes to one package, the changes

&nbsp; are immediately available to other packages that depend on it.

\- \*\*Simplified Script Execution\*\*: You can run scripts in any package from the

&nbsp; root of the project using the `--workspace` flag. For example, to run the

&nbsp; `build` script in the `cli` package, you can run

&nbsp; `npm run build --workspace @google/gemini-cli`.



\# Gemini CLI Changelog



Wondering what's new in Gemini CLI? This document provides key highlights and

notable changes to Gemini CLI.



\## v0.10.0 - Gemini CLI weekly update - 2025-10-13



\- \*\*Polish:\*\* The team has been heads down bug fixing and investing heavily into

&nbsp; polishing existing flows, tools, and interactions.

\- \*\*Interactive Shell Tool calling:\*\* Gemini CLI can now also execute

&nbsp; interactive tools if needed

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/11225) by

&nbsp; \[@galz10](https://github.com/galz10)).

\- \*\*Alt+Key support:\*\* Enables broader support for Alt+Key keyboard shortcuts

&nbsp; across different terminals.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/10767) by

&nbsp; \[@srivatsj](https://github.com/srivatsj)).

\- \*\*Telemetry Diff stats:\*\* Track line changes made by the model and user during

&nbsp; file operations via OTEL.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/10819) by

&nbsp; \[@jerop](https://github.com/jerop)).



\## v0.9.0 - Gemini CLI weekly update - 2025-10-06



\- 🎉 \*\*Interactive Shell:\*\* Run interactive commands like `vim`, `rebase -i`, or

&nbsp; even `gemini` 😎 directly in Gemini CLI:

&nbsp; - Blog:

&nbsp;   \[https://developers.googleblog.com/en/say-hello-to-a-new-level-of-interactivity-in-gemini-cli/](https://developers.googleblog.com/en/say-hello-to-a-new-level-of-interactivity-in-gemini-cli/)

\- \*\*Install pre-release extensions:\*\* Install the latest `--pre-release`

&nbsp; versions of extensions. Used for when an extension’s release hasn’t been

&nbsp; marked as "latest".

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/10752) by

&nbsp; \[@jakemac53](https://github.com/jakemac53))

\- \*\*Simplified extension creation:\*\* Create a new, empty extension. Templates

&nbsp; are no longer required.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/10629) by

&nbsp; \[@chrstnb](https://github.com/chrstnb))

\- \*\*OpenTelemetry GenAI metrics:\*\* Aligns telemetry with industry-standard

&nbsp; semantic conventions for improved interoperability.

&nbsp; (\[spec](https://opentelemetry.io/docs/concepts/semantic-conventions/),

&nbsp; \[pr](https://github.com/google-gemini/gemini-cli/pull/10343) by

&nbsp; \[@jerop](https://github.com/jerop))

\- \*\*List memory files:\*\* Quickly find the location of your long-term memory

&nbsp; files with `/memory list`.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/10108) by

&nbsp; \[@sgnagnarella](https://github.com/sgnagnarella))



\## v0.8.0 - Gemini CLI weekly update - 2025-09-29



\- 🎉 \*\*Announcing Gemini CLI Extensions\*\* 🎉

&nbsp; - Completely customize your Gemini CLI experience to fit your workflow.

&nbsp; - Build and share your own Gemini CLI extensions with the world.

&nbsp; - Launching with a growing catalog of community, partner, and Google-built

&nbsp;   extensions.

&nbsp;   - Check extensions from

&nbsp;     \[key launch partners](https://github.com/google-gemini/gemini-cli/discussions/10718).

&nbsp; - Easy install:

&nbsp;   - `gemini extensions install <github url|folder path>`

&nbsp; - Easy management:

&nbsp;   - `gemini extensions install|uninstall|link`

&nbsp;   - `gemini extensions enable|disable`

&nbsp;   - `gemini extensions list|update|new`

&nbsp; - Or use commands while running with `/extensions list|update`.

&nbsp; - Everything you need to know:

&nbsp;   \[Now open for building: Introducing Gemini CLI extensions](https://blog.google/technology/developers/gemini-cli-extensions/).

\- 🎉 \*\*Our New Home Page \& Better Documentation\*\* 🎉

&nbsp; - Check out our new home page for better getting started material, reference

&nbsp;   documentation, extensions and more!

&nbsp; - \_Homepage:\_ \[https://geminicli.com](https://geminicli.com)

&nbsp; - ‼️\*NEW documentation:\*

&nbsp;   \[https://geminicli.com/docs](https://geminicli.com/docs) (Have any

&nbsp;   \[suggestions](https://github.com/google-gemini/gemini-cli/discussions/8722)?)

&nbsp; - \_Extensions:\_

&nbsp;   \[https://geminicli.com/extensions](https://geminicli.com/extensions)

\- \*\*Non-Interactive Allowed Tools:\*\* `--allowed-tools` will now also work in

&nbsp; non-interactive mode.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/9114) by

&nbsp; \[@mistergarrison](https://github.com/mistergarrison))

\- \*\*Terminal Title Status:\*\* See the CLI's real-time status and thoughts

&nbsp; directly in the terminal window's title by setting `showStatusInTitle: true`.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/4386) by

&nbsp; \[@Fridayxiao](https://github.com/Fridayxiao))

\- \*\*Small features, polish, reliability \& bug fixes:\*\* A large amount of

&nbsp; changes, smaller features, UI updates, reliability and bug fixes + general

&nbsp; polish made it in this week!



\## v0.7.0 - Gemini CLI weekly update - 2025-09-22



\- 🎉\*\*Build your own Gemini CLI IDE plugin:\*\* We've published a spec for

&nbsp; creating IDE plugins to enable rich context-aware experiences and native

&nbsp; in-editor diffing in your IDE of choice.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/8479) by

&nbsp; \[@skeshive](https://github.com/skeshive))

\- 🎉 \*\*Gemini CLI extensions\*\*

&nbsp; - \*\*Flutter:\*\* An early version to help you create, build, test, and run

&nbsp;   Flutter apps with Gemini CLI

&nbsp;   (\[extension](https://github.com/gemini-cli-extensions/flutter))

&nbsp; - \*\*nanobanana:\*\* Integrate nanobanana into Gemini CLI

&nbsp;   (\[extension](https://github.com/gemini-cli-extensions/nanobanana))

\- \*\*Telemetry config via environment:\*\* Manage telemetry settings using

&nbsp; environment variables for a more flexible setup.

&nbsp; (\[docs](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/telemetry.md#configuration),

&nbsp; \[pr](https://github.com/google-gemini/gemini-cli/pull/9113) by

&nbsp; \[@jerop](https://github.com/jerop))

\- \*\*​​Experimental todos:\*\* Track and display progress on complex tasks with a

&nbsp; managed checklist. Off by default but can be enabled via

&nbsp; `"useWriteTodos": true`

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/8761) by

&nbsp; \[@anj-s](https://github.com/anj-s))

\- \*\*Share chat support for tools:\*\* Using `/chat share` will now also render

&nbsp; function calls and responses in the final markdown file.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/8693) by

&nbsp; \[@rramkumar1](https://github.com/rramkumar1))

\- \*\*Citations:\*\* Now enabled for all users

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/8570) by

&nbsp; \[@scidomino](https://github.com/scidomino))

\- \*\*Custom commands in Headless Mode:\*\* Run custom slash commands directly from

&nbsp; the command line in non-interactive mode: `gemini "/joke Chuck Norris"`

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/8305) by

&nbsp; \[@capachino](https://github.com/capachino))

\- \*\*Small features, polish, reliability \& bug fixes:\*\* A large amount of

&nbsp; changes, smaller features, UI updates, reliability and bug fixes + general

&nbsp; polish made it in this week!



\## v0.6.0 - Gemini CLI weekly update - 2025-09-15



\- 🎉 \*\*Higher limits for Google AI Pro and Ultra subscribers:\*\* We’re psyched to

&nbsp; finally announce that Google AI Pro and AI Ultra subscribers now get access to

&nbsp; significantly higher 2.5 quota limits for Gemini CLI!

&nbsp; - \*\*Announcement:\*\*

&nbsp;   \[https://blog.google/technology/developers/gemini-cli-code-assist-higher-limits/](https://blog.google/technology/developers/gemini-cli-code-assist-higher-limits/)

\- 🎉\*\*Gemini CLI Databases and BigQuery Extensions:\*\* Connect Gemini CLI to all

&nbsp; of your cloud data with Gemini CLI.

&nbsp; - Announcement and how to get started with each of the below extensions:

&nbsp;   \[https://cloud.google.com/blog/products/databases/gemini-cli-extensions-for-google-data-cloud?e=48754805](https://cloud.google.com/blog/products/databases/gemini-cli-extensions-for-google-data-cloud?e=48754805)

&nbsp; - \*\*AlloyDB:\*\* Interact, manage and observe AlloyDB for PostgreSQL databases

&nbsp;   (\[manage](https://github.com/gemini-cli-extensions/alloydb#configuration),

&nbsp;   \[observe](https://github.com/gemini-cli-extensions/alloydb-observability#configuration))

&nbsp; - \*\*BigQuery:\*\* Connect and query your BigQuery datasets or utilize a

&nbsp;   sub-agent for contextual insights

&nbsp;   (\[query](https://github.com/gemini-cli-extensions/bigquery-data-analytics#configuration),

&nbsp;   \[sub-agent](https://github.com/gemini-cli-extensions/bigquery-conversational-analytics))

&nbsp; - \*\*Cloud SQL:\*\* Interact, manage and observe Cloud SQL for PostgreSQL

&nbsp;   (\[manage](https://github.com/gemini-cli-extensions/cloud-sql-postgresql#configuration),\[ observe](https://github.com/gemini-cli-extensions/cloud-sql-postgresql-observability#configuration)),

&nbsp;   Cloud SQL for MySQL

&nbsp;   (\[manage](https://github.com/gemini-cli-extensions/cloud-sql-mysql#configuration),\[ observe](https://github.com/gemini-cli-extensions/cloud-sql-mysql-observability#configuration))

&nbsp;   and Cloud SQL for SQL Server

&nbsp;   (\[manage](https://github.com/gemini-cli-extensions/cloud-sql-sqlserver#configuration),\[ observe](https://github.com/gemini-cli-extensions/cloud-sql-sqlserver-observability#configuration))

&nbsp;   databases.

&nbsp; - \*\*Dataplex:\*\* Discover, manage, and govern data and AI artifacts

&nbsp;   (\[extension](https://github.com/gemini-cli-extensions/dataplex#configuration))

&nbsp; - \*\*Firestore:\*\* Interact with Firestore databases, collections and documents

&nbsp;   (\[extension](https://github.com/gemini-cli-extensions/firestore-native#configuration))

&nbsp; - \*\*Looker:\*\* Query data, run Looks and create dashboards

&nbsp;   (\[extension](https://github.com/gemini-cli-extensions/looker#configuration))

&nbsp; - \*\*MySQL:\*\* Interact with MySQL databases

&nbsp;   (\[extension](https://github.com/gemini-cli-extensions/mysql#configuration))

&nbsp; - \*\*Postgres:\*\* Interact with PostgreSQL databases

&nbsp;   (\[extension](https://github.com/gemini-cli-extensions/postgres#configuration))

&nbsp; - \*\*Spanner:\*\* Interact with Spanner databases

&nbsp;   (\[extension](https://github.com/gemini-cli-extensions/spanner#configuration))

&nbsp; - \*\*SQL Server:\*\* Interact with SQL Server databases

&nbsp;   (\[extension](https://github.com/gemini-cli-extensions/sql-server#configuration))

&nbsp; - \*\*MCP Toolbox:\*\* Configure and load custom tools for more than 30+ data

&nbsp;   sources

&nbsp;   (\[extension](https://github.com/gemini-cli-extensions/mcp-toolbox#configuration))

\- \*\*JSON output mode:\*\* Have Gemini CLI output JSON with `--output-format json`

&nbsp; when invoked headlessly for easy parsing and post-processing. Includes

&nbsp; response, stats and errors.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/8119) by

&nbsp; \[@jerop](https://github.com/jerop))

\- \*\*Keybinding triggered approvals:\*\* When you use shortcuts (`shift+y` or

&nbsp; `shift+tab`) to activate YOLO/auto-edit modes any pending confirmation dialogs

&nbsp; will now approve. (\[pr](https://github.com/google-gemini/gemini-cli/pull/6665)

&nbsp; by \[@bulkypanda](https://github.com/bulkypanda))

\- \*\*Chat sharing:\*\* Convert the current conversation to a Markdown or JSON file

&nbsp; with \_/chat share \&lt;file.md|file.json>\_

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/8139) by

&nbsp; \[@rramkumar1](https://github.com/rramkumar1))

\- \*\*Prompt search:\*\* Search your prompt history using `ctrl+r`.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/5539) by

&nbsp; \[@Aisha630](https://github.com/Aisha630))

\- \*\*Input undo/redo:\*\* Recover accidentally deleted text in the input prompt

&nbsp; using `ctrl+z` (undo) and `ctrl+shift+z` (redo).

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/4625) by

&nbsp; \[@masiafrest](https://github.com/masiafrest))

\- \*\*Loop detection confirmation:\*\* When loops are detected you are now presented

&nbsp; with a dialog to disable detection for the current session.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/8231) by

&nbsp; \[@SandyTao520](https://github.com/SandyTao520))

\- \*\*Direct to Google Cloud Telemetry:\*\* Directly send telemetry to Google Cloud

&nbsp; for a simpler and more streamlined setup.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/8541) by

&nbsp; \[@jerop](https://github.com/jerop))

\- \*\*Visual Mode Indicator Revamp:\*\* ‘shell’, 'accept edits' and 'yolo' modes now

&nbsp; have colors to match their impact / usage. Input box now also updates.

&nbsp; (\[shell](https://imgur.com/a/DovpVF1),

&nbsp; \[accept-edits](https://imgur.com/a/33KDz3J),

&nbsp; \[yolo](https://imgur.com/a/tbFwIWp),

&nbsp; \[pr](https://github.com/google-gemini/gemini-cli/pull/8200) by

&nbsp; \[@miguelsolorio](https://github.com/miguelsolorio))

\- \*\*Small features, polish, reliability \& bug fixes:\*\* A large amount of

&nbsp; changes, smaller features, UI updates, reliability and bug fixes + general

&nbsp; polish made it in this week!



\## v0.5.0 - Gemini CLI weekly update - 2025-09-08



\- 🎉\*\*FastMCP + Gemini CLI\*\*🎉: Quickly install and manage your Gemini CLI MCP

&nbsp; servers with FastMCP (\[video](https://imgur.com/a/m8QdCPh),

&nbsp; \[pr](https://github.com/jlowin/fastmcp/pull/1709) by

&nbsp; \[@jackwotherspoon](https://github.com/jackwotherspoon)\*\*)\*\*

&nbsp; - Getting started:

&nbsp;   \[https://gofastmcp.com/integrations/gemini-cli](https://gofastmcp.com/integrations/gemini-cli)

\- \*\*Positional Prompt for Non-Interactive:\*\* Seamlessly invoke Gemini CLI

&nbsp; headlessly via `gemini "Hello"`. Synonymous with passing `-p`.

&nbsp; (\[gif](https://imgur.com/a/hcBznpB),

&nbsp; \[pr](https://github.com/google-gemini/gemini-cli/pull/7668) by

&nbsp; \[@allenhutchison](https://github.com/allenhutchison))

\- \*\*Experimental Tool output truncation:\*\* Enable truncating shell tool outputs

&nbsp; and saving full output to a file by setting

&nbsp; `"enableToolOutputTruncation": true `(\[pr](https://github.com/google-gemini/gemini-cli/pull/8039)

&nbsp; by \[@SandyTao520](https://github.com/SandyTao520))

\- \*\*Edit Tool improvements:\*\* Gemini CLI’s ability to edit files should now be

&nbsp; far more capable. (\[pr](https://github.com/google-gemini/gemini-cli/pull/7679)

&nbsp; by \[@silviojr](https://github.com/silviojr))

\- \*\*Custom witty messages:\*\* The feature you’ve all been waiting for…

&nbsp; Personalized witty loading messages via

&nbsp; `"ui": { "customWittyPhrases": \["YOLO"]}` in `settings.json`.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/7641) by

&nbsp; \[@JayadityaGit](https://github.com/JayadityaGit))

\- \*\*Nested .gitignore File Handling:\*\* Nested `.gitignore` files are now

&nbsp; respected. (\[pr](https://github.com/google-gemini/gemini-cli/pull/7645) by

&nbsp; \[@gsquared94](https://github.com/gsquared94))

\- \*\*Enforced authentication:\*\* System administrators can now mandate a specific

&nbsp; authentication method via

&nbsp; `"enforcedAuthType": "oauth-personal|gemini-api-key|…"`in `settings.json`.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/6564) by

&nbsp; \[@chrstnb](https://github.com/chrstnb))

\- \*\*A2A development-tool extension:\*\* An RFC for an Agent2Agent

&nbsp; (\[A2A](https://a2a-protocol.org/latest/)) powered extension for developer tool

&nbsp; use cases.

&nbsp; (\[feedback](https://github.com/google-gemini/gemini-cli/discussions/7822),

&nbsp; \[pr](https://github.com/google-gemini/gemini-cli/pull/7817) by

&nbsp; \[@skeshive](https://github.com/skeshive))

\- \*\*Hands on Codelab:

&nbsp; \*\*\[https://codelabs.developers.google.com/gemini-cli-hands-on](https://codelabs.developers.google.com/gemini-cli-hands-on)

\- \*\*Small features, polish, reliability \& bug fixes:\*\* A large amount of

&nbsp; changes, smaller features, UI updates, reliability and bug fixes + general

&nbsp; polish made it in this week!



\## v0.4.0 - Gemini CLI weekly update - 2025-09-01



\- 🎉\*\*Gemini CLI CloudRun and Security Integrations\*\*🎉: Automate app deployment

&nbsp; and security analysis with CloudRun and Security extension integrations. Once

&nbsp; installed deploy your app to the cloud with `/deploy` and find and fix

&nbsp; security vulnerabilities with `/security:analyze`.

&nbsp; - Announcement and how to get started:

&nbsp;   \[https://cloud.google.com/blog/products/ai-machine-learning/automate-app-deployment-and-security-analysis-with-new-gemini-cli-extensions](https://cloud.google.com/blog/products/ai-machine-learning/automate-app-deployment-and-security-analysis-with-new-gemini-cli-extensions)

\- \*\*Experimental\*\*

&nbsp; - \*\*Edit Tool:\*\* Give our new edit tool a try by setting

&nbsp;   `"useSmartEdit": true` in `settings.json`!

&nbsp;   (\[feedback](https://github.com/google-gemini/gemini-cli/discussions/7758),

&nbsp;   \[pr](https://github.com/google-gemini/gemini-cli/pull/6823) by

&nbsp;   \[@silviojr](https://github.com/silviojr))

&nbsp; - \*\*Model talking to itself fix:\*\* We’ve removed a model workaround that would

&nbsp;   encourage Gemini CLI to continue conversations on your behalf. This may be

&nbsp;   disruptive and can be disabled via `"skipNextSpeakerCheck": false` in your

&nbsp;   `settings.json`

&nbsp;   (\[feedback](https://github.com/google-gemini/gemini-cli/discussions/6666),

&nbsp;   \[pr](https://github.com/google-gemini/gemini-cli/pull/7614) by

&nbsp;   \[@SandyTao520](https://github.com/SandyTao520))

&nbsp; - \*\*Prompt completion:\*\* Get real-time AI suggestions to complete your prompts

&nbsp;   as you type. Enable it with `"general": { "enablePromptCompletion": true }`

&nbsp;   and share your feedback!

&nbsp;   (\[gif](https://miro.medium.com/v2/resize:fit:2000/format:webp/1\*hvegW7YXOg6N\_beUWhTdxA.gif),

&nbsp;   \[pr](https://github.com/google-gemini/gemini-cli/pull/4691) by

&nbsp;   \[@3ks](https://github.com/3ks))

\- \*\*Footer visibility configuration:\*\* Customize the CLI's footer look and feel

&nbsp; in `settings.json`

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/7419) by

&nbsp; \[@miguelsolorio](https://github.com/miguelsolorio))

&nbsp; - `hideCWD`: hide current working directory.

&nbsp; - `hideSandboxStatus`: hide sandbox status.

&nbsp; - `hideModelInfo`: hide current model information.

&nbsp; - `hideContextSummary`: hide request context summary.

\- \*\*Citations:\*\* For enterprise Code Assist licenses users will now see

&nbsp; citations in their responses by default. Enable this yourself with

&nbsp; `"showCitations": true`

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/7350) by

&nbsp; \[@scidomino](https://github.com/scidomino))

\- \*\*Pro Quota Dialog:\*\* Handle daily Pro model usage limits with an interactive

&nbsp; dialog that lets you immediately switch auth or fallback.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/7094) by

&nbsp; \[@JayadityaGit](https://github.com/JayadityaGit))

\- \*\*Custom commands @:\*\* Embed local file or directory content directly into

&nbsp; your custom command prompts using `@{path}` syntax

&nbsp; (\[gif](https://miro.medium.com/v2/resize:fit:2000/format:webp/1\*GosBAo2SjMfFffAnzT7ZMg.gif),

&nbsp; \[pr](https://github.com/google-gemini/gemini-cli/pull/6716) by

&nbsp; \[@abhipatel12](https://github.com/abhipatel12))

\- \*\*2.5 Flash Lite support:\*\* You can now use the `gemini-2.5-flash-lite` model

&nbsp; for Gemini CLI via `gemini -m …`.

&nbsp; (\[gif](https://miro.medium.com/v2/resize:fit:2000/format:webp/1\*P4SKwnrsyBuULoHrFqsFKQ.gif),

&nbsp; \[pr](https://github.com/google-gemini/gemini-cli/pull/4652) by

&nbsp; \[@psinha40898](https://github.com/psinha40898))

\- \*\*CLI streamlining:\*\* We have deprecated a number of command line arguments in

&nbsp; favor of `settings.json` alternatives. We will remove these arguments in a

&nbsp; future release. See the PR for the full list of deprecations.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/7360) by

&nbsp; \[@allenhutchison](https://github.com/allenhutchison))

\- \*\*JSON session summary:\*\* Track and save detailed CLI session statistics to a

&nbsp; JSON file for performance analysis with `--session-summary <path>`

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/7347) by

&nbsp; \[@leehagoodjames](https://github.com/leehagoodjames))

\- \*\*Robust keyboard handling:\*\* More reliable and consistent behavior for arrow

&nbsp; keys, special keys (Home, End, etc.), and modifier combinations across various

&nbsp; terminals. (\[pr](https://github.com/google-gemini/gemini-cli/pull/7118) by

&nbsp; \[@deepankarsharma](https://github.com/deepankarsharma))

\- \*\*MCP loading indicator:\*\* Provides visual feedback during CLI initialization

&nbsp; when connecting to multiple servers.

&nbsp; (\[pr](https://github.com/google-gemini/gemini-cli/pull/6923) by

&nbsp; \[@swissspidy](https://github.com/swissspidy))

\- \*\*Small features, polish, reliability \& bug fixes:\*\* A large amount of

&nbsp; changes, smaller features, UI updates, reliability and bug fixes + general

&nbsp; polish made it in this week!



\# Integration Tests



This document provides information about the integration testing framework used

in this project.



\## Overview



The integration tests are designed to validate the end-to-end functionality of

the Gemini CLI. They execute the built binary in a controlled environment and

verify that it behaves as expected when interacting with the file system.



These tests are located in the `integration-tests` directory and are run using a

custom test runner.



\## Building the tests



Prior to running any integration tests, you need to create a release bundle that

you want to actually test:



```bash

npm run bundle

```



You must re-run this command after making any changes to the CLI source code,

but not after making changes to tests.



\## Running the tests



The integration tests are not run as part of the default `npm run test` command.

They must be run explicitly using the `npm run test:integration:all` script.



The integration tests can also be run using the following shortcut:



```bash

npm run test:e2e

```



\## Running a specific set of tests



To run a subset of test files, you can use

`npm run <integration test command> <file\_name1> ....` where \&lt;integration

test command\&gt; is either `test:e2e` or `test:integration\*` and `<file\_name>`

is any of the `.test.js` files in the `integration-tests/` directory. For

example, the following command runs `list\_directory.test.js` and

`write\_file.test.js`:



```bash

npm run test:e2e list\_directory write\_file

```



\### Running a single test by name



To run a single test by its name, use the `--test-name-pattern` flag:



```bash

npm run test:e2e -- --test-name-pattern "reads a file"

```



\### Regenerating model responses



Some integration tests use faked out model responses, which may need to be

regenerated from time to time as the implementations change.



To regenerate these golden files, set the REGENERATE\_MODEL\_GOLDENS environment

variable to "true" when running the tests, for example:



\*\*WARNING\*\*: If running locally you should review these updated responses for

any information about yourself or your system that gemini may have included in

these responses.



```bash

REGENERATE\_MODEL\_GOLDENS="true" npm run test:e2e

```



\### Deflaking a test



Before adding a \*\*new\*\* integration test, you should test it at least 5 times

with the deflake script or workflow to make sure that it is not flaky.



\### Deflake script



```bash

npm run deflake -- --runs=5 --command="npm run test:e2e -- -- --test-name-pattern '<your-new-test-name>'"

```



\#### Deflake Workflow



```bash

gh workflow run deflake.yml --ref <your-branch> -f test\_name\_pattern="<your-test-name-pattern>"

```



\### Running all tests



To run the entire suite of integration tests, use the following command:



```bash

npm run test:integration:all

```



\### Sandbox matrix



The `all` command will run tests for `no sandboxing`, `docker` and `podman`.

Each individual type can be run using the following commands:



```bash

npm run test:integration:sandbox:none

```



```bash

npm run test:integration:sandbox:docker

```



```bash

npm run test:integration:sandbox:podman

```



\## Diagnostics



The integration test runner provides several options for diagnostics to help

track down test failures.



\### Keeping test output



You can preserve the temporary files created during a test run for inspection.

This is useful for debugging issues with file system operations.



To keep the test output set the `KEEP\_OUTPUT` environment variable to `true`.



```bash

KEEP\_OUTPUT=true npm run test:integration:sandbox:none

```



When output is kept, the test runner will print the path to the unique directory

for the test run.



\### Verbose output



For more detailed debugging, set the `VERBOSE` environment variable to `true`.



```bash

VERBOSE=true npm run test:integration:sandbox:none

```



When using `VERBOSE=true` and `KEEP\_OUTPUT=true` in the same command, the output

is streamed to the console and also saved to a log file within the test's

temporary directory.



The verbose output is formatted to clearly identify the source of the logs:



```

--- TEST: <log dir>:<test-name> ---

... output from the gemini command ...

--- END TEST: <log dir>:<test-name> ---

```



\## Linting and formatting



To ensure code quality and consistency, the integration test files are linted as

part of the main build process. You can also manually run the linter and

auto-fixer.



\### Running the linter



To check for linting errors, run the following command:



```bash

npm run lint

```



You can include the `:fix` flag in the command to automatically fix any fixable

linting errors:



```bash

npm run lint:fix

```



\## Directory structure



The integration tests create a unique directory for each test run inside the

`.integration-tests` directory. Within this directory, a subdirectory is created

for each test file, and within that, a subdirectory is created for each

individual test case.



This structure makes it easy to locate the artifacts for a specific test run,

file, or case.



```

.integration-tests/

└── <run-id>/

&nbsp;   └── <test-file-name>.test.js/

&nbsp;       └── <test-case-name>/

&nbsp;           ├── output.log

&nbsp;           └── ...other test artifacts...

```



\## Continuous integration



To ensure the integration tests are always run, a GitHub Actions workflow is

defined in `.github/workflows/e2e.yml`. This workflow automatically runs the

integrations tests for pull requests against the `main` branch, or when a pull

request is added to a merge queue.



The workflow runs the tests in different sandboxing environments to ensure

Gemini CLI is tested across each:



\- `sandbox:none`: Runs the tests without any sandboxing.

\- `sandbox:docker`: Runs the tests in a Docker container.

\- `sandbox:podman`: Runs the tests in a Podman container.



\# Automation and Triage Processes



This document provides a detailed overview of the automated processes we use to

manage and triage issues and pull requests. Our goal is to provide prompt

feedback and ensure that contributions are reviewed and integrated efficiently.

Understanding this automation will help you as a contributor know what to expect

and how to best interact with our repository bots.



\## Guiding Principle: Issues and Pull Requests



First and foremost, almost every Pull Request (PR) should be linked to a

corresponding Issue. The issue describes the "what" and the "why" (the bug or

feature), while the PR is the "how" (the implementation). This separation helps

us track work, prioritize features, and maintain clear historical context. Our

automation is built around this principle.



---



\## Detailed Automation Workflows



Here is a breakdown of the specific automation workflows that run in our

repository.



\### 1. When you open an Issue: `Automated Issue Triage`



This is the first bot you will interact with when you create an issue. Its job

is to perform an initial analysis and apply the correct labels.



\- \*\*Workflow File\*\*: `.github/workflows/gemini-automated-issue-triage.yml`

\- \*\*When it runs\*\*: Immediately after an issue is created or reopened.

\- \*\*What it does\*\*:

&nbsp; - It uses a Gemini model to analyze the issue's title and body against a

&nbsp;   detailed set of guidelines.

&nbsp; - \*\*Applies one `area/\*` label\*\*: Categorizes the issue into a functional area

&nbsp;   of the project (e.g., `area/ux`, `area/models`, `area/platform`).

&nbsp; - \*\*Applies one `kind/\*` label\*\*: Identifies the type of issue (e.g.,

&nbsp;   `kind/bug`, `kind/enhancement`, `kind/question`).

&nbsp; - \*\*Applies one `priority/\*` label\*\*: Assigns a priority from P0 (critical) to

&nbsp;   P3 (low) based on the described impact.

&nbsp; - \*\*May apply `status/need-information`\*\*: If the issue lacks critical details

&nbsp;   (like logs or reproduction steps), it will be flagged for more information.

&nbsp; - \*\*May apply `status/need-retesting`\*\*: If the issue references a CLI version

&nbsp;   that is more than six versions old, it will be flagged for retesting on a

&nbsp;   current version.

\- \*\*What you should do\*\*:

&nbsp; - Fill out the issue template as completely as possible. The more detail you

&nbsp;   provide, the more accurate the triage will be.

&nbsp; - If the `status/need-information` label is added, please provide the

&nbsp;   requested details in a comment.



\### 2. When you open a Pull Request: `Continuous Integration (CI)`



This workflow ensures that all changes meet our quality standards before they

can be merged.



\- \*\*Workflow File\*\*: `.github/workflows/ci.yml`

\- \*\*When it runs\*\*: On every push to a pull request.

\- \*\*What it does\*\*:

&nbsp; - \*\*Lint\*\*: Checks that your code adheres to our project's formatting and

&nbsp;   style rules.

&nbsp; - \*\*Test\*\*: Runs our full suite of automated tests across macOS, Windows, and

&nbsp;   Linux, and on multiple Node.js versions. This is the most time-consuming

&nbsp;   part of the CI process.

&nbsp; - \*\*Post Coverage Comment\*\*: After all tests have successfully passed, a bot

&nbsp;   will post a comment on your PR. This comment provides a summary of how well

&nbsp;   your changes are covered by tests.

\- \*\*What you should do\*\*:

&nbsp; - Ensure all CI checks pass. A green checkmark ✅ will appear next to your

&nbsp;   commit when everything is successful.

&nbsp; - If a check fails (a red "X" ❌), click the "Details" link next to the failed

&nbsp;   check to view the logs, identify the problem, and push a fix.



\### 3. Ongoing Triage for Pull Requests: `PR Auditing and Label Sync`



This workflow runs periodically to ensure all open PRs are correctly linked to

issues and have consistent labels.



\- \*\*Workflow File\*\*: `.github/workflows/gemini-scheduled-pr-triage.yml`

\- \*\*When it runs\*\*: Every 15 minutes on all open pull requests.

\- \*\*What it does\*\*:

&nbsp; - \*\*Checks for a linked issue\*\*: The bot scans your PR description for a

&nbsp;   keyword that links it to an issue (e.g., `Fixes #123`, `Closes #456`).

&nbsp; - \*\*Adds `status/need-issue`\*\*: If no linked issue is found, the bot will add

&nbsp;   the `status/need-issue` label to your PR. This is a clear signal that an

&nbsp;   issue needs to be created and linked.

&nbsp; - \*\*Synchronizes labels\*\*: If an issue \_is\_ linked, the bot ensures the PR's

&nbsp;   labels perfectly match the issue's labels. It will add any missing labels

&nbsp;   and remove any that don't belong, and it will remove the `status/need-issue`

&nbsp;   label if it was present.

\- \*\*What you should do\*\*:

&nbsp; - \*\*Always link your PR to an issue.\*\* This is the most important step. Add a

&nbsp;   line like `Resolves #<issue-number>` to your PR description.

&nbsp; - This will ensure your PR is correctly categorized and moves through the

&nbsp;   review process smoothly.



\### 4. Ongoing Triage for Issues: `Scheduled Issue Triage`



This is a fallback workflow to ensure that no issue gets missed by the triage

process.



\- \*\*Workflow File\*\*: `.github/workflows/gemini-scheduled-issue-triage.yml`

\- \*\*When it runs\*\*: Every hour on all open issues.

\- \*\*What it does\*\*:

&nbsp; - It actively seeks out issues that either have no labels at all or still have

&nbsp;   the `status/need-triage` label.

&nbsp; - It then triggers the same powerful Gemini-based analysis as the initial

&nbsp;   triage bot to apply the correct labels.

\- \*\*What you should do\*\*:

&nbsp; - You typically don't need to do anything. This workflow is a safety net to

&nbsp;   ensure every issue is eventually categorized, even if the initial triage

&nbsp;   fails.



\### 5. Release Automation



This workflow handles the process of packaging and publishing new versions of

the Gemini CLI.



\- \*\*Workflow File\*\*: `.github/workflows/release-manual.yml`

\- \*\*When it runs\*\*: On a daily schedule for "nightly" releases, and manually for

&nbsp; official patch/minor releases.

\- \*\*What it does\*\*:

&nbsp; - Automatically builds the project, bumps the version numbers, and publishes

&nbsp;   the packages to npm.

&nbsp; - Creates a corresponding release on GitHub with generated release notes.

\- \*\*What you should do\*\*:

&nbsp; - As a contributor, you don't need to do anything for this process. You can be

&nbsp;   confident that once your PR is merged into the `main` branch, your changes

&nbsp;   will be included in the very next nightly release.



We hope this detailed overview is helpful. If you have any questions about our

automation or processes, please don't hesitate to ask!



\# Frequently Asked Questions (FAQ)



This page provides answers to common questions and solutions to frequent

problems encountered while using Gemini CLI.



\## General issues



\### Why am I getting an `API error: 429 - Resource exhausted`?



This error indicates that you have exceeded your API request limit. The Gemini

API has rate limits to prevent abuse and ensure fair usage.



To resolve this, you can:



\- \*\*Check your usage:\*\* Review your API usage in the Google AI Studio or your

&nbsp; Google Cloud project dashboard.

\- \*\*Optimize your prompts:\*\* If you are making many requests in a short period,

&nbsp; try to batch your prompts or introduce delays between requests.

\- \*\*Request a quota increase:\*\* If you consistently need a higher limit, you can

&nbsp; request a quota increase from Google.



\### Why am I getting an `ERR\_REQUIRE\_ESM` error when running `npm run start`?



This error typically occurs in Node.js projects when there is a mismatch between

CommonJS and ES Modules.



This is often due to a misconfiguration in your `package.json` or

`tsconfig.json`. Ensure that:



1\.  Your `package.json` has `"type": "module"`.

2\.  Your `tsconfig.json` has `"module": "NodeNext"` or a compatible setting in

&nbsp;   the `compilerOptions`.



If the problem persists, try deleting your `node\_modules` directory and

`package-lock.json` file, and then run `npm install` again.



\### Why don't I see cached token counts in my stats output?



Cached token information is only displayed when cached tokens are being used.

This feature is available for API key users (Gemini API key or Google Cloud

Vertex AI) but not for OAuth users (such as Google Personal/Enterprise accounts

like Google Gmail or Google Workspace, respectively). This is because the Gemini

Code Assist API does not support cached content creation. You can still view

your total token usage using the `/stats` command in Gemini CLI.



\## Installation and updates



\### How do I update Gemini CLI to the latest version?



If you installed it globally via `npm`, update it using the command

`npm install -g @google/gemini-cli@latest`. If you compiled it from source, pull

the latest changes from the repository, and then rebuild using the command

`npm run build`.



\## Platform-specific issues



\### Why does the CLI crash on Windows when I run a command like `chmod +x`?



Commands like `chmod` are specific to Unix-like operating systems (Linux,

macOS). They are not available on Windows by default.



To resolve this, you can:



\- \*\*Use Windows-equivalent commands:\*\* Instead of `chmod`, you can use `icacls`

&nbsp; to modify file permissions on Windows.

\- \*\*Use a compatibility layer:\*\* Tools like Git Bash or Windows Subsystem for

&nbsp; Linux (WSL) provide a Unix-like environment on Windows where these commands

&nbsp; will work.



\## Configuration



\### How do I configure my `GOOGLE\_CLOUD\_PROJECT`?



You can configure your Google Cloud Project ID using an environment variable.



Set the `GOOGLE\_CLOUD\_PROJECT` environment variable in your shell:



```bash

export GOOGLE\_CLOUD\_PROJECT="your-project-id"

```



To make this setting permanent, add this line to your shell's startup file

(e.g., `~/.bashrc`, `~/.zshrc`).



\### What is the best way to store my API keys securely?



Exposing API keys in scripts or checking them into source control is a security

risk.



To store your API keys securely, you can:



\- \*\*Use a `.env` file:\*\* Create a `.env` file in your project's `.gemini`

&nbsp; directory (`.gemini/.env`) and store your keys there. Gemini CLI will

&nbsp; automatically load these variables.

\- \*\*Use your system's keyring:\*\* For the most secure storage, use your operating

&nbsp; system's secret management tool (like macOS Keychain, Windows Credential

&nbsp; Manager, or a secret manager on Linux). You can then have your scripts or

&nbsp; environment load the key from the secure storage at runtime.



\### Where are the Gemini CLI configuration and settings files stored?



The Gemini CLI configuration is stored in two `settings.json` files:



1\.  In your home directory: `~/.gemini/settings.json`.

2\.  In your project's root directory: `./.gemini/settings.json`.



Refer to \[Gemini CLI Configuration](/docs/get-started/configuration) for more

details.



\## Google AI Pro/Ultra and subscription FAQs



\### Where can I learn more about my Google AI Pro or Google AI Ultra subscription?



To learn more about your Google AI Pro or Google AI Ultra subscription, visit

\*\*Manage subscription\*\* in your \[subscription settings](https://one.google.com).



\### How do I know if I have higher limits for Google AI Pro or Ultra?



If you're subscribed to Google AI Pro or Ultra, you automatically have higher

limits to Gemini Code Assist and Gemini CLI. These are shared across Gemini CLI

and agent mode in the IDE. You can confirm you have higher limits by checking if

you are still subscribed to Google AI Pro or Ultra in your

\[subscription settings](https://one.google.com).



\### What is the privacy policy for using Gemini Code Assist or Gemini CLI if I've subscribed to Google AI Pro or Ultra?



To learn more about your privacy policy and terms of service governed by your

subscription, visit

\[Gemini Code Assist: Terms of Service and Privacy Policies](https://developers.google.com/gemini-code-assist/resources/privacy-notices).



\### I've upgraded to Google AI Pro or Ultra but it still says I am hitting quota limits. Is this a bug?



The higher limits in your Google AI Pro or Ultra subscription are for Gemini 2.5

across both Gemini 2.5 Pro and Flash. They are shared quota across Gemini CLI

and agent mode in Gemini Code Assist IDE extensions. You can learn more about

quota limits for Gemini CLI, Gemini Code Assist and agent mode in Gemini Code

Assist at

\[Quotas and limits](https://developers.google.com/gemini-code-assist/resources/quotas).



\### If I upgrade to higher limits for Gemini CLI and Gemini Code Assist by purchasing a Google AI Pro or Ultra subscription, will Gemini start using my data to improve its machine learning models?



Google does not use your data to improve Google's machine learning models if you

purchase a paid plan. Note: If you decide to remain on the free version of

Gemini Code Assist, Gemini Code Assist for individuals, you can also opt out of

using your data to improve Google's machine learning models. See the

\[Gemini Code Assist for individuals privacy notice](https://developers.google.com/gemini-code-assist/resources/privacy-notice-gemini-code-assist-individuals)

for more information.



\## Not seeing your question?



Search the

\[Gemini CLI Q\&A discussions on GitHub](https://github.com/google-gemini/gemini-cli/discussions/categories/q-a)

or

\[start a new discussion on GitHub](https://github.com/google-gemini/gemini-cli/discussions/new?category=q-a)



https://geminicli.com/docs/

