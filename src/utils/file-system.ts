let debug = require("debug")("release-notes:fs");
let fs = require("fs");
let path = require("path");

/**
 * Name could be either
 * - a string for the known templates (with or without .ejs)
 * - a relative path
 * - an absolute path
 */
export const resolveTemplate = (template: string) => {
  debug("Trying to locate template '%s'", template);
  return new Promise(function (resolve, reject) {
    // TODO remove fs.R_OK when we stop supporting node 4 and only use fs.constants.R_OK
    fs.access(template, fs.constants ? fs.constants.R_OK : fs.R_OK, function (error: any) {
      if (error) {
        debug("Template file '%s' doesn't exist, maybe it's template name", template);

        if (template.match(/[a-z]+(\.ejs)?/)) {
          const localPath = path.resolve(__dirname, "../templates/" + path.basename(template, ".ejs") + ".ejs");
          debug("Checking local template file ", localPath);
          // TODO remove fs.R_OK when we stop supporting node 4 and only use fs.constants.R_OK
          fs.access(localPath, fs.constants ? fs.constants.R_OK : fs.R_OK, function (err: any) {
            if (err) reject(new Error(`Unable to locate template file ${template}`));
            else resolve(localPath);
          });
        } else {
          reject(new Error(`Unable to locate template file ${template}`));
        }
      } else {
        resolve(template);
      }
    });
  }).then(readTemplate as any);
};

/**
 * Options could come from file
 */
export const resolveOptions = (originalOptions: any) => {
  const ALL_OPTIONS = [
    ["b", "branch", "master"],
    ["t", "title", "(.*)"],
    ["i", "ignoreCase"],
    ["m", "meaning", "type"],
    ["o", "gitlogOption", []],
    ["p", "path", process.cwd()],
    ["s", "script"],
    ["mg", "mergeCommits"],
    ["c", "copy"],
  ];

  return new Promise(function (resolve, reject) {
    const optionsFile = originalOptions.f || originalOptions.file;
    let options: any = {};
    if (optionsFile) {
      debug("Trying to read configuration file '%s'", optionsFile);
      fs.readFile(optionsFile, function (err: any, data: any) {
        if (err) {
          reject(new Error("Unable to read configuration file\n" + err.message));
        } else {
          try {
            let stored = JSON.parse(data);
            ALL_OPTIONS.forEach(function (pairs) {
              let short: any = pairs[0],
                long: any = pairs[1],
                def = pairs[2];
              let value = [stored[short], stored[long], originalOptions[short], originalOptions[long], def].filter(
                value => value !== undefined
              )[0];
              if (value !== undefined) options[short] = value;
            });
            resolve(options);
          } catch (ex) {
            reject(new Error("Invalid JSON in configuration file"));
          }
        }
      });
    } else {
      ALL_OPTIONS.forEach(function (pairs) {
        let short: any = pairs[0],
          long: any = pairs[1],
          def: any = pairs[2];
        let value = [originalOptions[short], originalOptions[long], def].filter(value => value !== undefined)[0];
        if (value !== undefined) options[short] = value;
      });
      resolve(options);
    }
  });
};

function readTemplate(template: string) {
  debug("Trying to read template '%s'", template);
  return new Promise(function (resolve, reject) {
    fs.readFile(template, function (err: any, templateContent: any) {
      if (err) {
        reject(new Error(`Unable to locate template file ${template}`));
      } else {
        resolve(templateContent.toString());
      }
    });
  });
}
