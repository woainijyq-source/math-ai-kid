import { AppShell } from "@/components/layout/app-shell";
import { SettingsPanel } from "@/components/parent/settings-panel";

export default function ParentSettingsPage() {
  return (
    <AppShell
      title="原型设置"
      subtitle="阶段 1 只保留最小设置，不提前堆复杂的家长控制系统。"
    >
      <SettingsPanel />
    </AppShell>
  );
}
