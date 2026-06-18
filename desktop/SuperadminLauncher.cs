using System;
using System.Diagnostics;
using System.Windows.Forms;

namespace ShiiEdu.SuperadminLauncher
{
    internal static class Program
    {
        private const string DefaultUrl = "http://127.0.0.1:3100/app/superadmin";

        [STAThread]
        private static void Main()
        {
            var targetUrl = Environment.GetEnvironmentVariable("SHII_EDU_SUPERADMIN_URL");
            if (string.IsNullOrWhiteSpace(targetUrl))
            {
                targetUrl = DefaultUrl;
            }

            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = targetUrl,
                    UseShellExecute = true
                });
            }
            catch (Exception error)
            {
                MessageBox.Show(
                    "Open this URL manually:\n\n" + targetUrl + "\n\n" + error.Message,
                    "Shii-Edu Superadmin",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
        }
    }
}
