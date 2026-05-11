# Wave 2 Connectivity Provisioning Report

## Status: 🟢 ACTIVE

The public tunnel for Wave 2 field representatives has been successfully provisioned using Cloudflare Tunnel (Quick Tunnel mode).

### Connection Details (Ecosystem DB)
- **Host:** `mhz-ranking-leisure-lamb.trycloudflare.com`
- **Protocol:** TCP (requires `cloudflared` on client side)
- **Internal Target:** `100.127.148.50:5432` (Tailscale IP of 192.168.2.163)

### Client-Side Setup Instructions
To connect from an external network, field reps must run:
```powershell
.\cloudflared.exe access tcp --hostname mhz-ranking-leisure-lamb.trycloudflare.com --listener 127.0.0.1:5432
```
After running the above command, the application can connect to the database via `localhost:5432`.

### Verification
Empirically verified connectivity via local listener bridge:
- **Test Command:** `node -e "..."` (Success at 2026-05-11T13:52:27.441Z)
- **Latency:** ~200ms (cross-tunnel)

### Infrastructure Notes
- Running on host `192.168.2.163` via Tailscale IP `100.127.148.50`.
- Quick Tunnels are temporary. For permanent production use, migrate to a named tunnel.
