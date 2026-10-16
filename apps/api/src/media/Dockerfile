ARG BUN_IMAGE
FROM ${BUN_IMAGE}
WORKDIR /decoder
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/website/package.json apps/website/package.json
RUN bun install --frozen-lockfile --ignore-scripts
COPY apps/api/src/media/decoder.ts apps/api/src/media/input.ts apps/api/src/media/
COPY apps/api/src/contracts/s07.ts apps/api/src/contracts/s07.ts
COPY apps/api/src/modules/request-security.ts apps/api/src/modules/request-security.ts
COPY apps/api/src/contracts/s02.ts apps/api/src/contracts/s02.ts
USER 10000:10000
ENV S07_DECODER_ENTRY=1
ENTRYPOINT ["bun", "apps/api/src/media/decoder.ts"]
