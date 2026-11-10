using System.Diagnostics;
using System.Globalization;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.JSInterop;

/// <summary>
/// Compiles student C# code with Roslyn inside the browser (WebAssembly) and runs it
/// once per test input, capturing console output. Infinite loops and runaway recursion
/// are stopped by instrumentation injected into every loop body and method.
/// </summary>
public static class Runner
{
    const int OutputLimit = 64 * 1024;

    // Helper type compiled together with the student's code.
    const string ShimSource = @"
global using System;
global using System.IO;
global using System.Linq;
global using System.Collections.Generic;
global using System.Net.Http;
global using System.Threading;
global using System.Threading.Tasks;
public static class __G
{
    public static long N;
    public static int Depth;
    public static bool Tripped;
    public static readonly System.Diagnostics.Stopwatch SW = System.Diagnostics.Stopwatch.StartNew();
    public static long MaxSteps = 400000000;
    public static long TimeMs = 5000;
    public static void T()
    {
        if (Tripped || ++N > MaxSteps || ((N & 1023) == 0 && SW.ElapsedMilliseconds > TimeMs))
        { Tripped = true; throw new __TLE(); }
    }
    public static System.IO.TextReader Stdin = new System.IO.StringReader(string.Empty);
    public static string ReadLine() => Stdin.ReadLine();
    public static int Read() => Stdin.Read();
    public static void Enter()
    {
        if (Tripped) throw new __TLE();
        if (++Depth > 3000) { Tripped = true; throw new __SO(); }
    }
    public static void Out() { Depth--; }
    public static System.Text.Encoding Enc = System.Text.Encoding.UTF8;
    public static System.ConsoleColor Color;
    public static string Title;
    public static System.ConsoleKeyInfo ReadKey(bool intercept = false) => new System.ConsoleKeyInfo('\r', System.ConsoleKey.Enter, false, false, false);
    public static void Clear() { }
    public static void ResetColor() { }
    public static void SetCursorPosition(int a, int b) { }
}
public class __TLE : System.Exception { public __TLE() : base(""Time limit"") { } }
public class __SO : System.Exception { public __SO() : base(""Stack overflow"") { } }
";

    static readonly (Regex re, string to)[] Rewrites =
    {
        (new Regex(@"(?:System\.)?Console\.(?:Output|Input)Encoding(?=\s*=(?!=))"), "__G.Enc"),
        (new Regex(@"(?:System\.)?Console\.(?:Foreground|Background)Color(?=\s*=(?!=))"), "__G.Color"),
        (new Regex(@"(?:System\.)?Console\.Title(?=\s*=(?!=))"), "__G.Title"),
        (new Regex(@"(?:System\.)?Console\.ReadKey\s*\("), "__G.ReadKey("),
        (new Regex(@"(?:System\.)?Console\.ReadLine\s*\("), "__G.ReadLine("),
        (new Regex(@"(?:System\.)?Console\.Read\s*\("), "__G.Read("),
        (new Regex(@"(?:System\.)?Console\.In\b"), "__G.Stdin"),
        (new Regex(@"(?:System\.)?Console\.Clear\s*\("), "__G.Clear("),
        (new Regex(@"(?:System\.)?Console\.ResetColor\s*\("), "__G.ResetColor("),
        (new Regex(@"(?:System\.)?Console\.SetCursorPosition\s*\("), "__G.SetCursorPosition("),
    };

    static IEnumerable<MetadataReference> _refs;
    static IEnumerable<MetadataReference> Refs => _refs ??= Basic.Reference.Assemblies.Net100.References.All.ToList();

    static readonly CSharpParseOptions ParseOpts = new(LanguageVersion.Latest);

