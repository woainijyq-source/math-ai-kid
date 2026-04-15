# AI Formatting Plan

## Goal

Move the project from:

- AI returns paragraph labels
- formatter hardcodes most layout decisions

to:

- AI returns a formatting plan
- formatter executes the plan through WPS APIs

## Current Step

The current implementation introduces `analysis.formatPlan` as an intermediate layer.

`analyzeDocument(...)` now returns:

- `structureAnalysis`
- `docTypeAnalysis`
- `diagnostics`
- `formatPlan`

## `formatPlan` shape

```js
{
  version: 1,
  mode: 'hybrid-plan-v1',
  templateId: 'academic-paper',
  paragraphs: [
    {
      index: 0,
      sourceIndex: 1,
      kind: 'docTitle',
      confidence: 0.92,
      outlineLevel: null,
      preserveOriginalNumbering: false,
      stripAutoNumbering: true,
      isHeading: true,
      builtinStyleName: 'docTitle'
    }
  ],
  documentRules: {
    toc: { mode: 'auto', enabled: true },
    sectionBreaks: { mode: 'auto', enabled: true },
    headerFooter: { mode: 'template', enabled: true },
    fieldRefresh: { enabled: true }
  }
}
```

## Execution Rule

Formatter behavior should prefer `formatPlan` first and fall back to local hardcoded rules only when the plan is absent.

## Next Phase

The next phase should move more decisions into the AI plan, for example:

- whether a heading should preserve original numbering
- whether a document should insert TOC
- whether section breaks should be inserted
- front matter / body / appendix boundaries
- numbering source detection: explicit text vs automatic list numbering
