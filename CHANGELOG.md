# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- BREAKING: replaced `-D, --downloader` with `-S, --source`, introduced the `-D, --check-dir` flag. <https://github.com/miraclx/freyr-js/pull/350>
- BREAKING: replaced the `.downloader.order` entry in the config file with `.downloader.sources`. <https://github.com/miraclx/freyr-js/pull/350>
- Implemented ability to check for track existence in other directories. <https://github.com/miraclx/freyr-js/pull/350>
- Fix YouTube feed sourcing logic after dependency update. <https://github.com/miraclx/freyr-js/pull/299>
- Update minimum Node.js version to `v14`. <https://github.com/miraclx/freyr-js/pull/293>
- Remove the temporary image downloaded when an error is detected. <https://github.com/miraclx/freyr-js/commit/5e7f5513bad9fd7366cd5bf562a516584308c74f>
- Revamp the test runner. <https://github.com/miraclx/freyr-js/pull/303>, <https://github.com/miraclx/freyr-js/pull/304>

## [0.8.1] - 2022-08-04

- Ensure maximum compatibility with axios when npm fails to install an expected version. <https://github.com/miraclx/freyr-js/pull/291>

## [0.8.0] - 2022-08-04

- Refactored the Dockerfile, and reduced the docker image size by 23%. <https://github.com/miraclx/freyr-js/issues/257>
- Manually compile `AtomicParsley` during docker build to allow for maximum platform support. <https://github.com/miraclx/freyr-js/pull/212>
- Add Mac M1 support to the docker image. <https://github.com/miraclx/freyr-js/pull/214>
- Made docker build faster by caching and unbinding nondependent layers. <https://github.com/miraclx/freyr-js/pull/273>, <https://github.com/miraclx/freyr-js/pull/268>
- Fix `yarn install` not ahering to dependency overrides. <https://github.com/miraclx/freyr-js/pull/215>
- Add ability to disable the progressbar. <https://github.com/miraclx/freyr-js/pull/263>
- Remove persistent `tty` writing for normal logs. Allowing `stdout` piping for everything except the progressbar. <https://github.com/miraclx/freyr-js/pull/231>
- Fix long standing issue with freyr seeming frozen on exit. <https://github.com/miraclx/freyr-js/pull/216>
- Upgraded to ES6 Modules. <https://github.com/miraclx/freyr-js/pull/202>
- Introduced the pushing of docker images for each PR. <https://github.com/miraclx/freyr-js/pull/218>, <https://github.com/miraclx/freyr-js/pull/228>
- Introduced a test runner, with local reproducible builds. <https://github.com/miraclx/freyr-js/pull/264>
- Redesigned the auth page a bit. <https://github.com/miraclx/freyr-js/pull/286>
- Introduced CI checks for formatting.
- Updated dependencies.
- Removed some unused dependencies. <https://github.com/miraclx/freyr-js/pull/217>, <https://github.com/miraclx/freyr-js/pull/245>

## [0.7.0] - 2022-06-09

- Updated Apple Music access key. <https://github.com/miraclx/freyr-js/pull/191>
- Simplified the output of using the `-v, --version`. <https://github.com/miraclx/freyr-js/pull/152>
- Dropped extra version in the header. <https://github.com/miraclx/freyr-js/pull/153>
- Fixed issue with docker build not bundling dependencies. <https://github.com/miraclx/freyr-js/pull/165>
- Update dependencies.

## [0.6.0] - 2022-02-21

- All dependencies updated.
- Support `"single"` specification in `"type"` filter. <https://github.com/miraclx/freyr-js/pull/124>
- Address hanging problem on exit. <https://github.com/miraclx/freyr-js/pull/125>
- Touch up final stats. <https://github.com/miraclx/freyr-js/pull/126>
- Fix `AND` and `OR` behavior when dealing with filters. <https://github.com/miraclx/freyr-js/pull/127>
- Added the `CHANGELOG.md` file to track project changes. <https://github.com/miraclx/freyr-js/pull/148>
- Introduced CI runtime checks. <https://github.com/miraclx/freyr-js/pull/121>
- Introduced CI lint checks. <https://github.com/miraclx/freyr-js/pull/123> <https://github.com/miraclx/freyr-js/pull/137>
- Automated the CI release process. <https://github.com/miraclx/freyr-js/pull/123> <https://github.com/miraclx/freyr-js/pull/148>
- Support either `AtomicParsley` or `atomicparsley`. <https://github.com/miraclx/freyr-js/pull/140>
- Documents the dependency on YouTube for sourcing audio. <https://github.com/miraclx/freyr-js/pull/142>
- Documentation now links to file index of an example library – <https://miraclx.github.io/freyr-demo-library/>.

## [0.5.0] - 2022-01-27

> Release Page: <https://github.com/miraclx/freyr-js/releases/tag/v0.5.0>

[unreleased]: https://github.com/miraclx/freyr-js/compare/v0.8.1...HEAD
[0.8.1]: https://github.com/miraclx/freyr-js/releases/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/miraclx/freyr-js/releases/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/miraclx/freyr-js/releases/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/miraclx/freyr-js/releases/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/miraclx/freyr-js/releases/tag/v0.5.0
