# Deployment Reference Notes

These notes capture the external deployment facts used for the repository manifests and runbook.

Render Blueprints use a root-level `services` list and support service types such as `web`, `pserv` for private services, and `worker` for background processes. Each service can declare `rootDir`, `buildCommand`, `startCommand`, `healthCheckPath`, and environment values supplied through a dashboard prompt (`sync: false`) or a generated secret (`generateValue: true`). The blueprint file convention is `render.yaml` at repository root.[1]

Vercel reads `vercel.json` from the configured project root and supports `buildCommand`, `outputDirectory`, SPA rewrites, and schema validation through `$schema`.[2] For a monorepo, Vercel recommends creating a project for each deployed application and selecting the relevant directory as its Root Directory. It recognizes pnpm workspaces from the root lockfile and workspace definition.[3]

## References

[1]: https://render.com/docs/blueprint-spec "Render Blueprint YAML Reference"
[2]: https://vercel.com/docs/project-configuration/vercel-json "Vercel Static Configuration with vercel.json"
[3]: https://vercel.com/docs/monorepos "Vercel Using Monorepos"
