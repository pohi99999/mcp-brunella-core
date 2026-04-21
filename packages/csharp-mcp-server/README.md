# CsharpMcpServer

Standalone C# MCP server with stdio transport, workspace-scoped file tools, and a reusable review prompt.

## Requirements

- .NET 10.0 or later
- A workspace root to inspect

## Configure

Set the workspace root before you start the server:

```powershell
$env:MCP_WORKSPACE_ROOT = "F:\mcp-brunella-core"
```

If you skip it, the server uses the current working directory.

## Run

```powershell
dotnet run --project src\CsharpMcpServer\CsharpMcpServer.csproj
```

Brunella starts this server through `launch.ps1`, which builds the project quietly and then runs the compiled DLL with `MCP_WORKSPACE_ROOT` set to the repository root.

Use `-WarmupOnly` when you only want to build the project without launching the stdio server.

## Available MCP surface

- `ReadTextFileAsync` reads a text file from the workspace and returns a bounded preview.
- `ListDirectoryAsync` lists a directory tree within the workspace root.
- `ReviewWorkspaceContent` returns a reusable prompt for reviewing pasted content.

## Test with an MCP client

Use any stdio-capable MCP client, such as MCP Inspector or Claude Desktop, and launch this project with the command above.

Example local check:

```powershell
dotnet build CsharpMcpServer.sln
```

## Troubleshooting

- If the server cannot find packages, make sure `NuGet.Config` is present in the `csharp-mcp-server` folder.
- If a path is rejected, confirm it stays under `MCP_WORKSPACE_ROOT`.
- If a file is rejected, it likely contains binary data or is not UTF-8 text.
