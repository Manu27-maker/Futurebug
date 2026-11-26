const vm = require("vm");

let code = "";

process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
    code += chunk;
});

process.stdin.on("end", () => {
    let error = null;

    try {
        // Source files in the editor may use `import`/`export`, which only
        // parse as ES modules. Requires node --experimental-vm-modules.
        if (typeof vm.SourceTextModule === "function") {
            new vm.SourceTextModule(code);
        } else {
            new Function(code);
        }
    } catch (moduleError) {
        // Fall back to a classic script parse: sloppy-mode syntax such as
        // `with` or a top-level `return` is valid JS but not a valid module.
        try {
            new Function(code);
        } catch {
            error = moduleError;
        }
    }

    if (error) {
        console.log(JSON.stringify({
            valid: false,
            message: error.message
        }));
        process.exitCode = 1;
        return;
    }

    console.log(JSON.stringify({ valid: true }));
});
