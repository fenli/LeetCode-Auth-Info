# LeetCode Auth Info

A Chrome extension that copies your LeetCode `csrftoken` and `LEETCODE_SESSION` cookies into GitHub Actions secrets on a repository you choose.

## Features

- Detect LeetCode login status
- Cache Repository URL and GitHub Token locally
- Sync cookies into GitHub Actions secrets:
    - `LEETCODE_CSRF_TOKEN`
    - `LEETCODE_SESSION`

## Installation

1. Open chrome://extensions
2. Enable Developer Mode
3. Click Load unpacked
4. Select this folder

## Usage

1. Log in to https://leetcode.com
2. Open the extension
3. Enter the GitHub repository URL
4. Enter a GitHub token that can write repository Actions secrets
5. Click **Sync**

The GitHub token should be a classic PAT with the `repo` scope, or a fine-grained token with **Secrets: Read and write** on that repository.
