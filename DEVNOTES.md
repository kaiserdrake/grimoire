# Development

## Accessing dev environment remotely

Using SSH tunnel, you can access the development environment running inside the tailscale. This is convenient for testing with external systems.
```bash
ssh -L 8087:localhost:8087 -L 3002:localhost:3002 <user>@<tailscale>
```
