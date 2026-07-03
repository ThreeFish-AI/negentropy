"""离线评测基座（综述 §8「验证其价值」层）。

- ``runner.SuiteRunner``：在 ``EvalSuite`` 上对某 target 的指定 version 跑 A/B，产 ``EvalRun``。
- ``runner.SkillExecutor``：v1 judge-the-prompt 模式——渲染 ``SkillVersion`` 快照的 prompt_template
  作为「目标产出」交 Judge 评质量（agent-loop 模式留 ``scoring_config.execution_mode`` 后续）。
- ``runner.visible_results_query``：proposer 读证据的唯一入口——结构性排除 ``partition='holdout'``
  的 run（综述 §9.4 防 Goodhart）。
- ``attribution.CounterfactualAttributor``：反事实 Skill Influence Pattern（综述 §8 CTA）。
- ``seed.create_suite`` / ``seed.harvest_failed_tool_invocations``：套件用例的建库与采收。

参考文献：
[1] C. Jiang et al., "Self-Improving Agents in the Era of Experience," Frontis.AI, 2026. §8/§9.4。
"""
