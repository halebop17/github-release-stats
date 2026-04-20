# GitHub Release Tracker

A simple static app that fetches GitHub release data and displays download counts for release assets.

## How to use

1. Open `index.html` in a browser.
2. Enter a repository using the format `owner/repo`.
3. Click `Track Releases`.
4. View the chart and release table.
5. Use `Export to CSV` to download the data.

## Notes

- This app uses the GitHub Releases API and is limited by GitHub's unauthenticated rate limit.
- For larger repositories or large user/org accounts, API call limits may apply.
- Enter either `owner/repo` or a GitHub username/org to summarize download counts across all repos.
- For very large accounts, GitHub's API rate limit may require a personal access token or batching.

## GitHub Pages

This project can be hosted on GitHub Pages from the `main` branch root.
A workflow is included at `.github/workflows/pages.yml` that deploys the current repository content as a static site whenever changes are pushed to `main`.

## Run locally

If you want to run it on a local server, you can use a simple HTTP server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.
