// Shared sign-in for the members' pages. The GitHub token is entered once on
// index.html and kept in this browser's localStorage (same key the board has
// always used, so existing sign-ins carry over). Pages that need it call
// requireToken(), which sends a visitor without one back to sign in.
// Nothing here is secret: the private data lives in private repositories,
// and GitHub only answers with a token that can see them.

const CS = {
  KEY: "cagedsquirrel.board.token",
  OWNER: "Cagedsquirrel",
  BOARD_REPO: "converse-here",
  STATUS_REPO: "tunnel-status",
  STATUS_FILE: "dot113.json"
};

function csGetToken() {
  try { return localStorage.getItem(CS.KEY) || ""; } catch (e) { return ""; }
}

function csSaveToken(token) {
  try { localStorage.setItem(CS.KEY, token); } catch (e) { /* storage unavailable */ }
}

function csSignOut() {
  try {
    localStorage.removeItem(CS.KEY);
    localStorage.removeItem("cagedsquirrel.connection");
  } catch (e) { /* ignore */ }
  location.href = "index.html";
}

function csRequireToken() {
  const token = csGetToken();
  if (!token) location.replace("index.html");
  return token;
}

async function csGitHub(path, token, accept) {
  return fetch("https://api.github.com" + path, {
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": accept || "application/vnd.github+json"
    },
    cache: "no-store"
  });
}

// Who the token belongs to. Throws with a plain message when it doesn't work.
async function csWhoAmI(token) {
  let res;
  try { res = await csGitHub("/user", token); }
  catch (e) { throw new Error("Couldn't reach GitHub. Check your connection."); }
  if (res.status === 401) throw new Error("GitHub didn't accept that token. It may be mistyped or expired.");
  if (!res.ok) throw new Error("GitHub answered " + res.status + ".");
  return (await res.json()).login;
}

async function csCanSee(repo, token) {
  try {
    const res = await csGitHub("/repos/" + CS.OWNER + "/" + repo, token);
    return res.ok;
  } catch (e) { return false; }
}

// The machine's current tunnel address (and Meta-System token, when it
// publishes one), from the private tunnel-status repository.
async function csTunnelInfo(token) {
  const res = await csGitHub(
    "/repos/" + CS.OWNER + "/" + CS.STATUS_REPO + "/contents/" + CS.STATUS_FILE,
    token, "application/vnd.github.raw+json");
  if (res.status === 401) throw new Error("GitHub didn't accept the saved token. Sign out and sign in again.");
  if (res.status === 404 || res.status === 403) {
    // A fine-grained token can see a repository (metadata) without being
    // allowed to read its files, so tell the two cases apart.
    if (await csCanSee(CS.STATUS_REPO, token)) {
      throw new Error("Your token can see the tunnel-status repository but can't read its files. On GitHub, edit the token and set Repository permissions, Contents, to Read-only.");
    }
    throw new Error("Your token can't see the tunnel-status repository. Add it to the token's selected repositories on GitHub.");
  }
  if (!res.ok) throw new Error("GitHub answered " + res.status + ".");
  return res.json();
}
