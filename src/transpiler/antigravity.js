/**
 * Dextinity - Antigravity Language Transpiler
 *
 * Antigravity is a high-level DSL that transpiles to Roblox Luau.
 * It uses cleaner, more expressive syntax while outputting
 * fully Roblox-compatible Luau code.
 *
 * Antigravity Syntax Overview:
 *   - Python-like indentation (tabs/spaces -> Luau blocks)
 *   - Simplified service access: @Players, @ReplicatedStorage
 *   - Arrow functions: (x) => x * 2
 *   - Type annotations: var name: string = "hello"
 *   - Event shorthand: on @Players.PlayerAdded(player) do ... end
 *   - Await syntax: await task.wait(1)
 *   - For-each: for item in list do ... end
 *   - Print shorthand: print! "hello"
 *   - Module shorthand: export module MyModule ... end
 */

export class AntigravityTranspiler {
  constructor() {
    this.indentStack = [];
    this.output = [];
    this.errors = [];
  }

  /**
   * Transpile Antigravity source to Luau.
   * @param {string} source - Antigravity source code
   * @returns {{ luau: string, errors: string[] }}
   */
  transpile(source) {
    this.output = [];
    this.errors = [];

    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i++) {
      try {
        const transformed = this._transformLine(lines[i], i + 1);
        this.output.push(transformed);
      } catch (e) {
        this.errors.push(`Line ${i + 1}: ${e.message}`);
        this.output.push(`-- [TRANSPILE ERROR] ${lines[i]}`);
      }
    }

    let luau = this.output.join('\n');
    luau = this._postProcess(luau);

    return { luau, errors: [...this.errors] };
  }

  _transformLine(line, lineNum) {
    // Preserve empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('--')) return line;
    if (line.trim().startsWith('#')) {
      return line.replace(/^(\s*)#/, '$1--');
    }

    let result = line;

    // Service access: @ServiceName -> game:GetService("ServiceName")
    result = result.replace(/@(\w+)/g, (_, name) => {
      return `game:GetService("${name}")`;
    });

    // Export module: export module Name -> local Name = {}
    result = result.replace(
      /^(\s*)export\s+module\s+(\w+)\s*$/,
      '$1local $2 = {}'
    );

    // Arrow functions: (args) => expr
    result = result.replace(
      /\(([^)]*)\)\s*=>\s*(.+)/g,
      'function($1) return $2 end'
    );

    // Await: await expr -> expr (Luau uses coroutines, but task.wait is synchronous)
    result = result.replace(/\bawait\s+/g, '');

    // Print shorthand: print! "text" -> print("text")
    result = result.replace(
      /\bprint!\s+(.+)/,
      'print($1)'
    );

    // Type annotations: var name: type = value -> local name: type = value
    result = result.replace(
      /^(\s*)var\s+(\w+)\s*:\s*(\w+)\s*=\s*(.+)/,
      '$1local $2: $3 = $4'
    );

    // Simple var: var name = value -> local name = value
    result = result.replace(
      /^(\s*)var\s+(\w+)\s*=\s*(.+)/,
      '$1local $2 = $3'
    );

    // Const: const name = value -> local name = value
    result = result.replace(
      /^(\s*)const\s+(\w+)\s*=\s*(.+)/,
      '$1local $2 = $3'
    );

    // Event shorthand: on expr(args) do -> expr:Connect(function(args)
    result = result.replace(
      /^(\s*)on\s+(.+?)\.(\w+)\(([^)]*)\)\s+do\s*$/,
      '$1$2.$3:Connect(function($4)'
    );

    // For-each with pairs: for key, value in table do -> for key, value in pairs(table) do
    result = result.replace(
      /^(\s*)for\s+(\w+)\s*,\s*(\w+)\s+in\s+(\w+)\s+do\s*$/,
      '$1for $2, $3 in pairs($4) do'
    );

    // For-each with ipairs: for item in list do -> for _, item in ipairs(list) do
    result = result.replace(
      /^(\s*)for\s+(\w+)\s+in\s+(\w+)\s+do\s*$/,
      '$1for _, $2 in ipairs($3) do'
    );

    // String interpolation: f"hello {name}" -> string.format("hello %s", tostring(name))
    result = result.replace(
      /f"([^"]*)"/g,
      (_, template) => {
        const parts = [];
        const format = template.replace(/\{(\w+)\}/g, (__, varName) => {
          parts.push(`tostring(${varName})`);
          return '%s';
        });
        if (parts.length > 0) {
          return `string.format("${format}", ${parts.join(', ')})`;
        }
        return `"${template}"`;
      }
    );

    // Null coalescing: a ?? b -> a or b
    result = result.replace(/\s*\?\?\s*/g, ' or ');

    // Not equal: != -> ~=
    result = result.replace(/!=/g, '~=');

    // Logical operators: && -> and, || -> or
    result = result.replace(/\s&&\s/g, ' and ');
    result = result.replace(/\s\|\|\s/g, ' or ');
    // Logical not: !varName -> not varName (only when preceded by space/paren/start or after operator)
    // Avoid matching inside strings by only replacing when ! is preceded by a non-alphanumeric char
    result = result.replace(/(^|[\s(,=])!(\w)/g, '$1not $2');

    return result;
  }

  _postProcess(code) {
    // Remove trailing whitespace from each line
    code = code.replace(/[ \t]+$/gm, '');

    // Collapse 3+ consecutive blank lines into 2
    code = code.replace(/\n{4,}/g, '\n\n\n');

    return code;
  }

  /**
   * Generate Antigravity source from a description of what the code should do.
   * Returns a template that can be further refined.
   */
  static generateTemplate(description, type) {
    const templates = {
      serverScript: `# Server Script - ${description}
# Auto-generated by Dextinity Antigravity

var Players = @Players
var ReplicatedStorage = @ReplicatedStorage
var DataStoreService = @DataStoreService

export module ServerMain

on Players.PlayerAdded(player) do
  print! f"Player {player.Name} joined"
end

on Players.PlayerRemoving(player) do
  print! f"Player {player.Name} left"
end

end
return ServerMain`,

      clientScript: `# Client Script - ${description}
# Auto-generated by Dextinity Antigravity

var Players = @Players
var ReplicatedStorage = @ReplicatedStorage
var UserInputService = @UserInputService

var player = Players.LocalPlayer
var playerGui = player:WaitForChild("PlayerGui")

# Client initialization
print! f"Client ready for {player.Name}"`,

      moduleScript: `# Module - ${description}
# Auto-generated by Dextinity Antigravity

export module ${description.replace(/\s+/g, '')}

end
return ${description.replace(/\s+/g, '')}`,
    };

    return templates[type] || templates.moduleScript;
  }
}

export const transpiler = new AntigravityTranspiler();
