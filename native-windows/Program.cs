using System.Diagnostics;
using System.Net.Http;
using System.Text.Json;
using System.Runtime.InteropServices;

namespace TechHub;

static class Program
{
    [STAThread]
    static void Main()
    {
        using var mutex = new Mutex(true, @"Local\StreamlineTechHub", out var first);
        if (!first) { MessageBox.Show("Tech Hub is already running. Open it from the TH icon in the system tray.", "Tech Hub"); return; }
        ApplicationConfiguration.Initialize();
        Application.Run(new HubWindow());
    }
}

sealed class HubWindow : Form
{
    readonly string data = Environment.GetEnvironmentVariable("TECH_HUB_DATA_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Streamline", "Tech Hub");
    readonly NotifyIcon tray = new();
    readonly System.Windows.Forms.Timer timer = new() { Interval = 3000 };
    readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(2) };
    readonly ToolStripMenuItem master = new("Open Control Page") { Enabled = false };
    readonly ToolStripMenuItem statusItem = new("Starting services…") { Enabled = false };
    Process? hub;
    Job? job;
    StreamWriter? log;
    int? port;
    bool quitting, refreshing;
    readonly Color orange = Color.FromArgb(255, 138, 31);

    public HubWindow()
    {
        Text = "Tech Hub"; ShowInTaskbar = false;
        BackColor = Color.FromArgb(7, 16, 21);
        var menu = new ContextMenuStrip(); menu.Items.Add(statusItem); menu.Items.Add(new ToolStripSeparator());
        master.Click += (_, _) => { if (port is int p) Open($"http://127.0.0.1:{p}"); };
        menu.Items.Add(master);
        menu.Items.Add("Check for Updates", null, (_, _) => Open("https://github.com/horner516/Tech-Hub/releases/latest"));
        menu.Items.Add("Open Logs", null, (_, _) => Open(Path.Combine(data, "logs")));
        menu.Items.Add(new ToolStripSeparator()); menu.Items.Add("Quit Tech Hub", null, async (_, _) => await Quit());
        using var bitmap = new Bitmap(32, 32);
        using (var g = Graphics.FromImage(bitmap)) { g.Clear(BackColor); using var font = new Font("Segoe UI", 13, FontStyle.Bold); using var brush = new SolidBrush(orange); g.DrawString("TH", font, brush, -1, 3); }
        var handle = bitmap.GetHicon(); using (var icon = Icon.FromHandle(handle)) { tray.Icon = (Icon)icon.Clone(); Icon = (Icon)icon.Clone(); } DestroyIcon(handle);
        tray.Text = "Tech Hub"; tray.ContextMenuStrip = menu; tray.Visible = true;
        tray.DoubleClick += (_, _) => { if (port is int p) Open($"http://127.0.0.1:{p}"); };
        timer.Tick += async (_, _) => await RefreshStatus();
        _ = Handle; StartHub(); timer.Start();
    }
    protected override void SetVisibleCore(bool value) { base.SetVisibleCore(false); }
    void Open(string target) { try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); } catch (Exception e) { MessageBox.Show(e.Message, "Tech Hub"); } }
    void StartHub()
    {
        try {
            Directory.CreateDirectory(Path.Combine(data, "logs"));
            log = new StreamWriter(Path.Combine(data, "logs", "hub.log"), true) { AutoFlush = true };
            var resources = Path.Combine(AppContext.BaseDirectory, "resources");
            var info = new ProcessStartInfo(Path.Combine(resources, "node.exe")) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true };
            info.ArgumentList.Add(Path.Combine(resources, "hub", "server.cjs"));
            info.Environment["TECH_HUB_DATA_DIR"] = data; info.Environment["TECH_HUB_RESOURCES"] = resources;
            info.Environment["TECH_HUB_PARENT_PID"] = Environment.ProcessId.ToString(); info.Environment["TECH_HUB_STDIN_CONTROL"] = "1";
            job = new Job(); hub = new Process { StartInfo = info };
            hub.OutputDataReceived += (_, e) => WriteLog(e.Data); hub.ErrorDataReceived += (_, e) => WriteLog(e.Data);
            hub.Start(); job.Assign(hub); hub.BeginOutputReadLine(); hub.BeginErrorReadLine();
        } catch (Exception e) { try { if (hub is { HasExited: false }) hub.Kill(true); } catch { } statusItem.Text = "Unable to start — open logs"; WriteLog(e.ToString()); MessageBox.Show(e.Message, "Tech Hub could not start"); }
    }
    void WriteLog(string? line) { if (line != null && log != null) lock (log) log.WriteLine(line); }
    async Task RefreshStatus()
    {
        if (quitting || refreshing) return; refreshing = true;
        try {
            if (hub == null || hub.HasExited) throw new IOException("Hub stopped");
            using var runtime = JsonDocument.Parse(await File.ReadAllTextAsync(Path.Combine(data, "runtime.json")));
            if (runtime.RootElement.GetProperty("pid").GetInt32() != hub.Id) throw new IOException("Hub is starting");
            int actual = runtime.RootElement.GetProperty("adminPort").GetInt32();
            if (actual < 1024 || actual > 65535) throw new IOException("Invalid master port");
            using var state = JsonDocument.Parse(await http.GetStringAsync($"http://127.0.0.1:{actual}/api/status"));
            if (quitting) return; port = actual; master.Enabled = true;
            int count = state.RootElement.GetProperty("services").EnumerateArray().Count(s => s.GetProperty("state").GetString() == "running");
            int total = state.RootElement.GetProperty("services").GetArrayLength();
            statusItem.Text = $"{count} of {total} services online · Master :{actual}"; tray.Text = $"Tech Hub · {count} of {total} services online";
        } catch { if (!quitting) { port = null; master.Enabled = false; statusItem.Text = "Starting or unavailable — open logs"; } }
        finally { refreshing = false; }
    }
    async Task Quit()
    {
        if (quitting) return; quitting = true; timer.Stop(); Enabled = false;
        try { if (hub is { HasExited: false }) { await hub.StandardInput.WriteLineAsync("shutdown"); await hub.StandardInput.FlushAsync(); using var timeout = new CancellationTokenSource(5000); await hub.WaitForExitAsync(timeout.Token); } } catch { }
        job?.Dispose(); tray.Visible = false; Close();
    }
    protected override void Dispose(bool disposing)
    {
        if (disposing) { quitting = true; timer.Dispose(); job?.Dispose(); tray.Icon?.Dispose(); tray.Dispose(); http.Dispose(); hub?.Dispose(); /* Writer stays alive until async pipe callbacks finish. */ }
        base.Dispose(disposing);
    }
    [DllImport("user32.dll")] static extern bool DestroyIcon(IntPtr icon);
}

// Windows kills the entire owned process tree even if the tray host crashes.
sealed class Job : IDisposable
{
    IntPtr handle;
    public Job() {
        handle = CreateJobObject(IntPtr.Zero, null);
        if (handle == IntPtr.Zero) throw new System.ComponentModel.Win32Exception();
        var limits = new ExtendedLimits(); limits.Basic.LimitFlags = 0x2000;
        if (!SetInformationJobObject(handle, 9, ref limits, (uint)Marshal.SizeOf<ExtendedLimits>())) { Dispose(); throw new System.ComponentModel.Win32Exception(); }
    }
    public void Assign(Process p) { if (!AssignProcessToJobObject(handle, p.Handle)) throw new System.ComponentModel.Win32Exception(); }
    public void Dispose() { if (handle != IntPtr.Zero) { CloseHandle(handle); handle = IntPtr.Zero; } }
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits { public long PerProcess, PerJob; public uint LimitFlags; public UIntPtr MinWorking, MaxWorking; public uint ActiveProcessLimit; public UIntPtr Affinity; public uint Priority, Scheduling; }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes; }
    [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits { public BasicLimits Basic; public IoCounters Io; public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory; }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string? name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int type, ref ExtendedLimits data, uint size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
}
