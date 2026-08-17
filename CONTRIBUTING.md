# Contributing / 贡献指南

Thanks for improving `dsh-plugin-weaknet-adaptor`.

## Local setup / 本地开发

```bash
npm install
npm run check
npm pack --dry-run
```

`npm run check` validates both halves with Node syntax checks. The Host half is `lib/index.js`; the browser bundle is `lib/client.js`.

## Pull requests / 提交 PR

- Keep Host and Client changes in the same PR when they change an RPC contract.
- Test a browser change by restarting `dsh web`, then hard-refreshing the page.
- Include the DSH version, plugin version, and browser/host logs for bug fixes.
- Update `CHANGELOG.md` for user-visible fixes or features.

## Release / 发布

1. Update the version in `package.json` and `CHANGELOG.md`.
2. Run `npm run check` and `npm pack --dry-run`.
3. Publish with `npm publish`.
4. Commit, tag `vX.Y.Z`, then push the branch and tag.
