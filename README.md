# CodeAura

CodeAura reviews how code reads. It scores cleanliness, naming, comments, and flow, then points out where a small change could make the intent clearer.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000) and analyze the preloaded sample, paste your own code, upload files or a ZIP, or browse a public GitHub repository. The workspace accepts up to eight files, 24 KB per file, and 64 KB of source per review. ZIP uploads can be up to 8 MB.

## What the report includes

- Four category scores and a weighted Overall Aura. Cleanliness and flow each contribute 30%, naming contributes 25%, and comments contribute 15%.
- Specific feedback with file and line references where available. Short before-and-after examples appear when the reviewer can suggest a small rewrite.
- A public score link with sharing for X and LinkedIn. The link contains scores, the review date, file count, and languages. Source code, file names, and feedback stay in the detailed report.
- Recent score history in the current browser. The current tab can reopen its detailed report after a refresh.

TypeScript, JavaScript, Python, Go, and Rust have syntax highlighting, along with JSON, CSS, HTML, and Markdown. GitHub browsing uses the default branch and lets you filter the file list by folder before choosing what to review.

## Optional services

Copy `.env.example` to `.env.local` and restart CodeAura when adding credentials.

### Claude reviews

Set `ANTHROPIC_API_KEY` on the server to enable structured Claude feedback. `ANTHROPIC_MODEL` defaults to `claude-sonnet-4-6` and can be set to another Claude model that supports structured outputs. The workspace identifies when submitted files go to Claude. The built-in reviewer runs with zero configuration and is available as a fallback if Claude fails.

### Private GitHub repositories

1. Create a [GitHub App](https://github.com/settings/apps/new) with **Contents** set to **Read-only** and a callback URL of `http://localhost:3000/api/github/callback` for local development. Enable expiring user authorization tokens. A webhook is optional.
2. Install the app on the repositories you want to review.
3. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to the app's credentials. Set `GITHUB_SESSION_SECRET` to a randomly generated secret of at least 32 characters, for example the output of `openssl rand -hex 32`.
4. Set `CODEAURA_ORIGIN` to the app's origin. Use the same origin for the callback URL in the GitHub App. Connect GitHub from the workspace before browsing a private repository.

## Verify

```sh
npm run lint
npm run typecheck
npm run build
```

Run `npm start` to serve the production build.
