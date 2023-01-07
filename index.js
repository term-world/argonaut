const github = require('@actions/github');
const core = require('@actions/core');

const fs = require('fs');
const path = require('path');
const util = require('util');
const yaml = require('js-yaml');

//const octokit = github.getOctokit(
//    process.env.GITHUB_TOKEN
//);

const exec = util.promisify(require('child_process').exec);

const loadFile = (filename) => util.promisify(fs.readFile)(filename, 'utf8');
const writeFile = (filename) => util.promisify(fs.writeFile)(filepath, data);

const loadGrader = async (checks) => {
    let definitions = await loadFile(
      `${process.cwd()}/.gatorgrade.yml`
    );
    let data = yaml.load(definitions);
    return data;
}

const cleanLines = (lines) => {
    // Remove blanks
    lines = lines.filter(line => line);
    // Trim whitespace
    lines = lines.map(line => line.trim());
    // Remove duplicates
    return [...new Set(lines)];
}

const assignStatus = (obj) => {
    let check = {};
    Object.keys(obj).some((key) => {
      if(key == "description") {
        Object.keys(obj).some((value) => {
            check[value] = obj[value]
        })
        check.status = "✘"
        return true;
      }
      if(typeof obj[key] === "object"){
        check = assignStatus(obj[key]);
        return check !== undefined;
      }
    });
    return check;
}

const getChecks = (result, grader) => {
    let checks = [];
    for(let spec of grader) {
      let check = assignStatus(spec);
      checks.push(check);
    }
    Object.values(checks).some((check) => {
      if(result.passed.includes(check.description))
        check.status = "✔";
    });
    return checks;
}

const groupChecks = (checks) => {
    return Array.from(
      checks.reduce((prev, next) => {
        prev.set(
          next.status,
          (prev.get(next.status) || []).concat(next)
        )
        delete next.status;
        return prev
      }, new Map).entries(),
      ([status, specifications]) => ({status, specifications})
    )
}
  
const getResult = (lines) => {
    // Separate checks from irrelevant lines
    let checkSymbols = ["✔","✘","✓","✕"]; //,"➔","→"];
    let regexp = new RegExp(
        `(${checkSymbols.join("|")})`,
        "g"
    );
    lines = lines.filter(line => !line.search(regexp));
    // Sort checks into object
    let checks = {
      "passed": [],
      "failed": []
    };
    for(let check of lines) {
      // Get success or failure
      let status = check[0];
      // Retrieve the body of the check
      let body = check.substring(1).trim();
      if(status == "✔" || status == "✓") 
        checks.passed.push(body)
      else checks.failed.push(body);
    }
    return checks;
}

const run = async () => {
  // Acquire checks from cached file
  const {stdout, stderr} = await exec(
    "gatorgrade --config .gatorgrade.yml"
  );
  let report = stderr;
  let lines = cleanLines(
      report.split("\n")
  );
  // Separate parsed checks and grader file
  let result = getResult(lines);
  let grader = await loadGrader(result);
  // Turn results into checks
  let checks = getChecks(result, grader);
  let grouped = groupChecks(checks);
  //let grouped = groupChecks(checks);
  let json = JSON.stringify(grouped);
  console.log(json);
  // FINISH HIM
  //writeFile(json);
};

run();