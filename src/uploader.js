/* eslint-disable no-undef */
const axios = require("axios");

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
  const publishedPosts = await getDevToPublishedPosts();

  const publishedPostCanonicalUrls = publishedPosts.map((p) => p.canonical_url);

  for (const post of posts) {
    if (!publishedPostCanonicalUrls.includes(post.meta.canonical_url)) {
      console.log(`Trying to publish "${post.meta.title}" to dev.to...`);

      const devToCreationBody = {
        article: {
          title: post.meta.title,
          body_markdown: post.content,
          published: true,
          main_image: post.meta.cover_image,
          canonical_url: post.meta.canonical_url,
          description: post.meta.description,
          tags: post.meta.tags,
          organization_id: 8181,
        },
      };

      try {
        const devToApiKey = process.env.DEV_TO_API_KEY;
        await axios.post("https://dev.to/api/articles", devToCreationBody, {
          headers: {
            "api-key": devToApiKey,
            "content-type": "application/json",
          },
        });

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
                          canonicalUrl
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

  const publishedPostCanonicalUrls = publishedPosts.map(
    (p) => p.node.canonicalUrl
  );

  for (const post of posts) {
    if (!publishedPostCanonicalUrls.includes(post.meta.canonical_url)) {
      console.log(`Trying to publish "${post.meta.title}" to hasnode.com...`);
      try {
        const hashnodeApiKey = process.env.HASHNODE_API_KEY;

        const hashnodeCreationBody = {
          query: `mutation {
      publishPost(input: {
        title: "${post.meta.title.replace(/"/g, "'")}"
        subtitle: "${post.meta.subtitle.replace(/"/g, "'")}"
        publicationId: "65aaf3fad2dea01749fea5f7"
        contentMarkdown: ${JSON.stringify(post.content)}
        slug: "${post.meta.slug}"
        publishedAt: "${post.meta.date}"
        originalArticleURL: "${post.meta.canonical_url}"
        coverImageOptions: {
          coverImageURL: "${post.meta.cover_image}"
        }
        metaTags: {
          title: "${post.meta.title.replace(/"/g, "'")}"
          description: "${post.meta.description.replace(/"/g, "'")}"
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

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

exports.createDevToDrafts = createDevToPosts;
exports.createHashnodePosts = createHashnodePosts;
