using System.ComponentModel;
using CsharpMcpServer.Services;
using ModelContextProtocol.Server;

namespace CsharpMcpServer.Tools;

/// <summary>
/// Workspace-scoped tools exposed through MCP.
/// </summary>
[McpServerToolType]
public static class WorkspaceTools
{
    /// <summary>
    /// Reads a UTF-8 text file and returns a bounded preview.
    /// </summary>
    [McpServerTool, Description("Read a text file from the workspace and return a preview.")]
    public static Task<string> ReadTextFileAsync(
        WorkspaceInspector inspector,
        [Description("File path relative to the workspace root.")] string path,
        [Description("Maximum number of lines to return.")] int? maxLines = null,
        CancellationToken cancellationToken = default)
        => inspector.ReadTextFileAsync(path, maxLines, cancellationToken);

    /// <summary>
    /// Lists files and subdirectories beneath a workspace path.
    /// </summary>
    [McpServerTool, Description("List a directory tree inside the workspace.")]
    public static Task<string> ListDirectoryAsync(
        WorkspaceInspector inspector,
        [Description("Directory path relative to the workspace root.")] string path = ".",
        [Description("Maximum recursion depth.")] int? depth = null,
        [Description("Include dotfiles and other hidden entries.")] bool includeHidden = false,
        [Description("Maximum number of entries to return.")] int? maxEntries = null,
        CancellationToken cancellationToken = default)
        => inspector.ListDirectoryAsync(path, depth, includeHidden, maxEntries, cancellationToken);
}
