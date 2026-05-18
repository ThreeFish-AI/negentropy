# Contributing to Agentic AI Papers Platform

Thank you for your interest in contributing to our platform! This document provides guidelines for contributors.

## 🤝 How to Contribute

### Reporting Issues

- Use the [GitHub Issues](https://github.com/ThreeFish-AI/agentic-ai-cognizes/issues) page
- Provide clear descriptions of the issue
- Include steps to reproduce if it's a bug
- Add relevant screenshots or logs

### Suggesting Features

- Open an issue with the "enhancement" label
- Describe the feature and its use case
- Explain why it would be valuable
- Consider implementation complexity

### Contributing Papers

1. **Paper Selection Criteria**

   - Papers must be about Agentic AI or related fields
   - Prefer recent papers (last 2-3 years)
   - Include seminal/classic papers
   - Ensure papers have academic rigor

2. **Adding New Papers**
   - Add PDF to `papers/source/[category]/`
   - Create a metadata file `paper-info.yaml`:
     ```yaml
     title: "Paper Title"
     authors: ["Author 1", "Author 2"]
     year: 2024
     venue: "Conference/Journal"
     url: "https://arxiv.org/abs/..."
     doi: "10.1000/xyz123"
     categories: ["LLM Agents", "Planning"]
     tags: ["reinforcement learning", "tool use"]
     ```
   - Run extraction agent: `python agents/claude/extract.py`
   - Submit translation and heartfelt versions

### Translating Papers

1. **Quality Guidelines**

   - Maintain technical accuracy
   - Use consistent terminology
   - Preserve mathematical formulas
   - Add translator notes for ambiguous terms

2. **Translation Process**

   - Use our translation agents for initial draft
   - Review and edit for accuracy
   - Ensure cultural adaptation where needed
   - Add contextual explanations

3. **Format Requirements**
   - Use Markdown format
   - Include YAML front matter
   - Preserve original structure
   - Add translation metadata

### Developing Agents

1. **Agent Categories**

   - **Extraction Agents**: Convert papers to Markdown
   - **Translation Agents**: Translate content
   - **Analysis Agents**: Extract insights and summaries
   - **Classification Agents**: Categorize papers

2. **Development Guidelines**

   - Follow existing code patterns
   - Include comprehensive tests
   - Add error handling
   - Document functionality

3. **Testing**
   - Unit tests for core functionality
   - Integration tests for pipelines
   - Test with sample papers
   - Validate output quality

## 🛠️ Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/ThreeFish-AI/agentic-ai-cognizes.git
   cd agentic-ai-cognizes
   ```
3. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
4. Install dependencies:
   ```bash
   pip install -e ".[dev]"
   ```
5. Install pre-commit hooks:
   ```bash
   pre-commit install
   ```
6. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 📝 Code Style

We use the following tools to maintain code quality:

- **Black**: For Python code formatting
- **Ruff**: For linting and import sorting
- **MyPy**: For type checking
- **pre-commit**: To run checks before commits

Run all checks:

```bash
black . && ruff . && mypy agentic_ai_papers
```

## 📋 Pull Request Process

1. **Before Submitting**

   - Run all tests: `pytest`
   - Check code style: `black . && ruff .`
   - Update documentation if needed
   - Add tests for new functionality

2. **PR Requirements**

   - Clear title and description
   - Reference related issues
   - Include screenshots for UI changes
   - Add test results if applicable

3. **Review Process**
   - Maintain polite and constructive feedback
   - Address all review comments
   - Keep PRs focused and atomic
   - Update PR description as needed

## 🏷️ Labels

We use GitHub labels to track contributions:

- `bug`: Bug reports and fixes
- `enhancement`: New features
- `documentation`: Documentation improvements
- `good first issue`: Good for newcomers
- `help wanted`: Need community help
- `paper`: New paper contributions
- `translation`: Translation improvements
- `agent`: Agent development

## 📚 Resources

### Useful Links

- [Claude Agent SDK Documentation](https://github.com/anthropics/claude-agent-sdk)
- [Google ADK Documentation](https://developers.google.com/agent-kit)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [React Documentation](https://react.dev)

### Paper Sources

- [arXiv.org](https://arxiv.org)
- [ACL Anthology](https://aclanthology.org)
- [NeurIPS Proceedings](https://papers.nips.cc)
- [ICML Proceedings](https://proceedings.mlr.press)

## 🎯 Current Priorities

We're currently focusing on:

1. **High-Priority Papers**

   - Agent architectures
   - Tool learning
   - Multi-agent systems
   - Context management

2. **Platform Features**

   - Batch processing
   - Quality metrics
   - User management
   - API improvements

3. **Translation Quality**
   - Domain-specific terminology
   - Consistency checks
   - Review workflow
   - Quality scoring

## 💬 Getting Help

- Create an issue for questions
- Join our discussions (GitHub Discussions tab)
- Check existing documentation
- Review similar issues/PRs

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors are recognized in:

- README.md contributors section
- Annual project report
- Special badges for significant contributions
- Invitation to core team for exceptional contributors

Thank you for contributing to making Agentic AI research accessible to Chinese readers! 🎉
