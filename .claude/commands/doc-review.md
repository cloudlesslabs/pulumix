Review and optimize the project documentation for conciseness, consistency, and structure.

## Documentation Standards

- **README.md**: Target ~500 lines (excluding TOC) - lean entry point with links to detailed docs
- **docs/*.md files**: Target ~1000 lines each (excluding TOC) - detailed deep-dives
- **All doc files**: Must contain a Table of Contents up to h4

## Review Process

### Phase 1: Analysis (Read-Only)

1. **Read all documentation files**:
   - Read `README.md`
   - Read all files in `docs/` directory
   - Count lines for each file (excluding TOC)

2. **Identify issues**:
   - Files exceeding line limits
   - Content duplicated across multiple files
   - Missing or incomplete TOCs
   - Inconsistent formatting or terminology
   - Verbose sections that could be condensed
   - Outdated or redundant information

3. **Assess code samples and examples**:
   - Flag code samples that may be redundant or not adding value
   - Note examples that are overly verbose
   - Identify valuable examples that must be preserved

### Phase 2: Report Findings

Present a structured report including:
- Line counts for each file (current vs target)
- Specific duplications found (with file locations)
- Sections identified for condensing
- Code samples flagged for review
- Proposed restructuring if needed

### Phase 3: Propose Changes

For each file needing changes:
1. Explain what changes you propose
2. **Ask for explicit approval before modifying**
3. Only proceed with approved changes

### Phase 4: Execute Changes

When modifying files:
1. Rewrite for conciseness without losing clarity, accuracy, or precision
2. Remove duplicated content (keep in the most appropriate location)
3. Update or generate TOC up to h4
4. Preserve valuable code samples and examples
5. Maintain consistent formatting and terminology

## Critical Guidelines

**BE VERY CAREFUL WITH CODE SAMPLES AND EXAMPLES:**
- Code samples often contain subtle but important details
- Before deleting or significantly rewriting any code sample, explicitly explain why and ask for confirmation
- When in doubt, keep the code sample
- Prefer condensing prose over removing examples

**Content Preservation Priority:**
1. Technical accuracy (never sacrifice)
2. Code samples and examples (high preservation)
3. Step-by-step instructions (preserve structure)
4. Explanatory prose (can be condensed)
5. Redundant descriptions (can be removed)

**Scope Limitations:**
- **Do NOT modify files under `specs/` folder**
- **Do NOT modify files under `docs/manual/` folder**
- Focus only on `README.md` and `docs/*.md` files

## Optional: Target Specific File

If a specific file path is provided as an argument, review only that file instead of the entire documentation set.
