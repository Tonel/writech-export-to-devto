/* eslint-disable no-undef */
const axios = require("axios");
const fs = require("fs");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getDevToPublishedPosts() {
  console.log("Retrieving published posts from dev.to...");

  const response = await axios.get("https://dev.to/api/articles", {
    params: {
      per_page: 1000,
      username: "antozanini",
    },
  });

  const posts = response.data;

  console.log(`${posts.length} posts found`);

  return posts;
}

async function createDevToPosts(posts) {
  const updatedPosts = [...posts];

  const publishedPosts = await getDevToPublishedPosts();

  const publishedPostTitles = publishedPosts.map((p) => p.title);

  for (const post of posts) {
    if (!publishedPostTitles.includes(post.meta.title)) {
      console.log(`Trying to publish "${post.meta.title}" to dev.to...`);

      const devToCreationBody = {
        article: {
          title: post.meta.title,
          body_markdown: post.content,
          published: true,
          main_image: post.meta.cover_image,
          description: post.meta.description,
          tags: post.meta.tags,
          organization_id: 8181,
        },
      };

      try {
        const devToApiKey = process.env.DEV_TO_API_KEY;
        const newPost = await axios.post(
          "https://dev.to/api/articles",
          devToCreationBody,
          {
            headers: {
              "api-key": devToApiKey,
              "content-type": "application/json",
            },
          }
        );

        const canonicalUrl = newPost.url;
        const currentPost = updatedPosts.find(
          (p) => p.meta.id === post.meta.id
        );
        currentPost.meta["canonicalUrl"] = canonicalUrl;

        console.log(
          "WARNING: Remember to update the canonical link on Writech.run!"
        );

        console.log("Post published!");
      } catch (e) {
        console.error(e);
        return;
      }

      // to avoid overloading the Dev.to server
      // with too many requests
      await sleep(1500);
    }
  }

  return updatedPosts;
}

async function getHashnodePublishedPosts() {
  console.log("\nRetrieving published posts from hashnode.com...");

  const posts = [];
  let cursor = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await axios.post("https://gql.hashnode.com/", {
      query: `query {
                  publication(id: "65aaf3fad2dea01749fea5f7") {
                    posts(first: 5 ${cursor ? `, after: "${cursor}"` : ""}) {
                      edges {
                        cursor
                        node {
                          id
                          title
                        }
                      }
                    }
                  }
                }
        `,
    });

    const newPosts = response.data.data.publication.posts.edges;
    if (newPosts.length === 0) {
      break;
    }
    posts.push(...newPosts);

    cursor = newPosts[newPosts.length - 1].cursor;

    await sleep(500);
  }

  console.log(`${posts.length} posts found`);

  return posts;
}

async function createHashnodePosts(posts) {
  const publishedPosts = await getHashnodePublishedPosts();

  const publishedPostTitles = publishedPosts.map((p) => p.node.title);

  for (const post of posts) {
    if (!publishedPostTitles.includes(toHashNodeString(post.meta.title))) {
      console.log(`Trying to publish "${post.meta.title}" to hasnode.com...`);
      try {
        const hashnodeApiKey = process.env.HASHNODE_API_KEY;

        const hashnodeCreationBody = {
          query: `mutation {
      publishPost(input: {
        title: "${toHashNodeString(post.meta.title)}"
        subtitle: "${toHashNodeString(post.meta.subtitle)}"
        publicationId: "65aaf3fad2dea01749fea5f7"
        contentMarkdown: ${JSON.stringify(post.content)}
        slug: "${post.meta.slug}"
        publishedAt: "${post.meta.date}"
        originalArticleURL: "${post.meta.canonical_url}"
        coverImageOptions: {
          coverImageURL: "${post.meta.cover_image}"
        }
        metaTags: {
          title: "${toHashNodeString(post.meta.title)}"
          description: "${toHashNodeString(post.meta.description)}"
        }
        tags: [${post.meta.tags
          .map((t) => {
            return `{
            slug: "${t.toLowerCase()}"
            name: "${capitalizeFirstLetter(t)}"
          }`;
          })
          .join(", \n")}]
      }) {
        post {
          id
          title
        }
      }
    }
      `,
        };
        response = await axios.post(
          "https://gql.hashnode.com/",
          hashnodeCreationBody,
          {
            headers: {
              Authorization: hashnodeApiKey,
            },
          }
        );
        console.log("Post published!");
      } catch (e) {
        console.error(e);
        return;
      }

      // to avoid overloading the Dev.to server
      // with too many requests
      await sleep(1500);
    }
  }
}

