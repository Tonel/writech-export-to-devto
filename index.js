require("dotenv").config();

const parser = require("./src/parser");
const xmlCreator = require("./src/xmlCreator");
const uploader = require("./src/uploader");

(async () => {
  // write the XML export file locally
  await xmlCreator.writeXMLExportFile();

  // parse data from XML and do Markdown translations
  const posts = await parser.parseFilePromise();

  // import articles in dev.to
  const updatedPosts = await uploader.createDevToPosts(posts);
  // import articles in hashnode.come
  await uploader.createHashnodePosts(updatedPosts);

  console.log("\nAll done!");
})().catch((ex) => {
  console.log("\nSomething went wrong, execution halted early.");
  console.error(ex);
});
