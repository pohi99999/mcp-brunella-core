using CsharpMcpServer.Configuration;
using CsharpMcpServer.Prompts;
using CsharpMcpServer.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ModelContextProtocol.Server;

var builder = Host.CreateApplicationBuilder(args);

builder.Logging.AddConsole(options =>
{
    options.LogToStandardErrorThreshold = LogLevel.Trace;
});

var workspaceOptions = WorkspaceOptions.Create(
    builder.Configuration["MCP_WORKSPACE_ROOT"],
    Environment.CurrentDirectory);

builder.Services.AddSingleton(workspaceOptions);
builder.Services.AddSingleton<WorkspaceInspector>();

builder.Services
    .AddMcpServer()
    .WithStdioServerTransport()
    .WithToolsFromAssembly()
    .WithPrompts<WorkspacePrompts>();

await builder.Build().RunAsync();
