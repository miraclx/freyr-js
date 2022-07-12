
# freyr testing

freyr is bundled with its own flexibly customizable test runner.

- To run all tests

  ```console
  npm run test -- --all
  ```

- To run just Spotify tests

  ```console
  npm run test -- spotify
  ```

- To run just Apple Music artist tests

  ```console
  npm run test -- apple_music.artist
  ```

- You can use a custom test suite (see the [default suite](https://github.com/miraclx/freyr-js/blob/master/test/default.json) for an example)

  ```console
  npm run test -- --all --suite ./special_cases.json
  ```

- And optionally, you can run the tests inside a freyr docker container

  ```console
  npm run test -- deezer --docker freyr-dev:latest
  ```

## `npm run test -- --help`

```console
freyr-test
----------
Usage: freyr-test [options] [<SERVICE>[.<TYPE>]...]

Utility for testing the Freyr CLI

Options:

  SERVICE                 spotify / apple_music / deezer
  TYPE                    track / album / artist / playlist

  --all                   run all tests
  --suite <SUITE>         use a specific test suite (json)
  --docker <IMAGE>        run tests in a docker container
  --help                  show this help message

Enviroment Variables:

  DOCKER_ARGS             arguments to pass to `docker run`

Example:

  $ freyr-test --all
      runs all tests

  $ freyr-test spotify
      runs all Spotify tests

  $ freyr-test apple_music.album
      tests downloading an Apple Music album

  $ freyr-test spotify.track deezer.artist
      tests downloading a Spotify track and Deezer artist
```
