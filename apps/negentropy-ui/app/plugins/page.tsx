"use client";

import { useState, useEffect } from "react";
import { PluginsNav } from "@/components/ui/PluginsNav";

interface Stats {
  mcp_servers: { total: number; enabled: number };
  skills: { total: number; enabled: number };
  subagents: { total: number; enabled: number };
}

export default function PluginsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/plugins/stats");
        if (!response.ok) {
          throw new Error("Failed to fetch stats");
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
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <PluginsNav title="Dashboard" />
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          <div className="mx-auto max-w-4xl">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              Plugin Management
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Manage MCP servers, Skills, and SubAgents for your AI agents.
            </p>

            {loading ? (
              <div className="text-sm text-zinc-500">Loading...</div>
            ) : error ? (
              <div className="text-sm text-red-500">{error}</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  title="MCP Servers"
                  total={stats?.mcp_servers.total || 0}
                  enabled={stats?.mcp_servers.enabled || 0}
                  href="/plugins/mcp"
                  description="Model Context Protocol servers"
                />
                <StatCard
                  title="Skills"
                  total={stats?.skills.total || 0}
                  enabled={stats?.skills.enabled || 0}
                  href="/plugins/skills"
                  description="Reusable skill modules"
                />
                <StatCard
                  title="SubAgents"
                  total={stats?.subagents.total || 0}
                  enabled={stats?.subagents.enabled || 0}
                  href="/plugins/subagents"
                  description="Sub-agent configurations"
                />
              </div>
            )}

            <div className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Quick Links
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <QuickLink
                  href="/plugins/mcp"
                  title="Register MCP Server"
                  description="Connect external tools via MCP protocol"
                />
                <QuickLink
                  href="/plugins/skills"
                  title="Create Skill"
                  description="Define reusable prompt templates"
                />
                <QuickLink
                  href="/plugins/subagents"
                  title="Configure SubAgent"
                  description="Set up specialized sub-agents"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
      className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 transition-colors dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
        {title}
      </div>
      <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">
        {description}
      </div>
      <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
        {total}
      </div>
      <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
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
      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 hover:border-zinc-300 transition-colors dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="flex-1">
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {description}
        </div>
      </div>
      <svg
        className="w-4 h-4 text-zinc-400"
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