    [JSInvokable]
    public static Task<string> Run(string code, string[] inputs)
    {
        var buf = new MemoryStream();
        using (var w = new Utf8JsonWriter(buf))
        {
            w.WriteStartObject();
            var total = Stopwatch.StartNew();
            string src = code ?? "";
            foreach (var (re, to) in Rewrites) src = re.Replace(src, to);

            var userTree = CSharpSyntaxTree.ParseText(src, ParseOpts, path: "Program.cs");
            var shimTree = CSharpSyntaxTree.ParseText(ShimSource, ParseOpts, path: "__shim.cs");

            // 1) compile the code as written, to report errors with the student's own line numbers
            var check = Compile(userTree, shimTree, out var diags, emit: false);
            var errors = diags.Where(d => d.Severity == DiagnosticSeverity.Error && d.Location.SourceTree == userTree).ToList();
            if (errors.Count == 0 && !check)
                errors = diags.Where(d => d.Severity == DiagnosticSeverity.Error).ToList();

            w.WritePropertyName("errors");
            w.WriteStartArray();
            foreach (var d in errors.Take(20))
            {
                var span = d.Location.GetLineSpan();
                w.WriteStartObject();
                w.WriteNumber("line", span.StartLinePosition.Line + 1);
                w.WriteNumber("col", span.StartLinePosition.Character + 1);
                w.WriteString("id", d.Id);
                w.WriteString("message", d.GetMessage(CultureInfo.InvariantCulture));
                w.WriteEndObject();
            }
            w.WriteEndArray();

            w.WritePropertyName("runs");
            w.WriteStartArray();
            if (errors.Count == 0)
            {
                // 2) instrument loops and methods, then emit and run once per input
                var instrumented = userTree.WithRootAndOptions(new Instrumenter().Visit(userTree.GetRoot()), ParseOpts);
                byte[] image = Emit(instrumented, shimTree, out var emitDiags);
                if (image == null)
                {
                    // instrumentation should never break valid code; fall back to the original
                    image = Emit(userTree, shimTree, out emitDiags);
                }
                foreach (var input in inputs ?? new[] { "" })
                {
                    w.WriteStartObject();
                    if (image == null)
                    {
                        w.WriteString("status", "ce");
                        w.WriteString("error", string.Join("\n", emitDiags.Select(x => x.GetMessage(CultureInfo.InvariantCulture))));
                    }
                    else
                    {
                        Execute(image, input ?? "", w);
                    }
                    w.WriteEndObject();
                }
            }
            w.WriteEndArray();
            w.WriteNumber("ms", total.ElapsedMilliseconds);
            w.WriteEndObject();
        }
        return Task.FromResult(Encoding.UTF8.GetString(buf.ToArray()));
    }

    static CSharpCompilation MakeCompilation(SyntaxTree user, SyntaxTree shim) =>
        CSharpCompilation.Create("StudentProgram_" + Guid.NewGuid().ToString("N"),
            new[] { user, shim }, Refs,
            new CSharpCompilationOptions(OutputKind.ConsoleApplication,
                optimizationLevel: OptimizationLevel.Release,
                allowUnsafe: false,
                nullableContextOptions: NullableContextOptions.Disable,
                concurrentBuild: false));

    static bool Compile(SyntaxTree user, SyntaxTree shim, out IReadOnlyList<Diagnostic> diags, bool emit)
    {
        var c = MakeCompilation(user, shim);
        diags = c.GetDiagnostics();
        return !diags.Any(d => d.Severity == DiagnosticSeverity.Error);
    }

    static byte[] Emit(SyntaxTree user, SyntaxTree shim, out IReadOnlyList<Diagnostic> diags)
    {
        var c = MakeCompilation(user, shim);
        using var ms = new MemoryStream();
        var r = c.Emit(ms);
        diags = r.Diagnostics;
        return r.Success ? ms.ToArray() : null;
    }

