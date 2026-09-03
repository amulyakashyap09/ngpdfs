import Script from "next/script";
import { createElement } from "react";

export function DonateButton() {
  return (
    <>
      <Script async src="https://bondin.io/embed/v1.js" strategy="afterInteractive" />
      <div
        className="fixed z-50"
        style={{
          bottom: "max(1rem, env(safe-area-inset-bottom))",
          left: "max(1rem, env(safe-area-inset-left))",
        }}
      >
        {createElement("bondin-support", { username: "amulya", label: "Support me" })}
      </div>
    </>
  );
}
