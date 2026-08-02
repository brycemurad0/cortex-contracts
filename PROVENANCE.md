# Release provenance

This repository is a public distribution projection, not a second contract
authority.

## 0.3.0

- Canonical repository: `brycemurad0/cortex`
- Canonical source commit: `091cd2532f8f462b68fd986fdbcbc444dbdb44c2`
- Canonical source path: `contracts/`
- Intended release tag: `contracts-v0.3.0`
- Canonical release-candidate npm SHA-256:
  `37e83f029fd7a7787cfedb8a7d3c5bb2f17166e04030901dc9576ae5763c6800`
- Canonical release-candidate wheel SHA-256:
  `2d433b94b3b5d5b0f5f909fa71da46e5fbdbf4afdfc1fb2304b246129f2c7885`

The public release workflow rebuilds and clean-installs the projection on the
tag. Its attached `SHA256SUMS` is the consumer integrity authority; the hashes
above attest the independently reproducible canonical-source build used to
prepare this projection.

## 0.2.0

- Canonical repository: `brycemurad0/cortex`
- Canonical source commit: `896e69256cf94d601214c5daf6d388623703652a`
- Canonical source path: `contracts/`
- Original release tag: `contracts-v0.2.0`
- npm artifact SHA-256:
  `f97e3e556ffb238092f63925f6f61ac92b5fe16433f96986dbf117fd168c6e11`
- Python wheel SHA-256:
  `a5d8f9125065e78325231616e526e878c619d7074b3a46d4b1c64adb04801044`

The public release workflow rebuilds from this source projection, runs all
contract tests, clean-installs both artifacts, and publishes fresh checksums.
The schema and loader files in the initial projection were copied exactly from
the canonical commit; only distribution-facing documentation and workflow
metadata were added or adjusted.
