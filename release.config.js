module.exports = {
  branches: [
    "master",
    {
      name: "alpha/*",
      prerelease: "alpha",
      channel: "alpha",
    },
  ],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/npm",
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "package-lock.json"],
      },
    ],
  ],
};
