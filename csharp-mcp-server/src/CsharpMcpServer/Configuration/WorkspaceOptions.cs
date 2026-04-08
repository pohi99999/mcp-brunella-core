using ModelContextProtocol;

namespace CsharpMcpServer.Configuration;

/// <summary>
/// Configuration for the workspace-bound file tools.
/// </summary>
public sealed class WorkspaceOptions
{
    /// <summary>
    /// Environment variable that overrides the workspace root.
    /// </summary>
    public const string EnvironmentVariableName = "MCP_WORKSPACE_ROOT";

    private WorkspaceOptions(string rootPath)
    {
        RootPath = rootPath;
    }

    /// <summary>
    /// Gets the absolute workspace root used to constrain file access.
    /// </summary>
    public string RootPath { get; }

    /// <summary>
    /// Gets the default number of file lines returned by the read tool.
    /// </summary>
    public int DefaultPreviewLines { get; init; } = 200;

    /// <summary>
    /// Gets the maximum number of lines a read request may ask for.
    /// </summary>
    public int MaxPreviewLines { get; init; } = 1000;

    /// <summary>
    /// Gets the default directory depth used by the listing tool.
    /// </summary>
    public int DefaultDirectoryDepth { get; init; } = 2;

    /// <summary>
    /// Gets the maximum directory depth accepted by the listing tool.
    /// </summary>
    public int MaxDirectoryDepth { get; init; } = 6;

    /// <summary>
    /// Gets the maximum number of directory entries returned by a listing.
    /// </summary>
    public int MaxDirectoryEntries { get; init; } = 500;

    /// <summary>
    /// Creates workspace options from the configured root path or a fallback.
    /// </summary>
    public static WorkspaceOptions Create(string? configuredRootPath, string fallbackRootPath)
    {
        var rootPath = string.IsNullOrWhiteSpace(configuredRootPath)
            ? fallbackRootPath
            : configuredRootPath.Trim();

        try
        {
            return new WorkspaceOptions(Path.GetFullPath(rootPath));
        }
        catch (Exception ex) when (
            ex is ArgumentException
            or NotSupportedException
            or PathTooLongException
            or IOException
            or UnauthorizedAccessException
            or System.Security.SecurityException)
        {
            throw new McpProtocolException(
                $"Invalid workspace root '{rootPath}'.",
                ex,
                McpErrorCode.InvalidParams);
        }
    }
}
