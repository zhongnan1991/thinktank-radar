import { useState } from "react";
import { GATE_PASSWORD } from "@/lib/gate-config";

export default function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const tryUnlock = () => {
    if (!pwd || busy) return;
    setBusy(true);
    // brief delay so the UI acknowledges the attempt
    setTimeout(() => {
      if (pwd === GATE_PASSWORD) {
        sessionStorage.setItem("ttr-gate", "1");
        onUnlock();
      } else {
        setErr(true);
        setBusy(false);
      }
    }, 350);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm border border-border bg-background p-8">
        <p className="caps font-mono2 text-[10px] text-muted-foreground mb-2">
          ThinkTank Radar · Restricted
        </p>
        <h1 className="font-display font-semibold text-[24px] leading-snug">智库雷达</h1>
        <p className="text-[13px] text-muted-foreground mt-1 mb-6">
          此站点为私密分享，请输入访问密码。
        </p>
        <input
          type="password"
          value={pwd}
          autoFocus
          onChange={(e) => {
            setPwd(e.target.value);
            setErr(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") tryUnlock();
          }}
          placeholder="访问密码"
          className="w-full bg-transparent border border-border px-4 py-2.5 text-[14px] placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
        />
        {err && (
          <p className="text-destructive text-[12px] mt-2">密码不正确，请重试。</p>
        )}
        <button
          onClick={tryUnlock}
          disabled={busy || !pwd}
          className="w-full mt-4 bg-primary text-primary-foreground px-4 py-2.5 text-[13.5px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {busy ? "验证中…" : "进入"}
        </button>
        <p className="font-mono2 text-[10px] text-muted-foreground/60 mt-6">
          如需访问权限，请联系站点维护者。
        </p>
      </div>
    </div>
  );
}
