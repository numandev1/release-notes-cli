//@ts-ignore
let debug = require("debug")("release-notes:git");
let parser = require("debug")("release-notes:parser");
const gitconfig = require("gitconfiglocal");
const { promisify } = require("util");
const pGitconfig = promisify(gitconfig);

exports.log = function (options: any) {
  return new Promise(function (resolve, reject) {
    let spawn = require("child_process").spawn;
    let gitArgs = ["log", "--no-color"];
    if (options.additionalOptions && options.additionalOptions.length > 0) {
      options.additionalOptions.forEach(function (o: any) {
        gitArgs.push("--" + o);
      });
    } else {
      gitArgs.push(options.mergeCommits ? "--merges" : "--no-merges");
    }
    gitArgs.push("--branches=" + options.branch, "--format=" + formatOptions, "--decorate=full", options.range);
    debug("Spawning git with args %o", gitArgs);
    let gitLog = spawn("git", gitArgs, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", process.stderr],
    });

    let allCommits = "";
    gitLog.stdout.on("data", function (data: string) {
      allCommits += data;
    });

    gitLog.on("exit", function (code: number) {
      debug("Git command exited with code '%d'", code);
      if (code === 0) {
        allCommits = normalizeNewlines(allCommits).trim();

        if (allCommits) {
          // Build the list of commits from git log
          let commits = processCommits(allCommits, options);
          resolve(commits);
        } else {
          resolve([]);
        }
      } else {
        // propagate error code
        reject(new Error("Git log exited with error code " + code));
      }
    });
  });
};

let newCommit = "___";
const formatOptions = [
  newCommit,
  "sha1:%H",
  "authorName:%an",
  "authorEmail:%ae",
  "authorDate:%aD",
  "committerName:%cn",
  "committerEmail:%ce",
  "committerDate:%cD",
  "title:%s",
  "%D",
  "%w(80,1,1)%b",
].join("%n");

function processCommits(commitMessages: string, options: any) {
  // This return an object with the same properties described above
  let stream = commitMessages.split("\n");
  let commits: any[] = [];
  let workingCommit: any;
  parser("Iterating on %d lines", stream.length);
  stream.forEach(function (rawLine) {
    parser("Raw line\n\t%s", rawLine);
    let line: any = parseLine(rawLine);
    parser("Parsed line %o", line);
    if (line.type === "new") {
      workingCommit = {
        messageLines: [],
      };
      commits.push(workingCommit);
    } else if (line.type === "message") {
      workingCommit.messageLines.push(line.message);
    } else if (line.type === "title") {
      let title = parseTitle(line.message, options);
      parser("Parsed title %o", title);
      for (let prop in title) {
        workingCommit[prop] = title[prop];
      }
      if (!workingCommit.title) {
        // The parser doesn't return a title
        workingCommit.title = line.message;
      }
    } else if (line.type === "tag") {
      parser("Trying to parse tag %o", line.message);
      let tag = parseTag(line.message);
      parser("Parse tag %o", tag);
      workingCommit[line.type] = tag;
    } else {
      workingCommit[line.type] = line.message;
    }
  });
  return commits;
}

function parseLine(line: string) {
  if (line === newCommit) {
    return {
      type: "new",
    };
  }

  let match = line.match(/^([a-zA-Z]+1?)\s?:\s?(.*)$/i);

  if (match) {
    return {
      type: match[1],
      message: match[2].trim(),
    };
  } else {
    return {
      type: "message",
      message: line.substring(1), // padding
    };
  }
}

function parseTitle(title: string, options: any) {
  let expression = options.title;
  let names = options.meaning || [];
  parser("Parsing title '%s' with regular expression '%s' and meanings %o", title, expression, names);

  let match = title.match(expression);
  if (!match) {
    return {
      title: title,
    };
  } else {
    let builtObject: any = {};
    for (let i = 0; i < names.length; i += 1) {
      let name = names[i];
      let index = i + 1;
      builtObject[name] = match[index];
    }
    return builtObject;
  }
}

function parseTag(line: string) {
  let refs = line.split(/(refs)\/(tags|remotes|heads)\//);
  let tagIndex = refs.findIndex(
    (token: any, index: number, all: any[]) => all[index - 2] === "refs" && all[index - 1] === "tags"
  );
  if (tagIndex === refs.length - 1) {
    return refs[tagIndex];
  }
  return refs[tagIndex].replace(/, $/, "");
}

function normalizeNewlines(message: string) {
  return message.replace(/\r\n?|[\n\u2028\u2029]/g, "\n").replace(/^\uFEFF/, "");
}

export async function gitRemoteOriginUrl({ cwd = process.cwd(), remoteName = "origin" } = {}) {
  const config = await pGitconfig(cwd);
  const url: string = (config.remote && config.remote[remoteName] && config.remote[remoteName].url) || "";

  return url.replace(/\.git$/, "");
}