function toHashNodeString(str) {
  return str.replace(/"/g, "'");
}

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function updateCanonicalLinks(posts) {
  const devToPublishedPosts = await getDevToPublishedPosts();
  const hashnodePublishedPosts = await getHashnodePublishedPosts();

  for (const post of posts) {
    const currentDevToPost = devToPublishedPosts.find(
      (p) => p.title === post.meta.title
    );
    if (currentDevToPost) {
      console.log(
        `Removing canonical link from dev.to article "${post.meta.title}"...`
      );

      const devToApiKey = process.env.DEV_TO_API_KEY;

      const originalDevToPost = await axios.get(
        `https://dev.to/api/articles/${currentDevToPost.id}`,
        {
          headers: {
            "api-key": devToApiKey,
            "content-type": "application/json",
          },
        }
      );

      const devToPostUpdateBody = {
        article: {
          title: currentDevToPost.title,
          body_markdown: originalDevToPost.data.body_markdown,
          published: true,
          main_image: currentDevToPost.cover_image,
          description: currentDevToPost.description,
          tags: currentDevToPost.tags,
          organization_id: 8181,
          canonical_url: "",
        },
      };

      try {
        await axios.put(
          `https://dev.to/api/articles/${currentDevToPost.id}`,
          devToPostUpdateBody,
          {
            headers: {
              "api-key": devToApiKey,
              "content-type": "application/json",
            },
          }
        );
        console.log("Canonical link removed!");
      } catch (e) {
        console.error(e);
        return;
      }
    }

    const currentHashnodePost = hashnodePublishedPosts.find(
      (p) =>
        toHashNodeString(p.node.title) === toHashNodeString(post.meta.title)
    );
    if (currentHashnodePost) {
      console.log(
        `Adding canonical link to Hashnode article "${post.meta.title}"...`
      );

      try {
        const hashnodeApiKey = process.env.HASHNODE_API_KEY;

        const hashnodeUpdateBody = {
          query: `mutation {
            updatePost(input: {
                id: "${currentHashnodePost.node.id}"
                originalArticleURL: "${currentDevToPost.url}"
            }) {
              post {
                id
                title
              }
            }
          }
    `,
        };
        response = await axios.post(
          "https://gql.hashnode.com/",
          hashnodeUpdateBody,
          {
            headers: {
              Authorization: hashnodeApiKey,
            },
          }
        );
        console.log("Canonical link added!");
      } catch (e) {
        console.error(e);
        return;
      }
    }
  }
}

async function writeCanonicalLinkUpdateQuery(posts) {
  const devToPublishedPosts = await getDevToPublishedPosts();

  let query = "";

  for (const post of posts) {
    const currentDevToPost = devToPublishedPosts.find(
      (p) => p.title === post.meta.title
    );
    if (currentDevToPost) {
      query += `UPDATE wp_yoast_indexable SET canonical="${currentDevToPost.url}" WHERE permalink="${post.meta.url}/"; \n`;
    }
  }

  fs.writeFileSync("query.txt", query);
}

exports.createDevToPosts = createDevToPosts;
exports.createHashnodePosts = createHashnodePosts;
exports.updateCanonicalLinks = updateCanonicalLinks;
exports.writeCanonicalLinkUpdateQuery = writeCanonicalLinkUpdateQuery;
