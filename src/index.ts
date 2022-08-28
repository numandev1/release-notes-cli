let git = require("./utils/git");
let ejs = require("ejs");
let debug = require("debug")("release-notes:cli");
let fileSystem = require("./utils/file-system");
let processCommits = require("./utils/process").processCommits;
let dateFnsFormat = require("date-fns/format");
import type { OPTIONS, ICommit } from "./types";
import * as clipboard from "clipboardy";
import chalk = require("chalk");
const githubUsername = require("./utils/github-username");

export default (cliOptions: OPTIONS, positionalRange: string, positionalTemplate: string = "appstore") => {
  return fileSystem.resolveTemplate(positionalTemplate).then((template: string) => {
    return fileSystem.resolveOptions(cliOptions).then((options: OPTIONS) => {
      debug("Running git log in '%s' on branch '%s' with range '%s'", options.p, options.b, positionalRange);
      return git
        .log({
          branch: options.b,
          range: positionalRange,
          //@ts-ignore
          title: options.i ? new RegExp(options.t, "i") : new RegExp(options.t),
          meaning: Array.isArray(options.m) ? options.m : [options.m],
          cwd: options.p,
          mergeCommits: options.mg,
          additionalOptions: Array.isArray(options.o) ? options.o : [options.o],
        })
        .then((commits: string) => {
          return processCommits(options, commits, positionalRange);
        })
        .then((data: string) => {
          return render(positionalRange, template, data, positionalTemplate, options.c || cliOptions.copy);
        });
    });
  });
};

const render = async (
  range: string,
  templateContent: string,
  data: any,
  type: string = "appstore",
  copy: boolean = false
) => {
  debug("Rendering template");
  let renderedContent = "";
  if (type === "appstore" || type === "changelog") {
    let gitRemote = "";
    let isError = false;
    const allCommits: { [key: string]: ICommit } = commitFormateForAppstore(data.commits);
    if (type === "changelog") {
      gitRemote = await git.gitRemoteOriginUrl();
      for (let [key, value] of Object.entries(allCommits)) {
        //@ts-ignore
        const valueCommits: ICommit[] = value;
        const x = valueCommits.map(async commit => {
          try {
            const username = await githubUsername(commit.committerEmail, { token: process.env.GITHUB_AUTH });
            //@ts-ignore
            commit.username = username;
          } catch (error) {
            isError = true;
          }
        });
        await Promise.all(x);

        renderedContent += ejs.render(templateContent, { title: key, gitRemote, commits: valueCommits }) + "\n";
      }
    } else {
      for (let [key, value] of Object.entries(allCommits)) {
        renderedContent += ejs.render(templateContent, { title: key, commits: value }) + "\n";
      }
    }
    console.log(chalk.magentaBright(renderedContent));
    if (copy) {
      clipboard.writeSync(renderedContent);
      console.log(chalk.green("Copied to clipboard successfully\n"));
    }
    if (isError) {
      console.log(
        chalk.red(
          'You need to get personal access token from github for setting committer username like this:\n\nexport GITHUB_AUTH="..."'
        )
      );
    }
    return;
  }

  renderedContent = ejs.render(
    templateContent,
    Object.assign(
      {
        range: range,
        dateFnsFormat: dateFnsFormat,
      },
      data
    )
  );
  console.log(renderedContent);
  if (copy) {
    clipboard.writeSync(renderedContent);
    console.log(chalk.green("Copied to clipboard successfully\n"));
  }
};

const commitLintTypes: string[] = [
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "style",
  "test",
];

const commitLintTypesMapper: string[] = [
  "build",
  "Others",
  "ci",
  "docs",
  "Features",
  "Fixes",
  "perf",
  "Changed",
  "revert",
  "style",
  "test",
];

const commitFormateForAppstore = (commits: ICommit[]) => {
  let obj: any = {};
  commits.forEach(commit => {
    const index = commitLintTypes.findIndex(commitLintType => commit.title.includes(commitLintType));
    commit.title = removeCommitHeader(commit.title);
    if (index > -1) {
      if (obj[commitLintTypesMapper[index]]) {
        obj = {
          ...obj,
          [commitLintTypesMapper[index]]: obj[commitLintTypesMapper[index]].concat(commit),
        };
      } else {
        obj = {
          ...obj,
          [commitLintTypesMapper[index]]: [commit],
        };
      }
    }
  });
  return obj;
};

const removeCommitHeader = (commitTitle: string) => {
  const removeRegex =
    /^(?<type>build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test|¯\\_\(ツ\)_\/¯)(?<scope>\(\w+\)?((?=:\s)?|(?=!:\s)))?:?/;
  return commitTitle.replace(removeRegex, "");
};
