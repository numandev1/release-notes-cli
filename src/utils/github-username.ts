const { Octokit } = require("@octokit/rest");

async function searchCommits(octokit: any, email: string) {
  const { data } = await octokit.search.commits({
    q: `author-email:${email}`,
    sort: "author-date",
    // eslint-disable-next-line camelcase
    per_page: 1,
  });

  if (data.total_count === 0) {
    throw new Error(`Couldn't find username for \`${email}\``);
  }

  return data.items[0].author.login;
}

//@ts-ignore
module.exports = async function githubUsername(email: string, { token } = {}) {
  if (!(typeof email === "string" && email.includes("@"))) {
    throw new Error("Email required");
  }

  const octokit = new Octokit({
    auth: token,
    userAgent: "https://github.com/nomi9995/github-username",
  });

  const { data } = await octokit.search.users({
    q: `${email} in:email`,
  });

  if (data.total_count === 0) {
    return searchCommits(octokit, email);
  }

  return data.items[0].login;
};
