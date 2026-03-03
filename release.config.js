module.exports = {
  branches: ["master"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/npm",
    [
      "@semantic-release/exec",
      {
        prepareCmd: "npm run generate:artifacts",
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: [
          "package.json",
          "package-lock.json",
          ".cursor-plugin/plugin.json",
          ".claude-plugin/plugin.json",
          "src/generated/opencode.managed.json",
        ],
      },
    ],
  ],
};
