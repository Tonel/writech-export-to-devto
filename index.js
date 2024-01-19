require('dotenv').config();

const path = require("path");
const parser = require("./src/parser");
const writer = require("./src/writer");
const xmlCreator = require("./src/xmlCreator");

(async () => {
  const config = {
    input: "export.xml",
    output: "output",
    yearFolders: false,
    monthFolders: false,
    postFolders: false,
    prefixDate: false,
    saveAttachedImages: false,
    saveScrapedImages: false,
    includeOtherTypes: false,
  };

  // write the XML export file locally
  await xmlCreator.writeXMLExportFile();

  // parse data from XML and do Markdown translations
  const posts = await parser.parseFilePromise(config);

  // write files, downloading images as needed
  await writer.writeFilesPromise(posts, config);

  // happy goodbye
  console.log("\nAll done!");
  console.log("Look for your output files in: " + path.resolve(config.output));
})().catch((ex) => {
  // sad goodbye
  console.log("\nSomething went wrong, execution halted early.");
  console.error(ex);
});
