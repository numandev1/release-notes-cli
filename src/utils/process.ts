let fs = require("fs");
let path = require("path");
let vm = require("vm");
//@ts-ignore
let debug = require("debug")("release-notes:process");
let dateFnsFormat = require("date-fns/format");

exports.processCommits = function processCommits(options: any, commits: any[], range: string) {
  debug("Got %d commits", commits.length);
  if (commits.length === 0) {
    return Promise.reject(new Error(`No commits in the specified range: ${range}`));
  }

  let funcOrPath = options.s || options.script;
  if (!funcOrPath) {
    debug("Rendering template without post processing");
    return Promise.resolve({ commits: commits });
  }

  let inputData = {
    commits,
    range,
    dateFnsFormat,
  };

  if (typeof funcOrPath === "function") {
    let externalFunction = funcOrPath;

    return new Promise((resolve, reject) => {
      try {
        externalFunction(
          Object.assign(inputData, {
            debug: require("debug")("release-notes:externalfunction"),
          }),
          function (outputData: any) {
            resolve(outputData);
          }
        );
      } catch (e: any) {
        debug("Exception while running external function '%s'", e.message);
        reject(new Error(`Error while processing external function`));
      }
    });
  }

  let externalScriptPath = funcOrPath;
  return new Promise(function (resolve, reject) {
    debug(`Trying to run the external script from ${externalScriptPath}`);
    fs.readFile(externalScriptPath, function (err: any, scriptBuffer: any) {
      if (err) {
        reject(new Error(`Unable to read script file ${externalScriptPath}: ${err.message}`));
      } else {
        let sandbox = {
          module: { exports: {} },
          require: (module: any) => {
            let resolved = module.indexOf("./") === 0 ? path.resolve(path.dirname(externalScriptPath), module) : module;
            return require(resolved);
          },
          __dirname: path.dirname(externalScriptPath),
          __filename: externalScriptPath,
          process: process,
          console: console,
        };
        debug("Trying to run the external script in a new sandbox");
        try {
          vm.runInNewContext(scriptBuffer.toString(), sandbox, {
            filename: externalScriptPath,
            displayErrors: true,
          });

          debug(`Calling the external script function with ${JSON.stringify(inputData, null, "  ")}`);
          let debugScript = require("debug")("release-notes:externalscript");
          //@ts-ignore
          sandbox.module.exports(
            Object.assign(inputData, {
              debug: debugScript,
            }),
            function (outputData: any) {
              try {
                debugScript(
                  "Output data received from the external script `%s`",
                  JSON.stringify(outputData || {}, null, "  ")
                );
              } catch (ex) {
                /* ignore just in case there are circular references */
              }
              resolve(outputData);
            }
          );
        } catch (ex: any) {
          debug("Exception while running external script '%s'", ex.message);
          reject(new Error(`Error while processing external script`));
        }
      }
    });
  });
};
