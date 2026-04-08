using System.ComponentModel;
using Microsoft.Extensions.AI;
using ModelContextProtocol.Server;

namespace CsharpMcpServer.Prompts;

/// <summary>
/// Reusable prompt templates for reviewing workspace content.
/// </summary>
[McpServerPromptType]
public sealed class WorkspacePrompts
{
    /// <summary>
    /// Builds a code-review prompt from a text snippet.
    /// </summary>
    [McpServerPrompt, Description("Create a focused review prompt for workspace content.")]
    public static IEnumerable<ChatMessage> ReviewWorkspaceContent(
        [Description("Short label for the content type, such as C#, JSON, or markdown.")] string contentType,
        [Description("The content to review.")] string content)
    {
        yield return new ChatMessage(
            ChatRole.User,
            $$"""
            Review the following {{contentType}} content.

            Focus on correctness, security, readability, and missing edge cases.

            ```{{contentType}}
            {{content}}
            ```
            """);

        yield return new ChatMessage(
            ChatRole.Assistant,
            "I will review the content and surface the most important issues and improvements.");
    }
}
