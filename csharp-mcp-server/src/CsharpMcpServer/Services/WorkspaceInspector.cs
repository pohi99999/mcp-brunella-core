using System.Text;
using CsharpMcpServer.Configuration;
using Microsoft.Extensions.Logging;
using ModelContextProtocol;

namespace CsharpMcpServer.Services;

/// <summary>
/// Performs workspace-scoped file operations for the MCP tools.
/// </summary>
public sealed class WorkspaceInspector
{
    private readonly WorkspaceOptions _options;
    private readonly ILogger<WorkspaceInspector> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="WorkspaceInspector"/> class.
    /// </summary>
    public WorkspaceInspector(WorkspaceOptions options, ILogger<WorkspaceInspector> logger)
    {
        _options = options;
        _logger = logger;
    }

    /// <summary>
    /// Reads a text file and returns a preview bounded by <paramref name="maxLines"/>.
    /// </summary>
    public async Task<string> ReadTextFileAsync(string path, int? maxLines, CancellationToken cancellationToken)
    {
        var resolvedPath = ResolveWorkspacePath(path);

        if (Directory.Exists(resolvedPath))
        {
            throw new McpProtocolException(
                $"'{GetDisplayPath(resolvedPath)}' is a directory, not a file.",
                McpErrorCode.InvalidParams);
        }

        if (!File.Exists(resolvedPath))
        {
            throw new McpProtocolException(
                $"File not found: '{GetDisplayPath(resolvedPath)}'.",
                McpErrorCode.InvalidParams);
        }

        var previewLines = NormalizePreviewLines(maxLines);

        if (!LooksLikeTextFile(resolvedPath))
        {
            throw new McpProtocolException(
                $"The file '{GetDisplayPath(resolvedPath)}' does not appear to be UTF-8 text.",
                McpErrorCode.InvalidParams);
        }

        try
        {
            var lines = new List<string>(previewLines);

            await using var stream = new FileStream(
                resolvedPath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                bufferSize: 4096,
                options: FileOptions.Asynchronous | FileOptions.SequentialScan);

            using var reader = new StreamReader(stream, detectEncodingFromByteOrderMarks: true);

            while (lines.Count < previewLines)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var line = await reader.ReadLineAsync();
                if (line is null)
                {
                    break;
                }

                lines.Add(line);
            }

            var truncated = false;
            if (lines.Count == previewLines)
            {
                cancellationToken.ThrowIfCancellationRequested();
                truncated = await reader.ReadLineAsync() is not null;
            }

            return BuildTextPreview(resolvedPath, lines, truncated, previewLines);
        }
        catch (DecoderFallbackException ex)
        {
            _logger.LogWarning(ex, "Rejected non-text file at {Path}", resolvedPath);
            throw new McpProtocolException(
                $"The file '{GetDisplayPath(resolvedPath)}' does not appear to be text.",
                ex,
                McpErrorCode.InvalidParams);
        }
        catch (IOException ex)
        {
            _logger.LogError(ex, "Unable to read file at {Path}", resolvedPath);
            throw new McpProtocolException(
                $"Unable to read '{GetDisplayPath(resolvedPath)}'.",
                ex,
                McpErrorCode.InternalError);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogError(ex, "Access denied while reading {Path}", resolvedPath);
            throw new McpProtocolException(
                $"Access denied while reading '{GetDisplayPath(resolvedPath)}'.",
                ex,
                McpErrorCode.InternalError);
        }
    }

    /// <summary>
    /// Lists a directory tree within the workspace root.
    /// </summary>
    public Task<string> ListDirectoryAsync(
        string path,
        int? depth,
        bool includeHidden,
        int? maxEntries,
        CancellationToken cancellationToken)
    {
        var resolvedPath = ResolveWorkspacePath(path);

        if (!Directory.Exists(resolvedPath))
        {
            throw new McpProtocolException(
                $"Directory not found: '{GetDisplayPath(resolvedPath)}'.",
                McpErrorCode.InvalidParams);
        }

        var normalizedDepth = NormalizeDepth(depth);
        var normalizedEntryLimit = NormalizeEntryLimit(maxEntries);

        try
        {
            var builder = new StringBuilder();
            var entryCount = 0;

            builder.AppendLine($"Directory: {GetDisplayPath(resolvedPath)}");
            builder.AppendLine($"Absolute path: {resolvedPath}");
            builder.AppendLine($"Workspace root: {_options.RootPath}");
            builder.AppendLine($"Depth: {normalizedDepth}");
            builder.AppendLine($"Include hidden: {(includeHidden ? "yes" : "no")}");
            builder.AppendLine();

            RenderDirectory(
                resolvedPath,
                builder,
                indent: string.Empty,
                depth: 0,
                maxDepth: normalizedDepth,
                includeHidden: includeHidden,
                entryCount: ref entryCount,
                maxEntries: normalizedEntryLimit,
                cancellationToken: cancellationToken);

            if (entryCount >= normalizedEntryLimit)
            {
                builder.AppendLine();
                builder.AppendLine($"... truncated after {normalizedEntryLimit} entries.");
            }

            return Task.FromResult(builder.ToString().TrimEnd());
        }
        catch (IOException ex)
        {
            _logger.LogError(ex, "Unable to list directory at {Path}", resolvedPath);
            throw new McpProtocolException(
                $"Unable to list '{GetDisplayPath(resolvedPath)}'.",
                ex,
                McpErrorCode.InternalError);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogError(ex, "Access denied while listing {Path}", resolvedPath);
            throw new McpProtocolException(
                $"Access denied while listing '{GetDisplayPath(resolvedPath)}'.",
                ex,
                McpErrorCode.InternalError);
        }
    }

    private static bool LooksLikeTextFile(string path)
    {
        Span<byte> buffer = stackalloc byte[4096];
        using var stream = File.Open(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        var bytesRead = stream.Read(buffer);

        for (var index = 0; index < bytesRead; index++)
        {
            if (buffer[index] == 0)
            {
                return false;
            }
        }

        return true;
    }

    private string BuildTextPreview(string resolvedPath, IReadOnlyCollection<string> lines, bool truncated, int requestedLineLimit)
    {
        var builder = new StringBuilder();
        builder.AppendLine($"File: {GetDisplayPath(resolvedPath)}");
        builder.AppendLine($"Absolute path: {resolvedPath}");
        builder.AppendLine($"Workspace root: {_options.RootPath}");
        builder.AppendLine($"Requested lines: {requestedLineLimit}");
        builder.AppendLine($"Returned lines: {lines.Count}");
        builder.AppendLine($"Truncated: {(truncated ? "yes" : "no")}");
        builder.AppendLine();

        if (lines.Count == 0)
        {
            builder.AppendLine("[empty file]");
        }
        else
        {
            foreach (var line in lines)
            {
                builder.AppendLine(line);
            }
        }

        return builder.ToString().TrimEnd();
    }

    private int NormalizePreviewLines(int? requested)
    {
        var previewLines = requested ?? _options.DefaultPreviewLines;

        if (previewLines < 1)
        {
            throw new McpProtocolException(
                "maxLines must be greater than zero.",
                McpErrorCode.InvalidParams);
        }

        if (previewLines > _options.MaxPreviewLines)
        {
            throw new McpProtocolException(
                $"maxLines cannot exceed {_options.MaxPreviewLines}.",
                McpErrorCode.InvalidParams);
        }

        return previewLines;
    }

    private int NormalizeDepth(int? requested)
    {
        var depth = requested ?? _options.DefaultDirectoryDepth;

        if (depth < 0)
        {
            throw new McpProtocolException(
                "depth must be zero or greater.",
                McpErrorCode.InvalidParams);
        }

        if (depth > _options.MaxDirectoryDepth)
        {
            throw new McpProtocolException(
                $"depth cannot exceed {_options.MaxDirectoryDepth}.",
                McpErrorCode.InvalidParams);
        }

        return depth;
    }

    private int NormalizeEntryLimit(int? requested)
    {
        var entryLimit = requested ?? _options.MaxDirectoryEntries;

        if (entryLimit < 1)
        {
            throw new McpProtocolException(
                "maxEntries must be greater than zero.",
                McpErrorCode.InvalidParams);
        }

        if (entryLimit > _options.MaxDirectoryEntries)
        {
            throw new McpProtocolException(
                $"maxEntries cannot exceed {_options.MaxDirectoryEntries}.",
                McpErrorCode.InvalidParams);
        }

        return entryLimit;
    }

    private string ResolveWorkspacePath(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            throw new McpProtocolException(
                "A file or directory path is required.",
                McpErrorCode.InvalidParams);
        }

        var combinedPath = Path.IsPathFullyQualified(path)
            ? path
            : Path.Combine(_options.RootPath, path);

        var fullPath = Path.GetFullPath(combinedPath);

        if (!IsWithinWorkspace(fullPath))
        {
            throw new McpProtocolException(
                $"Path '{path}' escapes the workspace root '{_options.RootPath}'.",
                McpErrorCode.InvalidParams);
        }

        return fullPath;
    }

    private bool IsWithinWorkspace(string fullPath)
    {
        var relativePath = Path.GetRelativePath(_options.RootPath, fullPath);
        return relativePath is "." || !relativePath.StartsWith(".." + Path.DirectorySeparatorChar, StringComparison.Ordinal) && relativePath != "..";
    }

    private string GetDisplayPath(string fullPath)
    {
        var relativePath = Path.GetRelativePath(_options.RootPath, fullPath);
        return relativePath == "." ? "." : relativePath;
    }

    private void RenderDirectory(
        string directoryPath,
        StringBuilder builder,
        string indent,
        int depth,
        int maxDepth,
        bool includeHidden,
        ref int entryCount,
        int maxEntries,
        CancellationToken cancellationToken)
    {
        var entries = Directory
            .EnumerateFileSystemEntries(directoryPath)
            .OrderBy(Path.GetFileName, StringComparer.OrdinalIgnoreCase);

        foreach (var entry in entries)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (entryCount >= maxEntries)
            {
                return;
            }

            var name = Path.GetFileName(entry);
            if (!includeHidden && name.StartsWith(".", StringComparison.Ordinal))
            {
                continue;
            }

            var isDirectory = Directory.Exists(entry);
            builder.Append(indent)
                .Append(isDirectory ? "[D] " : "[F] ")
                .Append(name);

            if (!isDirectory)
            {
                builder.Append(" (")
                    .Append(new FileInfo(entry).Length)
                    .Append(" bytes)");
            }

            builder.AppendLine();
            entryCount++;

            if (isDirectory && depth < maxDepth)
            {
                RenderDirectory(
                    entry,
                    builder,
                    indent + "  ",
                    depth + 1,
                    maxDepth,
                    includeHidden,
                    ref entryCount,
                    maxEntries,
                    cancellationToken);

                if (entryCount >= maxEntries)
                {
                    return;
                }
            }
        }
    }
}
