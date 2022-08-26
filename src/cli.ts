import chalk = require("chalk");
import index from "./index";
export async function run() {
  const argv = require("yargs")
    .usage("release-notes-cli [<options>] <since>..<until> <template>")
    .demandCommand(1)
    .example(
      'release-notes-cli -t "(feat|bug): (.*)" -m type -m title v1.0.0..v2.0.0 appstore/markdown/html',
      "Match all commits with starting with either `feat:` or `bug` between the tags `v1.0.0` and `v2.0.0`"
    )
    .wrap(null)
    .option("f", {
      alias: "file",
      describe: "Configuration file. Use it instead of passing command line options",
    })
    .option("p", {
      alias: "path",
      describe: "Git project path. Defaults to the current path",
      default: process.cwd(),
    })
    .option("t", {
      alias: "title",
      describe: "Commit title regular expression",
      default: "(.*)",
    })
    .option("i", {
      alias: "ignore-case",
      describe: "Ignore case of title's regular expression",
      type: "boolean",
    })
    .option("m", {
      alias: "meaning",
      describe: "Meaning of capturing block in title's regular expression",
      default: ["type"],
    })
    .option("b", {
      alias: "branch",
      describe: "Git branch, defaults to master",
      default: "master",
      type: "string",
    })
    .option("s", {
      alias: "script",
      describe: "External script to rewrite the commit history",
    })
    .option("o", {
      alias: "gitlog-option",
      describe: "Additional git log options AND ignore 'c' option",
      default: [],
    })
    .option("mg", {
      alias: "merge-commits",
      describe: "Only use merge commits",
      type: "boolean",
    })
    .option("c", {
      alias: "copy",
      describe: "for copy log into clipboard",
      default: false,
      type: "boolean",
    }).argv;
  index(argv, argv._[0], argv._[1])
    .then((output: any) => {})
    .catch((error: any) => {
      require("yargs").showHelp();
      console.log(chalk.red(error.message));
      process.exit(1);
    });
}
