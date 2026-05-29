"use client";

import { useEffect, useState } from "react";

import { MCP_HUB_LABEL } from "@/app/interface/copy";
import { useAuth } from "@/components/providers/AuthProvider";

interface Stats {
  mcp_servers: { total: number; enabled: number };
  skills: { total: number; enabled: number };
  agents: { total: number; enabled: number };
  models: { total: number; enabled: number; vendors: number };
  tools: { total: number; enabled: number };
}

export function InterfaceOverviewSection() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin") ?? false;

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/interface/stats");
        if (!response.ok) {
          throw new Error(
            `获取 Interface 统计失败（HTTP ${response.status}），请稍后重试或联系管理员。`,
          );
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          Interface Overview
        </h2>
        <span className="text-xs text-muted-foreground">
          {isAdmin
            ? "Manage Models, Agents, MCP servers, Skills, and Tools"
            : "Manage Agents, MCP servers, Skills, and Tools"}
        </span>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : error ? (
        <div className="text-sm text-red-500">{error}</div>
      ) : (
        <>
          <div
            className={`grid gap-4 ${isAdmin ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}
          >
            {isAdmin && (
              <StatCard
                title="Models"
                total={stats?.models.total || 0}
                enabled={stats?.models.enabled || 0}
                href="/interface/models"
                description="Vendor keys & registered models"
              />
            )}
            <StatCard
              title="Agents"
              total={stats?.agents.total || 0}
              enabled={stats?.agents.enabled || 0}
              href="/interface/agents"
              description="Agent configurations"
            />
            <StatCard
              title={MCP_HUB_LABEL}
              total={stats?.mcp_servers.total || 0}
              enabled={stats?.mcp_servers.enabled || 0}
              href="/interface/mcp"
              description="Model Context Protocol servers"
            />
            <StatCard
              title="Skills"
              total={stats?.skills.total || 0}
              enabled={stats?.skills.enabled || 0}
              href="/interface/skills"
              description="Reusable skill modules"
            />
            <StatCard
              title="Tools"
              total={stats?.tools?.total || 0}
              enabled={stats?.tools?.enabled || 0}
              href="/interface/tools"
              description="Builtin tool configurations"
            />
          </div>

          <div className="mt-6">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Quick Links
            </h3>
            <div
              className={`grid gap-4 ${isAdmin ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}
            >
              {isAdmin && (
                <QuickLink
                  href="/interface/models"
                  title="Manage Models"
                  description="Vendor credentials & model registration"
                />
              )}
              <QuickLink
                href="/interface/agents"
                title="Configure Agent"
                description="Set up specialized agents"
              />
              <QuickLink
                href="/interface/mcp"
                title="Register MCP Server"
                description="Connect external tools via MCP protocol"
              />
              <QuickLink
                href="/interface/skills"
                title="Create Skill"
                description="Define reusable prompt templates"
              />
              <QuickLink
                href="/interface/tools"
                title="Configure Tool"
                description="Manage builtin tool integrations"
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function StatCard({
  title,
  total,
  enabled,
  href,
  description,
}: {
  title: string;
  total: number;
  enabled: number;
  href: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
    >
      <div className="mb-1 text-sm font-medium text-muted-foreground">{title}</div>
      <div className="mb-3 text-xs text-muted-foreground/70">{description}</div>
      <div className="text-3xl font-bold text-foreground">{total}</div>
      <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
        {enabled} enabled
      </div>
    </a>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-foreground/20"
    >
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <svg
        className="h-4 w-4 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </a>
  );
}
