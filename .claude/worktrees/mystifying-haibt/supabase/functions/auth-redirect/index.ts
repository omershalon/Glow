Deno.serve(() => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Glow — Reset Password</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #FFF0F5 0%, #FFE0ED 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: white;
      border-radius: 24px;
      padding: 40px 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(232,84,122,0.15);
    }
    .logo { font-size: 48px; margin-bottom: 8px; }
    .brand { font-size: 28px; font-weight: 800; color: #E8547A; letter-spacing: 2px; margin-bottom: 8px; }
    h2 { font-size: 18px; font-weight: 600; color: #1a1a2e; margin-bottom: 8px; }
    p { font-size: 14px; color: #888; line-height: 1.6; margin-bottom: 24px; }
    .btn {
      display: block;
      background: linear-gradient(90deg, #E8547A, #C43A60);
      color: white;
      text-decoration: none;
      border-radius: 12px;
      padding: 16px;
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 12px;
      transition: opacity 0.2s;
      cursor: pointer;
    }
    .btn:hover { opacity: 0.9; }
    .btn-secondary {
      background: transparent;
      border: 2px solid #E8547A;
      color: #E8547A;
    }
    .divider { height: 1px; background: #f0f0f0; margin: 20px 0; }
    .error { color: #e74c3c; font-size: 14px; }
    .status { color: #888; font-size: 13px; margin-top: 16px; }
    .dev-section { margin-top: 20px; text-align: left; }
    .dev-label { font-size: 12px; color: #aaa; margin-bottom: 6px; display: block; }
    .dev-row { display: flex; gap: 8px; align-items: center; }
    .dev-input {
      flex: 1;
      border: 1.5px solid #e0e0e0;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 13px;
      color: #333;
      font-family: monospace;
    }
    .dev-btn {
      background: #f5f5f5;
      border: 1.5px solid #e0e0e0;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px;
      color: #555;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      text-decoration: none;
    }
    .dev-btn:hover { background: #ebebeb; }
    details summary {
      cursor: pointer;
      font-size: 13px;
      color: #aaa;
      margin-top: 16px;
      user-select: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">✨</div>
    <div class="brand">glow</div>
    <h2>Reset Your Password</h2>
    <p>Tap the button below to open the Glow app and set your new password.</p>

    <a id="app-btn" class="btn" href="#">Open Glow App</a>

    <div class="status" id="status">Preparing link…</div>

    <details id="dev-details">
      <summary>Developer options (Expo Go)</summary>
      <div class="dev-section">
        <span class="dev-label">Enter your Expo dev server host (e.g. 192.168.1.5:8081)</span>
        <div class="dev-row">
          <input class="dev-input" id="expo-host" placeholder="localhost:8081" value="localhost:8081" />
          <a class="dev-btn" id="expo-btn" href="#">Open</a>
        </div>
      </div>
    </details>
  </div>

  <script>
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token') || '';
    const type = params.get('type');
    const status = document.getElementById('status');
    const appBtn = document.getElementById('app-btn');
    const expoHostInput = document.getElementById('expo-host');
    const expoBtn = document.getElementById('expo-btn');

    if (type === 'recovery' && accessToken) {
      const fragment = 'access_token=' + encodeURIComponent(accessToken)
        + '&refresh_token=' + encodeURIComponent(refreshToken)
        + '&type=recovery';

      const appLink = 'glow://reset-password#' + fragment;
      appBtn.href = appLink;

      function updateExpoLink() {
        const host = expoHostInput.value.trim() || 'localhost:8081';
        expoBtn.href = 'exp://' + host + '/--/reset-password#' + fragment;
      }
      updateExpoLink();
      expoHostInput.addEventListener('input', updateExpoLink);

      status.textContent = 'Token verified. Opening app…';

      // Auto-attempt to open the native app
      setTimeout(() => {
        window.location.href = appLink;
        // After 1.5s, if still here, assume the native app didn't open
        setTimeout(() => {
          status.textContent = "If the app didn't open, tap the button above.";
        }, 1500);
      }, 600);
    } else {
      status.innerHTML = '<span class="error">Invalid or expired link. Please request a new password reset.</span>';
      appBtn.style.display = 'none';
      document.getElementById('dev-details').style.display = 'none';
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