    static void Execute(byte[] image, string input, Utf8JsonWriter w)
    {
        var outWriter = new LimitedWriter(OutputLimit);
        var oldOut = Console.Out;
        var oldErr = Console.Error;
        var sw = Stopwatch.StartNew();
        string status = "ok", errType = null, errMsg = null;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
            CultureInfo.CurrentUICulture = CultureInfo.InvariantCulture;
            Console.SetOut(outWriter);
            Console.SetError(outWriter);
            var asm = Assembly.Load(image);          // fresh load = fresh static state per test
            asm.GetType("__G").GetField("Stdin").SetValue(null, new StringReader(input.Replace("\r\n", "\n")));
            var ep = asm.EntryPoint;
            object[] args = ep.GetParameters().Length == 0 ? null : new object[] { Array.Empty<string>() };
            var ret = ep.Invoke(null, args);
            if (ret is Task t) t.GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            var inner = ex is TargetInvocationException tie && tie.InnerException != null ? tie.InnerException : ex;
            if (inner is AggregateException ag && ag.InnerException != null) inner = ag.InnerException;
            string tn = inner.GetType().Name;
            if (tn == "__TLE") status = "tle";
            else if (tn == "__SO") { status = "re"; errType = "StackOverflowException"; errMsg = "Đệ quy quá sâu (có thể thiếu điều kiện dừng)."; }
            else if (inner is OutputLimitException) status = "ole";
            else { status = "re"; errType = inner.GetType().FullName; errMsg = inner.Message; }
        }
        finally
        {
            Console.SetOut(oldOut);
            Console.SetError(oldErr);
        }
        w.WriteString("status", status);
        w.WriteString("stdout", outWriter.ToString());
        if (errType != null) w.WriteString("errorType", errType);
        if (errMsg != null) w.WriteString("error", errMsg);
        w.WriteNumber("ms", sw.ElapsedMilliseconds);
    }

    sealed class OutputLimitException : Exception { }

    sealed class LimitedWriter : StringWriter
    {
        readonly int _limit;
        public LimitedWriter(int limit) : base(CultureInfo.InvariantCulture) { _limit = limit; }
        public override Encoding Encoding => Encoding.UTF8;
        void Check(int add) { if (GetStringBuilder().Length + add > _limit) throw new OutputLimitException(); }
        public override void Write(char value) { Check(1); base.Write(value); }
        public override void Write(string value) { Check(value?.Length ?? 0); base.Write(value); }
        public override void Write(char[] buffer, int index, int count) { Check(count); base.Write(buffer, index, count); }
        public override void Write(ReadOnlySpan<char> buffer) { Check(buffer.Length); base.Write(buffer); }
    }

    /// <summary>Adds a step counter at the start of every loop body and a depth guard around every method body.</summary>
    sealed class Instrumenter : CSharpSyntaxRewriter
    {
        static StatementSyntax Tick() => SyntaxFactory.ParseStatement("global::__G.T();");

        static BlockSyntax Wrap(StatementSyntax body) =>
            body is BlockSyntax b ? b.WithStatements(b.Statements.Insert(0, Tick())) : SyntaxFactory.Block(Tick(), body);

        static BlockSyntax Guard(BlockSyntax body) =>
            SyntaxFactory.Block(
                SyntaxFactory.ParseStatement("global::__G.Enter();"),
                SyntaxFactory.TryStatement(body, default,
                    SyntaxFactory.FinallyClause(SyntaxFactory.Block(SyntaxFactory.ParseStatement("global::__G.Out();")))));

        public override SyntaxNode VisitWhileStatement(WhileStatementSyntax node)
        { var n = (WhileStatementSyntax)base.VisitWhileStatement(node); return n.WithStatement(Wrap(n.Statement)); }
        public override SyntaxNode VisitDoStatement(DoStatementSyntax node)
        { var n = (DoStatementSyntax)base.VisitDoStatement(node); return n.WithStatement(Wrap(n.Statement)); }
        public override SyntaxNode VisitForStatement(ForStatementSyntax node)
        { var n = (ForStatementSyntax)base.VisitForStatement(node); return n.WithStatement(Wrap(n.Statement)); }
        public override SyntaxNode VisitForEachStatement(ForEachStatementSyntax node)
        { var n = (ForEachStatementSyntax)base.VisitForEachStatement(node); return n.WithStatement(Wrap(n.Statement)); }
        public override SyntaxNode VisitGotoStatement(GotoStatementSyntax node)
        { var n = (GotoStatementSyntax)base.VisitGotoStatement(node); return SyntaxFactory.Block(Tick(), n); }

        public override SyntaxNode VisitMethodDeclaration(MethodDeclarationSyntax node)
        {
            var n = (MethodDeclarationSyntax)base.VisitMethodDeclaration(node);
            if (n.Body == null || IsIterator(n.Body)) return n;
            return n.WithBody(Guard(n.Body));
        }
        public override SyntaxNode VisitLocalFunctionStatement(LocalFunctionStatementSyntax node)
        {
            var n = (LocalFunctionStatementSyntax)base.VisitLocalFunctionStatement(node);
            if (n.Body == null || IsIterator(n.Body)) return n;
            return n.WithBody(Guard(n.Body));
        }

        static bool IsIterator(BlockSyntax body) => body.DescendantNodes().OfType<YieldStatementSyntax>().Any();
    }
}
