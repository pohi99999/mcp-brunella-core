import path from "path";

/**
 * Resolves the path to the Python executable.
 * Prioritizes the virtual environment (.venv) if it exists and works.
 * Fallbacks to system "python" command.
 *
 * @param workspaceRoot The root directory of the workspace.
 * @returns The absolute path to the Python executable or "python" command.
 */
export async function resolvePythonPath(workspaceRoot: string): Promise<string> {
    const venvRel =
        process.platform === "win32"
            ? ".venv/Scripts/python.exe"
            : ".venv/bin/python";

    const candidatePath = path.resolve(workspaceRoot, venvRel);

    // Only attempt to validate specific path in Node.js environment
    if (typeof process !== 'undefined' && process.versions?.node) {
        try {
            const { execSync } = await import("child_process");
            // Check if the candidate path is a valid python executable
            execSync(`"${candidatePath}" --version`, { stdio: "ignore" });
            return candidatePath;
        } catch (e) {
            // Fallback to system python
            return "python";
        }
    }

    // Default fallback for non-Node environments
    return "python";
}
