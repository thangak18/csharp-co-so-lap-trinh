#!/bin/sh
# Rebuild the in-browser C# runner into ./runner
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.dotnet:$PATH" DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1
rm -rf .runner-publish runner
dotnet publish runner-src -c Release -o .runner-publish | grep -E " error |Build FAILED" || true
cp -R .runner-publish/wwwroot runner
rm -rf .runner-publish runner-src/bin runner-src/obj
find runner -name "*.br" -delete
du -sh runner
