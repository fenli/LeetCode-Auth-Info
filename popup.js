const STORAGE_KEYS = {
    repoUrl: "repoUrl",
    githubToken: "githubToken"
};

const SECRET_NAMES = {
    csrf: "LEETCODE_CSRF_TOKEN",
    session: "LEETCODE_SESSION"
};

async function getCookie(name) {
    const cookie = await chrome.cookies.get({
        url: "https://leetcode.com",
        name
    });

    return cookie?.value ?? null;
}

async function loadCachedInputs() {
    return chrome.storage.local.get([
        STORAGE_KEYS.repoUrl,
        STORAGE_KEYS.githubToken
    ]);
}

async function saveCachedInputs(repoUrl, githubToken) {
    await chrome.storage.local.set({
        [STORAGE_KEYS.repoUrl]: repoUrl,
        [STORAGE_KEYS.githubToken]: githubToken
    });
}

function parseGitHubRepo(value) {
    const raw = value.trim();

    if (!raw) {
        return null;
    }

    let owner;
    let repo;

    try {
        const sshMatch = raw.match(/^git@github\.com:([^/]+)\/(.+)$/i);

        if (sshMatch) {
            owner = sshMatch[1];
            repo = sshMatch[2];
        } else if (/github\.com[:/]/i.test(raw)) {
            const href = raw.startsWith("http") ? raw : `https://${raw}`;
            const url = new URL(href.replace("github.com:", "github.com/"));
            const parts = url.pathname.replace(/^\/+/, "").split("/");
            owner = parts[0];
            repo = parts[1];
        } else {
            const parts = raw.replace(/^\/+/, "").split("/");
            owner = parts[0];
            repo = parts[1];
        }
    } catch {
        return null;
    }

    if (!owner || !repo) {
        return null;
    }

    repo = repo.replace(/\.git$/i, "");

    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
        return null;
    }

    return { owner, repo };
}

function bytesToBase64(bytes) {
    let binary = "";

    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
}

function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

function githubHeaders(token) {
    return {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28"
    };
}

async function readGitHubError(response) {
    try {
        const body = await response.json();
        return body.message || `GitHub API error (${response.status})`;
    } catch {
        return `GitHub API error (${response.status})`;
    }
}

async function putRepoSecret(owner, repo, token, name, secretValue, key, keyId) {
    const encryptedBytes = sealedBox.seal(
        new TextEncoder().encode(secretValue),
        base64ToBytes(key)
    );

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${name}`,
        {
            method: "PUT",
            headers: {
                ...githubHeaders(token),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                encrypted_value: bytesToBase64(encryptedBytes),
                key_id: keyId
            })
        }
    );

    if (!response.ok) {
        throw new Error(await readGitHubError(response));
    }
}

async function syncSecrets(repoUrl, githubToken) {
    const parsed = parseGitHubRepo(repoUrl);

    if (!parsed) {
        throw new Error("Enter a valid repository URL, such as https://github.com/owner/repo.");
    }

    if (!githubToken.trim()) {
        throw new Error("Enter a GitHub token with permission to write Actions secrets.");
    }

    const [csrf, session] = await Promise.all([
        getCookie("csrftoken"),
        getCookie("LEETCODE_SESSION")
    ]);

    if (!session || !csrf) {
        throw new Error("Please login to LeetCode first.");
    }

    const publicKeyResponse = await fetch(
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/actions/secrets/public-key`,
        { headers: githubHeaders(githubToken.trim()) }
    );

    if (!publicKeyResponse.ok) {
        throw new Error(await readGitHubError(publicKeyResponse));
    }

    const { key, key_id: keyId } = await publicKeyResponse.json();

    if (!key || !keyId) {
        throw new Error("GitHub did not return a repository secrets public key.");
    }

    await putRepoSecret(
        parsed.owner,
        parsed.repo,
        githubToken.trim(),
        SECRET_NAMES.csrf,
        csrf,
        key,
        keyId
    );

    await putRepoSecret(
        parsed.owner,
        parsed.repo,
        githubToken.trim(),
        SECRET_NAMES.session,
        session,
        key,
        keyId
    );

    return `${parsed.owner}/${parsed.repo}`;
}

function createInputField(label, options) {
    const container = document.createElement("div");
    container.className = "field";

    const title = document.createElement("div");
    title.className = "label";
    title.textContent = label;

    const input = document.createElement("input");
    input.type = options.type;
    input.value = options.value;
    input.placeholder = options.placeholder;
    input.autocomplete = "off";
    input.spellcheck = false;

    container.append(title, input);

    if (options.hint) {
        const hint = document.createElement("div");
        hint.className = "hint";
        hint.textContent = options.hint;
        container.append(hint);
    }

    return { container, input };
}

async function render() {
    const app = document.getElementById("app");
    const cached = await loadCachedInputs();

    const session = await getCookie("LEETCODE_SESSION");
    const csrf = await getCookie("csrftoken");
    const loggedIn = Boolean(session && csrf);

    const title = document.createElement("h2");
    title.textContent = "LeetCode Auth Info";

    const subtitle = document.createElement("div");
    subtitle.className = "subtitle";
    subtitle.textContent = loggedIn
        ? "Sync your LeetCode cookies into GitHub Actions secrets."
        : "Please login to LeetCode first.";

    app.append(title, subtitle);

    if (!loggedIn) {
        const loginBtn = document.createElement("button");
        loginBtn.textContent = "Open Login Page";
        loginBtn.onclick = () => {
            chrome.tabs.create({
                url: "https://leetcode.com/accounts/login/"
            });
        };
        app.append(loginBtn);
        return;
    }

    const repoField = createInputField("Repository URL", {
        type: "text",
        value: cached[STORAGE_KEYS.repoUrl] ?? "",
        placeholder: "https://github.com/owner/repo"
    });

    const tokenField = createInputField("GitHub Token", {
        type: "password",
        value: cached[STORAGE_KEYS.githubToken] ?? "",
        placeholder: "ghp_... or github_pat_...",
        hint: "Needs permission to write repository Actions secrets."
    });

    const persistInputs = () => saveCachedInputs(
        repoField.input.value,
        tokenField.input.value
    );

    repoField.input.addEventListener("input", persistInputs);
    tokenField.input.addEventListener("input", persistInputs);

    const syncBtn = document.createElement("button");
    syncBtn.textContent = "Sync";

    const status = document.createElement("div");
    status.className = "status";

    syncBtn.onclick = async () => {
        status.classList.remove("error", "success");
        status.textContent = "";
        syncBtn.disabled = true;
        syncBtn.textContent = "Syncing...";

        try {
            await persistInputs();
            const repo = await syncSecrets(
                repoField.input.value,
                tokenField.input.value
            );

            status.classList.add("success");
            status.textContent =
                `Saved ${SECRET_NAMES.csrf} and ${SECRET_NAMES.session} on ${repo}.`;
        } catch (error) {
            status.classList.add("error");
            status.textContent = error.message || "Sync failed.";
        } finally {
            syncBtn.disabled = false;
            syncBtn.textContent = "Sync";
        }
    };

    app.append(
        repoField.container,
        tokenField.container,
        syncBtn,
        status
    );
}

render();
