"use client";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

export default function Home() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <main className="min-h-screen p-8">
        <h1 className="text-2xl font-bold mb-4">Travel Agent Demo</h1>
        <p>使用 AG-UI 协议的 E2E Demo</p>
      </main>
      <CopilotPopup
        instructions="You are a helpful travel assistant."
        labels={{
          title: "Travel Agent",
          initial: "我能帮您规划旅行！",
        }}
      />
    </CopilotKit>
  );
}
