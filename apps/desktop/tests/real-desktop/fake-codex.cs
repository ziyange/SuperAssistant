using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;

// Disposable read-only fixture: no model calls, shell, files or network.
internal static class FakeCodex {
    private static int Main(string[] args) {
        if (args.Length == 1 && args[0] == "--version") {
            Console.WriteLine("codex-cli 0.121.0");
            return 0;
        }
        if (args.Length == 0 || args[0] != "app-server") return 2;
        var json = new JavaScriptSerializer();
        string line;
        while ((line = Console.ReadLine()) != null) {
            try {
                var request = json.Deserialize<Dictionary<string, object>>(line);
                var method = request["method"] as string;
                if (method == "initialized") continue;
                object result;
                if (method == "initialize") {
                    result = new { userAgent = "fake-codex/0.121.0" };
                } else if (method == "account/read") {
                    result = new { account = new { type = "chatgpt", email = "fixture@example.invalid", planType = "plus" }, requiresOpenaiAuth = true };
                } else {
                    return 3;
                }
                Console.WriteLine(json.Serialize(new { id = request["id"], result = result }));
                Console.Out.Flush();
            } catch { return 4; }
        }
        return 0;
    }
}
