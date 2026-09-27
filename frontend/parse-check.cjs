// Temporary syntax check for the files touched in this fix. Delete after use.
const fs = require("fs");
const path = require("path");
const babel = require("@babel/parser");

const files = [
    "src/App.js",
    "src/pages/StudyGroups.jsx",
    "src/components/studygroup/GroupBrowser.jsx",
    "src/components/layout/AppLayout.jsx",
];

let failed = false;
for (const file of files) {
    const source = fs.readFileSync(path.resolve(__dirname, file), "utf8");
    try {
        babel.parse(source, { sourceType: "module", plugins: ["jsx"] });
        console.log("OK   " + file);
    } catch (err) {
        failed = true;
        console.log("FAIL " + file + " :: " + err.message);
    }
}
process.exit(failed ? 1 : 0);
