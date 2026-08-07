async function getCurrentTab() {
    const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    return tabs[0];
}

async function getCookie(name) {
    const cookie = await chrome.cookies.get({
        url: "https://leetcode.com",
        name
    });

    return cookie?.value ?? null;
}

function mask(value) {
    if (!value) return "";

    if (value.length <= 8) {
        return "*".repeat(value.length);
    }

    return "*".repeat(value.length - 8) + value.slice(-8);
}

function createCookieField(label, value) {
    const container = document.createElement("div");
    container.className = "field";

    const title = document.createElement("div");
    title.className = "label";
    title.textContent = label;

    const valueBox = document.createElement("div");
    valueBox.className = "value-box";
    valueBox.textContent = mask(value);

    let visible = false;

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "secondary";
    toggleBtn.textContent = "Show";

    toggleBtn.onclick = () => {
        visible = !visible;

        valueBox.textContent = visible
            ? value
            : mask(value);

        toggleBtn.textContent = visible
            ? "Hide"
            : "Show";
    };

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy";

    copyBtn.onclick = async () => {
        await navigator.clipboard.writeText(value);

        const old = copyBtn.textContent;
        copyBtn.textContent = "Copied!";

        setTimeout(() => {
            copyBtn.textContent = old;
        }, 1000);
    };

    const actions = document.createElement("div");
    actions.className = "actions";

    actions.append(toggleBtn, copyBtn);

    container.append(
        title,
        valueBox,
        actions
    );

    return container;
}

async function render() {

    const app = document.getElementById("app");

    const tab = await getCurrentTab();

    const isLeetCode =
        tab?.url?.startsWith("https://leetcode.com");

    if (!isLeetCode) {

        const wrapper = document.createElement("div");
        wrapper.className = "info";

        const msg = document.createElement("div");
        msg.className = "message";
        msg.textContent =
            "You are not currently on LeetCode.";

        const btn = document.createElement("button");
        btn.className = "open-btn";
        btn.textContent = "Open LeetCode";

        btn.onclick = () => {
            chrome.tabs.create({
                url: "https://leetcode.com"
            });
        };

        wrapper.append(msg, btn);

        app.append(wrapper);

        return;
    }

    const session =
        await getCookie("LEETCODE_SESSION");

    if (!session) {

        const wrapper = document.createElement("div");
        wrapper.className = "info";

        const msg = document.createElement("div");
        msg.className = "message";
        msg.textContent =
            "Please login first.";

        const btn = document.createElement("button");
        btn.textContent = "Open Login Page";

        btn.onclick = () => {
            chrome.tabs.create({
                url: "https://leetcode.com/accounts/login/"
            });
        };

        wrapper.append(msg, btn);

        app.append(wrapper);

        return;
    }

    const csrf =
        await getCookie("csrftoken");

    const title = document.createElement("h2");
    title.textContent = "LeetCode Auth Info";

    app.append(title);

    app.append(
        createCookieField(
            "API Token",
            csrf
        )
    );

    app.append(
        createCookieField(
            "Session ID",
            session
        )
    );
}

render();