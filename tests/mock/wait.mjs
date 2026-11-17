// Waits until the stand-in database answers (used before building in CI,
// because the build reads the film list from it).
const url = "http://127.0.0.1:54321/rest/v1/films";
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(url)).ok) process.exit(0);
  } catch {
    // not up yet
  }
  await new Promise((r) => setTimeout(r, 1000));
}
console.error("The stand-in database did not start.");
process.exit(1);
